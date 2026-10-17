import { db as defaultDb, createDb, type BookSummary, type ReaderDb } from './db'
import { FINISHED_PROGRESS, normalizeRating } from './books/bookshelf'

export type { BookSummary }

export type StoredBook = BookSummary & { file: Blob }
export type NewBook = Pick<StoredBook, 'title' | 'author' | 'language' | 'file' | 'format'>
export type Location = { cfi: string; progress: number }
/** 書的頁面可修改的欄位；rating 為 null 代表清除評分 */
export type BookPatch = { rating?: number | null; review?: string; finished?: boolean; shelfIds?: string[] }

const MAX_REVIEW_CHARS = 5000

export interface Library {
  addBook(book: NewBook): Promise<number>
  getBook(id: number): Promise<StoredBook | undefined>
  /** 只讀書目資料（不含檔案） */
  getSummary(id: number): Promise<BookSummary | undefined>
  listBooks(): Promise<BookSummary[]>
  saveLocation(id: number, location: Location): Promise<void>
  deleteBook(id: number): Promise<void>
  setLanguage(id: number, language: string): Promise<void>
  updateBook(id: number, patch: BookPatch): Promise<void>
  getCover(id: number): Promise<Blob | undefined>
  setCover(id: number, blob: Blob): Promise<void>
  /** 測試用：回傳各表筆數 */
  debugTableCounts(): Promise<{ books: number; files: number }>
}

export function createLibrary(dbOrName: ReaderDb | string = defaultDb): Library {
  const db = typeof dbOrName === 'string' ? createDb(dbOrName) : dbOrName

  // 同一毫秒內連續操作時仍保持先後順序
  let lastStamp = 0
  const stamp = () => {
    lastStamp = Math.max(Date.now(), lastStamp + 1)
    return lastStamp
  }

  return {
    addBook: ({ file, ...meta }) =>
      db.transaction('rw', db.books, db.files, async () => {
        const now = stamp()
        const id = (await db.books.add({
          ...meta,
          addedAt: now,
          lastOpenedAt: now,
          lastCfi: null,
          progress: 0,
        } as BookSummary)) as number
        await db.files.add({ id, blob: file })
        return id
      }),

    async getBook(id) {
      const [book, file] = await Promise.all([db.books.get(id), db.files.get(id)])
      return book && file ? { ...book, file: file.blob } : undefined
    },

    listBooks: () => db.books.orderBy('lastOpenedAt').reverse().toArray(),
    getSummary: (id) => db.books.get(id),

    async saveLocation(id, { cfi, progress }) {
      if (!(progress >= 0 && progress <= 1)) throw new RangeError(`progress 必須介於 0–1：${progress}`)
      const book = await db.books.get(id)
      if (!book) throw new Error(`找不到書：${id}`)
      const now = stamp()
      await db.books.update(id, {
        lastCfi: cfi,
        progress,
        lastOpenedAt: now,
        // 第一次閱讀記下開始日期；讀到底自動記下讀完日期
        ...(book.startedAt ? {} : { startedAt: now }),
        ...(!book.finishedAt && progress >= FINISHED_PROGRESS ? { finishedAt: now } : {}),
      })
    },

    async updateBook(id, patch) {
      const changes: Partial<BookSummary> = {}
      const now = stamp()
      if ('rating' in patch) {
        changes.rating = normalizeRating(patch.rating) ?? undefined
        changes.reviewUpdatedAt = now
      }
      if (patch.review !== undefined) {
        changes.review = patch.review.trim().slice(0, MAX_REVIEW_CHARS)
        changes.reviewUpdatedAt = now
      }
      if (patch.finished !== undefined) changes.finishedAt = patch.finished ? now : undefined
      if (patch.shelfIds !== undefined) changes.shelfIds = [...new Set(patch.shelfIds)]
      const updated = await db.books.update(id, changes)
      if (updated === 0) throw new Error(`找不到書：${id}`)
    },

    getCover: async (id) => (await db.covers.get(id))?.blob,
    setCover: async (id, blob) => {
      await db.covers.put({ id, blob })
    },

    async setLanguage(id, language) {
      const updated = await db.books.update(id, { language })
      if (updated === 0) throw new Error(`找不到書：${id}`)
    },

    deleteBook: (id) =>
      db.transaction('rw', db.books, db.files, db.covers, async () => {
        await db.books.delete(id)
        await db.files.delete(id)
        await db.covers.delete(id)
      }),

    debugTableCounts: async () => ({ books: await db.books.count(), files: await db.files.count() }),
  }
}

export const library = createLibrary()

/** 請瀏覽器把資料標為持久保存，降低 Safari 清除 IndexedDB 的機率 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  if (await navigator.storage.persisted()) return true
  return navigator.storage.persist()
}

// 原生 DOMException 與 Dexie 包裝後的錯誤 name 都是 QuotaExceededError
export const isQuotaError = (e: unknown) => (e as { name?: unknown } | null)?.name === 'QuotaExceededError'
