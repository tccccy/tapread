import { describe, expect, it } from 'vitest'
import { mergeVocabEntry, mergeProgress, parseManifest, sanitizeVocabEntry, sanitizeBook, BackupFormatError, MISSING_BOOK_ID } from '../src/lib/backup/merge'
import type { VocabEntry, VocabExample } from '../src/lib/vocab/model'

const ex = (over: Partial<VocabExample> = {}): VocabExample => ({
  word: 'banco', sentence: 'S1.', contextMeaning: '長椅', note: '', bookId: 10, bookTitle: 'A', savedAt: 100, ...over,
})
const entry = (over: Partial<VocabEntry> = {}): VocabEntry => ({
  id: 'es|banco', language: 'es', lemma: 'banco', pos: '名詞', dictMeaning: '長椅；銀行', forms: ['banco'], bookIds: [10],
  examples: [ex()], level: 1, dueAt: 0, createdAt: 100, updatedAt: 100, ...over,
})

describe('mergeVocabEntry', () => {
  const map = new Map([[10, 1], [11, 2]])

  it('本機沒有這個字：用備份的，書號換成本機的', () => {
    const merged = mergeVocabEntry(undefined, entry(), map)
    expect(merged.examples[0].bookId).toBe(1)
    expect(merged.bookIds).toEqual([1])
  })

  it('備份中的書本機沒有：例句保留，書號標成「不在書庫」', () => {
    const merged = mergeVocabEntry(undefined, entry({ examples: [ex({ bookId: 99 })] }), map)
    expect(merged.examples[0].bookId).toBe(MISSING_BOOK_ID)
  })

  it('兩邊都有：例句聯集去重，字形與書重算', () => {
    const local = entry({ examples: [ex({ bookId: 1 })], bookIds: [1] })
    const incoming = entry({ examples: [ex(), ex({ word: 'bancos', sentence: 'S2.', contextMeaning: '銀行', bookId: 11, savedAt: 200 })] })
    const merged = mergeVocabEntry(local, incoming, map)
    expect(merged.examples.map((x) => x.sentence)).toEqual(['S1.', 'S2.'])
    expect(merged.forms).toEqual(['banco', 'bancos'])
    expect(merged.bookIds).toEqual([1, 2])
  })

  it('熟練度採用較晚更新的那一邊', () => {
    const local = entry({ level: 2, dueAt: 5, updatedAt: 300 })
    expect(mergeVocabEntry(local, entry({ level: 4, dueAt: 9, updatedAt: 200 }), map)).toMatchObject({ level: 2, dueAt: 5, updatedAt: 300 })
    expect(mergeVocabEntry(local, entry({ level: 4, dueAt: 9, updatedAt: 400 }), map)).toMatchObject({ level: 4, dueAt: 9, updatedAt: 400 })
  })

  it('本機缺的欄位（難度等）由備份補上；不修改傳入物件', () => {
    const local = entry({ examples: [ex({ bookId: 1 })] })
    const frozen = structuredClone(local)
    expect(mergeVocabEntry(local, entry({ cefr: 'B1' }), map).cefr).toBe('B1')
    expect(local).toEqual(frozen)
  })
})

describe('mergeProgress', () => {
  const local = { lastCfi: 'L', progress: 0.2, lastOpenedAt: 100 }

  it('備份比較新才更新', () => {
    expect(mergeProgress(local, { lastCfi: 'B', progress: 0.5, lastOpenedAt: 200 })).toEqual({ lastCfi: 'B', progress: 0.5, lastOpenedAt: 200 })
    expect(mergeProgress(local, { lastCfi: 'B', progress: 0.5, lastOpenedAt: 50 })).toBeNull()
  })

  it('備份沒有閱讀位置時不覆蓋', () => {
    expect(mergeProgress(local, { lastCfi: null, progress: 0, lastOpenedAt: 999 })).toBeNull()
  })
})

describe('parseManifest', () => {
  const ok = { app: 'tapread', version: 1, exportedAt: 1, books: [], vocab: [] }

  it('接受正確格式', () => {
    expect(parseManifest(JSON.stringify(ok))).toEqual(ok)
  })

  it.each([
    ['不是 JSON', 'nope'],
    ['不是 TapRead 的備份', JSON.stringify({ ...ok, app: 'other' })],
    ['較新的備份版本', JSON.stringify({ ...ok, version: 99 })],
    ['欄位型別錯誤', JSON.stringify({ ...ok, vocab: 'x' })],
  ])('拒絕：%s', (_, text) => {
    expect(() => parseManifest(text)).toThrow(BackupFormatError)
  })
})

describe('sanitizeVocabEntry（備份內容不可信）', () => {
  it('正常資料原樣通過，id 依語言與原形重新計算', () => {
    const e = sanitizeVocabEntry({ ...entry(), id: 'es|otro' })
    expect(e?.id).toBe('es|banco')
    expect(e?.examples).toHaveLength(1)
  })

  it.each([
    ['不是物件', 'x'],
    ['沒有原形', { ...entry(), lemma: '' }],
    ['熟練度型別錯誤', { ...entry(), level: '2' }],
    ['熟練度超出範圍', { ...entry(), level: 9 }],
    ['例句不是陣列', { ...entry(), examples: 'x' }],
    ['沒有任何有效例句', { ...entry(), examples: [{ word: 1 }] }],
  ])('拒絕：%s', (_, raw) => {
    expect(sanitizeVocabEntry(raw)).toBeNull()
  })

  it('過濾掉壞掉的例句、選填欄位型別錯誤時清空', () => {
    const e = sanitizeVocabEntry({ ...entry(), pos: 5, cefr: { x: 1 }, examples: [ex(), { word: 'x' }] })
    expect(e?.examples).toHaveLength(1)
    expect(e?.pos).toBe('')
    expect(e).not.toHaveProperty('cefr')
  })
})

describe('sanitizeBook', () => {
  const book = {
    id: 3, hash: 'a'.repeat(64), title: 'T', author: '', language: 'es', format: 'epub', fileName: 'T.epub',
    lastCfi: 'epubcfi(/6/2)', progress: 0.5, addedAt: 1, lastOpenedAt: 2, file: 'books/3.epub',
  }

  it('正常資料通過', () => {
    expect(sanitizeBook(book)).toEqual(book)
  })

  it.each([
    ['雜湊格式錯誤', { ...book, hash: 'xyz' }],
    ['格式不支援', { ...book, format: 'exe' }],
    ['進度超出範圍', { ...book, progress: 3 }],
  ])('拒絕：%s', (_, raw) => {
    expect(sanitizeBook(raw)).toBeNull()
  })

  it('書檔路徑不符規則時視為沒有書檔', () => {
    expect(sanitizeBook({ ...book, file: '__proto__' })).not.toHaveProperty('file')
    expect(sanitizeBook({ ...book, file: '../etc/passwd' })).not.toHaveProperty('file')
  })

  it('閱讀位置不是字串時清空', () => {
    expect(sanitizeBook({ ...book, lastCfi: 42 })?.lastCfi).toBeNull()
  })
})
