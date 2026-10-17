// 閱讀時間存在 IndexedDB（每天一筆）
import type { ReaderDb } from '../db'
import { dayKey, type ReadingDays } from './readingStats'

// 單次寫入的上限：避免時鐘異常時一次記入不合理的時間
const MAX_ADD_SECONDS = 3600

export async function addReadingTime(db: ReaderDb, seconds: number, when = new Date()): Promise<void> {
  const add = Math.min(MAX_ADD_SECONDS, Math.round(seconds))
  if (!(add > 0)) return
  const date = dayKey(when)
  await db.transaction('rw', db.readingDays, async () => {
    const day = await db.readingDays.get(date)
    await db.readingDays.put({ date, seconds: (day?.seconds ?? 0) + add })
  })
}

/** 最近一段時間的閱讀紀錄（連續天數最多往回算一年） */
export async function loadReadingDays(db: ReaderDb, since: string): Promise<ReadingDays> {
  const rows = await db.readingDays.where('date').aboveOrEqual(since).toArray()
  return new Map(rows.map((r) => [r.date, r.seconds]))
}
