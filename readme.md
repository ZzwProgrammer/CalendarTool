# 语音日历工具 (Voice Calendar)

基于中文语音交互的纯前端日历管理工具。用户通过自然语言即可完成日程的添加、删除和查看，核心搭载三级分层语音纠错防御架构。

## 🎯 功能概览

| 功能 | 说明 |
|------|------|
| 🎤 **语音添加事件** | 说"添加明天下午三点的团队会议"即可创建日程 |
| 🗑️ **语音删除事件** | 说"删除明天的会议"，支持模糊匹配和多选确认 |
| 👁️ **语音查看事件** | 说"明天有什么安排"，系统朗读当日事件列表 |
| 📅 **日历视图** | 原生 JS 实现的月/周/日三种视图，可手动点击操作 |
| 🛡️ **三级纠错** | L1 本地音近词纠错 → L2 LLM 语义兜底 → L3 UI 确认卡片 |
| 🌙 **深色模式** | 支持浅色/深色主题切换 |
| 🔊 **唤醒词** | 可选"嘿日历"唤醒，连续监听（默认关闭） |

## 🚀 快速开始

### 运行方式

```bash
# 方式一：使用任意 HTTP 服务器（推荐）
npx live-server

# 方式二：Python 内置服务器
python -m http.server 8000

# 方式三：VS Code Live Server 插件
# 右键 index.html → "Open with Live Server"
```

> ⚠️ 直接双击打开 `index.html`（file:// 协议）会导致部分功能受限（fetch JSON 被 CORS 阻止）。

### 浏览器要求

- **Chrome 124+** / **Edge 124+** — 完全支持
- **Safari 17+** — 支持（需 WebKit 前缀）
- **Firefox 126+** — 不支持 SpeechRecognition，自动降级为文本输入

### 语音功能使用

1. 点击麦克风按钮 🎤
2. 浏览器弹出麦克风权限请求，点击"允许"
3. 用中文普通话说出命令（如"添加明天下午三点的团队会议"）
4. 系统自动识别、纠错、解析并执行
5. 根据置信度自动执行或弹出确认卡片

## 🏗️ 技术架构

```
用户语音 → SpeechRecognition (Web Speech API)
    → 纠错管道 (L1 本地 → L2 LLM → L3 UI确认)
    → 意图分类 + 时间解析 (chrono-node) + 标题提取
    → IndexedDB 存储 → 日历视图刷新 + TTS 语音反馈
```

### 技术选型

| 模块 | 技术 | 原因 |
|------|------|------|
| 语音识别 | Web Speech API | 浏览器原生，免费，实时 |
| 语音合成 | SpeechSynthesis API | 同上，朗读反馈 |
| 时间解析 | chrono-node (中文) | 成熟稳定，支持中文模糊时间 |
| 数据存储 | IndexedDB + LocalStorage 降级 | 浏览器内置，无需后端 |
| 日历视图 | 原生 HTML/CSS/JS | 无框架依赖，轻量 |
| LLM 纠错 | 可配置 API (默认 DeepSeek) | 按需调用，频率极低 |

## 📁 项目结构

```
CalendarTool/
├── index.html                   # 单页入口
├── css/                         # 12 个样式文件
│   ├── variables.css            # CSS 自定义属性
│   ├── themes.css               # 浅色/深色主题
│   ├── layout.css               # Grid 布局
│   ├── calendar.css             # 月视图样式
│   ├── week-view.css            # 周/日视图样式（含事件块）
│   ├── cards.css                # 确认卡片样式
│   └── responsive.css           # 响应式断点
├── js/
│   ├── app.js                   # 应用入口，模块组装
│   ├── config.js                # 全局可调常量
│   ├── state.js                 # 事件驱动状态管理器
│   ├── speech/                  # 语音模块
│   │   ├── recognition.js       # SpeechRecognition 封装
│   │   ├── synthesis.js         # SpeechSynthesis 封装
│   │   └── wake-word.js         # 唤醒词检测
│   ├── nlp/                     # 自然语言处理
│   │   ├── intent.js            # 意图分类（规则+编辑距离）
│   │   ├── time-parser.js       # 时间解析（chrono-node+正则兜底）
│   │   ├── title-extractor.js   # 标题提取
│   │   └── correction/          # ★ 三级纠错系统
│   │       ├── pipeline.js      # 纠错编排器
│   │       ├── layer1-local.js  # L1 本地纠错
│   │       ├── layer2-llm.js    # L2 LLM 语义兜底
│   │       ├── layer3-confirm.js# L3 置信度决策
│   │       ├── confidence.js    # 置信度计算
│   │       └── knowledge-base.js# 自适应知识库
│   ├── calendar/                # 日历视图
│   │   ├── calendar-controller.js
│   │   ├── month-view.js        # 月视图（6周×7列网格）
│   │   ├── week-view.js         # 周视图（时间轴+7列）
│   │   └── day-view.js          # 日视图（时间轴+单列）
│   ├── storage/                 # 数据持久化
│   │   ├── db-core.js           # IndexedDB 封装
│   │   └── storage-fallback.js  # LocalStorage 降级
│   ├── ui/                      # UI 组件
│   │   ├── confirmation-card.js # 确认卡片（3 种模式）
│   │   ├── settings-panel.js    # 设置面板
│   │   └── toasts.js            # Toast 通知
│   └── utils/                   # 工具函数
│       ├── levenshtein.js       # Levenshtein 编辑距离
│       └── date-utils.js        # 日期格式化
├── data/
│   └── homophone-table.json     # 100+ 条中文音近词纠错表
└── js/vendor/
    └── chrono.min.js            # chrono-node 浏览器 bundle
```

## 📦 第三方依赖

| 依赖 | 版本 | 用途 | 引入方式 |
|------|------|------|----------|
| [chrono-node](https://github.com/wanasit/chrono) | ^2.7 | 中文自然语言时间解析 | esbuild 打包为 `js/vendor/chrono.min.js`，`<script>` 标签引入 |

### 打包命令

```bash
npm install chrono-node
npx esbuild js/vendor/chrono-entry.js --bundle --format=iife --global-name=chrono --outfile=js/vendor/chrono.min.js
```

## ✨ 原创功能说明

以下为自主设计与实现的核心功能模块：

### 1. 三级分层语音纠错防御架构（核心创新）
- **L1 本地纠错**: 100+ 条手工整理的中文音近词映射表（`data/homophone-table.json`），按 `time > intent > common_word` 优先级、最长匹配优先策略替换；结合 Levenshtein 编辑距离进行意图关键词模糊匹配（`js/utils/levenshtein.js`）；自适应知识库从用户修正中持续学习（`js/nlp/correction/knowledge-base.js`）
- **L2 LLM 语义兜底**: 自定义 System Prompt 将 LLM 设定为"语音日历纠错引擎"角色，要求输出结构化 JSON，仅在 L1 置信度 < 0.5 时触发（`js/nlp/correction/layer2-llm.js`）
- **L3 UI 确认卡片**: 三级置信度分流策略（≥0.9 自动执行+撤销，0.6-0.9 卡片确认，<0.6 高亮可疑字段），支持语音二次确认（`js/ui/confirmation-card.js`）

### 2. 置信度机制
- 加权组合公式：`0.30×音近得分 + 0.30×编辑距离得分 + 0.40×chrono解析得分`
- 每个处理环节输出置信度，下游据此决策（`js/nlp/correction/confidence.js`）

### 3. 意图分类引擎（`js/nlp/intent.js`）
- 基于中文关键词规则 + Levenshtein 滑动窗口模糊匹配
- 支持 add/delete/view/reschedule 四种操作类型

### 4. 时间解析器（`js/nlp/time-parser.js`）
- chrono-node 中文解析 + 正则表达式兜底
- 处理中文特有表达（大后天、下周X、X点半、凌晨/中午）

### 5. 标题提取器（`js/nlp/title-extractor.js`）
- 多步骤清洗：移除意图词→时间短语→填充词→标点

### 6. 原生日历视图系统（`js/calendar/`）
- 月/周/日三种视图，纯原生 JS 实现
- 事件颜色编码、悬浮详情、点击交互

### 7. 状态管理（`js/state.js`）
- 自定义 EventEmitter 发布/订阅模式
- 撤销栈、命令历史管理

### 8. IndexedDB 存储层（`js/storage/`）
- Promise 化事务封装，索引优化查询
- LocalStorage 自动降级（Firefox 隐私模式等）

## 📊 当前功能清单

### ✅ 已完整实现

| 功能 | 说明 |
|------|------|
| 🎤 语音添加 | 支持日期+时间+标题自然语言解析，默认时长60分钟，支持撤销 |
| 🗑️ 语音删除 | 支持纯标题/标题+日期/日期+"全部"三种模式，模糊匹配+多选批量删除 |
| 👁️ 语音查看 | 日期范围查询，TTS语音播报 + 侧边栏详情卡片 + 日历高亮 |
| 🔄 语音修改 | 支持单项事件重调度（修改时间） |
| 📅 月/周/日视图 | 纯原生JS实现，含事件badge/悬浮popover/手动编辑删除 |
| 🛡️ L1本地纠错 | 150+条音近词映射表 + Levenshtein编辑距离 + chrono预清洗 |
| 🧠 L2 LLM兜底 | DeepSeek API可配置，自定义SystemPrompt，JSON结构化输出 |
| 🃏 L3确认卡片 | 三级置信度分流（自动执行/卡片确认/高亮标注）+ 可编辑字段 |
| 📚 自适应知识库 | 用户修正→自动学习，IndexedDB持久化，LRU淘汰（500条上限） |
| 🌙 深色模式 | CSS变量切换，持久化 |
| ⚙️ 设置面板 | LLM端点/Key/模型配置，唤醒词开关，主题切换，数据清除 |
| ↩️ 撤销 | Ctrl+Z快捷键 + Toast撤销按钮，支持添加/删除撤销 |
| ⌨️ 键盘快捷键 | Ctrl+Space(麦克风)/Ctrl+Z(撤销)/Ctrl+Enter(确认)/Esc(取消) |
| 📝 操作历史 | 最近10条，点击展开全文，hover预览 |
| 📡 离线降级 | IndexedDB→LocalStorage，Speech→文本输入，LLM失败→L1兜底 |
| 🔔 语音确认 | 卡片显示时自动监听"确认/取消/修改"二次语音 |

### ⚠️ 部分实现 / 需完善

| 功能 | 当前状态 | 待完善 |
|------|----------|--------|
| 🔊 唤醒词 | 代码完成，UI开关存在 | **未接入app.js启动入口**，切换开关无效 |
| 🔄 事件重调度 | 仅处理单匹配 | 多匹配时无反馈，需匹配→选择→确认流程 |
| 🤖 L2 LLM触发率 | 逻辑完整 | L1置信度虚高（无纠错时=1.0），**LLM很少被触发** |
| 🎨 日历事件高亮 | 仅跳转到对应日期 | 无视觉高亮标注，查找不便 |
| 🖱️ 手动创建事件 | prompt()弹窗实现 | UI阻塞，不支持设置时间/全天事件 |
| 📅 全天事件 | 数据模型支持 | 语音和手动入口均无法创建 |

---

## 🔍 待完善维度

### 1. 语音纠错精度 (Accuracy)

| 优先级 | 条目 | 说明 |
|--------|------|------|
| 🔴高 | L1置信度虚高 | `homophoneScore`无纠错时=1.0，导致L2被跳过的阈值偏低 |
| 🔴高 | 中文数字时间 | 仅支持0-12点，`十三点`(下午1点)无法解析 |
| 🟡中 | LLM无超时重试 | 网络波动时直接放弃，无指数退避 |
| 🟡中 | 唤醒词 | 需在app.js中根据settings开关调用WakeWord.start() |
| 🟢低 | 音近词覆盖度 | 当前150条，可引入语料库统计高频ASR错误自动扩展 |

### 2. 语音识别鲁棒性 (Robustness)

| 优先级 | 条目 | 说明 |
|--------|------|------|
| 🔴高 | Firefox不兼容 | SpeechRecognition仅Chromium支持，Firefox用户被迫使用文本输入 |
| 🟡中 | TTS语音异步加载 | 首次调用时`getVoices()`常返回空数组，需监听`voiceschanged`事件 |
| 🟡中 | 连续语音中断 | 单次识别在首个final后就停止，长句可能被截断 |
| 🟢低 | 无音量反馈 | 缺少麦克风音量波形，用户不知道是否在录音 |
| 🟢低 | ASR备选方案 | 浏览器ASR失败时无云服务fallback（Azure/讯飞等） |

### 3. 隐私与安全 (Security)

| 优先级 | 条目 | 说明 |
|--------|------|------|
| 🔴高 | API Key明文存储 | 设置面板的LLM Key直接存IndexedDB，DevTools可见 |
| 🟡中 | localStorage.clear() | 设置面板清除数据时清空域名下**所有**localStorage，非仅本应用 |
| 🟡中 | LLM prompt注入 | 用户语音原文直接嵌入SystemPrompt，恶意输入可改变LLM行为 |
| 🟢低 | 无CSP头 | 未设置Content-Security-Policy（部署时服务端配置） |

### 4. 性能与可扩展性 (Performance)

| 优先级 | 条目 | 说明 |
|--------|------|------|
| 🔴高 | O(n)全量事件查询 | `query()`每次都加载全部事件到内存，未利用IndexedDB的`startTime`索引 |
| 🔴高 | 每次操作重载全部事件 | add/delete后调用`getAll()`重载，500+事件时延迟明显 |
| 🟡中 | 知识库O(n)查询 | 每次L1纠错和学习都全表扫描，未使用索引 |
| 🟡中 | chrono-node体积 | bundle含全部locale 399KB，可按需仅打包中文locale |
| 🟢低 | 日历DOM批量创建 | 42个月视图cell逐个appendChild，大事件量时innerHTML更快 |

### 5. 用户体验 (UX)

| 优先级 | 条目 | 说明 |
|--------|------|------|
| 🔴高 | 手动创建事件 | 当前使用`prompt()`弹窗，阻碍UI且无时间选择器 |
| 🔴高 | 日历事件高亮 | `highlightEvents`仅跳转日期，无视觉标注 |
| 🟡中 | Toast信息量 | view操作Toast只显示"找到2个事件"，不含事件名称 |
| 🟡中 | 周/日视图中事件重叠 | 同时段多个事件视觉叠加，需横向排列 |
| 🟡中 | 无当前时间指示线 | 周/日视图缺少红色"现在"时间线 |
| 🟢低 | 确认卡片无动画 | `hide()`直接清空innerHTML，缺少过渡动画 |
| 🟢低 | 无键盘Tab导航 | 确认卡片内无法用Tab切换可编辑字段 |

### 6. 测试与工程质量 (Quality)

| 优先级 | 条目 | 说明 |
|--------|------|------|
| 🔴高 | **零测试覆盖** | `tests/`目录为空，无单元/集成/E2E测试 |
| 🔴高 | 重复代码 | `computeLayer1Confidence`在`layer1-local.js`和`confidence.js`各有一份 |
| 🟡中 | 事件popover引用bug | `removeEventListener`移除的是`removePopover`而非`outsideHandler` |
| 🟡中 | 错误静默吞噬 | recognition.js的`abort()`/synthesis.js的error处理静默丢弃异常 |
| 🟢低 | 无CI/CD | 缺少lint/prettier/type-check配置 |

### 7. 功能扩展方向 (Future)

| 优先级 | 条目 | 说明 |
|--------|------|------|
| 🟡中 | 重复事件 | "每周一上午的站会" — 需扩展数据模型和chrono解析 |
| 🟡中 | 事件分类/颜色 | 不同事件类型用不同颜色标记 |
| 🟡中 | 导出/导入 | iCal格式导入导出，与Google Calendar互通 |
| 🟢低 | PWA移动端 | Service Worker离线缓存 + 移动端手势适配 |
| 🟢低 | 云端同步 | Supabase/Firebase后端，多设备同步 |
| 🟢低 | 多语言 | 英文/粤语ASR+纠错支持 |
| 🟢低 | WebLLM离线纠错 | 浏览器端运行轻量LLM，完全离线语义纠错 |

---

## 📄 许可

本项目为原创作品，核心算法自主实现。chrono-node 为 MIT 许可的第三方库。
