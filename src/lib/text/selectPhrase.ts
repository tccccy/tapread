// 在書頁上拖曳選取幾個字 → 片語＋所在句子，給「查詢片語」用
import { buildTextIndex, offsetOf, rangeFor } from './textIndex'
import { sentenceContext, type SentenceContext } from './wordContext'

export const MAX_PHRASE_WORDS = 8
const MAX_PHRASE_CHARS = 80
const LETTER = /[\p{L}\p{M}]/u
const BLOCK_SELECTOR = 'p,li,blockquote,dd,dt,td,th,h1,h2,h3,h4,h5,h6,figcaption,pre,div,section,article,body'

export interface PhraseHit { word: string; start: number; end: number }

/** 去掉選取範圍前後的標點與空白、合併中間的空白；選太長（整段）或沒有字母時回傳 null */
export function phraseAt(text: string, start: number, end: number, locale?: string): PhraseHit | null {
  let s = Math.max(0, start)
  let e = Math.min(text.length, end)
  while (s < e && !LETTER.test(text[s])) s++
  while (e > s && !LETTER.test(text[e - 1])) e--
  if (s >= e) return null
  const word = text.slice(s, e).replace(/\s+/g, ' ')
  if (word.length > MAX_PHRASE_CHARS) return null
  let words = 0
  try {
    for (const seg of new Intl.Segmenter(locale || undefined, { granularity: 'word' }).segment(word)) if (seg.isWordLike) words++
  } catch {
    words = word.split(' ').length
  }
  return words > MAX_PHRASE_WORDS ? null : { word, start: s, end: e }
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
  return { word: hit.word, range, ...sentenceContext(index.text, hit.start, language) }
}
