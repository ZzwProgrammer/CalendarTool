/**
 * Layer 1 — Local Correction
 * Homophone table replacement + chrono pre-cleaning + fuzzy intent matching.
 * Runs entirely offline, always applied.
 */
import { CONFIG } from '../../config.js';
import { KnowledgeBase } from './knowledge-base.js';
import { levenshteinSimilarity, fuzzyContains } from '../../utils/levenshtein.js';
import { INTENT_KEYWORDS } from '../intent.js';

let homophoneTable = null;

/**
 * Load the homophone table from the JSON data file.
 * @returns {Promise<Object>}
 */
async function loadHomophoneTable() {
  if (homophoneTable) return homophoneTable;
  try {
    const response = await fetch('data/homophone-table.json');
    homophoneTable = await response.json();
    return homophoneTable;
  } catch (err) {
    console.warn('[L1] Failed to load homophone table:', err);
    // Fallback minimal table
    homophoneTable = {
      time_keywords: { '下五': '下午', '明个': '明天' },
      intent_keywords: { '田家': '添加' },
      common_words: { '回忆': '会议' },
    };
    return homophoneTable;
  }
}

/**
 * Run Layer 1 local correction on raw voice text.
 * @param {string} originalText - Raw ASR text
 * @param {Date} referenceDate - Reference date for time parsing
 * @returns {Promise<{
 *   correctedText: string,
 *   confidence: number,
 *   corrections: Array<{original: string, corrected: string, source: string, category: string, confidence: number}>,
 *   homophoneScore: number,
 *   levenshteinScore: number,
 *   chronoScore: number
 * }>}
 */
export async function correctLocal(originalText, referenceDate = new Date()) {
  if (!originalText || originalText.trim().length === 0) {
    return {
      correctedText: originalText,
      confidence: 0,
      corrections: [],
      homophoneScore: 0,
      levenshteinScore: 0,
      chronoScore: 0,
    };
  }

  let text = originalText;
  const corrections = [];

  // Step 1: Load homophone table
  const table = await loadHomophoneTable();

  // Step 2: Apply static homophone corrections
  // Process order: time_keywords > intent_keywords > common_words
  // Within each category: longest match first
  const order = ['time_keywords', 'intent_keywords', 'common_words'];
  for (const category of order) {
    const entries = Object.entries(table[category] || {})
      .filter(([k]) => !k.startsWith('_'))
      .sort(([a], [b]) => b.length - a.length);

    for (const [wrong, correct] of entries) {
      if (text.includes(wrong)) {
        const before = text;
        text = text.split(wrong).join(correct);
        if (text !== before) {
          corrections.push({
            original: wrong,
            corrected: correct,
            source: 'homophone',
            category,
            confidence: 0.9,
          });
        }
      }
    }
  }

  // Step 3: Apply adaptive knowledge base corrections
  try {
    const kbResult = await KnowledgeBase.apply(text);
    if (kbResult && kbResult.correctionsApplied) {
      for (const c of kbResult.correctionsApplied) {
        const before = text;
        text = text.split(c.original).join(c.corrected);
        if (text !== before) {
          corrections.push({
            original: c.original,
            corrected: c.corrected,
            source: 'knowledge',
            category: c.category,
            confidence: Math.min(0.95, 0.5 + c.count * 0.1),
          });
        }
      }
    }
  } catch (err) {
    console.warn('[L1] Knowledge base error:', err);
  }

  // Step 4: chrono-node pre-cleaning
  text = text
    .replace(/[，。！？、；：""''（）【】《》\s]+/g, ' ')
    .replace(/(\d)点(\d)分/g, '$1:$2')
    .replace(/(\d)点半/g, '$1:30')
    .trim();

  // Step 5: Compute sub-scores
  const totalChars = originalText.replace(/\s/g, '').length;
  const correctedChars = corrections.reduce(
    (sum, c) => sum + c.original.length, 0
  );
  const homophoneScore = correctedChars === 0
    ? 1.0
    : Math.max(0.3, 1.0 - (correctedChars / Math.max(totalChars, 1)));

  // Levenshtein score: best fuzzy match against all intent keywords
  const levenshteinScore = computeLevenshteinScore(text);

  // chronoScore: from time-parser
  const chronoScore = computeChronoScore(text, referenceDate);

  // Combined confidence
  const confidence = computeLayer1Confidence({
    homophoneScore,
    levenshteinScore,
    chronoScore,
  });

  return {
    correctedText: text,
    confidence,
    corrections,
    homophoneScore,
    levenshteinScore,
    chronoScore,
  };
}

/**
 * Compute Levenshtein fuzzy match score against intent keywords.
 */
function computeLevenshteinScore(text) {
  let bestScore = 0;
  const allKeywords = [];
  for (const keywords of Object.values(INTENT_KEYWORDS)) {
    allKeywords.push(...keywords);
  }

  for (const kw of allKeywords) {
    const result = fuzzyContains(kw, text, 0.4);
    if (result.similarity > bestScore) {
      bestScore = result.similarity;
    }
    if (bestScore === 1.0) break;
  }

  return bestScore;
}

/**
 * Compute chrono-node parse confidence score.
 */
function computeChronoScore(text, referenceDate) {
  try {
    if (!window.chrono || !window.chrono.zh) return 0;
    const zhChrono = window.chrono.zh.casual || window.chrono.zh.strict;
    const results = zhChrono.parse(text, referenceDate);
    if (!results || results.length === 0) return 0;

    const first = results[0];
    let score = 0;
    if (first.start) {
      score += 0.4;
      if (first.start.isCertain('day')) score += 0.2;
      if (first.start.isCertain('month')) score += 0.15;
      if (first.start.isCertain('hour')) score += 0.25;
    }
    return Math.min(1, score);
  } catch (err) {
    return 0;
  }
}

/**
 * Compute Layer 1 combined confidence.
 */
function computeLayer1Confidence({ homophoneScore, levenshteinScore, chronoScore }) {
  const { L1_WEIGHT_HOMOPHONE, L1_WEIGHT_LEVENSHTEIN, L1_WEIGHT_CHRONO } = CONFIG;

  const confidence = (
    L1_WEIGHT_HOMOPHONE * homophoneScore +
    L1_WEIGHT_LEVENSHTEIN * levenshteinScore +
    L1_WEIGHT_CHRONO * chronoScore
  );

  return Math.max(0, Math.min(1, Math.round(confidence * 100) / 100));
}

export default { correctLocal };
