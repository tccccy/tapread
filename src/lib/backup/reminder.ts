// 備份提醒與儲存空間顯示用的小工具（純函式＋localStorage）

/** 上次備份超過幾天就提醒 */
export const REMIND_AFTER_DAYS = 14
/** 從沒備份過：加入第一本書幾天後開始提醒 */
export const FIRST_REMIND_DAYS = 3
const SNOOZE_DAYS = 3
const DAY = 86_400_000

const LAST_BACKUP_KEY = 'tapread.lastBackupAt'
const SNOOZE_KEY = 'tapread.backupSnoozeUntil'

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>

const readNumber = (storage: KeyValueStorage, key: string): number | null => {
  try {
    const n = Number(storage.getItem(key))
    return storage.getItem(key) !== null && Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

const write = (storage: KeyValueStorage, key: string, value: number) => {
  try {
    storage.setItem(key, String(value))
  } catch (e) {
    console.warn('儲存備份提醒設定失敗', e)
  }
}

export const loadLastBackup = (storage: KeyValueStorage): number | null => readNumber(storage, LAST_BACKUP_KEY)
export const recordBackup = (storage: KeyValueStorage, now: number): void => write(storage, LAST_BACKUP_KEY, now)
export const loadSnooze = (storage: KeyValueStorage): number => readNumber(storage, SNOOZE_KEY) ?? 0
export const snoozeReminder = (storage: KeyValueStorage, now: number, days = SNOOZE_DAYS): void =>
  write(storage, SNOOZE_KEY, now + days * DAY)

export interface ReminderInput {
  now: number
  lastBackupAt: number | null
  /** 最早加入的書的時間；沒有書時為 null */
  firstDataAt: number | null
  snoozedUntil: number
}

/** daysSince：距離上次備份幾天；從沒備份過為 null */
export function backupReminder({ now, lastBackupAt, firstDataAt, snoozedUntil }: ReminderInput): { show: boolean; daysSince: number | null } {
  const daysSince = lastBackupAt === null ? null : Math.floor((now - lastBackupAt) / DAY)
  if (firstDataAt === null || now < snoozedUntil) return { show: false, daysSince }
  const due = daysSince === null
    ? now - firstDataAt >= FIRST_REMIND_DAYS * DAY
    : daysSince >= REMIND_AFTER_DAYS
  return { show: due, daysSince }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value >= 10 ? Math.round(value) : Math.round(value * 10) / 10} ${units[i]}`
}
