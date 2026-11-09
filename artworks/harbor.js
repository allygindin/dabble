// Artwork: Harbor Town (hard). A hillside village at sunset. Format: see README.md.
// Palette is ordered so similar shades sit together and never get easily
// confused numbers (checked by check.html).
(function () {
  const f1 = (v) => Math.round(v * 10) / 10;
  const R = []; // regions, in drawing order

  // --- sky --------------------------------------------------------------
  R.push({ c: 1, rect: [0, 0, 800, 330] });
  [[2, 80], [3, 160], [4, 228], [5, 284]].forEach(([c, y]) =>
    R.push({ c, d: `M0 ${y}Q200 ${y - 18} 400 ${y}T800 ${y}V330H0Z` }));
  R.push({ c: 8, circle: [560, 330, 56] });

  // Cloud (origin at bottom-left) plus a lavender shadow along its base.
  const cloud = (x, y, s) => {
    const p = [[0, 0], [-18, 0, -20, -26, 2, -28], [4, -50, 34, -56, 46, -40], [56, -60, 92, -58, 96, -34], [116, -36, 124, -2, 102, 0]];
    const f = (v, i) => (i % 2 ? y + v * s : x + v * s).toFixed(1);
    R.push({ c: 6, d: 'M' + p[0].map(f).join(' ') + p.slice(1).map((q) => 'C' + q.map(f).join(' ')).join('') + 'Z' });
    R.push({ c: 7, ellipse: [f1(x + 52 * s), f1(y - 5 * s), f1(44 * s), f1(8 * s)] });
  };
  cloud(70, 78, 1.0);
  cloud(320, 128, 0.8);
  cloud(640, 70, 0.9);

  // Birds: chunky V shapes so they stay tappable.
  [[230, 190], [262, 176], [470, 150], [505, 166]].forEach(([x, y]) =>
    R.push({ c: 1, poly: [x - 16, y - 7, x, y + 3, x + 16, y - 7, x + 16, y + 3, x, y + 13, x - 16, y + 3] }));

  // --- sea --------------------------------------------------------------
  R.push({ c: 9, rect: [0, 330, 800, 270] });
  R.push({ c: 10, d: 'M0 400Q200 385 400 400T800 400V600H0Z' });
  R.push({ c: 11, d: 'M0 492Q200 477 400 492T800 492V600H0Z' });
  const wave = (x, y, w) => R.push({ c: 12, d: `M${x} ${y}Q${x + w / 2} ${y - 28} ${x + w} ${y}Q${x + w / 2} ${y - 8} ${x} ${y}Z` });
  wave(600, 366, 60); wave(700, 362, 54); wave(735, 510, 54); wave(735, 440, 50); wave(560, 545, 70); wave(700, 575, 64);

  // --- hillside -----------------------------------------------------------
  R.push({ c: 13, d: 'M0 200C150 180 260 230 360 300C430 350 480 420 520 600H0Z' });
  R.push({ c: 14, ellipse: [150, 560, 95, 26] });
  R.push({ c: 14, ellipse: [395, 545, 52, 18] });
  R.push({ c: 16, d: 'M296 600C296 560 326 530 346 472L366 472C348 530 322 562 322 600Z' });

  // Houses: wall, roof, door, two lit windows.
  const house = (x, base, w, h, wall, roof) => {
    R.push({ c: wall, rect: [x, base - h, w, h] });
    R.push({ c: roof, poly: [x - 6, base - h, f1(x + w / 2), f1(base - h - h * 0.6), x + w + 6, base - h] });
    R.push({ c: 21, rect: [f1(x + w / 2 - 7), base - 21, 14, 21] });
    R.push({ c: 8, rect: [x + 7, base - h + 9, 13, 12] });
    R.push({ c: 8, rect: [x + w - 20, base - h + 9, 13, 12] });
  };
  const walls = [16, 4, 17, 18], roofs = [19, 20, 24];
  let k = 0;
  const row = (xs, base, w, h) => xs.forEach((x) => { house(x, base, w, h, walls[k % 4], roofs[k % 3]); k++; });
  row([15, 85, 155, 225], 275, 60, 45);
  row([40, 110, 180, 250, 320], 355, 62, 45);
  row([20, 95, 170, 245, 320], 440, 64, 46);

  // Round trees: trunk then canopy.
  const tree = (cx, cy, r) => {
    R.push({ c: 21, rect: [cx - 5, cy + r - 6, 10, 20] });
    R.push({ c: 15, circle: [cx, cy, r] });
  };
  tree(305, 258, 18); tree(402, 340, 17); tree(408, 432, 19); tree(90, 512, 24); tree(235, 512, 22);

  // --- harbor -------------------------------------------------------------
  R.push({ c: 22, rect: [470, 470, 230, 18] });
  [492, 540, 588, 690].forEach((x) => R.push({ c: 21, rect: [x, 488, 10, 26] }));

  // Lighthouse: striped tapering tower, rail, lantern room, roof.
  const tower = (y0, y1) => {
    const half = (y) => 22 - ((470 - y) / 170) * 7; // 22 at the base, 15 at the top
    return [712 - half(y0), y0, 712 + half(y0), y0, 712 + half(y1), y1, 712 - half(y1), y1].map(f1);
  };
  [[470, 428, 19], [428, 386, 16], [386, 343, 19], [343, 300, 16]].forEach(([a, b, c]) => R.push({ c, poly: tower(a, b) }));
  R.push({ c: 20, rect: [692, 286, 40, 14] });
  R.push({ c: 8, rect: [698, 256, 28, 30] });
  R.push({ c: 19, poly: [690, 256, 712, 230, 734, 256] });

  // Sailboats: hull, hull stripe, mainsail, jib.
  const boat = (x, y, s, hull, stripe, sail, jib) => {
    const P = (pts) => pts.map((v, i) => f1(i % 2 ? y + v * s : x + v * s));
    R.push({ c: hull, poly: P([-42, 0, 42, 0, 31, 23, -31, 23]) });
    R.push({ c: stripe, poly: P([-38, 3, 38, 3, 35, 12, -35, 12]) });
    R.push({ c: sail, poly: P([-3, -4, -3, -72, -40, -4]) });
    R.push({ c: jib, poly: P([3, -4, 3, -60, 34, -4]) });
  };
  boat(560, 418, 0.9, 1, 16, 16, 23);
  boat(650, 540, 1.15, 24, 23, 16, 4);
  boat(468, 394, 0.85, 19, 16, 23, 16);

  PBN.registerArtwork({
    id: 'harbor-town',
    title: 'Harbor Town',
    difficulty: 'Hard',
    tags: ['buildings'],
    viewBox: [0, 0, 800, 600],
    maxZoom: 12,
    palette: [
      ['#2F3F7A', 'Indigo'], ['#6C5BA7', 'Dusk'], ['#E58BB0', 'Rose'], ['#F8B08A', 'Peach'], ['#FBCB6E', 'Gold'],
      ['#DCCBF0', 'Cloud'], ['#B9A6DD', 'Cloud shade'], ['#FFE96B', 'Sunlight'], ['#8FCDE3', 'Shallows'], ['#2A6E9E', 'Sea'],
      ['#183F66', 'Deep sea'], ['#BDEBF2', 'Foam'], ['#A9D477', 'Grass'], ['#7DB65A', 'Meadow'], ['#2F6B3C', 'Pine'],
      ['#F7E3B8', 'Cream'], ['#D6EEBB', 'Mint'], ['#F7BCC8', 'Blush'], ['#B8432D', 'Terracotta'], ['#4B5878', 'Slate'],
      ['#7A4A2E', 'Wood'], ['#B7B7C6', 'Stone'], ['#FF9566', 'Coral'], ['#6B2F8A', 'Plum'],
    ],
    regions: R,
  });
})();
