// 閱讀頁的「Aa」排版設定：字體、字級、行距、頁寬、紙張色。所有書共用一組，存在 localStorage

export type FontId = 'serif' | 'sans' | 'kai' | 'classic' | 'original'
export type SpacingId = 'compact' | 'normal' | 'loose'
export type WidthId = 'narrow' | 'normal' | 'wide'
export type ThemeId = 'auto' | 'paper' | 'sepia' | 'night'

export interface ReadingPrefs {
  font: FontId
  fontSize: number
  spacing: SpacingId
  width: WidthId
  theme: ThemeId
}

/** 要下載的網頁字型（打包在 App 內，用到才載入） */
export type WebFamily = 'Literata' | 'Noto Serif TC' | 'LXGW WenKai TC' | 'EB Garamond'

interface FontDef {
  label: string
  note: string
  /** 西文字體在前，中文字體在後：西文字母用西文字體，漢字才落到中文字體 */
  latin: string[]
  cjk: string[]
  /** 日文書用日文字形的系統字體（漢字寫法和繁中不同） */
  ja: string[]
  generic: 'serif' | 'sans-serif'
  web: WebFamily[]
}

const SYSTEM_SANS = ['-apple-system', 'BlinkMacSystemFont', "'Helvetica Neue'", "'Segoe UI'"]
const JA_MINCHO = ["'Hiragino Mincho ProN'", "'Yu Mincho'"]
const JA_GOTHIC = ["'Hiragino Sans'", "'Yu Gothic'"]

export const FONTS: Record<FontId, FontDef> = {
  serif: {
    label: '明體', note: 'Literata・思源宋體',
    latin: ["'Literata'"], cjk: ["'Noto Serif TC'", "'Songti TC'"], ja: JA_MINCHO,
    generic: 'serif', web: ['Literata', 'Noto Serif TC'],
  },
  sans: {
    label: '黑體', note: '系統字體',
    latin: SYSTEM_SANS, cjk: ["'PingFang TC'", "'Noto Sans TC'", "'Microsoft JhengHei'"], ja: JA_GOTHIC,
    generic: 'sans-serif', web: [],
  },
  kai: {
    label: '楷體', note: '霞鶩文楷',
    latin: ["'LXGW WenKai TC'"], cjk: ["'Kaiti TC'"], ja: [],
    generic: 'serif', web: ['LXGW WenKai TC'],
  },
  classic: {
    label: '古典', note: 'EB Garamond',
    latin: ["'EB Garamond'"], cjk: ["'Noto Serif TC'", "'Songti TC'"], ja: JA_MINCHO,
    generic: 'serif', web: ['EB Garamond', 'Noto Serif TC'],
  },
  original: {
    label: '原書', note: '出版社設定',
    latin: [], cjk: [], ja: [], generic: 'serif', web: [],
  },
}

export const SPACINGS: Record<SpacingId, { label: string; lineHeight: number }> = {
  compact: { label: '緊湊', lineHeight: 1.45 },
  normal: { label: '適中', lineHeight: 1.7 },
  loose: { label: '寬鬆', lineHeight: 2 },
}

export const WIDTHS: Record<WidthId, { label: string; px: number }> = {
  narrow: { label: '窄', px: 560 },
  normal: { label: '適中', px: 720 },
  wide: { label: '寬', px: 960 },
}

interface Palette { background: string; text: string; link: string; scheme: 'light' | 'dark' }

// 與 app.css 的 --paper 一致
export const PALETTES: Record<Exclude<ThemeId, 'auto'>, Palette & { label: string }> = {
  paper: { label: '米白', background: '#fbf7f0', text: '#3a2a20', link: '#876449', scheme: 'light' },
  sepia: { label: '羊皮紙', background: '#f1e5cf', text: '#4b3621', link: '#876449', scheme: 'light' },
  night: { label: '夜間', background: '#1f1813', text: '#eadfd1', link: '#d3baa0', scheme: 'dark' },
}

export const FONT_SIZE = { min: 14, max: 28 }

export const DEFAULT_READING_PREFS: ReadingPrefs = Object.freeze({
  font: 'serif',
  fontSize: 18,
  spacing: 'normal',
  width: 'normal',
  theme: 'auto',
})

const STORAGE_KEY = 'tapread.readingPrefs'

const pick = <T extends string>(value: unknown, allowed: Record<T, unknown>, fallback: T): T =>
  typeof value === 'string' && Object.hasOwn(allowed, value) ? (value as T) : fallback

const THEME_IDS: Record<ThemeId, true> = { auto: true, paper: true, sepia: true, night: true }

export function normalizeReadingPrefs(raw: unknown): ReadingPrefs {
  if (!raw || typeof raw !== 'object') return DEFAULT_READING_PREFS
  const r = raw as Record<string, unknown>
  const d = DEFAULT_READING_PREFS
  const size = typeof r.fontSize === 'number' && Number.isFinite(r.fontSize)
    ? Math.min(FONT_SIZE.max, Math.max(FONT_SIZE.min, Math.round(r.fontSize)))
    : d.fontSize
  return {
    font: pick(r.font, FONTS, d.font),
    fontSize: size,
    spacing: pick(r.spacing, SPACINGS, d.spacing),
    width: pick(r.width, WIDTHS, d.width),
    theme: pick(r.theme, THEME_IDS, d.theme),
  }
}

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>

export function loadReadingPrefs(storage: KeyValueStorage): ReadingPrefs {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    return raw ? normalizeReadingPrefs(JSON.parse(raw)) : DEFAULT_READING_PREFS
  } catch (e) {
    console.warn('讀取閱讀設定失敗，使用預設值', e)
    return DEFAULT_READING_PREFS
  }
}

export function saveReadingPrefs(storage: KeyValueStorage, prefs: ReadingPrefs): ReadingPrefs {
  const next = normalizeReadingPrefs(prefs)
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch (e) {
    // 私密瀏覽等情況存不了：這次仍套用，只是下次不會記得
    console.warn('儲存閱讀設定失敗', e)
  }
  return next
}

/** 書本內文的 font-family；原書字體回傳 null（不覆蓋） */
export function fontStack(font: FontId, language: string): string | null {
  const def = FONTS[font]
  if (font === 'original') return null
  const cjk = language === 'ja' ? [...def.ja, ...def.cjk] : def.cjk
  return [...def.latin, ...cjk, def.generic].join(', ')
}

export const webFamiliesOf = (font: FontId): WebFamily[] => [...FONTS[font].web]

const paletteCss = ({ background, text, link }: Palette) => `
  html, body { background: ${background} !important; color: ${text} !important; }
  a:link, a:visited { color: ${link}; }`

function themeCss(theme: ThemeId): string {
  if (theme !== 'auto') {
    const palette = PALETTES[theme]
    return `html { color-scheme: ${palette.scheme}; }${paletteCss(palette)}`
  }
  return `html { color-scheme: light dark; }${paletteCss(PALETTES.paper)}
  @media (prefers-color-scheme: dark) {${paletteCss(PALETTES.night)}
  }`
}

/**
 * 注入書本 iframe 的樣式（EPUB、Word 等可重排版的書）。
 * 出版社的 CSS 常用較高權重的 class 指定字體與行距，所以這裡用 !important 才蓋得過；
 * 程式碼區塊保留等寬字體。
 */
export function bookCss(prefs: ReadingPrefs, language: string, fontFaces = ''): string {
  const stack = fontStack(prefs.font, language)
  const lineHeight = SPACINGS[prefs.spacing].lineHeight
  return `${fontFaces}
  ${themeCss(prefs.theme)}
  html { font-size: ${prefs.fontSize}px !important; }
  ${stack ? `body { font-family: ${stack} !important; }
  body *:not(code, pre, kbd, samp, tt, code *, pre *) { font-family: inherit !important; }` : ''}
  body, p, li, blockquote, dd, dt { line-height: ${lineHeight} !important; }
  p, li, blockquote, dd { text-align: start; hyphens: auto; }
`
}
