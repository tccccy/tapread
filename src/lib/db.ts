import Dexie, { type EntityTable } from 'dexie'
import type { Definition } from './ai/definition'
import type { VocabEntry } from './vocab/model'
import type { BookFormat } from './bookFile'

export interface BookSummary {
  id: number
  title: string
  author: string
  language: string
  addedAt: number
  lastOpenedAt: number
  lastCfi: string | null
  progress: number
  /** 舊資料沒有這欄，視為 epub */
  format?: BookFormat
  /** 檔案內容 SHA-256（備份時用來辨識不同裝置上的同一本書）；需要時才計算並快取 */
  hash?: string
  /** 0.5–5，半顆星為單位；沒評分時沒有這欄 */
  rating?: number
  review?: string
  /** 評分或評語最後修改時間（備份合併用） */
  reviewUpdatedAt?: number
  startedAt?: number
  finishedAt?: number
  /** 所在的自訂書架（可多個） */
  shelfIds?: string[]
}

export interface Shelf {
  id: string
  name: string
  order: number
  createdAt: number
}

export interface StoredCover {
  id: number
  blob: Blob
}

// 檔案本體另存一表，列書目時不必把整本書讀進記憶體（iPad 上書多時很重要）
export interface StoredFile {
  id: number
  blob: Blob
}

export interface CachedDefinition {
  key: string
  definition: Definition
  createdAt: number
}

export type ReaderDb = Dexie & {
  books: EntityTable<BookSummary, 'id'>
  files: EntityTable<StoredFile, 'id'>
  definitions: EntityTable<CachedDefinition, 'key'>
  vocab: EntityTable<VocabEntry, 'id'>
  shelves: EntityTable<Shelf, 'id'>
  covers: EntityTable<StoredCover, 'id'>
}

// 資料庫名稱沿用改名（TapRead）前的舊名：改掉會讓使用者已存的書與單字本讀不到
export function createDb(name = 'polyglot-reader'): ReaderDb {
  const db = new Dexie(name) as ReaderDb
  db.version(1).stores({ books: '++id, lastOpenedAt', files: 'id' })
  db.version(2).stores({ definitions: 'key, createdAt' })
  db.version(3).stores({ vocab: 'id, language, dueAt' })
  // 以字形查詢已收藏的例句（AI 回傳的原形可能每次不同）
  db.version(4).stores({ vocab: 'id, language, dueAt, *forms' })
  db.version(5).stores({ shelves: 'id, order', covers: 'id' })
  return db
}

export const db = createDb()
