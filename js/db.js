// db.js — thin promise wrapper around IndexedDB. Single local DB, no cloud.
const DB_NAME = 'kartuli';
const DB_VERSION = 2;

let _db = null;

export function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('cards')) {
        const s = db.createObjectStore('cards', { keyPath: 'id' });
        s.createIndex('due', 'srs.due');
        s.createIndex('type', 'type');
      }
      if (!db.objectStoreNames.contains('reviews')) {
        const s = db.createObjectStore('reviews', { keyPath: 'id', autoIncrement: true });
        s.createIndex('ts', 'ts');
        s.createIndex('cardId', 'cardId');
      }
      if (!db.objectStoreNames.contains('state')) {
        db.createObjectStore('state', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('speakerLog')) {
        const s = db.createObjectStore('speakerLog', { keyPath: 'id', autoIncrement: true });
        s.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains('recordings')) {
        const s = db.createObjectStore('recordings', { keyPath: 'id', autoIncrement: true });
        s.createIndex('kind', 'kind');
        s.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains('customVocab')) {
        db.createObjectStore('customVocab', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('verifyFlags')) {
        db.createObjectStore('verifyFlags', { keyPath: 'itemId' });
      }
      if (!db.objectStoreNames.contains('ttsCache')) {
        db.createObjectStore('ttsCache', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const out = fn(s);
    t.oncomplete = () => resolve(out && out._result !== undefined ? out._result : out);
    t.onerror = () => reject(t.error);
  }));
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function put(store, value) {
  const db = await openDB();
  return reqToPromise(db.transaction(store, 'readwrite').objectStore(store).put(value));
}

export async function bulkPut(store, values) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, 'readwrite');
    const s = t.objectStore(store);
    for (const v of values) s.put(v);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function get(store, key) {
  const db = await openDB();
  return reqToPromise(db.transaction(store).objectStore(store).get(key));
}

export async function getAll(store) {
  const db = await openDB();
  return reqToPromise(db.transaction(store).objectStore(store).getAll());
}

export async function del(store, key) {
  const db = await openDB();
  return reqToPromise(db.transaction(store, 'readwrite').objectStore(store).delete(key));
}

export async function add(store, value) {
  const db = await openDB();
  return reqToPromise(db.transaction(store, 'readwrite').objectStore(store).add(value));
}

// --- state helpers (key/value) ---
export async function getState(key, fallback = null) {
  const row = await get('state', key);
  return row ? row.value : fallback;
}
export async function setState(key, value) {
  return put('state', { key, value });
}
