// Uploaded pictures and their progress live in IndexedDB (big quota, unlike
// localStorage). At startup everything is loaded into memory, so the rest of
// the game keeps reading progress synchronously; writes go to IndexedDB in
// the background.
(function () {
  const DB_NAME = 'dabble', DB_VERSION = 1;
  let dbPromise = null;

  function open() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        if (!window.indexedDB) { reject(new Error('IndexedDB is not available')); return; }
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('artworks')) db.createObjectStore('artworks', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('progress')) db.createObjectStore('progress', { keyPath: 'id' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error('Database is blocked by another tab'));
      });
    }
    return dbPromise;
  }
  function run(store, mode, fn) {
    return open().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
    }));
  }
  const all = (store) => run(store, 'readonly', (s) => s.getAll());
  const put = (store, value) => run(store, 'readwrite', (s) => s.put(value));
  const del = (store, key) => run(store, 'readwrite', (s) => s.delete(key));

  const ids = new Set();
  const progress = new Map();

  PBN.userArt = {
    available: !!window.indexedDB,
    // Load saved uploads into PBN.artworks (after the built-in pictures).
    async init() {
      const [arts, progs] = await Promise.all([all('artworks'), all('progress')]);
      arts.sort((a, b) => a.created - b.created).forEach((a) => { ids.add(a.id); PBN.artworks.push(a); });
      progs.forEach((p) => progress.set(p.id, p));
    },
    has(id) { return ids.has(id); },
    count() { return ids.size; },
    async add(art) {
      await put('artworks', art);
      ids.add(art.id);
      PBN.artworks.push(art);
    },
    save(art) { return put('artworks', art); },
    async remove(id) {
      await del('artworks', id);
      await del('progress', id);
      ids.delete(id);
      progress.delete(id);
      const i = PBN.artworks.findIndex((a) => a.id === id);
      if (i >= 0) PBN.artworks.splice(i, 1);
    },
    loadProgress(id, sig) {
      const p = progress.get(id);
      return new Set(p && p.sig === sig ? p.filled : []);
    },
    saveProgress(id, sig, filled, total) {
      const rec = { id, sig, filled: Array.from(filled), total, updated: Date.now() };
      progress.set(id, rec);
      put('progress', rec).catch((e) => console.warn('Could not save progress', e));
    },
    clearProgress(id) {
      progress.delete(id);
      del('progress', id).catch(() => {});
    },
  };
})();
