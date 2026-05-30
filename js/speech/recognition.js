/**
 * Speech Recognition Module
 * Wraps Web Speech API SpeechRecognition for Chinese voice input.
 */
import { CONFIG } from '../config.js';

/**
 * Create a speech recognizer instance.
 * @param {Object} options
 * @param {string} [options.lang='zh-CN']
 * @param {number} [options.maxAlternatives=3]
 * @param {boolean} [options.continuous=false]
 * @param {boolean} [options.interimResults=true]
 * @param {Function} options.onResult - ({ text: string, isFinal: boolean }) => void
 * @param {Function} options.onError - ({ code: string, message: string }) => void
 * @param {Function} options.onStatusChange - (status: 'idle'|'listening'|'processing') => void
 * @returns {{ start: Function, stop: Function, abort: Function }}
 */
export function createRecognizer(options = {}) {
  const {
    lang = CONFIG.SPEECH_LANG,
    maxAlternatives = CONFIG.MAX_ALTERNATIVES,
    continuous = false,
    interimResults = true,
    onResult = () => {},
    onError = () => {},
    onStatusChange = () => {},
  } = options;

  if (!isSupported()) {
    onError({ code: 'not-supported', message: 'SpeechRecognition not available' });
    return { start() {}, stop() {}, abort() {}, isSupported: () => false };
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let silenceTimer = null;
  let active = false;

  function create() {
    const rec = new SpeechRecognition();
    rec.lang = lang;
    rec.maxAlternatives = maxAlternatives;
    rec.continuous = continuous;
    rec.interimResults = interimResults;

    rec.onresult = (event) => {
      // Reset silence timer on new results
      resetTimer();

      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (interim && interimResults) {
        onResult({ text: interim, isFinal: false });
      }
      if (final) {
        onResult({ text: final, isFinal: true });
        if (!continuous) {
          stop();
        }
      }
    };

    rec.onerror = (event) => {
      clearTimeout(silenceTimer);
      active = false;
      onStatusChange('idle');

      onError({
        code: event.error,
        message: getErrorMessage(event.error),
      });
    };

    rec.onend = () => {
      clearTimeout(silenceTimer);
      active = false;
      onStatusChange('idle');
    };

    rec.onaudiostart = () => {
      onStatusChange('listening');
    };

    rec.onspeechstart = () => {
      onStatusChange('listening');
    };

    return rec;
  }

  function resetTimer() {
    clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => {
      if (active && recognition) {
        recognition.stop();
      }
    }, CONFIG.RECOGNITION_TIMEOUT_MS);
  }

  function start() {
    if (active) return;

    try {
      recognition = create();
      recognition.start();
      active = true;
      resetTimer();
    } catch (err) {
      console.error('[Recognition] Start error:', err);
      onError({ code: 'start-failed', message: err.message });
    }
  }

  function stop() {
    clearTimeout(silenceTimer);
    if (recognition && active) {
      try {
        recognition.stop();
      } catch (e) {
        // Already stopped
      }
    }
    active = false;
    onStatusChange('idle');
  }

  function abort() {
    clearTimeout(silenceTimer);
    if (recognition && active) {
      try {
        recognition.abort();
      } catch (e) {
        // Already aborted
      }
    }
    active = false;
    onStatusChange('idle');
  }

  return { start, stop, abort, isSupported };
}

/**
 * Check browser support for SpeechRecognition.
 * @returns {boolean}
 */
export function isSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function getErrorMessage(error) {
  const messages = {
    'not-allowed': '麦克风权限被拒绝',
    'no-speech': '没有检测到语音',
    'audio-capture': '无法访问麦克风',
    'network': '网络连接错误',
    'aborted': '识别已中止',
    'service-not-allowed': '语音识别服务不可用',
    'bad-grammar': '语法错误',
    'language-not-supported': '不支持该语言',
  };
  return messages[error] || `语音识别错误: ${error}`;
}
