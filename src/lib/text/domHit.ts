// 把點擊座標對應到「區塊文字 + 偏移」，再把偏移轉回 Range；只在瀏覽器內使用
const BLOCK_SELECTOR =
  'p,li,blockquote,dd,dt,td,th,h1,h2,h3,h4,h5,h6,figcaption,pre,div,section,article,body'

export interface DomHit {
  block: Element
  text: string
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
  const before = doc.createRange()
  before.setStart(block, 0)
  before.setEnd(caret.node, caret.offset)
  return { block, text: block.textContent ?? '', offset: before.toString().length }
}

export function rangeForOffsets(block: Element, start: number, end: number): Range | null {
  const doc = block.ownerDocument
  const walker = doc.createTreeWalker(block, NodeFilter.SHOW_TEXT)
  const range = doc.createRange()
  let pos = 0
  let started = false
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const len = (node as Text).data.length
    if (!started && start < pos + len) {
      range.setStart(node, start - pos)
      started = true
    }
    if (started && end <= pos + len) {
      range.setEnd(node, end - pos)
      return range
    }
    pos += len
  }
  return null
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

export const LOOKUP_HIGHLIGHT_CSS = `::highlight(${HIGHLIGHT_NAME}) { background-color: rgba(232, 180, 76, 0.5); }`
