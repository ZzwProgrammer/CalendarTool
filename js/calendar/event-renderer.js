/**
 * Event Renderer — Shared popover/click handling for calendar events
 */
import el from '../utils/dom.js';
import { formatSpokenTime } from '../utils/date-utils.js';
import state from '../state.js';
import { EventStore } from '../storage/event-store.js';

let activePopover = null;

/**
 * Show an event detail popover.
 * @param {Object} event
 * @param {MouseEvent} anchorEvent
 */
export function showEventPopover(event, anchorEvent) {
  removePopover();

  const popover = el('div', { className: 'event-popover' });
  popover.appendChild(el('div', { className: 'popover-title' }, event.title));

  const timeStr = `${formatSpokenTime(event.startTime)} 至 ${formatSpokenTime(event.endTime)}`;
  popover.appendChild(el('div', { className: 'popover-time' }, timeStr));

  if (event.location) {
    popover.appendChild(el('div', { style: 'font-size:13px;color:var(--color-text-secondary);' },
      `📍 ${event.location}`));
  }

  if (event.source === 'voice') {
    popover.appendChild(el('div', { style: 'font-size:11px;color:var(--color-text-muted);margin-top:4px;' },
      '通过语音添加'));
  }

  const actions = el('div', { className: 'popover-actions' });
  actions.appendChild(el('button', {
    onClick: () => {
      removePopover();
      state.emit('calendar:eventEdit', event);
    },
  }, '编辑'));

  actions.appendChild(el('button', {
    className: 'btn-delete',
    onClick: async () => {
      if (confirm(`确定要删除事件"${event.title}"吗？`)) {
        await EventStore.remove(event.id);
        state.emit('events:changed', 'removed', event);
        removePopover();
      }
    },
  }, '删除'));

  popover.appendChild(actions);
  activePopover = popover;

  document.body.appendChild(popover);

  // Position near anchor
  const rect = anchorEvent.target.getBoundingClientRect();
  const left = Math.min(rect.left, window.innerWidth - 320);
  const top = Math.min(rect.bottom + 4, window.innerHeight - 200);

  popover.style.position = 'fixed';
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', outsideHandler);
  }, 0);

  function outsideHandler(e) {
    if (!popover.contains(e.target)) {
      removePopover();
    }
  }
}

export function removePopover() {
  if (activePopover) {
    activePopover.remove();
    activePopover = null;
    document.removeEventListener('click', removePopover);
  }
}

export default { showEventPopover, removePopover };
