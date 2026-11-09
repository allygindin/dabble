// "My Art": every finished picture in full color, plus a full-size viewer.
// Completed pictures always show here, whatever the gallery's
// "Hide completed" switch says.
(function () {
  const H = PBN.el;

  PBN.progressOf = function (art) {
    const filled = PBN.store.loadProgress(art.id, PBN.signature(art));
    return { filled, total: art.regions.length, done: filled.size === art.regions.length };
  };
  PBN.completedArtworks = function () {
    return PBN.artworks.filter((a) => PBN.progressOf(a).done);
  };
  const allRegions = (art) => new Set(art.regions.map((_, i) => i));

  // Grid of finished pictures.
  PBN.MyArt = function (container, opts) {
    const done = PBN.completedArtworks();
    const root = H('section', 'gallery myart scrollable', container);
    const head = H('header', 'gallery-head', root);
    const left = H('div', 'gallery-titles with-back', head);
    const back = H('button', 'icon-btn', left, PBN.icons.back);
    back.setAttribute('aria-label', 'Back to pictures');
    PBN.onTap(back, opts.onBack);
    const titles = H('div', '', left);
    H('h1', '', titles).textContent = 'My Art';
    H('p', '', titles).textContent = done.length === 1 ? '1 finished picture' : `${done.length} finished pictures`;

    if (!done.length) {
      const empty = H('div', 'gallery-empty', root);
      H('p', '', empty).textContent = 'Nothing here yet. Finish a picture and it will hang here in full color.';
      const go = H('button', 'btn primary', empty);
      go.textContent = 'Pick a picture';
      PBN.onTap(go, opts.onBack);
    } else {
      const grid = H('div', 'cards', root);
      done.forEach((art) => {
        const card = H('button', 'card art-card', grid);
        card.setAttribute('aria-label', `View ${art.title}`);
        H('div', 'thumb', card).appendChild(PBN.renderThumb(art, allRegions(art)));
        const body = H('div', 'card-body', card);
        H('div', 'card-title', body).textContent = art.title;
        const meta = H('div', 'card-meta', body);
        H('span', 'pill pill-' + (art.difficulty || '').toLowerCase(), meta).textContent = art.difficulty || '';
        H('span', '', meta).textContent = `${art.regions.length} areas`;
        PBN.onTap(card, () => opts.onView(art));
      });
    }
    return { destroy() { root.remove(); } };
  };

  // One finished picture, as large as the screen allows (pinch to look closer).
  PBN.ArtViewer = function (container, art, opts) {
    const root = H('section', 'game viewer', container);
    const bar = H('header', 'topbar', root);
    const back = H('button', 'icon-btn', bar, PBN.icons.back);
    back.setAttribute('aria-label', 'Back to My Art');
    PBN.onTap(back, opts.onBack);
    H('div', 'title', bar).textContent = art.title;
    const restart = H('button', 'btn ghost with-icon', bar, PBN.icons.restart + '<span>Restart</span>');
    restart.setAttribute('aria-label', 'Restart this picture');
    PBN.onTap(restart, async () => {
      const ok = await PBN.confirm('Restart this picture?', `“${art.title}” will be cleared so you can paint it again. It leaves My Art until you finish it.`, 'Restart');
      if (!ok) return;
      PBN.store.clearProgress(art.id);
      opts.onRestart(art);
    });

    const stage = H('div', 'stage', root);
    const svg = PBN.renderThumb(art, allRegions(art));
    svg.setAttribute('class', 'art');
    // Put the regions in an inner group so pinch-zoom can transform them.
    const g = PBN.svgEl('g', {});
    while (svg.firstChild) g.appendChild(svg.firstChild);
    svg.appendChild(g);
    stage.appendChild(svg);
    const pz = PBN.panZoom(stage, svg, g, { viewBox: art.viewBox, maxScale: art.maxZoom || 8 });

    return { destroy() { pz.destroy(); root.remove(); } };
  };
})();
