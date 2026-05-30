/**
 * Voice Indicator UI
 * Manages the microphone button visual states and interim text display.
 */
export const VoiceIndicator = {
  _micBtn: null,
  _statusEl: null,
  _interimEl: null,

  /**
   * Initialize the voice indicator (called after DOM ready).
   */
  init() {
    this._micBtn = document.getElementById('mic-btn');
    this._statusEl = document.getElementById('voice-status');
    this._interimEl = document.getElementById('interim-text');
  },

  /**
   * Set the microphone status and update UI accordingly.
   * @param {'idle'|'listening'|'processing'} status
   */
  setStatus(status) {
    const btn = this._micBtn;
    if (!btn) return;

    // Update button class
    btn.classList.remove('mic-idle', 'mic-listening', 'mic-processing');

    switch (status) {
      case 'idle':
        btn.classList.add('mic-idle');
        this._setStatusText('点击麦克风开始说话');
        this._setInterimText('');
        break;
      case 'listening':
        btn.classList.add('mic-listening');
        this._setStatusText('正在聆听...');
        break;
      case 'processing':
        btn.classList.add('mic-processing');
        this._setStatusText('处理中...');
        break;
    }
  },

  /**
   * Set the interim (real-time) recognition text.
   * @param {string} text
   */
  setInterimText(text) {
    this._setInterimText(text);
  },

  /**
   * Show an error message in the status area.
   * @param {string} message
   */
  showError(message) {
    this._setStatusText(message);
    setTimeout(() => {
      this._setStatusText('点击麦克风开始说话');
    }, 3000);
  },

  _setStatusText(text) {
    if (this._statusEl) {
      this._statusEl.textContent = text;
    }
  },

  _setInterimText(text) {
    if (this._interimEl) {
      this._interimEl.textContent = text;
    }
  },
};

export default VoiceIndicator;
