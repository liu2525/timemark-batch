// src/types.ts

// Serializable Figma Paint — passed through postMessage so we use a loose type.
// In practice we only deal with SOLID fills on text nodes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type HighlightFill = Record<string, any>

// Character-range highlight info extracted from the original Figma text node
// and carried through translation so it can be re-applied to each instance.
export interface HighlightRange {
  start: number   // character index (inclusive)
  end: number     // character index (exclusive)
  fills: HighlightFill[]
}

export interface CountryConfig {
  code: string        // 'US', 'JP', etc.
  flag: string        // '🇺🇸', '🇯🇵', etc.
  headline: string
  subheadline: string
  cta_text: string
  watermark: string   // default = code.toLowerCase()
  enabled: boolean
  // Populated after 翻译: the highlight range to re-apply in the Figma instance
  headlineHighlightRange?: HighlightRange
  headlineDominantFills?: HighlightFill[]
}

export interface SchemeData {
  industry: string
  countries: CountryConfig[]
}

export interface SchemesStore {
  schemes: Record<string, SchemeData>
  lastScheme: string
}

export type TranslateProvider = 'google' | 'mymemory' | 'deepl' | 'microsoft'

export interface PluginSettings {
  apiKey: string                   // OpenAI
  geminiKey: string                // Google Gemini (Imagen)
  deeplKey: string                 // DeepL (key ends with :fx → free tier)
  msTranslatorKey: string          // Microsoft Translator
  msTranslatorRegion: string       // e.g. "eastus"
  translateProvider: TranslateProvider
  promptPresets: Record<string, string>
}

export interface MockupTextNode {
  layerName: string // which mockup layer this node belongs to
  pathKey: string   // '|'-separated path relative to that layer, e.g. "screen|welcome_text"
  content: string   // original English text
}

// ── Messages: UI → main ──────────────────────────────────────────
export type UIMessage =
  | { type: 'GET_INDUSTRIES' }
  | { type: 'LOAD_SCHEMES' }
  | { type: 'READ_HEADLINE_STYLE' }   // ask main to scan headline node fills
  | { type: 'SAVE_SCHEME'; name: string; data: SchemeData }
  | { type: 'SAVE_SETTINGS'; settings: PluginSettings }
  | { type: 'SCAN_TEXTS'; mockupLayerNames: string[] }
  | { type: 'SCAN_ALL_TEXTS'; excludeLayerNames: string[] }
  | {
      type: 'BATCH_TRANSLATE'
      configs: CountryConfig[]
      translations: { code: string; texts: { pathKey: string; content: string }[] }[]
      watermarkConfig?: WatermarkConfig
      watermarkTexts?: Record<string, { dateStr: string; weekdayStr: string }>
      weekdayNames?: string[]
      nameSuffix?: string
      // Headline highlight info (same fills for all langs; range differs per country)
      headlinePathKey?: string
      headlineHighlights?: Record<string, { start: number; end: number } | null>
      headlineHighlightFills?: HighlightFill[]   // minority (accent) fills
      headlineDominantFills?: HighlightFill[]    // majority (base) fills — re-applied to full range first
    }
  | {
      type: 'GENERATE'
      configs: CountryConfig[]
      industry: string
      bgImageHash?: string
      bgBytes?: number[]
      photoBytes?: number[]
      mockupTranslations?: { code: string; texts: MockupTextNode[] }[]
      watermarkConfig?: WatermarkConfig
      // Pre-computed in UI (where Intl is available), keyed by country code
      watermarkTexts?: Record<string, { dateStr: string; weekdayStr: string }>
      // All weekday names across locales for content-based detection in main thread
      weekdayNames?: string[]
      nameSuffix?: string
    }

// ── Messages: main → UI ──────────────────────────────────────────
export type MainMessage =
  | { type: 'INDUSTRIES'; list: string[] }
  | { type: 'SCHEMES'; data: SchemesStore; lastScheme: string }
  | { type: 'SETTINGS'; settings: Partial<PluginSettings> }
  | { type: 'COMPONENT_TEXTS'; texts: MockupTextNode[] }
  | { type: 'ALL_COMPONENT_TEXTS'; texts: { pathKey: string; content: string }[] }
  | { type: 'PROGRESS'; current: number; total: number }
  | { type: 'DONE'; warnings: string[] }
  | { type: 'ERROR'; message: string }
  // Reply to READ_HEADLINE_STYLE: text + highlight ranges + dominant (base) fills + exact pathKey
  | { type: 'HEADLINE_STYLE'; text: string; highlightRanges: HighlightRange[]; dominantFills: HighlightFill[]; pathKey: string }

// ── Default country table ─────────────────────────────────────────
export const DEFAULT_COUNTRIES: CountryConfig[] = [
  { code: 'US', flag: '🇺🇸', headline: '', subheadline: '', cta_text: '', watermark: 'en', enabled: true },
  { code: 'JP', flag: '🇯🇵', headline: '', subheadline: '', cta_text: '', watermark: 'jp', enabled: true },
  { code: 'KR', flag: '🇰🇷', headline: '', subheadline: '', cta_text: '', watermark: 'kr', enabled: true },
  { code: 'DE', flag: '🇩🇪', headline: '', subheadline: '', cta_text: '', watermark: 'de', enabled: true },
  { code: 'FR', flag: '🇫🇷', headline: '', subheadline: '', cta_text: '', watermark: 'fr', enabled: true },
  { code: 'BR', flag: '🇧🇷', headline: '', subheadline: '', cta_text: '', watermark: 'br', enabled: true },
  { code: 'MX', flag: '🇲🇽', headline: '', subheadline: '', cta_text: '', watermark: 'mx', enabled: true },
  { code: 'ID', flag: '🇮🇩', headline: '', subheadline: '', cta_text: '', watermark: 'id', enabled: true },
  { code: 'VN', flag: '🇻🇳', headline: '', subheadline: '', cta_text: '', watermark: 'vn', enabled: true },
  { code: 'TH', flag: '🇹🇭', headline: '', subheadline: '', cta_text: '', watermark: 'th', enabled: true },
  { code: 'SA', flag: '🇸🇦', headline: '', subheadline: '', cta_text: '', watermark: 'sa', enabled: true },
]

// Google / MyMemory / Microsoft language codes
export const LANG_MAP: Record<string, string> = {
  JP: 'ja', KR: 'ko', DE: 'de', FR: 'fr', BR: 'pt', MX: 'es',
  ID: 'id', VN: 'vi', TH: 'th', SA: 'ar',
}

// Microsoft uses slightly different codes for some locales
export const MS_LANG_MAP: Record<string, string> = {
  JP: 'ja', KR: 'ko', DE: 'de', FR: 'fr', BR: 'pt-BR', MX: 'es',
  ID: 'id', VN: 'vi', TH: 'th', SA: 'ar',
}

// DeepL target language codes (subset — VN/TH/SA unsupported, falls back to Google)
export const DEEPL_LANG_MAP: Record<string, string> = {
  JP: 'JA', KR: 'KO', DE: 'DE', FR: 'FR', BR: 'PT-BR', MX: 'ES', ID: 'ID',
}

// Country code → display language code for file naming
export const COUNTRY_LANG_CODE: Record<string, string> = {
  US: 'EN', JP: 'JA', KR: 'KO', DE: 'DE', FR: 'FR', BR: 'PT', MX: 'ES',
  ID: 'ID', VN: 'VI', TH: 'TH', SA: 'AR',
}

export interface WatermarkConfig {
  watermarkLayerName: string  // top-level watermark component, e.g. "watermark"
}

export const DEFAULT_WATERMARK_CONFIG: WatermarkConfig = {
  watermarkLayerName: 'watermark',
}

// Intl locale codes per country
export const LOCALE_MAP: Record<string, string> = {
  US: 'en-US', JP: 'ja-JP', KR: 'ko-KR', DE: 'de-DE', FR: 'fr-FR',
  BR: 'pt-BR', MX: 'es-MX', ID: 'id-ID', VN: 'vi-VN', TH: 'th-TH', SA: 'ar-SA',
}

// Random sample addresses per country
export const SAMPLE_ADDRESSES: Record<string, string[]> = {
  US: ['123 Oak Street, Brooklyn, NY 11201', '456 Sunset Blvd, Los Angeles, CA 90028', '789 Michigan Ave, Chicago, IL 60601'],
  JP: ['東京都渋谷区渋谷2-24-12', '大阪府大阪市北区梅田1-3-1', '神奈川県横浜市西区高島2-19-12'],
  KR: ['서울 강남구 테헤란로 521', '서울 종로구 종로 1가 1번지', '부산 해운대구 우동 1413'],
  DE: ['Friedrichstraße 176, 10117 Berlin', 'Maximilianstraße 12, 80539 München', 'Königsallee 92, 40212 Düsseldorf'],
  FR: ['12 Av. des Champs-Élysées, 75008 Paris', '25 Rue du Louvre, 75001 Paris', '3 Place Bellecour, 69002 Lyon'],
  BR: ['Av. Paulista 1578, Bela Vista, São Paulo', 'Rua Oscar Freire 900, Cerqueira César, SP', 'Av. Atlântica 1020, Copacabana, RJ'],
  MX: ['Paseo de la Reforma 350, Juárez, CDMX', 'Av. Insurgentes Sur 1457, CDMX', 'Hamburgo 213, Juárez, CDMX'],
  ID: ['Jl. Sudirman Kav. 52-53, Jakarta Selatan', 'Jl. Thamrin No. 28, Jakarta Pusat', 'Jl. Braga No. 76, Bandung'],
  VN: ['72 Lê Thánh Tôn, Quận 1, TP.HCM', '54 Lý Thái Tổ, Hoàn Kiếm, Hà Nội', '25 Nguyễn Huệ, Quận 1, TP.HCM'],
  TH: ['87 Wireless Rd, Lumpini, Bangkok 10330', '150 Sukhumvit 11, Khlong Toei, Bangkok', '181 Silom Rd, Bang Rak, Bangkok 10500'],
  SA: ['طريق الملك فهد، العليا، الرياض 12214', 'شارع التحلية، الشرفية، جدة 23511', 'شارع الملك عبدالعزيز، الدمام 32241'],
}

export const DEFAULT_SETTINGS: PluginSettings = {
  apiKey: '',
  geminiKey: '',
  deeplKey: '',
  msTranslatorKey: '',
  msTranslatorRegion: '',
  translateProvider: 'google',
  promptPresets: {},
}
