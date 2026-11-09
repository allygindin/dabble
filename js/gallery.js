// Start screen: one card per artwork with a live thumbnail of your progress.
(function () {
  const S = PBN.svgEl, H = PBN.el;

  // Small, label-free render of an artwork: filled regions in color, the rest white.
  let thumbCount = 0;
  PBN.renderThumb = function (art, filled) {
    const [vx, vy, vw, vh] = art.viewBox;
    const svg = S('svg', { viewBox: `${vx} ${vy} ${vw} ${vh}`, preserveAspectRatio: 'xMidYMid meet', class: 'thumb-art' });
    const clipId = 'thumbclip-' + (++thumbCount);
    S('rect', { x: vx, y: vy, width: vw, height: vh }, S('clipPath', { id: clipId }, S('defs', {}, svg)));
    const g = S('g', { 'clip-path': `url(#${clipId})` }, svg);
    art.regions.forEach((r, i) => {
      const hex = art.palette[r.c - 1][0];
      const on = filled.has(i);
      S('path', { d: PBN.shapeToPath(r), fill: on ? hex : '#FFFFFF', stroke: on ? hex : '#C3C8D1', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }, g);
    });
    return svg;
  };

  PBN.Gallery = function (container, onOpen, onMyArt) {
    const root = H('section', 'gallery scrollable', container);
    const head = H('header', 'gallery-head', root);
    const titles = H('div', 'gallery-titles', head);
    H('h1', '', titles).textContent = 'Dabble';
    H('p', '', titles).textContent = 'Pick a picture to paint';

    // "Hide completed" switch, remembered in localStorage.
    let hideDone = !!PBN.store.getSetting('hideCompleted', false);
    const controls = H('div', 'gallery-controls', head);
    const doneCount = PBN.completedArtworks().length;
    const myArtBtn = H('button', 'pill-btn', controls, `${PBN.icons.frame}<span>My Art</span><span class="count">${doneCount}</span>`);
    myArtBtn.setAttribute('aria-label', `My Art, ${doneCount} finished`);
    PBN.onTap(myArtBtn, onMyArt);
    const toggle = H('button', 'switch', controls, '<span class="switch-label">Hide completed</span><span class="switch-track"><span class="switch-thumb"></span></span>');
    toggle.setAttribute('role', 'switch');
    // Category chips: "All" plus one per tag used by any artwork. The last
    // choice is remembered; a remembered tag that no longer exists falls back to All.
    const tags = Array.from(new Set(PBN.artworks.flatMap((a) => a.tags || []))).sort();
    let category = PBN.store.getSetting('category', 'all');
    if (category !== 'all' && !tags.includes(category)) category = 'all';
    const nice = (t) => t.charAt(0).toUpperCase() + t.slice(1);
    const chipRow = H('div', 'chips', root);
    chipRow.setAttribute('role', 'group');
    chipRow.setAttribute('aria-label', 'Filter by category');
    const chips = ['all', ...tags].map((t) => {
      const chip = H('button', 'chip', chipRow);
      chip.textContent = t === 'all' ? 'All' : nice(t);
      PBN.onTap(chip, () => {
        category = t;
        PBN.store.setSetting('category', t);
        applyFilter();
      });
      return { t, chip };
    });

    const grid = H('div', 'cards', root);
    const empty = H('p', 'gallery-empty', root);
    const cards = [];

    // A card shows when it matches the category AND isn't hidden as completed.
    function applyFilter() {
      toggle.setAttribute('aria-checked', String(hideDone));
      toggle.classList.toggle('on', hideDone);
      chips.forEach(({ t, chip }) => {
        chip.classList.toggle('on', t === category);
        chip.setAttribute('aria-pressed', String(t === category));
      });
      let inCategory = 0, shown = 0;
      cards.forEach(({ art, card, done }) => {
        const matches = category === 'all' || (art.tags || []).includes(category);
        if (matches) inCategory++;
        card.hidden = !matches || (hideDone && done);
        if (!card.hidden) shown++;
      });
      empty.hidden = shown > 0;
      if (shown) return;
      const where = category === 'all' ? '' : ` in “${nice(category)}”`;
      empty.textContent = inCategory
        ? `You’ve finished every picture${where}! They’re all in My Art.`
        : `No pictures${where} yet.`;
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
      cards.push({ art, card, done });
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
