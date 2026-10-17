// foliate-js 的薄型別包裝；原始碼固定於 vendor/foliate-js（見 vendor/README.md）
import { makeBook as rawMakeBook } from '../../vendor/foliate-js/view.js'
import type { RawMetadata } from './metadata'
import { LOOKUP_HIGHLIGHT_CSS } from './text/domHit'
import { VOCAB_HIGHLIGHT_CSS } from './text/vocabHighlight'

export interface FoliateBook {
  metadata?: RawMetadata
  dir?: string
}

export interface RelocateDetail {
  fraction: number
  cfi: string
  tocItem?: { label?: string }
}

export interface FoliateRenderer extends HTMLElement {
  setStyles?(css: string): void
  getContents?(): { doc: Document; index: number }[]
  setAttribute(name: 'flow' | 'gap' | 'max-inline-size' | string, value: string): void
}

export interface FoliateView extends HTMLElement {
  book: FoliateBook
  renderer: FoliateRenderer
  open(book: File | Blob | FoliateBook): Promise<void>
  init(opts: { lastLocation?: string | null; showTextStart?: boolean }): Promise<void>
  getCFI(index: number, range?: Range): string
  resolveNavigation(target: string): { index: number; anchor?: (doc: Document) => Range | null } | undefined
  goLeft(): Promise<void>
  goRight(): Promise<void>
  close(): void
}

export const makeBook = (file: File | Blob) => rawMakeBook(file) as Promise<FoliateBook>

export const createFoliateView = () => document.createElement('foliate-view') as FoliateView

// 可重排版的書（EPUB、Word）注入 iframe 的排版樣式
export const BOOK_CSS = `
  html { color-scheme: light dark; }
  p, li, blockquote, dd { line-height: 1.6; text-align: start; hyphens: auto; }
  @media (prefers-color-scheme: dark) { a:link { color: #8ec5b4; } }
`

const HIGHLIGHT_STYLE_ID = 'polyglot-reader-highlights'

/** 單字上色與查詢標示的樣式；每一頁都要有，PDF 的固定版面沒有 setStyles 可用，所以直接插入 */
export function ensureHighlightStyle(doc: Document) {
  if (doc.getElementById(HIGHLIGHT_STYLE_ID)) return
  const style = doc.createElement('style')
  style.id = HIGHLIGHT_STYLE_ID
  style.textContent = `${VOCAB_HIGHLIGHT_CSS}\n${LOOKUP_HIGHLIGHT_CSS}`
  ;(doc.head ?? doc.documentElement).append(style)
}
