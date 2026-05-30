/**
 * Event Store — CRUD operations for calendar events
 */
import { put, get, getAll, del, count } from './db-core.js';
import uuid from '../utils/uuid.js';

const STORE = 'events';

export const EventStore = {
  /**
   * Add a new event.
   * @param {Object} eventData
   * @returns {Promise<Object>} The saved event with assigned id
   */
  async add(eventData) {
    const event = {
      id: eventData.id || uuid(),
      title: eventData.title || '',
      startTime: eventData.startTime || new Date(),
      endTime: eventData.endTime || new Date(eventData.startTime.getTime() + 60 * 60 * 1000),
      allDay: eventData.allDay || false,
      location: eventData.location || '',
      notes: eventData.notes || '',
      source: eventData.source || 'voice',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store as ISO string for IndexedDB compatibility
    const stored = {
      ...event,
      startTime: event.startTime.toISOString(),
      endTime: event.endTime.toISOString(),
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    };

    await put(STORE, stored);
    return event;
  },

  /**
   * Update an existing event.
   * @param {string} id
   * @param {Object} changes
   * @returns {Promise<Object>} Updated event
   */
  async update(id, changes) {
    const existing = await this.getById(id);
    if (!existing) throw new Error(`Event not found: ${id}`);

    const updated = {
      ...existing,
      ...changes,
      id,
      updatedAt: new Date(),
    };

    const stored = {
      ...updated,
      startTime: updated.startTime instanceof Date ? updated.startTime.toISOString() : updated.startTime,
      endTime: updated.endTime instanceof Date ? updated.endTime.toISOString() : updated.endTime,
      createdAt: updated.createdAt instanceof Date ? updated.createdAt.toISOString() : updated.createdAt,
      updatedAt: updated.updatedAt.toISOString(),
    };

    await put(STORE, stored);
    return updated;
  },

  /**
   * Delete an event by id.
   * @param {string} id
   */
  async remove(id) {
    await del(STORE, id);
  },

  /**
   * Get an event by id.
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async getById(id) {
    const stored = await get(STORE, id);
    return stored ? deserializeEvent(stored) : null;
  },

  /**
   * Query events within a date range and optional keyword.
   * @param {{ startDate?: Date, endDate?: Date, keyword?: string }} options
   * @returns {Promise<Object[]>}
   */
  async query({ startDate, endDate, keyword } = {}) {
    const all = await this.getAll();
    let filtered = all;

    if (startDate && endDate) {
      const start = startDate instanceof Date ? startDate.getTime() : new Date(startDate).getTime();
      const end = endDate instanceof Date ? endDate.getTime() : new Date(endDate).getTime();
      filtered = filtered.filter(e => {
        const eventStart = e.startTime.getTime();
        const eventEnd = e.endTime.getTime();
        return eventStart <= end && eventEnd >= start;
      });
    }

    if (keyword) {
      const lower = keyword.toLowerCase();
      filtered = filtered.filter(e =>
        e.title.toLowerCase().includes(lower)
      );
    }

    return filtered.sort((a, b) => a.startTime - b.startTime);
  },

  /**
   * Search events by title with fuzzy intent (for delete operations).
   * @param {string} keyword - Title keyword to search
   * @param {{ startDate?: Date, endDate?: Date }} dateRange
   * @returns {Promise<Object[]>}
   */
  async searchByTitle(keyword, { startDate, endDate } = {}) {
    if (!keyword) return [];
    return this.query({ startDate, endDate, keyword });
  },

  /**
   * Get all events.
   * @returns {Promise<Object[]>}
   */
  async getAll() {
    const stored = await getAll(STORE);
    return stored.map(deserializeEvent).filter(Boolean)
      .sort((a, b) => a.startTime - b.startTime);
  },

  /**
   * Get total event count.
   * @returns {Promise<number>}
   */
  async getCount() {
    return count(STORE);
  },
};

/**
 * Deserialize ISO date strings back to Date objects.
 */
function deserializeEvent(stored) {
  if (!stored) return null;
  return {
    ...stored,
    startTime: new Date(stored.startTime),
    endTime: new Date(stored.endTime),
    createdAt: new Date(stored.createdAt),
    updatedAt: new Date(stored.updatedAt),
  };
}

export default EventStore;
