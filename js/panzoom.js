// Pinch-zoom + pan for the artwork, applied as an SVG transform on an inner
// <g> so everything stays vector-sharp. A short, still touch is a tap.
// One-finger drag pans when zoomed in; two fingers pinch and pan together.
(function () {
  PBN.panZoom = function (stage, svg, g, opts) {
    const [vx, vy, vw, vh] = opts.viewBox;
    const maxS = opts.maxScale || 8;
    let s = 1, tx = 0, ty = 0;
    let raf = 0;
    const pointers = new Map();
    let mode = null; // 'tap' | 'pan' | 'pinch'
    let start = null;
    let pinch = null;

    // Screen px <-> root SVG user units (preserveAspectRatio xMidYMid meet).
    function mapping() {
      const r = svg.getBoundingClientRect();
      const k = Math.min(r.width / vw, r.height / vh) || 1;
      return { k, ox: r.left + (r.width - vw * k) / 2 - vx * k, oy: r.top + (r.height - vh * k) / 2 - vy * k, r };
    }
    function toUser(cx, cy, m) {
      m = m || mapping();
      return { x: (cx - m.ox) / m.k, y: (cy - m.oy) / m.k };
    }
    const clampS = (v) => Math.min(maxS, Math.max(1, v));

    function clamp() {
      if (s <= 1.001) { s = 1; tx = 0; ty = 0; return; }
      const m = mapping();
      const a = toUser(m.r.left, m.r.top, m), b = toUser(m.r.right, m.r.bottom, m);
      const cl = (t, p, q) => Math.min(Math.max(p, q), Math.max(Math.min(p, q), t));
      tx = cl(tx, b.x - (vx + vw) * s, a.x - vx * s);
      ty = cl(ty, b.y - (vy + vh) * s, a.y - vy * s);
    }

    function apply() {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        g.setAttribute('transform', `translate(${tx} ${ty}) scale(${s})`);
        if (opts.onChange) opts.onChange(s);
      });
    }

    // Smooth camera move: bring artwork point (cx, cy) to the middle of the
    // stage at zoom `target`. Interpolates the viewed point and the zoom
    // (in log space) so the motion doesn't wobble. Any touch cancels it.
    let anim = 0;
    function stopAnim() { if (anim) { cancelAnimationFrame(anim); anim = 0; } }
    function animateTo(cx, cy, target, ms, done) {
      stopAnim();
      const m = mapping();
      const mid = toUser(m.r.left + m.r.width / 2, m.r.top + m.r.height / 2, m);
      const s0 = s, c0x = (mid.x - tx) / s, c0y = (mid.y - ty) / s;
      const s1 = clampS(target);
      const t0 = performance.now();
      const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
      const step = (now) => {
        const k = Math.min(1, (now - t0) / ms), e = ease(k);
        s = Math.exp(Math.log(s0) + (Math.log(s1) - Math.log(s0)) * e);
        const vx2 = c0x + (cx - c0x) * e, vy2 = c0y + (cy - c0y) * e;
        tx = mid.x - vx2 * s; ty = mid.y - vy2 * s;
        clamp(); apply();
        if (k < 1) anim = requestAnimationFrame(step);
        else { anim = 0; if (done) done(); }
      };
      anim = requestAnimationFrame(step);
    }

    function zoomAt(cx, cy, factor) {
      const u = toUser(cx, cy);
      const ns = clampS(s * factor);
      const ax = (u.x - tx) / s, ay = (u.y - ty) / s;
      s = ns; tx = u.x - ax * s; ty = u.y - ay * s;
      clamp(); apply();
    }

    function beginPinch() {
      const [a, b] = Array.from(pointers.values());
      const m = mapping();
      const u = toUser((a.x + b.x) / 2, (a.y + b.y) / 2, m);
      pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, s0: s, ax: (u.x - tx) / s, ay: (u.y - ty) / s, m };
    }

    function restartSingle() {
      const [id, p] = pointers.entries().next().value;
      start = { id, x: p.x, y: p.y, t: 0, tx, ty };
      mode = 'pan';
    }

    function down(e) {
      stopAnim();
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        mode = 'tap';
        start = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), tx, ty };
      } else if (pointers.size === 2) {
        mode = 'pinch';
        beginPinch();
      }
    }

    function move(e) {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX; p.y = e.clientY;
      if (mode === 'pinch' && pointers.size >= 2) {
        const [a, b] = Array.from(pointers.values());
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const u = toUser((a.x + b.x) / 2, (a.y + b.y) / 2, pinch.m);
        s = clampS(pinch.s0 * d / pinch.d0);
        tx = u.x - pinch.ax * s; ty = u.y - pinch.ay * s;
        clamp(); apply();
      } else if ((mode === 'tap' || mode === 'pan') && e.pointerId === start.id) {
        const dx = p.x - start.x, dy = p.y - start.y;
        if (mode === 'tap' && Math.hypot(dx, dy) > 10) mode = 'pan';
        if (mode === 'pan' && s > 1) {
          const k = mapping().k;
          tx = start.tx + dx / k; ty = start.ty + dy / k;
          clamp(); apply();
        }
      }
    }

    function up(e, cancelled) {
      if (!pointers.has(e.pointerId)) return;
      const isTap = !cancelled && mode === 'tap' && pointers.size === 1 && performance.now() - start.t < 700;
      pointers.delete(e.pointerId);
      if (isTap && opts.onTap) opts.onTap(e.clientX, e.clientY);
      if (pointers.size === 0) { mode = null; clamp(); apply(); }
      else if (pointers.size === 1) restartSingle();
      else if (pointers.size >= 2) beginPinch();
    }

    function wheel(e) {
      e.preventDefault();
      stopAnim();
      if (e.ctrlKey) zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.01));
      else if (s > 1) {
        const k = mapping().k;
        tx -= e.deltaX / k; ty -= e.deltaY / k;
        clamp(); apply();
      }
    }

    const onUp = (e) => up(e, false);
    const onCancel = (e) => up(e, true);
    const onResize = () => { clamp(); apply(); };
    stage.addEventListener('pointerdown', down);
    stage.addEventListener('pointermove', move);
    stage.addEventListener('pointerup', onUp);
    stage.addEventListener('pointercancel', onCancel);
    stage.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('resize', onResize);

    return {
      get scale() { return s; },
      animateTo,
      // Screen pixels per artwork unit at zoom 1.
      unitPx() { return mapping().k; },
      reset() { stopAnim(); s = 1; tx = 0; ty = 0; apply(); },
      zoomBy(f) { const r = stage.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, f); },
      // Client point -> artwork coordinates (inside the transformed group).
      toContent(cx, cy) { const u = toUser(cx, cy); return { x: (u.x - tx) / s, y: (u.y - ty) / s }; },
      // Screen pixels -> artwork units at the current zoom.
      pxToContent(px) { return px / mapping().k / s; },
      destroy() {
        stopAnim();
        stage.removeEventListener('pointerdown', down);
        stage.removeEventListener('pointermove', move);
        stage.removeEventListener('pointerup', onUp);
        stage.removeEventListener('pointercancel', onCancel);
        stage.removeEventListener('wheel', wheel);
        window.removeEventListener('resize', onResize);
        cancelAnimationFrame(raf);
      },
    };
  };
})();
