import { describe, expect, it } from 'vitest'
import { queryVocab, splitAround } from '../src/lib/vocab/list'
import type { VocabEntry } from '../src/lib/vocab/model'

const entry = (lemma: string, over: Partial<VocabEntry> = {}): VocabEntry => ({
  id: `es|${lemma}`, language: 'es', lemma, pos: '', dictMeaning: '', forms: [lemma], bookIds: [1],
  examples: [{ word: lemma, sentence: `Frase con ${lemma}.`, contextMeaning: `${lemma}的意思`, note: '', bookId: 1, bookTitle: 'A', savedAt: 0 }],
  level: 1, dueAt: 0, createdAt: 0, updatedAt: 0, ...over,
})

const entries = [
  entry('banco', { createdAt: 3, level: 2, examples: [{ word: 'bancos', sentence: 'Dos bancos.', contextMeaning: '銀行', note: '', bookId: 1, bookTitle: 'A', savedAt: 3 }], forms: ['bancos'] }),
  entry('abrir', { createdAt: 1, level: 5 }),
  entry('casa', { createdAt: 2, level: 1, bookIds: [2] }),
]
const lemmas = (xs: VocabEntry[]) => xs.map((e) => e.lemma)

describe('queryVocab', () => {
  it('預設依最新收藏排序', () => {
    expect(lemmas(queryVocab(entries, { query: '', sort: 'recent' }))).toEqual(['banco', 'casa', 'abrir'])
  })

  it('依字母排序（照該語言規則，不分大小寫與重音）', () => {
    const xs = [entry('Zorro'), entry('árbol'), entry('casa')]
    expect(lemmas(queryVocab(xs, { query: '', sort: 'alpha', locale: 'es' }))).toEqual(['árbol', 'casa', 'Zorro'])
  })

  it('依熟練度排序：最不熟的在前，同級再依最新', () => {
    expect(lemmas(queryVocab(entries, { query: '', sort: 'level' }))).toEqual(['casa', 'banco', 'abrir'])
  })

  it('搜尋原形、字形、中文意思、例句，不分大小寫', () => {
    expect(lemmas(queryVocab(entries, { query: 'BANCOS', sort: 'recent' }))).toEqual(['banco'])
    expect(lemmas(queryVocab(entries, { query: '銀行', sort: 'recent' }))).toEqual(['banco'])
    expect(lemmas(queryVocab(entries, { query: 'frase con casa', sort: 'recent' }))).toEqual(['casa'])
  })

  it('依書篩選', () => {
    expect(lemmas(queryVocab(entries, { query: '', sort: 'recent', bookId: 2 }))).toEqual(['casa'])
  })

  it('不修改傳入的陣列', () => {
    const copy = [...entries]
    queryVocab(entries, { query: '', sort: 'alpha' })
    expect(entries).toEqual(copy)
  })
})

describe('splitAround', () => {
  it('把目標字切出來（不分大小寫）', () => {
    expect(splitAround('Fue al Banco ayer.', 'banco')).toEqual(['Fue al ', 'Banco', ' ayer.'])
  })

  it('優先找完整單字，不切到其他字的一部分', () => {
    expect(splitAround('Un bancoso banco.', 'banco')).toEqual(['Un bancoso ', 'banco', '.'])
  })

  it('找不到時整句放在前段', () => {
    expect(splitAround('Nada aquí.', 'banco')).toEqual(['Nada aquí.', '', ''])
  })
})
