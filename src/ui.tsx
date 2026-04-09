// src/ui.tsx
import { h, render, Fragment } from 'preact'
import { useState, useEffect, useRef } from 'preact/hooks'
import {
  CountryConfig, DEFAULT_COUNTRIES, LANG_MAP, MS_LANG_MAP, DEEPL_LANG_MAP,
  SchemesStore, SchemeData, PluginSettings, TranslateProvider, DEFAULT_SETTINGS,
  WatermarkConfig, DEFAULT_WATERMARK_CONFIG, LOCALE_MAP,
  UIMessage, MainMessage, HighlightRange, HighlightFill
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
  app: { display: 'flex', flexDirection: 'column' as const, width: 360, height: 560, background: C.bg1, fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 12, color: C.text, overflow: 'hidden' },
  topbar: { height: 48, background: C.bg2, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', flexShrink: 0 },
  topbarTitle: { fontSize: 12, fontWeight: 700, color: C.text, letterSpacing: 0.3 },
  topbarRight: { display: 'flex', gap: 4, alignItems: 'center' },
  mediaArea: { padding: '8px 9px 6px', display: 'flex', gap: 6, flexShrink: 0 },
  mediaCard: { flex: 1, background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 7px' },
  mediaLabel: { fontSize: 7, color: C.muted, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 4 },
  mediaThumbRow: { display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 },
  mediaThumb: { width: 22, height: 22, background: C.overlay, borderRadius: 3, flexShrink: 0, objectFit: 'cover' as const },
  mediaBtnRow: { display: 'flex', gap: 3 },
  tableWrap: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' as const, padding: '0 9px' },
  tableHead: { display: 'grid', gridTemplateColumns: '16px 40px 1fr 1fr 34px 40px', gap: 3, background: C.surface, borderRadius: '4px 4px 0 0', padding: '4px 6px' },
  tableBody: { flex: 1, overflowY: 'auto' as const, background: C.bg2, border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 4px 4px' },
  tableRow: { display: 'grid', gridTemplateColumns: '16px 40px 1fr 1fr 34px 40px', gap: 3, padding: '3px 6px', borderBottom: `1px solid ${C.border}`, alignItems: 'center' },
  bottomBar: { height: 48, background: C.bg2, borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', flexShrink: 0 },
  btnPrimary: { background: C.purple, border: 'none', color: C.bg1, fontSize: 9, fontWeight: 700, borderRadius: 5, padding: '6px 16px', cursor: 'pointer' },
  btnSecondary: { background: C.surface, border: 'none', color: C.subtle, fontSize: 8, borderRadius: 3, padding: '3px 6px', cursor: 'pointer' },
  btnAI: { flex: 1, background: `${C.green}15`, border: `1px solid ${C.green}40`, color: C.green, fontSize: 7.5, borderRadius: 3, padding: '3px 2px', cursor: 'pointer' },
  btnLocal: { flex: 1, background: C.surface, border: 'none', color: C.subtle, fontSize: 7.5, borderRadius: 3, padding: '3px 2px', cursor: 'pointer' },
  input: { background: C.surface, border: 'none', color: C.subtle, fontSize: 7.5, borderRadius: 2, padding: '2px 3px', width: '100%', outline: 'none' },
  select: { background: C.surface, border: 'none', color: C.subtle, fontSize: 7.5, borderRadius: 2, padding: '2px 1px', width: '100%', outline: 'none' },
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
  selectedIndustry: string
  promptPresets: Record<string, string>
  apiKey: string
  geminiKey: string
  onClose: () => void
  onResult: (bytes: number[]) => void
}

function AIModal({ target, selectedIndustry, promptPresets, apiKey, geminiKey, onClose, onResult }: AIModalProps) {
  const [customPrompt, setCustomPrompt] = useState('')
  const [imageProvider, setImageProvider] = useState<'openai' | 'gemini'>('openai')
  const [size, setSize] = useState('1792x1024')
  const [quality, setQuality] = useState('standard')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const preset = promptPresets[selectedIndustry] ?? ''
  const finalPrompt = customPrompt.trim() || preset

  async function generate() {
    if (!finalPrompt) { setError('请输入 Prompt 或在设置中配置预设'); return }
    setLoading(true)
    setError('')
    abortRef.current = new AbortController()
    try {
      let bytes: number[]
      if (imageProvider === 'openai') {
        const trimmedKey = apiKey.trim()
        if (!trimmedKey) { setError('请先在设置中填写 OpenAI API Key'); setLoading(false); return }
        const res = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${trimmedKey}` },
          signal: abortRef.current.signal,
          body: JSON.stringify({ model: 'dall-e-3', prompt: finalPrompt, n: 1, size, quality, response_format: 'b64_json' }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error?.message ?? `HTTP ${res.status}`)
        const b64: string = json.data[0].b64_json
        const binary = atob(b64)
        const arr = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i)
        bytes = Array.from(arr)
      } else {
        const trimmedKey = geminiKey.trim()
        if (!trimmedKey) { setError('请先在设置中填写 Gemini API Key'); setLoading(false); return }
        const aspectRatio = size === '1792x1024' ? '16:9' : size === '1024x1792' ? '9:16' : '1:1'
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': trimmedKey },
          signal: abortRef.current.signal,
          body: JSON.stringify({ instances: [{ prompt: finalPrompt }], parameters: { aspectRatio, sampleCount: 1 } }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error?.message ?? `HTTP ${res.status}`)
        const b64: string = json.predictions[0].bytesBase64Encoded
        const binary = atob(b64)
        const arr = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i)
        bytes = Array.from(arr)
      }
      onResult(bytes)
      onClose()
    } catch (e: unknown) {
      const err = e as Error
      if (err.name !== 'AbortError') setError(`${err.name}: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    abortRef.current?.abort()
    onClose()
  }

  const label = target === 'bg' ? '行业背景' : '示例照片'
  const tabStyle = (active: boolean) => ({
    flex: 1, background: active ? C.surface : 'transparent', border: `1px solid ${active ? C.purple : C.border}`,
    color: active ? C.purple : C.muted, fontSize: 8, borderRadius: 4, padding: '4px 0', cursor: 'pointer',
  })
  return (
    <div style={S.backdrop} onClick={(e: MouseEvent) => { if (e.target === e.currentTarget) handleClose() }}>
      <div style={{ ...S.modal, borderColor: C.green }}>
        <div style={S.modalHeader}>
          <div>
            <span style={{ color: C.green, fontSize: 10, fontWeight: 700 }}>✦ AI 生成图片</span>
            <span style={{ background: C.surface, color: C.muted, fontSize: 8, borderRadius: 10, padding: '2px 7px', marginLeft: 6 }}>{label}</span>
          </div>
          <button style={{ background: 'none', border: 'none', color: C.muted, fontSize: 14, cursor: 'pointer' }} onClick={handleClose}>✕</button>
        </div>
        <div style={S.modalBody}>
          {/* Provider toggle */}
          <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
            <button style={tabStyle(imageProvider === 'openai')} onClick={() => setImageProvider('openai')}>OpenAI DALL-E 3</button>
            <button style={tabStyle(imageProvider === 'gemini')} onClick={() => setImageProvider('gemini')}>Gemini Imagen 4</button>
          </div>
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
              onInput={(e: Event) => setCustomPrompt((e.target as HTMLTextAreaElement).value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: C.muted, fontSize: 8, marginBottom: 3 }}>图片尺寸</div>
              <select style={{ width: '100%', background: C.surface, border: `1px solid ${C.overlay}`, color: C.subtle, fontSize: 8.5, borderRadius: 5, padding: '5px 7px', outline: 'none' }} value={size} onChange={(e: Event) => setSize((e.target as HTMLSelectElement).value)}>
                <option value="1792x1024">1792×1024（横版）</option>
                <option value="1024x1024">1024×1024（方形）</option>
                <option value="1024x1792">1024×1792（竖版）</option>
              </select>
            </div>
            {imageProvider === 'openai' && (
              <div style={{ flex: 1 }}>
                <div style={{ color: C.muted, fontSize: 8, marginBottom: 3 }}>生成质量</div>
                <select style={{ width: '100%', background: C.surface, border: `1px solid ${C.overlay}`, color: C.subtle, fontSize: 8.5, borderRadius: 5, padding: '5px 7px', outline: 'none' }} value={quality} onChange={(e: Event) => setQuality((e.target as HTMLSelectElement).value)}>
                  <option value="standard">standard</option>
                  <option value="hd">hd</option>
                </select>
              </div>
            )}
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
  const [geminiKey, setGeminiKey] = useState(settings.geminiKey)
  const [deeplKey, setDeeplKey] = useState(settings.deeplKey)
  const [msKey, setMsKey] = useState(settings.msTranslatorKey)
  const [msRegion, setMsRegion] = useState(settings.msTranslatorRegion)
  const [showKey, setShowKey] = useState(false)
  const [presets, setPresets] = useState<Record<string, string>>({ ...settings.promptPresets })
  const [expanded, setExpanded] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function handleSave() {
    onSave({ ...settings, apiKey, geminiKey, deeplKey, msTranslatorKey: msKey, msTranslatorRegion: msRegion, promptPresets: presets })
    setSaved(true)
  }

  function updatePreset(industry: string, val: string) {
    setPresets(p => ({ ...p, [industry]: val }))
  }

  return (
    <div style={S.backdrop} onClick={(e: MouseEvent) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ ...S.modal, borderColor: C.purple }}>
        <div style={S.modalHeader}>
          <span style={{ color: C.purple, fontSize: 10, fontWeight: 700 }}>⚙ 设置</span>
          <button style={{ background: 'none', border: 'none', color: C.muted, fontSize: 14, cursor: 'pointer' }} onClick={onClose}>✕</button>
        </div>
        <div style={S.modalBody}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ color: C.muted, fontSize: 8, marginBottom: 4 }}>OpenAI API Key（AI 生图用）</div>
            <div style={{ display: 'flex', gap: 5 }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onInput={(e: Event) => setApiKey((e.target as HTMLInputElement).value)}
                placeholder="sk-proj-…"
                style={{ flex: 1, background: C.bg1, border: `1px solid ${C.overlay}`, color: C.subtle, fontSize: 8.5, borderRadius: 5, padding: '5px 8px', outline: 'none' }}
              />
              <button style={S.btnSecondary} onClick={() => setShowKey(v => !v)}>{showKey ? '隐藏' : '显示'}</button>
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ color: C.muted, fontSize: 8, marginBottom: 4 }}>Gemini API Key（AI 生图用）</div>
            <input
              type="password"
              value={geminiKey}
              onInput={(e: Event) => setGeminiKey((e.target as HTMLInputElement).value)}
              placeholder="AIza…"
              style={{ width: '100%', boxSizing: 'border-box', background: C.bg1, border: `1px solid ${C.overlay}`, color: C.subtle, fontSize: 8.5, borderRadius: 5, padding: '5px 8px', outline: 'none' }}
            />
            <div style={{ color: C.muted, fontSize: 7.5, marginTop: 2 }}>用于 Gemini Imagen 3 生图，在 Google AI Studio 获取</div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ color: C.muted, fontSize: 8, marginBottom: 4 }}>DeepL API Key（可选，翻译用）</div>
            <input
              type="password"
              value={deeplKey}
              onInput={(e: Event) => setDeeplKey((e.target as HTMLInputElement).value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx"
              style={{ width: '100%', boxSizing: 'border-box', background: C.bg1, border: `1px solid ${C.overlay}`, color: C.subtle, fontSize: 8.5, borderRadius: 5, padding: '5px 8px', outline: 'none' }}
            />
            <div style={{ color: C.muted, fontSize: 7.5, marginTop: 2 }}>免费版 Key 末尾为 :fx，500k字符/月。不支持 VN/TH/SA（自动降级 Google）</div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ color: C.muted, fontSize: 8, marginBottom: 4 }}>Microsoft Translator Key（可选，翻译用）</div>
            <div style={{ display: 'flex', gap: 5, marginBottom: 4 }}>
              <input
                type="password"
                value={msKey}
                onInput={(e: Event) => setMsKey((e.target as HTMLInputElement).value)}
                placeholder="Azure Subscription Key"
                style={{ flex: 2, background: C.bg1, border: `1px solid ${C.overlay}`, color: C.subtle, fontSize: 8.5, borderRadius: 5, padding: '5px 8px', outline: 'none' }}
              />
              <input
                value={msRegion}
                onInput={(e: Event) => setMsRegion((e.target as HTMLInputElement).value)}
                placeholder="Region (e.g. eastus)"
                style={{ flex: 1, background: C.bg1, border: `1px solid ${C.overlay}`, color: C.subtle, fontSize: 8.5, borderRadius: 5, padding: '5px 8px', outline: 'none' }}
              />
            </div>
            <div style={{ color: C.muted, fontSize: 7.5 }}>免费 F0 档 2M字符/月，支持全部语言</div>
          </div>
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
                        onInput={(e: Event) => updatePreset(ind, (e.target as HTMLTextAreaElement).value)}
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
            style={{ width: '100%', background: saved ? C.green : C.purple, border: 'none', color: C.bg1, fontSize: 9, fontWeight: 700, borderRadius: 6, padding: 8, cursor: 'pointer', transition: 'background 0.2s' }}
            onClick={handleSave}
          >
            {saved ? '✓ 已保存' : '保存设置'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────
function App() {
  const [industries, setIndustries] = useState<string[]>([])
  const [schemes, setSchemes] = useState<SchemesStore>({ schemes: {}, lastScheme: '' })
  const [settings, setSettings] = useState<PluginSettings>(DEFAULT_SETTINGS)
  const [translateProvider, setTranslateProvider] = useState<TranslateProvider>('google')

  const [countries, setCountries] = useState<CountryConfig[]>(DEFAULT_COUNTRIES)
  const [selectedIndustry, setSelectedIndustry] = useState('')
  const [bgImageHash, setBgImageHash] = useState<string | null>(null)
  const [bgBytes, setBgBytes] = useState<number[] | null>(null)
  const [bgThumb, setBgThumb] = useState<string | null>(null)
  const [photoBytes, setPhotoBytes] = useState<number[] | null>(null)
  const [photoThumb, setPhotoThumb] = useState<string | null>(null)
  const [photoName, setPhotoName] = useState<string | null>(null)

  const [showAI, setShowAI] = useState<'bg' | 'photo' | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showSaveInput, setShowSaveInput] = useState(false)
  const [schemeName, setSchemeName] = useState('')

  const [generating, setGenerating] = useState(false)
  const [batchTranslating, setBatchTranslating] = useState(false)
  const [wmConfig, setWmConfig] = useState<WatermarkConfig>(DEFAULT_WATERMARK_CONFIG)
  const [excludeLayerInput, setExcludeLayerInput] = useState('logo')
  const [nameSuffix, setNameSuffix] = useState('Msg')
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [resultMsg, setResultMsg] = useState<string | null>(null)

  const bgFileRef = useRef<HTMLInputElement>(null)
  const photoFileRef = useRef<HTMLInputElement>(null)
  const batchScanResolveRef = useRef<((texts: { pathKey: string; content: string }[]) => void) | null>(null)
  const batchScanRejectRef = useRef<((err: Error) => void) | null>(null)
  const hlStyleResolveRef = useRef<((style: { text: string; highlightRanges: HighlightRange[]; dominantFills: HighlightFill[]; pathKey: string }) => void) | null>(null)
  const hlStyleRejectRef = useRef<((err: Error) => void) | null>(null)

  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      const msg: MainMessage = ev.data?.pluginMessage
      if (!msg) return
      switch (msg.type) {
        case 'SETTINGS': {
          const s = msg.settings
          setSettings(prev => ({ ...prev, ...s, promptPresets: { ...prev.promptPresets, ...s.promptPresets } }))
          if (s.translateProvider) setTranslateProvider(s.translateProvider)
          break
        }
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
        case 'ALL_COMPONENT_TEXTS':
          if (batchScanResolveRef.current) {
            batchScanResolveRef.current(msg.texts)
            batchScanResolveRef.current = null
            batchScanRejectRef.current = null
          }
          break
        case 'PROGRESS':
          setProgress({ current: msg.current, total: msg.total })
          break
        case 'DONE':
          setGenerating(false)
          setBatchTranslating(false)
          setProgress(null)
          setResultMsg(msg.warnings.length > 0 ? `完成，注意：\n${msg.warnings.join('\n')}` : '✓ 全部生成完成')
          break
        case 'HEADLINE_STYLE':
          if (hlStyleResolveRef.current) {
            hlStyleResolveRef.current({ text: msg.text, highlightRanges: msg.highlightRanges, dominantFills: msg.dominantFills, pathKey: msg.pathKey })
            hlStyleResolveRef.current = null; hlStyleRejectRef.current = null
          }
          break
        case 'ERROR':
          setGenerating(false)
          setProgress(null)
          setResultMsg(`错误：${msg.message}`)
          setBatchTranslating(false)
          if (batchScanRejectRef.current) {
            batchScanRejectRef.current(new Error(msg.message))
            batchScanResolveRef.current = null; batchScanRejectRef.current = null
          }
          if (hlStyleRejectRef.current) {
            hlStyleRejectRef.current(new Error(msg.message))
            hlStyleResolveRef.current = null; hlStyleRejectRef.current = null
          }
          break
      }
    }
    window.addEventListener('message', onMessage)
    send({ type: 'GET_INDUSTRIES' })
    send({ type: 'LOAD_SCHEMES' })
    return () => window.removeEventListener('message', onMessage)
  }, [])

  function applyScheme(data: SchemeData) {
    setSelectedIndustry(data.industry)
    setBgImageHash(null)
    setBgBytes(null)
    setBgThumb(null)
    setCountries(data.countries)
  }

  function readFile(file: File, onResult: (bytes: number[], thumb: string) => void) {
    const reader = new FileReader()
    reader.onload = () => {
      const buf = reader.result as ArrayBuffer
      const bytes = Array.from(new Uint8Array(buf))
      const blob = new Blob([buf], { type: file.type })
      onResult(bytes, URL.createObjectURL(blob))
    }
    reader.readAsArrayBuffer(file)
  }

  function handleBgFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    readFile(file, (bytes, thumb) => { setBgBytes(bytes); setBgImageHash(null); setBgThumb(thumb) })
  }

  function handlePhotoFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    setPhotoName(file.name)
    readFile(file, (bytes, thumb) => { setPhotoBytes(bytes); setPhotoThumb(thumb) })
  }

  function handleIndustryChange(ind: string) {
    setSelectedIndustry(ind)
    setBgBytes(null)
    setBgImageHash(null)
    setBgThumb(null)
  }

  function handleSaveScheme() {
    if (!schemeName.trim()) return
    const data: SchemeData = { industry: selectedIndustry, countries }
    send({ type: 'SAVE_SCHEME', name: schemeName.trim(), data })
    setSchemes(s => ({ schemes: { ...s.schemes, [schemeName.trim()]: data }, lastScheme: schemeName.trim() }))
    setShowSaveInput(false)
    setSchemeName('')
  }

  function handleSaveSettings(s: PluginSettings) {
    const full = { ...s, translateProvider }
    setSettings(full)
    send({ type: 'SAVE_SETTINGS', settings: full })
    setShowSettings(false)
  }

  // ── Headline-style reader ─────────────────────────────────────────
  async function readHeadlineStyle(): Promise<{ text: string; highlightRanges: HighlightRange[]; dominantFills: HighlightFill[]; pathKey: string }> {
    return new Promise((resolve, reject) => {
      hlStyleResolveRef.current = resolve
      hlStyleRejectRef.current = reject
      setTimeout(() => {
        hlStyleResolveRef.current = null; hlStyleRejectRef.current = null
        reject(new Error('读取 headline 样式超时，请确认已选中 Main Component'))
      }, 6000)
      send({ type: 'READ_HEADLINE_STYLE' })
    })
  }

  // ── Translate headline, preserving highlight range via markers ───
  // Strategy: wrap the highlighted portion with bracket-style tokens that
  // translation APIs tend to leave intact.  Multiple fallbacks handle the
  // cases where the API strips or garbles the markers.
  const HL_OPEN  = '«HL»'   // shorter, bracket-style — survives most translation APIs
  const HL_CLOSE = '«/HL»'

  async function translateHeadlineWithHighlight(
    text: string,
    ranges: Array<{ start: number; end: number }>,
    code: string
  ): Promise<{ translatedText: string; translatedRange: { start: number; end: number } | null }> {
    if (ranges.length === 0) {
      return { translatedText: await translateOneText(text, code), translatedRange: null }
    }
    const range = ranges[0]
    const hlText = text.slice(range.start, range.end)
    const marked = text.slice(0, range.start) + HL_OPEN + hlText + HL_CLOSE + text.slice(range.end)

    const translatedMarked = await translateOneText(marked, code)

    // ── Method 1: markers survived intact ────────────────────────────
    const oIdx = translatedMarked.indexOf(HL_OPEN)
    const cIdx = translatedMarked.indexOf(HL_CLOSE)
    if (oIdx !== -1 && cIdx !== -1 && cIdx > oIdx) {
      const translatedText = translatedMarked.replace(HL_OPEN, '').replace(HL_CLOSE, '')
      return { translatedText, translatedRange: { start: oIdx, end: cIdx - HL_OPEN.length } }
    }

    // Markers stripped — work with the clean translation
    const cleanText = translatedMarked
      .replace(new RegExp(HL_OPEN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '')
      .replace(new RegExp(HL_CLOSE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '')

    // ── Method 2: translate the highlight phrase separately, find in full text ─
    const hlTextTrimmed = hlText.trim()
    if (hlTextTrimmed) {
      try {
        const translatedHl = (await translateOneText(hlTextTrimmed, code)).trim()
        if (translatedHl) {
          // Case-insensitive substring search
          const lowerFull = cleanText.toLowerCase()
          const lowerHl   = translatedHl.toLowerCase()
          const idx = lowerFull.indexOf(lowerHl)
          if (idx !== -1) {
            return { translatedText: cleanText, translatedRange: { start: idx, end: idx + translatedHl.length } }
          }
          // Try partial: match first word of the translated highlight
          const firstWord = lowerHl.split(/\s+/)[0]
          if (firstWord && firstWord.length > 2) {
            const wIdx = lowerFull.indexOf(firstWord)
            if (wIdx !== -1) {
              // Extend match to cover approximately the same character count
              const approxEnd = Math.min(wIdx + translatedHl.length, cleanText.length)
              return { translatedText: cleanText, translatedRange: { start: wIdx, end: approxEnd } }
            }
          }
        }
      } catch { /* ignore */ }
    }

    // ── Method 3: proportional range approximation ────────────────────
    // Maps the highlight's position/length proportionally into the translated text.
    // Rough but better than no highlight at all.
    if (text.length > 0 && cleanText.length > 0) {
      const ratio   = cleanText.length / text.length
      const approxStart = Math.round(range.start * ratio)
      const approxEnd   = Math.min(Math.round(range.end * ratio), cleanText.length)
      if (approxEnd > approxStart) {
        return { translatedText: cleanText, translatedRange: { start: approxStart, end: approxEnd } }
      }
    }

    return { translatedText: cleanText, translatedRange: null }
  }

  async function translateOneText(text: string, code: string): Promise<string> {
    if (!text.trim()) return ''
    async function gtGoogle(t: string, lang: string): Promise<string> {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${lang}&dt=t&q=${encodeURIComponent(t)}`
      const res = await fetch(url)
      const data = await res.json()
      return (data[0] as [string][]).map((c: [string]) => c[0]).join('')
    }
    if (translateProvider === 'google') return gtGoogle(text, LANG_MAP[code] ?? 'en')
    if (translateProvider === 'mymemory') {
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${LANG_MAP[code] ?? 'en'}`)
      const data = await res.json()
      if (data.responseStatus !== 200) throw new Error(data.responseDetails ?? 'MyMemory error')
      return data.responseData.translatedText
    }
    if (translateProvider === 'deepl') {
      const dlLang = DEEPL_LANG_MAP[code]
      if (!dlLang) return gtGoogle(text, LANG_MAP[code] ?? 'en')
      const endpoint = settings.deeplKey.trim().endsWith(':fx') ? 'https://api-free.deepl.com/v2/translate' : 'https://api.deepl.com/v2/translate'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Authorization': `DeepL-Auth-Key ${settings.deeplKey.trim()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: [text], source_lang: 'EN', target_lang: dlLang }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`)
      return data.translations[0].text
    }
    if (translateProvider === 'microsoft') {
      const lang = MS_LANG_MAP[code] ?? LANG_MAP[code] ?? 'en'
      const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Ocp-Apim-Subscription-Key': settings.msTranslatorKey.trim() }
      if (settings.msTranslatorRegion.trim()) headers['Ocp-Apim-Subscription-Region'] = settings.msTranslatorRegion.trim()
      const res = await fetch(`https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=en&to=${lang}`, {
        method: 'POST', headers, body: JSON.stringify([{ Text: text }]),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`)
      return data[0].translations[0].text
    }
    return text
  }

  async function handleGenerate() {
    const enabled = countries.filter(c => c.enabled)
    if (enabled.length === 0) { setResultMsg('请至少勾选一个国家'); return }
    setGenerating(true)
    setResultMsg(null)

    // Pre-compute watermark strings in UI (Intl is available here, not in Figma sandbox)
    let watermarkTexts: Record<string, { dateStr: string; weekdayStr: string }> | undefined
    let weekdayNames: string[] | undefined
    if (wmConfig.watermarkLayerName.trim()) {
      const today = new Date()
      watermarkTexts = {}
      for (const c of enabled) {
        const locale = LOCALE_MAP[c.code] ?? 'en-US'
        watermarkTexts[c.code] = {
          dateStr: new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(today),
          weekdayStr: new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(today),
        }
      }
      // Build weekday detection set across all locales (long + short forms)
      const nameSet = new Set<string>()
      const baseMonday = new Date('2024-01-01')
      const detectionLocales = ['en-US','zh-CN','zh-TW','ja-JP','ko-KR','de-DE','fr-FR','pt-BR','es-MX','id-ID','vi-VN','th-TH','ar-SA']
      for (const locale of detectionLocales) {
        for (let i = 0; i < 7; i++) {
          const d = new Date(baseMonday)
          d.setDate(d.getDate() + i)
          nameSet.add(new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(d).toLowerCase())
          nameSet.add(new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(d).toLowerCase())
        }
      }
      weekdayNames = Array.from(nameSet)
    }

    const msg: UIMessage = {
      type: 'GENERATE',
      configs: enabled,
      industry: selectedIndustry,
      ...(bgImageHash ? { bgImageHash } : {}),
      ...(bgBytes ? { bgBytes } : {}),
      ...(photoBytes ? { photoBytes } : {}),
      ...(wmConfig.watermarkLayerName.trim() ? { watermarkConfig: wmConfig } : {}),
      ...(watermarkTexts ? { watermarkTexts } : {}),
      ...(weekdayNames ? { weekdayNames } : {}),
      ...(nameSuffix.trim() ? { nameSuffix: nameSuffix.trim() } : {}),
    }
    send(msg)
  }

  // ── Batch translate helpers ───────────────────────────────────────
  function scanAllTexts(): Promise<{ pathKey: string; content: string }[]> {
    return new Promise((resolve, reject) => {
      batchScanResolveRef.current = resolve
      batchScanRejectRef.current = reject
      const excludeLayerNames = excludeLayerInput.split(',').map(s => s.trim()).filter(Boolean)
      // Watermark is now included in the scan so non-date/time texts (e.g. weather) get translated.
      // applyWatermark in main.ts will still override date/weekday/address with Intl-formatted values.
      send({ type: 'SCAN_ALL_TEXTS', excludeLayerNames })
    })
  }

  async function handleBatchTranslate() {
    const enabled = countries.filter(c => c.enabled)
    if (enabled.length === 0) { setResultMsg('请至少勾选一个国家'); return }
    setBatchTranslating(true)
    setResultMsg(null)
    setProgress(null)
    try {
      const texts = await scanAllTexts()
      if (texts.length === 0) { setResultMsg('未找到可翻译的文本'); setBatchTranslating(false); return }

      // ── Headline highlight detection ──────────────────────────────
      // Try to read the highlight style from the selected component. If the
      // headline node has mixed fills (e.g. blue keyword on black text), we
      // wrap the highlighted portion with markers before sending to the
      // translation API, then map the markers back to a character range in
      // the translated string so the fill can be re-applied in main.ts.
      let hlStyle: { text: string; highlightRanges: HighlightRange[]; dominantFills: HighlightFill[]; pathKey: string } | null = null
      try { hlStyle = await readHeadlineStyle() } catch { /* no component selected — highlight skipped */ }

      // main.ts returns the exact pathKey of the headline text node,
      // so no content-based guessing needed here.
      const headlinePathKey = hlStyle?.pathKey || null
      const hlRanges = hlStyle?.highlightRanges ?? []
      const hlFills: HighlightFill[] = hlRanges.length > 0 ? hlRanges[0].fills : []
      const hlDominantFills: HighlightFill[] = hlStyle?.dominantFills ?? []
      const headlineHighlights: Record<string, { start: number; end: number } | null> = {}

      // ── Determine source headline ─────────────────────────────────
      // If user filled the US row headline, use that as the translation source;
      // otherwise fall back to the text read directly from the Figma node.
      const usRow = countries.find(c => c.code === 'US')
      const sourceHeadline = usRow?.headline.trim() || hlStyle?.text.trim() || ''

      // ── Per-country translation ───────────────────────────────────
      const translations: { code: string; texts: { pathKey: string; content: string }[] }[] = []
      for (const c of enabled) {
        if (c.code === 'US') {
          // For the US instance, override the headline with sourceHeadline if user typed one
          const usTexts = texts.map(t => {
            if (t.pathKey === headlinePathKey && usRow?.headline.trim()) {
              return { pathKey: t.pathKey, content: sourceHeadline }
            }
            return { ...t }
          })
          translations.push({ code: 'US', texts: usTexts })
          headlineHighlights['US'] = hlRanges.length > 0 ? { start: hlRanges[0].start, end: hlRanges[0].end } : null
          continue
        }
        const translated: { pathKey: string; content: string }[] = []
        for (const t of texts) {
          const isHeadline = t.pathKey === headlinePathKey && !!headlinePathKey
          const textToTranslate = isHeadline && sourceHeadline ? sourceHeadline : t.content
          if (isHeadline && hlRanges.length > 0) {
            // Translate headline with highlight marker preservation
            const hlResult = await translateHeadlineWithHighlight(textToTranslate, hlRanges, c.code)
            translated.push({ pathKey: t.pathKey, content: hlResult.translatedText })
            headlineHighlights[c.code] = hlResult.translatedRange
          } else {
            const content = await translateOneText(textToTranslate, c.code)
            translated.push({ pathKey: t.pathKey, content })
            if (isHeadline) headlineHighlights[c.code] = null
          }
        }
        translations.push({ code: c.code, texts: translated })
      }

      // ── Watermark date/weekday Intl formatting ────────────────────
      let watermarkTexts: Record<string, { dateStr: string; weekdayStr: string }> | undefined
      let weekdayNames: string[] | undefined
      if (wmConfig.watermarkLayerName.trim()) {
        const today = new Date()
        watermarkTexts = {}
        for (const c of enabled) {
          const locale = LOCALE_MAP[c.code] ?? 'en-US'
          watermarkTexts[c.code] = {
            dateStr: new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(today),
            weekdayStr: new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(today),
          }
        }
        const nameSet = new Set<string>()
        const baseMonday = new Date('2024-01-01')
        const detectionLocales = ['en-US','zh-CN','zh-TW','ja-JP','ko-KR','de-DE','fr-FR','pt-BR','es-MX','id-ID','vi-VN','th-TH','ar-SA']
        for (const locale of detectionLocales) {
          for (let i = 0; i < 7; i++) {
            const d = new Date(baseMonday); d.setDate(d.getDate() + i)
            nameSet.add(new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(d).toLowerCase())
            nameSet.add(new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(d).toLowerCase())
          }
        }
        weekdayNames = Array.from(nameSet)
      }

      send({
        type: 'BATCH_TRANSLATE',
        configs: enabled,
        translations,
        ...(wmConfig.watermarkLayerName.trim() ? { watermarkConfig: wmConfig } : {}),
        ...(watermarkTexts ? { watermarkTexts } : {}),
        ...(weekdayNames ? { weekdayNames } : {}),
        ...(nameSuffix.trim() ? { nameSuffix: nameSuffix.trim() } : {}),
        ...(headlinePathKey ? {
          headlinePathKey,
          headlineHighlights,
          headlineHighlightFills: hlFills,
          headlineDominantFills: hlDominantFills,
        } : {}),
      })
    } catch (e: unknown) {
      setResultMsg(`批量翻译失败: ${(e as Error).message}`)
      setBatchTranslating(false)
    }
  }

  function updateCountry(idx: number, patch: Partial<CountryConfig>) {
    setCountries(cs => cs.map((c, i) => i === idx ? { ...c, ...patch } : c))
  }

  const enabledCount = countries.filter(c => c.enabled).length
  const allChecked = countries.every(c => c.enabled)

  return (
    <div style={S.app}>
      {/* Top bar */}
      <div style={S.topbar}>
        <span style={S.topbarTitle}>Timemark Batch</span>
        <div style={S.topbarRight}>
          {showSaveInput ? (
            <Fragment>
              <input
                autoFocus
                value={schemeName}
                onInput={(e: Event) => setSchemeName((e.target as HTMLInputElement).value)}
                onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Enter') handleSaveScheme(); if (e.key === 'Escape') setShowSaveInput(false) }}
                placeholder="方案名称"
                style={{ background: C.surface, border: `1px solid ${C.purple}`, color: C.text, fontSize: 8, borderRadius: 3, padding: '3px 6px', outline: 'none', width: 90 }}
              />
              <button style={{ ...S.btnSecondary, background: C.purple, color: C.bg1 }} onClick={handleSaveScheme}>✓</button>
              <button style={S.btnSecondary} onClick={() => setShowSaveInput(false)}>✕</button>
            </Fragment>
          ) : (
            <Fragment>
              <select
                style={{ background: C.surface, border: 'none', color: C.subtle, fontSize: 8, borderRadius: 3, padding: '3px 5px', outline: 'none' }}
                value={schemes.lastScheme}
                onChange={(e: Event) => {
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
            </Fragment>
          )}
        </div>
      </div>

      {/* Media area */}
      <div style={S.mediaArea}>
        <div style={S.mediaCard}>
          <div style={S.mediaLabel}>行业背景</div>
          <div style={S.mediaThumbRow}>
            {bgThumb
              ? <img src={bgThumb} style={S.mediaThumb} alt="bg" />
              : <div style={{ ...S.mediaThumb, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>🏗</div>
            }
            <select style={{ ...S.select, flex: 1 }} value={selectedIndustry} onChange={(e: Event) => handleIndustryChange((e.target as HTMLSelectElement).value)}>
              {industries.length === 0 && <option value="">（无行业）</option>}
              {industries.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
            <button style={{ ...S.btnSecondary, padding: '2px 5px', fontSize: 9 }} onClick={() => send({ type: 'GET_INDUSTRIES' })} title="刷新行业列表">↺</button>
          </div>
          <div style={S.mediaBtnRow}>
            <button style={S.btnLocal} onClick={() => bgFileRef.current?.click()}>⬆ 本地</button>
            <button style={S.btnAI} onClick={() => setShowAI('bg')}>✦ AI</button>
          </div>
        </div>

        <div style={S.mediaCard}>
          <div style={S.mediaLabel}>示例照片</div>
          <div style={S.mediaThumbRow}>
            {photoThumb
              ? <img src={photoThumb} style={S.mediaThumb} alt="photo" />
              : <div style={S.mediaThumb} />
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

      {/* Watermark bar */}
      <div style={{ padding: '0 9px 5px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ color: C.muted, fontSize: 7.5, flexShrink: 0 }}>水印图层:</span>
          <input
            style={{ ...S.input, flex: 1 }}
            value={wmConfig.watermarkLayerName}
            onInput={(e: Event) => setWmConfig(c => ({ ...c, watermarkLayerName: (e.target as HTMLInputElement).value }))}
            placeholder="留空则跳过"
          />
        </div>
      </div>

      {/* Table */}
      <div style={S.tableWrap}>
        <div style={S.tableHead}>
          <span style={{ fontSize: 7.5, color: C.muted }}>
            <input type="checkbox" checked={allChecked}
              onChange={(e: Event) => setCountries(cs => cs.map(c => ({ ...c, enabled: (e.target as HTMLInputElement).checked })))}
              style={{ width: 11, height: 11, accentColor: C.purple }}
            />
          </span>
          {['国家', '标题', '副标题', 'CTA', '水印'].map(col => (
            <span key={col} style={{ fontSize: 7.5, color: C.muted }}>{col}</span>
          ))}
        </div>
        <div style={S.tableBody}>
          {countries.map((c, i) => (
            <div key={c.code} style={{ ...S.tableRow, opacity: c.enabled ? 1 : 0.5 }}>
              <input type="checkbox" checked={c.enabled}
                onChange={(e: Event) => updateCountry(i, { enabled: (e.target as HTMLInputElement).checked })}
                style={{ width: 11, height: 11, accentColor: C.purple }}
              />
              <span style={{ fontSize: 8, color: C.text }}>{c.flag}{c.code}</span>
              <input style={S.input} value={c.headline} onInput={(e: Event) => updateCountry(i, { headline: (e.target as HTMLInputElement).value })} placeholder="标题" />
              <input style={S.input} value={c.subheadline} onInput={(e: Event) => updateCountry(i, { subheadline: (e.target as HTMLInputElement).value })} placeholder="副标题" />
              <input style={S.input} value={c.cta_text} onInput={(e: Event) => updateCountry(i, { cta_text: (e.target as HTMLInputElement).value })} placeholder="CTA" />
              <select style={S.select} value={c.watermark} onChange={(e: Event) => updateCountry(i, { watermark: (e.target as HTMLSelectElement).value })}>
                {['en', 'jp', 'kr', 'de', 'fr', 'br', 'mx', 'id', 'vn', 'th', 'sa'].map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Batch translate bar */}
      <div style={{ padding: '4px 9px', borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 6, background: C.bg2, flexShrink: 0 }}>
        <span style={{ color: C.muted, fontSize: 7.5, flexShrink: 0 }}>批量翻译排除:</span>
        <input
          style={{ ...S.input, flex: 1 }}
          value={excludeLayerInput}
          onInput={(e: Event) => setExcludeLayerInput((e.target as HTMLInputElement).value)}
          placeholder="logo,watermark,…"
          title="逗号分隔的图层名，这些图层的文本将跳过翻译"
        />
        <button
          style={{ ...S.btnSecondary, fontSize: 7.5, padding: '3px 8px', flexShrink: 0, background: `${C.purple}20`, color: C.purple, opacity: batchTranslating ? 0.5 : 1, cursor: batchTranslating ? 'not-allowed' : 'pointer' }}
          onClick={handleBatchTranslate}
          disabled={batchTranslating}
          title="扫描当前选中 Main Component 的所有文本并翻译，生成各语言版本"
        >
          {batchTranslating ? '翻译中…' : '批量翻译'}
        </button>
      </div>

      {/* Bottom bar */}
      <div style={S.bottomBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {progress
            ? <span style={{ color: C.muted, fontSize: 8 }}>生成中 {progress.current}/{progress.total}…</span>
            : resultMsg
            ? <span style={{ color: resultMsg.startsWith('错误') ? C.red : C.green, fontSize: 8, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{resultMsg}</span>
            : <span style={{ color: C.muted, fontSize: 8 }}>已选 <strong style={{ color: C.text }}>{enabledCount}</strong> 个国家</span>
          }
          <input
            style={{ ...S.input, width: 68, fontSize: 7.5 }}
            value={nameSuffix}
            onInput={(e: Event) => setNameSuffix((e.target as HTMLInputElement).value)}
            placeholder="Msg"
            title="文件名后缀，如 AutoSync → EN-Hor-AutoSync"
          />
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select
            style={{ background: C.surface, border: 'none', color: C.subtle, fontSize: 7.5, borderRadius: 3, padding: '3px 4px', outline: 'none' }}
            value={translateProvider}
            onChange={(e: Event) => {
              const p = (e.target as HTMLSelectElement).value as TranslateProvider
              setTranslateProvider(p)
              send({ type: 'SAVE_SETTINGS', settings: { ...settings, translateProvider: p } })
            }}
          >
            <option value="google">Google</option>
            <option value="mymemory">MyMemory</option>
            <option value="deepl">DeepL</option>
            <option value="microsoft">Microsoft</option>
          </select>
          <button
            style={{ ...S.btnPrimary, opacity: generating ? 0.5 : 1, cursor: generating ? 'not-allowed' : 'pointer' }}
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? '生成中…' : '生成'}
          </button>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input ref={bgFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBgFile} />
      <input ref={photoFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoFile} />

      {/* Overlays */}
      {showAI && (
        <AIModal
          target={showAI}
          selectedIndustry={selectedIndustry}
          promptPresets={settings.promptPresets}
          apiKey={settings.apiKey}
          geminiKey={settings.geminiKey}
          onClose={() => setShowAI(null)}
          onResult={bytes => {
            const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' })
            const thumb = URL.createObjectURL(blob)
            if (showAI === 'bg') {
              setBgBytes(bytes); setBgImageHash(null); setBgThumb(thumb)
            } else {
              setPhotoBytes(bytes); setPhotoName('AI 生成'); setPhotoThumb(thumb)
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

export default function(rootNode: Element | null) {
  render(<App />, rootNode ?? document.body)
}
