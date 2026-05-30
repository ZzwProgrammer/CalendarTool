/**
 * Correction Pipeline Orchestrator
 * The central brain wiring Layer 1 → Layer 2 → Layer 3.
 * Every voice input flows through here.
 */
import { CONFIG } from '../../config.js';
import state from '../../state.js';
import { correctLocal } from './layer1-local.js';
import { correctWithLLM } from './layer2-llm.js';
import { determineAction } from './layer3-confirm.js';
import { classifyIntent } from '../intent.js';
import { parseTime } from '../time-parser.js';
import { extractTitle } from '../title-extractor.js';

/**
 * Run the full correction pipeline on raw ASR text.
 * @param {string} originalText - Raw voice recognition text
 * @returns {Promise<Object>} Full CorrectionResult
 */
export async function runCorrectionPipeline(originalText) {
  // ALWAYS use real today for relative date parsing (明天/后天/下周 etc.)
  // The calendar view date must NOT influence voice command interpretation
  const referenceDate = new Date();

  /** @type {CorrectionResult} */
  const result = {
    originalText,
    referenceDate,

    layer1: {
      correctedText: originalText,
      confidence: 0,
      corrections: [],
      homophoneScore: 0,
      levenshteinScore: 0,
      chronoScore: 0,
    },

    layer2: {
      triggered: false,
      correctedText: '',
      confidence: 0,
      intent: '',
      datetime: null,
      title: '',
      correctionNote: '',
      error: '',
    },

    final: {
      correctedText: originalText,
      confidence: 0,
      source: 'layer1',
      intent: 'unknown',
      intentConfidence: 0,
      datetime: null,
      endDatetime: null,
      timeConfidence: 0,
      title: '',
      titleConfidence: 0,
      action: 'show-card-highlight',
      suspectFields: [],
    },
  };

  // ==========================================
  // LAYER 1: Always run local correction
  // ==========================================
  try {
    const l1Result = await correctLocal(originalText, referenceDate);
    result.layer1 = { ...result.layer1, ...l1Result };
  } catch (err) {
    console.error('[Pipeline] Layer 1 error:', err);
    result.layer1.confidence = 0;
  }

  // ==========================================
  // DECISION: Layer 2 needed?
  // ==========================================
  const l1Confidence = result.layer1.confidence;

  if (l1Confidence < CONFIG.CONFIDENCE_LLM_FALLBACK) {
    result.layer2.triggered = true;

    const settings = state.getState().settings;
    if (settings.llmApiKey) {
      try {
        const l2Result = await correctWithLLM(originalText, referenceDate, {
          endpoint: settings.llmEndpoint || CONFIG.LLM_ENDPOINT,
          apiKey: settings.llmApiKey,
          model: settings.llmModel || CONFIG.LLM_MODEL,
        });

        if (l2Result) {
          result.layer2 = { ...result.layer2, ...l2Result, triggered: true };
          // Use LLM result
          result.final.correctedText = l2Result.correctedText;
          result.final.confidence = l2Result.confidence;
          result.final.source = 'layer2';
        } else {
          // LLM failed, fall back to L1
          result.final.correctedText = result.layer1.correctedText;
          result.final.confidence = l1Confidence;
          result.final.source = 'layer1';
          result.layer2.error = 'LLM returned null';
        }
      } catch (err) {
        console.error('[Pipeline] Layer 2 error:', err);
        result.final.correctedText = result.layer1.correctedText;
        result.final.confidence = l1Confidence;
        result.final.source = 'layer1';
        result.layer2.error = err.message;
      }
    } else {
      // No API key, skip Layer 2
      result.final.correctedText = result.layer1.correctedText;
      result.final.confidence = l1Confidence;
      result.final.source = 'layer1';
    }
  } else {
    // Layer 1 sufficient
    result.final.correctedText = result.layer1.correctedText;
    result.final.confidence = l1Confidence;
    result.final.source = 'layer1';
  }

  // ==========================================
  // NLP: Intent + Time + Title
  // ==========================================
  const correctedText = result.final.correctedText;

  // Intent classification
  const intentResult = classifyIntent(correctedText);
  result.final.intent = intentResult.intent;
  result.final.intentConfidence = intentResult.confidence;

  // Time parsing
  const timeResult = parseTime(correctedText, referenceDate);
  result.final.datetime = timeResult.datetime;
  result.final.endDatetime = timeResult.endDatetime;
  result.final.timeConfidence = timeResult.confidence;

  // Title extraction
  const titleResult = extractTitle(correctedText, intentResult, timeResult);
  result.final.title = titleResult.title;
  result.final.titleConfidence = titleResult.confidence;

  // Debug log
  console.log('[Pipeline] Intent:', intentResult.intent,
    '| Time:', timeResult.datetime ? timeResult.datetime.toLocaleString() : 'null',
    '| Title:', titleResult.title,
    '| L1 conf:', result.layer1.confidence,
    '| Final conf:', result.final.confidence);

  // ==========================================
  // LAYER 3: Determine action
  // ==========================================
  const layer3Result = determineAction(result.final.confidence, {
    intentConfidence: result.final.intentConfidence,
    timeConfidence: result.final.timeConfidence,
    titleConfidence: result.final.titleConfidence,
    hasDatetime: !!result.final.datetime,
    hasTitle: !!result.final.title && result.final.title.length > 0,
    intent: result.final.intent,
  });

  result.final.action = layer3Result.action;
  result.final.suspectFields = layer3Result.suspectFields;

  // If no title, force card display even with high confidence
  if (!result.final.title || result.final.title.trim().length === 0) {
    if (result.final.action === 'auto-execute') {
      result.final.action = 'show-card';
      if (!result.final.suspectFields.includes('title')) {
        result.final.suspectFields.push('title');
      }
    }
  }

  // If no datetime and this is an add/delete/reschedule intent, force card
  if (!result.final.datetime && ['add', 'delete', 'reschedule'].includes(result.final.intent)) {
    if (result.final.action === 'auto-execute') {
      result.final.action = 'show-card';
      if (!result.final.suspectFields.includes('datetime')) {
        result.final.suspectFields.push('datetime');
      }
    }
  }

  // If intent is unknown, never auto-execute
  if (result.final.intent === 'unknown') {
    result.final.action = 'show-card-highlight';
    if (!result.final.suspectFields.includes('intent')) {
      result.final.suspectFields.push('intent');
    }
  }

  return result;
}

export default { runCorrectionPipeline };
