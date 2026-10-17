import type { VocabEntry } from './model'

export type VocabSort = 'recent' | 'alpha' | 'level'

export interface VocabQuery {
  query: string
  sort: VocabSort
  bookId?: number
  /** 字母排序用的語言規則，例如 es */
  locale?: string
}

const haystack = (e: VocabEntry) =>
  [e.lemma, e.dictMeaning, ...e.forms, ...e.examples.flatMap((x) => [x.sentence, x.contextMeaning])]
    .join('\n')
    .toLocaleLowerCase()

const collator = (locale?: string) => {
  try {
    return new Intl.Collator(locale || undefined, { sensitivity: 'base' })
  } catch {
    return new Intl.Collator(undefined, { sensitivity: 'base' })
  }
}

/** 搜尋、篩書、排序；回傳新陣列 */
export function queryVocab(entries: VocabEntry[], { query, sort, bookId, locale }: VocabQuery): VocabEntry[] {
  const q = query.trim().toLocaleLowerCase()
  const matched = entries.filter(
    (e) => (bookId === undefined || e.bookIds.includes(bookId)) && (!q || haystack(e).includes(q)),
  )
  const byRecent = (a: VocabEntry, b: VocabEntry) => b.createdAt - a.createdAt
  if (sort === 'alpha') {
    const c = collator(locale)
    return matched.sort((a, b) => c.compare(a.lemma, b.lemma))
  }
  if (sort === 'level') return matched.sort((a, b) => a.level - b.level || byRecent(a, b))
  return matched.sort(byRecent)
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** 把例句中的目標字切成 [前, 字, 後]，優先比對完整單字 */
export function splitAround(sentence: string, word: string): [string, string, string] {
  const whole = new RegExp(`(?<![\\p{L}\\p{M}])${escapeRegExp(word)}(?![\\p{L}\\p{M}])`, 'iu').exec(sentence)
  if (!word) return [sentence, '', '']
  // 優先用正規表示式的實際命中長度；退回 indexOf 時兩邊都轉小寫，長度可能和原字不同（如 İ），以原字長度為準
  const i = whole ? whole.index : sentence.toLocaleLowerCase().indexOf(word.toLocaleLowerCase())
  if (i < 0) return [sentence, '', '']
  const end = i + (whole ? whole[0].length : word.length)
  return [sentence.slice(0, i), sentence.slice(i, end), sentence.slice(end)]
}
