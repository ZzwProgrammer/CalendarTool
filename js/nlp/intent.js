/**
 * Intent Classifier
 * Rule-based keyword matching with Levenshtein fuzzy fallback.
 */
import { bestFuzzyMatch, levenshteinSimilarity } from '../utils/levenshtein.js';
import { CONFIG } from '../config.js';

/**
 * Intent keyword definitions with Chinese labels.
 */
const INTENT_KEYWORDS = {
  add: ['添加', '新增', '增加', '安排', '创建', '加入'],
  delete: ['删除', '取消', '移除', '去掉', '清除'],
  view: ['查看', '查询', '显示', '有什么', '有什么安排', '告诉我', '列出'],
  reschedule: ['修改', '改到', '改成', '调整', '移动', '推迟', '提前'],
};

/**
 * Map intent ID to Chinese display label.
 */
const INTENT_LABELS = {
  add: '添加',
  delete: '删除',
  view: '查看',
  reschedule: '修改',
  unknown: '未知',
};

/**
 * Classify the intent of a given voice command text.
 * @param {string} text - Corrected text from the pipeline
 * @returns {{ intent: string, confidence: number, matchedKeyword: string }}
 */
export function classifyIntent(text) {
  if (!text || text.trim().length === 0) {
    return { intent: 'unknown', confidence: 0, matchedKeyword: '' };
  }

  let bestIntent = 'unknown';
  let bestConfidence = 0;
  let bestKeyword = '';

  // First pass: exact match (highest confidence)
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw)) {
        // Exact match is high confidence
        const confidence = 0.95;
        if (confidence > bestConfidence) {
          bestConfidence = confidence;
          bestIntent = intent;
          bestKeyword = kw;
        }
      }
    }
  }

  // Second pass: fuzzy match (if no strong exact match found)
  if (bestConfidence < 0.9) {
    const allKeywords = [];
    for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
      for (const kw of keywords) {
        allKeywords.push({ keyword: kw, intent });
      }
    }

    // Use sliding-window fuzzy match for each keyword
    for (const { keyword, intent } of allKeywords) {
      for (let i = 0; i <= text.length - keyword.length; i++) {
        const window = text.slice(i, i + keyword.length);
        const sim = levenshteinSimilarity(keyword, window);
        if (sim > bestConfidence && sim >= CONFIG.LEVENSHTEIN_THRESHOLD) {
          bestConfidence = sim;
          bestIntent = intent;
          bestKeyword = keyword;
        }
      }
    }
  }

  // Heuristic fallback: check for question marks (likely view)
  if (bestIntent === 'unknown' && /[?？吗呢]/.test(text)) {
    bestIntent = 'view';
    bestConfidence = 0.4;
  }

  // Heuristic: if text mentions a time, high chance of add
  if (bestIntent === 'unknown') {
    const timePattern = /\d+点|明天|后天|今天|下周|下个月|上午|下午|晚上/;
    if (timePattern.test(text)) {
      bestIntent = 'add';
      bestConfidence = 0.35;
    }
  }

  return {
    intent: bestIntent,
    confidence: bestConfidence,
    matchedKeyword: bestKeyword,
  };
}

/**
 * Get Chinese label for an intent.
 * @param {string} intent
 * @returns {string}
 */
export function getIntentLabel(intent) {
  return INTENT_LABELS[intent] || '未知';
}

export { INTENT_KEYWORDS, INTENT_LABELS };
export default { classifyIntent, getIntentLabel };
