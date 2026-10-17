export type BookFileError = 'unsupported-type' | 'empty' | 'too-large' | 'not-zip'
export type BookFileCheck = { ok: true } | { ok: false; reason: BookFileError }

export const DEFAULT_MAX_BOOK_BYTES = 200 * 1024 * 1024
const SUPPORTED_EXTENSIONS = ['.epub']
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]

const hasSupportedExtension = (name: string) =>
  SUPPORTED_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext))

const startsWithZipMagic = async (file: Blob) => {
  const head = new Uint8Array(await file.slice(0, ZIP_MAGIC.length).arrayBuffer())
  return ZIP_MAGIC.every((byte, i) => head[i] === byte)
}

export async function checkBookFile(
  file: File,
  { maxBytes = DEFAULT_MAX_BOOK_BYTES }: { maxBytes?: number } = {},
): Promise<BookFileCheck> {
  if (!hasSupportedExtension(file.name)) return { ok: false, reason: 'unsupported-type' }
  if (file.size === 0) return { ok: false, reason: 'empty' }
  if (file.size > maxBytes) return { ok: false, reason: 'too-large' }
  if (!(await startsWithZipMagic(file))) return { ok: false, reason: 'not-zip' }
  return { ok: true }
}

const MESSAGES: Record<BookFileError, string> = {
  'unsupported-type': '目前只支援 EPUB 檔（.epub）。',
  empty: '這個檔案是空的。',
  'too-large': '檔案太大（上限 200 MB）。',
  'not-zip': '這個檔案看起來不是有效的 EPUB，可能已損壞。',
}

export const bookFileErrorMessage = (reason: BookFileError) => MESSAGES[reason]
