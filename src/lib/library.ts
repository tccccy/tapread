import Dexie, { type EntityTable } from 'dexie'

export interface BookSummary {
  id: number
  title: string
  author: string
  language: string
  addedAt: number
  lastOpenedAt: number
  lastCfi: string | null
  progress: number
}

export type StoredBook = BookSummary & { file: Blob }
export type NewBook = Pick<StoredBook, 'title' | 'author' | 'language' | 'file'>
export type Location = { cfi: string; progress: number }

export interface Library {
  addBook(book: NewBook): Promise<number>
  getBook(id: number): Promise<StoredBook | undefined>
  listBooks(): Promise<BookSummary[]>
  saveLocation(id: number, location: Location): Promise<void>
  deleteBook(id: number): Promise<void>
  /** 測試用：回傳各表筆數 */
  debugTableCounts(): Promise<{ books: number; files: number }>
}

// 檔案本體另存一表，列書目時不必把整本書讀進記憶體（iPad 上書多時很重要）
interface StoredFile {
  id: number
  blob: Blob
}

type ReaderDb = Dexie & {
  books: EntityTable<BookSummary, 'id'>
  files: EntityTable<StoredFile, 'id'>
}

export function createLibrary(dbName = 'polyglot-reader'): Library {
  const db = new Dexie(dbName) as ReaderDb
  db.version(1).stores({ books: '++id, lastOpenedAt', files: 'id' })

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

    async saveLocation(id, { cfi, progress }) {
      if (!(progress >= 0 && progress <= 1)) throw new RangeError(`progress 必須介於 0–1：${progress}`)
      const updated = await db.books.update(id, { lastCfi: cfi, progress, lastOpenedAt: stamp() })
      if (updated === 0) throw new Error(`找不到書：${id}`)
    },

    deleteBook: (id) =>
      db.transaction('rw', db.books, db.files, async () => {
        await db.books.delete(id)
        await db.files.delete(id)
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
