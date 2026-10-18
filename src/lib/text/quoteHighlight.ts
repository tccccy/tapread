// 書摘（劃線）在書頁上的標示：Soft Sand 底＋Walnut 底線，和單字本的 Taupe、正在查的字區分
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

export const QUOTE_HIGHLIGHT_CSS = `::highlight(${NAME}) { background-color: rgba(216, 200, 181, 0.75); }`
