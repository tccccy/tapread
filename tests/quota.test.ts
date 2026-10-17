import { describe, expect, it } from 'vitest'
import { parseQuotaError, nextQuotaReset, quotaMessage } from '../src/lib/ai/quota'

const body = (quotaId: string | null, retryDelay?: string, message = '') => ({
  error: {
    code: 429,
    status: 'RESOURCE_EXHAUSTED',
    message,
    details: [
      ...(quotaId ? [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId, quotaValue: '20' }] }] : []),
      ...(retryDelay ? [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay }] : []),
    ],
  },
})

describe('parseQuotaError', () => {
  it('每分鐘請求上限 + 建議等待秒數', () => {
    expect(parseQuotaError(body('GenerateRequestsPerMinutePerProjectPerModel-FreeTier', '31s')))
      .toEqual({ scope: 'minute', retryAfterSec: 31 })
  })

  it('小數秒數無條件進位', () => {
    expect(parseQuotaError(body('GenerateRequestsPerMinutePerProjectPerModel-FreeTier', '12.2s')).retryAfterSec).toBe(13)
  })

  it('每分鐘 token 上限也算每分鐘', () => {
    expect(parseQuotaError(body('GenerateContentInputTokensPerModelPerMinute-FreeTier')).scope).toBe('minute')
  })

  it('每日上限', () => {
    expect(parseQuotaError(body('GenerateRequestsPerDayPerProjectPerModel-FreeTier', '50s')).scope).toBe('day')
  })

  it('同時違反每分鐘與每日時，以每日為準', () => {
    const b = body('GenerateRequestsPerMinutePerProjectPerModel-FreeTier')
    b.error.details[0] = { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [
      { quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier', quotaValue: '15' },
      { quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier', quotaValue: '20' },
    ] }
    expect(parseQuotaError(b).scope).toBe('day')
  })

  it('沒有 details 時從訊息文字取等待秒數', () => {
    expect(parseQuotaError(body(null, undefined, 'Quota exceeded. Please retry in 20.3s.')))
      .toEqual({ scope: 'unknown', retryAfterSec: 21 })
  })

  it('格式異常時回傳 unknown，不丟錯', () => {
    expect(parseQuotaError({ error: { details: 'oops' } })).toEqual({ scope: 'unknown' })
    expect(parseQuotaError(null)).toEqual({ scope: 'unknown' })
  })
})

describe('nextQuotaReset（太平洋時間午夜）', () => {
  it('夏令時間：台灣 10/17 11:00 → 當天 15:00（UTC 07:00）', () => {
    expect(nextQuotaReset(new Date('2026-10-17T03:00:00Z')).toISOString()).toBe('2026-10-17T07:00:00.000Z')
  })

  it('標準時間：11 月之後 → UTC 08:00', () => {
    expect(nextQuotaReset(new Date('2026-11-02T03:00:00Z')).toISOString()).toBe('2026-11-02T08:00:00.000Z')
  })

  it('夏令時間結束當天（11/1 凌晨 2 點切換）前：下一個午夜仍是夏令時間', () => {
    expect(nextQuotaReset(new Date('2026-10-31T12:00:00Z')).toISOString()).toBe('2026-11-01T07:00:00.000Z')
  })

  it('剛好在午夜時，回傳下一個午夜', () => {
    expect(nextQuotaReset(new Date('2026-10-17T07:00:00Z')).toISOString()).toBe('2026-10-18T07:00:00.000Z')
  })
})

describe('quotaMessage', () => {
  const tz = 'Asia/Taipei'

  it('每分鐘：顯示等待秒數', () => {
    expect(quotaMessage({ scope: 'minute', retryAfterSec: 31 }, new Date(), tz)).toBe('點太快了，請約 31 秒後再試。')
  })

  it('每分鐘但沒有秒數：約一分鐘', () => {
    expect(quotaMessage({ scope: 'minute' }, new Date(), tz)).toBe('點太快了，請約一分鐘後再試。')
  })

  it('每日：顯示「今天」的重置時間（使用者時區）', () => {
    const msg = quotaMessage({ scope: 'day' }, new Date('2026-10-17T03:00:00Z'), tz)
    expect(msg).toContain('今天的免費額度已用完')
    expect(msg).toContain('今天 15:00')
  })

  it('每日：已過當天重置時間則顯示「明天」', () => {
    expect(quotaMessage({ scope: 'day' }, new Date('2026-10-17T08:00:00Z'), tz)).toContain('明天 15:00')
  })

  it('每日：標準時間改為 16:00', () => {
    expect(quotaMessage({ scope: 'day' }, new Date('2026-11-02T03:00:00Z'), tz)).toContain('今天 16:00')
  })

  it('不明類型：有秒數就顯示秒數', () => {
    expect(quotaMessage({ scope: 'unknown', retryAfterSec: 21 }, new Date(), tz)).toBe('已達使用額度上限，請約 21 秒後再試。')
    expect(quotaMessage({ scope: 'unknown' }, new Date(), tz)).toBe('已達使用額度上限，請稍後再試。')
  })

  it('等待超過 90 秒時改用分鐘表示', () => {
    expect(quotaMessage({ scope: 'minute', retryAfterSec: 150 }, new Date(), tz)).toBe('點太快了，請約 3 分鐘後再試。')
  })
})
