// Finds where to draw each region's number: the visible point farthest from
// any edge (regions drawn later sit on top and hide parts of earlier ones).
// Font size follows that clearance, so tiny regions get tiny numbers.
// Results are cached per artwork signature.
(function () {
  PBN.labels = {
    get(art, sig, paths) {
      const key = 'labels:' + art.id + ':' + sig;
      const cached = PBN.store.get(key);
      if (Array.isArray(cached) && cached.length === paths.length) return cached;
      const res = compute(art, paths);
      PBN.store.set(key, res);
      return res;
    },
  };

  function compute(art, paths) {
    const [, , vw, vh] = art.viewBox;
    const W = Math.max(vw, vh);
    const minF = W * 0.012, maxF = W * 0.065;
    const n = paths.length;
    const svg = paths[0].ownerSVGElement;
    const pt = svg.createSVGPoint();
    const boxes = paths.map((p) => p.getBBox());
    const canTest = typeof paths[0].isPointInFill === 'function';
    const r2 = (v) => Math.round(v * 100) / 100;

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

    function search(i, N) {
      const b = boxes[i];
      const cs = Math.max(b.width, b.height) / N;
      if (!(cs > 0)) return null;
      const nx = Math.max(1, Math.ceil(b.width / cs)), ny = Math.max(1, Math.ceil(b.height / cs));
      const GW = nx + 2, GH = ny + 2;
      const D = new Float32Array(GW * GH); // border ring stays 0 = "outside"
      let any = false;
      for (let y = 0; y < ny; y++) {
        for (let x = 0; x < nx; x++) {
          if (visible(i, b.x + (x + 0.5) * cs, b.y + (y + 0.5) * cs)) { D[(y + 1) * GW + x + 1] = 1e9; any = true; }
        }
      }
      if (!any) return null;
      // Two-pass chamfer distance transform.
      const dg = cs * Math.SQRT2;
      for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) {
        const k = y * GW + x;
        if (D[k]) D[k] = Math.min(D[k], D[k - 1] + cs, D[k - GW] + cs, D[k - GW - 1] + dg, D[k - GW + 1] + dg);
      }
      let best = -1, bd = 0;
      for (let y = GH - 2; y >= 1; y--) for (let x = GW - 2; x >= 1; x--) {
        const k = y * GW + x;
        if (!D[k]) continue;
        D[k] = Math.min(D[k], D[k + 1] + cs, D[k + GW] + cs, D[k + GW + 1] + dg, D[k + GW - 1] + dg);
        if (D[k] > bd + 1e-6) { bd = D[k]; best = k; }
      }
      const gx = (best % GW) - 1, gy = Math.floor(best / GW) - 1;
      return { x: b.x + (gx + 0.5) * cs, y: b.y + (gy + 0.5) * cs, d: Math.max(bd - cs * 0.5, cs * 0.5) };
    }

    return paths.map((p, i) => {
      const r = art.regions[i];
      const b = boxes[i];
      const k = String(r.c).length > 1 ? 1.15 : 1.45;
      if (r.label) return { x: r.label[0], y: r.label[1], size: r.label[2] || minF * 2 };
      if (!canTest) return { x: r2(b.x + b.width / 2), y: r2(b.y + b.height / 2), size: r2(minF * 2) };
      const hit = search(i, 36) || search(i, 110);
      if (!hit) return { x: r2(b.x + b.width / 2), y: r2(b.y + b.height / 2), size: r2(minF) };
      return { x: r2(hit.x), y: r2(hit.y), size: r2(Math.min(maxF, Math.max(minF, hit.d * k))) };
    });
  }
})();
