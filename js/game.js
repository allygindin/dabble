// The painting screen: artwork, palette, tap-to-fill rules, progress.
(function () {
  const S = PBN.svgEl, H = PBN.el;

  PBN.Game = function (container, art, opts) {
    opts = opts || {};
    const palette = art.palette.map((p, i) => ({ n: i + 1, hex: p[0], name: p[1] || '' }));
    const regions = art.regions;
    const total = regions.length;
    const sig = PBN.signature(art);
    const [vx, vy, vw, vh] = art.viewBox;
    const filled = PBN.store.loadProgress(art.id, sig);
    let selected = null;
    let wrongStreak = 0;
    let closeCelebration = null;

    // ---------- layout ----------
    const root = H('section', 'game', container);
    const bar = H('header', 'topbar', root);
    if (opts.onExit) {
      const back = H('button', 'icon-btn', bar, PBN.icons.back);
      back.setAttribute('aria-label', 'Back to pictures');
      PBN.onTap(back, () => opts.onExit());
    }
    H('div', 'title', bar).textContent = art.title;
    const prog = H('div', 'progress', bar);
    const progText = H('span', '', prog);
    const progBar = H('span', 'bar', prog, '<i></i>').firstChild;
    const hintBtn = H('button', 'icon-btn', bar, PBN.icons.hint);
    hintBtn.setAttribute('aria-label', 'Hint: show me a spot to paint');
    const fitBtn = H('button', 'icon-btn', bar, PBN.icons.fit);
    fitBtn.setAttribute('aria-label', 'Reset zoom');
    const soundBtn = H('button', 'icon-btn', bar);
    soundBtn.setAttribute('aria-label', 'Sound');
    const restartBtn = H('button', 'icon-btn', bar, PBN.icons.restart);
    restartBtn.setAttribute('aria-label', 'Start over');

    const stage = H('div', 'stage', root);
    const svg = S('svg', { viewBox: `${vx} ${vy} ${vw} ${vh}`, preserveAspectRatio: 'xMidYMid meet', class: 'art' }, stage);
    const defs = S('defs', {}, svg);
    const vp = S('g', {}, svg);
    const gRegions = S('g', { class: 'regions' }, vp);
    const gLabels = S('g', { class: 'labels' }, vp);
    const gFx = S('g', { class: 'fx' }, vp);

    // Striped "find me" pattern per color, used to highlight remaining regions.
    const stripe = Math.max(vw, vh) / 70;
    palette.forEach((p) => {
      const pat = S('pattern', { id: `hl-${art.id}-${p.n}`, patternUnits: 'userSpaceOnUse', width: stripe, height: stripe, patternTransform: 'rotate(45)' }, defs);
      S('rect', { width: stripe, height: stripe, fill: PBN.tint(p.hex, 0.22) }, pat);
      S('rect', { width: stripe * 0.45, height: stripe, fill: PBN.tint(p.hex, 0.5) }, pat);
    });

    const paths = regions.map((r, i) => S('path', { d: PBN.shapeToPath(r), class: 'region', 'data-color': r.c, 'data-i': i }, gRegions));
    const labelPos = PBN.labels.get(art, sig, paths);
    const labels = labelPos.map((L, i) => {
      const t = S('text', { x: L.x, y: L.y, dy: '0.36em', 'font-size': L.size, class: 'label' }, gLabels);
      t.textContent = regions[i].c;
      return t;
    });

    const pal = H('nav', 'palette', root);
    const swatches = {};
    const remaining = {};
    palette.forEach((p) => {
      remaining[p.n] = 0;
      const b = H('button', 'swatch', pal, `<span class="dot"><span class="num">${p.n}</span>${PBN.icons.check}</span><span class="left"></span>`);
      b.style.setProperty('--c', p.hex);
      if (PBN.luminance(p.hex) > 0.42) b.classList.add('light');
      b.setAttribute('aria-label', `Color ${p.n}${p.name ? ' – ' + p.name : ''}`);
      PBN.onTap(b, () => select(p.n));
      swatches[p.n] = b;
    });
    regions.forEach((r, i) => { if (!filled.has(i)) remaining[r.c]++; });

    // Spread swatches over evenly-filled rows instead of leaving a lone straggler.
    function layoutPalette() {
      const sw = swatches[1].offsetWidth || 66;
      const gap = 12;
      const fit = Math.max(1, Math.floor((pal.clientWidth - 32 + gap) / (sw + gap)));
      const rows = Math.ceil(palette.length / fit);
      pal.style.setProperty('--cols', Math.ceil(palette.length / rows));
    }
    layoutPalette();
    window.addEventListener('resize', layoutPalette);

    // ---------- state rendering ----------
    function paintFilled(i) {
      const hex = palette[regions[i].c - 1].hex;
      const p = paths[i];
      p.classList.add('filled');
      p.style.fill = hex;
      p.style.stroke = hex;
      labels[i].classList.add('gone');
      labels[i].classList.remove('hl');
    }
    filled.forEach(paintFilled);

    function updateSwatch(n) {
      const b = swatches[n];
      b.querySelector('.left').textContent = remaining[n];
      b.classList.toggle('done', remaining[n] === 0);
      b.classList.toggle('sel', n === selected);
    }
    function updateProgress() {
      progText.textContent = `${filled.size} / ${total}`;
      progBar.style.width = (100 * filled.size / total) + '%';
    }
    function setHighlight(n, on) {
      const url = `url(#hl-${art.id}-${n})`;
      regions.forEach((r, i) => {
        if (r.c !== n || filled.has(i)) return;
        paths[i].style.fill = on ? url : '';
        labels[i].classList.toggle('hl', on);
      });
    }
    function select(n) {
      if (n != null && remaining[n] === 0) return;
      if (selected === n) return;
      const prev = selected;
      if (prev != null) setHighlight(prev, false);
      selected = n;
      if (n != null) setHighlight(n, true);
      if (prev != null) updateSwatch(prev);
      if (n != null) updateSwatch(n);
    }
    function nextIncomplete(from) {
      for (let k = 1; k <= palette.length; k++) {
        const n = ((from - 1 + k) % palette.length) + 1;
        if (remaining[n] > 0) return n;
      }
      return null;
    }
    function save() { PBN.store.saveProgress(art.id, sig, filled, total); }
    function renderSound() {
      soundBtn.innerHTML = PBN.sound.enabled ? PBN.icons.soundOn : PBN.icons.soundOff;
      soundBtn.classList.toggle('off', !PBN.sound.enabled);
    }

    palette.forEach((p) => updateSwatch(p.n));
    updateProgress();
    renderSound();
    if (filled.size < total) select(nextIncomplete(palette.length));

    // ---------- feedback ----------
    function ripple(cx, cy, color) {
      const c = pz.toContent(cx, cy);
      const r = pz.pxToContent(36);
      const circ = S('circle', { cx: c.x, cy: c.y, r: r, fill: 'none', stroke: color, 'stroke-width': r * 0.25, class: 'ripple' }, gFx);
      setTimeout(() => circ.remove(), 600);
    }
    function wrong(i) {
      const p = paths[i];
      p.classList.remove('wrong');
      void p.getBoundingClientRect(); // restart the CSS animation
      p.classList.add('wrong');
      setTimeout(() => p.classList.remove('wrong'), 550);
      const t = labels[i];
      const a = (+t.getAttribute('font-size')) * 0.25;
      if (t.animate) {
        t.animate([
          { transform: 'translateX(0)' }, { transform: `translateX(${-a}px)` }, { transform: `translateX(${a}px)` },
          { transform: `translateX(${-a * 0.6}px)` }, { transform: 'translateX(0)' },
        ], { duration: 380, easing: 'ease-out' });
      }
      PBN.sound.play('wrong');
      wrongStreak++;
      if (wrongStreak >= 3) { PBN.toast(`That spot needs color ${regions[i].c}`); wrongStreak = 0; }
    }

    // ---------- tap handling ----------
    function onTap(cx, cy) {
      const hit = document.elementFromPoint(cx, cy);
      const p = hit && hit.closest ? hit.closest('.region') : null;
      if (!p || !gRegions.contains(p)) return;
      const i = +p.getAttribute('data-i');
      if (filled.has(i)) return;
      if (selected == null) { PBN.toast('Pick a color below first'); return; }
      const c = regions[i].c;
      if (c !== selected) { wrong(i); return; }

      wrongStreak = 0;
      filled.add(i);
      remaining[c]--;
      paintFilled(i);
      ripple(cx, cy, palette[c - 1].hex);
      updateSwatch(c);
      updateProgress();
      save();

      if (filled.size === total) {
        select(null);
        PBN.sound.play('win');
        setTimeout(celebrate, 650);
      } else if (remaining[c] === 0) {
        PBN.sound.play('color');
        const next = nextIncomplete(c);
        setTimeout(() => { if (selected === c) select(next); }, 350);
      } else {
        PBN.sound.play('pop');
      }
    }

    function celebrate() {
      const out = S('svg', { viewBox: `${vx} ${vy} ${vw} ${vh}`, preserveAspectRatio: 'xMidYMid meet' });
      out.appendChild(gRegions.cloneNode(true));
      const buttons = [{ label: 'Admire it', primary: !opts.onExit }];
      if (opts.onExit) buttons.push({ label: 'More pictures', primary: true, action: opts.onExit });
      closeCelebration = PBN.celebrate({
        title: art.title, artSvg: out, ratio: vw / vh, colors: palette.map((p) => p.hex), buttons,
      });
    }

    // Numbers fit their region at any zoom, but stop growing past a comfortable
    // on-screen size, so zooming in shrinks them relative to the artwork.
    const MAX_LABEL_PX = 34;
    let lastCap = -1;
    function fitLabels() {
      const cap = MAX_LABEL_PX / (pz.unitPx() * pz.scale); // in artwork units
      if (Math.abs(cap - lastCap) < 1e-3) return;
      lastCap = cap;
      labels.forEach((t, i) => t.setAttribute('font-size', Math.round(Math.min(labelPos[i].size, cap) * 100) / 100));
    }

    const pz = PBN.panZoom(stage, svg, vp, { viewBox: art.viewBox, maxScale: art.maxZoom || 8, onTap, onChange: fitLabels });
    fitLabels();
    const onResize = () => { lastCap = -1; fitLabels(); };
    window.addEventListener('resize', onResize);

    PBN.onTap(fitBtn, () => pz.reset());

    // ---------- hint ----------
    // Zooms to one unpainted region of the selected color and pulses it.
    // Repeated taps step through the remaining regions instead of repeating one.
    const hintCursor = {};
    const HINT_LABEL_PX = 30; // target on-screen size of the hinted region's number
    function hint() {
      if (filled.size === total) { PBN.toast('Every area is painted!'); return; }
      if (selected == null) select(nextIncomplete(palette.length));
      else if (remaining[selected] === 0) { PBN.toast(`Color ${selected} is all done. Pick another color`); return; }
      const c = selected;
      const todo = [];
      regions.forEach((r, i) => { if (r.c === c && !filled.has(i)) todo.push(i); });
      const i = todo[(hintCursor[c] = ((hintCursor[c] ?? -1) + 1) % todo.length)];
      const L = labelPos[i];
      const scale = Math.max(1, HINT_LABEL_PX / (L.size * pz.unitPx()));
      pz.animateTo(L.x, L.y, scale, 550, () => pulse(i));
    }
    function pulse(i) {
      const p = paths[i];
      p.classList.remove('pulse');
      void p.getBoundingClientRect(); // restart the animation if hinted twice
      p.classList.add('pulse');
      setTimeout(() => p.classList.remove('pulse'), 1900);
    }
    PBN.onTap(hintBtn, hint);
    PBN.onTap(soundBtn, () => { PBN.sound.enabled = !PBN.sound.enabled; renderSound(); if (PBN.sound.enabled) PBN.sound.play('pop'); });
    PBN.onTap(restartBtn, async () => {
      if (!filled.size) return;
      const ok = await PBN.confirm('Start over?', `This clears all your painting on “${art.title}”.`, 'Start over');
      if (!ok) return;
      if (selected != null) setHighlight(selected, false);
      selected = null;
      filled.forEach((i) => {
        paths[i].classList.remove('filled');
        paths[i].style.fill = ''; paths[i].style.stroke = '';
        labels[i].classList.remove('gone');
        remaining[regions[i].c]++;
      });
      filled.clear();
      PBN.store.clearProgress(art.id);
      palette.forEach((p) => updateSwatch(p.n));
      updateProgress();
      pz.reset();
      select(1);
    });

    return {
      destroy() {
        if (closeCelebration) closeCelebration();
        window.removeEventListener('resize', layoutPalette);
        window.removeEventListener('resize', onResize);
        pz.destroy();
        root.remove();
      },
    };
  };
})();
