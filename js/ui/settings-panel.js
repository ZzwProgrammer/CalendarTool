/**
 * Settings Panel UI
 * Manages the settings overlay for LLM config, wake word, theme, etc.
 */
import state from '../state.js';
import { SettingsStore } from '../storage/settings-store.js';
import { Toasts } from './toasts.js';
import el from '../utils/dom.js';

export const SettingsPanel = {
  _overlay: null,

  init() {
    this._overlay = document.getElementById('settings-overlay');
    this._bindEvents();
    this._loadCurrentSettings();
  },

  show() {
    if (!this._overlay) return;
    this._loadCurrentSettings();
    this._overlay.classList.remove('hidden');
  },

  hide() {
    if (!this._overlay) return;
    this._overlay.classList.add('hidden');
  },

  _bindEvents() {
    document.getElementById('settings-close').addEventListener('click', () => this.hide());
    document.getElementById('settings-save').addEventListener('click', () => this._save());
    document.getElementById('btn-test-llm').addEventListener('click', () => this._testConnection());
    document.getElementById('btn-clear-data').addEventListener('click', () => this._clearData());

    // Close on overlay click
    this._overlay.addEventListener('click', (e) => {
      if (e.target === this._overlay) this.hide();
    });

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this._overlay.classList.contains('hidden')) {
        this.hide();
      }
    });
  },

  _loadCurrentSettings() {
    const settings = state.getState().settings;

    setInputValue('setting-llm-endpoint', settings.llmEndpoint || '');
    setInputValue('setting-llm-apikey', settings.llmApiKey || '');
    setInputValue('setting-llm-model', settings.llmModel || 'deepseek-chat');

    const wakeToggle = document.getElementById('setting-wake-word');
    if (wakeToggle) wakeToggle.checked = settings.wakeWordEnabled === true;

    const darkToggle = document.getElementById('setting-dark-theme');
    if (darkToggle) darkToggle.checked = settings.theme === 'dark';
  },

  async _save() {
    const endpoint = getInputValue('setting-llm-endpoint');
    const apiKey = getInputValue('setting-llm-apikey');
    const model = getInputValue('setting-llm-model');
    const wakeWord = document.getElementById('setting-wake-word').checked;
    const darkTheme = document.getElementById('setting-dark-theme').checked;

    const settings = {
      llmEndpoint: endpoint || 'https://api.deepseek.com/chat/completions',
      llmApiKey: apiKey || '',
      llmModel: model || 'deepseek-chat',
      wakeWordEnabled: wakeWord,
      theme: darkTheme ? 'dark' : 'light',
    };

    try {
      await SettingsStore.set('llm_endpoint', settings.llmEndpoint);
      await SettingsStore.set('llm_api_key', settings.llmApiKey);
      await SettingsStore.set('llm_model', settings.llmModel);
      await SettingsStore.set('wake_word_enabled', String(settings.wakeWordEnabled));
      await SettingsStore.set('theme', settings.theme);

      state.setState({ settings });
    } catch (err) {
      console.error('[Settings] Save error:', err);
      Toasts.show('设置保存失败', { type: 'error' });
      return;
    }

    // Apply theme
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(`theme-${settings.theme}`);

    Toasts.show('设置已保存', { type: 'success' });
    this.hide();
  },

  async _testConnection() {
    const endpoint = getInputValue('setting-llm-endpoint') || 'https://api.deepseek.com/chat/completions';
    const apiKey = getInputValue('setting-llm-apikey');

    if (!apiKey) {
      Toasts.show('请先输入 API Key', { type: 'warning' });
      return;
    }

    Toasts.show('正在测试连接...', { type: 'info', duration: 5000 });

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: getInputValue('setting-llm-model') || 'deepseek-chat',
          messages: [{ role: 'user', content: '回复"连接成功"' }],
          max_tokens: 10,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        Toasts.show('LLM API 连接成功！', { type: 'success' });
      } else {
        Toasts.show(`API 返回错误: ${response.status}`, { type: 'error' });
      }
    } catch (err) {
      Toasts.show(`连接失败: ${err.message}`, { type: 'error' });
    }
  },

  async _clearData() {
    if (!confirm('确定要清除所有本地数据吗？此操作不可恢复！')) return;

    try {
      localStorage.clear();
      // Try to clear IndexedDB
      if (window.indexedDB) {
        const dbs = await window.indexedDB.databases();
        for (const db of dbs) {
          window.indexedDB.deleteDatabase(db.name);
        }
      }
      Toasts.show('所有数据已清除，请刷新页面', { type: 'warning', duration: 5000 });
    } catch (err) {
      console.error('[Settings] Clear data error:', err);
      Toasts.show('清除数据失败', { type: 'error' });
    }
  },
};

function getInputValue(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

function setInputValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

export default SettingsPanel;
