// Artwork: Sunny Flower (easy, 15 regions)
//
// Format (see README.md):
//   palette: [[hex, name], ...]        -> color numbers are 1, 2, 3 ... in order
//   regions: [{ c: colorNumber, <shape> }, ...] drawn in order; later regions
//            sit on top of earlier ones, so you can layer simple shapes.
//   shapes:  d: "svg path" | rect: [x,y,w,h] | circle: [cx,cy,r]
//            | ellipse: [cx,cy,rx,ry,rotationDeg] | poly: [x1,y1,x2,y2,...]
//   optional per region: label: [x, y, fontSize] to place its number manually.
(function () {
  const petals = [];
  for (let k = 0; k < 6; k++) {
    const a = k * 60, rad = (a * Math.PI) / 180;
    petals.push({ c: k % 2 ? 8 : 7, ellipse: [200 + 46 * Math.sin(rad), 150 - 46 * Math.cos(rad), 24, 42, a] });
  }

  PBN.registerArtwork({
    id: 'flower',
    title: 'Sunny Flower',
    difficulty: 'Easy',
    tags: ['flowers', 'nature', 'garden'],
    viewBox: [0, 0, 400, 400],
    palette: [
      ['#9ED4F2', 'Sky'],
      ['#FFC94A', 'Sun'],
      ['#DCD3F2', 'Cloud'],
      ['#A9DA8B', 'Hills'],
      ['#6BBF59', 'Grass'],
      ['#3F9152', 'Leaf'],
      ['#F27BA8', 'Petal'],
      ['#F9B9D2', 'Blush'],
      ['#F08A3C', 'Center'],
    ],
    regions: [
      { c: 1, rect: [0, 0, 400, 400] },
      { c: 2, circle: [328, 72, 40] },
      { c: 3, d: 'M58 142C40 142 38 116 60 114C62 92 92 86 104 102C114 82 150 84 154 108C174 106 182 140 160 142Z' },
      { c: 4, d: 'M0 252Q100 196 210 238T400 222V400H0Z' },
      { c: 5, d: 'M0 326Q120 284 236 318T400 304V400H0Z' },
      { c: 6, d: 'M193 386C189 312 201 252 195 196L207 196C213 252 203 312 207 386Z' },
      { c: 6, d: 'M197 300C172 268 136 272 118 290C138 314 174 318 197 300Z' },
      { c: 6, d: 'M203 268C228 236 266 240 284 256C264 282 226 286 203 268Z' },
      ...petals,
      { c: 9, circle: [200, 150, 27] },
    ],
  });
})();
