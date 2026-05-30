/**
 * Confidence Scorer
 * Computes composite confidence from sub-scores across the pipeline.
 */
import { CONFIG } from '../../config.js';

/**
 * Compute the Layer 1 combined confidence from sub-scores.
 * @param {{ homophoneScore: number, levenshteinScore: number, chronoScore: number }} scores
 * @returns {number}
 */
export function computeLayer1Confidence({ homophoneScore, levenshteinScore, chronoScore }) {
  const { L1_WEIGHT_HOMOPHONE, L1_WEIGHT_LEVENSHTEIN, L1_WEIGHT_CHRONO } = CONFIG;

  const confidence = (
    L1_WEIGHT_HOMOPHONE * homophoneScore +
    L1_WEIGHT_LEVENSHTEIN * levenshteinScore +
    L1_WEIGHT_CHRONO * chronoScore
  );

  return Math.max(0, Math.min(1, Math.round(confidence * 100) / 100));
}

/**
 * Compute final combined confidence from Layer 1 and optional Layer 2 results.
 * @param {Object} layer1Result - Layer 1 result
 * @param {Object|null} layer2Result - Layer 2 result (or null if skipped)
 * @returns {{ confidence: number, source: string }}
 */
export function computeCombinedConfidence(layer1Result, layer2Result) {
  if (layer2Result && layer2Result.confidence !== undefined) {
    return {
      confidence: layer2Result.confidence,
      source: 'layer2',
    };
  }

  return {
    confidence: layer1Result.confidence || 0,
    source: 'layer1',
  };
}

/**
 * Aggregate confidence from all NLP sub-modules into a single score.
 * @param {Object} result - { originalText, intentConfidence, timeConfidence, titleConfidence, L1Confidence }
 * @returns {number}
 */
export function aggregateConfidence(result) {
  const subScores = [
    result.L1Confidence || 0,
    result.intentConfidence || 0,
    result.timeConfidence || 0,
    result.titleConfidence || 0,
  ];

  // Weighted average, giving more weight to L1 correction
  const weights = [0.4, 0.2, 0.25, 0.15];
  let weightedSum = 0;
  let totalWeight = 0;

  for (let i = 0; i < subScores.length; i++) {
    if (subScores[i] > 0) {
      weightedSum += subScores[i] * weights[i];
      totalWeight += weights[i];
    }
  }

  if (totalWeight === 0) return 0;
  return Math.max(0, Math.min(1, Math.round((weightedSum / totalWeight) * 100) / 100));
}

export default { computeLayer1Confidence, computeCombinedConfidence, aggregateConfidence };
