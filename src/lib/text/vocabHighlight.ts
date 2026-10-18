// 把單字本裡的字在書頁上用 CSS Custom Highlight 上色（不改動書本 DOM）
import { MAX_LEVEL } from '../vocab/model'
import { findPhraseMatches, isPhrase } from './phraseMatch'
import { buildTextIndex, rangeFor } from './textIndex'

const SKIP = new Set(['SCRIPT', 'STYLE', 'RUBY', 'RT'])
// 便宜的預篩：先用正規表示式抓字母串，確定有命中才交給 Intl.Segmenter（iPad 上長章節才不會卡）
const LETTER_RUN = /[\p{L}\p{M}]+/gu
const mayContainForm = (text: string, levels: Map<string, number>) =>
  (text.toLocaleLowerCase().match(LETTER_RUN) ?? []).some((w) => levels.has(w))
const name = (level: number) => `pr-vocab-${level}`
const LEVELS = Array.from({ length: MAX_LEVEL - 1 }, (_, i) => i + 1)
// 片語可能跨過 <em> 等標籤，以「最內層的段落」為單位比對
const BLOCKS = 'p,li,blockquote,dd,dt,td,th,h1,h2,h3,h4,h5,h6,figcaption,pre,div'

function phraseRanges(doc: Document, phrases: Map<string, number>, rangesByLevel: Map<number, Range[]>): Range[] {
  const found: Range[] = []
  const firstWords = [...phrases.keys()].map((p) => p.split(' ')[0])
  for (const block of Array.from(doc.body.querySelectorAll(BLOCKS))) {
    if (block.querySelector(BLOCKS)) continue
    const lower = block.textContent?.toLocaleLowerCase() ?? ''
    if (!firstWords.some((w) => lower.includes(w))) continue
    const index = buildTextIndex(block)
    for (const m of findPhraseMatches(index.text, phrases)) {
      const range = rangeFor(index, m.start, m.end)
      if (!range) continue
      rangesByLevel.get(m.level)?.push(range)
      found.push(range)
    }
  }
  return found
}

// 片語裡的單字已經一起上色，不要再疊一層（顏色會變深）
const insideAny = (outer: Range[], r: Range) =>
  outer.some((p) => p.compareBoundaryPoints(Range.START_TO_START, r) <= 0 && p.compareBoundaryPoints(Range.END_TO_END, r) >= 0)

type HighlightWindow = Window & {
  CSS?: { highlights?: Map<string, unknown> }
  Highlight?: new (...ranges: Range[]) => { priority: number }
}

export function applyVocabHighlights(doc: Document, levels: Map<string, number>, locale?: string) {
  const win = doc.defaultView as HighlightWindow | null
  const highlights = win?.CSS?.highlights
  if (!highlights || !win?.Highlight || !doc.body) return

  const rangesByLevel = new Map<number, Range[]>(LEVELS.map((l) => [l, []]))
  const phrases = new Map([...levels].filter(([form]) => isPhrase(form)))
  const phraseHits = phrases.size > 0 ? phraseRanges(doc, phrases, rangesByLevel) : []
  if (levels.size > phrases.size) {
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
        if (phraseHits.length > 0 && insideAny(phraseHits, range)) continue
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
  (l) => `::highlight(${name(l)}) { background-color: rgba(169, 154, 137, ${(0.45 - (l - 1) * 0.1).toFixed(2)}); }`,
).join('\n')
