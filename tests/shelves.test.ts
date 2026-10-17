import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDb } from '../src/lib/db'
import { createLibrary, type Library } from '../src/lib/library'
import { createShelfStore, ShelfNameError, type ShelfStore } from '../src/lib/books/shelves'

let n = 0
let shelves: ShelfStore
let lib: Library
beforeEach(() => {
  const db = createDb(`shelves-test-${++n}`)
  shelves = createShelfStore(db)
  lib = createLibrary(db)
})
const epub = () => new File(['x'], 'b.epub')

describe('自訂書架', () => {
  it('建立、依順序列出、改名', async () => {
    const a = await shelves.create('小說')
    await shelves.create(' 工作 ')
    expect((await shelves.list()).map((s) => s.name)).toEqual(['小說', '工作'])
    await shelves.rename(a.id, '長篇小說')
    expect((await shelves.list())[0].name).toBe('長篇小說')
  })

  it('名稱不可空白、不可重複（不分大小寫）', async () => {
    await shelves.create('Novels')
    await expect(shelves.create('  ')).rejects.toThrow(ShelfNameError)
    await expect(shelves.create('novels')).rejects.toThrow(ShelfNameError)
  })

  it('刪除書架時，書不會被刪，只是從那個書架移出', async () => {
    const s = await shelves.create('小說')
    const id = await lib.addBook({ title: 'T', author: '', language: 'en', file: epub() })
    await lib.updateBook(id, { shelfIds: [s.id] })
    await shelves.remove(s.id)
    expect(await shelves.list()).toEqual([])
    expect((await lib.getBook(id))?.shelfIds).toEqual([])
  })
})

describe('書的評分、評語、狀態', () => {
  it('updateBook 驗證並儲存評分（半顆星）與評語', async () => {
    const id = await lib.addBook({ title: 'T', author: '', language: 'en', file: epub() })
    await lib.updateBook(id, { rating: 4.3, review: '  很好看  ' })
    expect(await lib.getBook(id)).toMatchObject({ rating: 4.5, review: '很好看' })
    await lib.updateBook(id, { rating: null })
    expect((await lib.getBook(id))?.rating).toBeUndefined()
  })

  it('評語有長度上限', async () => {
    const id = await lib.addBook({ title: 'T', author: '', language: 'en', file: epub() })
    await lib.updateBook(id, { review: 'x'.repeat(20000) })
    expect((await lib.getBook(id))?.review?.length).toBe(5000)
  })

  it('第一次閱讀記下開始日期；讀到底自動記下讀完日期', async () => {
    const id = await lib.addBook({ title: 'T', author: '', language: 'en', file: epub() })
    await lib.saveLocation(id, { cfi: 'a', progress: 0.1 })
    const started = (await lib.getBook(id))?.startedAt
    expect(started).toBeGreaterThan(0)
    await lib.saveLocation(id, { cfi: 'b', progress: 0.5 })
    expect((await lib.getBook(id))?.startedAt).toBe(started)
    expect((await lib.getBook(id))?.finishedAt).toBeUndefined()
    await lib.saveLocation(id, { cfi: 'c', progress: 1 })
    expect((await lib.getBook(id))?.finishedAt).toBeGreaterThan(0)
  })

  it('手動標為讀完／取消讀完', async () => {
    const id = await lib.addBook({ title: 'T', author: '', language: 'en', file: epub() })
    await lib.updateBook(id, { finished: true })
    expect((await lib.getBook(id))?.finishedAt).toBeGreaterThan(0)
    await lib.updateBook(id, { finished: false })
    expect((await lib.getBook(id))?.finishedAt).toBeUndefined()
  })

  it('封面另存，刪書時一起刪除', async () => {
    const id = await lib.addBook({ title: 'T', author: '', language: 'en', file: epub() })
    await lib.setCover(id, new Blob(['img'], { type: 'image/jpeg' }))
    expect((await lib.getCover(id))?.size).toBe(3)
    await lib.deleteBook(id)
    expect(await lib.getCover(id)).toBeUndefined()
  })
})
