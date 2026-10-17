// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { phraseAt, selectionToLookup, MAX_PHRASE_WORDS } from '../src/lib/text/selectPhrase'
import { findPhraseMatches, isPhrase } from '../src/lib/text/phraseMatch'
import { buildDefinePrompt } from '../src/lib/ai/definition'

describe('phraseAt', () => {
  const text = 'Al final, se dio cuenta de todo.'

  it('去掉選取範圍前後的標點與空白', () => {
    const start = text.indexOf(', se') // 多選了逗號與空白
    const end = text.indexOf(' de') + 1
    expect(phraseAt(text, start, end, 'es')).toEqual({ word: 'se dio cuenta', start: start + 2, end: end - 1 })
  })

  it('多個空白與換行合成一個空格', () => {
    const t = 'give   up\nsmoking'
    expect(phraseAt(t, 0, t.length, 'en')?.word).toBe('give up smoking')
  })

  it('沒有字母時回傳 null', () => {
    expect(phraseAt('… 123 …', 0, 9, 'en')).toBeNull()
  })

  it(`超過 ${MAX_PHRASE_WORDS} 個字視為選了一整段，不查`, () => {
    const long = 'one two three four five six seven eight nine'
    expect(phraseAt(long, 0, long.length, 'en')).toBeNull()
  })
})

describe('selectionToLookup', () => {
  it('把選取範圍轉成片語＋所在句子', () => {
    document.body.innerHTML = '<p>Ella lo pensó. Al final se <em>dio</em> cuenta de todo. Luego salió.</p>'
    const p = document.querySelector('p')!
    const range = document.createRange()
    const first = p.firstChild as Text
    range.setStart(first, first.data.indexOf('se'))
    const last = p.lastChild as Text
    range.setEnd(last, ' cuenta'.length)
    const sel = document.getSelection()!
    sel.removeAllRanges()
    sel.addRange(range)

    const hit = selectionToLookup(document, 'es')
    expect(hit?.word).toBe('se dio cuenta')
    expect(hit?.sentence).toBe('Al final se dio cuenta de todo.')
    expect(hit?.before).toContain('Ella lo pensó.')
    expect(hit?.range.toString()).toBe('se dio cuenta')
  })

  it('沒有選取時回傳 null', () => {
    document.getSelection()!.removeAllRanges()
    expect(selectionToLookup(document, 'es')).toBeNull()
  })
})

describe('findPhraseMatches', () => {
  const phrases = new Map([['se dio cuenta', 2], ['give up', 1]])

  it('不分大小寫、容許多個空白', () => {
    expect(findPhraseMatches('Se  dio cuenta.', phrases)).toEqual([{ start: 0, end: 14, level: 2 }])
  })

  it('只比對完整的字', () => {
    expect(findPhraseMatches('forgive upward', phrases)).toEqual([])
  })

  it('同一段文字可以有多個命中', () => {
    expect(findPhraseMatches('give up, then give up again', phrases)).toHaveLength(2)
  })

  it('isPhrase：含空白才算片語', () => {
    expect(isPhrase('give up')).toBe(true)
    expect(isPhrase('banco')).toBe(false)
  })
})

describe('buildDefinePrompt：片語', () => {
  const req = { word: 'se dio cuenta', sentence: 'Al final se dio cuenta.', before: '', after: '', language: 'es', bookTitle: 'x' }

  it('片語用 phrase 的說法，並要求原形片語', () => {
    const p = buildDefinePrompt(req)
    expect(p).toMatch(/phrase/i)
    expect(p).toContain('darse cuenta')
  })

  it('單字維持原本說法', () => {
    expect(buildDefinePrompt({ ...req, word: 'banco' })).not.toMatch(/the phrase/i)
  })
})
