import { describe, expect, it, vi } from 'vitest'
import { createGeminiDefiner, AiError, aiErrorMessage } from '../src/lib/ai/gemini'

const req = { word: 'banco', sentence: 'Fue al banco.', before: '', after: '', language: 'es', bookTitle: 'T' }
const def = { lemma: 'banco', pos: '名詞', context_meaning: '銀行', dict_meaning: '長椅；銀行', note: '' }

const geminiBody = (text: string) => ({ candidates: [{ content: { parts: [{ text }] } }] })
const respond = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const kindOf = async (p: Promise<unknown>) => {
  try {
    await p
  } catch (e) {
    return e instanceof AiError ? e.kind : 'other'
  }
  return 'none'
}

describe('createGeminiDefiner', () => {
  it('送出正確的端點、金鑰標頭與 JSON schema，並解析回應', async () => {
    const fetchImpl = vi.fn(async () => respond(200, geminiBody(JSON.stringify(def))))
    const define = createGeminiDefiner({ apiKey: 'KEY', model: 'gemini-3.5-flash-lite', fetchImpl })
    const result = await define(req)

    expect(result.contextMeaning).toBe('銀行')
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent')
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('KEY')
    const body = JSON.parse(init.body as string)
    expect(body.generationConfig.responseMimeType).toBe('application/json')
    expect(body.generationConfig.responseSchema.required).toContain('context_meaning')
    expect(url).not.toContain('KEY')
  })

  it('回應格式錯誤時重試一次', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(respond(200, geminiBody('oops')))
      .mockResolvedValueOnce(respond(200, geminiBody(JSON.stringify(def))))
    const define = createGeminiDefiner({ apiKey: 'K', model: 'm', fetchImpl })
    expect((await define(req)).lemma).toBe('banco')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('連續兩次格式錯誤回報 bad-response', async () => {
    const fetchImpl = vi.fn(async () => respond(200, geminiBody('oops')))
    const define = createGeminiDefiner({ apiKey: 'K', model: 'm', fetchImpl })
    expect(await kindOf(define(req))).toBe('bad-response')
  })

  it('沒有金鑰時不發請求，回報 no-key', async () => {
    const fetchImpl = vi.fn()
    const define = createGeminiDefiner({ apiKey: '  ', model: 'm', fetchImpl })
    expect(await kindOf(define(req))).toBe('no-key')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.each([
    [400, { error: { status: 'INVALID_ARGUMENT', details: [{ reason: 'API_KEY_INVALID' }] } }, 'auth'],
    [403, { error: { status: 'PERMISSION_DENIED' } }, 'auth'],
    [404, { error: { status: 'NOT_FOUND' } }, 'model'],
    [429, { error: { status: 'RESOURCE_EXHAUSTED' } }, 'quota'],
    [503, { error: { status: 'UNAVAILABLE' } }, 'server'],
    [400, { error: { status: 'INVALID_ARGUMENT' } }, 'bad-request'],
  ])('HTTP %i 對應錯誤類型', async (status, body, kind) => {
    const define = createGeminiDefiner({ apiKey: 'K', model: 'm', fetchImpl: async () => respond(status, body) })
    expect(await kindOf(define(req))).toBe(kind)
  })

  it('429 帶出配額細節，訊息具體說明', async () => {
    const quotaBody = { error: { status: 'RESOURCE_EXHAUSTED', details: [
      { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier' }] },
      { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '8s' },
    ] } }
    const define = createGeminiDefiner({ apiKey: 'K', model: 'm', fetchImpl: async () => respond(429, quotaBody) })
    const err = await define(req).catch((e) => e)
    expect(err).toBeInstanceOf(AiError)
    expect(err.quota).toEqual({ scope: 'minute', retryAfterSec: 8 })
    expect(aiErrorMessage(err)).toBe('點太快了，請約 8 秒後再試。')
  })

  it('網路失敗回報 network', async () => {
    const define = createGeminiDefiner({ apiKey: 'K', model: 'm', fetchImpl: async () => { throw new TypeError('Failed to fetch') } })
    expect(await kindOf(define(req))).toBe('network')
  })

  it('逾時回報 timeout', async () => {
    const fetchImpl = (_: string, init?: RequestInit) =>
      new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))
    const define = createGeminiDefiner({ apiKey: 'K', model: 'm', fetchImpl, timeoutMs: 10 })
    expect(await kindOf(define(req))).toBe('timeout')
  })

  it('外部取消時回報 aborted，且不重試', async () => {
    const fetchImpl = vi.fn((_: string, init?: RequestInit) =>
      new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))))
    const define = createGeminiDefiner({ apiKey: 'K', model: 'm', fetchImpl })
    const controller = new AbortController()
    const p = define(req, controller.signal)
    controller.abort()
    expect(await kindOf(p)).toBe('aborted')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('已取消的訊號不發請求', async () => {
    const fetchImpl = vi.fn()
    const define = createGeminiDefiner({ apiKey: 'K', model: 'm', fetchImpl })
    expect(await kindOf(define(req, AbortSignal.abort()))).toBe('aborted')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('內容被安全機制擋下回報 blocked', async () => {
    const define = createGeminiDefiner({ apiKey: 'K', model: 'm', fetchImpl: async () => respond(200, { promptFeedback: { blockReason: 'SAFETY' } }) })
    expect(await kindOf(define(req))).toBe('blocked')
  })
})
