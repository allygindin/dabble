// Completion overlay: confetti canvas + the finished artwork + action buttons.
(function () {
  PBN.celebrate = function (opts) {
    const ov = PBN.el('div', 'celebrate', document.body);
    const canvas = PBN.el('canvas', 'confetti', ov);
    const card = PBN.el('div', 'celebrate-card', ov);
    const frame = PBN.el('div', 'celebrate-art', card);
    frame.appendChild(opts.artSvg);
    if (opts.ratio) {
      frame.style.aspectRatio = String(opts.ratio);
      frame.style.width = `min(100%, ${55 * opts.ratio}vh)`;
    }
    PBN.el('h2', '', card).textContent = 'Beautiful!';
    PBN.el('p', '', card).textContent = `You finished “${opts.title}”.`;
    const row = PBN.el('div', 'modal-actions', card);
    let stop = () => {};
    const close = () => { stop(); ov.classList.add('out'); setTimeout(() => ov.remove(), 300); };
    (opts.buttons || []).forEach((b) => {
      const btn = PBN.el('button', 'btn ' + (b.primary ? 'primary' : 'ghost'), row);
      btn.textContent = b.label;
      PBN.onTap(btn, () => { close(); if (b.action) b.action(); });
    });
    stop = confetti(canvas, opts.colors);
    return close;
  };

  function confetti(canvas, colors) {
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0;
    const size = () => {
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    window.addEventListener('resize', size);
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const parts = [];
    const add = (x, y, vx, vy) => parts.push({
      x, y, vx, vy, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
      w: 7 + Math.random() * 7, h: 4 + Math.random() * 6,
      c: colors[(Math.random() * colors.length) | 0], round: Math.random() < 0.3, sway: Math.random() * 6,
    });
    const burst = reduce ? 40 : 140;
    for (let i = 0; i < burst; i++) {
      const left = i % 2 === 0;
      add(left ? 0 : W, H * 0.75, (left ? 1 : -1) * (4 + Math.random() * 9), -(9 + Math.random() * 10));
    }
    let raining = reduce ? 0 : 3500;
    let last = performance.now(), raf = 0, t0 = last;
    function frame(now) {
      const dt = Math.min(2, (now - last) / 16.7); last = now;
      if (now - t0 < raining && Math.random() < 0.6) add(Math.random() * W, -10, (Math.random() - 0.5) * 2, 1 + Math.random() * 2);
      ctx.clearRect(0, 0, W, H);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.vy += 0.25 * dt; p.vx *= 0.99; p.vy = Math.min(p.vy, 6);
        p.x += (p.vx + Math.sin((now / 300) + p.sway)) * dt; p.y += p.vy * dt; p.r += p.vr * dt;
        if (p.y > H + 20) { parts.splice(i, 1); continue; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
        if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.h / 1.6, 0, 6.283); ctx.fill(); }
        else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)) + 1);
        ctx.restore();
      }
      if (parts.length || now - t0 < raining) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', size); };
  }
})();
