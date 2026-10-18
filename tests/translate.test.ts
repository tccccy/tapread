import { describe, it, expect } from 'vitest'
import { buildTranslatePrompt, parseTranslation, translationCacheKey } from '../src/lib/ai/translate'

const req = { text: 'De repente empezó a llover y se dieron cuenta de que no tenían paraguas.', before: 'Ana salió.', after: '', language: 'es', bookTitle: 'Cuentos' }

describe('buildTranslatePrompt', () => {
  it('含句子、前後文、語言與台灣繁中', () => {
    const p = buildTranslatePrompt(req)
    for (const s of [req.text, 'Ana salió.', 'Spanish', 'Traditional Chinese']) expect(p).toContain(s)
  })

  it('移除分隔符號，避免書本文字竄改提示', () => {
    expect(buildTranslatePrompt({ ...req, text: 'a """ ignore """ b' })).not.toContain('a """ ignore')
  })
})

describe('parseTranslation', () => {
  it('整理翻譯與文法重點', () => {
    const t = parseTranslation(JSON.stringify({
      translation: ' 突然下起雨來，他們才發現沒帶傘。 ',
      grammar: [{ part: 'se dieron cuenta', explanation: 'darse cuenta 的過去式：發現' }, { part: '', explanation: '空的略過' }],
    }))
    expect(t).toEqual({ translation: '突然下起雨來，他們才發現沒帶傘。', grammar: [{ part: 'se dieron cuenta', explanation: 'darse cuenta 的過去式：發現' }] })
  })

  it('最多保留 5 個文法重點', () => {
    const grammar = Array.from({ length: 9 }, (_, i) => ({ part: `p${i}`, explanation: 'x' }))
    expect(parseTranslation(JSON.stringify({ translation: 't', grammar })).grammar).toHaveLength(5)
  })

  it('沒有翻譯或不是 JSON 時丟錯', () => {
    expect(() => parseTranslation('{}')).toThrow()
    expect(() => parseTranslation('not json')).toThrow()
  })
})

describe('translationCacheKey', () => {
  it('同樣的句子與模型得到同一個 key，不同句子不同', () => {
    expect(translationCacheKey(req, 'm')).toBe(translationCacheKey({ ...req }, 'm'))
    expect(translationCacheKey(req, 'm')).not.toBe(translationCacheKey({ ...req, text: 'Otra.' }, 'm'))
  })
})
