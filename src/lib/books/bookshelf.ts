// 書架的純邏輯：閱讀狀態、評分、分層（依狀態／語言／自訂書架）
import type { BookSummary, Shelf } from '../db'
import { languageLabel } from '../languageName'

export type BookStatus = 'unread' | 'reading' | 'finished'
export type GroupMode = 'status' | 'language' | 'shelves'

/** 讀到這個進度就算讀完（最後一頁常常到不了 100%） */
export const FINISHED_PROGRESS = 0.98

// 只看讀完日期：讀到底時 saveLocation 會自動記下；使用者也能手動取消
export function bookStatus(b: Pick<BookSummary, 'lastCfi' | 'progress' | 'finishedAt'>): BookStatus {
  if (b.finishedAt) return 'finished'
  return b.lastCfi ? 'reading' : 'unread'
}

/** 半顆星為單位、限制在 0.5–5；0 或無效值代表沒有評分 */
export function normalizeRating(r: number | null | undefined): number | null {
  if (typeof r !== 'number' || !Number.isFinite(r) || r <= 0) return null
  return Math.min(5, Math.max(0.5, Math.round(r * 2) / 2))
}

const byRecent = (a: BookSummary, b: BookSummary) => b.lastOpenedAt - a.lastOpenedAt

export const continueReading = (books: BookSummary[]): BookSummary | null =>
  books.filter((b) => bookStatus(b) === 'reading').sort(byRecent)[0] ?? null

export interface BookGroup {
  key: string
  title: string
  books: BookSummary[]
}

const STATUS_ORDER: [BookStatus, string][] = [['reading', '正在讀'], ['unread', '還沒開始'], ['finished', '讀完了']]
export const UNSHELVED_KEY = 'unshelved'

export function groupBooks(books: BookSummary[], mode: GroupMode, shelves: Shelf[]): BookGroup[] {
  const sorted = [...books].sort(byRecent)

  if (mode === 'status') {
    return STATUS_ORDER
      .map(([status, title]) => ({ key: status, title, books: sorted.filter((b) => bookStatus(b) === status) }))
      .filter((g) => g.books.length > 0)
  }

  if (mode === 'language') {
    const byLang = new Map<string, BookSummary[]>()
    for (const b of sorted) byLang.set(b.language, [...(byLang.get(b.language) ?? []), b])
    return [...byLang]
      .sort(([la, a], [lb, b]) => (la === '') !== (lb === '') ? (la === '' ? 1 : -1) : b.length - a.length)
      .map(([lang, list]) => ({ key: `lang:${lang}`, title: languageLabel(lang), books: list }))
  }

  // 自訂書架：空書架也顯示（剛建好的書架才看得到）；沒放進任何書架的放「未分類」
  const known = new Set(shelves.map((s) => s.id))
  const groups = [...shelves]
    .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
    .map((s) => ({ key: s.id, title: s.name, books: sorted.filter((b) => b.shelfIds?.includes(s.id)) }))
  const unshelved = sorted.filter((b) => !(b.shelfIds ?? []).some((id) => known.has(id)))
  return unshelved.length > 0 ? [...groups, { key: UNSHELVED_KEY, title: '未分類', books: unshelved }] : groups
}
