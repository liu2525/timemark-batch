# Timemark Batch Plugin Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Figma plugin that batch-generates ad images for 10 countries by creating Component instances with per-country copy, watermark variants, and background/photo fills — with support for local upload and DALL-E AI generation.

**Architecture:** Single-page React UI (360×560px) with modal overlays for AI generation and settings. UI (iframe) communicates with main.ts (Figma sandbox) via typed postMessage. Images from all sources converge to `imageHash` before writing to Figma fills.

**Tech Stack:** npm create figma-plugin (ui-react template), React 18, TypeScript, Parcel bundler, figma.clientStorage, OpenAI DALL-E 3 API (UI-side fetch)

---

## File Map

| File | Responsibility |
|---|---|
| `src/types.ts` | Shared types: CountryConfig, SchemeData, SchemesStore, PluginSettings, UIMessage, MainMessage |
| `src/main.ts` | Figma sandbox: message handler, generate logic, clientStorage, findNodeByName util |
| `src/ui.tsx` | React root: MainView, MediaSelector, CountryTable, AIModal, SettingsModal |
| `manifest.json` | Plugin metadata, dimensions 360×560 |
| `package.json` | Dependencies, build scripts |

---

## Chunk 1: Scaffold + Types

### Task 1: Scaffold the project

**Files:**
- Create: `/Users/Gloria/Figma Plugin/` (entire project)

- [ ] **Step 1: Scaffold with figma-plugin CLI**

```bash
cd "/Users/Gloria"
npm create figma-plugin@latest "Figma Plugin" -- --template ui-react
```

When prompted:
- Plugin name: `Timemark Batch`
- Choose template: `ui-react`

- [ ] **Step 2: Verify scaffold output**

```bash
ls "/Users/Gloria/Figma Plugin/src"
```

Expected: `main.ts` and `ui.tsx` present.

- [ ] **Step 3: Install dependencies**

```bash
cd "/Users/Gloria/Figma Plugin"
npm install
```

- [ ] **Step 4: Update manifest.json — set dimensions and name**

Open `manifest.json`. Replace the entire file with:

```json
{
  "name": "Timemark Batch",
  "id": "timemark-batch-plugin",
  "api": "1.0.0",
  "main": "build/main.js",
  "ui": "build/ui.js",
  "editorType": ["figma"],
  "networkAccess": {
    "allowedDomains": ["https://api.openai.com"]
  },
  "width": 360,
  "height": 560
}
```

> `networkAccess` is required for the UI iframe to fetch OpenAI. Without it, Figma blocks the request.

- [ ] **Step 5: Verify build works before touching any logic**

```bash
cd "/Users/Gloria/Figma Plugin"
npm run build
```

Expected: `build/main.js` and `build/ui.js` created, no errors.

- [ ] **Step 6: Commit scaffold**

```bash
cd "/Users/Gloria/Figma Plugin"
git add -A
git commit -m "feat: scaffold figma plugin with ui-react template"
```

---

### Task 2: Write types.ts

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Create src/types.ts with all shared types**

```typescript
// src/types.ts

export interface CountryConfig {
  code: string        // 'US', 'JP', etc.
  flag: string        // '🇺🇸', '🇯🇵', etc.
  headline: string
  subheadline: string
  cta_text: string
  watermark: string   // default = code.toLowerCase()
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
  promptPresets: Record<string, string>  // industry → prompt text
}

// ── Messages: UI → main ──────────────────────────────────────────
export type UIMessage =
  | { type: 'GET_INDUSTRIES' }
  | { type: 'LOAD_SCHEMES' }
  | { type: 'SAVE_SCHEME'; name: string; data: SchemeData }
  | {
      type: 'GENERATE'
      configs: CountryConfig[]
      industry: string
      bgImageHash?: string   // from __bg_library__ (no bytes needed)
      bgBytes?: number[]     // from local upload or AI (serialised as number[] for postMessage)
      photoBytes?: number[]  // from local upload or AI
    }

// ── Messages: main → UI ──────────────────────────────────────────
export type MainMessage =
  | { type: 'INDUSTRIES'; list: string[] }
  | { type: 'SCHEMES'; data: SchemesStore; lastScheme: string }
  | { type: 'PROGRESS'; current: number; total: number }
  | { type: 'DONE'; warnings: string[] }
  | { type: 'ERROR'; message: string }

// ── Default country table ─────────────────────────────────────────
export const DEFAULT_COUNTRIES: CountryConfig[] = [
  { code: 'US', flag: '🇺🇸', headline: '', subheadline: '', cta_text: '', watermark: 'en', enabled: true },
  { code: 'UK', flag: '🇬🇧', headline: '', subheadline: '', cta_text: '', watermark: 'en', enabled: true },
  { code: 'AU', flag: '🇦🇺', headline: '', subheadline: '', cta_text: '', watermark: 'en', enabled: true },
  { code: 'CA', flag: '🇨🇦', headline: '', subheadline: '', cta_text: '', watermark: 'en', enabled: true },
  { code: 'JP', flag: '🇯🇵', headline: '', subheadline: '', cta_text: '', watermark: 'jp', enabled: true },
  { code: 'KR', flag: '🇰🇷', headline: '', subheadline: '', cta_text: '', watermark: 'kr', enabled: true },
  { code: 'DE', flag: '🇩🇪', headline: '', subheadline: '', cta_text: '', watermark: 'de', enabled: true },
  { code: 'FR', flag: '🇫🇷', headline: '', subheadline: '', cta_text: '', watermark: 'fr', enabled: true },
  { code: 'BR', flag: '🇧🇷', headline: '', subheadline: '', cta_text: '', watermark: 'br', enabled: true },
  { code: 'MX', flag: '🇲🇽', headline: '', subheadline: '', cta_text: '', watermark: 'mx', enabled: true },
]
```

> **Why `number[]` instead of `Uint8Array`?** Figma's `postMessage` serialises via structured clone. `Uint8Array` survives the main→UI direction fine, but UI→main can drop the typed array type. Using `number[]` is safer; main.ts converts with `new Uint8Array(bytes)`.

- [ ] **Step 2: Build to confirm no TypeScript errors**

```bash
cd "/Users/Gloria/Figma Plugin"
npm run build
```

Expected: builds without errors.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add shared types for plugin messages and data models"
```

---

## Chunk 2: main.ts

### Task 3: Write main.ts — utilities and message skeleton

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Replace src/main.ts with full implementation**

```typescript
// src/main.ts
import { UIMessage, MainMessage, CountryConfig } from './types'

// ─── Utility: recursive node finder ──────────────────────────────
function findNodeByName(root: BaseNode, name: string): BaseNode | null {
  if (root.name === name) return root
  if ('children' in root) {
    for (const child of root.children) {
      const found = findNodeByName(child, name)
      if (found) return found
    }
  }
  return null
}

// ─── Utility: find __bg_library__ frame on any page ──────────────
function findBgLibrary(): FrameNode | null {
  for (const page of figma.root.children) {
    for (const node of page.children) {
      if (node.name === '__bg_library__' && node.type === 'FRAME') {
        return node as FrameNode
      }
    }
  }
  return null
}

// ─── Handler: GET_INDUSTRIES ──────────────────────────────────────
function handleGetIndustries() {
  const library = findBgLibrary()
  const list = library
    ? library.children.map(n => n.name)
    : []
  const msg: MainMessage = { type: 'INDUSTRIES', list }
  figma.ui.postMessage(msg)
}

// ─── Handler: LOAD_SCHEMES ───────────────────────────────────────
async function handleLoadSchemes() {
  const raw = await figma.clientStorage.getAsync('schemes_store')
  const data = raw ?? { schemes: {}, lastScheme: '' }
  const msg: MainMessage = { type: 'SCHEMES', data, lastScheme: data.lastScheme ?? '' }
  figma.ui.postMessage(msg)
}

// ─── Handler: SAVE_SCHEME ────────────────────────────────────────
async function handleSaveScheme(name: string, schemeData: { industry: string; countries: CountryConfig[] }) {
  const raw = await figma.clientStorage.getAsync('schemes_store') ?? { schemes: {}, lastScheme: '' }
  raw.schemes[name] = schemeData
  raw.lastScheme = name
  await figma.clientStorage.setAsync('schemes_store', raw)
}

// ─── Handler: GENERATE ───────────────────────────────────────────
async function handleGenerate(msg: Extract<UIMessage, { type: 'GENERATE' }>) {
  const { configs, industry, bgImageHash, bgBytes, photoBytes } = msg

  // Step 1: validate selection
  const selection = figma.currentPage.selection
  if (!selection.length || selection[0].type !== 'COMPONENT') {
    const err: MainMessage = {
      type: 'ERROR',
      message: selection.length === 0
        ? '请先在画布上选中广告图模板 Component'
        : '请选中 Main Component，而非 Instance 或其他图层'
    }
    figma.ui.postMessage(err)
    return
  }
  const component = selection[0] as ComponentNode

  // Step 2: resolve bg imageHash
  let resolvedBgHash: string | null = bgImageHash ?? null

  if (!resolvedBgHash && bgBytes) {
    const img = figma.createImage(new Uint8Array(bgBytes))
    resolvedBgHash = img.hash
  }

  if (!resolvedBgHash) {
    const library = findBgLibrary()
    if (!library) {
      const err: MainMessage = {
        type: 'ERROR',
        message: '未找到背景图库，请确认 Figma 文件中有名为 __bg_library__ 的 Frame'
      }
      figma.ui.postMessage(err)
      return
    }
    const bgNode = library.children.find(n => n.name === industry)
    if (bgNode && bgNode.type === 'RECTANGLE') {
      const fills = bgNode.fills as Paint[]
      const imgPaint = fills.find(f => f.type === 'IMAGE') as ImagePaint | undefined
      resolvedBgHash = imgPaint?.imageHash ?? null
    }
    // if still null: warning emitted per-instance below
  }

  // Step 3: resolve photo imageHash
  let resolvedPhotoHash: string | null = null
  if (photoBytes) {
    const img = figma.createImage(new Uint8Array(photoBytes))
    resolvedPhotoHash = img.hash
  }

  // Step 4: calculate layout origin
  const N = configs.length
  // Create first instance temporarily to measure size
  const probe = component.createInstance()
  const instanceW = probe.width
  const instanceH = probe.height
  probe.remove()

  const totalWidth = N * instanceW + (N - 1) * 40
  const startX = figma.viewport.center.x - totalWidth / 2
  const startY = figma.viewport.center.y - instanceH / 2

  // Step 5: generate instances
  const warnings: string[] = []
  const instances: InstanceNode[] = []

  for (let i = 0; i < configs.length; i++) {
    const config = configs[i]

    const instance = component.createInstance()
    instance.x = startX + i * (instanceW + 40)
    instance.y = startY
    instance.name = `${config.code}_ad`

    // Set text + variant properties
    try {
      await instance.setPropertiesAsync({
        headline: config.headline,
        subheadline: config.subheadline,
        cta_text: config.cta_text,
        watermark: config.watermark,
      })
    } catch (e) {
      warnings.push(`${config.code}: setProperties 失败 — ${(e as Error).message}`)
    }

    // Replace bg fill
    if (resolvedBgHash) {
      const bgLayer = findNodeByName(instance, 'bg')
      if (bgLayer && bgLayer.type === 'RECTANGLE') {
        const rect = bgLayer as RectangleNode
        rect.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: resolvedBgHash }]
      } else {
        warnings.push(`${config.code}: 未找到 bg 图层`)
      }
    } else {
      warnings.push(`${config.code}: 行业背景 "${industry}" 在 __bg_library__ 中无对应图层，bg 保持原样`)
    }

    // Replace photo fill
    if (resolvedPhotoHash) {
      const photoLayer = findNodeByName(instance, 'mockup/photo')
      if (photoLayer && photoLayer.type === 'RECTANGLE') {
        const rect = photoLayer as RectangleNode
        rect.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: resolvedPhotoHash }]
      } else {
        warnings.push(`${config.code}: 未找到 mockup/photo 图层`)
      }
    }

    instances.push(instance)

    const progress: MainMessage = { type: 'PROGRESS', current: i + 1, total: N }
    figma.ui.postMessage(progress)
  }

  // Step 6: zoom to view
  figma.viewport.scrollAndZoomIntoView(instances)

  const done: MainMessage = { type: 'DONE', warnings }
  figma.ui.postMessage(done)
}

// ─── Main message router ──────────────────────────────────────────
figma.showUI(__html__, { width: 360, height: 560 })

figma.ui.onmessage = async (raw: UIMessage) => {
  switch (raw.type) {
    case 'GET_INDUSTRIES':
      handleGetIndustries()
      break
    case 'LOAD_SCHEMES':
      await handleLoadSchemes()
      break
    case 'SAVE_SCHEME':
      await handleSaveScheme(raw.name, raw.data)
      break
    case 'GENERATE':
      await handleGenerate(raw)
      break
  }
}
```

- [ ] **Step 2: Build to confirm no TypeScript errors**

```bash
cd "/Users/Gloria/Figma Plugin"
npm run build
```

Expected: builds cleanly. Fix any TypeScript complaints (e.g. `setPropertiesAsync` vs `setProperties` — use whichever the installed `@figma/plugin-typings` version exposes; if `setPropertiesAsync` is absent, use `instance.setProperties(...)`).

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat: implement main.ts — generate logic, bg library, clientStorage"
```

---

## Chunk 3: ui.tsx

### Task 4: Write ui.tsx — styles and state skeleton

**Files:**
- Modify: `src/ui.tsx`

- [ ] **Step 1: Replace src/ui.tsx with the full UI**

This is the complete file. Write it in one shot:

```tsx
// src/ui.tsx
import { h, render } from 'preact'
import { useState, useEffect, useRef } from 'preact/hooks'
import {
  CountryConfig, DEFAULT_COUNTRIES,
  SchemesStore, SchemeData, PluginSettings,
  UIMessage, MainMessage
} from './types'

// ─── Theme tokens ────────────────────────────────────────────────
const C = {
  bg0: '#11111b',
  bg1: '#181825',
  bg2: '#1e1e2e',
  surface: '#313244',
  overlay: '#45475a',
  muted: '#6c7086',
  subtle: '#a6adc8',
  text: '#cdd6f4',
  purple: '#cba6f7',
  green: '#a6e3a1',
  red: '#f38ba8',
  border: '#313244',
}

const S = {
  // Layout
  app: { display: 'flex', flexDirection: 'column' as const, width: 360, height: 560, background: C.bg1, fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 12, color: C.text, overflow: 'hidden' },
  // Topbar
  topbar: { height: 48, background: C.bg2, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', flexShrink: 0 },
  topbarTitle: { fontSize: 12, fontWeight: 700, color: C.text, letterSpacing: 0.3 },
  topbarRight: { display: 'flex', gap: 4, alignItems: 'center' },
  // Media area
  mediaArea: { padding: '8px 9px 6px', display: 'flex', gap: 6, flexShrink: 0 },
  mediaCard: { flex: 1, background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 7px' },
  mediaLabel: { fontSize: 7, color: C.muted, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 4 },
  mediaThumbRow: { display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 },
  mediaThumb: { width: 22, height: 22, background: C.overlay, borderRadius: 3, flexShrink: 0, objectFit: 'cover' as const },
  mediaBtnRow: { display: 'flex', gap: 3 },
  // Table
  tableWrap: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' as const, padding: '0 9px' },
  tableHead: { display: 'grid', gridTemplateColumns: '16px 40px 1fr 1fr 34px 40px', gap: 3, background: C.surface, borderRadius: '4px 4px 0 0', padding: '4px 6px' },
  tableBody: { flex: 1, overflowY: 'auto' as const, background: C.bg2, border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 4px 4px' },
  tableRow: { display: 'grid', gridTemplateColumns: '16px 40px 1fr 1fr 34px 40px', gap: 3, padding: '3px 6px', borderBottom: `1px solid ${C.border}`, alignItems: 'center' },
  // Bottom bar
  bottomBar: { height: 48, background: C.bg2, borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', flexShrink: 0 },
  // Buttons
  btnPrimary: { background: C.purple, border: 'none', color: C.bg1, fontSize: 9, fontWeight: 700, borderRadius: 5, padding: '6px 16px', cursor: 'pointer' },
  btnSecondary: { background: C.surface, border: 'none', color: C.subtle, fontSize: 8, borderRadius: 3, padding: '3px 6px', cursor: 'pointer' },
  btnGhost: { background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, fontSize: 8, borderRadius: 3, padding: '3px 6px', cursor: 'pointer' },
  btnAI: { flex: 1, background: `${C.green}15`, border: `1px solid ${C.green}40`, color: C.green, fontSize: 7.5, borderRadius: 3, padding: '3px 2px', cursor: 'pointer' },
  btnLocal: { flex: 1, background: C.surface, border: 'none', color: C.subtle, fontSize: 7.5, borderRadius: 3, padding: '3px 2px', cursor: 'pointer' },
  // Inputs
  input: { background: C.surface, border: 'none', color: C.subtle, fontSize: 7.5, borderRadius: 2, padding: '2px 3px', width: '100%', outline: 'none' },
  select: { background: C.surface, border: 'none', color: C.subtle, fontSize: 7.5, borderRadius: 2, padding: '2px 1px', width: '100%', outline: 'none' },
  // Overlay backdrop
  backdrop: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: C.bg2, border: `1.5px solid ${C.border}`, borderRadius: 10, width: 332, maxHeight: 520, overflowY: 'auto' as const },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: `1px solid ${C.border}` },
  modalBody: { padding: '12px 14px' },
  modalFooter: { padding: '10px 14px', borderTop: `1px solid ${C.border}` },
}

// ─── Post message helper ─────────────────────────────────────────
function send(msg: UIMessage) {
  parent.postMessage({ pluginMessage: msg }, '*')
}

// ─── AI Modal ────────────────────────────────────────────────────
interface AIModalProps {
  target: 'bg' | 'photo'
  industries: string[]
  selectedIndustry: string
  promptPresets: Record<string, string>
  apiKey: string
  onClose: () => void
  onResult: (bytes: number[]) => void
}

function AIModal({ target, industries, selectedIndustry, promptPresets, apiKey, onClose, onResult }: AIModalProps) {
  const [customPrompt, setCustomPrompt] = useState('')
  const [size, setSize] = useState('1792x1024')
  const [quality, setQuality] = useState('standard')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const preset = promptPresets[selectedIndustry] ?? ''
  const finalPrompt = customPrompt.trim() || preset

  async function generate() {
    if (!apiKey) { setError('请先在设置中填写 OpenAI API Key'); return }
    if (!finalPrompt) { setError('请输入 Prompt 或在设置中配置预设'); return }
    setLoading(true)
    setError('')
    abortRef.current = new AbortController()
    try {
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        signal: abortRef.current.signal,
        body: JSON.stringify({ model: 'dall-e-3', prompt: finalPrompt, n: 1, size, quality, response_format: 'url' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? `HTTP ${res.status}`)
      const url: string = json.data[0].url
      const imgRes = await fetch(url, { signal: abortRef.current.signal })
      const buf = await imgRes.arrayBuffer()
      onResult(Array.from(new Uint8Array(buf)))
      onClose()
    } catch (e: unknown) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    abortRef.current?.abort()
    onClose()
  }

  const label = target === 'bg' ? '行业背景' : '示例照片'
  return (
    <div style={S.backdrop} onClick={e => { if (e.target === e.currentTarget) handleClose() }}>
      <div style={{ ...S.modal, borderColor: C.green }}>
        <div style={S.modalHeader}>
          <div>
            <span style={{ color: C.green, fontSize: 10, fontWeight: 700 }}>✦ AI 生成图片</span>
            <span style={{ background: C.surface, color: C.muted, fontSize: 8, borderRadius: 10, padding: '2px 7px', marginLeft: 6 }}>{label}</span>
          </div>
          <button style={{ background: 'none', border: 'none', color: C.muted, fontSize: 14, cursor: 'pointer' }} onClick={handleClose}>✕</button>
        </div>
        <div style={S.modalBody}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: C.muted, fontSize: 8 }}>预设 Prompt（行业：{selectedIndustry || '未选择'}）</span>
            </div>
            <div style={{ background: C.bg1, border: `1px solid ${C.border}`, borderRadius: 5, padding: '6px 8px', fontSize: 8.5, color: C.muted, fontStyle: 'italic', lineHeight: 1.5, minHeight: 36 }}>
              {preset || '（未配置预设，请在设置中添加）'}
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 4 }}>
              <span style={{ color: C.muted, fontSize: 8 }}>自定义覆盖</span>
              <span style={{ background: C.surface, color: C.muted, fontSize: 7.5, borderRadius: 3, padding: '1px 5px' }}>可选</span>
            </div>
            <textarea
              style={{ width: '100%', boxSizing: 'border-box', background: C.bg1, border: `1px solid ${C.overlay}`, borderRadius: 5, padding: '6px 8px', fontSize: 8.5, color: C.text, resize: 'none', height: 52, outline: 'none', fontFamily: 'inherit', lineHeight: 1.5 }}
              placeholder="留空则使用预设。填写后将完全替换预设 prompt…"
              value={customPrompt}
              onInput={e => setCustomPrompt((e.target as HTMLTextAreaElement).value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: C.muted, fontSize: 8, marginBottom: 3 }}>图片尺寸</div>
              <select style={{ width: '100%', background: C.surface, border: `1px solid ${C.overlay}`, color: C.subtle, fontSize: 8.5, borderRadius: 5, padding: '5px 7px', outline: 'none' }} value={size} onChange={e => setSize((e.target as HTMLSelectElement).value)}>
                <option value="1792x1024">1792×1024（横版）</option>
                <option value="1024x1024">1024×1024（方形）</option>
                <option value="1024x1792">1024×1792（竖版）</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: C.muted, fontSize: 8, marginBottom: 3 }}>生成质量</div>
              <select style={{ width: '100%', background: C.surface, border: `1px solid ${C.overlay}`, color: C.subtle, fontSize: 8.5, borderRadius: 5, padding: '5px 7px', outline: 'none' }} value={quality} onChange={e => setQuality((e.target as HTMLSelectElement).value)}>
                <option value="standard">standard</option>
                <option value="hd">hd</option>
              </select>
            </div>
          </div>
          {error && <div style={{ background: `${C.red}20`, border: `1px solid ${C.red}40`, borderRadius: 5, padding: '6px 8px', fontSize: 8.5, color: C.red, marginBottom: 10 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ flex: 1, background: C.surface, border: 'none', color: C.subtle, fontSize: 9, borderRadius: 6, padding: 8, cursor: 'pointer' }} onClick={handleClose}>取消</button>
            <button
              style={{ flex: 2, background: loading ? C.overlay : C.green, border: 'none', color: C.bg1, fontSize: 9, fontWeight: 700, borderRadius: 6, padding: 8, cursor: loading ? 'not-allowed' : 'pointer' }}
              onClick={generate}
              disabled={loading}
            >
              {loading ? '生成中…' : '✦ 生成图片'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Settings Modal ───────────────────────────────────────────────
interface SettingsModalProps {
  settings: PluginSettings
  industries: string[]
  onClose: () => void
  onSave: (s: PluginSettings) => void
}

function SettingsModal({ settings, industries, onClose, onSave }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState(settings.apiKey)
  const [showKey, setShowKey] = useState(false)
  const [presets, setPresets] = useState<Record<string, string>>({ ...settings.promptPresets })
  const [expanded, setExpanded] = useState<string | null>(null)

  function updatePreset(industry: string, val: string) {
    setPresets(p => ({ ...p, [industry]: val }))
  }

  return (
    <div style={S.backdrop} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ ...S.modal, borderColor: C.purple }}>
        <div style={S.modalHeader}>
          <span style={{ color: C.purple, fontSize: 10, fontWeight: 700 }}>⚙ 设置</span>
          <button style={{ background: 'none', border: 'none', color: C.muted, fontSize: 14, cursor: 'pointer' }} onClick={onClose}>✕</button>
        </div>
        <div style={S.modalBody}>
          {/* API Key */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ color: C.muted, fontSize: 8, marginBottom: 4 }}>OpenAI API Key</div>
            <div style={{ display: 'flex', gap: 5 }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onInput={e => setApiKey((e.target as HTMLInputElement).value)}
                placeholder="sk-proj-…"
                style={{ flex: 1, background: C.bg1, border: `1px solid ${C.overlay}`, color: C.subtle, fontSize: 8.5, borderRadius: 5, padding: '5px 8px', outline: 'none' }}
              />
              <button style={S.btnSecondary} onClick={() => setShowKey(v => !v)}>{showKey ? '隐藏' : '显示'}</button>
            </div>
            <div style={{ color: C.muted, fontSize: 7.5, marginTop: 3 }}>仅存于本设备 figma.clientStorage，不上传</div>
          </div>

          {/* Prompt presets */}
          <div>
            <div style={{ color: C.muted, fontSize: 8, marginBottom: 6 }}>AI Prompt 预设（按行业）</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 240, overflowY: 'auto' }}>
              {industries.map(ind => (
                <div key={ind} style={{ background: C.bg1, border: `1px solid ${C.border}`, borderRadius: 5, overflow: 'hidden' }}>
                  <div
                    style={{ padding: '5px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                    onClick={() => setExpanded(e => e === ind ? null : ind)}
                  >
                    <span style={{ fontSize: 8.5, color: C.text }}>{ind}</span>
                    <span style={{ fontSize: 9, color: C.muted }}>{expanded === ind ? '▾' : '▸'}</span>
                  </div>
                  {expanded === ind && (
                    <div style={{ padding: '0 8px 6px' }}>
                      <textarea
                        style={{ width: '100%', boxSizing: 'border-box', background: C.bg2, border: `1px solid ${C.overlay}`, borderRadius: 4, padding: 5, fontSize: 8, color: C.subtle, resize: 'none', height: 52, outline: 'none', fontFamily: 'inherit' }}
                        value={presets[ind] ?? ''}
                        onInput={e => updatePreset(ind, (e.target as HTMLTextAreaElement).value)}
                        placeholder={`为 ${ind} 行业配置 DALL-E prompt…`}
                      />
                    </div>
                  )}
                </div>
              ))}
              {industries.length === 0 && (
                <div style={{ color: C.muted, fontSize: 8, textAlign: 'center', padding: 12 }}>
                  未找到行业（需要 __bg_library__ Frame）
                </div>
              )}
            </div>
          </div>
        </div>
        <div style={S.modalFooter}>
          <button
            style={{ width: '100%', background: C.purple, border: 'none', color: C.bg1, fontSize: 9, fontWeight: 700, borderRadius: 6, padding: 8, cursor: 'pointer' }}
            onClick={() => onSave({ apiKey, promptPresets: presets })}
          >
            保存设置
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────
function App() {
  // ── Plugin data ──
  const [industries, setIndustries] = useState<string[]>([])
  const [schemes, setSchemes] = useState<SchemesStore>({ schemes: {}, lastScheme: '' })
  const [settings, setSettings] = useState<PluginSettings>({ apiKey: '', promptPresets: {} })

  // ── UI state ──
  const [countries, setCountries] = useState<CountryConfig[]>(DEFAULT_COUNTRIES)
  const [selectedIndustry, setSelectedIndustry] = useState('')
  const [bgImageHash, setBgImageHash] = useState<string | null>(null)
  const [bgBytes, setBgBytes] = useState<number[] | null>(null)
  const [bgThumb, setBgThumb] = useState<string | null>(null)
  const [photoBytes, setPhotoBytes] = useState<number[] | null>(null)
  const [photoThumb, setPhotoThumb] = useState<string | null>(null)
  const [photoName, setPhotoName] = useState<string | null>(null)

  // ── Overlay state ──
  const [showAI, setShowAI] = useState<'bg' | 'photo' | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showSaveInput, setShowSaveInput] = useState(false)
  const [schemeName, setSchemeName] = useState('')

  // ── Generate state ──
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [resultMsg, setResultMsg] = useState<string | null>(null)

  // ── Hidden file inputs ──
  const bgFileRef = useRef<HTMLInputElement>(null)
  const photoFileRef = useRef<HTMLInputElement>(null)

  // ── Listen for messages from main.ts ──
  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      const msg: MainMessage = ev.data?.pluginMessage
      if (!msg) return
      switch (msg.type) {
        case 'INDUSTRIES':
          setIndustries(msg.list)
          if (!selectedIndustry && msg.list.length > 0) setSelectedIndustry(msg.list[0])
          break
        case 'SCHEMES':
          setSchemes(msg.data)
          if (msg.lastScheme && msg.data.schemes[msg.lastScheme]) {
            applyScheme(msg.data.schemes[msg.lastScheme])
          }
          break
        case 'PROGRESS':
          setProgress({ current: msg.current, total: msg.total })
          break
        case 'DONE':
          setGenerating(false)
          setProgress(null)
          if (msg.warnings.length > 0) {
            setResultMsg(`完成，注意：\n${msg.warnings.join('\n')}`)
          } else {
            setResultMsg('✓ 全部生成完成')
          }
          break
        case 'ERROR':
          setGenerating(false)
          setProgress(null)
          setResultMsg(`错误：${msg.message}`)
          break
      }
    }
    window.addEventListener('message', onMessage)
    send({ type: 'GET_INDUSTRIES' })
    send({ type: 'LOAD_SCHEMES' })
    // Load settings from localStorage (clientStorage not accessible from UI side)
    const savedSettings = localStorage.getItem('timemark_settings')
    if (savedSettings) setSettings(JSON.parse(savedSettings))
    return () => window.removeEventListener('message', onMessage)
  }, [])

  function applyScheme(data: SchemeData) {
    setSelectedIndustry(data.industry)
    setBgImageHash(null)
    setBgBytes(null)
    setBgThumb(null)
    setCountries(data.countries)
  }

  // ── File reading helper ──
  function readFile(file: File, onResult: (bytes: number[], thumb: string) => void) {
    const reader = new FileReader()
    reader.onload = () => {
      const buf = reader.result as ArrayBuffer
      const bytes = Array.from(new Uint8Array(buf))
      // Generate thumbnail
      const blob = new Blob([buf], { type: file.type })
      const url = URL.createObjectURL(blob)
      onResult(bytes, url)
    }
    reader.readAsArrayBuffer(file)
  }

  function handleBgFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    readFile(file, (bytes, thumb) => {
      setBgBytes(bytes)
      setBgImageHash(null)
      setBgThumb(thumb)
    })
  }

  function handlePhotoFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    setPhotoName(file.name)
    readFile(file, (bytes, thumb) => {
      setPhotoBytes(bytes)
      setPhotoThumb(thumb)
    })
  }

  // ── Industry dropdown change ──
  function handleIndustryChange(ind: string) {
    setSelectedIndustry(ind)
    // Reset bg to library mode when switching industry
    setBgBytes(null)
    setBgImageHash(null)
    setBgThumb(null)
  }

  // ── Save scheme ──
  function handleSaveScheme() {
    if (!schemeName.trim()) return
    const data: SchemeData = { industry: selectedIndustry, countries }
    send({ type: 'SAVE_SCHEME', name: schemeName.trim(), data })
    setSchemes(s => ({
      schemes: { ...s.schemes, [schemeName.trim()]: data },
      lastScheme: schemeName.trim(),
    }))
    setShowSaveInput(false)
    setSchemeName('')
  }

  // ── Save settings ──
  function handleSaveSettings(s: PluginSettings) {
    setSettings(s)
    localStorage.setItem('timemark_settings', JSON.stringify(s))
    setShowSettings(false)
  }

  // ── Generate ──
  function handleGenerate() {
    const enabled = countries.filter(c => c.enabled)
    if (enabled.length === 0) { setResultMsg('请至少勾选一个国家'); return }
    setGenerating(true)
    setResultMsg(null)
    const msg: UIMessage = {
      type: 'GENERATE',
      configs: enabled,
      industry: selectedIndustry,
      ...(bgImageHash ? { bgImageHash } : {}),
      ...(bgBytes ? { bgBytes } : {}),
      ...(photoBytes ? { photoBytes } : {}),
    }
    send(msg)
  }

  // ── Update country row ──
  function updateCountry(idx: number, patch: Partial<CountryConfig>) {
    setCountries(cs => cs.map((c, i) => i === idx ? { ...c, ...patch } : c))
  }

  const enabledCount = countries.filter(c => c.enabled).length

  return (
    <div style={S.app}>
      {/* ── Top bar ── */}
      <div style={S.topbar}>
        <span style={S.topbarTitle}>Timemark Batch</span>
        <div style={S.topbarRight}>
          {showSaveInput ? (
            <>
              <input
                autoFocus
                value={schemeName}
                onInput={e => setSchemeName((e.target as HTMLInputElement).value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveScheme(); if (e.key === 'Escape') setShowSaveInput(false) }}
                placeholder="方案名称"
                style={{ background: C.surface, border: `1px solid ${C.purple}`, color: C.text, fontSize: 8, borderRadius: 3, padding: '3px 6px', outline: 'none', width: 90 }}
              />
              <button style={{ ...S.btnSecondary, background: C.purple, color: C.bg1 }} onClick={handleSaveScheme}>✓</button>
              <button style={S.btnSecondary} onClick={() => setShowSaveInput(false)}>✕</button>
            </>
          ) : (
            <>
              <select
                style={{ background: C.surface, border: 'none', color: C.subtle, fontSize: 8, borderRadius: 3, padding: '3px 5px', outline: 'none' }}
                value={schemes.lastScheme}
                onChange={e => {
                  const name = (e.target as HTMLSelectElement).value
                  const data = schemes.schemes[name]
                  if (data) applyScheme(data)
                  setSchemes(s => ({ ...s, lastScheme: name }))
                }}
              >
                <option value="">— 方案 —</option>
                {Object.keys(schemes.schemes).map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <button style={S.btnSecondary} onClick={() => setShowSaveInput(true)}>保存</button>
              <button style={{ ...S.btnSecondary, background: C.purple, color: C.bg1, fontWeight: 700 }} onClick={() => setShowSettings(true)}>⚙</button>
            </>
          )}
        </div>
      </div>

      {/* ── Media area ── */}
      <div style={S.mediaArea}>
        {/* Industry bg */}
        <div style={S.mediaCard}>
          <div style={S.mediaLabel}>行业背景</div>
          <div style={S.mediaThumbRow}>
            {bgThumb
              ? <img src={bgThumb} style={{ ...S.mediaThumb }} />
              : <div style={{ ...S.mediaThumb, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>🏗</div>
            }
            <select
              style={{ ...S.select, flex: 1 }}
              value={selectedIndustry}
              onChange={e => handleIndustryChange((e.target as HTMLSelectElement).value)}
            >
              {industries.length === 0 && <option value="">（无行业）</option>}
              {industries.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div style={S.mediaBtnRow}>
            <button style={S.btnLocal} onClick={() => bgFileRef.current?.click()}>⬆ 本地</button>
            <button style={S.btnAI} onClick={() => setShowAI('bg')}>✦ AI</button>
          </div>
        </div>

        {/* Photo */}
        <div style={S.mediaCard}>
          <div style={S.mediaLabel}>示例照片</div>
          <div style={S.mediaThumbRow}>
            {photoThumb
              ? <img src={photoThumb} style={{ ...S.mediaThumb }} />
              : <div style={{ ...S.mediaThumb }} />
            }
            <span style={{ fontSize: 7.5, color: photoName ? C.subtle : C.muted, fontStyle: photoName ? 'normal' : 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {photoName ?? '未选择'}
            </span>
          </div>
          <div style={S.mediaBtnRow}>
            <button style={S.btnLocal} onClick={() => photoFileRef.current?.click()}>⬆ 本地</button>
            <button style={S.btnAI} onClick={() => setShowAI('photo')}>✦ AI</button>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div style={S.tableWrap}>
        <div style={S.tableHead}>
          <span style={{ fontSize: 7.5, color: C.muted }}>
            <input type="checkbox"
              checked={countries.every(c => c.enabled)}
              onChange={e => setCountries(cs => cs.map(c => ({ ...c, enabled: (e.target as HTMLInputElement).checked })))}
              style={{ width: 11, height: 11, accentColor: C.purple }}
            />
          </span>
          {['国家', '标题', '副标题', 'CTA', '水印'].map(h => (
            <span key={h} style={{ fontSize: 7.5, color: C.muted }}>{h}</span>
          ))}
        </div>
        <div style={S.tableBody}>
          {countries.map((c, i) => (
            <div key={c.code} style={{ ...S.tableRow, opacity: c.enabled ? 1 : 0.5 }}>
              <input type="checkbox" checked={c.enabled} onChange={e => updateCountry(i, { enabled: (e.target as HTMLInputElement).checked })} style={{ width: 11, height: 11, accentColor: C.purple }} />
              <span style={{ fontSize: 8, color: C.text }}>{c.flag}{c.code}</span>
              <input style={S.input} value={c.headline} onInput={e => updateCountry(i, { headline: (e.target as HTMLInputElement).value })} placeholder="标题" />
              <input style={S.input} value={c.subheadline} onInput={e => updateCountry(i, { subheadline: (e.target as HTMLInputElement).value })} placeholder="副标题" />
              <input style={S.input} value={c.cta_text} onInput={e => updateCountry(i, { cta_text: (e.target as HTMLInputElement).value })} placeholder="CTA" />
              <select style={S.select} value={c.watermark} onChange={e => updateCountry(i, { watermark: (e.target as HTMLSelectElement).value })}>
                {['en', 'jp', 'kr', 'de', 'fr', 'br', 'mx'].map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div style={S.bottomBar}>
        <div>
          {progress
            ? <span style={{ color: C.muted, fontSize: 8 }}>生成中 {progress.current}/{progress.total}…</span>
            : resultMsg
            ? <span style={{ color: resultMsg.startsWith('错误') ? C.red : C.green, fontSize: 8, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{resultMsg}</span>
            : <span style={{ color: C.muted, fontSize: 8 }}>已选 <strong style={{ color: C.text }}>{enabledCount}</strong> 个国家</span>
          }
        </div>
        <button
          style={{ ...S.btnPrimary, opacity: generating ? 0.5 : 1, cursor: generating ? 'not-allowed' : 'pointer' }}
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? '生成中…' : '生成'}
        </button>
      </div>

      {/* ── Hidden file inputs ── */}
      <input ref={bgFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBgFile} />
      <input ref={photoFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoFile} />

      {/* ── Overlays ── */}
      {showAI && (
        <AIModal
          target={showAI}
          industries={industries}
          selectedIndustry={selectedIndustry}
          promptPresets={settings.promptPresets}
          apiKey={settings.apiKey}
          onClose={() => setShowAI(null)}
          onResult={bytes => {
            if (showAI === 'bg') {
              setBgBytes(bytes)
              setBgImageHash(null)
              // Generate thumbnail from bytes
              const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' })
              setBgThumb(URL.createObjectURL(blob))
            } else {
              setPhotoBytes(bytes)
              setPhotoName('AI 生成')
              const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' })
              setPhotoThumb(URL.createObjectURL(blob))
            }
          }}
        />
      )}
      {showSettings && (
        <SettingsModal
          settings={settings}
          industries={industries}
          onClose={() => setShowSettings(false)}
          onSave={handleSaveSettings}
        />
      )}
    </div>
  )
}

render(<App />, document.getElementById('root')!)
```

- [ ] **Step 2: Check if the scaffold uses Preact or React**

```bash
cd "/Users/Gloria/Figma Plugin"
cat package.json | grep -E '"preact|"react'
```

- If it shows `"preact"`: the imports `h, render` from `'preact'` and hooks from `'preact/hooks'` are correct as written above.
- If it shows `"react"`: change the top imports to:
  ```tsx
  import React, { useState, useEffect, useRef, useCallback } from 'react'
  import ReactDOM from 'react-dom/client'
  ```
  And change the bottom render call to:
  ```tsx
  ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
  ```
  And remove `h` from all imports (JSX uses React automatically with the right tsconfig).

- [ ] **Step 3: Build**

```bash
cd "/Users/Gloria/Figma Plugin"
npm run build
```

Expected: successful build. Common errors to fix:
- `'h' is declared but its value is never read` → remove `h` from import if using React
- `Property 'setPropertiesAsync' does not exist` → in main.ts change to `instance.setProperties(...)` (synchronous version)
- `Cannot find module './types'` → make sure `src/types.ts` exists

- [ ] **Step 4: Commit**

```bash
cd "/Users/Gloria/Figma Plugin"
git add src/ui.tsx
git commit -m "feat: implement full UI — main view, AI modal, settings modal"
```

---

## Chunk 4: Integration Test & Final Polish

### Task 5: Test in Figma and fix issues

**Files:**
- Possibly modify: `src/main.ts`, `src/ui.tsx`

- [ ] **Step 1: Import plugin in Figma Desktop**

1. Open Figma Desktop app
2. Open any Figma file
3. Menu → Plugins → Development → Import plugin from manifest
4. Select `/Users/Gloria/Figma Plugin/manifest.json`

- [ ] **Step 2: Set up test fixture in Figma**

1. Create a Frame named `__bg_library__` (can be anywhere on the canvas)
2. Inside it, add a Rectangle named `construction`, fill it with any image
3. Create a Main Component (not an instance) — add Component Properties:
   - `headline` (Text)
   - `subheadline` (Text)
   - `cta_text` (Text)
   - `watermark` (Variant — add values: `en`, `jp`, `kr`, `de`, `fr`, `br`, `mx`)
4. Inside the component, add:
   - A Rectangle named `bg`
   - A Rectangle named `mockup/photo`
5. Select the Main Component on canvas

- [ ] **Step 3: Run plugin and verify basic flow**

1. Right-click → Plugins → Development → Timemark Batch
2. Plugin opens at 360×560px
3. Industry dropdown shows `construction`
4. Check 2-3 countries, fill in headline/subheadline/cta
5. Click 「生成」
6. Verify: instances appear on canvas, named `US_ad`, `JP_ad`, etc., centered in viewport

- [ ] **Step 4: Test AI generation**

1. Go to ⚙ settings, enter a valid OpenAI API Key, save
2. Click「✦ AI」next to 行业背景
3. Verify: modal opens, preset is empty (no preset configured yet)
4. Expand `construction` in settings, add a prompt, save
5. Re-open AI modal — preset now shows
6. Generate — verify thumbnail updates after generation

- [ ] **Step 5: Test scheme save/load**

1. Fill in some country data
2. Click 「保存」in topbar, type a scheme name, press Enter
3. Change some data, then switch back to the scheme — verify it restores

- [ ] **Step 6: Final build and commit**

```bash
cd "/Users/Gloria/Figma Plugin"
npm run build
git add -A
git commit -m "feat: timemark batch plugin complete — all features implemented"
```
