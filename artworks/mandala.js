// Artwork: Mandala Bloom (hard). Concentric rings of petals, scallops and dots.
// Format: see README.md. The palette is built from shade families (blues,
// teals, pinks, oranges, purples, greens) ordered light to dark, numbered so
// similar shades never get easily confused numbers (checked by check.html).
(function () {
  const f1 = (v) => Math.round(v * 10) / 10;
  const CX = 300, CY = 300;
  const R = []; // regions, in drawing order

  const at = (r, deg) => { const a = ((deg - 90) * Math.PI) / 180; return [CX + r * Math.cos(a), CY + r * Math.sin(a)]; };
  // Pointed petal (lens) along angle `deg`, from radius r0 to r1, max width w.
  const petal = (c, deg, r0, r1, w) => {
    const [x0, y0] = at(r0, deg), [x1, y1] = at(r1, deg), [mx, my] = at((r0 + r1) / 2, deg);
    const a = (deg * Math.PI) / 180, nx = Math.cos(a) * w, ny = Math.sin(a) * w;
    R.push({ c, d: `M${f1(x0)} ${f1(y0)}Q${f1(mx + nx)} ${f1(my + ny)} ${f1(x1)} ${f1(y1)}Q${f1(mx - nx)} ${f1(my - ny)} ${f1(x0)} ${f1(y0)}Z` });
  };
  const ring = (n, fn, offset = 0) => { for (let k = 0; k < n; k++) fn((360 / n) * k + offset, k); };
  const disk = (c, r) => R.push({ c, circle: [CX, CY, r] });
  const dot = (c, r, deg, size) => { const [x, y] = at(r, deg); R.push({ c, circle: [f1(x), f1(y), size] }); };

  // Background and corner ornaments (two leaves, a gold bud, a berry center).
  R.push({ c: 1, rect: [0, 0, 600, 600] });
  [[44, 44, 135], [556, 44, 225], [44, 556, 45], [556, 556, 315]].forEach(([x, y, deg]) => {
    R.push({ c: 8, ellipse: [x, y, 13, 36, deg - 40] });
    R.push({ c: 8, ellipse: [x, y, 13, 36, deg + 40] });
    R.push({ c: 18, circle: [x, y, 17] });
    R.push({ c: 11, circle: [x, y, 8] });
  });

  // Outer spikes, scallops, deep-blue band with cream dots.
  ring(24, (deg, k) => petal(k % 2 ? 3 : 4, deg, 236, 288, 30));
  ring(24, (deg, k) => dot(k % 2 ? 6 : 7, 235, deg, 18), 7.5);
  disk(5, 232);
  ring(24, (deg) => dot(19, 220, deg, 7), 7.5);
  disk(2, 208);

  // Big petal ring: small lilac petals peeking between big petals with inner petals.
  ring(16, (deg) => petal(16, deg, 150, 204, 24), 11.25);
  ring(16, (deg, k) => {
    petal(k % 2 ? 13 : 10, deg, 118, 200, 56);
    petal(k % 2 ? 12 : 9, deg, 132, 182, 28);
  });

  // Violet band with gold dots, lavender ground for the green ring.
  disk(17, 125);
  ring(12, (deg) => dot(18, 112, deg, 8), 15);
  disk(15, 100);
  ring(12, (deg, k) => {
    petal(k % 2 ? 21 : 20, deg, 40, 98, 32);
    petal(22, deg, 54, 88, 13);
  });

  // Center: rust disk, cream petals, gold and berry eyes.
  disk(14, 45);
  ring(8, (deg) => petal(19, deg, 12, 42, 17));
  disk(18, 14);
  disk(11, 6.5);

  PBN.registerArtwork({
    id: 'mandala-bloom',
    title: 'Mandala Bloom',
    difficulty: 'Hard',
    tags: ['patterns'],
    viewBox: [0, 0, 600, 600],
    maxZoom: 12,
    palette: [
      ['#1B2440', 'Night'], ['#C2DBF7', 'Ice blue'], ['#9CC3F0', 'Sky blue'], ['#3E73C4', 'Cobalt'], ['#1D3D7A', 'Deep blue'],
      ['#A6E3D6', 'Seafoam'], ['#5FC7B4', 'Teal'], ['#1E7F72', 'Deep teal'], ['#F7C1D6', 'Petal pink'], ['#F49AC1', 'Pink'],
      ['#C23A7D', 'Berry'], ['#FFD29A', 'Apricot'], ['#FFA857', 'Tangerine'], ['#C2541A', 'Rust'], ['#D6C4F2', 'Lavender'],
      ['#B391E3', 'Lilac'], ['#6A3FB0', 'Violet'], ['#F5C542', 'Gold'], ['#F6E3B4', 'Cream'], ['#C6E6A0', 'Pistachio'],
      ['#93CE68', 'Lime'], ['#3F7F2E', 'Fern'],
    ],
    regions: R,
  });
})();
