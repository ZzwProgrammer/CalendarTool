/**
 * Adaptive Knowledge Base
 * Learns from user corrections and applies learned patterns to future input.
 * Persisted to IndexedDB.
 */
import { KnowledgeStore } from '../../storage/knowledge-store.js';

export const KnowledgeBase = {
  /**
   * Learn a correction from user interaction.
   * Called when user confirms or edits a field in the confirmation card.
   * @param {string} originalText - Original (erroneous) text fragment
   * @param {string} correctedText - User-corrected text
   * @param {string} [category='custom'] - Category for classification
   * @returns {Promise<void>}
   */
  async learn(originalText, correctedText, category = 'custom') {
    if (!originalText || !correctedText) return;
    if (originalText === correctedText) return; // No correction needed

    try {
      await KnowledgeStore.add({
        originalText,
        correctedText,
        category,
      });
      console.log(`[Knowledge] Learned: "${originalText}" → "${correctedText}"`);
    } catch (err) {
      console.warn('[Knowledge] Learn error:', err);
    }
  },

  /**
   * Apply learned corrections to a text.
   * @param {string} text - Text to apply corrections to
   * @returns {Promise<{ correctedText: string, correctionsApplied: Array }>}
   */
  async apply(text) {
    if (!text) return { correctedText: text, correctionsApplied: [] };

    try {
      const allEntries = await KnowledgeStore.getAll();
      if (!allEntries || allEntries.length === 0) {
        return { correctedText: text, correctionsApplied: [] };
      }

      // Sort by count (most used first) and length (longest first)
      const sorted = allEntries
        .sort((a, b) => {
          if (b.count !== a.count) return b.count - a.count;
          return (b.originalText?.length || 0) - (a.originalText?.length || 0);
        });

      let result = text;
      const applied = [];

      for (const entry of sorted) {
        if (!entry.originalText || !entry.correctedText) continue;
        if (result.includes(entry.originalText)) {
          result = result.split(entry.originalText).join(entry.correctedText);
          applied.push({
            original: entry.originalText,
            corrected: entry.correctedText,
            category: entry.category || 'custom',
            count: entry.count || 1,
          });
        }
      }

      return { correctedText: result, correctionsApplied: applied };
    } catch (err) {
      console.warn('[Knowledge] Apply error:', err);
      return { correctedText: text, correctionsApplied: [] };
    }
  },

  /**
   * Get statistics about the knowledge base.
   * @returns {Promise<{ totalEntries: number, topCategories: Object }>}
   */
  async getStats() {
    try {
      const count = await KnowledgeStore.getCount();
      return { totalEntries: count, topCategories: {} };
    } catch (err) {
      return { totalEntries: 0, topCategories: {} };
    }
  },
};

export default KnowledgeBase;
