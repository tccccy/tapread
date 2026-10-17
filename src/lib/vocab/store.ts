import type { ReaderDb } from '../db'
import { addExample, applyReview, formLevelMap, isDue, removeExample, sameExample, type ReviewGrade, type SaveInput, type VocabEntry, vocabId } from './model'

export interface VocabStore {
  save(input: SaveInput, now?: number): Promise<VocabEntry>
  unsave(id: string, word: string, sentence: string): Promise<void>
  /** 找出收藏了「這個字形在這一句」的那筆單字 */
  findSaved(language: string, word: string, sentence: string): Promise<VocabEntry | undefined>
  get(id: string): Promise<VocabEntry | undefined>
  remove(id: string): Promise<void>
  languages(): Promise<{ language: string; count: number }[]>
  list(language: string, bookId?: number): Promise<VocabEntry[]>
  dueCards(language: string, bookId?: number, now?: number): Promise<VocabEntry[]>
  review(id: string, grade: ReviewGrade, now?: number): Promise<VocabEntry>
  formLevels(language: string): Promise<Map<string, number>>
}

export function createVocabStore(db: ReaderDb): VocabStore {
  const byLanguage = (language: string, bookId?: number) =>
    db.vocab.where('language').equals(language)
      .filter((e) => bookId === undefined || e.bookIds.includes(bookId))
      .toArray()

  return {
    save: (input, now = Date.now()) =>
      db.transaction('rw', db.vocab, async () => {
        const id = vocabId(input.language, input.definition.lemma)
        const next = addExample(await db.vocab.get(id), input, now)
        await db.vocab.put(next)
        return next
      }),

    unsave: (id, word, sentence) =>
      db.transaction('rw', db.vocab, async () => {
        const entry = await db.vocab.get(id)
        if (!entry) return
        const next = removeExample(entry, word, sentence)
        if (next) await db.vocab.put(next)
        else await db.vocab.delete(id)
      }),

    findSaved: (language, word, sentence) =>
      db.vocab.where('forms').equals(word.toLocaleLowerCase())
        .filter((e) => e.language === language && e.examples.some((x) => sameExample(x, word, sentence)))
        .first(),

    get: (id) => db.vocab.get(id),
    remove: (id) => db.vocab.delete(id),

    async languages() {
      const counts = new Map<string, number>()
      await db.vocab.each((e) => counts.set(e.language, (counts.get(e.language) ?? 0) + 1))
      return [...counts].map(([language, count]) => ({ language, count })).sort((a, b) => b.count - a.count || a.language.localeCompare(b.language))
    },

    async list(language, bookId) {
      const entries = await byLanguage(language, bookId)
      return entries.sort((a, b) => b.createdAt - a.createdAt || b.updatedAt - a.updatedAt)
    },

    async dueCards(language, bookId, now = Date.now()) {
      const entries = await byLanguage(language, bookId)
      return entries.filter((e) => isDue(e, now)).sort((a, b) => a.dueAt - b.dueAt)
    },

    review: (id, grade, now = Date.now()) =>
      db.transaction('rw', db.vocab, async () => {
        const entry = await db.vocab.get(id)
        if (!entry) throw new Error(`找不到單字：${id}`)
        const next = applyReview(entry, grade, now)
        await db.vocab.put(next)
        return next
      }),

    async formLevels(language) {
      return formLevelMap(await db.vocab.where('language').equals(language).toArray())
    },
  }
}
