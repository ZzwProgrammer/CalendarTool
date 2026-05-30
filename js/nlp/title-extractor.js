/**
 * Title Extractor
 * Extracts event title from corrected text by removing intent words
 * and parsed time tokens.
 */

// Common filler/particle words to strip
const FILLER_WORDS = [
  '帮我', '请帮我', '一个', '的', '一下', '吧', '啊', '吗', '呢', '哦', '嗯',
  '一下', '这个', '那个', '请', '给', '把',
  '我', '我的', '我们的', '所有的', '所有的',
  '名为', '叫做', '叫', '呃', '就是', '那个', '哪个', '什么',
];

// Intent-related words to remove (already handled by intent.js but safety net)
const INTENT_WORDS = [
  '添加', '新增', '增加', '安排', '创建', '加入',
  '删除', '取消', '移除', '去掉', '清除',
  '查看', '查询', '显示', '告诉我', '列出',
  '修改', '改到', '改成', '调整', '移动', '推迟', '提前',
];

/**
 * Extract event title from corrected text.
 * @param {string} correctedText - The fully corrected text
 * @param {{ intent: string, matchedKeyword: string }} intentResult
 * @param {{ matchedText: string, datetime: Date|null }} timeResult
 * @returns {{ title: string, confidence: number }}
 */
export function extractTitle(correctedText, intentResult, timeResult) {
  if (!correctedText || correctedText.trim().length === 0) {
    return { title: '', confidence: 0 };
  }

  let title = correctedText;

  // 1. Remove parsed time tokens
  if (timeResult && timeResult.matchedText) {
    title = title.replace(timeResult.matchedText, '');
  }

  // 2. Remove matched intent keyword
  if (intentResult && intentResult.matchedKeyword) {
    title = title.replace(intentResult.matchedKeyword, '');
  }

  // 3. Remove common intent verbs (in case intent keyword was missed)
  for (const word of INTENT_WORDS) {
    title = title.replace(word, '');
  }

  // 4. Remove filler words
  for (const filler of FILLER_WORDS) {
    title = title.replace(filler, '');
  }

  // 5. Remove common punctuation and connectors
  title = title
    .replace(/[，。！？、；：""''（）【】《》「」,\.!\?;:'"\(\)\[\]\{\}]/g, ' ')
    .replace(/与|和|跟/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // 6. Check remaining time-like expressions
  title = title
    .replace(/\d{1,2}\s*[点:：]\s*\d{0,2}\s*(分|半)?/g, '')
    .replace(/上午|下午|晚上|中午|凌晨|早上/g, '')
    .replace(/今天|明天|后天|昨天/g, '')
    .replace(/下周[一二三四五六日天]/g, '')
    .replace(/上?周[一二三四五六日天]/g, '')
    .replace(/下?星期[一二三四五六日天]/g, '')
    .replace(/下?礼拜[一二三四五六日天]/g, '')
    .replace(/\d{1,2}\s*[月号日]\s*\d{0,2}\s*[号日]?/g, '')
    .replace(/\d{1,2}\s*[点:：]\s*\d{0,2}\s*(?:分|半)?/g, '')
    .replace(/[一二三四五六七八九十]{1,3}\s*[点:：]\s*(?:[一二三四五六七八九])?\s*(?:分|半)?/g, '')
    .trim();

  // 7. Confidence assignment
  let confidence = 0;

  if (title.length === 0) {
    confidence = 0;
  } else if (title.length < 2) {
    confidence = 0.3;
  } else if (title.length < 4) {
    confidence = 0.7;
  } else {
    confidence = 0.85;
  }

  // Penalize if title still contains suspicious characters
  if (/^\d+$/.test(title)) {
    confidence = 0.2; // just numbers
  }

  return {
    title: title || '',
    confidence,
  };
}

export default { extractTitle };
