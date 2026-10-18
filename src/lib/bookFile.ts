export type BookFormat = 'epub' | 'pdf' | 'docx' | 'txt'
export type BookFileError = 'unsupported-type' | 'empty' | 'too-large' | 'corrupt' | 'legacy-doc'
export type BookFileCheck = { ok: true } | { ok: false; reason: BookFileError }

export const DEFAULT_MAX_BOOK_BYTES = 200 * 1024 * 1024

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d] // %PDF-

// 每種格式的副檔名與檔頭特徵（EPUB 與 .docx 都是 zip）
const FORMATS: Record<BookFormat, { ext: string; magic: number[] }> = {
  epub: { ext: '.epub', magic: ZIP_MAGIC },
  pdf: { ext: '.pdf', magic: PDF_MAGIC },
  docx: { ext: '.docx', magic: ZIP_MAGIC },
  // 純文字沒有檔頭可驗證
  txt: { ext: '.txt', magic: [] },
}

/** 給檔案選擇器的 accept 值 */
export const ACCEPTED_EXTENSIONS = Object.values(FORMATS).map((f) => f.ext).join(',')

export function bookFormat(fileName: string): BookFormat | null {
  const name = fileName.toLowerCase()
  const hit = (Object.keys(FORMATS) as BookFormat[]).find((f) => name.endsWith(FORMATS[f].ext))
  return hit ?? null
}

const startsWith = async (file: Blob, magic: number[]) => {
  const head = new Uint8Array(await file.slice(0, magic.length).arrayBuffer())
  return magic.every((byte, i) => head[i] === byte)
}

export async function checkBookFile(
  file: File,
  { maxBytes = DEFAULT_MAX_BOOK_BYTES }: { maxBytes?: number } = {},
): Promise<BookFileCheck> {
  const format = bookFormat(file.name)
  if (!format) {
    return { ok: false, reason: file.name.toLowerCase().endsWith('.doc') ? 'legacy-doc' : 'unsupported-type' }
  }
  if (file.size === 0) return { ok: false, reason: 'empty' }
  if (file.size > maxBytes) return { ok: false, reason: 'too-large' }
  if (!(await startsWith(file, FORMATS[format].magic))) return { ok: false, reason: 'corrupt' }
  return { ok: true }
}

const MESSAGES: Record<BookFileError, string> = {
  'unsupported-type': '目前支援 EPUB、PDF、Word（.docx）與純文字（.txt）。',
  empty: '這個檔案是空的。',
  'too-large': '檔案太大（上限 200 MB）。',
  corrupt: '這個檔案的內容和副檔名不符，可能已損壞。',
  'legacy-doc': '這是舊版 Word 格式（.doc），請先在 Word 用「另存新檔」存成 .docx 再匯入。',
}

export const bookFileErrorMessage = (reason: BookFileError) => MESSAGES[reason]
