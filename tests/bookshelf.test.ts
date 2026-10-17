import { describe, expect, it } from 'vitest'
import { bookStatus, normalizeRating, groupBooks, continueReading, FINISHED_PROGRESS } from '../src/lib/books/bookshelf'
import type { BookSummary } from '../src/lib/db'

const book = (id: number, over: Partial<BookSummary> = {}): BookSummary => ({
  id, title: `B${id}`, author: '', language: 'en', addedAt: id, lastOpenedAt: id, lastCfi: null, progress: 0, ...over,
})

describe('bookStatus', () => {
  it('還沒打開過 → 還沒開始', () => {
    expect(bookStatus(book(1))).toBe('unread')
  })
  it('有閱讀位置 → 正在讀', () => {
    expect(bookStatus(book(1, { lastCfi: 'x', progress: 0.3 }))).toBe('reading')
  })
  it('有讀完日期 → 讀完了（讀到底時會自動記下讀完日期）', () => {
    expect(bookStatus(book(1, { lastCfi: 'x', progress: 0.2, finishedAt: 5 }))).toBe('finished')
  })
  it('取消「讀完」後即使進度在最後也回到正在讀', () => {
    expect(bookStatus(book(1, { lastCfi: 'x', progress: FINISHED_PROGRESS }))).toBe('reading')
  })
})

describe('normalizeRating', () => {
  it('以半顆星為單位、限制在 0.5–5', () => {
    expect(normalizeRating(3.4)).toBe(3.5)
    expect(normalizeRating(3.2)).toBe(3)
    expect(normalizeRating(9)).toBe(5)
    expect(normalizeRating(0.2)).toBe(0.5)
  })
  it('0、null、非數字代表沒有評分', () => {
    expect(normalizeRating(0)).toBeNull()
    expect(normalizeRating(null)).toBeNull()
    expect(normalizeRating(Number.NaN)).toBeNull()
  })
})

describe('continueReading', () => {
  it('最近打開、還在讀的那本', () => {
    const books = [
      book(1, { lastCfi: 'x', progress: 0.3, lastOpenedAt: 10 }),
      book(2, { lastCfi: 'x', progress: 0.4, lastOpenedAt: 30 }),
      book(3, { lastCfi: 'x', progress: 1, lastOpenedAt: 50, finishedAt: 50 }),
    ]
    expect(continueReading(books)?.id).toBe(2)
    expect(continueReading([book(1)])).toBeNull()
  })
})

describe('groupBooks', () => {
  const books = [
    book(1, { lastCfi: 'x', progress: 0.3, lastOpenedAt: 10, language: 'es', shelfIds: ['s1'] }),
    book(2, { lastOpenedAt: 20, language: 'en', shelfIds: ['s1', 's2'] }),
    book(3, { lastCfi: 'x', progress: 1, lastOpenedAt: 30, language: 'en', finishedAt: 30 }),
    book(4, { lastCfi: 'x', progress: 0.5, lastOpenedAt: 40, language: '' }),
  ]
  const ids = (g: { books: BookSummary[] }) => g.books.map((b) => b.id)

  it('依閱讀狀態：正在讀、還沒開始、讀完了；空的層不顯示；層內最近打開的在前', () => {
    const groups = groupBooks(books, 'status', [])
    expect(groups.map((g) => g.title)).toEqual(['正在讀', '還沒開始', '讀完了'])
    expect(groups.map(ids)).toEqual([[4, 1], [2], [3]])
  })

  it('依語言：書多的語言在前，未標語言放最後', () => {
    const groups = groupBooks(books, 'language', [])
    expect(groups.map((g) => g.title)).toEqual(['英文', '西班牙文', '未指定語言'])
    expect(groups.map(ids)).toEqual([[3, 2], [1], [4]])
  })

  it('依自訂書架：依書架順序；同一本書可以在多個書架；沒放進書架的在「未分類」；空書架也顯示', () => {
    const shelves = [
      { id: 's2', name: '工作', order: 1, createdAt: 1 },
      { id: 's1', name: '小說', order: 0, createdAt: 1 },
      { id: 's3', name: '空的', order: 2, createdAt: 1 },
    ]
    const groups = groupBooks(books, 'shelves', shelves)
    expect(groups.map((g) => g.title)).toEqual(['小說', '工作', '空的', '未分類'])
    expect(groups.map(ids)).toEqual([[2, 1], [2], [], [4, 3]])
  })
})
