/**
 * Undo Bar Manager
 * Provides undo functionality for auto-executed high-confidence actions.
 */
import state from '../state.js';
import { Toasts } from './toasts.js';
import { CONFIG } from '../config.js';

export const UndoBar = {
  /**
   * Show an undo toast for an action.
   * @param {string} description - What was done
   * @param {Function} undoFn - Async function to undo the action
   */
  show(description, undoFn) {
    Toasts.show(
      `已执行：${description}`,
      {
        type: 'success',
        duration: CONFIG.UNDO_DURATION_MS,
        hasUndo: true,
        onUndo: async () => {
          try {
            await undoFn();
            Toasts.show('已撤销', { type: 'info' });
          } catch (err) {
            console.error('[Undo] Failed:', err);
            Toasts.show('撤销失败', { type: 'error' });
          }
        },
      }
    );
  },

  /**
   * Consume (undo) the most recent undoable action.
   * @returns {Promise<boolean>} Whether an undo was performed
   */
  async undoLast() {
    const entry = state.popUndo();
    if (entry && entry.undo) {
      try {
        await entry.undo();
        return true;
      } catch (err) {
        console.error('[Undo] Error:', err);
        return false;
      }
    }
    return false;
  },
};

export default UndoBar;
