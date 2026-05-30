/**
 * Date Utility Functions
 * Provides consistent date handling across the application.
 */

/**
 * Parse an ISO date string into a Date object, preserving local time.
 * "2026-05-31T15:00" → Date representing that local datetime.
 * @param {string} isoString
 * @returns {Date}
 */
export function parseISOLocal(isoString) {
  if (!isoString) return null;
  // If the string includes time, parse as local
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return null;
  return date;
}

/**
 * Format a Date to ISO-like local string "YYYY-MM-DDTHH:mm".
 * @param {Date} date
 * @returns {string}
 */
export function formatISOLocal(date) {
  if (!date || isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Get the start of the week (Monday) for a given date.
 * @param {Date} date
 * @returns {Date}
 */
export function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday-based
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the end of the week (Sunday) for a given date.
 * @param {Date} date
 * @returns {Date}
 */
export function endOfWeek(date) {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * Get the start of the month for a given date.
 * @param {Date} date
 * @returns {Date}
 */
export function startOfMonth(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the end of the month for a given date.
 * @param {Date} date
 * @returns {Date}
 */
export function endOfMonth(date) {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Format a date as "YYYY年M月".
 * @param {Date} date
 * @returns {string}
 */
export function formatYearMonth(date) {
  if (!date || isNaN(date.getTime())) return '';
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

/**
 * Format a date as "YYYY年M月D日".
 * @param {Date} date
 * @returns {string}
 */
export function formatDateCN(date) {
  if (!date || isNaN(date.getTime())) return '';
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

/**
 * Format a time as "上午/下午 H:MM" for spoken feedback.
 * @param {Date} date
 * @returns {string}
 */
export function formatSpokenTime(date) {
  if (!date || isNaN(date.getTime())) return '';
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours < 12 ? '上午' : '下午';
  const h = hours % 12 || 12;
  if (minutes === 0) {
    return `${period}${h}点`;
  }
  return `${period}${h}点${minutes}分`;
}

/**
 * Format a date and time as spoken Chinese.
 * @param {Date} date
 * @returns {string}
 */
export function formatSpokenDateTime(date) {
  if (!date || isNaN(date.getTime())) return '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((targetDay - today) / (1000 * 60 * 60 * 24));

  let dayStr;
  if (diffDays === 0) dayStr = '今天';
  else if (diffDays === 1) dayStr = '明天';
  else if (diffDays === 2) dayStr = '后天';
  else if (diffDays === -1) dayStr = '昨天';
  else if (diffDays > 2) dayStr = `${diffDays}天后`;
  else dayStr = `${Math.abs(diffDays)}天前`;

  return `${dayStr}${formatSpokenTime(date)}`;
}

/**
 * Check if two dates are on the same day.
 * @param {Date} a
 * @param {Date} b
 * @returns {boolean}
 */
export function isSameDay(a, b) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

/**
 * Get array of date objects for a given date range.
 * @param {Date} start
 * @param {Date} end
 * @returns {Date[]}
 */
export function getDateRange(start, end) {
  const dates = [];
  const current = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (current <= endDay) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/**
 * Get today at midnight.
 * @returns {Date}
 */
export function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Add days to a date.
 * @param {Date} date
 * @param {number} days
 * @returns {Date}
 */
export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
