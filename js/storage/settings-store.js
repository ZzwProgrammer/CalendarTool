/**
 * Settings Store — Persist user preferences
 */
import { put, get, getAll, del } from './db-core.js';

const STORE = 'settings';

export const SettingsStore = {
  /**
   * Save a setting.
   * @param {string} key
   * @param {string} value
   */
  async set(key, value) {
    await put(STORE, { key, value: String(value) });
  },

  /**
   * Get a setting by key.
   * @param {string} key
   * @param {string} [defaultVal='']
   * @returns {Promise<string>}
   */
  async get(key, defaultVal = '') {
    const result = await get(STORE, key);
    return result ? result.value : defaultVal;
  },

  /**
   * Get all settings as an object.
   * @returns {Promise<Object>}
   */
  async getAll() {
    const results = await getAll(STORE);
    const settings = {};
    for (const item of results) {
      settings[item.key] = item.value;
    }
    return settings;
  },

  /**
   * Delete a setting.
   * @param {string} key
   */
  async remove(key) {
    await del(STORE, key);
  },

  /**
   * Load settings into the app state.
   * @returns {Promise<Object>}
   */
  async loadAll() {
    const saved = await this.getAll();

    return {
      llmEndpoint: saved.llm_endpoint || 'https://api.deepseek.com/chat/completions',
      llmApiKey: saved.llm_api_key || '',
      llmModel: saved.llm_model || 'deepseek-chat',
      wakeWordEnabled: saved.wake_word_enabled === 'true',
      theme: saved.theme || 'light',
    };
  },
};

export default SettingsStore;
