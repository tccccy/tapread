// 單字本的純邏輯：一律回傳新物件，不修改傳入的資料
import type { Definition } from '../ai/definition'

export const MAX_LEVEL = 5
const MINUTE = 60_000
const DAY = 86_400_000
// 熟練度 → 下次複習間隔；5 級為已熟，不再排程
const INTERVALS: Record<number, number> = { 1: 10 * MINUTE, 2: 1 * DAY, 3: 3 * DAY, 4: 7 * DAY }

export type ReviewGrade = 'again' | 'good' | 'known'

export interface VocabExample {
  word: string
  sentence: string
  contextMeaning: string
  note: string
  bookId: number
  bookTitle: string
  savedAt: number
}

export interface VocabEntry {
  id: string
  language: string
  lemma: string
  pos: string
  dictMeaning: string
  /** 看過的字形（小寫），書中上色用 */
  forms: string[]
  bookIds: number[]
  examples: VocabExample[]
  level: number
  dueAt: number
  createdAt: number
  updatedAt: number
}

export interface SaveInput {
  language: string
  word: string
  sentence: string
  definition: Definition
  bookId: number
  bookTitle: string
}

const norm = (s: string) => s.toLocaleLowerCase()
const unique = <T>(xs: T[]) => [...new Set(xs)]

export const vocabId = (language: string, lemma: string) => `${language}|${norm(lemma.trim())}`

export const sameExample = (x: VocabExample, word: string, sentence: string) =>
  norm(x.word) === norm(word) && x.sentence === sentence

const derived = (examples: VocabExample[]) => ({
  forms: unique(examples.map((x) => norm(x.word))),
  bookIds: unique(examples.map((x) => x.bookId)),
})

export function addExample(entry: VocabEntry | undefined, input: SaveInput, now: number): VocabEntry {
  const { definition: d } = input
  const example: VocabExample = {
    word: input.word,
    sentence: input.sentence,
    contextMeaning: d.contextMeaning,
    note: d.note,
    bookId: input.bookId,
    bookTitle: input.bookTitle,
    savedAt: now,
  }
  const base: VocabEntry = entry ?? {
    id: vocabId(input.language, d.lemma),
    language: input.language,
    lemma: d.lemma.trim(),
    pos: d.pos,
    dictMeaning: d.dictMeaning,
    forms: [],
    bookIds: [],
    examples: [],
    level: 1,
    dueAt: now,
    createdAt: now,
    updatedAt: now,
  }
  const isNew = !base.examples.some((x) => sameExample(x, input.word, input.sentence))
  const examples = isNew ? [...base.examples, example] : base.examples
  // 已熟的字又在新句子收藏，代表其實還不熟：重新排入複習
  const relearn = isNew && base.level >= MAX_LEVEL
  return {
    ...base,
    ...(relearn ? { level: 1, dueAt: now } : {}),
    pos: base.pos || d.pos,
    dictMeaning: base.dictMeaning || d.dictMeaning,
    examples,
    ...derived(examples),
    updatedAt: now,
  }
}

/** 移除一個例句；沒有例句時回傳 null，代表整個字應刪除 */
export function removeExample(entry: VocabEntry, word: string, sentence: string): VocabEntry | null {
  const examples = entry.examples.filter((x) => !sameExample(x, word, sentence))
  if (examples.length === 0) return null
  return { ...entry, examples, ...derived(examples) }
}

export function applyReview(entry: VocabEntry, grade: ReviewGrade, now: number): VocabEntry {
  const level = grade === 'known' ? MAX_LEVEL : grade === 'again' ? 1 : Math.min(entry.level + 1, MAX_LEVEL)
  const dueAt = level >= MAX_LEVEL ? Number.MAX_SAFE_INTEGER : now + INTERVALS[level]
  return { ...entry, level, dueAt, updatedAt: now }
}

export const isDue = (entry: VocabEntry, now: number) => entry.level < MAX_LEVEL && entry.dueAt <= now

/** 字形 → 熟練度；已熟的字不放進來（不上色） */
export function formLevelMap(entries: VocabEntry[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const e of entries) {
    if (e.level >= MAX_LEVEL) continue
    for (const f of e.forms) map.set(f, Math.min(map.get(f) ?? MAX_LEVEL, e.level))
  }
  return map
}
