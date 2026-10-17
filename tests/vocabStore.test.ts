import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDb } from '../src/lib/db'
import { createVocabStore, type VocabStore } from '../src/lib/vocab/store'
import type { SaveInput } from '../src/lib/vocab/model'

const NOW = Date.UTC(2026, 9, 17, 6, 0)
const DAY = 86_400_000
const def = (lemma: string, meaning: string) => ({ lemma, pos: '', contextMeaning: meaning, dictMeaning: '', note: '' })
const input = (over: Partial<SaveInput>): SaveInput => ({
  language: 'es', word: 'banco', sentence: 'S1.', definition: def('banco', '長椅'), bookId: 1, bookTitle: 'A', ...over,
})

let store: VocabStore
let n = 0
beforeEach(() => {
  store = createVocabStore(createDb(`vocab-test-${++n}`))
})

describe('vocab store', () => {
  it('收藏後可依 id 取回；相同原形合併', async () => {
    await store.save(input({}), NOW)
    await store.save(input({ word: 'bancos', sentence: 'S2.', definition: def('banco', '銀行') }), NOW)
    const e = await store.get('es|banco')
    expect(e?.examples).toHaveLength(2)
  })

  it('findSaved 依語言＋字形＋句子找已收藏的例句', async () => {
    await store.save(input({}), NOW)
    expect((await store.findSaved('es', 'Banco', 'S1.'))?.id).toBe('es|banco')
    expect(await store.findSaved('es', 'banco', 'S2.')).toBeUndefined()
    expect(await store.findSaved('pt', 'banco', 'S1.')).toBeUndefined()
  })

  it('AI 這次回傳的原形不同時，仍找得到原本收藏的那筆', async () => {
    await store.save(input({ word: 'abrió', sentence: 'Abrió la puerta.', definition: def('abrir', '打開') }), NOW)
    // 同字同句，查到時 AI 回了不同的 lemma；以字形查仍能命中
    expect((await store.findSaved('es', 'abrió', 'Abrió la puerta.'))?.lemma).toBe('abrir')
  })

  it('unsave 移除例句；最後一個例句移除時整個字刪除', async () => {
    await store.save(input({}), NOW)
    await store.unsave('es|banco', 'banco', 'S1.')
    expect(await store.get('es|banco')).toBeUndefined()
  })

  it('languages 回傳各語言字數', async () => {
    await store.save(input({}), NOW)
    await store.save(input({ word: 'casa', definition: def('casa', '房子') }), NOW)
    await store.save(input({ language: 'pt', word: 'casa', definition: def('casa', '房子') }), NOW)
    expect(await store.languages()).toEqual([{ language: 'es', count: 2 }, { language: 'pt', count: 1 }])
  })

  it('list 依語言與書篩選，最新收藏在前', async () => {
    await store.save(input({ word: 'a', definition: def('a', 'x'), bookId: 1 }), NOW)
    await store.save(input({ word: 'b', definition: def('b', 'x'), bookId: 2 }), NOW + 1)
    await store.save(input({ word: 'c', definition: def('c', 'x'), bookId: 1, language: 'it' }), NOW + 2)
    expect((await store.list('es')).map((e) => e.lemma)).toEqual(['b', 'a'])
    expect((await store.list('es', 1)).map((e) => e.lemma)).toEqual(['a'])
  })

  it('dueCards 只回傳到期的字', async () => {
    await store.save(input({ word: 'a', definition: def('a', 'x') }), NOW)
    await store.save(input({ word: 'b', definition: def('b', 'x') }), NOW)
    await store.review('es|a', 'good', NOW)
    expect((await store.dueCards('es', undefined, NOW + 1000)).map((e) => e.lemma)).toEqual(['b'])
    expect((await store.dueCards('es', undefined, NOW + 2 * DAY)).map((e) => e.lemma).sort()).toEqual(['a', 'b'])
  })

  it('review 更新熟練度並回傳新狀態', async () => {
    await store.save(input({}), NOW)
    const e = await store.review('es|banco', 'known', NOW)
    expect(e.level).toBe(5)
    expect((await store.get('es|banco'))?.level).toBe(5)
  })

  it('formLevels 給書中上色用', async () => {
    await store.save(input({ word: 'Bancos', definition: def('banco', 'x') }), NOW)
    expect((await store.formLevels('es')).get('bancos')).toBe(1)
  })

  it('remove 刪除整個字', async () => {
    await store.save(input({}), NOW)
    await store.remove('es|banco')
    expect(await store.get('es|banco')).toBeUndefined()
  })

  it('moveBookLanguage：把某本書在舊語言下收藏的例句搬到新語言，並與既有的字合併', async () => {
    await store.save(input({ language: '', bookId: 7, word: 'banco', sentence: 'P1.', definition: def('banco', '長椅') }), NOW)
    await store.save(input({ language: '', bookId: 8, word: 'banco', sentence: 'Otro.', definition: def('banco', '銀行') }), NOW)
    await store.save(input({ language: 'es', bookId: 1, word: 'banco', sentence: 'S1.', definition: def('banco', '銀行') }), NOW)

    await store.moveBookLanguage(7, '', 'es')

    const es = await store.get('es|banco')
    expect(es?.examples.map((x) => x.sentence).sort()).toEqual(['P1.', 'S1.'])
    // 其他書在舊語言下的例句保留
    expect((await store.get('|banco'))?.examples.map((x) => x.sentence)).toEqual(['Otro.'])
  })

  it('moveBookLanguage：舊語言下的字全部搬走後刪除', async () => {
    await store.save(input({ language: '', bookId: 7, word: 'casa', sentence: 'P.', definition: def('casa', '房子') }), NOW)
    await store.moveBookLanguage(7, '', 'pt')
    expect(await store.get('|casa')).toBeUndefined()
    expect((await store.get('pt|casa'))?.examples[0].contextMeaning).toBe('房子')
  })
})
