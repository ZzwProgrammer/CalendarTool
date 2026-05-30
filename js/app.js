/**
 * Application Entry Point
 * Bootstraps all modules, wires events, and coordinates top-level flow.
 */
import { CONFIG } from './config.js';
import state from './state.js';
import { open as openDB } from './storage/db-core.js';
import { EventStore } from './storage/event-store.js';
import { SettingsStore } from './storage/settings-store.js';
import { CalendarController } from './calendar/calendar-controller.js';
import { showEventPopover, removePopover } from './calendar/event-renderer.js';
import { createRecognizer } from './speech/recognition.js';
import { TTS } from './speech/synthesis.js';
import { Toasts } from './ui/toasts.js';
import { VoiceIndicator } from './ui/voice-indicator.js';
import { ConfirmationCard } from './ui/confirmation-card.js';
import { SettingsPanel } from './ui/settings-panel.js';
import { formatSpokenDateTime } from './utils/date-utils.js';
import { classifyIntent } from './nlp/intent.js';
import { parseTime } from './nlp/time-parser.js';
import { extractTitle } from './nlp/title-extractor.js';
import { runCorrectionPipeline } from './nlp/correction/pipeline.js';

// ---- Module instances ----
let recognizer = null;
let confirmRecognizer = null;
let undoDataForCurrentAction = null;

// ---- Bootstrap ----
async function init() {
  console.log('[App] Initializing Voice Calendar...');

  // 1. Detect capabilities
  detectCapabilities();

  // 2. Open database
  try {
    await openDB();
  } catch (err) {
    console.error('[App] Database open failed:', err);
    Toasts.show('数据存储初始化失败，部分功能可能不可用', { type: 'error' });
  }

  // 3. Load settings
  const savedSettings = await SettingsStore.loadAll();
  state.setState({ settings: savedSettings });

  // 4. Apply theme
  applyTheme(savedSettings.theme);

  // 5. Load events
  const events = await EventStore.getAll();
  state.setState({ events, totalEvents: events.length });
  updateStatusBar();

  // 6. Initialize calendar
  CalendarController.init(document.getElementById('calendar-container'));

  // 7. Initialize UI components
  VoiceIndicator.init();
  ConfirmationCard.init();
  SettingsPanel.init();

  // 8. Setup speech recognition
  if (state.getState().capabilities.speechSupported) {
    setupRecognizer();
  } else {
    showTextFallback();
  }

  // 9. Setup TTS fallback
  if (!TTS.isSupported()) {
    console.warn('[App] TTS not supported');
  }

  // 10. Wire event listeners
  wireEventListeners();

  console.log('[App] Initialization complete.');
  Toasts.show('语音日历就绪，点击麦克风开始', { type: 'info', duration: 2000 });
}

// ---- Capability Detection ----
function detectCapabilities() {
  const speechSupported = !!(
    window.SpeechRecognition || window.webkitSpeechRecognition
  );
  const ttsSupported = !!window.speechSynthesis;
  const idbSupported = !!window.indexedDB;

  state.setState({
    capabilities: { speechSupported, ttsSupported, idbSupported },
    storageMode: idbSupported ? 'indexeddb' : 'localstorage',
  });

  if (!idbSupported) {
    state.setState({ storageMode: 'localstorage' });
    setTimeout(() => {
      Toasts.show('浏览器不支持 IndexedDB，使用本地存储', { type: 'warning' });
    }, 500);
  }
}

// ---- Speech Recognition Setup ----
function setupRecognizer() {
  recognizer = createRecognizer({
    lang: CONFIG.SPEECH_LANG,
    onResult: handleVoiceResult,
    onError: handleVoiceError,
    onStatusChange: (status) => {
      state.setState({ recordingStatus: status });
      VoiceIndicator.setStatus(status);
    },
  });
}

// ---- Voice Result Handler (Core Pipeline Entry Point) ----
async function handleVoiceResult({ text, isFinal }) {
  if (!isFinal) {
    VoiceIndicator.setInterimText(text);
    return;
  }

  VoiceIndicator.setStatus('processing');
  state.setState({ interimText: '' });

  try {
    // Run the full correction pipeline
    const result = await runCorrectionPipeline(text);

    if (!result || result.final.intent === 'unknown') {
      TTS.speak('抱歉，我没有理解您的意图，请再说一次');
      VoiceIndicator.setStatus('idle');
      Toasts.show('无法识别意图，请重新输入', { type: 'warning' });
      addToHistory(text, 'unknown', false);
      return;
    }

    state.setState({ lastCommand: result });

    // Layer 3: Route based on confidence
    const { confidence, action, suspectFields } = result.final;

    if (action === 'auto-execute') {
      // High confidence: execute immediately with undo
      await executeIntent(result.final);
      const undoEntry = {
        execute: async () => { /* already executed */ },
        undo: async () => {
          if (undoDataForCurrentAction) {
            await undoDataForCurrentAction.undo();
          }
        },
        description: `${result.final.intent}: ${result.final.title}`,
      };
      state.pushUndo(undoEntry);
      Toasts.show(
        `已执行：${result.final.title || result.final.intent}`,
        { type: 'success', hasUndo: true, onUndo: undoEntry.undo }
      );
      addToHistory(text, result.final.intent, true);
      VoiceIndicator.setStatus('idle');

    } else {
      // Show confirmation card
      ConfirmationCard.show(result);
      addToHistory(text, result.final.intent, false);

      // If voice confirmation is enabled, start listening for confirm/cancel
      if (state.getState().capabilities.speechSupported) {
        startConfirmationListening();
      }
    }

  } catch (err) {
    console.error('[App] Pipeline error:', err);
    TTS.speak('处理语音时出现错误，请重试');
    VoiceIndicator.setStatus('idle');
    Toasts.show(`处理错误: ${err.message}`, { type: 'error' });
  }
}

// ---- Voice Error Handler ----
function handleVoiceError({ code, message }) {
  VoiceIndicator.setStatus('idle');
  state.setState({ recordingStatus: 'idle' });

  switch (code) {
    case 'not-allowed':
      Toasts.show('麦克风权限被拒绝，请在浏览器设置中允许麦克风权限', { type: 'error' });
      break;
    case 'no-speech':
      Toasts.show('没有检测到语音，请重试', { type: 'warning' });
      break;
    case 'network':
      Toasts.show('语音识别需要网络连接', { type: 'warning' });
      break;
    default:
      console.error('[App] Voice error:', code, message);
  }
}

// ---- Intent Execution ----
async function executeIntent(finalResult) {
  const { intent, datetime, endDatetime, title, originalDatetime, correctedText } = finalResult;

  switch (intent) {
    case 'add': {
      const event = {
        title: title || '未命名事件',
        startTime: datetime || new Date(),
        endTime: endDatetime || new Date((datetime || new Date()).getTime() + CONFIG.DEFAULT_EVENT_DURATION_MINUTES * 60 * 1000),
        source: 'voice',
      };
      await EventStore.add(event);

      const events = await EventStore.getAll();
      state.setState({ events, totalEvents: events.length });
      state.emit('events:changed', 'added', event);
      CalendarController.refresh();
      updateStatusBar();

      TTS.speak(`已添加${event.title}，时间${formatSpokenDateTime(event.startTime)}`);

      undoDataForCurrentAction = {
        undo: async () => {
          await EventStore.remove(event.id);
          const evts = await EventStore.getAll();
          state.setState({ events: evts, totalEvents: evts.length });
          state.emit('events:changed', 'removed', event);
          CalendarController.refresh();
          updateStatusBar();
          TTS.speak('已撤销添加操作');
        },
      };
      break;
    }

    case 'delete': {
      const matches = await EventStore.searchByTitle(title, {
        startDate: new Date(datetime.getFullYear(), datetime.getMonth(), datetime.getDate(), 0, 0, 0),
        endDate: new Date(datetime.getFullYear(), datetime.getMonth(), datetime.getDate(), 23, 59, 59),
      });

      if (matches.length === 0) {
        TTS.speak(`${datetime.getMonth() + 1}月${datetime.getDate()}日没有找到名为"${title}"的事件`);
        Toasts.show('未找到匹配的事件', { type: 'warning' });
      } else if (matches.length === 1) {
        await EventStore.remove(matches[0].id);
        const events = await EventStore.getAll();
        state.setState({ events, totalEvents: events.length });
        state.emit('events:changed', 'removed', matches[0]);
        CalendarController.refresh();
        updateStatusBar();
        TTS.speak(`已删除${matches[0].title}`);
        undoDataForCurrentAction = {
          undo: async () => {
            await EventStore.add(matches[0]);
            const evts = await EventStore.getAll();
            state.setState({ events: evts, totalEvents: evts.length });
            state.emit('events:changed', 'added', matches[0]);
            CalendarController.refresh();
            updateStatusBar();
            TTS.speak('已撤销删除操作');
          },
        };
      } else {
        // Multiple matches — show choice card
        ConfirmationCard.showMultiChoice(matches, async (selected) => {
          await EventStore.remove(selected.id);
          const events = await EventStore.getAll();
          state.setState({ events, totalEvents: events.length });
          state.emit('events:changed', 'removed', selected);
          CalendarController.refresh();
          updateStatusBar();
          TTS.speak(`已删除${selected.title}`);
        });
        TTS.speak(`找到${matches.length}个匹配事件，请选择要删除的事件`);
      }
      break;
    }

    case 'view': {
      const viewStart = new Date(datetime.getFullYear(), datetime.getMonth(), datetime.getDate(), 0, 0, 0);
      const viewEnd = new Date(datetime.getFullYear(), datetime.getMonth(), datetime.getDate(), 23, 59, 59);
      const viewEvents = await EventStore.query({ startDate: viewStart, endDate: viewEnd });

      if (viewEvents.length === 0) {
        TTS.speak(`${datetime.getMonth() + 1}月${datetime.getDate()}日没有安排`);
        Toasts.show('当日无安排', { type: 'info' });
      } else {
        const list = viewEvents.map(e =>
          `${formatSpokenDateTime(e.startTime)}${e.title}`
        ).join('，');
        TTS.speak(`${datetime.getMonth() + 1}月${datetime.getDate()}日共有${viewEvents.length}个事件：${list}`);
        CalendarController.highlightEvents(viewEvents.map(e => e.id));
        Toasts.show(`找到${viewEvents.length}个事件`, { type: 'info' });
      }
      break;
    }

    case 'reschedule': {
      // Find matching event and update time
      const rescheduleMatches = await EventStore.searchByTitle(title, {
        startDate: originalDatetime ? new Date(originalDatetime.getFullYear(), originalDatetime.getMonth(), originalDatetime.getDate(), 0, 0, 0) : undefined,
        endDate: originalDatetime ? new Date(originalDatetime.getFullYear(), originalDatetime.getMonth(), originalDatetime.getDate(), 23, 59, 59) : undefined,
      });

      if (rescheduleMatches.length === 0) {
        TTS.speak(`没有找到名为"${title}"的事件`);
      } else if (rescheduleMatches.length === 1) {
        const updated = await EventStore.update(rescheduleMatches[0].id, {
          startTime: datetime,
          endTime: endDatetime || new Date(datetime.getTime() + 60 * 60 * 1000),
        });
        const events = await EventStore.getAll();
        state.setState({ events, totalEvents: events.length });
        state.emit('events:changed', 'updated', updated);
        CalendarController.refresh();
        updateStatusBar();
        TTS.speak(`已将${title}改为${formatSpokenDateTime(datetime)}`);
      }
      break;
    }

    default:
      TTS.speak('抱歉，我没有理解您的意图，请再说一次');
  }
}

// ---- Voice Confirmation (second-stage voice) ----
function startConfirmationListening() {
  if (confirmRecognizer) return;

  confirmRecognizer = createRecognizer({
    lang: CONFIG.SPEECH_LANG,
    continuous: false,
    onResult: async ({ text, isFinal }) => {
      if (!isFinal) return;
      const trimmed = text.trim();

      if (/确认|确定|好的|行|可以|没问题/.test(trimmed)) {
        await ConfirmationCard.confirm();
        stopConfirmationListening();
      } else if (/取消|算了|不要|不用/.test(trimmed)) {
        ConfirmationCard.cancel();
        stopConfirmationListening();
      } else if (/修改|改一下|不对|编辑/.test(trimmed)) {
        ConfirmationCard.enterEditMode();
        TTS.speak('请修改后再确认');
      }
    },
    onError: () => {
      // Silently handle during confirmation
    },
  });

  // Start after a short delay
  setTimeout(() => {
    if (state.getState().isCardVisible && confirmRecognizer) {
      confirmRecognizer.start();
    }
  }, 500);
}

function stopConfirmationListening() {
  if (confirmRecognizer) {
    confirmRecognizer.stop();
    confirmRecognizer = null;
  }
}

// Show text input fallback for browsers without speech support
function showTextFallback() {
  const fallback = document.getElementById('text-fallback');
  if (!fallback) return;

  fallback.classList.remove('hidden');
  const input = document.getElementById('text-input');
  if (!input) return;

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      handleVoiceResult({ text: input.value.trim(), isFinal: true });
      input.value = '';
    }
  });

  Toasts.show('浏览器不支持语音识别，请使用文本输入', { type: 'warning', duration: 5000 });
}

// ---- Theme ----
function applyTheme(theme) {
  const darkToggle = document.getElementById('setting-dark-theme');
  if (theme === 'dark') {
    document.body.classList.remove('theme-light');
    document.body.classList.add('theme-dark');
    if (darkToggle) darkToggle.checked = true;
  } else {
    document.body.classList.add('theme-light');
    document.body.classList.remove('theme-dark');
    if (darkToggle) darkToggle.checked = false;
  }
}

// ---- History ----
function addToHistory(originalText, intent, autoExecuted) {
  const stateObj = state.getState();
  const history = stateObj.commandHistory || [];
  const entry = {
    originalText,
    intent,
    autoExecuted,
    timestamp: new Date(),
    id: Date.now(),
  };

  history.unshift(entry);
  if (history.length > CONFIG.MAX_HISTORY_ITEMS) {
    history.pop();
  }

  state.setState({ commandHistory: history });
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById('history-list');
  if (!list) return;

  const { commandHistory } = state.getState();
  if (!commandHistory || commandHistory.length === 0) {
    list.innerHTML = '<div style="color:var(--color-text-muted);font-size:var(--font-size-sm);text-align:center;padding:var(--space-md);">暂无操作记录</div>';
    return;
  }

  const icons = { add: '➕', delete: '🗑️', view: '👁️', reschedule: '🔄', unknown: '❓' };
  const texts = { add: '添加', delete: '删除', view: '查看', reschedule: '修改', unknown: '未知' };

  list.innerHTML = '';
  for (const entry of commandHistory) {
    const item = document.createElement('div');
    item.className = 'history-item';
    const time = new Date(entry.timestamp);
    const timeStr = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
    item.innerHTML = `
      <span class="history-icon">${icons[entry.intent] || '❓'}</span>
      <span class="history-text">${entry.originalText}</span>
      <span class="history-time">${timeStr}</span>
    `;
    list.appendChild(item);
  }
}

// ---- Status Bar ----
function updateStatusBar() {
  const { totalEvents } = state.getState();
  const el = document.getElementById('event-count');
  if (el) el.textContent = `共 ${totalEvents} 个事件`;
}

// ---- Wire All Event Listeners ----
function wireEventListeners() {
  // Mic button
  document.getElementById('mic-btn').addEventListener('click', toggleMic);

  // Calendar navigation
  document.getElementById('nav-prev').addEventListener('click', () => CalendarController.navigatePrev());
  document.getElementById('nav-next').addEventListener('click', () => CalendarController.navigateNext());
  document.getElementById('nav-today').addEventListener('click', () => CalendarController.navigateToday());

  // View switcher
  document.querySelectorAll('#view-switcher button').forEach(btn => {
    btn.addEventListener('click', () => {
      CalendarController.switchView(btn.dataset.view);
    });
  });

  // Theme toggle
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

  // Settings toggle
  document.getElementById('settings-toggle').addEventListener('click', () => {
    SettingsPanel.show();
  });

  // Calendar events
  state.on('events:changed', (action, event) => {
    CalendarController.refresh();
    updateStatusBar();
  });

  state.on('calendar:eventClick', (event) => {
    showEventPopover(event, window.event || { target: document.body });
  });

  state.on('calendar:dateClick', (date) => {
    // Manual event creation flow
    const title = prompt(`为 ${date.getMonth() + 1}月${date.getDate()}日 添加事件：\n请输入事件名称：`);
    if (title && title.trim()) {
      const hour = prompt('请输入时间（0-23时）：', '9');
      if (hour !== null) {
        const startTime = new Date(date);
        startTime.setHours(parseInt(hour) || 9, 0, 0, 0);
        EventStore.add({
          title: title.trim(),
          startTime,
          source: 'manual',
        }).then(async () => {
          const events = await EventStore.getAll();
          state.setState({ events, totalEvents: events.length });
          state.emit('events:changed', 'added');
          Toasts.show(`已手动添加事件：${title.trim()}`, { type: 'success' });
        });
      }
    }
  });

  state.on('calendar:eventEdit', (event) => {
    const title = prompt('编辑事件名称：', event.title);
    if (title && title.trim()) {
      EventStore.update(event.id, { title: title.trim() }).then(async () => {
        const events = await EventStore.getAll();
        state.setState({ events, totalEvents: events.length });
        state.emit('events:changed', 'updated');
        Toasts.show('事件已更新', { type: 'success' });
      });
    }
  });

  // Keyboard shortcut
  document.addEventListener('keydown', (e) => {
    if (e.key === ' ' && e.ctrlKey) {
      e.preventDefault();
      toggleMic();
    }
  });

  // Online/offline detection
  window.addEventListener('online', () => {
    state.setState({ isOnline: true });
    Toasts.show('网络已连接', { type: 'success', duration: 2000 });
  });
  window.addEventListener('offline', () => {
    state.setState({ isOnline: false });
    Toasts.show('网络已断开，离线功能仍可用', { type: 'warning' });
  });
}

// ---- Mic Toggle ----
function toggleMic() {
  if (!recognizer) return;

  const status = state.getState().recordingStatus;
  if (status === 'idle') {
    recognizer.start();
  } else if (status === 'listening' || status === 'processing') {
    recognizer.stop();
  }
}

// ---- Theme Toggle ----
function toggleTheme() {
  const current = state.getState().settings.theme;
  const newTheme = current === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
  state.setState({ settings: { ...state.getState().settings, theme: newTheme } });
  SettingsStore.set('theme', newTheme);
}

// ---- Export for Settings Panel ----
export { applyTheme, executeIntent };

// ---- Start ----
document.addEventListener('DOMContentLoaded', init);
