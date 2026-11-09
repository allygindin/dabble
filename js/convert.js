// Photo -> paint-by-numbers conversion. Pure computation (no DOM), so it runs
// in a Web Worker (js/convert-worker.js) or on the main thread as a fallback.
//
// run({ width, height, data, colors, minArea, rMin, maxRegions }) returns
// { width, height, palette: [{hex, name}], regions: [{c, d}], stats }.
//
// Pipeline: light blur -> k-means in Lab -> palette rules (distinct colors,
// not near white) -> majority filter -> merge regions
// that are too small or too thin into their best neighbor -> drop unused
// colors, order palette (shade families, light to dark, no confusable numbers
// on similar shades) -> trace each region's outline with smoothing that is
// shared by both sides of every border, so regions tile without gaps.
(function (root) {
  'use strict';

  // ---------- color math ----------
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const unlin = (v) => { v = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055; return Math.max(0, Math.min(255, Math.round(v * 255))); };
  const Xn = 0.95047, Zn = 1.08883;
  function rgbToLab(r, g, b) {
    const R = lin(r), G = lin(g), B = lin(b);
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const fx = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / Xn), fy = f(R * 0.2126 + G * 0.7152 + B * 0.0722), fz = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / Zn);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }
  function labToRgb(L, a, b) {
    const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
    const inv = (t) => { const t3 = t * t * t; return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787; };
    const X = inv(fx) * Xn, Y = inv(fy), Z = inv(fz) * Zn;
    return [unlin(3.2406 * X - 1.5372 * Y - 0.4986 * Z), unlin(-0.9689 * X + 1.8758 * Y + 0.0415 * Z), unlin(0.0557 * X - 0.2040 * Y + 1.0570 * Z)];
  }
  const dE = (A, B) => Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
  const lum = (rgb) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
  const toHex = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();

  // Same rules as check.html.
  const RULE = { minDeltaE: 12, similarDeltaE: 25, minFromWhite: 15 };
  const notWhite = (lab) => dE(lab, [100, 0, 0]) >= RULE.minFromWhite + 0.5;
  // Darken a color just enough that it can't be mistaken for unpainted white.
  // (Swatch-number readability is handled by the palette UI, which puts the
  // number on a white badge for mid-brightness colors, so photo colors keep
  // their real lightness.)
  function legalize(lab) {
    for (let step = 0; step <= 60; step += 0.5) {
      const L = lab[0] - step;
      if (L < 0) break;
      const rgb = labToRgb(L, lab[1], lab[2]), back = rgbToLab(...rgb);
      if (notWhite(back)) return { rgb, lab: back };
    }
    const rgb = labToRgb(...lab);
    return { rgb, lab: rgbToLab(...rgb) };
  }

  // Numbers that are easy to misread for each other at small sizes.
  const CONF = [['1', '7'], ['3', '8'], ['5', '6'], ['6', '8'], ['8', '9'], ['0', '8']];
  function confusable(a, b) {
    const x = String(a), y = String(b);
    if (x.length !== y.length) return false;
    const d = [];
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) d.push([x[i], y[i]]);
    return d.length === 1 && CONF.some(([p, q]) => (d[0][0] === p && d[0][1] === q) || (d[0][0] === q && d[0][1] === p));
  }

  // Base hue name for a color; shades of the same hue are told apart by lightness later.
  function hueName(lab) {
    const [L, a, b] = lab, C = Math.hypot(a, b);
    if (C < 10) return 'Gray';
    const h = (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
    const name =
      h < 20 ? 'Pink' : h < 50 ? 'Red' : h < 75 ? 'Orange' : h < 100 ? 'Yellow' : h < 125 ? 'Lime' : h < 165 ? 'Green' :
      h < 200 ? 'Teal' : h < 240 ? 'Sky blue' : h < 285 ? 'Blue' : h < 315 ? 'Purple' : h < 345 ? 'Magenta' : 'Pink';
    return (name === 'Orange' || name === 'Red' || name === 'Yellow') && L < 55 && C < 50 ? 'Brown' : name;
  }
  const SHADE_WORDS = { 1: [''], 2: ['Light', 'Dark'], 3: ['Light', '', 'Dark'], 4: ['Pale', 'Light', 'Dark', 'Deep'], 5: ['Pale', 'Light', '', 'Dark', 'Deep'] };
  // Names for a palette: "Light blue", "Blue", "Dark blue"... ranked by lightness within each hue.
  function nameColors(labs) {
    const groups = new Map();
    labs.forEach((lab, i) => { const n = hueName(lab); if (!groups.has(n)) groups.set(n, []); groups.get(n).push(i); });
    const names = new Array(labs.length);
    groups.forEach((idx, base) => {
      idx.sort((a, b) => labs[b][0] - labs[a][0]);
      const words = SHADE_WORDS[idx.length];
      idx.forEach((i, rank) => {
        if (words) names[i] = words[rank] ? `${words[rank]} ${base.toLowerCase()}` : base;
        else names[i] = `${base} ${rank + 1}`; // 6+ shades of one hue: number them light to dark
      });
    });
    return names;
  }

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- k-means (Lab) ----------
  function kmeans(S, n, K, rand) {
    const C = new Float32Array(K * 3), D = new Float32Array(n).fill(Infinity);
    const d2 = (i, k) => { const a = S[i * 3] - C[k * 3], b = S[i * 3 + 1] - C[k * 3 + 1], c = S[i * 3 + 2] - C[k * 3 + 2]; return a * a + b * b + c * c; };
    let first = Math.floor(rand() * n);
    C[0] = S[first * 3]; C[1] = S[first * 3 + 1]; C[2] = S[first * 3 + 2];
    for (let k = 1; k < K; k++) { // k-means++ seeding
      let sum = 0;
      for (let i = 0; i < n; i++) { const d = d2(i, k - 1); if (d < D[i]) D[i] = d; sum += D[i]; }
      let r = rand() * sum, i = 0;
      for (; i < n - 1; i++) { r -= D[i]; if (r <= 0) break; }
      C[k * 3] = S[i * 3]; C[k * 3 + 1] = S[i * 3 + 1]; C[k * 3 + 2] = S[i * 3 + 2];
    }
    const asg = new Int32Array(n).fill(-1), counts = new Float64Array(K);
    for (let it = 0; it < 16; it++) {
      let changed = 0;
      for (let i = 0; i < n; i++) {
        let best = 0, bd = Infinity;
        for (let k = 0; k < K; k++) { const d = d2(i, k); if (d < bd) { bd = d; best = k; } }
        if (asg[i] !== best) { asg[i] = best; changed++; }
      }
      const sums = new Float64Array(K * 3); counts.fill(0);
      for (let i = 0; i < n; i++) { const k = asg[i]; counts[k]++; sums[k * 3] += S[i * 3]; sums[k * 3 + 1] += S[i * 3 + 1]; sums[k * 3 + 2] += S[i * 3 + 2]; }
      for (let k = 0; k < K; k++) if (counts[k]) { C[k * 3] = sums[k * 3] / counts[k]; C[k * 3 + 1] = sums[k * 3 + 1] / counts[k]; C[k * 3 + 2] = sums[k * 3 + 2] / counts[k]; }
      if (!changed) break;
    }
    const out = [];
    for (let k = 0; k < K; k++) if (counts[k]) out.push({ lab: [C[k * 3], C[k * 3 + 1], C[k * 3 + 2]], n: counts[k] });
    return out;
  }

  // Merge too-similar colors and nudge each to pass the readability rules.
  function finalizePalette(P) {
    for (let guard = 0; guard < 300; guard++) {
      P.forEach((p) => { const f = legalize(p.lab); p.lab = f.lab; p.rgb = f.rgb; });
      let bi = -1, bj = -1, bd = Infinity;
      for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { const d = dE(P[i].lab, P[j].lab); if (d < bd) { bd = d; bi = i; bj = j; } }
      if (bd >= RULE.minDeltaE + 0.5) break;
      const A = P[bi], B = P[bj], n = A.n + B.n;
      A.lab = [0, 1, 2].map((k) => (A.lab[k] * A.n + B.lab[k] * B.n) / n);
      A.n = n;
      P.splice(bj, 1);
    }
    return P;
  }

  // ---------- regions ----------
  function components(lbl, W, H) {
    const N = W * H, comp = new Int32Array(N).fill(-1), stack = new Int32Array(N);
    const color = [], area = [], rep = [];
    let count = 0;
    for (let p = 0; p < N; p++) {
      if (comp[p] >= 0) continue;
      const c = lbl[p];
      let sp = 0, a = 0;
      stack[sp++] = p; comp[p] = count;
      while (sp) {
        const q = stack[--sp]; a++;
        const x = q % W;
        if (x > 0 && comp[q - 1] < 0 && lbl[q - 1] === c) { comp[q - 1] = count; stack[sp++] = q - 1; }
        if (x < W - 1 && comp[q + 1] < 0 && lbl[q + 1] === c) { comp[q + 1] = count; stack[sp++] = q + 1; }
        if (q >= W && comp[q - W] < 0 && lbl[q - W] === c) { comp[q - W] = count; stack[sp++] = q - W; }
        if (q < N - W && comp[q + W] < 0 && lbl[q + W] === c) { comp[q + W] = count; stack[sp++] = q + W; }
      }
      color.push(c); area.push(a); rep.push(p); count++;
    }
    return { comp, count, color, area, rep };
  }

  // Largest inner-circle radius of each region (pixels), via a chamfer distance transform.
  function radii(comp, W, H, count) {
    const N = W * H, D = new Float32Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = y * W + x, c = comp[p];
      D[p] = (x === 0 || y === 0 || x === W - 1 || y === H - 1 || comp[p - 1] !== c || comp[p + 1] !== c || comp[p - W] !== c || comp[p + W] !== c) ? 0 : 1e9;
    }
    const dg = Math.SQRT2;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const p = y * W + x; let d = D[p]; if (!d) continue;
      let v = D[p - 1] + 1; if (v < d) d = v;
      v = D[p - W] + 1; if (v < d) d = v;
      v = D[p - W - 1] + dg; if (v < d) d = v;
      v = D[p - W + 1] + dg; if (v < d) d = v;
      D[p] = d;
    }
    const R = new Float32Array(count);
    for (let y = H - 2; y >= 1; y--) for (let x = W - 2; x >= 1; x--) {
      const p = y * W + x; let d = D[p]; if (!d) continue;
      let v = D[p + 1] + 1; if (v < d) d = v;
      v = D[p + W] + 1; if (v < d) d = v;
      v = D[p + W + 1] + dg; if (v < d) d = v;
      v = D[p + W - 1] + dg; if (v < d) d = v;
      D[p] = d;
      if (d > R[comp[p]]) R[comp[p]] = d;
    }
    return R; // inner radius is about R + 0.5
  }

  // Merge every region that is too small or too thin into the neighbor it shares the most border with.
  function mergeSmall(lbl, W, H, minArea, rMin, maxRegions) {
    for (let it = 0; it < 80; it++) {
      const { comp, count, area, rep } = components(lbl, W, H);
      const R = radii(comp, W, H, count);
      const isSmall = new Uint8Array(count);
      let nSmall = 0;
      for (let c = 0; c < count; c++) if (area[c] < minArea || R[c] + 0.5 < rMin) { isSmall[c] = 1; nSmall++; }
      if (!nSmall) {
        if (count <= maxRegions || count < 2) return;
        const order = Array.from({ length: count }, (_, i) => i).sort((a, b) => area[a] - area[b]);
        order.slice(0, count - maxRegions).forEach((c) => { isSmall[c] = 1; });
      }
      // Shared border lengths between a small region and its neighbors.
      const border = new Map();
      const add = (a, b) => { if (isSmall[a]) { const k = a * count + b; border.set(k, (border.get(k) || 0) + 1); } };
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const p = y * W + x, a = comp[p];
        if (x < W - 1) { const b = comp[p + 1]; if (a !== b) { add(a, b); add(b, a); } }
        if (y < H - 1) { const b = comp[p + W]; if (a !== b) { add(a, b); add(b, a); } }
      }
      const bestN = new Int32Array(count).fill(-1), bestL = new Int32Array(count);
      border.forEach((len, k) => { const a = Math.floor(k / count), b = k - a * count; if (len > bestL[a]) { bestL[a] = len; bestN[a] = b; } });
      // Pixels per region (counting sort), then recolor small regions, smallest first.
      const start = new Int32Array(count + 1);
      for (let p = 0; p < W * H; p++) start[comp[p] + 1]++;
      for (let c = 0; c < count; c++) start[c + 1] += start[c];
      const fill = start.slice(0, count), pix = new Int32Array(W * H);
      for (let p = 0; p < W * H; p++) pix[fill[comp[p]]++] = p;
      const smalls = [];
      for (let c = 0; c < count; c++) if (isSmall[c] && bestN[c] >= 0) smalls.push(c);
      smalls.sort((a, b) => area[a] - area[b]);
      let changed = 0;
      for (const c of smalls) {
        const target = lbl[rep[bestN[c]]]; // the neighbor's *current* color
        if (target === lbl[rep[c]]) continue;
        for (let k = start[c]; k < start[c + 1]; k++) lbl[pix[k]] = target;
        changed++;
      }
      if (!changed) return;
    }
  }

  // ---------- outline tracing ----------
  function vectorize(comp, W, H, count) {
    const VW = W + 1, NV = VW * (H + 1);
    const adj = new Int32Array(NV * 4).fill(-1), deg = new Uint8Array(NV);
    const link = (a, b) => { adj[a * 4 + deg[a]++] = b; adj[b * 4 + deg[b]++] = a; };
    for (let y = 0; y <= H; y++) for (let x = 0; x < W; x++) {
      const above = y > 0 ? comp[(y - 1) * W + x] : -1, below = y < H ? comp[y * W + x] : -1;
      if (above !== below) link(y * VW + x, y * VW + x + 1);
    }
    for (let y = 0; y < H; y++) for (let x = 0; x <= W; x++) {
      const left = x > 0 ? comp[y * W + x - 1] : -1, right = x < W ? comp[y * W + x] : -1;
      if (left !== right) link(y * VW + x, (y + 1) * VW + x);
    }
    // Smooth pixel staircases. Positions are global per border vertex, so both
    // regions on either side of a border get exactly the same curve.
    const px = new Float32Array(NV), py = new Float32Array(NV), movable = new Uint8Array(NV);
    for (let v = 0; v < NV; v++) {
      const x = v % VW, y = (v - x) / VW;
      px[v] = x; py[v] = y;
      movable[v] = deg[v] === 2 && x > 0 && y > 0 && x < W && y < H ? 1 : 0;
    }
    for (let it = 0; it < 2; it++) {
      const nx = px.slice(), ny = py.slice();
      for (let v = 0; v < NV; v++) if (movable[v]) {
        const a = adj[v * 4], b = adj[v * 4 + 1];
        nx[v] = 0.5 * px[v] + 0.25 * (px[a] + px[b]);
        ny[v] = 0.5 * py[v] + 0.25 * (py[a] + py[b]);
      }
      px.set(nx); py.set(ny);
    }
    // Drop nearly-straight points (decided once per vertex, so it's shared too).
    const removed = new Uint8Array(NV), blocked = new Uint8Array(NV);
    for (let v = 0; v < NV; v++) {
      if (deg[v] !== 2 || blocked[v]) continue;
      const a = adj[v * 4], b = adj[v * 4 + 1];
      const ex = px[b] - px[a], ey = py[b] - py[a], len = Math.hypot(ex, ey) || 1;
      if (Math.abs((px[v] - px[a]) * ey - (py[v] - py[a]) * ex) / len < 0.12) { removed[v] = 1; blocked[a] = 1; blocked[b] = 1; }
    }
    // Directed boundary edges per region, clockwise around each pixel.
    const E = Array.from({ length: count }, () => []);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = y * W + x, c = comp[p], v00 = y * VW + x, v10 = v00 + 1, v01 = v00 + VW, v11 = v01 + 1;
      if (y === 0 || comp[p - W] !== c) E[c].push(v00, v10);
      if (x === W - 1 || comp[p + 1] !== c) E[c].push(v10, v11);
      if (y === H - 1 || comp[p + W] !== c) E[c].push(v11, v01);
      if (x === 0 || comp[p - 1] !== c) E[c].push(v01, v00);
    }
    const f = (n) => String(Math.round(n * 10) / 10);
    const paths = new Array(count);
    for (let c = 0; c < count; c++) {
      const e = E[c], m = e.length / 2, out = new Map(), used = new Uint8Array(m);
      for (let k = 0; k < m; k++) { const s = e[2 * k]; if (!out.has(s)) out.set(s, []); out.get(s).push(k); }
      let d = '';
      for (let k = 0; k < m; k++) {
        if (used[k]) continue;
        const start = e[2 * k], pts = [start];
        let cur = k;
        for (;;) {
          used[cur] = 1;
          const u = e[2 * cur], v = e[2 * cur + 1];
          if (v === start) break;
          pts.push(v);
          const dx = (v % VW) - (u % VW), dy = Math.floor(v / VW) - Math.floor(u / VW);
          let next = -1, best = -2;
          for (const cand of out.get(v) || []) {
            if (used[cand]) continue;
            const w = e[2 * cand + 1], ex = (w % VW) - (v % VW), ey = Math.floor(w / VW) - Math.floor(v / VW);
            const turn = dx * ey - dy * ex; // prefer right turns: keeps diagonal-touching pixels apart
            if (turn > best) { best = turn; next = cand; }
          }
          if (next < 0) break;
          cur = next;
        }
        let keep = pts.filter((v) => !removed[v]);
        if (keep.length < 3) keep = pts;
        d += 'M' + f(px[keep[0]]) + ' ' + f(py[keep[0]]);
        for (let i = 1; i < keep.length; i++) d += 'L' + f(px[keep[i]]) + ' ' + f(py[keep[i]]);
        d += 'Z';
      }
      paths[c] = d;
    }
    return paths;
  }

  // ---------- palette order ----------
  function orderPalette(P) {
    const fam = (lab) => { const C = Math.hypot(lab[1], lab[2]); if (C < 12) return 0; const h = (Math.atan2(lab[2], lab[1]) * 180 / Math.PI + 360) % 360; return 1 + Math.floor(((h + 15) % 360) / 30); };
    let order = P.map((_, i) => i).sort((a, b) => fam(P[a].lab) - fam(P[b].lab) || P[b].lab[0] - P[a].lab[0]);
    const conflicts = (o) => {
      let n = 0;
      for (let i = 0; i < o.length; i++) for (let j = i + 1; j < o.length; j++)
        if (confusable(i + 1, j + 1) && dE(P[o[i]].lab, P[o[j]].lab) < RULE.similarDeltaE) n++;
      return n;
    };
    let cur = conflicts(order);
    for (let tries = 0; cur > 0 && tries < 200; tries++) {
      let best = null, bestScore = cur;
      for (let i = 0; i < order.length; i++) for (let j = i + 1; j < order.length; j++) {
        const o = order.slice(); [o[i], o[j]] = [o[j], o[i]];
        const s = conflicts(o);
        if (s < bestScore) { bestScore = s; best = o; }
      }
      if (!best) break;
      order = best; cur = bestScore;
    }
    return order;
  }

  // ---------- main ----------
  function run(job) {
    const { width: W, height: H, data } = job;
    const N = W * H, rand = rng(job.seed || 1234567);

    // 1. Light 3x3 blur to calm photo noise, then Lab.
    const lab = new Float32Array(N * 3);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const xx = x + i, yy = y + j;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const q = (yy * W + xx) * 4, w = i === 0 && j === 0 ? 4 : 1;
        r += data[q] * w; g += data[q + 1] * w; b += data[q + 2] * w; n += w;
      }
      const L = rgbToLab(r / n, g / n, b / n), p = (y * W + x) * 3;
      lab[p] = L[0]; lab[p + 1] = L[1]; lab[p + 2] = L[2];
    }

    // 2. Colors: k-means on a sample, then the palette rules.
    const step = Math.max(1, Math.floor(N / 16000)), n = Math.floor(N / step);
    const S = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const p = i * step * 3; S[i * 3] = lab[p]; S[i * 3 + 1] = lab[p + 1]; S[i * 3 + 2] = lab[p + 2]; }
    const P = finalizePalette(kmeans(S, n, Math.min(job.colors, n), rand));

    // 3. Assign pixels to the nearest palette color, then a majority filter for speckles.
    let lbl = new Int16Array(N);
    for (let p = 0; p < N; p++) {
      let best = 0, bd = Infinity;
      for (let k = 0; k < P.length; k++) { const c = P[k].lab, a = lab[p * 3] - c[0], b = lab[p * 3 + 1] - c[1], d = lab[p * 3 + 2] - c[2], s = a * a + b * b + d * d; if (s < bd) { bd = s; best = k; } }
      lbl[p] = best;
    }
    const tally = new Int32Array(P.length), out = new Int16Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const touched = [];
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const xx = x + i, yy = y + j;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const v = lbl[yy * W + xx]; if (!tally[v]) touched.push(v); tally[v]++;
      }
      let best = lbl[y * W + x];
      for (const v of touched) { if (tally[v] >= 5) best = v; tally[v] = 0; }
      out[y * W + x] = best;
    }
    lbl = out;

    // 4. Merge regions that are too small or too thin to tap.
    mergeSmall(lbl, W, H, job.minArea, job.rMin, job.maxRegions || 500);

    // 5. Final regions; keep only colors still in use, ordered for the palette.
    const { comp, count, color } = components(lbl, W, H);
    const usedIdx = Array.from(new Set(color)).sort((a, b) => a - b);
    const used = usedIdx.map((k) => P[k]);
    const order = orderPalette(used);
    const newNum = new Map(); // old palette index -> 1-based color number
    order.forEach((ui, pos) => newNum.set(usedIdx[ui], pos + 1));
    const names = nameColors(order.map((ui) => used[ui].lab));
    const palette = order.map((ui, pos) => ({ hex: toHex(used[ui].rgb), name: names[pos] }));

    // 6. Outlines.
    const d = vectorize(comp, W, H, count);
    const regions = [];
    for (let c = 0; c < count; c++) regions.push({ c: newNum.get(color[c]), d: d[c] });
    return { width: W, height: H, palette, regions, stats: { regions: count, colors: palette.length, requested: job.colors } };
  }

  root.PBNConvert = { run };
})(typeof self !== 'undefined' ? self : this);
