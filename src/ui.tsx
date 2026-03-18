// src/ui.tsx
import { h, render, Fragment } from 'preact'
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
  onClose: () => void
  onResult: (bytes: number[]) => void
}

function AIModal({ target, selectedIndustry, promptPresets, apiKey, onClose, onResult }: AIModalProps) {
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
            <div style={{ flex: 1 }}>
              <div style={{ color: C.muted, fontSize: 8, marginBottom: 3 }}>生成质量</div>
              <select style={{ width: '100%', background: C.surface, border: `1px solid ${C.overlay}`, color: C.subtle, fontSize: 8.5, borderRadius: 5, padding: '5px 7px', outline: 'none' }} value={quality} onChange={(e: Event) => setQuality((e.target as HTMLSelectElement).value)}>
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
    <div style={S.backdrop} onClick={(e: MouseEvent) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ ...S.modal, borderColor: C.purple }}>
        <div style={S.modalHeader}>
          <span style={{ color: C.purple, fontSize: 10, fontWeight: 700 }}>⚙ 设置</span>
          <button style={{ background: 'none', border: 'none', color: C.muted, fontSize: 14, cursor: 'pointer' }} onClick={onClose}>✕</button>
        </div>
        <div style={S.modalBody}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ color: C.muted, fontSize: 8, marginBottom: 4 }}>OpenAI API Key</div>
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
            <div style={{ color: C.muted, fontSize: 7.5, marginTop: 3 }}>仅存于本设备 figma.clientStorage，不上传</div>
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
  const [industries, setIndustries] = useState<string[]>([])
  const [schemes, setSchemes] = useState<SchemesStore>({ schemes: {}, lastScheme: '' })
  const [settings, setSettings] = useState<PluginSettings>({ apiKey: '', promptPresets: {} })

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
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [resultMsg, setResultMsg] = useState<string | null>(null)

  const bgFileRef = useRef<HTMLInputElement>(null)
  const photoFileRef = useRef<HTMLInputElement>(null)

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
          setResultMsg(msg.warnings.length > 0 ? `完成，注意：\n${msg.warnings.join('\n')}` : '✓ 全部生成完成')
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
    const savedSettings = localStorage.getItem('timemark_settings')
    if (savedSettings) {
      try { setSettings(JSON.parse(savedSettings)) } catch {}
    }
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
    setSettings(s)
    localStorage.setItem('timemark_settings', JSON.stringify(s))
    setShowSettings(false)
  }

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

      {/* Table */}
      <div style={S.tableWrap}>
        <div style={S.tableHead}>
          <span style={{ fontSize: 7.5, color: C.muted }}>
            <input type="checkbox" checked={allChecked}
              onChange={(e: Event) => setCountries(cs => cs.map(c => ({ ...c, enabled: (e.target as HTMLInputElement).checked })))}
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
              <input type="checkbox" checked={c.enabled}
                onChange={(e: Event) => updateCountry(i, { enabled: (e.target as HTMLInputElement).checked })}
                style={{ width: 11, height: 11, accentColor: C.purple }}
              />
              <span style={{ fontSize: 8, color: C.text }}>{c.flag}{c.code}</span>
              <input style={S.input} value={c.headline} onInput={(e: Event) => updateCountry(i, { headline: (e.target as HTMLInputElement).value })} placeholder="标题" />
              <input style={S.input} value={c.subheadline} onInput={(e: Event) => updateCountry(i, { subheadline: (e.target as HTMLInputElement).value })} placeholder="副标题" />
              <input style={S.input} value={c.cta_text} onInput={(e: Event) => updateCountry(i, { cta_text: (e.target as HTMLInputElement).value })} placeholder="CTA" />
              <select style={S.select} value={c.watermark} onChange={(e: Event) => updateCountry(i, { watermark: (e.target as HTMLSelectElement).value })}>
                {['en', 'jp', 'kr', 'de', 'fr', 'br', 'mx'].map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
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

render(<App />, document.getElementById('create-figma-plugin') ?? document.body)
