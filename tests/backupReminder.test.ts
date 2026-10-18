import { describe, it, expect } from 'vitest'
import {
  backupReminder, recordBackup, loadLastBackup, snoozeReminder, loadSnooze, formatBytes, REMIND_AFTER_DAYS, FIRST_REMIND_DAYS,
} from '../src/lib/backup/reminder'

const DAY = 86_400_000
const NOW = new Date(2026, 9, 18, 12).getTime()

const memory = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}

describe('backupReminder', () => {
  it('沒有任何書時不提醒', () => {
    expect(backupReminder({ now: NOW, lastBackupAt: null, firstDataAt: null, snoozedUntil: 0 }).show).toBe(false)
  })

  it(`從沒備份過：加入第一本書 ${FIRST_REMIND_DAYS} 天後開始提醒`, () => {
    const early = backupReminder({ now: NOW, lastBackupAt: null, firstDataAt: NOW - (FIRST_REMIND_DAYS - 1) * DAY, snoozedUntil: 0 })
    const late = backupReminder({ now: NOW, lastBackupAt: null, firstDataAt: NOW - FIRST_REMIND_DAYS * DAY, snoozedUntil: 0 })
    expect(early.show).toBe(false)
    expect(late).toEqual({ show: true, daysSince: null })
  })

  it(`上次備份超過 ${REMIND_AFTER_DAYS} 天才提醒，並算出天數`, () => {
    const firstDataAt = NOW - 100 * DAY
    expect(backupReminder({ now: NOW, lastBackupAt: NOW - (REMIND_AFTER_DAYS - 1) * DAY, firstDataAt, snoozedUntil: 0 }).show).toBe(false)
    expect(backupReminder({ now: NOW, lastBackupAt: NOW - 20 * DAY, firstDataAt, snoozedUntil: 0 })).toEqual({ show: true, daysSince: 20 })
  })

  it('按了稍後提醒，期間內不提醒', () => {
    const r = backupReminder({ now: NOW, lastBackupAt: NOW - 30 * DAY, firstDataAt: NOW - 100 * DAY, snoozedUntil: NOW + DAY })
    expect(r.show).toBe(false)
  })
})

describe('紀錄備份時間與稍後提醒', () => {
  it('存了再讀回來', () => {
    const s = memory()
    expect(loadLastBackup(s)).toBeNull()
    recordBackup(s, NOW)
    expect(loadLastBackup(s)).toBe(NOW)
  })

  it('稍後提醒預設 3 天', () => {
    const s = memory()
    snoozeReminder(s, NOW)
    expect(loadSnooze(s)).toBe(NOW + 3 * DAY)
  })

  it('壞掉的值當作沒有', () => {
    const s = memory()
    s.setItem('tapread.lastBackupAt', 'abc')
    expect(loadLastBackup(s)).toBeNull()
    expect(loadSnooze(s)).toBe(0)
  })
})

describe('formatBytes', () => {
  it('依大小換單位', () => {
    expect(formatBytes(500)).toBe('500 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(25 * 1024 * 1024)).toBe('25 MB')
    expect(formatBytes(3.2 * 1024 ** 3)).toBe('3.2 GB')
  })
})
