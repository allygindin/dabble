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
    const titles = H('div', 'gallery-titles', head);
    H('h1', '', titles).textContent = 'Dabble';
    H('p', '', titles).textContent = 'Pick a picture to paint';

    // "Hide completed" switch, remembered in localStorage.
    let hideDone = !!PBN.store.getSetting('hideCompleted', false);
    const toggle = H('button', 'switch', head, '<span class="switch-label">Hide completed</span><span class="switch-track"><span class="switch-thumb"></span></span>');
    toggle.setAttribute('role', 'switch');
    const grid = H('div', 'cards', root);
    const empty = H('p', 'gallery-empty', root);
    empty.textContent = 'You\u2019ve finished every picture! Turn off \u201cHide completed\u201d to see them.';

    function applyFilter() {
      toggle.setAttribute('aria-checked', String(hideDone));
      toggle.classList.toggle('on', hideDone);
      let shown = 0;
      grid.querySelectorAll('.card').forEach((card) => {
        const hide = hideDone && card.classList.contains('done');
        card.hidden = hide;
        if (!hide) shown++;
      });
      empty.hidden = shown > 0;
    }
    PBN.onTap(toggle, () => {
      hideDone = !hideDone;
      PBN.store.setSetting('hideCompleted', hideDone);
      applyFilter();
    });

    PBN.artworks.forEach((art) => {
      const sig = PBN.signature(art);
      const filled = PBN.store.loadProgress(art.id, sig);
      const total = art.regions.length;
      const done = filled.size === total;

      const card = H('button', 'card' + (done ? ' done' : ''), grid);
      card.setAttribute('aria-label', `${art.title}, ${filled.size} of ${total} painted`);
      const thumb = H('div', 'thumb', card);
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

      PBN.onTap(card, () => onOpen(art));
    });
    applyFilter();

    return { destroy() { root.remove(); } };
  };
})();
