import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { createDb } from '../src/lib/db'
import { addReadingTime, loadReadingDays } from '../src/lib/stats/readingLog'
import {
  dayKey, createActivityClock, countSavedSince, sevenDaysAgo, streakDays, lastSevenDays, loadGoal, saveGoal, DEFAULT_GOAL_MINUTES, MIN_READ_SECONDS,
} from '../src/lib/stats/readingStats'

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h)

describe('dayKey', () => {
  it('用本地日期（不是 UTC）', () => {
    expect(dayKey(at(2026, 10, 18, 0))).toBe('2026-10-18')
    expect(dayKey(at(2026, 1, 5, 23))).toBe('2026-01-05')
  })
})

describe('createActivityClock', () => {
  it('有在動的時間才算', () => {
    const clock = createActivityClock({ idleMs: 180_000, start: 0 })
    expect(clock.tick(15_000)).toBe(15)
    expect(clock.tick(30_000)).toBe(15)
  })

  it('超過閒置時間沒有翻頁就不算', () => {
    const clock = createActivityClock({ idleMs: 180_000, start: 0 })
    clock.tick(170_000)
    // 只算到最後一次操作後 3 分鐘（180 秒）為止
    expect(clock.tick(200_000)).toBe(10)
    expect(clock.tick(215_000)).toBe(0)
    clock.activity(220_000)
    expect(clock.tick(235_000)).toBe(20)
  })

  it('兩次計時間隔太久（例如裝置睡眠）只算到閒置上限', () => {
    const clock = createActivityClock({ idleMs: 180_000, start: 0 })
    expect(clock.tick(3_600_000)).toBe(180)
  })

  it('暫停期間（切到背景）不算', () => {
    const clock = createActivityClock({ idleMs: 180_000, start: 0 })
    clock.pause(10_000)
    clock.resume(60_000)
    expect(clock.tick(75_000)).toBe(15)
  })
})

describe('streakDays', () => {
  const days = (entries: [string, number][]) => new Map(entries)

  it('從今天往回數連續有讀的天數', () => {
    const d = days([['2026-10-18', 600], ['2026-10-17', 120], ['2026-10-16', 90], ['2026-10-14', 900]])
    expect(streakDays(d, at(2026, 10, 18))).toBe(3)
  })

  it('今天還沒讀時，從昨天開始算（連續紀錄還沒斷）', () => {
    const d = days([['2026-10-17', 600], ['2026-10-16', 600]])
    expect(streakDays(d, at(2026, 10, 18))).toBe(2)
  })

  it(`少於 ${MIN_READ_SECONDS} 秒不算有讀`, () => {
    const d = days([['2026-10-18', MIN_READ_SECONDS - 1], ['2026-10-17', 600]])
    expect(streakDays(d, at(2026, 10, 18))).toBe(1)
  })

  it('跨月份也正確', () => {
    const d = days([['2026-11-01', 600], ['2026-10-31', 600]])
    expect(streakDays(d, at(2026, 11, 1))).toBe(2)
  })
})

describe('lastSevenDays', () => {
  it('回傳七天（最舊在前），沒讀的日子為 0', () => {
    const week = lastSevenDays(new Map([['2026-10-18', 600], ['2026-10-12', 60]]), at(2026, 10, 18))
    expect(week.map((d) => d.date)).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'])
    expect(week.map((d) => d.seconds)).toEqual([60, 0, 0, 0, 0, 0, 600])
  })
})

describe('loadGoal / saveGoal', () => {
  const storage = () => {
    const m = new Map<string, string>()
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
  }

  it('預設與讀寫', () => {
    const s = storage()
    expect(loadGoal(s)).toBe(DEFAULT_GOAL_MINUTES)
    saveGoal(s, 30)
    expect(loadGoal(s)).toBe(30)
  })

  it('不合理的值回到預設', () => {
    const s = storage()
    s.setItem('tapread.readingGoal', '-5')
    expect(loadGoal(s)).toBe(DEFAULT_GOAL_MINUTES)
  })
})

describe('addReadingTime / loadReadingDays', () => {
  it('同一天累加、不同天分開', async () => {
    const db = createDb(`stats-${Math.random()}`)
    await addReadingTime(db, 30, at(2026, 10, 18))
    await addReadingTime(db, 45, at(2026, 10, 18, 22))
    await addReadingTime(db, 60, at(2026, 10, 17))
    const days = await loadReadingDays(db, '2026-10-01')
    expect(days.get('2026-10-18')).toBe(75)
    expect(days.get('2026-10-17')).toBe(60)
  })

  it('不記入 0 或負數', async () => {
    const db = createDb(`stats-${Math.random()}`)
    await addReadingTime(db, 0, at(2026, 10, 18))
    await addReadingTime(db, -5, at(2026, 10, 18))
    expect((await loadReadingDays(db, '2026-10-01')).size).toBe(0)
  })
})

describe('countSavedSince', () => {
  it('只算這段期間有新收藏的字', () => {
    const since = sevenDaysAgo(at(2026, 10, 18))
    expect(since).toBe(new Date(2026, 9, 12).getTime())
    const entries = [
      { examples: [{ savedAt: since + 1 }, { savedAt: since + 2 }] },
      { examples: [{ savedAt: since - 1 }] },
      { examples: [{ savedAt: since - 1 }, { savedAt: since + 5 }] },
    ]
    expect(countSavedSince(entries, since)).toBe(2)
  })
})
