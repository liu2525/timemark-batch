# Timemark Batch — Figma 插件设计文档

**日期：** 2026-03-17
**状态：** 已审阅 ✅
**目录：** `/Users/Gloria/Figma Plugin`

---

## 1. 背景与目标

Timemark 是一款户外工作相机 App。需要为 10 个国家批量制作广告图。广告图结构固定，国家间只有文案、水印变体和背景图不同，尺寸统一。

**目标：** 开发一个 Figma 插件，让运营人员选好素材、填写文案后，一键批量生成 10 个国家的广告图 Instance，并横向排列在画布上。

---

## 2. 技术栈

| 项目 | 选型 |
|---|---|
| 脚手架 | `npm create figma-plugin@latest`，模板 `ui-react` |
| UI | React + TypeScript，inline style，不引入 CSS 框架 |
| 插件尺寸 | 360 × 560 px（`manifest.json`） |
| 存储 | `figma.clientStorage`（API Key、方案、Prompt 预设） |
| AI 图片 | OpenAI DALL-E（`dall-e-3`），UI 层 fetch |
| 构建 | Parcel（`npm run build`） |

---

## 3. Figma 文件约定

### 3.1 Main Component Properties
模板为一个 `ComponentNode`，已配置：
- `headline`：Text Property
- `subheadline`：Text Property
- `cta_text`：Text Property
- `watermark`：Variant Property（值为国家代码小写，如 `en`、`jp`）

### 3.2 图层约定
| 图层名 | 类型 | 用途 |
|---|---|---|
| `bg` | Rectangle | 行业背景图填充 |
| `mockup/photo` | Rectangle | 拍照示例图填充 |

### 3.3 背景图库
- Figma 文件中有一个**隐藏 Frame**，名为 `__bg_library__`
- 其直接子图层为各行业背景图（Rectangle），命名为行业英文名：`construction`、`landscaping`、`security`、`cleaning`、`logistics`
- fill 为对应图片，`imageHash` 可直接读取复用
- 新增行业：在 `__bg_library__` 中添加新 Rectangle 并命名，插件自动识别，无需改代码

---

## 4. UI 设计

### 4.1 整体架构：单页面 + 模态覆层（方案 B）

```
┌─────────────────────────────────────┐  ← 360px
│  顶栏 (48px)                         │
│  [Timemark Batch]  [▾方案] [保存] [⚙]│
├─────────────────────────────────────┤
│  素材区 (96px)                        │
│  ┌──────────────┐ ┌──────────────┐  │
│  │ 行业背景      │ │ 示例照片      │  │
│  │ [缩略图][▾]  │ │ [缩略图][名] │  │
│  │ [⬆本地][✦AI]│ │ [⬆本地][✦AI]│  │
│  └──────────────┘ └──────────────┘  │
├─────────────────────────────────────┤
│  表头 (28px)                          │
│  ☑ 国家 | 标题 | 副标题 | CTA | 水印  │
├─────────────────────────────────────┤
│  表格行 × 10（可滚动，每行 32px）      │  560px
│  ☑ 🇺🇸US │ [input] │ [input] │ [] │▾│  总计
│  ☐ 🇯🇵JP │ ...                       │  ↑
│  ···                                 │
├─────────────────────────────────────┤
│  底栏 (48px)                          │
│  [已选 N 个国家]            [生成]    │
└─────────────────────────────────────┘
```

高度分配：48 + 96 + 28 + 320（10×32） + 48 = **540px**，留 20px 缓冲，表格区可滚动兜底。

### 4.2 覆层一：AI 生成弹窗

触发：点击素材区「✦ AI」按钮（行业背景或示例照片各自有一个入口）。

```
┌────────────────────────────────┐
│ ✦ AI 生成图片  [行业背景]    ✕ │
├────────────────────────────────┤
│ 预设 Prompt（只读，来自设置）   │
│ [在设置中编辑 →]               │
│                                │
│ 自定义覆盖（可选）              │
│ ┌──────────────────────────┐  │
│ │ textarea（留空=用预设）   │  │
│ └──────────────────────────┘  │
│                                │
│ [尺寸 ▾]  [质量 ▾]            │
│                                │
│ [取消]    [✦ 生成图片]         │
└────────────────────────────────┘
```

- 自定义文本为空时使用预设；有内容时完全替换
- 生成中：按钮 disable + spinner
- 生成完成：弹窗自动关闭，缩略图更新，imageHash 缓存在 UI state

### 4.3 覆层二：设置页

触发：点击顶栏 ⚙ 按钮。

```
┌────────────────────────────────┐
│ ⚙ 设置                      ✕ │
├────────────────────────────────┤
│ OpenAI API Key                 │
│ [sk-••••••••••••••] [显示]     │
│ 仅存于本设备 figma.clientStorage│
│                                │
│ AI Prompt 预设（按行业）        │
│ ▸ 🏗 construction              │
│ ▸ 🌿 landscaping               │
│ ▸ 🔒 security                  │
│ ▸ 🧹 cleaning                  │
│ ▸ 🚛 logistics                 │
│ （点击展开，可编辑 prompt）     │
│                                │
│ [保存设置]                     │
└────────────────────────────────┘
```

- 行业列表动态读取自 `__bg_library__` 子图层名，新增行业自动出现
- 手风琴展开/收起

---

## 5. 默认国家配置（10 行）

| # | 旗帜 | 代码 | 默认水印值 |
|---|---|---|---|
| 1 | 🇺🇸 | US | en |
| 2 | 🇬🇧 | UK | en |
| 3 | 🇦🇺 | AU | en |
| 4 | 🇨🇦 | CA | en |
| 5 | 🇯🇵 | JP | jp |
| 6 | 🇰🇷 | KR | kr |
| 7 | 🇩🇪 | DE | de |
| 8 | 🇫🇷 | FR | fr |
| 9 | 🇧🇷 | BR | br |
| 10 | 🇲🇽 | MX | mx |

---

## 6. 图片数据流

三种来源统一到同一个写入机制：

```
本地上传                    DALL-E 生成                 __bg_library__
<input type=file>          UI fetch() OpenAI API       main.ts 直读
→ FileReader               → 取 URL → fetch bytes      node.fills[0].imageHash
→ ArrayBuffer              → ArrayBuffer
        ↓                          ↓                          ↓
  postMessage(GENERATE,      postMessage(GENERATE,       （无需 postMessage）
  photoBytes/bgBytes)        photoBytes/bgBytes)
        ↓                          ↓
  figma.createImage(bytes)   figma.createImage(bytes)
        ↓                          ↓                          ↓
                    imageHash ──────────────────────────────────
                         ↓
          node.fills = [{ type:'IMAGE', scaleMode:'FILL', imageHash }]
```

**关键设计：** bg 来自 `__bg_library__` 时直接传 `bgImageHash`，跳过 bytes 中转，更快。bg 来自本地上传或 AI 生成时传 `bgBytes`，main.ts 调 `figma.createImage`。

---

## 7. 通信协议

### UI → main.ts

```ts
// 插件启动时
{ type: 'GET_INDUSTRIES' }
{ type: 'LOAD_SCHEMES' }

// 用户操作
{ type: 'SAVE_SCHEME', name: string, data: { industry: string, countries: CountryConfig[] } }

{ type: 'GENERATE',
  configs: CountryConfig[],      // 仅勾选的行
  industry: string,              // 行业名（用于无 bytes 时从 bg_library 读取）
  bgImageHash?: string,          // 来自 __bg_library__ 时直接传 hash
  bgBytes?: Uint8Array,          // 来自本地上传或 AI 生成
  photoBytes?: Uint8Array        // 来自本地上传或 AI 生成
}
```

### main.ts → UI

```ts
{ type: 'INDUSTRIES', list: string[] }
{ type: 'SCHEMES', data: SchemesStore, lastScheme: string }
{ type: 'PROGRESS', current: number, total: number }
{ type: 'DONE', warnings: string[] }   // warnings: 未找到图层的国家列表
{ type: 'ERROR', message: string }     // 致命错误（未选中 Component 等）
```

---

## 8. 核心生成逻辑（main.ts）

```
1. 验证：figma.currentPage.selection[0] 存在且类型为 ComponentNode
   → 否则 postMessage ERROR

2. 确定 bgImageHash：
   - 若 bgImageHash 直接可用 → 使用
   - 若 bgBytes → figma.createImage(bgBytes).hash
   - 若都没有 → 在 __bg_library__ 中按 industry 名找 Rectangle，读 fills[0].imageHash
     → 找不到 __bg_library__ → postMessage ERROR

3. 若 photoBytes → figma.createImage(photoBytes).hash → photoHash

4. 计算排列原点：`startX = figma.viewport.center.x - (totalWidth / 2)`，`startY = figma.viewport.center.y - (instanceHeight / 2)`，totalWidth = N × (instanceWidth + 40) - 40

5. for each config in configs（勾选的国家）：
   a. component.createInstance()
   b. instance.setProperties({ headline, subheadline, cta_text, watermark })
      → 失败时记录 warning，continue
   c. findNodeByName(instance, 'bg')
      → 找到：替换 fills
      → 找不到：记录 warning
   d. if photoHash：findNodeByName(instance, 'mockup/photo')
      → 找到：替换 fills
      → 找不到：记录 warning
   e. instance.x = startX + i * (instance.width + 40)
   f. instance.name = `${config.code}_ad`
   g. postMessage PROGRESS { current: i+1, total: configs.length }

6. figma.viewport.scrollAndZoomIntoView(instances)
7. postMessage DONE { warnings }
```

**递归查找函数：** `findNodeByName(root, name)` 按 `node.name` 精确匹配，深度优先遍历，找到即返回（不遍历全树）。

---

## 9. 方案存储（figma.clientStorage）

```ts
// 数据结构
interface SchemesStore {
  schemes: {
    [name: string]: {
      industry: string
      countries: CountryConfig[]
    }
  }
  lastScheme: string
}

// 设置存储（独立 key）
interface PluginSettings {
  apiKey: string
  promptPresets: {
    [industry: string]: string   // 行业名 → prompt 文本
  }
}
```

**行为：**
- 插件开启时发送 `LOAD_SCHEMES`，自动填充 lastScheme 的表格
- 「保存方案」在顶栏内联显示一个 input + 确认按钮（**不使用 `window.prompt()`**，Figma 插件沙箱中 `window.prompt` 不可靠）
- 切换方案时更新表格和行业背景选择器
- 拍照示例图**不保存**进方案（每次手动选或 AI 生成）
- API Key 和 Prompt 预设存在独立的 `plugin_settings` key

---

## 10. 错误处理

| 场景 | 处理 |
|---|---|
| 未选中任何元素 | ERROR：「请先在画布上选中广告图模板 Component」 |
| 选中的不是 ComponentNode | ERROR：「请选中 Main Component，而非 Instance 或其他图层」 |
| `__bg_library__` Frame 不存在 | ERROR：「未找到背景图库，请确认 Figma 文件中有名为 `__bg_library__` 的 Frame」 |
| `setProperties` 报错（watermark 值不存在等） | 跳过该国家，加入 warnings，生成结束后统一提示 |
| 行业存在于选择器但 `__bg_library__` 中无对应 Rectangle | warning（非 fatal），该国家 bg 图层不替换，继续生成其他国家 |
| AI 生成弹窗：✕ 关闭时有飞行中的 fetch | UI 层 `AbortController` 取消请求，弹窗直接关闭，缩略图保持上一次状态 |
| 未提供示例照片（photoBytes 为空） | `mockup/photo` 图层保持 Main Component 的原始 fill，不做任何替换 |
| `bg` / `mockup/photo` 图层找不到 | 跳过该图层，加入 warnings，不中断整体生成 |
| OpenAI API 返回错误 | UI 层 catch，显示错误信息（如 quota 超限、key 无效等） |

---

## 11. 文件结构

```
/Users/Gloria/Figma Plugin/
├── src/
│   ├── main.ts          # Figma 沙箱逻辑（生成、clientStorage、图层操作）
│   ├── ui.tsx           # React UI（主界面 + 两种覆层）
│   └── types.ts         # 共享类型（CountryConfig、Scheme、消息类型等）
├── docs/
│   └── superpowers/specs/
│       └── 2026-03-17-timemark-batch-plugin-design.md
├── manifest.json        # name, id, main, ui, width:360, height:560
└── package.json
```

---

## 12. 关键类型定义（types.ts）

```ts
export interface CountryConfig {
  code: string           // 'US', 'JP' ...
  flag: string           // '🇺🇸', '🇯🇵' ...
  headline: string
  subheadline: string
  cta_text: string
  watermark: string      // 默认等于 code.toLowerCase()
  enabled: boolean
}

export interface SchemeData {
  industry: string
  countries: CountryConfig[]
}

export interface SchemesStore {
  schemes: Record<string, SchemeData>
  lastScheme: string
}

export interface PluginSettings {
  apiKey: string
  promptPresets: Record<string, string>
}

// 消息类型（UI → main）
export type UIMessage =
  | { type: 'GET_INDUSTRIES' }
  | { type: 'LOAD_SCHEMES' }
  | { type: 'SAVE_SCHEME'; name: string; data: SchemeData }
  | { type: 'GENERATE'; configs: CountryConfig[]; industry: string;
      bgImageHash?: string; bgBytes?: Uint8Array; photoBytes?: Uint8Array }

// 消息类型（main → UI）
export type MainMessage =
  | { type: 'INDUSTRIES'; list: string[] }
  | { type: 'SCHEMES'; data: SchemesStore; lastScheme: string }
  | { type: 'PROGRESS'; current: number; total: number }
  | { type: 'DONE'; warnings: string[] }
  | { type: 'ERROR'; message: string }
```

---

## 13. 完成后操作指南

### 构建
```bash
cd "/Users/Gloria/Figma Plugin"
npm install
npm run build
```

### 在 Figma 中导入测试
1. Figma Desktop → 菜单 → Plugins → Development → Import plugin from manifest
2. 选择 `/Users/Gloria/Figma Plugin/manifest.json`
3. 在 Figma 文件中创建 `__bg_library__` Frame（设为隐藏），添加行业背景矩形
4. 在画布上选中 Main Component，运行插件

### `__bg_library__` 建议设置方式
1. 在 Figma 文件任意页面创建一个 Frame，命名 `__bg_library__`
2. 在 Frame 内添加 Rectangle，分别命名 `construction`、`landscaping`、`security`、`cleaning`、`logistics`
3. 每个 Rectangle 的 Fill 设为对应行业背景图（Image Fill）
4. 将 Frame 设为隐藏（在图层面板点眼睛图标）
5. Frame 尺寸不限，背景图 Rectangle 尺寸建议与广告图 `bg` 图层一致
