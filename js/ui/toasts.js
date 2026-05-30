/**
 * Toast Notification Manager
 * Manages toast notifications with undo support.
 */
import { CONFIG } from '../config.js';
import el from '../utils/dom.js';

let toastCounter = 0;

export const Toasts = {
  /**
   * Show a toast notification.
   * @param {string} message
   * @param {{ type?: string, duration?: number, hasUndo?: boolean, onUndo?: Function }} [options]
   * @returns {number} toast id
   */
  show(message, options = {}) {
    const {
      type = 'info',
      duration = CONFIG.TOAST_DURATION_MS,
      hasUndo = false,
      onUndo = null,
    } = options;

    const id = ++toastCounter;
    const container = document.getElementById('toast-container');
    if (!container) return id;

    const toast = el('div', { className: `toast toast-${type}`, dataset: { toastId: id } });

    toast.appendChild(el('span', { className: 'toast-message' }, message));

    if (hasUndo && onUndo) {
      const undoBtn = el('button', {
        className: 'toast-undo-btn',
        onClick: () => {
          if (onUndo) onUndo();
          dismiss(id);
        },
      }, '撤销');
      toast.appendChild(undoBtn);
    }

    const closeBtn = el('button', {
      className: 'toast-close',
      onClick: () => dismiss(id),
    }, '×');
    toast.appendChild(closeBtn);

    container.appendChild(toast);

    // Auto dismiss
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }

    return id;
  },

  /**
   * Dismiss a specific toast by id.
   * @param {number} id
   */
  dismiss(id) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = container.querySelector(`[data-toast-id="${id}"]`);
    if (toast) {
      toast.classList.add('hiding');
      setTimeout(() => {
        if (toast.parentNode) toast.remove();
      }, 300);
    }
  },

  /**
   * Clear all toasts.
   */
  clearAll() {
    const container = document.getElementById('toast-container');
    if (!container) return;
    container.innerHTML = '';
  },
};

function dismiss(id) {
  Toasts.dismiss(id);
}

export default Toasts;
