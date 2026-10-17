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
  open(file: File | Blob): Promise<void>
  init(opts: { lastLocation?: string | null; showTextStart?: boolean }): Promise<void>
  getCFI(index: number, range?: Range): string
  resolveNavigation(target: string): { index: number; anchor?: (doc: Document) => Range | null } | undefined
  goLeft(): Promise<void>
  goRight(): Promise<void>
  close(): void
}

export const makeBook = (file: File | Blob) => rawMakeBook(file) as Promise<FoliateBook>

export const createFoliateView = () => document.createElement('foliate-view') as FoliateView

// 注入書本 iframe 內的樣式
export const BOOK_CSS = `
  html { color-scheme: light dark; }
  p, li, blockquote, dd { line-height: 1.6; text-align: start; hyphens: auto; }
  @media (prefers-color-scheme: dark) { a:link { color: #8ec5b4; } }
  ${VOCAB_HIGHLIGHT_CSS}
  ${LOOKUP_HIGHLIGHT_CSS}
`
