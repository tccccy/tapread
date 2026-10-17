import { parseQuotaError, quotaMessage, type QuotaInfo } from './quota'
import { buildDefinePrompt, parseDefinition, DefinitionParseError, DEFINITION_SCHEMA, type DefineRequest, type Definition } from './definition'

export type AiErrorKind =
  | 'no-key' | 'auth' | 'model' | 'quota' | 'server' | 'bad-request'
  | 'network' | 'timeout' | 'blocked' | 'bad-response' | 'aborted'

export class AiError extends Error {
  name = 'AiError'
  readonly quota?: QuotaInfo
  constructor(readonly kind: AiErrorKind, message: string, options?: { cause?: unknown; quota?: QuotaInfo }) {
    super(message, options)
    this.quota = options?.quota
  }
}

const MESSAGES: Record<AiErrorKind, string> = {
  'no-key': '還沒設定 Gemini API 金鑰，請到「設定」貼上。',
  auth: 'API 金鑰無效或沒有權限，請到「設定」確認金鑰。',
  model: '找不到這個模型，請到「設定」檢查模型名稱。',
  quota: '已達使用額度上限，請稍後再試。',
  server: 'Gemini 服務暫時無法使用，請稍後再試。',
  'bad-request': '請求被拒絕，請稍後再試。',
  network: '連不上網路，請檢查連線。',
  timeout: '回應逾時，請再點一次。',
  blocked: '這段內容被 Gemini 的安全機制擋下，無法解釋。',
  'bad-response': 'AI 回應格式有誤，請再點一次。',
  aborted: '已取消查詢。',
}

export const aiErrorMessage = (e: unknown) => {
  if (!(e instanceof AiError)) return '查詢失敗，請再試一次。'
  if (e.kind === 'quota') return quotaMessage(e.quota ?? { scope: 'unknown' })
  return MESSAGES[e.kind]
}

export interface GeminiOptions {
  apiKey: string
  model: string
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>
  timeoutMs?: number
}

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'

interface GeminiErrorBody {
  error?: { status?: string; details?: { reason?: string }[] }
}

const classifyHttpError = (status: number, body: GeminiErrorBody): AiErrorKind => {
  const reasons = body.error?.details?.map((d) => d.reason) ?? []
  if (reasons.includes('API_KEY_INVALID') || status === 401 || status === 403) return 'auth'
  if (status === 404) return 'model'
  if (status === 429) return 'quota'
  if (status >= 500) return 'server'
  return 'bad-request'
}

interface GenerateResponse {
  promptFeedback?: { blockReason?: string }
  candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[]
}

// 包一層箭頭函式：直接傳 window.fetch 在某些呼叫方式下會 Illegal invocation
const defaultFetch = (url: string, init?: RequestInit) => fetch(url, init)

export function createGeminiDefiner({ apiKey, model, fetchImpl = defaultFetch, timeoutMs = 20_000 }: GeminiOptions) {
  const key = apiKey.trim()

  async function callOnce(req: DefineRequest, signal?: AbortSignal): Promise<Definition> {
    if (signal?.aborted) throw new AiError('aborted', '查詢已取消')
    // 不用 AbortSignal.any：iPad Safari 17.4 以前沒有
    const controller = new AbortController()
    const onAbort = () => controller.abort()
    signal?.addEventListener('abort', onAbort, { once: true })
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    let res: Response
    try {
      res = await fetchImpl(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        // 金鑰放標頭，不放網址
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: buildDefinePrompt(req) }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: DEFINITION_SCHEMA,
            temperature: 0.2,
          },
        }),
        signal: controller.signal,
      })
    } catch (e) {
      if (signal?.aborted) throw new AiError('aborted', '查詢已取消', { cause: e })
      if (controller.signal.aborted) throw new AiError('timeout', 'Gemini 請求逾時', { cause: e })
      throw new AiError('network', 'Gemini 網路錯誤', { cause: e })
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }

    const body = (await res.json().catch(() => ({}))) as GenerateResponse & GeminiErrorBody
    if (!res.ok) {
      const kind = classifyHttpError(res.status, body)
      const quota = kind === 'quota' ? parseQuotaError(body) : undefined
      throw new AiError(kind, `Gemini HTTP ${res.status} ${body.error?.status ?? ''}`.trim(), { quota })
    }
    if (body.promptFeedback?.blockReason) {
      throw new AiError('blocked', `Gemini 擋下內容：${body.promptFeedback.blockReason}`)
    }
    const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
    try {
      return parseDefinition(text)
    } catch (e) {
      if (e instanceof DefinitionParseError) throw new AiError('bad-response', e.message, { cause: e })
      throw e
    }
  }

  return async function define(req: DefineRequest, signal?: AbortSignal): Promise<Definition> {
    if (!key) throw new AiError('no-key', '未設定 Gemini API 金鑰')
    try {
      return await callOnce(req, signal)
    } catch (e) {
      // 模型偶爾回錯格式，重試一次即可
      if (e instanceof AiError && e.kind === 'bad-response') return callOnce(req, signal)
      throw e
    }
  }
}
