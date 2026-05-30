/**
 * Speech Synthesis (TTS) Module
 * Wraps SpeechSynthesis API for voice feedback.
 */
export const TTS = {
  _speaking: false,

  /**
   * Speak text with Chinese voice if available.
   * @param {string} text
   * @param {{ rate?: number, pitch?: number }} [options]
   * @returns {Promise<void>}
   */
  speak(text, options = {}) {
    return new Promise((resolve) => {
      if (!this.isSupported()) {
        console.warn('[TTS] SpeechSynthesis not supported');
        resolve();
        return;
      }

      // Cancel any ongoing speech
      this.stop();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = options.rate || 1.0;
      utterance.pitch = options.pitch || 1.0;

      // Try to select a Chinese voice
      const voices = this.getVoices();
      const zhVoice = voices.find(v => v.lang.startsWith('zh-CN'))
        || voices.find(v => v.lang.startsWith('zh-'))
        || voices.find(v => v.lang.startsWith('zh'));
      if (zhVoice) {
        utterance.voice = zhVoice;
      }

      utterance.onstart = () => { this._speaking = true; };
      utterance.onend = () => { this._speaking = false; resolve(); };
      utterance.onerror = (e) => {
        this._speaking = false;
        console.warn('[TTS] Error:', e.error);
        resolve();
      };

      // Timeout safety
      setTimeout(() => {
        if (this._speaking) {
          this.stop();
          resolve();
        }
      }, 15000);

      window.speechSynthesis.speak(utterance);
    });
  },

  /**
   * Stop current speech.
   */
  stop() {
    if (this.isSupported()) {
      window.speechSynthesis.cancel();
    }
    this._speaking = false;
  },

  /**
   * Get available voices.
   * @returns {SpeechSynthesisVoice[]}
   */
  getVoices() {
    if (!this.isSupported()) return [];
    return window.speechSynthesis.getVoices();
  },

  /**
   * Check if SpeechSynthesis is supported.
   * @returns {boolean}
   */
  isSupported() {
    return typeof window !== 'undefined' && !!window.speechSynthesis;
  },
};

export default TTS;
