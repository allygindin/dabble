// Converts the shorthand region shapes used in artwork files into SVG path data.
(function () {
  const f = (n) => Math.round(n * 100) / 100;

  PBN.shapeToPath = function (r) {
    if (r.d) return r.d;
    if (r.rect) {
      const [x, y, w, h] = r.rect;
      return `M${f(x)} ${f(y)}H${f(x + w)}V${f(y + h)}H${f(x)}Z`;
    }
    if (r.circle) {
      const [cx, cy, rr] = r.circle;
      return `M${f(cx - rr)} ${f(cy)}A${rr} ${rr} 0 1 0 ${f(cx + rr)} ${f(cy)}A${rr} ${rr} 0 1 0 ${f(cx - rr)} ${f(cy)}Z`;
    }
    if (r.ellipse) {
      const [cx, cy, rx, ry, rot = 0] = r.ellipse;
      const a = (rot * Math.PI) / 180;
      const dx = rx * Math.cos(a), dy = rx * Math.sin(a);
      return `M${f(cx - dx)} ${f(cy - dy)}A${rx} ${ry} ${rot} 1 0 ${f(cx + dx)} ${f(cy + dy)}A${rx} ${ry} ${rot} 1 0 ${f(cx - dx)} ${f(cy - dy)}Z`;
    }
    if (r.poly) {
      const p = r.poly;
      let d = `M${f(p[0])} ${f(p[1])}`;
      for (let i = 2; i < p.length; i += 2) d += `L${f(p[i])} ${f(p[i + 1])}`;
      return d + 'Z';
    }
    throw new Error('Region has no shape: ' + JSON.stringify(r));
  };

  // Short hash of an artwork's geometry + colors. Saved progress and cached
  // label positions are tied to it, so editing an artwork file invalidates them.
  PBN.signature = function (art) {
    let h = 5381;
    const s = art.regions.map((r) => r.c + ':' + PBN.shapeToPath(r)).join('|') + '#' + art.viewBox.join(',');
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  };
})();
