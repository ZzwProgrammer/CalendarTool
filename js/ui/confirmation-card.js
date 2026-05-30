/**
 * Confirmation Card UI
 * Renders the Layer-3 confirmation card with editable fields.
 * Supports three modes: normal, highlight (low confidence), and multi-choice.
 */
import el from '../utils/dom.js';
import state from '../state.js';
import { Toasts } from './toasts.js';
import { TTS } from '../speech/synthesis.js';
import { formatISOLocal } from '../utils/date-utils.js';
import { EventStore } from '../storage/event-store.js';
import { KnowledgeBase } from '../nlp/correction/knowledge-base.js';

let container = null;
let currentResult = null;
let currentMode = 'normal'; // 'normal' | 'highlight' | 'multi-choice'
let onConfirmCallback = null;
let onCancelCallback = null;
let multiChoiceCallback = null;
let currentTitleInput = null;   // Direct reference to title input
let currentTimeInput = null;    // Direct reference to time input

export const ConfirmationCard = {
  init() {
    container = document.getElementById('confirmation-card-container');
  },

  /**
   * Show the confirmation card for a correction result.
   * @param {Object} result - The full pipeline CorrectionResult
   */
  show(result) {
    if (!container) return;

    currentResult = result;
    const { final } = result;
    const confidence = final.confidence;
    const suspectFields = final.suspectFields || [];

    currentMode = final.action === 'show-card-highlight' ? 'highlight' : 'normal';
    state.setState({ isCardVisible: true, cardMode: currentMode });

    const intentLabels = { add: '添加', delete: '删除', view: '查看', reschedule: '修改', unknown: '未知' };
    const intentLabel = intentLabels[final.intent] || '未知';
    const intentBadgeClass = `badge-intent-${final.intent || 'unknown'}`;

    // Confidence bar styling
    let confClass = 'low';
    if (confidence >= 0.9) confClass = 'high';
    else if (confidence >= 0.6) confClass = 'medium';

    const correctionTags = (result.layer1 && result.layer1.corrections)
      ? result.layer1.corrections.map(c => {
          const tagClass = c.source === 'homophone' ? 'tag-homophone'
            : c.source === 'knowledge' ? 'tag-knowledge' : 'tag-llm';
          return { text: `${c.original}→${c.corrected}`, className: tagClass };
        }) : [];

    // Build card DOM
    const card = el('div', {
      className: 'card',
      dataset: { confidence: Math.round(confidence * 100) },
    });

    // Header
    card.appendChild(el('div', { className: 'card-header' }, [
      el('span', { className: `card-badge ${intentBadgeClass}` }, intentLabel),
      el('div', { className: 'card-confidence' }, [
        el('div', { className: 'confidence-bar' },
          el('div', {
            className: `confidence-fill ${confClass}`,
            style: { width: `${Math.round(confidence * 100)}%` },
          })
        ),
        el('span', { className: 'confidence-text' }, `${Math.round(confidence * 100)}%`),
      ]),
    ]));

    // Body
    const body = el('div', { className: 'card-body' });

    // Original text
    body.appendChild(el('div', { className: 'card-field' }, [
      el('label', {}, '原始识别'),
      el('p', { className: 'original-text' }, result.originalText || ''),
    ]));

    // Corrected text
    body.appendChild(el('div', { className: 'card-field' }, [
      el('label', {}, '纠正后文本'),
      el('p', { className: 'corrected-text' }, final.correctedText || ''),
    ]));

    // Title field (editable)
    const isTitleSuspect = suspectFields.includes('title');
    currentTitleInput = el('input', {
        type: 'text',
        className: `editable-field${isTitleSuspect ? ' field-suspect' : ''}`,
        value: final.title || '',
        placeholder: '事件名称',
      });
    body.appendChild(el('div', { className: 'card-field', dataset: { field: 'title' } }, [
      el('label', {}, '事件标题'),
      currentTitleInput,
      isTitleSuspect ? el('span', { className: 'field-warning' }, '⚠️ 标题识别可能不准确，请核对') : null,
    ]));

    // Datetime field (editable)
    const isTimeSuspect = suspectFields.includes('datetime');
    const timeValue = final.datetime ? formatISOLocal(final.datetime) : '';
    currentTimeInput = el('input', {
        type: 'datetime-local',
        className: `editable-field${isTimeSuspect ? ' field-suspect' : ''}`,
        value: timeValue,
      });
    body.appendChild(el('div', { className: 'card-field', dataset: { field: 'datetime' } }, [
      el('label', {}, '时间'),
      currentTimeInput,
      isTimeSuspect ? el('span', { className: 'field-warning' }, '⚠️ 时间识别可能不准确，请核对') : null,
    ]));

    // Correction tags
    if (correctionTags.length > 0) {
      body.appendChild(el('div', { className: 'card-corrections' }, [
        el('label', {}, `自动纠正 (${correctionTags.length})`),
        el('div', { className: 'correction-tags' },
          correctionTags.map(t => el('span', { className: `tag ${t.className}` }, t.text))
        ),
      ]));
    }

    // Layer 2 note
    if (result.layer2 && result.layer2.triggered && result.layer2.correctionNote) {
      body.appendChild(el('div', { style: 'font-size:11px;color:var(--color-text-muted);margin-top:4px;' },
        `🤖 LLM: ${result.layer2.correctionNote}`));
    }

    card.appendChild(body);

    // Footer
    const footer = el('div', { className: 'card-footer' });
    footer.appendChild(el('button', {
      className: 'btn btn-cancel',
      onClick: () => ConfirmationCard.cancel(),
    }, '取消'));

    footer.appendChild(el('button', {
      className: 'btn btn-edit',
      onClick: () => ConfirmationCard.enterEditMode(),
    }, '手动修改'));

    footer.appendChild(el('button', {
      className: 'btn btn-confirm',
      onClick: () => ConfirmationCard.confirm(),
    }, '确认 ✓'));
    card.appendChild(footer);

    container.innerHTML = '';
    container.appendChild(card);

    // Scroll card into view
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  /**
   * Show multi-choice card for delete operations with multiple matches.
   * Supports multi-select checkboxes + "delete all" shortcut.
   */
  showMultiChoice(matches, callback) {
    if (!container) return;

    currentMode = 'multi-choice';
    multiChoiceCallback = callback;
    state.setState({ isCardVisible: true, cardMode: 'multi-choice' });

    const updateCount = () => {
      const cbs = card.querySelectorAll('.choice-checkbox:checked');
      const el = card.querySelector('#selected-count');
      if (el) el.textContent = `已选 ${cbs.length} 个`;
    };

    const card = el('div', { className: 'card card-multi-choice' });

    card.appendChild(el('div', { className: 'card-header' },
      el('span', { className: 'card-badge badge-intent-delete' }, `删除 — ${matches.length} 个事件`)));

    const body = el('div', { className: 'card-body' });
    body.appendChild(el('p', { style: 'font-size:14px;margin-bottom:4px;' },
      '勾选要删除的事件，或点击下方按钮全部删除：'));

    // Select all / deselect all row
    const selectRow = el('div', { style: 'display:flex;gap:8px;margin-bottom:8px;' });
    const selectAllBtn = el('button', {
      style: 'font-size:11px;padding:2px 8px;border:1px solid var(--color-border);border-radius:4px;background:var(--color-surface);cursor:pointer;',
      onClick: () => {
        const cbs = card.querySelectorAll('.choice-checkbox');
        const allChecked = Array.from(cbs).every(cb => cb.checked);
        cbs.forEach(cb => { cb.checked = !allChecked; });
        updateCount();
      },
    }, '全选/取消');
    selectRow.appendChild(selectAllBtn);
    body.appendChild(selectRow);

    const list = el('div', { className: 'choice-list' });
    matches.forEach((event, idx) => {
      const dateStr = `${event.startTime.getMonth() + 1}/${event.startTime.getDate()}`;
      const timeStr = `${String(event.startTime.getHours()).padStart(2, '0')}:${String(event.startTime.getMinutes()).padStart(2, '0')}`;
      const item = el('div', {
        className: 'choice-item',
        style: 'cursor:pointer;',
        onClick: (e) => {
          if (e.target.tagName !== 'INPUT') {
            const cb = item.querySelector('.choice-checkbox');
            cb.checked = !cb.checked;
            updateCount();
          }
        },
      }, [
        el('input', {
          type: 'checkbox',
          className: 'choice-checkbox',
          value: event.id,
          onClick: (e) => e.stopPropagation(),
          onChange: () => updateCount(),
        }),
        el('span', { style: 'flex:1;' }, event.title),
        el('span', { style: 'font-size:11px;color:var(--color-text-muted);' }, `${dateStr} ${timeStr}`),
      ]);
      // Store event data on the item for later retrieval
      item._eventData = event;
      list.appendChild(item);
    });
    body.appendChild(list);

    // Selected count display
    const countDisplay = el('span', {
      id: 'selected-count',
      style: 'font-size:12px;color:var(--color-text-secondary);',
    }, '已选 0 个');
    body.appendChild(countDisplay);
    card.appendChild(body);

    // Footer with cancel, delete selected, delete all buttons
    card.appendChild(el('div', { className: 'card-footer', style: 'gap:8px;flex-wrap:wrap;' },
      el('button', { className: 'btn btn-cancel', onClick: () => ConfirmationCard.cancel() }, '取消'),
      el('button', {
        className: 'btn btn-confirm',
        style: 'background:var(--color-danger);border-color:var(--color-danger);',
        onClick: async () => {
          const checkboxes = card.querySelectorAll('.choice-checkbox:checked');
          const selectedEvents = [];
          checkboxes.forEach(cb => {
            const item = cb.closest('.choice-item');
            if (item && item._eventData) selectedEvents.push(item._eventData);
          });
          if (selectedEvents.length === 0) {
            alert('请至少选择一个事件');
            return;
          }
          if (!confirm(`确定删除选中的 ${selectedEvents.length} 个事件吗？`)) return;
          for (const evt of selectedEvents) {
            await EventStore.remove(evt.id);
          }
          const events = await EventStore.getAll();
          state.setState({ events, totalEvents: events.length });
          state.emit('events:changed', 'removed');
          TTS.speak(`已删除${selectedEvents.length}个事件`);
          ConfirmationCard.hide();
        },
      }, '删除选中'),
      el('button', {
        className: 'btn',
        style: 'background:var(--color-danger);color:var(--color-white);border-color:var(--color-danger);',
        onClick: async () => {
          if (!confirm(`确定删除全部 ${matches.length} 个事件吗？此操作不可撤销！`)) return;
          for (const evt of matches) {
            await EventStore.remove(evt.id);
          }
          const events = await EventStore.getAll();
          state.setState({ events, totalEvents: events.length });
          state.emit('events:changed', 'removed');
          TTS.speak(`已删除全部${matches.length}个事件`);
          ConfirmationCard.hide();
        },
      }, '全部删除'),
    ));

    container.innerHTML = '';
    container.appendChild(card);
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  /**
   * Confirm the current card action.
   */
  async confirm() {
    if (currentMode === 'multi-choice') return;

    // Use direct element references (set during show())
    const titleInput = currentTitleInput;
    const timeInput = currentTimeInput;

    console.log('[Card] confirm() — titleInput:', titleInput ? titleInput.value : '(null)',
      '| timeInput:', timeInput ? timeInput.value : '(null)');
    console.log('[Card] currentResult.final.title:', currentResult?.final?.title);

    // Build finalResult from pipeline output — this is the SOURCE OF TRUTH
    const finalResult = { ...currentResult.final };

    // Only override from DOM inputs if they exist AND have content
    if (titleInput && titleInput.value && titleInput.value.trim()) {
      finalResult.title = titleInput.value.trim();
    }
    if (timeInput && timeInput.value) {
      finalResult.datetime = new Date(timeInput.value);
    }

    // Learn from any user edits
    if (currentResult.layer1 && currentResult.layer1.corrections) {
      for (const c of currentResult.layer1.corrections) {
        if ((titleInput && titleInput.value !== c.corrected) ||
            (currentResult.final.title !== finalResult.title)) {
          await KnowledgeBase.learn(
            c.original,
            c.corrected,
            c.category || 'custom'
          );
        }
      }
    }

    this.hide();

    // Execute the intent
    const { executeIntent } = await import('../app.js');
    await executeIntent(finalResult);

    TTS.speak('已确认');
    Toasts.show('操作已执行', { type: 'success' });
  },

  /**
   * Cancel the current card.
   */
  cancel() {
    this.hide();
    TTS.speak('已取消');
    state.setState({ recordingStatus: 'idle' });
  },

  /**
   * Enter edit mode (all fields become editable).
   */
  enterEditMode() {
    if (currentTitleInput) {
      currentTitleInput.focus();
      currentTitleInput.select();
    } else if (currentTimeInput) {
      currentTimeInput.focus();
    }
  },

  /**
   * Hide the confirmation card.
   */
  hide() {
    if (container) container.innerHTML = '';
    currentResult = null;
    currentMode = 'normal';
    multiChoiceCallback = null;
    currentTitleInput = null;
    currentTimeInput = null;
    state.setState({ isCardVisible: false, cardMode: 'normal' });
    // Notify app to stop voice confirmation listening
    state.emit('card:closed');
  },

  /**
   * Check if card is currently visible.
   * @returns {boolean}
   */
  isVisible() {
    return state.getState().isCardVisible;
  },
};

export default ConfirmationCard;
