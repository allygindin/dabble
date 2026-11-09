// localStorage wrapper. Every access is guarded: private mode or full storage
// must never break the game, it just stops remembering.
(function () {
  const P = 'pbn:';
  function get(k) {
    try { return JSON.parse(localStorage.getItem(P + k)); } catch (e) { return null; }
  }
  function set(k, v) {
    try { localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) { /* ignore */ }
  }

  PBN.store = {
    get, set,
    loadProgress(id, sig) {
      const p = get('progress:' + id);
      return new Set(p && p.sig === sig ? p.filled : []);
    },
    saveProgress(id, sig, filled, total) {
      set('progress:' + id, { sig, filled: Array.from(filled), total, updated: Date.now() });
    },
    clearProgress(id) {
      try { localStorage.removeItem(P + 'progress:' + id); } catch (e) { /* ignore */ }
    },
    getSetting(name, fallback) {
      const s = get('settings') || {};
      return name in s ? s[name] : fallback;
    },
    setSetting(name, value) {
      const s = get('settings') || {};
      s[name] = value;
      set('settings', s);
    },
  };
})();
