// Artwork: Coral Reef (hard, 80 regions). Format: see artworks/flower.js and README.md.
// This one builds repeated things (fish, kelp, corals) with small helper functions.
(function () {
  const f1 = (v) => Math.round(v * 10) / 10;

  // Wavy ribbon rising from (x0, base) to height h: kelp, and jellyfish tentacles.
  const ribbon = (c, x0, base, h, w, phase) => {
    const L = [], R = [];
    for (let k = 0; k <= 14; k++) {
      const t = k / 14;
      const y = base - t * h;
      const x = x0 + Math.sin(t * Math.PI * 2.2 + phase) * 10 * t;
      const hw = (w / 2) * (1 - 0.6 * t) + 0.6;
      L.push(f1(x - hw), f1(y));
      R.unshift(f1(x + hw), f1(y));
    }
    return { c, poly: L.concat(R) };
  };

  // Fish facing right (dir 1) or left (dir -1): tail, optional fin, body, stripe, eye.
  const fish = (x, y, s, dir, body, stripe, fin) => {
    const X = (dx) => f1(x + dx * s * dir), Y = (dy) => f1(y + dy * s);
    const out = [{ c: body, poly: [X(-20), Y(0), X(-38), Y(-13), X(-33), Y(0), X(-38), Y(13)] }];
    if (fin) out.push({ c: stripe, poly: [X(-12), Y(-10), X(-4), Y(-24), X(10), Y(-12)] });
    out.push({ c: body, ellipse: [x, y, 26 * s, 15 * s] });
    out.push({ c: stripe, ellipse: [X(4), y, 4.5 * s, 13 * s] });
    out.push({ c: 13, circle: [X(15), Y(-4), 2.6 * s] });
    return out;
  };

  const fan = (c, cx, base, s) => {
    const P = (dx, dy) => `${f1(cx + dx * s)} ${f1(base + dy * s)}`;
    // short stem opening into a broad fan with a scalloped top edge
    return { c, d: `M${P(-3, 0)}L${P(-4, -28)}C${P(-34, -34)} ${P(-52, -56)} ${P(-48, -78)}Q${P(-40, -94)} ${P(-24, -88)}Q${P(-12, -104)} ${P(0, -92)}Q${P(12, -104)} ${P(24, -88)}Q${P(40, -94)} ${P(48, -78)}C${P(52, -56)} ${P(34, -34)} ${P(4, -28)}L${P(3, 0)}Z` };
  };
  const brain = (c, cx, y, rx, ry) => ({ c, d: `M${cx - rx} ${y}A${rx} ${ry} 0 0 1 ${cx + rx} ${y}Z` });
  const tube = (c, x, base, w, h) => ({ c, d: `M${x} ${base}V${base - h + w / 2}A${w / 2} ${w / 2} 0 0 1 ${x + w} ${base - h + w / 2}V${base}Z` });
  const star = (c, cx, cy, R, r, rot) => {
    const pts = [];
    for (let k = 0; k < 10; k++) {
      const a = ((rot + k * 36 - 90) * Math.PI) / 180, rr = k % 2 ? r : R;
      pts.push(f1(cx + rr * Math.cos(a)), f1(cy + rr * Math.sin(a)));
    }
    return { c, poly: pts };
  };
  const shell = (c, x, y, s) => ({ c, d: `M${x} ${y}L${f1(x - 12 * s)} ${f1(y - 14 * s)}A${16 * s} ${16 * s} 0 0 1 ${f1(x + 12 * s)} ${f1(y - 14 * s)}Z` });
  const jelly = (x, y) => [
    ribbon(10, x - 8, y + 40, 37, 4, 0.5),
    ribbon(10, x + 7, y + 38, 35, 4, 2.4),
    { c: 16, d: `M${x - 18} ${y}A18 17 0 0 1 ${x + 18} ${y}Q${x + 9} ${y + 5} ${x} ${y + 2}Q${x - 9} ${y + 5} ${x - 18} ${y}Z` },
  ];

  PBN.registerArtwork({
    id: 'coral-reef',
    title: 'Coral Reef',
    difficulty: 'Hard',
    tags: ['ocean', 'animals', 'fish'],
    viewBox: [0, 0, 600, 450],
    maxZoom: 10,
    palette: [
      ['#1D4E89', 'Deep water'],
      ['#2F80B5', 'Water'],
      ['#8FD3E8', 'Sunlight'],
      ['#F3D9A4', 'Sand'],
      ['#8E8AA6', 'Stone'],
      ['#4CAF6E', 'Seaweed'],
      ['#2E7050', 'Kelp'],
      ['#FF7B8A', 'Coral'],
      ['#FF9C42', 'Orange'],
      ['#9C6ADE', 'Violet'],
      ['#FFD43B', 'Yellow'],
      ['#4C6EF5', 'Blue'],
      ['#2B2D42', 'Ink'],
      ['#CDEFF7', 'Bubble'],
      ['#E5484D', 'Starfish'],
      ['#F6B8C8', 'Shell'],
    ],
    regions: [
      // water
      { c: 1, rect: [0, 0, 600, 450] },
      { c: 2, d: 'M0 0H600V230Q450 255 300 230T0 230Z' },
      { c: 3, poly: [90, 40, 125, 40, 215, 300, 180, 300] },
      { c: 3, poly: [260, 40, 290, 40, 350, 280, 322, 280] },
      { c: 3, poly: [430, 40, 470, 40, 520, 300, 480, 300] },
      { c: 3, d: 'M0 0H600V55Q450 75 300 55T0 55Z' },

      // kelp (bases hidden behind the sand)
      ribbon(7, 30, 385, 200, 14, 0.0),
      ribbon(6, 170, 385, 160, 13, 1.3),
      ribbon(7, 270, 385, 120, 12, 2.6),
      ribbon(6, 360, 385, 170, 14, 0.8),
      ribbon(7, 490, 385, 150, 13, 2.0),
      ribbon(6, 585, 385, 210, 14, 3.1),

      // sea floor
      { c: 4, d: 'M0 360Q150 330 300 355T600 345V450H0Z' },
      { c: 5, ellipse: [470, 435, 8, 4] },
      { c: 5, ellipse: [95, 430, 7, 3.5] },
      { c: 5, d: 'M15 392C12 368 50 352 78 366C96 356 118 372 108 394Z' },
      { c: 5, d: 'M360 438C356 414 392 400 414 414C432 406 452 424 444 442Z' },
      { c: 5, d: 'M560 440C556 425 580 418 594 428C602 432 600 444 594 446Z' },

      // corals
      fan(9, 100, 372, 1),
      fan(10, 320, 376, 0.8),
      brain(8, 225, 362, 35, 26),
      brain(8, 545, 358, 38, 28),
      tube(10, 395, 375, 14, 60),
      tube(10, 412, 375, 14, 82),
      tube(10, 429, 375, 14, 50),
      tube(10, 446, 375, 14, 70),

      star(15, 180, 415, 15, 6, 10),
      star(15, 500, 420, 12, 5, -15),
      shell(16, 300, 425, 1),
      shell(16, 570, 405, 0.8),

      ...jelly(548, 78),
      ...jelly(45, 170),

      // fish: x, y, size, direction, body, stripe, has fin
      ...fish(110, 115, 1.0, 1, 11, 12, true),
      ...fish(300, 100, 0.8, -1, 12, 11, false),
      ...fish(470, 150, 1.1, -1, 9, 13, true),
      ...fish(205, 195, 0.7, 1, 9, 13, false),
      ...fish(420, 225, 0.9, 1, 11, 12, true),
      ...fish(95, 255, 0.75, -1, 12, 11, false),
      ...fish(545, 270, 0.65, -1, 11, 12, true),
      ...fish(250, 280, 0.75, 1, 12, 11, false),

      // bubbles
      { c: 14, circle: [178, 92, 5] },
      { c: 14, circle: [188, 72, 3.5] },
      { c: 14, circle: [356, 150, 4] },
      { c: 14, circle: [364, 128, 6] },
      { c: 14, circle: [372, 106, 3] },
      { c: 14, circle: [515, 205, 5] },
      { c: 14, circle: [523, 186, 3.5] },
      { c: 14, circle: [62, 215, 4] },
    ],
  });
})();
