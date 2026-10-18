import type { DefineRequest, Definition } from './ai/definition'
import type { DefinitionCache } from './definitionCache'

// FNV-1a：只用來縮短快取 key，不需要密碼學強度；用兩個種子組成 64 位元降低碰撞
const fnv1a = (s: string, seed = 0x811c9dc5) => {
  let h = seed
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

export const hash64 = (s: string) => fnv1a(s) + fnv1a(s, 0x01234567)

// 釋義由模型、語言、單字與前後文共同決定；書名只是輔助，不納入
export const definitionCacheKey = (req: DefineRequest, model: string) => {
  const context = [req.before, req.sentence, req.after].join('\u0001')
  // v2：回傳內容加入 CEFR；改版號讓舊快取（沒有難度）自然失效
  return `v2|${model}|${req.language}|${req.word.toLocaleLowerCase()}|${hash64(context)}`
}

export interface LookupResult {
  definition: Definition
  cached: boolean
}

export function createLookup({ cache, define, model }: {
  cache: DefinitionCache
  define: (req: DefineRequest, signal?: AbortSignal) => Promise<Definition>
  model: string
}) {
  return async function lookup(req: DefineRequest, signal?: AbortSignal): Promise<LookupResult> {
    const key = definitionCacheKey(req, model)
    const hit = await cache.get(key).catch((e) => {
      console.warn('讀取釋義快取失敗', e)
      return undefined
    })
    if (hit) return { definition: hit, cached: true }

    const definition = await define(req, signal)
    await cache.put(key, definition).catch((e) => console.warn('寫入釋義快取失敗', e))
    return { definition, cached: false }
  }
}
