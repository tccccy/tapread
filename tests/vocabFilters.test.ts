import { describe, expect, it } from 'vitest'
import {
  applyFilters, facetCounts, activeFilterCount, posGroup, levelBucket, isPolysemous, cefrOf, EMPTY_FILTERS,
  type VocabFilters,
} from '../src/lib/vocab/filters'
import type { VocabEntry, VocabExample } from '../src/lib/vocab/model'

const NOW = new Date(2026, 9, 17, 15, 0).getTime() // 本地時間 10/17 15:00
const DAY = 86_400_000
const ex = (over: Partial<VocabExample> = {}): VocabExample => ({
  word: 'w', sentence: 's', contextMeaning: '意思', note: '', bookId: 1, bookTitle: 'A', savedAt: NOW, ...over,
})
const entry = (lemma: string, over: Partial<VocabEntry> = {}): VocabEntry => ({
  id: `en|${lemma}`, language: 'en', lemma, pos: '名詞', dictMeaning: '', forms: [lemma], bookIds: [1],
  examples: [ex()], level: 1, dueAt: 0, createdAt: NOW, updatedAt: NOW, ...over,
})
const f = (over: Partial<VocabFilters>): VocabFilters => ({ ...EMPTY_FILTERS, ...over })
const lemmas = (xs: VocabEntry[]) => xs.map((e) => e.lemma).sort()

const entries = [
  entry('investigative', { pos: '形容詞', cefr: 'C1', level: 1 }),
  entry('noncommittal', { pos: '形容詞', cefr: 'C2', level: 3, bookIds: [2], examples: [ex({ bookId: 2, savedAt: NOW - 3 * DAY })] }),
  entry('run', { pos: '動詞（過去式）', cefr: 'A1', level: 5, examples: [ex({ contextMeaning: '跑' }), ex({ sentence: 's2', contextMeaning: '經營', savedAt: NOW - 40 * DAY })] }),
  entry('give up', { pos: '片語動詞', level: 2, examples: [ex({ savedAt: NOW - 20 * DAY })] }),
]

describe('分類輔助', () => {
  it('詞性歸類（AI 寫法不一，片語優先判斷）', () => {
    expect(posGroup('名詞')).toBe('noun')
    expect(posGroup('動詞（過去式）')).toBe('verb')
    expect(posGroup('片語動詞')).toBe('phrase')
    expect(posGroup('慣用語')).toBe('phrase')
    expect(posGroup('形容詞')).toBe('adj')
    expect(posGroup('副詞')).toBe('adv')
    expect(posGroup('介系詞')).toBe('other')
    expect(posGroup('')).toBe('other')
  })

  it('熟練度分組', () => {
    expect([1, 2, 4, 5].map(levelBucket)).toEqual(['new', 'learning', 'learning', 'known'])
  })

  it('一字多義：不同的當句意思 ≥ 2', () => {
    expect(isPolysemous(entries[2])).toBe(true)
    expect(isPolysemous(entry('x', { examples: [ex(), ex({ sentence: 'b' })] }))).toBe(false)
  })

  it('難度：沒有或不合法時為 unknown', () => {
    expect(cefrOf(entries[0])).toBe('C1')
    expect(cefrOf(entries[3])).toBe('unknown')
    expect(cefrOf(entry('x', { cefr: 'Z9' }))).toBe('unknown')
  })
})

describe('applyFilters', () => {
  it('沒有篩選時全部保留', () => {
    expect(applyFilters(entries, EMPTY_FILTERS, NOW)).toHaveLength(4)
  })

  it('同一類可複選（或），不同類同時成立（且）', () => {
    expect(lemmas(applyFilters(entries, f({ levels: ['new', 'learning'] }), NOW))).toEqual(['give up', 'investigative', 'noncommittal'])
    expect(lemmas(applyFilters(entries, f({ levels: ['new', 'learning'], pos: ['adj'] }), NOW))).toEqual(['investigative', 'noncommittal'])
  })

  it('難度與書', () => {
    expect(lemmas(applyFilters(entries, f({ cefr: ['C1', 'C2'] }), NOW))).toEqual(['investigative', 'noncommittal'])
    expect(lemmas(applyFilters(entries, f({ cefr: ['unknown'] }), NOW))).toEqual(['give up'])
    expect(lemmas(applyFilters(entries, f({ bookIds: [2] }), NOW))).toEqual(['noncommittal'])
  })

  it('收藏時間：以最近一次收藏例句的時間為準', () => {
    expect(lemmas(applyFilters(entries, f({ saved: 'today' }), NOW))).toEqual(['investigative', 'run'])
    expect(lemmas(applyFilters(entries, f({ saved: '7d' }), NOW))).toEqual(['investigative', 'noncommittal', 'run'])
    expect(lemmas(applyFilters(entries, f({ saved: '30d' }), NOW))).toEqual(['give up', 'investigative', 'noncommittal', 'run'])
  })

  it('「今天」以本地午夜為界', () => {
    const lastNight = entry('late', { examples: [ex({ savedAt: new Date(2026, 9, 16, 23, 59).getTime() })] })
    expect(applyFilters([lastNight], f({ saved: 'today' }), NOW)).toHaveLength(0)
  })

  it('一字多義', () => {
    expect(lemmas(applyFilters(entries, f({ polysemous: true }), NOW))).toEqual(['run'])
  })
})

describe('facetCounts', () => {
  it('每個選項的字數，套用「其他類」的篩選但不套用自己這類', () => {
    const c = facetCounts(entries, f({ pos: ['adj'], levels: ['new'] }), NOW)
    // 詞性的計數不受詞性篩選影響，但受熟練度＝新字影響
    expect(c.pos).toMatchObject({ adj: 1, verb: 0, phrase: 0 })
    // 熟練度的計數受詞性＝形容詞影響
    expect(c.levels).toEqual({ new: 1, learning: 1, known: 0 })
    expect(c.books.get(2)).toBe(0)
  })
})

describe('activeFilterCount', () => {
  it('計算啟用中的篩選數', () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0)
    expect(activeFilterCount(f({ levels: ['new'], cefr: ['C1', 'C2'], saved: '7d', polysemous: true }))).toBe(4)
  })
})
