/**
 * Layer 3 — Confidence-to-Action Decision
 * Routes the final result based on combined confidence:
 *   >= 0.9: auto-execute with undo
 *   0.6-0.9: show confirmation card (normal)
 *   < 0.6: show confirmation card with highlighted suspect fields
 */
import { CONFIG } from '../../config.js';

/**
 * Determine the Layer 3 action and suspect fields.
 * @param {number} confidence - Final combined confidence from pipeline
 * @param {Object} details - Intent/time/title confidence details
 * @param {number} details.intentConfidence
 * @param {number} details.timeConfidence
 * @param {number} details.titleConfidence
 * @param {boolean} details.hasDatetime
 * @param {boolean} details.hasTitle
 * @param {string} details.intent
 * @returns {{ action: string, suspectFields: string[] }}
 */
export function determineAction(confidence, details = {}) {
  const action = getAction(confidence);
  const suspectFields = getSuspectFields(confidence, details);

  return { action, suspectFields };
}

/**
 * Determine which action to take based on confidence.
 */
function getAction(confidence) {
  if (confidence >= CONFIG.CONFIDENCE_AUTO_EXECUTE) {
    return 'auto-execute';
  }
  if (confidence >= CONFIG.CONFIDENCE_SHOW_CARD) {
    return 'show-card';
  }
  return 'show-card-highlight';
}

/**
 * Determine which fields to flag as suspect.
 */
function getSuspectFields(confidence, details) {
  const suspect = [];

  // Always add suspect fields if confidence is low
  if (confidence < CONFIG.CONFIDENCE_SHOW_CARD) {
    if (!details.hasDatetime || details.timeConfidence < 0.5) {
      suspect.push('datetime');
    }
    if (!details.hasTitle || details.titleConfidence < 0.5) {
      suspect.push('title');
    }
    if (details.intent === 'unknown' || details.intentConfidence < 0.5) {
      suspect.push('intent');
    }
  }

  return suspect;
}

/**
 * Format the action into a user-facing description.
 * @param {string} action
 * @returns {string}
 */
export function describeAction(action) {
  switch (action) {
    case 'auto-execute': return '自动执行';
    case 'show-card': return '显示确认卡片';
    case 'show-card-highlight': return '显示确认卡片（标记可疑字段）';
    default: return '未知';
  }
}

export default { determineAction, describeAction };
