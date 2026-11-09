// Start screen: one card per artwork with a live thumbnail of your progress.
(function () {
  const S = PBN.svgEl, H = PBN.el;

  // Small, label-free render of an artwork: filled regions in color, the rest white.
  PBN.renderThumb = function (art, filled) {
    const [vx, vy, vw, vh] = art.viewBox;
    const svg = S('svg', { viewBox: `${vx} ${vy} ${vw} ${vh}`, preserveAspectRatio: 'xMidYMid meet', class: 'thumb-art' });
    art.regions.forEach((r, i) => {
      const hex = art.palette[r.c - 1][0];
      const on = filled.has(i);
      S('path', { d: PBN.shapeToPath(r), fill: on ? hex : '#FFFFFF', stroke: on ? hex : '#C3C8D1', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }, svg);
    });
    return svg;
  };

  PBN.Gallery = function (container, onOpen) {
    const root = H('section', 'gallery scrollable', container);
    const head = H('header', 'gallery-head', root);
    H('h1', '', head).textContent = 'Dabble';
    H('p', '', head).textContent = 'Pick a picture to paint';
    const grid = H('div', 'cards', root);

    PBN.artworks.forEach((art) => {
      const sig = PBN.signature(art);
      const filled = PBN.store.loadProgress(art.id, sig);
      const total = art.regions.length;
      const done = filled.size === total;

      const card = H('button', 'card' + (done ? ' done' : ''), grid);
      card.setAttribute('aria-label', `${art.title}, ${filled.size} of ${total} painted`);
      const thumb = H('div', 'thumb', card);
      thumb.style.aspectRatio = `${art.viewBox[2]} / ${art.viewBox[3]}`;
      thumb.appendChild(PBN.renderThumb(art, filled));
      if (done) H('span', 'badge', thumb, PBN.icons.check + '<span>Done</span>');

      const body = H('div', 'card-body', card);
      H('div', 'card-title', body).textContent = art.title;
      const meta = H('div', 'card-meta', body);
      H('span', 'pill pill-' + (art.difficulty || '').toLowerCase(), meta).textContent = art.difficulty || '';
      H('span', '', meta).textContent = `${total} areas · ${art.palette.length} colors`;

      const prog = H('div', 'card-progress', body);
      H('span', 'bar', prog, `<i style="width:${(100 * filled.size) / total}%"></i>`);
      H('span', 'card-count', prog).textContent = done ? 'Finished' : filled.size ? `${Math.round((100 * filled.size) / total)}%` : 'New';

      card.onclick = () => onOpen(art);
    });

    return { destroy() { root.remove(); } };
  };
})();
