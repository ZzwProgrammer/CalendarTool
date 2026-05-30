/**
 * Layer 2 — LLM Semantic Correction
 * Calls configurable LLM API (default DeepSeek) for severe error recovery.
 * Only triggered when Layer 1 confidence < 0.5.
 */
import { CONFIG } from '../../config.js';
import state from '../../state.js';

/**
 * Build the system prompt for the LLM correction engine.
 * @param {string} currentDate - Formatted current date string
 * @returns {string}
 */
function buildSystemPrompt(currentDate) {
  return `你是一个"语音日历纠错引擎"。你的任务是将含有中文语音识别错误（同音字、近音字）的日历操作文本，
纠正为正确的表达，并提取结构化信息。

## 常见语音识别错误模式
- 同音字：回忆→会议、田家→添加、下五→下午、平身→评审、设记→设计、改道→改到
- 数字识别错误：删点→三点、死点→四点、无点→五点
- 时间词混淆：明个→明天、今个→今天、下周无→下周五

## 输出格式（严格JSON，不要markdown代码块）
{
  "correctedText": "纠正后的完整文本",
  "intent": "add|delete|view|reschedule|unknown",
  "datetime": "ISO 8601格式时间字符串，如 2026-05-31T15:00:00，无法确定则为 null",
  "originalDatetime": "如果操作涉及修改已有事件的时间，填写原始时间（ISO 8601），否则 null",
  "title": "事件标题，无法确定则为 null",
  "confidence": 0.0到1.0之间的数字，表示你对整体纠正结果的把握程度",
  "correctionNote": "简要说明做了哪些纠正，中文一句话"
}

## 重要规则
1. 当前参考日期是 ${currentDate}，所有相对时间（明天、下周等）以此为准
2. 如果无法确定某个字段，设为 null，不要猜测
3. confidence 取值参考：
   - 0.9-1.0：非常有把握，所有字段都明确
   - 0.7-0.9：基本能确定，但存在歧义
   - 0.5-0.7：能推断大致意思，但不确定细节
   - 0.0-0.5：文本损坏严重，只能猜测
4. 从语义层面理解用户真实意图，不要仅从字面判断
5. 只需输出JSON，不要输出任何其他文字`;
}

/**
 * Call LLM API for semantic correction.
 * @param {string} originalText - Original garbled ASR text
 * @param {Date} currentDate - Reference date
 * @param {{ endpoint: string, apiKey: string, model: string }} apiConfig
 * @returns {Promise<{
 *   correctedText: string,
 *   intent: string,
 *   datetime: string|null,
 *   originalDatetime: string|null,
 *   title: string|null,
 *   confidence: number,
 *   correctionNote: string
 * }|null>} null on failure
 */
export async function correctWithLLM(originalText, currentDate, apiConfig) {
  const { endpoint, apiKey, model } = apiConfig;

  if (!apiKey) return null;

  const systemPrompt = buildSystemPrompt(
    `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月${currentDate.getDate()}日`
  );

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.LLM_TIMEOUT_MS);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || CONFIG.LLM_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `请纠正以下语音识别文本：${originalText}` },
        ],
        temperature: CONFIG.LLM_TEMPERATURE,
        max_tokens: CONFIG.LLM_MAX_TOKENS,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`[L2] LLM API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse JSON from response (handle markdown-wrapped JSON)
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1]);
      } else {
        console.error('[L2] Failed to parse LLM response:', content.slice(0, 200));
        return null;
      }
    }

    // Validate and normalize
    const validIntents = ['add', 'delete', 'view', 'reschedule', 'unknown'];
    return {
      correctedText: parsed.correctedText || originalText,
      intent: validIntents.includes(parsed.intent) ? parsed.intent : 'unknown',
      datetime: parsed.datetime || null,
      originalDatetime: parsed.originalDatetime || null,
      title: parsed.title || null,
      confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
      correctionNote: parsed.correctionNote || '',
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      console.warn('[L2] LLM request timed out');
    } else {
      console.error('[L2] LLM error:', err);
    }
    return null;
  }
}

export default { correctWithLLM };
