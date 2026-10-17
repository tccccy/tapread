// 閱讀統計：每天讀了多久、連續閱讀天數、每日目標。純邏輯，可在 Node 測試

/** 一天讀超過這個秒數才算「有讀」（連續天數用） */
export const MIN_READ_SECONDS = 60
export const DEFAULT_GOAL_MINUTES = 15
export const GOAL_OPTIONS = [5, 10, 15, 20, 30, 45, 60, 90]
const GOAL_KEY = 'tapread.readingGoal'
const MAX_GOAL_MINUTES = 600

const pad = (n: number) => String(n).padStart(2, '0')

/** 本地日期 YYYY-MM-DD（台灣晚上讀書不能算到 UTC 的前一天） */
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12)

/**
 * 只計算「真的在讀」的時間：距離上次翻頁或點字超過 idleMs 就停止累計，
 * 兩次 tick 間隔太長（裝置睡眠）也只算到上限；暫停（切到背景）期間不算。
 */
export function createActivityClock({ idleMs, start }: { idleMs: number; start: number }) {
  let lastActivity = start
  let lastTick = start
  let paused = false
  return {
    activity(now: number) {
      lastActivity = now
    },
    pause(now: number) {
      lastTick = now
      paused = true
    },
    resume(now: number) {
      // 回到前景本身就是在讀
      lastTick = now
      lastActivity = now
      paused = false
    },
    /** 回傳這段期間要記入的秒數 */
    tick(now: number): number {
      if (paused) return 0
      const from = lastTick
      lastTick = now
      const until = Math.min(now, lastActivity + idleMs)
      return until > from ? Math.round((until - from) / 1000) : 0
    },
  }
}

export type ReadingDays = Map<string, number>

export function streakDays(days: ReadingDays, today: Date): number {
  const read = (d: Date) => (days.get(dayKey(d)) ?? 0) >= MIN_READ_SECONDS
  let day = read(today) ? today : addDays(today, -1)
  let count = 0
  while (read(day)) {
    count++
    day = addDays(day, -1)
  }
  return count
}

export function lastSevenDays(days: ReadingDays, today: Date): { date: string; seconds: number }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = dayKey(addDays(today, i - 6))
    return { date, seconds: days.get(date) ?? 0 }
  })
}

/** 某個時間點之後收藏了幾個字（同一個字在不同句子收藏也只算一次） */
export const countSavedSince = (entries: { examples: { savedAt: number }[] }[], since: number) =>
  entries.filter((e) => e.examples.some((x) => x.savedAt >= since)).length

/** 七天前（含今天共七天）的零點 */
export const sevenDaysAgo = (today: Date) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6).getTime()

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>

export function loadGoal(storage: KeyValueStorage): number {
  try {
    const n = Number(storage.getItem(GOAL_KEY))
    return Number.isInteger(n) && n > 0 && n <= MAX_GOAL_MINUTES ? n : DEFAULT_GOAL_MINUTES
  } catch {
    return DEFAULT_GOAL_MINUTES
  }
}

export function saveGoal(storage: KeyValueStorage, minutes: number): void {
  try {
    storage.setItem(GOAL_KEY, String(minutes))
  } catch (e) {
    console.warn('儲存閱讀目標失敗', e)
  }
}
