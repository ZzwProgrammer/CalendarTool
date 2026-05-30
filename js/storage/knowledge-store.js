/**
 * Knowledge Store — CRUD for adaptive correction entries
 */
import { put, get, getAll, del, count } from './db-core.js';
import { CONFIG } from '../config.js';

const STORE = 'knowledge';
const MAX_ENTRIES = CONFIG.MAX_KNOWLEDGE_ENTRIES;

export const KnowledgeStore = {
  /**
   * Add a new knowledge entry (upsert: if original+category match, increment count).
   * @param {{ originalText: string, correctedText: string, category: string }} entry
   * @returns {Promise<Object>}
   */
  async add(entry) {
    // Check for existing match to upsert
    const all = await this.getAll();
    const existing = all.find(
      e => e.originalText === entry.originalText
        && e.correctedText === entry.correctedText
    );

    if (existing) {
      const updated = {
        ...existing,
        count: existing.count + 1,
        lastUsed: Date.now(),
        updatedAt: new Date().toISOString(),
      };
      await put(STORE, updated);
      return updated;
    }

    // Evict if over capacity
    const currentCount = await count(STORE);
    if (currentCount >= MAX_ENTRIES) {
      const sorted = all.sort((a, b) => (a.lastUsed || 0) - (b.lastUsed || 0));
      const evictCount = Math.min(50, sorted.length);
      for (let i = 0; i < evictCount; i++) {
        await this.delete(sorted[i].id);
      }
    }

    const newEntry = {
      originalText: entry.originalText,
      correctedText: entry.correctedText,
      category: entry.category || 'custom',
      count: 1,
      lastUsed: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const id = await put(STORE, newEntry);
    return { ...newEntry, id };
  },

  /**
   * Delete a knowledge entry by id.
   * @param {number} id
   */
  async delete(id) {
    await del(STORE, id);
  },

  /**
   * Get all knowledge entries.
   * @returns {Promise<Object[]>}
   */
  async getAll() {
    const results = await getAll(STORE);
    return results || [];
  },

  /**
   * Find entries matching an original text.
   * @param {string} text
   * @returns {Promise<Object[]>}
   */
  async findByText(text) {
    const all = await this.getAll();
    return all.filter(e => e.originalText === text || text.includes(e.originalText));
  },

  /**
   * Get entries by category, sorted by count (most used first).
   * @param {string} category
   * @returns {Promise<Object[]>}
   */
  async getByCategory(category) {
    const all = await this.getAll();
    return all
      .filter(e => e.category === category)
      .sort((a, b) => b.count - a.count);
  },

  /**
   * Get total entry count.
   * @returns {Promise<number>}
   */
  async getCount() {
    return count(STORE);
  },
};

export default KnowledgeStore;
