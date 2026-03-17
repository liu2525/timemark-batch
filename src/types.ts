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
