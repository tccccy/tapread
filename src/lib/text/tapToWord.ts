import { hitAt, rangeContainsPoint, rangeForOffsets } from './domHit'
import { sentenceContext, wordAt, type SentenceContext } from './wordContext'

export interface TappedWord extends SentenceContext {
  word: string
  range: Range
}

/** 把書頁上的點擊轉成「單字 + 句子上下文」；沒點到字回傳 null */
export function tapToWord(doc: Document, x: number, y: number, language: string): TappedWord | null {
  const hit = hitAt(doc, x, y)
  if (!hit) return null
  const w = wordAt(hit.text, hit.offset, language)
  if (!w) return null
  const range = rangeForOffsets(hit.block, w.start, w.end)
  if (!range || !rangeContainsPoint(range, x, y)) return null
  return { word: w.word, range, ...sentenceContext(hit.text, w.start, language) }
}
