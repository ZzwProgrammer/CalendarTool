/**
 * IndexedDB Core Wrapper
 * Promise-based abstraction for IndexedDB operations.
 * Falls back to LocalStorage when IndexedDB is unavailable.
 */
import { CONFIG } from '../config.js';
import { StorageFallback } from './storage-fallback.js';

const DB_NAME = CONFIG.DB_NAME;
const DB_VERSION = CONFIG.DB_VERSION;

let db = null;
let fallback = null;
let databaseOpen = false;

/**
 * Open the database and create object stores if needed.
 * @returns {Promise<IDBDatabase>}
 */
export function open() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      console.warn('[DB] IndexedDB not supported, using localStorage fallback');
      fallback = new StorageFallback();
      databaseOpen = true;
      resolve(null);
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      console.log('[DB] Creating/upgrading object stores...');

      // Events store
      if (!database.objectStoreNames.contains('events')) {
        const eventsStore = database.createObjectStore('events', { keyPath: 'id' });
        eventsStore.createIndex('startTime', 'startTime', { unique: false });
        eventsStore.createIndex('title', 'title', { unique: false });
      }

      // Knowledge store
      if (!database.objectStoreNames.contains('knowledge')) {
        const knowledgeStore = database.createObjectStore('knowledge', {
          keyPath: 'id',
          autoIncrement: true,
        });
        knowledgeStore.createIndex('originalText', 'originalText', { unique: false });
        knowledgeStore.createIndex('category', 'category', { unique: false });
      }

      // Settings store
      if (!database.objectStoreNames.contains('settings')) {
        database.createObjectStore('settings', { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      databaseOpen = true;
      console.log('[DB] Database opened successfully');
      resolve(db);
    };

    request.onerror = (event) => {
      console.error('[DB] Database open error:', event.target.error);
      fallback = new StorageFallback();
      databaseOpen = true;
      resolve(null);
    };

    request.onblocked = () => {
      console.warn('[DB] Database blocked, retrying...');
      setTimeout(() => {
        open().then(resolve).catch(reject);
      }, 500);
    };
  });
}

/**
 * Ensure database is ready.
 */
async function ensureDB() {
  if (!databaseOpen) {
    await open();
    await new Promise(r => setTimeout(r, 50));
  }
}

/**
 * Get the active db or fallback.
 */
function getStore() {
  if (fallback) return fallback;
  return db;
}

/**
 * Execute a readwrite transaction with retry logic.
 */
function withStore(storeName, mode = 'readonly') {
  const store = getStore();
  if (store instanceof StorageFallback) {
    return store;
  }
  return db.transaction([storeName], mode).objectStore(storeName);
}

/**
 * Put a value into a store.
 */
export function put(storeName, value, key) {
  const store = getStore();
  if (store instanceof StorageFallback) {
    return store.put(storeName, value, key);
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], 'readwrite');
    const objStore = tx.objectStore(storeName);
    const request = objStore.put(value, key);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get a value by key from a store.
 */
export function get(storeName, key) {
  const store = getStore();
  if (store instanceof StorageFallback) {
    return store.get(storeName, key);
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], 'readonly');
    const objStore = tx.objectStore(storeName);
    const request = objStore.get(key);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all values from a store.
 */
export function getAll(storeName, indexName, keyRange) {
  const store = getStore();
  if (store instanceof StorageFallback) {
    return store.getAll(storeName, indexName, keyRange);
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], 'readonly');
    const objStore = tx.objectStore(storeName);
    const source = indexName ? objStore.index(indexName) : objStore;
    const request = source.getAll(keyRange || null);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a value by key from a store.
 */
export function del(storeName, key) {
  const store = getStore();
  if (store instanceof StorageFallback) {
    return store.delete(storeName, key);
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], 'readwrite');
    const objStore = tx.objectStore(storeName);
    const request = objStore.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all values from a store.
 */
export function clearStore(storeName) {
  const store = getStore();
  if (store instanceof StorageFallback) {
    return store.clear(storeName);
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], 'readwrite');
    const objStore = tx.objectStore(storeName);
    const request = objStore.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Count entries in a store.
 */
export function count(storeName) {
  const store = getStore();
  if (store instanceof StorageFallback) {
    return store.count(storeName);
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], 'readonly');
    const objStore = tx.objectStore(storeName);
    const request = objStore.count();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export default { open, put, get, getAll, delete: del, clear: clearStore, count };
