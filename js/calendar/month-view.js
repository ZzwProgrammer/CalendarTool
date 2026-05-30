/**
 * Month View Renderer
 * Renders a 6-week grid with date cells and event badges.
 */
import el from '../utils/dom.js';
import { formatISOLocal, isSameDay } from '../utils/date-utils.js';

/**
 * Render the month view into a container.
 * @param {HTMLElement} container
 * @param {Object} options
 * @param {number} options.year
 * @param {number} options.month - 0-indexed (0=Jan)
 * @param {Object[]} options.events
 * @param {Function} options.onDateClick - (date: Date) => void
 * @param {Function} options.onEventClick - (event: Object) => void
 * @returns {Function} destroy cleanup function
 */
export function renderMonthView(container, { year, month, events, onDateClick, onEventClick }) {
  container.innerHTML = '';

  const today = new Date();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Calculate the start date (Monday of the week containing the 1st)
  const startDay = new Date(firstDay);
  const startDayOfWeek = startDay.getDay();
  const diffToMonday = startDayOfWeek === 0 ? -6 : 1 - startDayOfWeek;
  startDay.setDate(startDay.getDate() + diffToMonday);

  const weekDays = ['一', '二', '三', '四', '五', '六', '日'];

  // Build calendar DOM
  const calendar = el('div', { className: 'calendar-month' });

  // Header row
  const header = el('div', { className: 'calendar-header' });
  weekDays.forEach((day, i) => {
    const cls = i >= 5 ? 'weekend' : '';
    header.appendChild(el('div', { className: cls }, day));
  });
  calendar.appendChild(header);

  // Grid
  const grid = el('div', { className: 'calendar-grid' });

  // Group events by date for quick lookup
  const eventsByDate = new Map();
  for (const event of events) {
    const ds = event.startTime;
    const dateKey = `${ds.getFullYear()}-${ds.getMonth()}-${ds.getDate()}`;
    if (!eventsByDate.has(dateKey)) {
      eventsByDate.set(dateKey, []);
    }
    eventsByDate.get(dateKey).push(event);
  }

  // Render 42 cells (6 weeks × 7 days)
  const currentDate = new Date(startDay);
  for (let i = 0; i < 42; i++) {
    const cellDate = new Date(currentDate);
    const isOtherMonth = cellDate.getMonth() !== month;
    const isToday = isSameDay(cellDate, today);
    const dayOfWeek = cellDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const dateKey = `${cellDate.getFullYear()}-${cellDate.getMonth()}-${cellDate.getDate()}`;
    const dayEvents = eventsByDate.get(dateKey) || [];

    let cellClass = 'calendar-cell';
    if (isOtherMonth) cellClass += ' other-month';
    if (isToday) cellClass += ' today';
    if (isWeekend) cellClass += ' weekend';

    const cell = el('div', { className: cellClass, dataset: { date: formatISOLocal(cellDate) } });

    // Day number
    cell.appendChild(el('div', { className: 'day-number' }, String(cellDate.getDate())));

    // Event badges
    const badges = el('div', { className: 'event-badges' });
    const maxBadges = 3;
    dayEvents.slice(0, maxBadges).forEach((event, idx) => {
      const badge = el('div', {
        className: `event-badge color-${idx % 4}`,
        title: event.title,
        onClick: (e) => {
          e.stopPropagation();
          if (onEventClick) onEventClick(event, e);
        },
      }, event.title);
      badges.appendChild(badge);
    });

    if (dayEvents.length > maxBadges) {
      const more = el('div', {
        className: 'more-events',
        onClick: (e) => {
          e.stopPropagation();
          // Show popover with all events for this day
          showDayEventsPopover(cellDate, dayEvents, onEventClick, e);
        },
      }, `+${dayEvents.length - maxBadges} 更多`);
      badges.appendChild(more);
    }

    cell.appendChild(badges);

    // Click on cell (but not on event badges)
    cell.addEventListener('click', (e) => {
      if (e.target === cell || e.target.classList.contains('day-number') || e.target.classList.contains('event-badges')) {
        if (onDateClick) onDateClick(cellDate);
      }
    });

    grid.appendChild(cell);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  calendar.appendChild(grid);
  container.appendChild(calendar);

  // Show a popover for a specific day's events
  function showDayEventsPopover(date, dayEvents, onEvtClick, anchorEvent) {
    // Remove existing popover
    const existing = container.querySelector('.event-popover');
    if (existing) existing.remove();

    const popover = el('div', { className: 'event-popover' });
    popover.appendChild(el('div', { className: 'popover-title' },
      `${date.getMonth() + 1}月${date.getDate()}日 事件 (${dayEvents.length})`));

    dayEvents.forEach(evt => {
      const timeStr = `${String(evt.startTime.getHours()).padStart(2, '0')}:${String(evt.startTime.getMinutes()).padStart(2, '0')}`;
      const item = el('div', {
        className: 'event-badge',
        style: { marginBottom: '4px', cursor: 'pointer' },
        onClick: () => {
          if (onEvtClick) onEvtClick(evt);
          popover.remove();
        },
      }, `${timeStr} - ${evt.title}`);
      popover.appendChild(item);
    });

    popover.appendChild(el('div', { style: { marginTop: '8px', fontSize: '11px', color: 'var(--color-text-muted)' } },
      '点击事件查看详情'));

    // Position relative to anchor
    document.body.appendChild(popover);
    const rect = anchorEvent.target.getBoundingClientRect();
    popover.style.position = 'fixed';
    popover.style.left = `${rect.left}px`;
    popover.style.top = `${rect.bottom + 4}px`;

    // Close on outside click
    const closeHandler = (e) => {
      if (!popover.contains(e.target)) {
        popover.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 0);
  }

  return () => {
    container.innerHTML = '';
  };
}
