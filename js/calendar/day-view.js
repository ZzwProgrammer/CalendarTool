/**
 * Day View Renderer
 * Renders a single day with hour-gutter time axis.
 */
import el from '../utils/dom.js';
import { isSameDay, formatDateCN } from '../utils/date-utils.js';

export function renderDayView(container, { date, events, highlightedIds, onSlotClick, onEventClick }) {
  container.innerHTML = '';

  const today = new Date();
  const isToday = isSameDay(date, today);
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const view = el('div', { className: 'calendar-day' });

  // Header
  const header = el('div', {
    className: 'day-header',
    style: isToday ? 'color: var(--color-primary);' : '',
  }, `${formatDateCN(date)} ${['日', '一', '二', '三', '四', '五', '六'][date.getDay()]}${isToday ? ' (今天)' : ''}`);
  view.appendChild(header);

  // Body
  const body = el('div', { className: 'day-body' });

  // Time gutter
  const gutter = el('div', { className: 'time-gutter' });
  hours.forEach(h => {
    gutter.appendChild(el('div', { className: 'time-label' },
      `${String(h).padStart(2, '0')}:00`));
  });
  body.appendChild(gutter);

  // Event column
  const col = el('div', { className: 'event-column' });
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
  const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);

  // Hour slots
  hours.forEach(h => {
    const slot = el('div', { className: 'hour-slot',
      dataset: { hour: h },
      onClick: () => {
        if (onSlotClick) {
          const slotDate = new Date(date);
          slotDate.setHours(h, 0, 0, 0);
          onSlotClick(slotDate);
        }
      } });
    col.appendChild(slot);
  });

  // Event blocks
  const dayEvents = events.filter(e => {
    const estart = e.startTime.getTime();
    const eend = e.endTime.getTime();
    return estart <= dayEnd.getTime() && eend >= dayStart.getTime();
  });

  dayEvents.forEach((event, idx) => {
    const eventStart = new Date(Math.max(event.startTime.getTime(), dayStart.getTime()));
    const eventEnd = new Date(Math.min(event.endTime.getTime(), dayEnd.getTime()));

    const startMinutes = eventStart.getHours() * 60 + eventStart.getMinutes();
    const endMinutes = eventEnd.getHours() * 60 + eventEnd.getMinutes();
    const durationMinutes = Math.max(endMinutes - startMinutes, 15);

    const topPx = (startMinutes / 1440) * (24 * 48);
    const heightPx = (durationMinutes / 1440) * (24 * 48);

    const isHighlighted = highlightedIds && highlightedIds.includes(event.id);
    const block = el('div', {
      className: `event-block color-${idx % 4}${isHighlighted ? ' highlight-pulse' : ''}`,
      style: {
        top: `${topPx}px`,
        height: `${Math.max(heightPx, 20)}px`,
      },
      title: `${event.title}\n${String(eventStart.getHours()).padStart(2, '0')}:${String(eventStart.getMinutes()).padStart(2, '0')} - ${String(eventEnd.getHours()).padStart(2, '0')}:${String(eventEnd.getMinutes()).padStart(2, '0')}`,
      onClick: () => {
        if (onEventClick) onEventClick(event);
      },
    }, event.title);
    col.appendChild(block);
  });

  body.appendChild(col);
  view.appendChild(body);
  container.appendChild(view);

  return () => {
    container.innerHTML = '';
  };
}
