// 封面：EPUB 取書內封面、PDF 用第一頁，縮成小圖存起來；全 App 共用 object URL 快取
import { library } from '../library'
import { loadBook } from '../openBook'
import type { BookFormat } from '../bookFile'
import type { BookSummary } from '../db'

const THUMB_WIDTH = 360

async function decode(blob: Blob): Promise<CanvasImageSource & { width: number; height: number }> {
  try {
    return await createImageBitmap(blob)
  } catch {
    // SVG 封面等 createImageBitmap 不支援的格式，改用 <img> 解碼
    const url = URL.createObjectURL(blob)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return img
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

async function thumbnail(blob: Blob): Promise<Blob | null> {
  const img = await decode(blob)
  try {
    const scale = Math.min(1, THUMB_WIDTH / img.width)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  } finally {
    if ('close' in img) img.close() // 釋放解碼後的點陣圖記憶體
  }
}

/** 從書檔取出封面縮圖；Word 或沒有封面時回傳 null */
export async function extractCover(file: Blob, format: BookFormat, title: string): Promise<Blob | null> {
  if (format === 'docx') return null
  const book = await loadBook(file, format, { fileName: `${title}.${format}`, title, language: '' })
  try {
    const cover = await (book as { getCover?: () => Promise<Blob | null> | Blob | null }).getCover?.()
    return cover ? await thumbnail(cover) : null
  } finally {
    book.destroy?.()
  }
}

// bookId → object URL（null 代表沒有封面，要用產生的布面封面）
const cache = new Map<number, Promise<string | null>>()

// 取封面（尤其 PDF 要畫第一頁）很吃資源：一次只處理一本，避免 iPad 一次開好幾本書
let queue: Promise<unknown> = Promise.resolve()
const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
  const run = queue.then(task, task)
  queue = run.catch(() => undefined)
  return run
}

async function loadOrExtract(book: Pick<BookSummary, 'id' | 'title' | 'format'>): Promise<string | null> {
  const saved = await library.getCover(book.id)
  if (saved) return saved.size > 0 ? URL.createObjectURL(saved) : null
  // 舊書還沒有封面：取一次並存起來
  return enqueue(async () => {
    const stored = await library.getBook(book.id)
    if (!stored) return null
    // 出錯（記憶體不足等）不記錄，下次開 App 再試；確定沒有封面才存空的 Blob，避免每次重試
    const extracted = await extractCover(stored.file, book.format ?? 'epub', book.title)
    await library.setCover(book.id, extracted ?? new Blob([]))
    return extracted ? URL.createObjectURL(extracted) : null
  })
}

export function coverUrl(book: Pick<BookSummary, 'id' | 'title' | 'format'>): Promise<string | null> {
  let p = cache.get(book.id)
  if (!p) {
    p = loadOrExtract(book).catch((e) => {
      console.warn('讀取封面失敗', e)
      return null
    })
    cache.set(book.id, p)
  }
  return p
}

/** 匯入新書時直接存好封面 */
export async function saveCoverOnImport(bookId: number, file: Blob, format: BookFormat, title: string) {
  // 出錯就不存，之後書架顯示時會再試一次
  const blob = await enqueue(() => extractCover(file, format, title))
  await library.setCover(bookId, blob ?? new Blob([]))
}

export function forgetCover(bookId: number) {
  cache.get(bookId)?.then((url) => url && URL.revokeObjectURL(url))
  cache.delete(bookId)
}
