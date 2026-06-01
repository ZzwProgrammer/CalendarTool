/**
 * Application State Manager
 * Centralized pub/sub event emitter with state store.
 * All modules import this singleton to share state and events.
 */
class AppState {
  constructor() {
    this._state = {
      // Calendar
      currentView: 'month',
      currentDate: new Date(),
      events: [],

      // Voice
      recordingStatus: 'idle',     // 'idle' | 'listening' | 'processing'
      interimText: '',
      lastCommand: null,
      commandHistory: [],
      highlightedEventIds: [],

      // Correction
      activeCardResult: null,
      isCardVisible: false,
      cardMode: 'normal',          // 'normal' | 'edit' | 'multi-choice'

      // Settings (loaded from IndexedDB)
      settings: {
        llmEndpoint: 'https://api.deepseek.com/chat/completions',
        llmApiKey: '',
        llmModel: 'deepseek-chat',
        wakeWordEnabled: false,
        theme: 'light',
      },

      // System
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      storageMode: 'indexeddb',
      totalEvents: 0,
      capabilities: {
        speechSupported: true,
        ttsSupported: true,
        idbSupported: true,
      },
    };

    this._listeners = new Map();
    this._undoStack = [];
  }

  /**
   * @returns {Object} Shallow copy of current state.
   */
  getState() {
    return { ...this._state };
  }

  /**
   * Merge partial state and notify listeners.
   * @param {Object} partial
   */
  setState(partial) {
    let changed = false;
    for (const key of Object.keys(partial)) {
      if (this._state[key] !== partial[key]) {
        this._state[key] = partial[key];
        changed = true;
      }
    }
    if (changed) {
      this.emit('stateChange', this.getState());
    }
  }

  /**
   * Subscribe to an event.
   * @param {string} event
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);
    return () => {
      const set = this._listeners.get(event);
      if (set) set.delete(callback);
    };
  }

  /**
   * Subscribe to an event, fire once, then unsubscribe.
   * @param {string} event
   * @param {Function} callback
   */
  once(event, callback) {
    const wrapper = (payload) => {
      this.off(event, wrapper);
      callback(payload);
    };
    this.on(event, wrapper);
  }

  /**
   * Unsubscribe from an event.
   * @param {string} event
   * @param {Function} callback
   */
  off(event, callback) {
    const set = this._listeners.get(event);
    if (set) set.delete(callback);
  }

  /**
   * Emit an event to all subscribers.
   * @param {string} event
   * @param {*} payload
   */
  emit(event, payload) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      for (const cb of listeners) {
        try {
          cb(payload);
        } catch (err) {
          console.error(`[State] Error in listener for "${event}":`, err);
        }
      }
    }
  }

  /**
   * Push an undo entry.
   * @param {Object} entry - { execute, undo, description }
   */
  pushUndo(entry) {
    this._undoStack.push({
      ...entry,
      timestamp: Date.now(),
    });
    if (this._undoStack.length > 10) {
      this._undoStack.shift();
    }
  }

  /**
   * Pop the most recent undo entry.
   * @returns {Object|null}
   */
  popUndo() {
    return this._undoStack.pop() || null;
  }
}

// Singleton — imported by all modules
export const state = new AppState();
export default state;
