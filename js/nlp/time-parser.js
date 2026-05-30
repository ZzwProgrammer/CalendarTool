/**
 * Time Parser
 * Wraps chrono-node for Chinese time expression parsing with regex fallback.
 */
import { CONFIG } from '../config.js';

/**
 * Parse time expressions from text.
 * @param {string} text - Corrected text
 * @param {Date} [referenceDate=new Date()] - Reference date for relative expressions
 * @returns {{
 *   datetime: Date|null,
 *   endDatetime: Date|null,
 *   confidence: number,
 *   remainingText: string,
 *   matchedText: string
 * }}
 */
export function parseTime(text, referenceDate = new Date()) {
  if (!text || text.trim().length === 0) {
    return {
      datetime: null,
      endDatetime: null,
      confidence: 0,
      remainingText: text,
      matchedText: '',
    };
  }

  let chronoParsed = null;
  let endDatetime = null;
  let confidence = 0;
  let matchedText = '';
  let remainingText = text;

  // Try chrono-node
  try {
    if (window.chrono && window.chrono.zh) {
      const zhChrono = window.chrono.zh.casual || window.chrono.zh.strict;
      const results = zhChrono.parse(text, referenceDate);

      if (results && results.length > 0) {
        const first = results[0];

        if (first.start) {
          chronoParsed = first.start.date();
          matchedText = first.text || '';

          if (first.end) {
            endDatetime = first.end.date();
          }

          // Confidence based on parse quality
          if (first.start.isCertain('day') && first.start.isCertain('hour')) {
            confidence = 0.95;
          } else if (first.start.isCertain('day')) {
            confidence = 0.80;
          } else {
            confidence = 0.65;
          }
        }
      }
    }
  } catch (err) {
    console.warn('[TimeParser] chrono-node error:', err);
  }

  // Regex fallback if chrono didn't parse
  if (!chronoParsed) {
    const regexResult = regexParse(text, referenceDate);
    if (regexResult.datetime) {
      chronoParsed = regexResult.datetime;
      endDatetime = regexResult.endDatetime;
      confidence = regexResult.confidence;
      matchedText = regexResult.matchedText;
    }
  }

  // Remove matched time text from original
  if (matchedText) {
    remainingText = text.replace(matchedText, '').trim();
  }

  // Apply default time if date but no time was parsed
  if (chronoParsed && chronoParsed.getHours() === 0 && chronoParsed.getMinutes() === 0) {
    // Check if original text implies a time of day
    if (/上午|早上|早晨/.test(text)) {
      chronoParsed.setHours(9, 0, 0, 0);
    } else if (/下午/.test(text)) {
      chronoParsed.setHours(15, 0, 0, 0);
    } else if (/晚上|傍晚/.test(text)) {
      chronoParsed.setHours(20, 0, 0, 0);
    }
    // If still no time, default to current time + 1 hour rounded
    if (chronoParsed.getHours() === 0) {
      const now = new Date();
      chronoParsed.setHours(now.getHours() + 1, 0, 0, 0);
    }
    if (confidence > 0.8) confidence = 0.80; // date only parse
  }

  return {
    datetime: chronoParsed,
    endDatetime,
    confidence,
    remainingText,
    matchedText,
  };
}

/**
 * Regex-based fallback time parser for Chinese text.
 */
function regexParse(text, referenceDate) {
  const now = referenceDate || new Date();
  let datetime = null;
  let endDatetime = null;
  let confidence = 0;
  let matchedText = '';

  // Detect relative day
  let targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let dayMatched = '';

  // 0. Absolute date: "6月1号", "12月31日", "6月1号下午三点", "6月1号"
  // Date part is required, time part is FULLY optional
  const absDateMatch = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*[号日](?:(?:[上下中晚凌]午|凌晨|早上|晚上|中午)?\s*(?:\d{1,2}|[一二三四五六七八九十]{1,3})\s*[点:：]\s*(?:\d{1,2}|[一二三四五六七八九])?\s*(?:分|半)?)?/);
  if (absDateMatch) {
    const absMonth = parseInt(absDateMatch[1]);
    const absDay = parseInt(absDateMatch[2]);
    if (absMonth >= 1 && absMonth <= 12 && absDay >= 1 && absDay <= 31) {
      targetDate.setMonth(absMonth - 1);
      targetDate.setDate(absDay);
      dayMatched = absDateMatch[0];
      // If parsed date is in the past, assume next year
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (targetDate < todayStart) {
        targetDate.setFullYear(targetDate.getFullYear() + 1);
      }
    }
  }

  if (/今天|今个|今儿/.test(text)) {
    dayMatched = text.match(/今天|今个|今儿/)[0];
  } else if (/明天|明个|明儿|明田/.test(text)) {
    targetDate.setDate(targetDate.getDate() + 1);
    dayMatched = text.match(/明天|明个|明儿|明田/)[0];
  } else if (/后天|后个|后天/.test(text)) {
    targetDate.setDate(targetDate.getDate() + 2);
    dayMatched = text.match(/后天|后个|后天/)[0];
  } else if (/大后天/.test(text)) {
    targetDate.setDate(targetDate.getDate() + 3);
    dayMatched = '大后天';
  } else if (/昨天|昨个|昨田/.test(text)) {
    targetDate.setDate(targetDate.getDate() - 1);
    dayMatched = text.match(/昨天|昨个|昨田/)[0];
  }

  // Detect weekday: 周一, 周二, ..., 周日 / 星期X / 礼拜X
  const weekdayMatch = text.match(/(?:下周|下星期|下礼拜)([一二三四五六日天])/) ||
    text.match(/(?:周|星期|礼拜)([一二三四五六日天])/);
  if (weekdayMatch) {
    const dayMap = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0 };
    const targetDay = dayMap[weekdayMatch[1]];
    const prefix = weekdayMatch[0].charAt(0) === '下' ? 'next' : 'this';
    const currentDay = targetDate.getDay();
    let diff = targetDay - currentDay;
    if (prefix === 'next') diff += 7;
    if (diff <= 0 && prefix !== 'next') diff += 7;
    targetDate.setDate(targetDate.getDate() + diff);
    matchedText = weekdayMatch[0];
  }

  // Detect time: X点, X点Y分, X点半, X:Y — supports both Arabic and Chinese digits
  const cnDigitMap = { '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10, '十一': 11, '十二': 12 };
  const timeMatch = text.match(/(\d{1,2}|[一二三四五六七八九十]{1,3})\s*[点:：]\s*(\d{1,2}|[一二三四五六七八九])?\s*(分|半)?/);
  if (timeMatch) {
    let hour = cnDigitMap[timeMatch[1]] !== undefined ? cnDigitMap[timeMatch[1]] : parseInt(timeMatch[1]);
    let minute = 0;
    if (timeMatch[3] === '半') {
      minute = 30;
    } else if (timeMatch[2]) {
      minute = cnDigitMap[timeMatch[2]] !== undefined ? cnDigitMap[timeMatch[2]] : parseInt(timeMatch[2]);
    }

    // Adjust for Chinese time conventions
    const isPM = /下午|晚上|傍晚|下五|下物/.test(text);
    const isNoon = /中午/.test(text);
    const isEarlyMorning = /凌晨/.test(text);

    if (isPM && hour < 12) hour += 12;
    else if (isNoon && hour < 12) hour += 12;
    else if (isEarlyMorning && hour === 12) hour = 0;

    targetDate.setHours(hour, minute, 0, 0);
    datetime = new Date(targetDate);
    // If absDateMatch already captured the time (e.g. "6月2号早上九点"),
    // don't double-append the time portion from timeMatch
    if (dayMatched && dayMatched.includes(timeMatch[0])) {
      matchedText = dayMatched;
    } else {
      matchedText = (dayMatched ? dayMatched : '') + timeMatch[0];
    }
    confidence = dayMatched ? 0.65 : 0.45;
  } else if (dayMatched) {
    // Date without time
    datetime = new Date(targetDate);
    matchedText = dayMatched;
    confidence = 0.65;
  }

  return { datetime, endDatetime: null, confidence, matchedText };
}

export default { parseTime };
