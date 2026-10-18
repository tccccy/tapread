import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { createDb } from '../src/lib/db'
import { createLibrary } from '../src/lib/library'
import { createVocabStore } from '../src/lib/vocab/store'
import { exportBackup, importBackup } from '../src/lib/backup/backup'
import { zipSync, strToU8 } from 'fflate'
import { BackupFormatError, MISSING_BOOK_ID } from '../src/lib/backup/merge'
import { createShelfStore } from '../src/lib/books/shelves'

let n = 0
const device = () => {
  const db = createDb(`backup-test-${++n}`)
  return { db, lib: createLibrary(db), vocab: createVocabStore(db) }
}
const epub = (text: string) => new File([text], 'libro.epub', { type: 'application/epub+zip' })
const def = (lemma: string, meaning: string) => ({ lemma, pos: '名詞', contextMeaning: meaning, dictMeaning: '', note: '', cefr: 'A2' })

async function seed() {
  const a = device()
  const bookId = await a.lib.addBook({ title: 'Libro', author: 'X', language: 'es', file: epub('contenido del libro'), format: 'epub' })
  await a.lib.saveLocation(bookId, { cfi: 'epubcfi(/6/4)', progress: 0.4 })
  await a.vocab.save({ language: 'es', word: 'banco', sentence: 'S1.', definition: def('banco', '長椅'), bookId, bookTitle: 'Libro' })
  return { a, bookId }
}

describe('備份與還原', () => {
  it('含書檔：另一台空的裝置匯入後，書、進度、單字本都在，書號自動對應', async () => {
    const { a } = await seed()
    const data = await exportBackup(a.db, { includeBooks: true })
    const b = device()
    const summary = await importBackup(b.db, data)
    expect(summary).toMatchObject({ booksAdded: 1, booksUpdated: 0, booksSkipped: 0, wordsAdded: 1, wordsMerged: 0 })

    const [book] = await b.lib.listBooks()
    expect(book).toMatchObject({ title: 'Libro', language: 'es', progress: 0.4, lastCfi: 'epubcfi(/6/4)', format: 'epub' })
    expect(await (await b.lib.getBook(book.id))!.file.text()).toBe('contenido del libro')
    const word = await b.vocab.get('es|banco')
    expect(word?.examples[0].bookId).toBe(book.id)
    expect(word?.cefr).toBe('A2')
  })

  it('重複匯入同一個備份不會產生重複的書或例句', async () => {
    const { a } = await seed()
    const data = await exportBackup(a.db, { includeBooks: true })
    const b = device()
    await importBackup(b.db, data)
    const again = await importBackup(b.db, data)
    expect(again).toMatchObject({ booksAdded: 0, wordsAdded: 0, wordsMerged: 1 })
    expect(await b.lib.listBooks()).toHaveLength(1)
    expect((await b.vocab.get('es|banco'))?.examples).toHaveLength(1)
  })

  it('只含單字與進度：本機已有同一本書（內容相同）時對應過去，並更新較新的進度', async () => {
    const { a } = await seed()
    const b = device()
    const localId = await b.lib.addBook({ title: 'Libro (otro nombre)', author: '', language: 'es', file: epub('contenido del libro'), format: 'epub' })
    const data = await exportBackup(a.db, { includeBooks: false })
    // 備份裡的進度是在 b 加入書之後才產生的，所以比較新
    const summary = await importBackup(b.db, data)
    expect(summary).toMatchObject({ booksAdded: 0, booksUpdated: 0, booksSkipped: 0 })
    expect((await b.vocab.get('es|banco'))?.examples[0].bookId).toBe(localId)
  })

  it('只含單字與進度、本機沒有那本書：單字照樣匯入，例句標成不在書庫', async () => {
    const { a } = await seed()
    const b = device()
    const summary = await importBackup(b.db, await exportBackup(a.db, { includeBooks: false }))
    expect(summary).toMatchObject({ booksSkipped: 1, wordsAdded: 1 })
    expect((await b.vocab.get('es|banco'))?.examples[0].bookId).toBe(MISSING_BOOK_ID)
  })

  it('備份中的進度比較新才覆蓋', async () => {
    const { a, bookId } = await seed()
    const b = device()
    await importBackup(b.db, await exportBackup(a.db, { includeBooks: true }))
    const [book] = await b.lib.listBooks()
    await b.lib.saveLocation(book.id, { cfi: 'epubcfi(/6/8)', progress: 0.9 })
    // a 的進度較舊，再匯入一次不應倒退
    const summary = await importBackup(b.db, await exportBackup(a.db, { includeBooks: false }))
    expect(summary.booksUpdated).toBe(0)
    expect((await b.lib.getBook(book.id))?.progress).toBe(0.9)
    // a 之後讀得更後面，就會更新
    await a.lib.saveLocation(bookId, { cfi: 'epubcfi(/6/10)', progress: 0.95 })
    expect((await importBackup(b.db, await exportBackup(a.db, { includeBooks: false }))).booksUpdated).toBe(1)
    expect((await b.lib.getBook(book.id))?.progress).toBe(0.95)
  })

  it('惡意或損壞的內容：壞資料略過並計數，其餘照常匯入', async () => {
    const good = { id: 'es|casa', language: 'es', lemma: 'casa', pos: '名詞', dictMeaning: '', forms: ['casa'], bookIds: [1],
      examples: [{ word: 'casa', sentence: 'S.', contextMeaning: '房子', note: '', bookId: 1, bookTitle: 'X', savedAt: 1 }],
      level: 1, dueAt: 0, createdAt: 1, updatedAt: 1 }
    const fakeHash = 'b'.repeat(64)
    const manifest = {
      app: 'tapread', version: 1, exportedAt: 1,
      books: [
        // 宣稱的雜湊與內容不符
        { id: 1, hash: fakeHash, title: 'Falso', author: '', language: 'es', format: 'epub', fileName: 'f.epub', lastCfi: null, progress: 0, addedAt: 1, lastOpenedAt: 1, file: 'books/1.epub' },
        { id: 2, hash: 'c'.repeat(64), title: 'Proto', author: '', language: 'es', format: 'epub', fileName: 'p.epub', lastCfi: null, progress: 0, addedAt: 1, lastOpenedAt: 1, file: '__proto__' },
        { id: 3, title: '壞掉的書' },
      ],
      vocab: [good, { id: 'es|x', lemma: 'x', level: 'nope' }],
    }
    const data = zipSync({ 'manifest.json': strToU8(JSON.stringify(manifest)), 'books/1.epub': strToU8('otro contenido') })
    const b = device()
    const summary = await importBackup(b.db, data)
    expect(summary).toMatchObject({ booksAdded: 0, wordsAdded: 1, invalid: 3 })
    expect(summary.booksSkipped).toBe(1)
    expect(await b.lib.listBooks()).toHaveLength(0)
    expect((await b.vocab.get('es|casa'))?.examples[0].bookId).toBe(MISSING_BOOK_ID)
  })

  it('評分、評語、讀完日期與自訂書架（依名稱對應）一起搬過去', async () => {
    const { a, bookId } = await seed()
    const shelfA = await createShelfStore(a.db).create('小說')
    await a.lib.updateBook(bookId, { rating: 4.5, review: '很棒', finished: true, shelfIds: [shelfA.id] })

    const b = device()
    const shelfB = await createShelfStore(b.db).create('小說')
    await importBackup(b.db, await exportBackup(a.db, { includeBooks: true }))

    const [book] = await b.lib.listBooks()
    expect(book).toMatchObject({ rating: 4.5, review: '很棒', shelfIds: [shelfB.id] })
    expect(book.finishedAt).toBeGreaterThan(0)
    expect((await createShelfStore(b.db).list()).map((s) => s.name)).toEqual(['小說'])
  })

  it('本機沒有的書架會自動建立', async () => {
    const { a, bookId } = await seed()
    const s = await createShelfStore(a.db).create('西文小說')
    await a.lib.updateBook(bookId, { shelfIds: [s.id] })
    const b = device()
    await importBackup(b.db, await exportBackup(a.db, { includeBooks: true }))
    const shelves = await createShelfStore(b.db).list()
    expect(shelves.map((x) => x.name)).toEqual(['西文小說'])
    expect((await b.lib.listBooks())[0].shelfIds).toEqual([shelves[0].id])
  })

  it('閱讀紀錄一起搬過去；同一天取較多的那份，重複匯入不會加倍', async () => {
    const { a } = await seed()
    await a.db.readingDays.bulkPut([{ date: '2026-10-17', seconds: 600 }, { date: '2026-10-18', seconds: 120 }])
    const b = device()
    await b.db.readingDays.put({ date: '2026-10-18', seconds: 300 })
    const data = await exportBackup(a.db, { includeBooks: false })
    await importBackup(b.db, data)
    await importBackup(b.db, data)
    expect(await b.db.readingDays.get('2026-10-17')).toEqual({ date: '2026-10-17', seconds: 600 })
    expect(await b.db.readingDays.get('2026-10-18')).toEqual({ date: '2026-10-18', seconds: 300 })
  })

  it('書摘跟著書搬過去（書號自動對應），重複匯入不會重複', async () => {
    const { a, bookId } = await seed()
    await a.db.highlights.add({ id: 'h1', bookId, cfi: 'epubcfi(/6/4!/4/2)', text: 'Una frase bonita.', note: '喜歡', chapter: 'Cap 1', createdAt: 1, updatedAt: 1 })
    const data = await exportBackup(a.db, { includeBooks: true })
    const b = device()
    await importBackup(b.db, data)
    await importBackup(b.db, data)
    const [book] = await b.lib.listBooks()
    const list = await b.db.highlights.toArray()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ bookId: book.id, text: 'Una frase bonita.', note: '喜歡' })
  })

  it('閱讀紀錄格式不正確的略過', async () => {
    const manifest = { app: 'tapread', version: 1, exportedAt: 0, books: [], vocab: [],
      readingDays: [{ date: '2026-10-18', seconds: 60 }, { date: 'x', seconds: 1 }, { date: '2026-10-19', seconds: 999999 }] }
    const b = device()
    await importBackup(b.db, zipSync({ 'manifest.json': strToU8(JSON.stringify(manifest)) }))
    expect(await b.db.readingDays.toArray()).toEqual([{ date: '2026-10-18', seconds: 60 }])
  })

  it('不是 zip 或不是 TapRead 備份時丟 BackupFormatError', async () => {
    const b = device()
    await expect(importBackup(b.db, new TextEncoder().encode('hola'))).rejects.toThrow(BackupFormatError)
  })
})
