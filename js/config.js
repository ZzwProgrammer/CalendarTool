/**
 * Application Constants
 * All tunable parameters centralized here for easy adjustment.
 */
export const CONFIG = {
  // Speech
  SPEECH_LANG: 'zh-CN',
  RECOGNITION_TIMEOUT_MS: 8000,
  MAX_ALTERNATIVES: 3,

  // Correction thresholds (0-1)
  CONFIDENCE_AUTO_EXECUTE: 0.9,
  CONFIDENCE_SHOW_CARD: 0.6,
  CONFIDENCE_LLM_FALLBACK: 0.5,

  // Layer 1 sub-score weights
  L1_WEIGHT_HOMOPHONE: 0.30,
  L1_WEIGHT_LEVENSHTEIN: 0.30,
  L1_WEIGHT_CHRONO: 0.40,

  // Levenshtein
  LEVENSHTEIN_THRESHOLD: 0.6,

  // LLM
  LLM_ENDPOINT: 'https://api.deepseek.com/chat/completions',
  LLM_MODEL: 'deepseek-chat',
  LLM_TIMEOUT_MS: 5000,
  LLM_MAX_TOKENS: 300,
  LLM_TEMPERATURE: 0.1,

  // Calendar
  DEFAULT_VIEW: 'month',
  DEFAULT_EVENT_DURATION_MINUTES: 60,

  // Storage
  DB_NAME: 'voice-calendar-db',
  DB_VERSION: 1,
  MAX_KNOWLEDGE_ENTRIES: 500,
  MAX_UNDO_STACK: 10,
  MAX_HISTORY_ITEMS: 10,

  // Toast
  TOAST_DURATION_MS: 3000,
  UNDO_DURATION_MS: 8000,

  // Wake word
  WAKE_WORD: '嘿日历',
  WAKE_PAUSE_MS: 2000,
};
