// Tiny synthesized sounds (no audio files). iOS only allows audio after a
// user gesture, so the context is created/resumed on the first touch.
(function () {
  let ctx = null;
  let enabled = PBN.store.getSetting('sound', true);

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, opt) {
    const o2 = opt || {};
    const c = ensure();
    if (!c) return;
    const t = c.currentTime + (o2.at || 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = o2.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o2.slideTo) osc.frequency.exponentialRampToValueAtTime(o2.slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o2.vol || 0.1, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  const sounds = {
    pop() { tone(520, 0.14, { slideTo: 900, vol: 0.09 }); },
    wrong() { tone(230, 0.22, { type: 'triangle', slideTo: 165, vol: 0.08 }); },
    color() { [660, 880, 1175].forEach((f, i) => tone(f, 0.2, { at: i * 0.08, vol: 0.06 })); },
    win() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.4, { at: i * 0.12, vol: 0.07 })); },
  };

  const unlock = () => { if (enabled) ensure(); };
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('touchend', unlock, true);

  PBN.sound = {
    play(name) { if (enabled && sounds[name]) sounds[name](); },
    get enabled() { return enabled; },
    set enabled(v) { enabled = v; PBN.store.setSetting('sound', v); },
  };
})();
