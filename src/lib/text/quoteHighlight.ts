// 書摘（劃線）在書頁上的標示：淡金色底，和單字本的奶茶色、正在查的字區分
const NAME = 'pr-quote'

type HighlightWindow = Window & {
  CSS?: { highlights?: Map<string, unknown> }
  Highlight?: new (...ranges: Range[]) => { priority: number }
}

export function setQuoteHighlights(doc: Document, ranges: Range[]) {
  const win = doc.defaultView as HighlightWindow | null
  const highlights = win?.CSS?.highlights
  if (!highlights || !win?.Highlight) return
  if (ranges.length === 0) highlights.delete(NAME)
  else highlights.set(NAME, new win.Highlight(...ranges))
}

export const QUOTE_HIGHLIGHT_CSS = `::highlight(${NAME}) { background-color: rgba(226, 190, 96, 0.38); }`
