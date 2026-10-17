import { describe, it, expect } from 'vitest'
import {
  DEFAULT_READING_PREFS,
  normalizeReadingPrefs,
  loadReadingPrefs,
  saveReadingPrefs,
  fontStack,
  webFamiliesOf,
  bookCss,
  FONT_SIZE,
} from '../src/lib/reading/prefs'

const memoryStorage = () => {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
}

describe('normalizeReadingPrefs', () => {
  it('非物件時回到預設值', () => {
    expect(normalizeReadingPrefs(null)).toEqual(DEFAULT_READING_PREFS)
    expect(normalizeReadingPrefs('x')).toEqual(DEFAULT_READING_PREFS)
  })

  it('不認得的選項改用預設值，其他欄位保留', () => {
    const prefs = normalizeReadingPrefs({ font: 'comic-sans', theme: 'night', spacing: 'huge' })
    expect(prefs.font).toBe(DEFAULT_READING_PREFS.font)
    expect(prefs.theme).toBe('night')
    expect(prefs.spacing).toBe(DEFAULT_READING_PREFS.spacing)
  })

  it('字級四捨五入並限制在範圍內', () => {
    expect(normalizeReadingPrefs({ fontSize: 99 }).fontSize).toBe(FONT_SIZE.max)
    expect(normalizeReadingPrefs({ fontSize: 3 }).fontSize).toBe(FONT_SIZE.min)
    expect(normalizeReadingPrefs({ fontSize: 19.6 }).fontSize).toBe(20)
    expect(normalizeReadingPrefs({ fontSize: 'big' }).fontSize).toBe(DEFAULT_READING_PREFS.fontSize)
  })
})

describe('loadReadingPrefs / saveReadingPrefs', () => {
  it('存了再讀回來一樣', () => {
    const storage = memoryStorage()
    const prefs = { ...DEFAULT_READING_PREFS, font: 'kai' as const, fontSize: 22 }
    saveReadingPrefs(storage, prefs)
    expect(loadReadingPrefs(storage)).toEqual(prefs)
  })

  it('沒存過或內容壞掉時回到預設值', () => {
    const storage = memoryStorage()
    expect(loadReadingPrefs(storage)).toEqual(DEFAULT_READING_PREFS)
    storage.setItem('tapread.readingPrefs', '{壞掉')
    expect(loadReadingPrefs(storage)).toEqual(DEFAULT_READING_PREFS)
  })
})

describe('fontStack', () => {
  it('原書字體不覆蓋', () => {
    expect(fontStack('original', 'en')).toBeNull()
  })

  it('明體：英文字體在前、中文字體在後', () => {
    const stack = fontStack('serif', 'en')!
    expect(stack.indexOf("'Literata'")).toBeLessThan(stack.indexOf("'Noto Serif TC'"))
    expect(stack.endsWith('serif')).toBe(true)
  })

  it('日文書優先用日文字形的系統字體', () => {
    const stack = fontStack('serif', 'ja')!
    expect(stack.indexOf('Hiragino Mincho ProN')).toBeLessThan(stack.indexOf("'Noto Serif TC'"))
  })
})

describe('webFamiliesOf', () => {
  it('只列出要下載的網頁字型', () => {
    expect(webFamiliesOf('serif')).toEqual(['Literata', 'Noto Serif TC'])
    expect(webFamiliesOf('sans')).toEqual([])
    expect(webFamiliesOf('original')).toEqual([])
  })
})

describe('bookCss', () => {
  it('套用字級、行距與字體', () => {
    const css = bookCss({ ...DEFAULT_READING_PREFS, font: 'kai', fontSize: 21, spacing: 'loose' }, 'en')
    expect(css).toContain('font-size: 21px !important')
    expect(css).toContain('line-height: 2 !important')
    expect(css).toContain("'LXGW WenKai TC'")
  })

  it('原書字體時不覆蓋 font-family', () => {
    const css = bookCss({ ...DEFAULT_READING_PREFS, font: 'original' }, 'en')
    expect(css).not.toContain('font-family')
  })

  it('自動跟隨系統：含深色模式的媒體查詢', () => {
    const css = bookCss({ ...DEFAULT_READING_PREFS, theme: 'auto' }, 'en')
    expect(css).toContain('prefers-color-scheme: dark')
  })

  it('指定紙張色：固定顏色、不跟系統切換', () => {
    const css = bookCss({ ...DEFAULT_READING_PREFS, theme: 'night' }, 'en')
    expect(css).not.toContain('prefers-color-scheme')
    expect(css).toContain('color-scheme: dark')
    expect(css).toContain('#1f1813')
  })

  it('字型宣告放在最前面', () => {
    const css = bookCss(DEFAULT_READING_PREFS, 'en', '@font-face { font-family: X }')
    expect(css.trimStart().startsWith('@font-face')).toBe(true)
  })
})
