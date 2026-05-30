/**
 * Week View Renderer
 * Renders a 7-day week with hour-gutter time axis.
 */
import el from '../utils/dom.js';
import { isSameDay, formatISOLocal } from '../utils/date-utils.js';

export function renderWeekView(container, { startDate, events, onSlotClick, onEventClick }) {
  container.innerHTML = '';

  const today = new Date();
  const weekDays = ['一', '二', '三', '四', '五', '六', '日'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const view = el('div', { className: 'calendar-week' });

  // Header
  const header = el('div', { className: 'week-header' });
  header.appendChild(el('div', { className: 'header-cell' }, '')); // gutter

  for (let i = 0; i < 7; i++) {
    const day = new Date(startDate);
    day.setDate(day.getDate() + i);
    const isWeekend = i >= 5;
    const isToday = isSameDay(day, today);
    let cls = 'header-cell';
    if (isWeekend) cls += ' weekend';
    if (isToday) cls += ' today-label';

    header.appendChild(el('div', {
      className: cls,
      dataset: { date: formatISOLocal(day) },
    }, [
      el('div', {}, weekDays[i]),
      el('div', { style: { fontSize: 'var(--font-size-lg)' } }, String(day.getDate())),
    ]));
  }
  view.appendChild(header);

  // Body
  const body = el('div', { className: 'week-body' });

  // Time gutter
  const gutter = el('div', { className: 'time-gutter' });
  hours.forEach(h => {
    gutter.appendChild(el('div', { className: 'time-label' },
      `${String(h).padStart(2, '0')}:00`));
  });
  body.appendChild(gutter);

  // Day columns
  for (let i = 0; i < 7; i++) {
    const day = new Date(startDate);
    day.setDate(day.getDate() + i);
    const isToday = isSameDay(day, today);
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0);
    const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59);

    const col = el('div', { className: `day-column${isToday ? ' today' : ''}`,
      dataset: { date: formatISOLocal(day) } });

    // Hour slots
    hours.forEach(h => {
      const slot = el('div', { className: 'hour-slot',
        dataset: { hour: h },
        onClick: () => {
          if (onSlotClick) {
            const slotDate = new Date(day);
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

      const block = el('div', {
        className: `event-block color-${idx % 4}`,
        style: {
          top: `${topPx}px`,
          height: `${Math.max(heightPx, 18)}px`,
        },
        title: `${event.title}\n${eventStart.getHours()}:${String(eventStart.getMinutes()).padStart(2, '0')} - ${eventEnd.getHours()}:${String(eventEnd.getMinutes()).padStart(2, '0')}`,
        onClick: (e) => {
          e.stopPropagation();
          if (onEventClick) onEventClick(event);
        },
      }, event.title);

      col.appendChild(block);
    });

    body.appendChild(col);
  }

  view.appendChild(body);
  container.appendChild(view);

  return () => {
    container.innerHTML = '';
  };
}
