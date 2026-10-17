import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createLibrary, type Library } from '../src/lib/library'

const epub = (text = 'x') => new File([text], 'book.epub', { type: 'application/epub+zip' })

let lib: Library
let dbCounter = 0

beforeEach(() => {
  dbCounter += 1
  lib = createLibrary(`test-library-${dbCounter}`)
})

describe('library', () => {
  it('新增書後可在列表看到，列表不含檔案本體', async () => {
    const id = await lib.addBook({ title: 'Cien años', author: 'GGM', language: 'es', file: epub() })
    const list = await lib.listBooks()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ id, title: 'Cien años', author: 'GGM', language: 'es', progress: 0 })
    expect(list[0]).not.toHaveProperty('file')
  })

  it('getBook 取回檔案本體', async () => {
    const id = await lib.addBook({ title: 'T', author: '', language: 'en', file: epub('hello') })
    const book = await lib.getBook(id)
    expect(book?.file.size).toBe(5)
  })

  it('getBook 找不到時回傳 undefined', async () => {
    expect(await lib.getBook(999)).toBeUndefined()
  })

  it('saveLocation 更新閱讀位置與進度', async () => {
    const id = await lib.addBook({ title: 'T', author: '', language: 'en', file: epub() })
    await lib.saveLocation(id, { cfi: 'epubcfi(/6/4!/4/2)', progress: 0.42 })
    const book = await lib.getBook(id)
    expect(book).toMatchObject({ lastCfi: 'epubcfi(/6/4!/4/2)', progress: 0.42 })
  })

  it('saveLocation 拒絕超出 0–1 的進度', async () => {
    const id = await lib.addBook({ title: 'T', author: '', language: 'en', file: epub() })
    await expect(lib.saveLocation(id, { cfi: 'x', progress: 1.5 })).rejects.toThrow()
  })

  it('列表依最近開啟時間排序，最新的在前', async () => {
    const a = await lib.addBook({ title: 'A', author: '', language: 'en', file: epub() })
    const b = await lib.addBook({ title: 'B', author: '', language: 'en', file: epub() })
    await lib.saveLocation(a, { cfi: 'x', progress: 0.1 })
    const list = await lib.listBooks()
    expect(list.map((x) => x.id)).toEqual([a, b])
  })

  it('書本檔案與書目分表存放，列表不需讀取檔案', async () => {
    const id = await lib.addBook({ title: 'T', author: '', language: 'en', file: epub() })
    const tables = await lib.debugTableCounts()
    expect(tables).toEqual({ books: 1, files: 1 })
    await lib.deleteBook(id)
    expect(await lib.debugTableCounts()).toEqual({ books: 0, files: 0 })
  })

  it('deleteBook 移除書', async () => {
    const id = await lib.addBook({ title: 'T', author: '', language: 'en', file: epub() })
    await lib.deleteBook(id)
    expect(await lib.listBooks()).toEqual([])
  })
})

describe('setLanguage', () => {
  it('更新書的語言', async () => {
    const id = await lib.addBook({ title: 'T', author: '', language: '', file: epub() })
    await lib.setLanguage(id, 'es')
    expect((await lib.getBook(id))?.language).toBe('es')
  })
})
