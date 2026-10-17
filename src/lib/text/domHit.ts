// 把點擊座標對應到「區塊文字 + 偏移」；只在瀏覽器內使用
import { buildTextIndex, offsetOf, type TextIndex } from './textIndex'
const BLOCK_SELECTOR =
  'p,li,blockquote,dd,dt,td,th,h1,h2,h3,h4,h5,h6,figcaption,pre,div,section,article,body'

export interface DomHit {
  block: Element
  index: TextIndex
  offset: number
}

type CaretDoc = Document & {
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
  caretRangeFromPoint?: (x: number, y: number) => Range | null
}

const caretAt = (doc: Document, x: number, y: number) => {
  const d = doc as CaretDoc
  if (d.caretPositionFromPoint) {
    const pos = d.caretPositionFromPoint(x, y)
    return pos ? { node: pos.offsetNode, offset: pos.offset } : null
  }
  const range = d.caretRangeFromPoint?.(x, y)
  return range ? { node: range.startContainer, offset: range.startOffset } : null
}

export function hitAt(doc: Document, x: number, y: number): DomHit | null {
  const caret = caretAt(doc, x, y)
  if (!caret || caret.node.nodeType !== Node.TEXT_NODE) return null
  const block = caret.node.parentElement?.closest(BLOCK_SELECTOR)
  if (!block) return null
  const index = buildTextIndex(block)
  const offset = offsetOf(index, caret.node, caret.offset)
  return offset === null ? null : { block, index, offset }
}

// caret API 會回傳「最近的」位置，點在頁邊空白也有結果；確認點擊真的落在字上
export const rangeContainsPoint = (range: Range, x: number, y: number, tolerance = 3) =>
  Array.from(range.getClientRects()).some(
    (r) => x >= r.left - tolerance && x <= r.right + tolerance && y >= r.top - tolerance && y <= r.bottom + tolerance,
  )

const HIGHLIGHT_NAME = 'pr-lookup'

type HighlightWindow = Window & {
  CSS?: { highlights?: Map<string, unknown> }
  Highlight?: new (...ranges: Range[]) => { priority: number }
}

export function setLookupHighlight(doc: Document, range: Range | null) {
  const win = doc.defaultView as HighlightWindow | null
  const highlights = win?.CSS?.highlights
  if (!highlights || !win?.Highlight) return
  if (range) {
    const h = new win.Highlight(range)
    // 蓋在單字本的上色之上
    h.priority = 1
    highlights.set(HIGHLIGHT_NAME, h)
  }
  else highlights.delete(HIGHLIGHT_NAME)
}

// 正在查的字：咖啡底白字，和單字本的焦糖色區分
export const LOOKUP_HIGHLIGHT_CSS = `::highlight(${HIGHLIGHT_NAME}) { background-color: #9c7a5c; color: #fffaf3; }`
