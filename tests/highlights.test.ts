import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { createDb } from '../src/lib/db'
import { createHighlightStore, MAX_HIGHLIGHT_CHARS } from '../src/lib/books/highlights'
import { createLibrary } from '../src/lib/library'

let n = 0
const setup = () => {
  const db = createDb(`highlights-${++n}`)
  return { db, store: createHighlightStore(db), lib: createLibrary(db) }
}

describe('highlights', () => {
  it('新增後依書列出（新的在前）', async () => {
    const { store } = setup()
    await store.add({ bookId: 1, cfi: 'epubcfi(/6/2!/4/2,/1:0,/1:5)', text: 'Hola mundo', chapter: 'Capítulo 1' })
    await store.add({ bookId: 1, cfi: 'epubcfi(/6/4!/4/2,/1:0,/1:5)', text: 'Segunda', chapter: '' })
    await store.add({ bookId: 2, cfi: 'epubcfi(/6/2)', text: 'Otro libro', chapter: '' })
    const list = await store.listByBook(1)
    expect(list.map((h) => h.text)).toEqual(['Segunda', 'Hola mundo'])
  })

  it('同一個位置不重複劃線', async () => {
    const { store } = setup()
    const a = await store.add({ bookId: 1, cfi: 'x', text: 'Hola', chapter: '' })
    const b = await store.add({ bookId: 1, cfi: 'x', text: 'Hola', chapter: '' })
    expect(b.id).toBe(a.id)
    expect(await store.listByBook(1)).toHaveLength(1)
  })

  it('整理文字空白、限制長度', async () => {
    const { store } = setup()
    const h = await store.add({ bookId: 1, cfi: 'y', text: `  a\\n  b ${'x'.repeat(MAX_HIGHLIGHT_CHARS)}`, chapter: '' })
    expect(h.text.startsWith('a\\n b')).toBe(true)
    expect(h.text.length).toBeLessThanOrEqual(MAX_HIGHLIGHT_CHARS)
  })

  it('修改註記、刪除', async () => {
    const { store } = setup()
    const h = await store.add({ bookId: 1, cfi: 'z', text: 'Hola', chapter: '' })
    await store.setNote(h.id, '  很美的一句  ')
    expect((await store.listByBook(1))[0].note).toBe('很美的一句')
    await store.remove(h.id)
    expect(await store.listByBook(1)).toEqual([])
  })

  it('刪除書時一起刪掉它的劃線', async () => {
    const { store, lib } = setup()
    const bookId = await lib.addBook({ title: 'T', author: '', language: 'es', format: 'txt', file: new File(['hola'], 't.txt') })
    await store.add({ bookId, cfi: 'z', text: 'Hola', chapter: '' })
    await lib.deleteBook(bookId)
    expect(await store.listByBook(bookId)).toEqual([])
  })
})
