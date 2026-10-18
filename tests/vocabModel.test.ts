import { describe, expect, it } from 'vitest'
import { addExample, removeExample, applyReview, isDue, formLevelMap, vocabId, MAX_LEVEL, type SaveInput } from '../src/lib/vocab/model'

const NOW = Date.UTC(2026, 9, 17, 6, 0)
const DAY = 86_400_000

const input = (over: Partial<SaveInput> = {}): SaveInput => ({
  language: 'es',
  word: 'Banco',
  sentence: 'Miró el banco del parque.',
  definition: { lemma: 'banco', pos: '名詞', contextMeaning: '長椅', dictMeaning: '長椅；銀行', note: '' },
  bookId: 1,
  bookTitle: 'La carta',
  ...over,
})

describe('vocabId', () => {
  it('以語言 + 原形（小寫）為 id', () => {
    expect(vocabId('es', 'Banco')).toBe('es|banco')
  })
})

describe('addExample', () => {
  it('新字：熟練度 1、立刻到期、記下字形與書', () => {
    const e = addExample(undefined, input(), NOW)
    expect(e).toMatchObject({ id: 'es|banco', language: 'es', lemma: 'banco', pos: '名詞', dictMeaning: '長椅；銀行', level: 1, dueAt: NOW, forms: ['banco'], bookIds: [1] })
    expect(e.examples).toHaveLength(1)
    expect(e.examples[0]).toMatchObject({ word: 'Banco', sentence: 'Miró el banco del parque.', contextMeaning: '長椅', bookId: 1 })
  })

  it('同原形不同句子：合併例句與字形，保留熟練度，不修改原物件', () => {
    const first = applyReview(addExample(undefined, input(), NOW), 'good', NOW)
    const frozen = structuredClone(first)
    const merged = addExample(first, input({
      word: 'bancos', sentence: 'Fue a dos bancos.', bookId: 2, bookTitle: 'Otro',
      definition: { lemma: 'banco', pos: '名詞', contextMeaning: '銀行', dictMeaning: '長椅；銀行', note: '' },
    }), NOW + 1)
    expect(first).toEqual(frozen)
    expect(merged.examples.map((x) => x.contextMeaning)).toEqual(['長椅', '銀行'])
    expect(merged.forms).toEqual(['banco', 'bancos'])
    expect(merged.bookIds).toEqual([1, 2])
    expect(merged.level).toBe(first.level)
  })

  it('記下例句在書中的位置（CFI），供「回到書中」使用', () => {
    const e = addExample(undefined, input({ cfi: 'epubcfi(/6/4!/4/2,/1:10,/1:15)' }), NOW)
    expect(e.examples[0].cfi).toBe('epubcfi(/6/4!/4/2,/1:10,/1:15)')
  })

  it('沒有位置時不存 cfi 欄位', () => {
    expect(addExample(undefined, input(), NOW).examples[0]).not.toHaveProperty('cfi')
  })

  it('同字同句重複收藏不會產生重複例句', () => {
    const e = addExample(addExample(undefined, input(), NOW), input(), NOW)
    expect(e.examples).toHaveLength(1)
  })
})

describe('addExample 對已熟的字', () => {
  it('已熟的字又收藏了新例句：代表其實不熟，回到熟練度 1 並立刻到期', () => {
    const known = applyReview(addExample(undefined, input(), NOW), 'known', NOW)
    const again = addExample(known, input({ sentence: 'Otra frase con banco.' }), NOW + 5)
    expect(again.level).toBe(1)
    expect(again.dueAt).toBe(NOW + 5)
  })

  it('重複收藏同一句不影響熟練度', () => {
    const known = applyReview(addExample(undefined, input(), NOW), 'known', NOW)
    expect(addExample(known, input(), NOW + 5).level).toBe(MAX_LEVEL)
  })
})

describe('removeExample', () => {
  it('移除其中一個例句，並重算字形與書', () => {
    const e = addExample(addExample(undefined, input(), NOW), input({ word: 'bancos', sentence: 'Dos bancos.', bookId: 2 }), NOW)
    const after = removeExample(e, 'Banco', 'Miró el banco del parque.')
    expect(after?.examples).toHaveLength(1)
    expect(after?.forms).toEqual(['bancos'])
    expect(after?.bookIds).toEqual([2])
  })

  it('移除最後一個例句時回傳 null（整個字刪除）', () => {
    expect(removeExample(addExample(undefined, input(), NOW), 'Banco', 'Miró el banco del parque.')).toBeNull()
  })
})

describe('applyReview', () => {
  const fresh = () => addExample(undefined, input(), NOW)

  it('記得：熟練度 +1，間隔隨熟練度拉長', () => {
    const l2 = applyReview(fresh(), 'good', NOW)
    expect(l2.level).toBe(2)
    expect(l2.dueAt).toBe(NOW + 1 * DAY)
    const l3 = applyReview(l2, 'good', NOW)
    expect(l3.level).toBe(3)
    expect(l3.dueAt).toBe(NOW + 3 * DAY)
    const l4 = applyReview(l3, 'good', NOW)
    expect(l4.dueAt).toBe(NOW + 7 * DAY)
  })

  it('不記得：回到熟練度 1，10 分鐘後再出現', () => {
    const e = applyReview(applyReview(fresh(), 'good', NOW), 'again', NOW)
    expect(e.level).toBe(1)
    expect(e.dueAt).toBe(NOW + 10 * 60_000)
  })

  it('已熟：直接到最高級，不再到期', () => {
    const e = applyReview(fresh(), 'known', NOW)
    expect(e.level).toBe(MAX_LEVEL)
    expect(isDue(e, NOW + 3650 * DAY)).toBe(false)
  })

  it('連續記得到第 5 級即為已熟', () => {
    let e = fresh()
    for (let i = 0; i < 10; i++) e = applyReview(e, 'good', NOW)
    expect(e.level).toBe(MAX_LEVEL)
  })
})

describe('isDue', () => {
  it('到期時間已過才算到期', () => {
    const e = addExample(undefined, input(), NOW)
    expect(isDue(e, NOW)).toBe(true)
    expect(isDue(applyReview(e, 'good', NOW), NOW + 1000)).toBe(false)
  })
})

describe('formLevelMap', () => {
  it('字形 → 熟練度；已熟的字不上色', () => {
    const a = addExample(undefined, input(), NOW)
    const b = applyReview(addExample(undefined, input({ word: 'abrió', sentence: 'Abrió.', definition: { lemma: 'abrir', pos: '', contextMeaning: '打開', dictMeaning: '', note: '' } }), NOW), 'known', NOW)
    const map = formLevelMap([a, b])
    expect(map.get('banco')).toBe(1)
    expect(map.has('abrió')).toBe(false)
  })
})
