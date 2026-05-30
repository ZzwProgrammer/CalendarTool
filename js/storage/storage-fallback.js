/**
 * LocalStorage Fallback
 * Used when IndexedDB is unavailable (e.g., Firefox private browsing).
 * Mimics the IndexedDB module's API with key paths and indexes.
 */
export class StorageFallback {
  constructor() {
    this._prefix = 'vcal_';
    console.warn('[StorageFallback] Using localStorage (limited to ~5MB)');
  }

  _makeKey(storeName, key) {
    return `${this._prefix}${storeName}_${key}`;
  }

  _getStore(storeName) {
    const prefix = `${this._prefix}${storeName}_`;
    const items = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith(prefix)) {
        try {
          items.push(JSON.parse(localStorage.getItem(k)));
        } catch (e) {
          // Skip corrupted entries
        }
      }
    }
    return items;
  }

  put(storeName, value, key) {
    const k = key || value.id || value.key;
    if (!k && k !== 0) {
      throw new Error('put() requires a key, or value with id/key property');
    }
    const storeKey = this._makeKey(storeName, k);
    localStorage.setItem(storeKey, JSON.stringify(value));
    return Promise.resolve(k);
  }

  get(storeName, key) {
    const storeKey = this._makeKey(storeName, key);
    const raw = localStorage.getItem(storeKey);
    return Promise.resolve(raw ? JSON.parse(raw) : undefined);
  }

  getAll(storeName, indexName, keyRange) {
    let items = this._getStore(storeName);

    // Simple keyRange filtering
    if (keyRange && indexName) {
      items = items.filter(item => {
        const val = item[indexName];
        if (val === undefined) return false;
        if (typeof keyRange === 'object') {
          if (keyRange.lower !== undefined && val < keyRange.lower) return false;
          if (keyRange.upper !== undefined && val > keyRange.upper) return false;
        }
        return true;
      });
    }

    return Promise.resolve(items);
  }

  delete(storeName, key) {
    const storeKey = this._makeKey(storeName, key);
    localStorage.removeItem(storeKey);
    return Promise.resolve();
  }

  clear(storeName) {
    const prefix = `${this._prefix}${storeName}_`;
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith(prefix)) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
    return Promise.resolve();
  }

  count(storeName) {
    return Promise.resolve(this._getStore(storeName).length);
  }
}
