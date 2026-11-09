// "Upload picture": photo -> crop -> settings + numbered preview -> save.
// The conversion itself is in convert.js (run in a Web Worker).
(function () {
  const H = PBN.el, S = PBN.svgEl;

  // Detail level -> working size (long side, px), minimum area (px) and
  // minimum inner radius (px). Lower detail merges more small regions.
  const DETAIL = {
    1: { G: 180, minArea: 90, r: 3.0, name: 'Simple' },
    2: { G: 210, minArea: 60, r: 2.5, name: 'Low' },
    3: { G: 240, minArea: 40, r: 2.0, name: 'Medium' },
    4: { G: 270, minArea: 26, r: 1.6, name: 'High' },
    5: { G: 300, minArea: 16, r: 1.25, name: 'Detailed' },
  };
  const MAX_ZOOM = 10, MAX_REGIONS = 500;
  // Photos often have many close shades, so uploads use a relaxed "colors must
  // differ" minimum (CIE ΔE 6 instead of the built-in pictures' 12).
  const MIN_DELTA_E = 6;
  const RATIOS = [['Free', null], ['Square', 1], ['4:3', 4 / 3], ['3:4', 3 / 4]];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---- worker (falls back to the main thread if workers aren't available) ----
  let worker = null, workerBroken = false;
  function convert(job) {
    if (!worker && !workerBroken && typeof Worker === 'function') {
      try { worker = new Worker('js/convert-worker.js'); } catch (e) { workerBroken = true; }
    }
    if (!worker) return new Promise((res, rej) => setTimeout(() => { try { res(PBNConvert.run(job)); } catch (e) { rej(e); } }, 30));
    return new Promise((res, rej) => {
      const id = Math.random();
      const onMsg = (e) => {
        if (e.data.id !== id) return;
        worker.removeEventListener('message', onMsg); worker.removeEventListener('error', onErr);
        if (e.data.error) rej(new Error(e.data.error)); else res(e.data.result);
      };
      const onErr = () => { // worker failed to load: use the main thread from now on
        worker.removeEventListener('message', onMsg); worker.removeEventListener('error', onErr);
        worker = null; workerBroken = true;
        convert(job).then(res, rej);
      };
      worker.addEventListener('message', onMsg);
      worker.addEventListener('error', onErr);
      worker.postMessage({ id, job });
    });
  }

  PBN.Upload = function (container, opts) {
    const root = H('section', 'upload', container);
    const bar = H('header', 'topbar', root);
    const back = H('button', 'icon-btn', bar, PBN.icons.back);
    back.setAttribute('aria-label', 'Back');
    const titleBox = H('div', 'title', bar);
    H('span', 'title-text', titleBox).textContent = 'Upload picture';
    const stepLabel = H('span', 'sel-name', titleBox);
    const body = H('div', 'upload-body', root);
    const file = H('input', '', root);
    file.type = 'file'; file.accept = 'image/*'; file.hidden = true;

    let step = 'pick', src = null, crop = null, ratio = null, onResize = null, cleanup = null;
    const settings = { colors: 16, detail: 3 };
    const fields = { name: '', tag: 'photos' };

    PBN.onTap(back, () => { if (step === 'settings') showCrop(); else if (step === 'crop') showPick(); else opts.onBack(); });
    function clear() { if (cleanup) cleanup(); cleanup = null; onResize = null; body.innerHTML = ''; }
    const resize = () => onResize && onResize();
    window.addEventListener('resize', resize);

    // ---------- step 1: choose ----------
    function showPick() {
      step = 'pick'; clear();
      stepLabel.textContent = 'Step 1 of 3 · Choose a photo';
      const card = H('div', 'upload-pick', body);
      card.innerHTML = `<div class="pick-icon">${PBN.icons.upload}</div><h2>Turn a photo into a puzzle</h2>
        <p>Pick a photo from your library. Next you'll crop it, choose how many colors and how much detail, and preview the puzzle before saving.</p>`;
      const btn = H('button', 'btn primary', card);
      btn.textContent = 'Choose photo';
      PBN.onTap(btn, () => file.click());
    }
    file.addEventListener('change', async () => {
      const f = file.files && file.files[0];
      file.value = '';
      if (!f) return;
      try {
        src = await loadImage(f);
        crop = null; ratio = null;
        if (!fields.name) fields.name = `My picture ${PBN.userArt.count() + 1}`;
        showCrop();
      } catch (e) { PBN.toast('Couldn’t open that image'); }
    });

    // Draw the photo into a canvas (max 2048px), which also bakes in its orientation.
    async function loadImage(f) {
      const url = URL.createObjectURL(f);
      try {
        const img = new Image();
        img.src = url;
        await (img.decode ? img.decode() : new Promise((res, rej) => { img.onload = res; img.onerror = rej; }));
        const k = Math.min(1, 2048 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.naturalWidth * k));
        c.height = Math.max(1, Math.round(img.naturalHeight * k));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        return c;
      } finally { URL.revokeObjectURL(url); }
    }

    // ---------- step 2: crop ----------
    function fitCrop() {
      const IW = src.width, IH = src.height;
      let r = ratio || clamp(IW / IH, 0.5, 2); // free crop stays between 1:2 and 2:1
      let w = IW, h = IW / r;
      if (h > IH) { h = IH; w = IH * r; }
      crop = { x: (IW - w) / 2, y: (IH - h) / 2, w, h };
    }
    function dragCrop(c0, handle, dx, dy) {
      const IW = src.width, IH = src.height, minS = Math.max(48, Math.min(IW, IH) * 0.12);
      if (handle === 'move') return { ...c0, x: clamp(c0.x + dx, 0, IW - c0.w), y: clamp(c0.y + dy, 0, IH - c0.h) };
      const west = handle.includes('w'), north = handle.includes('n');
      const ax = west ? c0.x + c0.w : c0.x, ay = north ? c0.y + c0.h : c0.y; // opposite corner stays put
      const qx = clamp((west ? c0.x : c0.x + c0.w) + dx, 0, IW), qy = clamp((north ? c0.y : c0.y + c0.h) + dy, 0, IH);
      let w = Math.abs(qx - ax), h = Math.abs(qy - ay);
      const r = ratio || clamp(w / Math.max(h, 1), 0.5, 2);
      if (w / Math.max(h, 1e-6) > r) w = h * r; else h = w / r;
      const maxW = west ? ax : IW - ax, maxH = north ? ay : IH - ay;
      if (w > maxW) { w = maxW; h = w / r; }
      if (h > maxH) { h = maxH; w = h * r; }
      if (w < minS || h < minS) {
        const k = Math.max(minS / w, minS / h); w *= k; h *= k;
        if (w > maxW + 0.5 || h > maxH + 0.5) return c0;
      }
      return { x: west ? ax - w : ax, y: north ? ay - h : ay, w, h };
    }
    function showCrop() {
      step = 'crop'; clear();
      stepLabel.textContent = 'Step 2 of 3 · Crop';
      const wrap = H('div', 'crop-wrap', body);
      const stage = H('div', 'crop-stage', wrap);
      src.className = 'crop-img';
      stage.appendChild(src);
      const box = H('div', 'crop-box', stage);
      ['nw', 'ne', 'sw', 'se'].forEach((k) => H('div', 'crop-handle ' + k, box).setAttribute('data-h', k));
      const tools = H('div', 'crop-tools', wrap);
      const chips = H('div', 'chips', tools);
      RATIOS.forEach(([label, r]) => {
        const chip = H('button', 'chip' + (r === ratio ? ' on' : ''), chips);
        chip.textContent = label;
        PBN.onTap(chip, () => {
          ratio = r;
          chips.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === chip));
          fitCrop(); layout();
        });
      });
      const actions = H('div', 'crop-actions', tools);
      const another = H('button', 'btn ghost', actions); another.textContent = 'Choose another';
      const next = H('button', 'btn primary', actions); next.textContent = 'Next';
      PBN.onTap(another, () => file.click());
      PBN.onTap(next, showSettings);
      if (!crop) fitCrop();

      let view = { s: 1, ox: 0, oy: 0 };
      function layout() {
        const r = stage.getBoundingClientRect();
        const s = Math.min(r.width / src.width, r.height / src.height);
        view = { s, ox: (r.width - src.width * s) / 2, oy: (r.height - src.height * s) / 2 };
        Object.assign(src.style, { left: view.ox + 'px', top: view.oy + 'px', width: src.width * s + 'px', height: src.height * s + 'px' });
        Object.assign(box.style, { left: view.ox + crop.x * s + 'px', top: view.oy + crop.y * s + 'px', width: crop.w * s + 'px', height: crop.h * s + 'px' });
      }
      layout();
      onResize = layout;

      // Drag inside to move, drag a corner to resize (finger or Pencil).
      let drag = null;
      box.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        try { box.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        drag = { id: e.pointerId, h: e.target.getAttribute('data-h') || 'move', x: e.clientX, y: e.clientY, c: { ...crop } };
      });
      box.addEventListener('pointermove', (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        crop = dragCrop(drag.c, drag.h, (e.clientX - drag.x) / view.s, (e.clientY - drag.y) / view.s);
        layout();
      });
      const end = (e) => { if (drag && e.pointerId === drag.id) drag = null; };
      box.addEventListener('pointerup', end);
      box.addEventListener('pointercancel', end);
    }

    // ---------- step 3: settings, preview, save ----------
    function showSettings() {
      step = 'settings'; clear();
      stepLabel.textContent = 'Step 3 of 3 · Settings and preview';
      const wrap = H('div', 'settings-wrap', body);
      const pv = H('div', 'stage preview-stage', wrap);
      const busy = H('div', 'busy', pv, '<span class="spinner"></span><span>Making your puzzle…</span>');
      const panel = H('div', 'panel scrollable', wrap);

      const seg = H('div', 'segmented', panel);
      const segNum = H('button', 'on', seg); segNum.textContent = 'Numbers';
      const segCol = H('button', '', seg); segCol.textContent = 'Colors';
      const stats = H('p', 'stats', panel);

      const slider = (label, min, max, value, fmt, commit) => {
        const f = H('label', 'field', panel);
        const row = H('span', 'field-row', f);
        H('span', '', row).textContent = label;
        const val = H('b', '', row); val.textContent = fmt(value);
        const input = H('input', '', f);
        Object.assign(input, { type: 'range', min, max, step: 1, value });
        input.addEventListener('input', () => { val.textContent = fmt(+input.value); });
        input.addEventListener('change', () => commit(+input.value));
        return input;
      };
      slider('Colors', 8, 30, settings.colors, (v) => v, (v) => { settings.colors = v; generate(); });
      slider('Detail', 1, 5, settings.detail, (v) => DETAIL[v].name, (v) => { settings.detail = v; generate(); });
      H('p', 'hint', panel).textContent = 'Less detail merges small areas into their neighbors. Every area stays big enough to tap when zoomed in.';

      const nameField = H('label', 'field', panel);
      H('span', 'field-row', nameField).textContent = 'Name';
      const nameIn = H('input', 'text-in', nameField);
      Object.assign(nameIn, { type: 'text', maxLength: 40, value: fields.name, autocomplete: 'off' });
      nameIn.addEventListener('input', () => { fields.name = nameIn.value; });

      const tagField = H('label', 'field', panel);
      H('span', 'field-row', tagField).textContent = 'Category';
      const tagIn = H('input', 'text-in', tagField);
      Object.assign(tagIn, { type: 'text', maxLength: 24, value: fields.tag, autocomplete: 'off' });
      tagIn.setAttribute('autocapitalize', 'none');
      const tagChips = H('div', 'chips small', panel);
      const known = Array.from(new Set(['photos', ...PBN.artworks.flatMap((a) => a.tags || [])])).sort();
      const syncChips = () => tagChips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c.dataset.tag === normTag(tagIn.value)));
      known.forEach((t) => {
        const chip = H('button', 'chip', tagChips);
        chip.dataset.tag = t;
        chip.textContent = t.charAt(0).toUpperCase() + t.slice(1);
        PBN.onTap(chip, () => { tagIn.value = t; fields.tag = t; syncChips(); });
      });
      tagIn.addEventListener('input', () => { fields.tag = tagIn.value; syncChips(); });
      syncChips();

      const save = H('button', 'btn primary save-btn', panel);
      save.textContent = 'Save picture';
      save.disabled = true;

      let art = null, pz = null, svg = null, labelEls = [], labelSizes = [], mode = 'numbers', job = 0;
      const setMode = (m) => {
        mode = m;
        segNum.classList.toggle('on', m === 'numbers');
        segCol.classList.toggle('on', m === 'colors');
        if (svg) svg.classList.toggle('show-colors', m === 'colors');
      };
      PBN.onTap(segNum, () => setMode('numbers'));
      PBN.onTap(segCol, () => setMode('colors'));

      async function generate() {
        const my = ++job;
        save.disabled = true;
        busy.hidden = false;
        stats.textContent = 'Making your puzzle…';
        const d = DETAIL[settings.detail], a = crop.w / crop.h;
        const W = a >= 1 ? d.G : Math.round(d.G * a), Hh = a >= 1 ? Math.round(d.G / a) : d.G;
        // Tap rule: at max zoom every region must fit a 44px circle on an iPad (+ margin for smoothing).
        const kMin = Math.min(...PBN.TAP.stages.map(([w, h]) => Math.min(w / W, h / Hh)));
        const rMin = Math.max(d.r, PBN.TAP.minTapPx / 2 / (kMin * MAX_ZOOM) + 0.35);
        const c = document.createElement('canvas');
        c.width = W; c.height = Hh;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(src, crop.x, crop.y, crop.w, crop.h, 0, 0, W, Hh);
        const data = ctx.getImageData(0, 0, W, Hh).data;
        try {
          const res = await convert({ width: W, height: Hh, data, colors: settings.colors, minArea: d.minArea, rMin, maxRegions: MAX_REGIONS, minDeltaE: MIN_DELTA_E });
          if (my !== job || step !== 'settings') return; // a newer request superseded this one
          const n = res.regions.length;
          art = {
            id: 'upload-preview', user: true, title: fields.name, tags: [normTag(fields.tag) || 'photos'],
            difficulty: n < 70 ? 'Easy' : n < 160 ? 'Medium' : 'Hard',
            viewBox: [0, 0, res.width, res.height], maxZoom: MAX_ZOOM, minDeltaE: MIN_DELTA_E,
            palette: res.palette.map((p) => [p.hex, p.name]), regions: res.regions,
          };
          renderPreview();
          const merged = res.stats.requested - res.stats.colors;
          stats.innerHTML = `<b>${n} areas · ${res.stats.colors} colors</b> · ${art.difficulty}` +
            (merged > 0 ? `<br><span>${merged} color${merged > 1 ? 's were' : ' was'} nearly identical to another and got combined.</span>` : '');
          save.disabled = false;
        } catch (e) {
          if (my === job) stats.textContent = 'Something went wrong: ' + e.message;
        } finally {
          if (my === job) busy.hidden = true;
        }
      }

      function renderPreview() {
        if (pz) pz.destroy();
        if (svg) svg.remove();
        const [vx, vy, vw, vh] = art.viewBox;
        svg = S('svg', { viewBox: `${vx} ${vy} ${vw} ${vh}`, preserveAspectRatio: 'xMidYMid meet', class: 'art' });
        pv.insertBefore(svg, busy);
        const g = S('g', {}, svg), gR = S('g', {}, g), gL = S('g', {}, g);
        const paths = art.regions.map((r) => {
          const hex = art.palette[r.c - 1][0];
          const p = S('path', { d: r.d, class: 'region', 'data-fill': hex }, gR);
          p.style.setProperty('--fill', hex);
          return p;
        });
        const L = PBN.labels.get(art, PBN.signature(art), paths);
        labelSizes = L.map((l) => l.size);
        labelEls = L.map((l, i) => { const t = S('text', { x: l.x, y: l.y, dy: '0.36em', 'font-size': l.size, class: 'label' }, gL); t.textContent = art.regions[i].c; return t; });
        svg.classList.toggle('show-colors', mode === 'colors');
        const fit = () => {
          const cap = 34 / (pz.unitPx() * pz.scale);
          labelEls.forEach((t, i) => t.setAttribute('font-size', Math.min(labelSizes[i], cap)));
        };
        pz = PBN.panZoom(pv, svg, g, { viewBox: art.viewBox, maxScale: MAX_ZOOM, onChange: fit });
        fit();
      }

      PBN.onTap(save, async () => {
        if (!art || save.disabled) return;
        save.disabled = true;
        const rec = {
          ...art,
          id: 'u-' + Date.now().toString(36),
          title: (nameIn.value || '').trim() || `My picture ${PBN.userArt.count() + 1}`,
          tags: [normTag(tagIn.value) || 'photos'],
          created: Date.now(),
        };
        try {
          await PBN.userArt.add(rec);
          if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
          fields.name = ''; fields.tag = 'photos';
          PBN.toast('Saved!');
          opts.onSaved(rec);
        } catch (e) {
          save.disabled = false;
          PBN.toast('Couldn’t save: ' + (e && e.message ? e.message : 'storage error'));
        }
      });

      onResize = () => { if (pz) { pz.reset(); } };
      cleanup = () => { job++; if (pz) pz.destroy(); };
      generate();
    }

    function normTag(t) { return String(t || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 24); }

    showPick();
    return {
      destroy() { clear(); window.removeEventListener('resize', resize); root.remove(); },
    };
  };
})();
