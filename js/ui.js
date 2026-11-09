// Small shared UI helpers: DOM builders, icons, toast, confirm dialog, color math.
(function () {
  const NS = 'http://www.w3.org/2000/svg';

  PBN.svgEl = function (tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };

  PBN.el = function (tag, cls, parent, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  };

  const stroke = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  PBN.icons = {
    back: stroke('<path d="M15 5l-7 7 7 7"/>'),
    fit: stroke('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
    soundOn: stroke('<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
    soundOff: stroke('<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9.5l5 5M22 9.5l-5 5"/>'),
    restart: stroke('<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4h4"/>'),
    check: stroke('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
    frame: stroke('<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 16l5-5 4 4 3-3 5 5"/><circle cx="15.5" cy="9" r="1.5"/>'),
    hint: stroke('<path d="M9.5 18h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>'),
  };

  function rgb(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  // t = 1 -> the color, t = 0 -> white
  PBN.tint = function (hex, t) {
    const m = (c) => Math.round(c * t + 255 * (1 - t));
    const [r, g, b] = rgb(hex);
    return `rgb(${m(r)},${m(g)},${m(b)})`;
  };
  PBN.luminance = function (hex) {
    const [r, g, b] = rgb(hex).map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  // Tap handler that works for finger, Apple Pencil and mouse. iPad Safari often
  // never turns a Pencil tap into a "click", so buttons act on pointerup
  // directly. The click that may follow is swallowed so it can't land on
  // whatever screen replaced the button (a "ghost click"). Keyboard
  // activation still arrives as a plain click and works.
  let lastTapAt = 0;
  document.addEventListener('click', (e) => {
    if (Date.now() - lastTapAt < 700) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  PBN.onTap = function (el, fn) {
    let start = null;
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      start = { id: e.pointerId, x: e.clientX, y: e.clientY };
    });
    el.addEventListener('pointercancel', () => { start = null; }); // e.g. the gallery started scrolling
    el.addEventListener('pointerup', (e) => {
      if (!start || e.pointerId !== start.id) return;
      const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
      start = null;
      const r = el.getBoundingClientRect();
      const inside = e.clientX >= r.left - 8 && e.clientX <= r.right + 8 && e.clientY >= r.top - 8 && e.clientY <= r.bottom + 8;
      if (moved > 24 || !inside) return;
      lastTapAt = Date.now();
      fn(e);
    });
    el.addEventListener('click', (e) => fn(e)); // keyboard / accessibility path
  };

  let toastEl = null, toastTimer = 0;
  PBN.toast = function (msg) {
    if (!toastEl) toastEl = PBN.el('div', 'toast', document.body);
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1800);
  };

  // In-page confirm (native dialogs are clunky in home-screen mode).
  PBN.confirm = function (title, message, okLabel) {
    return new Promise((resolve) => {
      const ov = PBN.el('div', 'modal', document.body);
      const card = PBN.el('div', 'modal-card', ov);
      PBN.el('h2', '', card).textContent = title;
      PBN.el('p', '', card).textContent = message;
      const row = PBN.el('div', 'modal-actions', card);
      const no = PBN.el('button', 'btn ghost', row); no.textContent = 'Cancel';
      const yes = PBN.el('button', 'btn danger', row); yes.textContent = okLabel || 'OK';
      const done = (v) => { ov.remove(); resolve(v); };
      PBN.onTap(no, () => done(false));
      PBN.onTap(yes, () => done(true));
      PBN.onTap(ov, (e) => { if (e.target === ov) done(false); });
    });
  };
})();
