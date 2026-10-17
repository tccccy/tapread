import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'
import { createLookup, definitionCacheKey } from '../src/lib/lookup'
import { createDb } from '../src/lib/db'
import { createDefinitionCache } from '../src/lib/definitionCache'

const req = { word: 'Banco', sentence: 'Fue al banco.', before: '', after: '', language: 'es', bookTitle: 'T' }
const def = { lemma: 'banco', pos: '名詞', contextMeaning: '銀行', dictMeaning: '', note: '' }

let n = 0
const freshCache = () => createDefinitionCache(createDb(`lookup-test-${++n}`))

describe('definitionCacheKey', () => {
  const M = 'gemini-3.5-flash-lite'

  it('不分大小寫、同句同字得到同一個 key', () => {
    expect(definitionCacheKey(req, M)).toBe(definitionCacheKey({ ...req, word: 'banco', bookTitle: 'Other' }, M))
  })

  it('不同句子、前後文、語言或模型得到不同 key', () => {
    const base = definitionCacheKey(req, M)
    expect(definitionCacheKey({ ...req, sentence: 'Me senté en el banco.' }, M)).not.toBe(base)
    expect(definitionCacheKey({ ...req, before: 'Otra frase.' }, M)).not.toBe(base)
    expect(definitionCacheKey({ ...req, after: 'Otra frase.' }, M)).not.toBe(base)
    expect(definitionCacheKey({ ...req, language: 'pt' }, M)).not.toBe(base)
    expect(definitionCacheKey(req, 'gemini-3.6-flash')).not.toBe(base)
  })
})

describe('createLookup', () => {
  it('第一次呼叫 AI，第二次走快取', async () => {
    const define = vi.fn(async () => def)
    const lookup = createLookup({ cache: freshCache(), define, model: 'm' })
    expect(await lookup(req)).toEqual({ definition: def, cached: false })
    expect(await lookup(req)).toEqual({ definition: def, cached: true })
    expect(define).toHaveBeenCalledTimes(1)
  })

  it('AI 失敗時不寫入快取，錯誤往上拋', async () => {
    const cache = freshCache()
    const define = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(def)
    const lookup = createLookup({ cache, define, model: 'm' })
    await expect(lookup(req)).rejects.toThrow('boom')
    expect(await lookup(req)).toEqual({ definition: def, cached: false })
  })

  it('把取消訊號傳給 AI 呼叫', async () => {
    const define = vi.fn(async () => def)
    const lookup = createLookup({ cache: freshCache(), define, model: 'm' })
    const controller = new AbortController()
    await lookup(req, controller.signal)
    expect(define).toHaveBeenCalledWith(req, controller.signal)
  })

  it('快取讀取失敗時仍會呼叫 AI', async () => {
    const cache = { get: vi.fn().mockRejectedValue(new Error('idb')), put: vi.fn().mockResolvedValue(undefined) }
    const lookup = createLookup({ cache, define: async () => def, model: 'm' })
    expect((await lookup(req)).definition).toEqual(def)
  })
})
