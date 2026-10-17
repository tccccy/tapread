export interface WordHit {
  word: string
  start: number
  end: number
}

export interface SentenceContext {
  sentence: string
  before: string
  after: string
}

const MAX_SENTENCE_CHARS = 500
// 數字不需要查
const HAS_LETTER = /\p{L}/u

const segmenterCache = new Map<string, Intl.Segmenter>()
const segmenter = (locale: string | undefined, granularity: 'word' | 'sentence') => {
  const cacheKey = `${locale ?? ''}|${granularity}`
  let seg = segmenterCache.get(cacheKey)
  if (!seg) {
    try {
      seg = new Intl.Segmenter(locale || undefined, { granularity })
    } catch {
      // 語言碼不合法（來自書本 metadata）時退回預設
      seg = new Intl.Segmenter(undefined, { granularity })
    }
    segmenterCache.set(cacheKey, seg)
  }
  return seg
}

const wordSegmentAt = (text: string, offset: number, locale?: string) => {
  if (offset < 0 || offset >= text.length) return null
  const seg = segmenter(locale, 'word').segment(text).containing(offset)
  return seg?.isWordLike && HAS_LETTER.test(seg.segment) ? seg : null
}

export function wordAt(text: string, offset: number, locale?: string): WordHit | null {
  // 點在單字最後一個字母的右半邊時，游標位置會落在字尾之後
  const seg = wordSegmentAt(text, offset, locale) ?? wordSegmentAt(text, offset - 1, locale)
  if (!seg) return null
  return { word: seg.segment, start: seg.index, end: seg.index + seg.segment.length }
}

// 只對點擊位置附近的文字分句，避免整章塞在一個 <div> 時 iPad 卡頓
const CONTEXT_WINDOW = 3000

const clip = (s: string) => {
  const t = s.trim()
  return t.length > MAX_SENTENCE_CHARS ? t.slice(0, MAX_SENTENCE_CHARS) : t
}

// 長句以目標字為中心截取，確保目標字一定在送出的句子裡
const clipAround = (s: string, pos: number) => {
  if (s.length <= MAX_SENTENCE_CHARS) return s.trim()
  const start = Math.min(Math.max(0, pos - MAX_SENTENCE_CHARS / 2), s.length - MAX_SENTENCE_CHARS)
  return s.slice(start, start + MAX_SENTENCE_CHARS).trim()
}

export function sentenceContext(text: string, offset: number, locale?: string): SentenceContext {
  const from = Math.max(0, offset - CONTEXT_WINDOW)
  const slice = text.slice(from, offset + CONTEXT_WINDOW)
  const local = offset - from
  const sentences = Array.from(segmenter(locale, 'sentence').segment(slice))
  const i = sentences.findIndex((s) => local >= s.index && local < s.index + s.segment.length)
  const at = i === -1 ? sentences.length - 1 : i
  const current = sentences[at]
  return {
    sentence: current ? clipAround(current.segment, local - current.index) : clip(slice),
    before: clip(sentences[at - 1]?.segment ?? ''),
    after: clip(sentences[at + 1]?.segment ?? ''),
  }
}
