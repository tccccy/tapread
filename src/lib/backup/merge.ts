// 備份的格式與合併規則（純函式）。跨裝置時同一本書在兩邊的 id 不同，以檔案內容的雜湊對應
import type { BookFormat } from '../bookFile'
import type { Highlight, ReadingDay } from '../db'
import { MAX_LEVEL, vocabId, type VocabEntry, type VocabExample } from '../vocab/model'

export const BACKUP_APP = 'tapread'
export const BACKUP_VERSION = 1
/** 例句所屬的書不在本機書庫時使用的書號（「回到書中」會自動隱藏） */
export const MISSING_BOOK_ID = -1

export interface BackupBook {
  /** 匯出端的書號，只用來對應單字本中的例句 */
  id: number
  /** 檔案內容 SHA-256，用來辨識不同裝置上的同一本書 */
  hash: string
  title: string
  author: string
  language: string
  format: BookFormat
  fileName: string
  lastCfi: string | null
  progress: number
  addedAt: number
  lastOpenedAt: number
  /** 書檔在 zip 中的路徑；只匯出單字與進度時沒有 */
  file?: string
  rating?: number
  review?: string
  reviewUpdatedAt?: number
  startedAt?: number
  finishedAt?: number
  /** 所在自訂書架的名稱（不同裝置書架 id 不同，以名稱對應） */
  shelves?: string[]
}

export interface BackupManifest {
  app: typeof BACKUP_APP
  version: number
  exportedAt: number
  books: BackupBook[]
  vocab: VocabEntry[]
  /** 每天的閱讀時間；舊版備份沒有 */
  readingDays?: ReadingDay[]
  /** 書摘（bookId 為備份中的書號）；舊版備份沒有 */
  highlights?: Highlight[]
}

export class BackupFormatError extends Error {
  name = 'BackupFormatError'
}

export function parseManifest(text: string): BackupManifest {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new BackupFormatError('備份檔內容損壞')
  }
  const m = data as Partial<BackupManifest> | null
  if (!m || m.app !== BACKUP_APP) throw new BackupFormatError('這不是 TapRead 的備份檔')
  if (typeof m.version !== 'number' || m.version > BACKUP_VERSION) {
    throw new BackupFormatError('這個備份檔來自較新版本的 TapRead，請先更新 App')
  }
  if (!Array.isArray(m.books) || !Array.isArray(m.vocab)) throw new BackupFormatError('備份檔內容損壞')
  return m as BackupManifest
}

// ---- 備份內容不可信：逐欄驗證，不合格的整筆略過（避免壞資料寫進資料庫、讓畫面打不開）----
const MAX_TEXT = 2000
const BOOK_FORMATS: BookFormat[] = ['epub', 'pdf', 'docx', 'txt']
const BOOK_FILE_PATH = /^books\/\d+\.(epub|pdf|docx|txt)$/

type Raw = Record<string, unknown>
const asObj = (v: unknown): Raw | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : null)
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v.slice(0, MAX_TEXT) : fallback)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const int = (v: unknown): number | null => (Number.isInteger(v) ? (v as number) : null)

function sanitizeExample(raw: unknown): VocabExample | null {
  const o = asObj(raw)
  const word = str(o?.word)
  const bookId = int(o?.bookId)
  const savedAt = num(o?.savedAt)
  if (!o || !word || bookId === null || savedAt === null || typeof o.sentence !== 'string') return null
  return {
    word, sentence: str(o.sentence), contextMeaning: str(o.contextMeaning), note: str(o.note),
    bookId, bookTitle: str(o.bookTitle), savedAt,
    ...(typeof o.cfi === 'string' ? { cfi: str(o.cfi) } : {}),
  }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const SECONDS_PER_DAY = 86_400

export function sanitizeReadingDay(raw: unknown): ReadingDay | null {
  const o = asObj(raw)
  const seconds = int(o?.seconds)
  if (!o || typeof o.date !== 'string' || !DATE.test(o.date) || seconds === null || seconds < 0 || seconds > SECONDS_PER_DAY) return null
  return { date: o.date, seconds }
}

const ID = /^[\w-]{1,64}$/

export function sanitizeHighlight(raw: unknown): Highlight | null {
  const o = asObj(raw)
  const bookId = int(o?.bookId)
  const createdAt = num(o?.createdAt)
  if (!o || typeof o.id !== 'string' || !ID.test(o.id) || bookId === null || createdAt === null) return null
  const cfi = str(o.cfi)
  const text = str(o.text)
  if (!cfi || !text) return null
  return {
    id: o.id, bookId, cfi, text, note: str(o.note), chapter: str(o.chapter).slice(0, 200),
    createdAt, updatedAt: num(o.updatedAt) ?? createdAt,
  }
}

/** 同一天取較多的那一份：重複匯入同一個備份不會讓時間加倍 */
export const mergeReadingDay = (local: ReadingDay | undefined, incoming: ReadingDay): ReadingDay | null =>
  !local || incoming.seconds > local.seconds ? incoming : null

/** 回傳整理過的單字；不合格回傳 null。id、字形、書號一律重新計算，不信任備份裡的值 */
export function sanitizeVocabEntry(raw: unknown): VocabEntry | null {
  const o = asObj(raw)
  const lemma = str(o?.lemma).trim()
  const level = int(o?.level)
  const dueAt = num(o?.dueAt)
  const createdAt = num(o?.createdAt)
  const updatedAt = num(o?.updatedAt)
  if (!o || !lemma || typeof o.language !== 'string' || level === null || level < 1 || level > MAX_LEVEL) return null
  if (dueAt === null || createdAt === null || updatedAt === null || !Array.isArray(o.examples)) return null
  const examples = o.examples.map(sanitizeExample).filter((x): x is VocabExample => x !== null)
  if (examples.length === 0) return null
  const language = str(o.language)
  return {
    id: vocabId(language, lemma), language, lemma, pos: str(o.pos), dictMeaning: str(o.dictMeaning),
    forms: unique(examples.map((x) => x.word.toLocaleLowerCase())),
    bookIds: unique(examples.map((x) => x.bookId)),
    examples, level, dueAt, createdAt, updatedAt,
  }
}

export function sanitizeBook(raw: unknown): BackupBook | null {
  const o = asObj(raw)
  const id = int(o?.id)
  const progress = num(o?.progress)
  const addedAt = num(o?.addedAt)
  const lastOpenedAt = num(o?.lastOpenedAt)
  const format = o?.format as BookFormat
  if (!o || id === null || typeof o.hash !== 'string' || !/^[0-9a-f]{64}$/.test(o.hash)) return null
  if (!BOOK_FORMATS.includes(format) || !str(o.title).trim()) return null
  if (progress === null || progress < 0 || progress > 1 || addedAt === null || lastOpenedAt === null) return null
  const file = typeof o.file === 'string' && BOOK_FILE_PATH.test(o.file) ? o.file : undefined
  const rating = num(o.rating)
  const optionalNum = (k: string) => {
    const v = num(o[k])
    return v === null ? {} : { [k]: v }
  }
  const shelves = Array.isArray(o.shelves)
    ? [...new Set(o.shelves.filter((s): s is string => typeof s === 'string' && s.trim() !== '').map((s) => s.trim().slice(0, 40)))]
    : []
  return {
    id, hash: o.hash, title: str(o.title), author: str(o.author), language: str(o.language).slice(0, 8), format,
    fileName: str(o.fileName) || `${str(o.title)}.${format}`,
    lastCfi: typeof o.lastCfi === 'string' ? str(o.lastCfi) : null,
    progress, addedAt, lastOpenedAt,
    ...(file ? { file } : {}),
    ...(rating !== null && rating >= 0.5 && rating <= 5 ? { rating: Math.round(rating * 2) / 2 } : {}),
    ...(typeof o.review === 'string' ? { review: o.review.slice(0, 5000) } : {}),
    ...optionalNum('reviewUpdatedAt'),
    ...optionalNum('startedAt'),
    ...optionalNum('finishedAt'),
    ...(shelves.length > 0 ? { shelves } : {}),
  }
}

const exampleKey = (x: VocabExample) => `${x.word.toLocaleLowerCase()}\u0001${x.sentence}`
const unique = <T>(xs: T[]) => [...new Set(xs)]

/** 合併同一個字：例句聯集、熟練度採較晚更新的一邊；回傳新物件 */
export function mergeVocabEntry(local: VocabEntry | undefined, incoming: VocabEntry, bookIdMap: Map<number, number>): VocabEntry {
  const remapped = incoming.examples.map((x) => ({ ...x, bookId: bookIdMap.get(x.bookId) ?? MISSING_BOOK_ID }))
  const seen = new Set((local?.examples ?? []).map(exampleKey))
  const examples = [...(local?.examples ?? []), ...remapped.filter((x) => !seen.has(exampleKey(x)))]
    .sort((a, b) => a.savedAt - b.savedAt)
  const newer = !local || incoming.updatedAt > local.updatedAt ? incoming : local
  const base = local ?? incoming
  return {
    ...base,
    pos: local?.pos || incoming.pos,
    dictMeaning: local?.dictMeaning || incoming.dictMeaning,
    examples,
    forms: unique(examples.map((x) => x.word.toLocaleLowerCase())),
    bookIds: unique(examples.map((x) => x.bookId)),
    level: newer.level,
    dueAt: newer.dueAt,
    updatedAt: newer.updatedAt,
    createdAt: Math.min(local?.createdAt ?? incoming.createdAt, incoming.createdAt),
  }
}

type Progress = { lastCfi: string | null; progress: number; lastOpenedAt: number }

/** 備份的閱讀進度比本機新才採用；回傳要更新的欄位，或 null（維持本機） */
export function mergeProgress(local: Progress, incoming: Progress): Progress | null {
  if (!incoming.lastCfi || incoming.lastOpenedAt <= local.lastOpenedAt) return null
  return { lastCfi: incoming.lastCfi, progress: incoming.progress, lastOpenedAt: incoming.lastOpenedAt }
}

type BookMeta = Pick<BackupBook, 'rating' | 'review' | 'reviewUpdatedAt' | 'startedAt' | 'finishedAt'>

/** 合併評分、評語與日期：評分評語採較晚修改的一邊；開始日期取較早；讀完日期本機沒有才補。回傳要更新的欄位或 null */
export function mergeBookMeta(local: BookMeta, incoming: BookMeta): BookMeta | null {
  const patch: BookMeta = {}
  if ((incoming.reviewUpdatedAt ?? 0) > (local.reviewUpdatedAt ?? 0)) {
    patch.rating = incoming.rating
    patch.review = incoming.review
    patch.reviewUpdatedAt = incoming.reviewUpdatedAt
  }
  if (incoming.startedAt && (!local.startedAt || incoming.startedAt < local.startedAt)) patch.startedAt = incoming.startedAt
  if (incoming.finishedAt && !local.finishedAt) patch.finishedAt = incoming.finishedAt
  return Object.keys(patch).length > 0 ? patch : null
}
