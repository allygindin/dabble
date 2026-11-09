// Finds where to draw each region's number: the visible point farthest from
// any edge (regions drawn later sit on top and hide parts of earlier ones).
// Font size follows that clearance, so tiny regions get tiny numbers.
//
// Fast path: paint every region into an offscreen canvas in a unique color
// (an "ID buffer"), run one distance transform over the whole image, and take
// each region's deepest pixel. Cost barely depends on the region count.
// Slow fallback (per-point isPointInFill) is used only for regions too small
// to own any clean pixel in the buffer. Results are cached per artwork.
(function () {
  const RES = 900;  // ID-buffer size along the artwork's longer side

  PBN.labels = {
    get(art, sig, paths) {
      // Uploaded pictures keep their label cache inside their IndexedDB record.
      if (art.user) {
        const lc = art.labelCache;
        if (lc && lc.sig === sig && lc.labels.length === paths.length) return lc.labels;
        const labels = compute(art, paths);
        art.labelCache = { sig, labels };
        if (PBN.userArt && PBN.userArt.has(art.id)) PBN.userArt.save(art).catch(() => {});
        return labels;
      }
      const key = 'labels4:' + art.id + ':' + sig;
      const cached = PBN.store.get(key);
      if (Array.isArray(cached) && cached.length === paths.length) return cached;
      const res = compute(art, paths);
      PBN.store.set(key, res);
      return res;
    },
  };

  const r2 = (v) => Math.round(v * 100) / 100;

  function compute(art, paths) {
    const [vx, vy, vw, vh] = art.viewBox;
    const W = Math.max(vw, vh);
    // No readability floor: a number must never be bigger than its region
    // (tiny ones become readable when you zoom in).
    const minF = W * 0.003, maxF = W * 0.065;
    const sizeFor = (i, clearance) => {
      const k = String(art.regions[i].c).length > 1 ? 1.15 : 1.45;
      return r2(Math.min(maxF, Math.max(minF, clearance * k)));
    };

    const found = idBuffer(art, paths) || [];
    let slow = null;
    return paths.map((p, i) => {
      const r = art.regions[i];
      if (r.label) { const sz = r.label[2] || W * 0.03; return { x: r.label[0], y: r.label[1], size: sz, r: r2(sz / 1.3) }; }
      let hit = found[i];
      if (!hit) {
        slow = slow || pointTester(paths);
        hit = slow(i);
      }
      if (!hit) {
        const b = p.getBBox();
        return { x: r2(b.x + b.width / 2), y: r2(b.y + b.height / 2), size: r2(minF), r: 0 };
      }
      // r = radius of the largest circle inside the region's visible part (artwork units)
      return { x: r2(hit.x), y: r2(hit.y), size: sizeFor(i, hit.d), r: r2(hit.d) };
    });
  }

  function idBuffer(art, paths) {
    if (typeof Path2D !== 'function') return null;
    const [vx, vy, vw, vh] = art.viewBox;
    const scale = RES / Math.max(vw, vh);
    const w = Math.ceil(vw * scale), h = Math.ceil(vh * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    // Region i gets code (i+1)*K mod 2^24 (K odd, so it's invertible).
    // Anti-aliased edge pixels blend two codes and decode to garbage ids,
    // so they are treated as edges. Decoding is pure arithmetic: no lookups.
    const n = paths.length;
    const M = 0xFFFFFF, K = 0x9E3779;
    let KI = K;
    for (let t = 0; t < 5; t++) KI = Math.imul(KI, (2 - Math.imul(K, KI)) & M) & M;
    const codeOf = (i) => Math.imul(i + 1, K) & M;

    ctx.setTransform(scale, 0, 0, scale, -vx * scale, -vy * scale);
    try {
      paths.forEach((p, i) => {
        ctx.fillStyle = '#' + codeOf(i).toString(16).padStart(6, '0');
        ctx.fill(new Path2D(p.getAttribute('d')));
      });
    } catch (e) { return null; }

    const px = ctx.getImageData(0, 0, w, h).data;
    const N = w * h;
    const ids = new Int32Array(N);
    for (let k = 0, j = 0; k < N; k++, j += 4) {
      const id = (Math.imul((px[j] << 16) | (px[j + 1] << 8) | px[j + 2], KI) & M) - 1;
      ids[k] = id >= 0 && id < n && px[j + 3] === 255 ? id : -1;
    }

    // Seeds (distance 0): unknown pixels, image border, or any pixel whose
    // 4-neighbour belongs to a different region.
    const D = new Float32Array(N);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const k = y * w + x, id = ids[k];
        if (id < 0 || x === 0 || y === 0 || x === w - 1 || y === h - 1 ||
            ids[k - 1] !== id || ids[k + 1] !== id || ids[k - w] !== id || ids[k + w] !== id) D[k] = 0;
        else D[k] = 1e9;
      }
    }
    // Two-pass chamfer distance transform (pixels).
    const dg = Math.SQRT2;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const k = y * w + x;
      let d = D[k];
      if (!d) continue;
      let v = D[k - 1] + 1; if (v < d) d = v;
      v = D[k - w] + 1; if (v < d) d = v;
      v = D[k - w - 1] + dg; if (v < d) d = v;
      v = D[k - w + 1] + dg; if (v < d) d = v;
      D[k] = d;
    }
    const bestD = new Float32Array(n), bestK = new Int32Array(n).fill(-1);
    for (let y = h - 2; y >= 1; y--) for (let x = w - 2; x >= 1; x--) {
      const k = y * w + x;
      let d = D[k];
      if (!d) continue;
      let v = D[k + 1] + 1; if (v < d) d = v;
      v = D[k + w] + 1; if (v < d) d = v;
      v = D[k + w + 1] + dg; if (v < d) d = v;
      v = D[k + w - 1] + dg; if (v < d) d = v;
      D[k] = d;
      const id = ids[k];
      if (d > bestD[id]) { bestD[id] = d; bestK[id] = k; }
    }

    const out = [];
    for (let i = 0; i < n; i++) {
      if (bestK[i] < 0) continue; // too small for the buffer -> slow path
      const k = bestK[i];
      out[i] = { x: ((k % w) + 0.5) / scale + vx, y: (Math.floor(k / w) + 0.5) / scale + vy, d: bestD[i] / scale };
    }
    return out;
  }

  // Original per-point method, for tiny regions only.
  function pointTester(paths) {
    const n = paths.length;
    const svg = paths[0].ownerSVGElement;
    const pt = svg.createSVGPoint();
    const boxes = paths.map((p) => p.getBBox());
    if (typeof paths[0].isPointInFill !== 'function') return () => null;
    const inFill = (j, x, y) => { pt.x = x; pt.y = y; return paths[j].isPointInFill(pt); };
    const visible = (i, x, y) => {
      if (!inFill(i, x, y)) return false;
      for (let j = i + 1; j < n; j++) {
        const b = boxes[j];
        if (x < b.x || y < b.y || x > b.x + b.width || y > b.y + b.height) continue;
        if (inFill(j, x, y)) return false;
      }
      return true;
    };
    return function (i) {
      const b = boxes[i];
      const N = 24;
      const cs = Math.max(b.width, b.height) / N;
      if (!(cs > 0)) return null;
      let best = null;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const px = b.x + (x + 0.5) * cs, py = b.y + (y + 0.5) * cs;
        if (!visible(i, px, py)) continue;
        const dc = Math.hypot(px - (b.x + b.width / 2), py - (b.y + b.height / 2));
        if (!best || dc < best.dc) best = { x: px, y: py, d: cs, dc };
      }
      return best;
    };
  }
})();
