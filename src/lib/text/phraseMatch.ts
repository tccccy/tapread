// 片語（含空白的收藏，例如 give up、se dio cuenta）在書中的比對；純函式，可在 Node 測試

export const isPhrase = (form: string) => /\s/.test(form.trim())

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// 前後不能緊接字母：避免 give up 命中 forgive upward
const patternOf = (phrase: string) =>
  new RegExp(`(?<![\\p{L}\\p{M}])${phrase.trim().split(/\s+/).map(escapeRegExp).join('\\s+')}(?![\\p{L}\\p{M}])`, 'giu')

const patternCache = new Map<string, RegExp>()
const cachedPattern = (phrase: string) => {
  let re = patternCache.get(phrase)
  if (!re) {
    re = patternOf(phrase)
    patternCache.set(phrase, re)
  }
  re.lastIndex = 0
  return re
}

export interface PhraseMatch { start: number; end: number; level: number }

/** 找出文字中所有片語出現的位置；phrases 為「小寫片語 → 熟練度」 */
export function findPhraseMatches(text: string, phrases: Map<string, number>): PhraseMatch[] {
  const out: PhraseMatch[] = []
  for (const [phrase, level] of phrases) {
    const re = cachedPattern(phrase)
    for (let m = re.exec(text); m; m = re.exec(text)) {
      out.push({ start: m.index, end: m.index + m[0].length, level })
    }
  }
  return out
}
