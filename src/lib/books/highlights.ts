// 書中劃線（書摘）：存位置、文字、章節與自己的註記
import type { Highlight, ReaderDb } from '../db'

export const MAX_HIGHLIGHT_CHARS = 2000
export const MAX_NOTE_CHARS = 2000

export interface NewHighlight {
  bookId: number
  cfi: string
  text: string
  chapter: string
}

// 保留換行（詩、對話），只合併多餘的空白
const tidy = (s: string) => s.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim()

export function createHighlightStore(db: ReaderDb) {
  return {
    async add(input: NewHighlight): Promise<Highlight> {
      const existing = await db.highlights.where('bookId').equals(input.bookId).filter((h) => h.cfi === input.cfi).first()
      if (existing) return existing
      const now = Date.now()
      const highlight: Highlight = {
        id: crypto.randomUUID(),
        bookId: input.bookId,
        cfi: input.cfi,
        text: tidy(input.text).slice(0, MAX_HIGHLIGHT_CHARS),
        note: '',
        chapter: input.chapter.trim().slice(0, 200),
        createdAt: now,
        updatedAt: now,
      }
      await db.highlights.add(highlight)
      return highlight
    },

    async listByBook(bookId: number): Promise<Highlight[]> {
      const list = await db.highlights.where('bookId').equals(bookId).toArray()
      return list.sort((a, b) => b.createdAt - a.createdAt)
    },

    async setNote(id: string, note: string): Promise<void> {
      await db.highlights.update(id, { note: note.trim().slice(0, MAX_NOTE_CHARS), updatedAt: Date.now() })
    },

    remove: (id: string) => db.highlights.delete(id),
  }
}

export type HighlightStore = ReturnType<typeof createHighlightStore>
