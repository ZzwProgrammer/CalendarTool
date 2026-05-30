/**
 * Wake Word Detector (Optional)
 * Continuous listening with "嘿日历" wake word detection.
 */
import { createRecognizer } from './recognition.js';
import { CONFIG } from '../config.js';

let wakeRecognizer = null;
let isActive = false;
let onWakeCallback = null;

export const WakeWord = {
  /**
   * Start continuous wake word listening.
   * @param {{ onWake: Function, onError: Function }} options
   */
  start({ onWake, onError = () => {} } = {}) {
    if (isActive) return;
    if (!createRecognizer({}).isSupported) return;

    onWakeCallback = onWake;

    wakeRecognizer = createRecognizer({
      lang: CONFIG.SPEECH_LANG,
      continuous: true,
      interimResults: false,
      onResult: ({ text, isFinal }) => {
        if (!isFinal) return;
        // Check for wake word
        const cleaned = text.replace(/\s+/g, '');
        if (cleaned.includes(CONFIG.WAKE_WORD.replace(/\s+/g, '')) || cleaned.includes('嘿日立')) {
          console.log('[WakeWord] Wake word detected:', text);
          if (onWakeCallback) {
            onWakeCallback(text.replace(/嘿日历|嘿日立/gi, '').trim() || text);
          }
          // Brief pause after wake
          wakeRecognizer.stop();
          setTimeout(() => {
            if (isActive && wakeRecognizer) {
              wakeRecognizer.start();
            }
          }, CONFIG.WAKE_PAUSE_MS);
        }
      },
      onError: (err) => {
        console.warn('[WakeWord] Error:', err);
        onError(err);
        // Retry after error
        if (isActive) {
          setTimeout(() => {
            if (isActive && wakeRecognizer) {
              try { wakeRecognizer.start(); } catch (e) {}
            }
          }, 1000);
        }
      },
    });

    wakeRecognizer.start();
    isActive = true;
    console.log('[WakeWord] Started. Say "嘿日历" to activate.');
  },

  /**
   * Stop continuous listening.
   */
  stop() {
    if (wakeRecognizer) {
      wakeRecognizer.stop();
      wakeRecognizer = null;
    }
    isActive = false;
    onWakeCallback = null;
  },

  /**
   * Check if wake word detection is active.
   * @returns {boolean}
   */
  isActive() {
    return isActive;
  },
};

export default WakeWord;
