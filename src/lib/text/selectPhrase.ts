// 在書頁上拖曳選取 → 片語（查詢）或整句（翻譯）＋所在句子
import { buildTextIndex, offsetOf, rangeFor } from './textIndex'
import { sentenceContext, type SentenceContext } from './wordContext'

export const MAX_PHRASE_WORDS = 8
const MAX_PHRASE_CHARS = 80
/** 超過片語長度就當成整句翻譯；再長（選了好幾段）就不處理 */
export const MAX_SELECTION_CHARS = 600
const LETTER = /[\p{L}\p{M}]/u
const BLOCK_SELECTOR = 'p,li,blockquote,dd,dt,td,th,h1,h2,h3,h4,h5,h6,figcaption,pre,div,section,article,body'

export type SelectionKind = 'phrase' | 'sentence'

export interface PhraseHit { word: string; start: number; end: number; kind: SelectionKind }

/** 去掉選取範圍前後的標點與空白、合併中間的空白；選太長或沒有字母時回傳 null */
export function phraseAt(text: string, start: number, end: number, locale?: string): PhraseHit | null {
  let s = Math.max(0, start)
  let e = Math.min(text.length, end)
  while (s < e && !LETTER.test(text[s])) s++
  // 整句時保留句尾標點（翻譯需要語氣）；片語時再去掉
  while (e > s && /\s/.test(text[e - 1])) e--
  if (s >= e) return null
  const raw = text.slice(s, e).replace(/\s+/g, ' ')
  if (raw.length > MAX_SELECTION_CHARS) return null
  let words = 0
  try {
    for (const seg of new Intl.Segmenter(locale || undefined, { granularity: 'word' }).segment(raw)) if (seg.isWordLike) words++
  } catch {
    words = raw.split(' ').length
  }
  if (words > MAX_PHRASE_WORDS || raw.length > MAX_PHRASE_CHARS) return { word: raw, start: s, end: e, kind: 'sentence' }
  while (e > s && !LETTER.test(text[e - 1])) e--
  return { word: text.slice(s, e).replace(/\s+/g, ' '), start: s, end: e, kind: 'phrase' }
}

/** 選取的端點若落在元素上（例如三連點選整段），換成相鄰的文字節點位置 */
function textPoint(container: Node, offset: number, atEnd: boolean): { node: Node; offset: number } {
  if (container.nodeType === Node.TEXT_NODE) return { node: container, offset }
  const doc = container.ownerDocument ?? (container as Document)
  const walker = doc.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  const texts: Text[] = []
  for (let n = walker.nextNode(); n; n = walker.nextNode()) texts.push(n as Text)
  const boundary = container.childNodes[offset] ?? null
  const before = texts.filter((t) => !boundary || (boundary.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_PRECEDING))
  if (atEnd && before.length > 0) {
    const last = before[before.length - 1]
    return { node: last, offset: last.data.length }
  }
  const after = texts[before.length]
  return after ? { node: after, offset: 0 } : { node: container, offset }
}

export interface SelectedPhrase extends SentenceContext {
  word: string
  range: Range
  kind: SelectionKind
}

/** 讀取目前的選取；不在同一個段落內、選太長或沒有選取時回傳 null */
export function selectionToLookup(doc: Document, language: string): SelectedPhrase | null {
  const sel = doc.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null
  const r = sel.getRangeAt(0)
  const a = textPoint(r.startContainer, r.startOffset, false)
  const b = textPoint(r.endContainer, r.endOffset, true)
  const block = (a.node.nodeType === Node.TEXT_NODE ? a.node.parentElement : (a.node as Element))?.closest(BLOCK_SELECTOR)
  if (!block || !block.contains(b.node)) return null
  const index = buildTextIndex(block)
  const start = offsetOf(index, a.node, a.offset)
  const end = offsetOf(index, b.node, b.offset)
  if (start === null || end === null || end <= start) return null
  const hit = phraseAt(index.text, start, end, language)
  const range = hit && rangeFor(index, hit.start, hit.end)
  if (!hit || !range) return null
  return { word: hit.word, range, kind: hit.kind, ...sentenceContext(index.text, hit.start, language) }
}
