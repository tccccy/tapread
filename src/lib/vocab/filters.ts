// 單字本篩選：同一類可複選（或），不同類同時成立（且）；全部為純函式
import { MAX_LEVEL, type VocabEntry } from './model'

export type LevelBucket = 'new' | 'learning' | 'known'
export type PosGroup = 'noun' | 'verb' | 'adj' | 'adv' | 'phrase' | 'other'
export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'unknown'
export type SavedWithin = 'all' | 'today' | '7d' | '30d'

export interface VocabFilters {
  levels: LevelBucket[]
  pos: PosGroup[]
  cefr: CefrLevel[]
  bookIds: number[]
  saved: SavedWithin
  polysemous: boolean
}

// 凍結：多處共用這個預設值，避免被意外修改
export const EMPTY_FILTERS: VocabFilters = Object.freeze({
  levels: [], pos: [], cefr: [], bookIds: [], saved: 'all', polysemous: false,
}) as VocabFilters

export const LEVEL_BUCKETS: LevelBucket[] = ['new', 'learning', 'known']
export const POS_GROUPS: PosGroup[] = ['noun', 'verb', 'adj', 'adv', 'phrase', 'other']
export const CEFR_LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'unknown']

export const levelBucket = (level: number): LevelBucket =>
  level >= MAX_LEVEL ? 'known' : level <= 1 ? 'new' : 'learning'

// AI 回傳的詞性是自由文字（如「動詞（過去式）」「片語動詞」），歸成幾個大類；片語要先判斷
const POS_RULES: [PosGroup, RegExp][] = [
  ['phrase', /片語|慣用|成語|詞組|俚語/],
  ['verb', /動詞/],
  ['noun', /名詞/],
  ['adj', /形容詞/],
  ['adv', /副詞/],
]
export const posGroup = (pos: string): PosGroup => POS_RULES.find(([, re]) => re.test(pos))?.[0] ?? 'other'

const VALID_CEFR = new Set<string>(CEFR_LEVELS.filter((l) => l !== 'unknown'))
export const cefrOf = (e: VocabEntry): CefrLevel => (e.cefr && VALID_CEFR.has(e.cefr) ? (e.cefr as CefrLevel) : 'unknown')

export const isPolysemous = (e: VocabEntry) =>
  new Set(e.examples.map((x) => x.contextMeaning.trim())).size >= 2

// 以最近一次收藏例句的時間為準（同一個字在新章節又收藏，算作最近收藏）
const lastSavedAt = (e: VocabEntry) =>
  e.examples.length > 0 ? Math.max(...e.examples.map((x) => x.savedAt)) : e.createdAt

const savedSince = (saved: SavedWithin, now: number): number => {
  if (saved === 'all') return -Infinity
  if (saved === 'today') {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }
  return now - (saved === '7d' ? 7 : 30) * 86_400_000
}

type Facet = 'levels' | 'pos' | 'cefr' | 'bookIds' | 'saved' | 'polysemous'

const matches = (e: VocabEntry, f: VocabFilters, now: number, skip?: Facet) =>
  (skip === 'levels' || f.levels.length === 0 || f.levels.includes(levelBucket(e.level))) &&
  (skip === 'pos' || f.pos.length === 0 || f.pos.includes(posGroup(e.pos))) &&
  (skip === 'cefr' || f.cefr.length === 0 || f.cefr.includes(cefrOf(e))) &&
  (skip === 'bookIds' || f.bookIds.length === 0 || e.bookIds.some((id) => f.bookIds.includes(id))) &&
  (skip === 'saved' || lastSavedAt(e) >= savedSince(f.saved, now)) &&
  (skip === 'polysemous' || !f.polysemous || isPolysemous(e))

export const applyFilters = (entries: VocabEntry[], f: VocabFilters, now: number) =>
  entries.filter((e) => matches(e, f, now))

const countBy = <K extends string>(keys: K[], items: VocabEntry[], keyOf: (e: VocabEntry) => K) => {
  const out = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>
  for (const e of items) out[keyOf(e)]++
  return out
}

/** 每個選項的字數：套用其他類的篩選、但不套用自己這類，讓使用者看得出切換後會剩多少 */
export function facetCounts(entries: VocabEntry[], f: VocabFilters, now: number) {
  const without = (skip: Facet) => entries.filter((e) => matches(e, f, now, skip))
  const forBooks = without('bookIds')
  const books = new Map<number, number>()
  for (const e of entries) for (const id of e.bookIds) books.set(id, 0)
  for (const e of forBooks) for (const id of e.bookIds) books.set(id, (books.get(id) ?? 0) + 1)
  const forSaved = without('saved')
  return {
    levels: countBy(LEVEL_BUCKETS, without('levels'), (e) => levelBucket(e.level)),
    pos: countBy(POS_GROUPS, without('pos'), (e) => posGroup(e.pos)),
    cefr: countBy(CEFR_LEVELS, without('cefr'), cefrOf),
    books,
    saved: Object.fromEntries(
      (['all', 'today', '7d', '30d'] as SavedWithin[]).map((s) => [s, forSaved.filter((e) => lastSavedAt(e) >= savedSince(s, now)).length]),
    ) as Record<SavedWithin, number>,
    polysemous: without('polysemous').filter(isPolysemous).length,
  }
}

export const activeFilterCount = (f: VocabFilters) =>
  [f.levels.length, f.pos.length, f.cefr.length, f.bookIds.length, f.saved !== 'all', f.polysemous].filter(Boolean).length
