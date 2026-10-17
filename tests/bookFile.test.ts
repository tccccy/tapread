import { describe, expect, it } from 'vitest'
import { checkBookFile, bookFileErrorMessage, bookFormat } from '../src/lib/bookFile'

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d] // %PDF-

const makeFile = (name: string, bytes: number[], type = '') =>
  new File([new Uint8Array(bytes)], name, { type })

describe('checkBookFile', () => {
  it('接受副檔名為 .epub 且內容是 zip 的檔案', async () => {
    const result = await checkBookFile(makeFile('book.epub', [...ZIP_MAGIC, 0, 0]))
    expect(result).toEqual({ ok: true })
  })

  it('副檔名大小寫不影響判斷', async () => {
    const result = await checkBookFile(makeFile('BOOK.EPUB', [...ZIP_MAGIC]))
    expect(result).toEqual({ ok: true })
  })

  it('接受 PDF（內容以 %PDF- 開頭）', async () => {
    expect(await checkBookFile(makeFile('paper.pdf', [...PDF_MAGIC, 0x31]))).toEqual({ ok: true })
  })

  it('拒絕副檔名是 .pdf 但內容不是 PDF 的檔案', async () => {
    expect(await checkBookFile(makeFile('fake.pdf', [...ZIP_MAGIC, 0]))).toEqual({ ok: false, reason: 'corrupt' })
  })

  it('接受 Word .docx（zip 格式）', async () => {
    expect(await checkBookFile(makeFile('notas.docx', [...ZIP_MAGIC, 0]))).toEqual({ ok: true })
  })

  it('舊版 Word .doc 給專屬提示', async () => {
    expect(await checkBookFile(makeFile('viejo.doc', [0xd0, 0xcf, 0x11, 0xe0]))).toEqual({ ok: false, reason: 'legacy-doc' })
  })

  it('拒絕不支援的副檔名', async () => {
    const result = await checkBookFile(makeFile('notes.pages', [...ZIP_MAGIC]))
    expect(result).toEqual({ ok: false, reason: 'unsupported-type' })
  })

  it('拒絕空檔案', async () => {
    const result = await checkBookFile(makeFile('empty.epub', []))
    expect(result).toEqual({ ok: false, reason: 'empty' })
  })

  it('拒絕超過大小上限的檔案', async () => {
    const result = await checkBookFile(makeFile('big.epub', [...ZIP_MAGIC, 0, 0]), { maxBytes: 4 })
    expect(result).toEqual({ ok: false, reason: 'too-large' })
  })

  it('拒絕副檔名是 .epub 但內容不是 zip 的檔案', async () => {
    const result = await checkBookFile(makeFile('fake.epub', [0x3c, 0x68, 0x74, 0x6d]))
    expect(result).toEqual({ ok: false, reason: 'corrupt' })
  })
})

describe('bookFileErrorMessage', () => {
  it('每種錯誤都有繁中訊息', () => {
    for (const reason of ['unsupported-type', 'empty', 'too-large', 'corrupt', 'legacy-doc'] as const) {
      expect(bookFileErrorMessage(reason)).toMatch(/\S/)
    }
  })
})

describe('bookFormat', () => {
  it('依副檔名判斷格式', () => {
    expect(bookFormat('a.EPUB')).toBe('epub')
    expect(bookFormat('a.pdf')).toBe('pdf')
    expect(bookFormat('a.docx')).toBe('docx')
    expect(bookFormat('a.txt')).toBeNull()
  })
})
