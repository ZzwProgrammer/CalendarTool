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
   */
  showMultiChoice(matches, callback) {
    if (!container) return;

    currentMode = 'multi-choice';
    multiChoiceCallback = callback;
    state.setState({ isCardVisible: true, cardMode: 'multi-choice' });

    const card = el('div', { className: 'card card-multi-choice' });

    card.appendChild(el('div', { className: 'card-header' },
      el('span', { className: 'card-badge badge-intent-delete' }, '删除 — 请选择')));

    const body = el('div', { className: 'card-body' });
    body.appendChild(el('p', { style: 'font-size:14px;margin-bottom:8px;' },
      `找到 ${matches.length} 个匹配的事件，请选择要删除的事件：`));

    const list = el('div', { className: 'choice-list' });
    matches.forEach((event, idx) => {
      const timeStr = `${String(event.startTime.getHours()).padStart(2, '0')}:${String(event.startTime.getMinutes()).padStart(2, '0')}`;
      const item = el('div', {
        className: 'choice-item',
        onClick: () => {
          if (multiChoiceCallback) {
            multiChoiceCallback(event);
          }
          ConfirmationCard.hide();
        },
      }, [
        el('input', { type: 'radio', name: 'delete-choice', value: event.id }),
        el('span', {}, `${timeStr} - ${event.title}`),
      ]);
      list.appendChild(item);
    });
    body.appendChild(list);
    card.appendChild(body);

    card.appendChild(el('div', { className: 'card-footer' },
      el('button', {
        className: 'btn btn-cancel',
        onClick: () => ConfirmationCard.cancel(),
      }, '取消')));

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
