import { describe, expect, it } from 'vitest'
import { checkBookFile, bookFileErrorMessage } from '../src/lib/bookFile'

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]

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

  it('拒絕不支援的副檔名', async () => {
    const result = await checkBookFile(makeFile('notes.docx', [...ZIP_MAGIC]))
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
    expect(result).toEqual({ ok: false, reason: 'not-zip' })
  })
})

describe('bookFileErrorMessage', () => {
  it('每種錯誤都有繁中訊息', () => {
    for (const reason of ['unsupported-type', 'empty', 'too-large', 'not-zip'] as const) {
      expect(bookFileErrorMessage(reason)).toMatch(/\S/)
    }
  })
})
