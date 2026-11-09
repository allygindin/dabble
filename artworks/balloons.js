// Artwork: Balloon Festival (hard). Hot-air balloons over patchwork fields.
// Format: see README.md. Palette checked by check.html.
(function () {
  const f1 = (v) => Math.round(v * 10) / 10;
  const R = []; // regions, in drawing order

  // --- sky ----------------------------------------------------------------
  R.push({ c: 1, rect: [0, 0, 800, 600] });
  R.push({ c: 2, d: 'M0 300Q400 268 800 300V600H0Z' });
  R.push({ c: 3, circle: [650, 110, 46] });
  const cloud = (x, y, s) => {
    const p = [[0, 0], [-18, 0, -20, -26, 2, -28], [4, -50, 34, -56, 46, -40], [56, -60, 92, -58, 96, -34], [116, -36, 124, -2, 102, 0]];
    const f = (v, i) => (i % 2 ? y + v * s : x + v * s).toFixed(1);
    R.push({ c: 4, d: 'M' + p[0].map(f).join(' ') + p.slice(1).map((q) => 'C' + q.map(f).join(' ')).join('') + 'Z' });
  };
  cloud(30, 120, 0.8); cloud(240, 66, 0.7); cloud(470, 196, 0.9); cloud(560, 262, 0.6); cloud(706, 58, 0.6);

  // --- land ---------------------------------------------------------------
  R.push({ c: 5, d: 'M0 330C120 290 220 300 330 325C450 282 560 290 680 320C730 306 770 300 800 310V600H0Z' });
  R.push({ c: 6, d: 'M0 380C150 340 300 350 420 385C540 350 680 345 800 375V600H0Z' });
  // Patchwork fields (their lower edge is hidden by the next hill).
  [0, 110, 220, 330, 440, 550, 660].forEach((x, i) => {
    const x0 = i === 0 ? 0 : x + 14, x1 = i === 6 ? 800 : x + 124; // square off at the picture edges
    R.push({ c: i % 2 ? 10 : 9, poly: [x, 398, i === 6 ? 800 : x + 110, 394, x1, 480, x0, 484] });
  });
  R.push({ c: 7, d: 'M0 440C200 400 400 410 560 445C650 430 740 425 800 435V600H0Z' });
  R.push({ c: 11, d: 'M90 600C140 540 260 520 330 490C380 470 430 460 480 452L502 457C440 471 400 484 352 506C282 536 186 562 146 600Z' });
  R.push({ c: 6, d: 'M0 522C120 500 220 512 300 540C350 558 380 580 392 600H0Z' });

  // Trees: trunk then round canopy.
  const tree = (cx, cy, r) => {
    R.push({ c: 22, rect: [cx - 4, cy + r - 5, 8, 15] });
    R.push({ c: 8, circle: [cx, cy, r] });
  };
  [[604, 424, 13], [636, 420, 14], [668, 419, 13], [700, 420, 14], [732, 422, 13], [764, 426, 14]].forEach((t) => tree(...t));
  tree(60, 498, 17); tree(112, 504, 15);

  // Barn: wall, roof, door, two windows.
  R.push({ c: 12, rect: [520, 430, 56, 40] });
  R.push({ c: 20, poly: [512, 431, 548, 402, 584, 431] });
  R.push({ c: 21, rect: [538, 448, 20, 22] });
  R.push({ c: 21, rect: [525, 437, 11, 10] });
  R.push({ c: 21, rect: [560, 437, 11, 10] });

  // --- balloons -------------------------------------------------------------
  // Envelope split into 6 gores between meridians; edge gores look narrower,
  // which gives the round 3D look. Then skirt, basket rim, basket.
  const halfWidth = (cy, r, y) => {
    if (y <= cy) return r * Math.sqrt(Math.max(0, 1 - ((y - cy) / r) ** 2));
    const s = (y - cy) / (1.25 * r);
    return r * (1 - 0.7 * Math.pow(s, 1.6));
  };
  const balloon = (cx, cy, r, colors) => {
    const N = 22, ys = [];
    for (let k = 0; k <= N; k++) ys.push(cy - r + (2.25 * r * k) / N);
    for (let g = 0; g < 6; g++) {
      const u0 = -1 + g / 3, u1 = -1 + (g + 1) / 3;
      const left = ys.map((y) => [f1(cx + u0 * halfWidth(cy, r, y)), f1(y)]);
      const right = ys.map((y) => [f1(cx + u1 * halfWidth(cy, r, y)), f1(y)]).reverse();
      R.push({ c: colors[g % colors.length], poly: left.concat(right).flat() });
    }
    const neck = cy + 1.25 * r, rimH = Math.max(8.5, 0.2 * r);
    R.push({ c: 20, poly: [cx - 0.3 * r, neck, cx + 0.3 * r, neck, cx + 0.25 * r, neck + 0.3 * r, cx - 0.25 * r, neck + 0.3 * r].map(f1) });
    R.push({ c: 10, rect: [cx - 0.27 * r, neck + 0.3 * r, 0.54 * r, rimH].map(f1) });
    R.push({ c: 22, rect: [cx - 0.25 * r, neck + 0.3 * r + rimH, 0.5 * r, 0.42 * r].map(f1) });
  };
  balloon(130, 190, 50, [12, 21]);
  balloon(330, 140, 38, [16, 17]);
  balloon(560, 150, 30, [13, 3, 12]);
  balloon(740, 228, 36, [14, 15]);
  balloon(450, 268, 26, [18, 19]);
  balloon(250, 296, 22, [20, 3]);
  balloon(630, 300, 24, [19, 17, 16]);
  balloon(440, 78, 22, [13, 21]);
  balloon(230, 92, 26, [11, 15]);

  // Birds: chunky V shapes.
  [[360, 250], [392, 236], [520, 60]].forEach(([x, y]) =>
    R.push({ c: 20, poly: [x - 16, y - 7, x, y + 3, x + 16, y - 7, x + 16, y + 3, x, y + 13, x - 16, y + 3] }));

  PBN.registerArtwork({
    id: 'balloon-festival',
    title: 'Balloon Festival',
    difficulty: 'Hard',
    tags: ['sky'],
    viewBox: [0, 0, 800, 600],
    maxZoom: 12,
    palette: [
      ['#7EC6EE', 'Sky'], ['#C4E7F8', 'Pale sky'], ['#FFD84D', 'Sun'], ['#D8D0F0', 'Cloud'], ['#8C9BD1', 'Far hills'],
      ['#B5DB8C', 'Spring green'], ['#7CBF5E', 'Leaf green'], ['#2F7A3E', 'Forest'], ['#F2D16B', 'Wheat'], ['#D9B27C', 'Tan'],
      ['#2A74AE', 'River'], ['#C62F2F', 'Red'], ['#FF9A3C', 'Orange'], ['#147372', 'Teal'], ['#9EE0C9', 'Mint'],
      ['#7B4FC2', 'Purple'], ['#C8A8EE', 'Lilac'], ['#FF8FB3', 'Pink'], ['#C2187A', 'Magenta'], ['#24305E', 'Navy'],
      ['#F7E2A8', 'Cream'], ['#8A5A34', 'Wicker'],
    ],
    regions: R,
  });
})();
