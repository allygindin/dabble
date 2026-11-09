// Artwork: Mountain Lake (medium, 41 regions). Format: see artworks/flower.js and README.md.
(function () {
  // Cloud outline, origin at its bottom-left, scaled by s.
  const cloud = (x, y, s) => {
    const p = [[0, 0], [-18, 0, -20, -26, 2, -28], [4, -50, 34, -56, 46, -40], [56, -60, 92, -58, 96, -34], [116, -36, 124, -2, 102, 0]];
    const f = (v, i) => (i % 2 ? y + v * s : x + v * s).toFixed(1);
    return 'M' + p[0].map(f).join(' ') + p.slice(1).map((c) => 'C' + c.map(f).join(' ')).join('') + 'Z';
  };
  // Pine: triangle canopy + trunk below it.
  const pine = (x, base, h) => [
    { c: 11, rect: [x - 4, base - 2, 8, 14] },
    { c: 9, poly: [x, base - h, x + h * 0.35, base, x - h * 0.35, base] },
  ];

  PBN.registerArtwork({
    id: 'mountain-lake',
    title: 'Mountain Lake',
    difficulty: 'Medium',
    viewBox: [0, 0, 600, 400],
    palette: [
      ['#7EC8E3', 'Sky'],
      ['#F7D9C4', 'Haze'],
      ['#FFD166', 'Sun'],
      ['#E4DDF4', 'Cloud'],
      ['#9AA7D6', 'Far peaks'],
      ['#DDE7F7', 'Snow'],
      ['#6474AE', 'Mountains'],
      ['#A3D77F', 'Hills'],
      ['#3F8D5C', 'Pines'],
      ['#4FA6D6', 'Lake'],
      ['#8A5A3B', 'Wood'],
      ['#E05D5D', 'Red'],
      ['#CFE79A', 'Meadow'],
      ['#F6E2B8', 'Walls'],
      ['#C99A62', 'Path'],
    ],
    regions: [
      { c: 1, rect: [0, 0, 600, 400] },
      { c: 2, d: 'M0 140Q300 120 600 140V400H0Z' },
      { c: 3, circle: [480, 78, 32] },
      { c: 4, d: cloud(60, 82, 0.8) },
      { c: 4, d: cloud(240, 62, 1.0) },
      { c: 4, d: cloud(350, 116, 0.6) },

      { c: 5, poly: [0, 220, 70, 150, 130, 195, 200, 120, 270, 190, 330, 140, 400, 200, 470, 130, 540, 185, 600, 150, 600, 280, 0, 280] },
      { c: 6, poly: [70, 150, 88, 163, 80, 160, 70, 168, 61, 163, 49, 171] },
      { c: 6, poly: [200, 120, 221, 141, 210, 136, 200, 145, 190, 137, 179, 142] },
      { c: 6, poly: [470, 130, 491, 146, 480, 142, 470, 151, 460, 144, 449, 151] },
      { c: 7, poly: [0, 260, 90, 200, 160, 245, 260, 175, 360, 250, 430, 215, 520, 260, 600, 230, 600, 320, 0, 320] },
      { c: 6, poly: [260, 175, 285, 194, 272, 189, 262, 198, 250, 190, 235, 193] },

      { c: 8, d: 'M0 290Q150 240 300 280T600 270V400H0Z' },
      { c: 10, ellipse: [430, 316, 140, 24] },
      { c: 2, ellipse: [400, 309, 40, 3] },
      { c: 2, ellipse: [470, 322, 50, 3.5] },

      ...pine(40, 300, 70),
      ...pine(88, 308, 86),
      ...pine(128, 298, 62),
      ...pine(160, 306, 76),
      ...pine(548, 292, 44),
      ...pine(580, 300, 58),

      { c: 13, d: 'M0 330Q200 300 360 345T600 340V400H0Z' },

      { c: 12, rect: [256, 304, 10, 22] },
      { c: 14, rect: [205, 338, 70, 42] },
      { c: 12, poly: [195, 340, 240, 306, 285, 340] },
      { c: 11, rect: [232, 356, 16, 24] },
      { c: 3, rect: [212, 350, 13, 12] },
      { c: 3, rect: [256, 350, 13, 12] },
      { c: 15, d: 'M232 380L248 380C252 390 270 395 285 400L250 400C238 394 230 388 232 380Z' },

      { c: 12, circle: [80, 365, 5] },
      { c: 12, circle: [120, 382, 5] },
      { c: 12, circle: [345, 375, 5] },
      { c: 12, circle: [500, 368, 5] },
      { c: 12, circle: [560, 385, 5] },
    ],
  });
})();
