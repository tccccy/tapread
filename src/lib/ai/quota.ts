// 解析 Gemini 429 錯誤的配額細節，產生具體的中文提示
export type QuotaScope = 'minute' | 'day' | 'unknown'

export interface QuotaInfo {
  scope: QuotaScope
  retryAfterSec?: number
}

// Gemini 免費額度每天在太平洋時間午夜重置
const QUOTA_RESET_TIME_ZONE = 'America/Los_Angeles'

const asRecord = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null

const parseSeconds = (s: unknown, pattern: RegExp): number | undefined => {
  if (typeof s !== 'string') return undefined
  const m = s.match(pattern)
  return m ? Math.ceil(Number(m[1])) : undefined
}

export function parseQuotaError(body: unknown): QuotaInfo {
  const error = asRecord(asRecord(body)?.error)
  const details = Array.isArray(error?.details) ? error.details.map(asRecord) : []

  const quotaIds = details
    .flatMap((d) => (Array.isArray(d?.violations) ? d.violations : []))
    .map((v) => asRecord(v)?.quotaId)
    .filter((id): id is string => typeof id === 'string')
  // 同時違反時以每日為準：等一分鐘也沒用
  const scope: QuotaScope = quotaIds.some((id) => /PerDay/i.test(id))
    ? 'day'
    : quotaIds.some((id) => /PerMinute/i.test(id))
      ? 'minute'
      : 'unknown'

  const retryAfterSec =
    details.map((d) => parseSeconds(d?.retryDelay, /^([\d.]+)s$/)).find((n) => n !== undefined) ??
    parseSeconds(error?.message, /retry in ([\d.]+)s/i)

  return retryAfterSec === undefined ? { scope } : { scope, retryAfterSec }
}

// 「GMT-07:00」→ -420
const offsetMinutes = (date: Date, timeZone: string) => {
  const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(date)
    .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT'
  const m = name.match(/GMT([+-])(\d{2}):(\d{2})/)
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0
}

const dateParts = (date: Date, timeZone?: string) => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' })
    .formatToParts(date)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  return { y: get('year'), m: get('month'), d: get('day') }
}

/** 下一次太平洋時間午夜（考慮夏令時間切換） */
export function nextQuotaReset(now: Date): Date {
  const { y, m, d } = dateParts(now, QUOTA_RESET_TIME_ZONE)
  const midnightAsUtc = Date.UTC(y, m - 1, d + 1)
  // 先用現在的時差估算，再用估算時刻的時差校正（跨越夏令時間切換時兩者不同）
  const guess = midnightAsUtc - offsetMinutes(now, QUOTA_RESET_TIME_ZONE) * 60_000
  return new Date(midnightAsUtc - offsetMinutes(new Date(guess), QUOTA_RESET_TIME_ZONE) * 60_000)
}

const waitText = (sec: number) => (sec <= 90 ? `${sec} 秒` : `${Math.ceil(sec / 60)} 分鐘`)

/** timeZone 預設為使用者裝置的時區 */
export function quotaMessage(info: QuotaInfo, now = new Date(), timeZone?: string): string {
  if (info.scope === 'day') {
    const reset = nextQuotaReset(now)
    const a = dateParts(now, timeZone)
    const b = dateParts(reset, timeZone)
    const day = a.y === b.y && a.m === b.m && a.d === b.d ? '今天' : '明天'
    const time = new Intl.DateTimeFormat('zh-TW', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(reset)
    return `今天的免費額度已用完，將於${day} ${time} 重置。需要更多額度可在 Google AI Studio 綁定付款。`
  }
  if (info.scope === 'minute') {
    return info.retryAfterSec ? `點太快了，請約 ${waitText(info.retryAfterSec)}後再試。` : '點太快了，請約一分鐘後再試。'
  }
  return info.retryAfterSec ? `已達使用額度上限，請約 ${waitText(info.retryAfterSec)}後再試。` : '已達使用額度上限，請稍後再試。'
}
