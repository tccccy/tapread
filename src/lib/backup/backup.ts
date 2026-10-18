// 匯出／匯入備份檔（zip）：manifest.json ＋ books/<id>.<副檔名>
// 不包含 API 金鑰：備份檔可能會傳給別人
import { zipSync, unzipSync, strToU8, strFromU8, type Zippable } from 'fflate'
import type { ReaderDb } from '../db'
import { DEFAULT_MAX_BOOK_BYTES } from '../bookFile'
import type { VocabEntry } from '../vocab/model'
import {
  BACKUP_APP, BACKUP_VERSION, BackupFormatError, mergeBookMeta, mergeProgress, mergeReadingDay, mergeVocabEntry, parseManifest,
  sanitizeBook, sanitizeHighlight, sanitizeReadingDay, sanitizeVocabEntry, type BackupBook, type BackupManifest,
} from './merge'

// 單字本的 manifest 不會太大；設上限避免惡意的 zip 炸彈
const MAX_MANIFEST_BYTES = 50 * 1024 * 1024

const toHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
const sha256 = async (blob: Blob) => toHex(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))

/** 每本書的內容雜湊；沒算過的現在算並存起來 */
async function bookHashes(db: ReaderDb): Promise<Map<number, string>> {
  const out = new Map<number, string>()
  for (const book of await db.books.toArray()) {
    if (book.hash) {
      out.set(book.id, book.hash)
      continue
    }
    const file = await db.files.get(book.id)
    if (!file) continue
    const hash = await sha256(file.blob)
    await db.books.update(book.id, { hash })
    out.set(book.id, hash)
  }
  return out
}

export async function exportBackup(db: ReaderDb, { includeBooks }: { includeBooks: boolean }): Promise<Uint8Array> {
  const hashes = await bookHashes(db)
  const shelfNames = new Map((await db.shelves.toArray()).map((s) => [s.id, s.name]))
  const zip: Zippable = {}
  const books: BackupBook[] = []
  for (const book of await db.books.toArray()) {
    const hash = hashes.get(book.id)
    if (!hash) continue
    const format = book.format ?? 'epub'
    const entry: BackupBook = {
      id: book.id, hash, title: book.title, author: book.author, language: book.language, format,
      fileName: `${book.title}.${format}`, lastCfi: book.lastCfi, progress: book.progress,
      addedAt: book.addedAt, lastOpenedAt: book.lastOpenedAt,
      ...pick(book, ['rating', 'review', 'reviewUpdatedAt', 'startedAt', 'finishedAt']),
      shelves: (book.shelfIds ?? []).map((id) => shelfNames.get(id)).filter((n): n is string => !!n),
    }
    if (includeBooks) {
      const file = await db.files.get(book.id)
      if (file) {
        const path = `books/${book.id}.${format}`
        // 書檔本身多半已壓縮，直接存放比較快
        zip[path] = [new Uint8Array(await file.blob.arrayBuffer()), { level: 0 }]
        entry.file = path
      }
    }
    books.push(entry)
  }
  const manifest: BackupManifest = {
    app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: Date.now(), books, vocab: await db.vocab.toArray(),
    readingDays: await db.readingDays.toArray(),
    highlights: (await db.highlights.toArray()).filter((h) => books.some((b) => b.id === h.bookId)),
  }
  zip['manifest.json'] = strToU8(JSON.stringify(manifest))
  return zipSync(zip)
}

export interface ImportSummary {
  booksAdded: number
  booksUpdated: number
  /** 備份裡沒有書檔（或書檔過大）、本機也沒有這本書 */
  booksSkipped: number
  wordsAdded: number
  wordsMerged: number
  /** 格式不正確、或書檔內容與記錄不符而略過的項目 */
  invalid: number
}

const MIME: Record<string, string> = {
  epub: 'application/epub+zip',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain;charset=utf-8',
}

const pick = <T extends object, K extends keyof T>(obj: T, keys: K[]): Partial<Pick<T, K>> =>
  Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]])) as Partial<Pick<T, K>>

/** 備份中的書架名稱 → 本機書架 id；本機沒有的書架自動建立（名稱不分大小寫比對） */
async function resolveShelves(db: ReaderDb, names: string[]): Promise<Map<string, string>> {
  const out = new Map((await db.shelves.toArray()).map((s) => [s.name.toLocaleLowerCase(), s.id]))
  let order = ((await db.shelves.orderBy('order').last())?.order ?? -1) + 1
  for (const name of names) {
    const key = name.toLocaleLowerCase()
    if (out.has(key)) continue
    const id = crypto.randomUUID()
    await db.shelves.add({ id, name, order: order++, createdAt: Date.now() })
    out.set(key, id)
  }
  return out
}

/** 只解壓指定的一個檔案（並限制大小），避免一次把整個備份展開在記憶體裡 */
function extractOne(data: Uint8Array, path: string, maxBytes: number): Uint8Array | undefined {
  const out = unzipSync(data, { filter: (f) => f.name === path && f.originalSize <= maxBytes })
  return Object.hasOwn(out, path) ? out[path] : undefined
}

export async function importBackup(db: ReaderDb, data: Uint8Array): Promise<ImportSummary> {
  let manifestBytes: Uint8Array | undefined
  try {
    manifestBytes = extractOne(data, 'manifest.json', MAX_MANIFEST_BYTES)
  } catch {
    throw new BackupFormatError('這不是 TapRead 的備份檔（無法解壓縮）')
  }
  if (!manifestBytes) throw new BackupFormatError('這不是 TapRead 的備份檔')
  const manifest = parseManifest(strFromU8(manifestBytes))

  const summary: ImportSummary = { booksAdded: 0, booksUpdated: 0, booksSkipped: 0, wordsAdded: 0, wordsMerged: 0, invalid: 0 }
  const books = manifest.books.map(sanitizeBook).filter((b): b is BackupBook => b !== null)
  const vocab = manifest.vocab.map(sanitizeVocabEntry).filter((e): e is VocabEntry => e !== null)
  summary.invalid += manifest.books.length - books.length + manifest.vocab.length - vocab.length
  const rawDays = Array.isArray(manifest.readingDays) ? manifest.readingDays : []
  const readingDays = rawDays.map(sanitizeReadingDay).filter((d) => d !== null)
  const rawHighlights = Array.isArray(manifest.highlights) ? manifest.highlights : []
  const highlights = rawHighlights.map(sanitizeHighlight).filter((h) => h !== null)
  summary.invalid += rawHighlights.length - highlights.length

  const localByHash = new Map([...(await bookHashes(db))].map(([id, hash]) => [hash, id]))
  // 備份中的書號 → 本機書號
  const bookIdMap = new Map<number, number>()
  // 本機原本就有的書（要合併進度與評分；新加入的書直接沿用備份的值）
  const existingIds = new Set<number>()

  // 新書逐本解壓、驗證、存入，處理完就釋放記憶體（iPad 上書多時很重要）
  for (const b of books) {
    const localId = localByHash.get(b.hash)
    if (localId !== undefined) {
      bookIdMap.set(b.id, localId)
      existingIds.add(localId)
      continue
    }
    const bytes = b.file ? extractOne(data, b.file, DEFAULT_MAX_BOOK_BYTES) : undefined
    if (!bytes) {
      summary.booksSkipped++
      continue
    }
    // 不相信備份記錄的雜湊，用實際內容重算
    const file = new File([bytes as Uint8Array<ArrayBuffer>], b.fileName, { type: MIME[b.format] ?? '' })
    if ((await sha256(file)) !== b.hash) {
      summary.invalid++
      continue
    }
    const id = await db.transaction('rw', db.books, db.files, async () => {
      const newId = (await db.books.add({
        title: b.title, author: b.author, language: b.language, format: b.format, hash: b.hash,
        addedAt: b.addedAt, lastOpenedAt: b.lastOpenedAt, lastCfi: b.lastCfi, progress: b.progress,
        ...pick(b, ['rating', 'review', 'reviewUpdatedAt', 'startedAt', 'finishedAt']),
      })) as number
      await db.files.add({ id: newId, blob: file })
      return newId
    })
    localByHash.set(b.hash, id)
    bookIdMap.set(b.id, id)
    summary.booksAdded++
  }

  return db.transaction('rw', [db.books, db.vocab, db.shelves, db.readingDays, db.highlights], async () => {
    // 只替真的有對應到本機的書建立書架，略過的書不會留下空書架
    const mapped = books.filter((b) => bookIdMap.has(b.id))
    const shelfIdOf = await resolveShelves(db, mapped.flatMap((b) => b.shelves ?? []))
    const shelfIdsFor = (b: BackupBook) =>
      (b.shelves ?? []).map((n) => shelfIdOf.get(n.toLocaleLowerCase())).filter((id): id is string => !!id)

    for (const b of mapped) {
      const localId = bookIdMap.get(b.id)!
      const local = await db.books.get(localId)
      if (!local) continue
      const isExisting = existingIds.has(localId)
      const progress = isExisting ? mergeProgress(local, b) : null
      const meta = isExisting ? mergeBookMeta(local, b) : null
      const shelfIds = [...new Set([...(local.shelfIds ?? []), ...shelfIdsFor(b)])]
      await db.books.update(localId, { ...progress, ...meta, shelfIds })
      // 摘要只計算使用者會在意的變化：閱讀進度、評分評語
      if (progress || meta?.reviewUpdatedAt) summary.booksUpdated++
    }
    for (const incoming of vocab) {
      const local = await db.vocab.get(incoming.id)
      await db.vocab.put(mergeVocabEntry(local, incoming, bookIdMap))
      if (local) summary.wordsMerged++
      else summary.wordsAdded++
    }
    // 書摘：對應到本機的書號；同一本書同一個位置已經有劃線就略過，同一則較新的覆蓋
    for (const h of highlights) {
      const localBookId = bookIdMap.get(h.bookId)
      if (localBookId === undefined) continue
      const mapped = { ...h, bookId: localBookId }
      const same = await db.highlights.get(h.id)
      if (same) {
        if (mapped.updatedAt > same.updatedAt) await db.highlights.put(mapped)
        continue
      }
      const duplicate = await db.highlights.where('bookId').equals(localBookId).filter((x) => x.cfi === h.cfi).first()
      if (!duplicate) await db.highlights.add(mapped)
    }
    for (const day of readingDays) {
      const merged = mergeReadingDay(await db.readingDays.get(day.date), day)
      if (merged) await db.readingDays.put(merged)
    }
    return summary
  })
}
