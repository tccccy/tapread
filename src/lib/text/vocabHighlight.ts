// 把單字本裡的字在書頁上用 CSS Custom Highlight 上色（不改動書本 DOM）
import { MAX_LEVEL } from '../vocab/model'

const SKIP = new Set(['SCRIPT', 'STYLE', 'RUBY', 'RT'])
// 便宜的預篩：先用正規表示式抓字母串，確定有命中才交給 Intl.Segmenter（iPad 上長章節才不會卡）
const LETTER_RUN = /[\p{L}\p{M}]+/gu
const mayContainForm = (text: string, levels: Map<string, number>) =>
  (text.toLocaleLowerCase().match(LETTER_RUN) ?? []).some((w) => levels.has(w))
const name = (level: number) => `pr-vocab-${level}`
const LEVELS = Array.from({ length: MAX_LEVEL - 1 }, (_, i) => i + 1)

type HighlightWindow = Window & {
  CSS?: { highlights?: Map<string, unknown> }
  Highlight?: new (...ranges: Range[]) => { priority: number }
}

export function applyVocabHighlights(doc: Document, levels: Map<string, number>, locale?: string) {
  const win = doc.defaultView as HighlightWindow | null
  const highlights = win?.CSS?.highlights
  if (!highlights || !win?.Highlight || !doc.body) return

  const rangesByLevel = new Map<number, Range[]>(LEVELS.map((l) => [l, []]))
  if (levels.size > 0) {
    let segmenter: Intl.Segmenter
    try {
      segmenter = new Intl.Segmenter(locale || undefined, { granularity: 'word' })
    } catch {
      segmenter = new Intl.Segmenter(undefined, { granularity: 'word' })
    }
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (SKIP.has(n.parentElement?.tagName.toUpperCase() ?? '') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    })
    for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
      if (!mayContainForm(node.data, levels)) continue
      for (const seg of segmenter.segment(node.data)) {
        if (!seg.isWordLike) continue
        const level = levels.get(seg.segment.toLocaleLowerCase())
        if (level === undefined) continue
        const range = doc.createRange()
        range.setStart(node, seg.index)
        range.setEnd(node, seg.index + seg.segment.length)
        rangesByLevel.get(level)?.push(range)
      }
    }
  }

  for (const [level, ranges] of rangesByLevel) {
    if (ranges.length === 0) highlights.delete(name(level))
    else highlights.set(name(level), new win.Highlight(...ranges))
  }
}

// 越不熟顏色越深
export const VOCAB_HIGHLIGHT_CSS = LEVELS.map(
  (l) => `::highlight(${name(l)}) { background-color: rgba(120, 170, 220, ${(0.5 - (l - 1) * 0.11).toFixed(2)}); }`,
).join('\n')
