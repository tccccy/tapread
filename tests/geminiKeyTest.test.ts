import { describe, expect, it, vi } from 'vitest'
import { testGeminiKey, AiError } from '../src/lib/ai/gemini'

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

describe('testGeminiKey', () => {
  it('查詢模型資訊（不消耗額度），金鑰放標頭', async () => {
    const fetchImpl = vi.fn(async () => respond(200, { name: 'models/gemini-3.5-flash-lite', displayName: 'Gemini 3.5 Flash-Lite' }))
    const result = await testGeminiKey({ apiKey: ' KEY ', model: 'gemini-3.5-flash-lite', fetchImpl })
    expect(result).toEqual({ displayName: 'Gemini 3.5 Flash-Lite' })
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite')
    expect(init.method ?? 'GET').toBe('GET')
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('KEY')
  })

  it('沒有 displayName 時用模型名稱', async () => {
    const result = await testGeminiKey({ apiKey: 'K', model: 'm', fetchImpl: async () => respond(200, {}) })
    expect(result).toEqual({ displayName: 'm' })
  })

  it('沒填金鑰不發請求', async () => {
    const fetchImpl = vi.fn()
    expect(await kindOf(testGeminiKey({ apiKey: '', model: 'm', fetchImpl }))).toBe('no-key')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.each([
    [400, { error: { status: 'INVALID_ARGUMENT', details: [{ reason: 'API_KEY_INVALID' }] } }, 'auth'],
    [404, { error: { status: 'NOT_FOUND' } }, 'model'],
    [429, { error: { status: 'RESOURCE_EXHAUSTED' } }, 'quota'],
  ])('HTTP %i → %s', async (status, body, kind) => {
    expect(await kindOf(testGeminiKey({ apiKey: 'K', model: 'm', fetchImpl: async () => respond(status, body) }))).toBe(kind)
  })

  it('網路失敗', async () => {
    expect(await kindOf(testGeminiKey({ apiKey: 'K', model: 'm', fetchImpl: async () => { throw new TypeError('x') } }))).toBe('network')
  })
})
