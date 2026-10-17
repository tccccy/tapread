import type { ReaderDb } from '../db'
import { addExample, applyReview, formLevelMap, removeExample, sameExample, type ReviewGrade, type SaveInput, type VocabEntry, vocabId } from './model'

export interface VocabStore {
  save(input: SaveInput, now?: number): Promise<VocabEntry>
  unsave(id: string, word: string, sentence: string): Promise<void>
  /** 找出收藏了「這個字形在這一句」的那筆單字 */
  findSaved(language: string, word: string, sentence: string): Promise<VocabEntry | undefined>
  get(id: string): Promise<VocabEntry | undefined>
  getMany(ids: string[]): Promise<VocabEntry[]>
  remove(id: string): Promise<void>
  languages(): Promise<{ language: string; count: number }[]>
  list(language: string, bookId?: number): Promise<VocabEntry[]>
  review(id: string, grade: ReviewGrade, now?: number): Promise<VocabEntry>
  formLevels(language: string): Promise<Map<string, number>>
  /** 書改了語言後，把它在舊語言下收藏的例句搬到新語言（與既有的字合併） */
  moveBookLanguage(bookId: number, from: string, to: string): Promise<void>
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
    getMany: async (ids) => (await db.vocab.bulkGet(ids)).filter((e): e is VocabEntry => e !== undefined),
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

    moveBookLanguage: (bookId, from, to) =>
      db.transaction('rw', db.vocab, async () => {
        if (from === to) return
        const now = Date.now()
        const entries = await db.vocab.where('language').equals(from).toArray()
        for (const entry of entries) {
          const moving = entry.examples.filter((x) => x.bookId === bookId)
          if (moving.length === 0) continue
          for (const x of moving) {
            const target = await db.vocab.get(vocabId(to, entry.lemma))
            const definition = { lemma: entry.lemma, pos: entry.pos, contextMeaning: x.contextMeaning, dictMeaning: entry.dictMeaning, note: x.note, cefr: entry.cefr ?? '' }
            await db.vocab.put(addExample(target, { language: to, word: x.word, sentence: x.sentence, definition, bookId, bookTitle: x.bookTitle, cfi: x.cfi }, now))
          }
          // 從舊語言的字移除搬走的例句；沒有例句了就整個刪掉
          const kept = moving.reduce<VocabEntry | null>((e, x) => (e ? removeExample(e, x.word, x.sentence) : null), entry)
          if (kept) await db.vocab.put(kept)
          else await db.vocab.delete(entry.id)
        }
      }),
  }
}
