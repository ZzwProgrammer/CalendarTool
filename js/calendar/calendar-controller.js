/**
 * Calendar Controller
 * Manages view switching, navigation, and coordinates calendar rendering.
 */
import state from '../state.js';
import { renderMonthView } from './month-view.js';
import { renderWeekView } from './week-view.js';
import { renderDayView } from './day-view.js';
import { startOfWeek, formatYearMonth } from '../utils/date-utils.js';

let currentDestroy = null;
let container = null;

export const CalendarController = {
  /**
   * Initialize the calendar controller.
   * @param {HTMLElement} containerEl
   */
  init(containerEl) {
    container = containerEl;
    this.render();
  },

  /**
   * Render the current view based on state.
   */
  render() {
    if (!container) return;
    if (currentDestroy) {
      currentDestroy();
      currentDestroy = null;
    }

    const { currentView, currentDate, events, highlightedEventIds } = state.getState();
    const opts = {
      events: events || [],
      highlightedIds: highlightedEventIds || [],
      onDateClick: (date) => this._handleDateClick(date),
      onEventClick: (event) => this._handleEventClick(event),
      onSlotClick: (date) => this._handleSlotClick(date),
    };

    switch (currentView) {
      case 'month':
        opts.year = currentDate.getFullYear();
        opts.month = currentDate.getMonth();
        break;
      case 'week':
        opts.startDate = startOfWeek(currentDate);
        break;
      case 'day':
        opts.date = currentDate;
        break;
    }

    if (currentView === 'month') {
      currentDestroy = renderMonthView(container, opts);
    } else if (currentView === 'week') {
      currentDestroy = renderWeekView(container, opts);
    } else if (currentView === 'day') {
      currentDestroy = renderDayView(container, opts);
    }

    this._updateToolbar();
  },

  /**
   * Switch to a different view.
   * @param {'month'|'week'|'day'} view
   */
  switchView(view) {
    state.setState({ currentView: view });
    this._updateViewSwitcher(view);
    this.render();
  },

  /**
   * Navigate to a specific date.
   * @param {Date} date
   */
  navigateTo(date) {
    state.setState({ currentDate: new Date(date) });
    this.render();
  },

  /**
   * Navigate one step back.
   */
  navigatePrev() {
    const { currentView, currentDate } = state.getState();
    const d = new Date(currentDate);
    switch (currentView) {
      case 'month':
        d.setMonth(d.getMonth() - 1);
        break;
      case 'week':
        d.setDate(d.getDate() - 7);
        break;
      case 'day':
        d.setDate(d.getDate() - 1);
        break;
    }
    state.setState({ currentDate: d });
    this.render();
  },

  /**
   * Navigate one step forward.
   */
  navigateNext() {
    const { currentView, currentDate } = state.getState();
    const d = new Date(currentDate);
    switch (currentView) {
      case 'month':
        d.setMonth(d.getMonth() + 1);
        break;
      case 'week':
        d.setDate(d.getDate() + 7);
        break;
      case 'day':
        d.setDate(d.getDate() + 1);
        break;
    }
    state.setState({ currentDate: d });
    this.render();
  },

  /**
   * Navigate to today.
   */
  navigateToday() {
    state.setState({ currentDate: new Date() });
    this.render();
  },

  /**
   * Refresh the current view (re-render with latest data).
   */
  refresh() {
    this.render();
  },

  /**
   * Highlight specific events in the calendar and navigate to them.
   * @param {string[]} eventIds
   */
  highlightEvents(eventIds) {
    // Store highlighted IDs in state for CSS class application
    state.setState({ highlightedEventIds: eventIds });
    // Navigate to first highlighted event
    const { events } = state.getState();
    const target = events.find(e => eventIds.includes(e.id));
    if (target) {
      this.navigateTo(target.startTime);
    }
    // Auto-clear highlight after 8 seconds
    setTimeout(() => {
      state.setState({ highlightedEventIds: [] });
      this.render();
    }, 8000);
  },

  /**
   * Update the toolbar heading and view switcher.
   */
  _updateToolbar() {
    const { currentView, currentDate } = state.getState();
    const label = document.getElementById('current-date-label');

    if (label) {
      switch (currentView) {
        case 'month':
          label.textContent = formatYearMonth(currentDate);
          break;
        case 'week': {
          const start = startOfWeek(currentDate);
          const end = new Date(start);
          end.setDate(end.getDate() + 6);
          label.textContent = `${start.getMonth() + 1}月${start.getDate()}日 - ${end.getMonth() + 1}月${end.getDate()}日`;
          break;
        }
        case 'day':
          label.textContent = `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月${currentDate.getDate()}日`;
          break;
      }
    }
  },

  _updateViewSwitcher(view) {
    document.querySelectorAll('#view-switcher button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
  },

  _handleDateClick(date) {
    // Emit event; app.js can use this for manual event creation
    state.emit('calendar:dateClick', date);
  },

  _handleEventClick(event) {
    state.emit('calendar:eventClick', event);
  },

  _handleSlotClick(date) {
    state.emit('calendar:slotClick', date);
  },
};

export default CalendarController;
