import { describe, expect, it } from 'vitest'
import { wordAt, sentenceContext } from '../src/lib/text/wordContext'

const P = 'María abrió la ventana. Fue al banco para sacar dinero. ¿Dónde estaba el abuelo?'

describe('wordAt', () => {
  it('找出位置所在的單字與起訖', () => {
    const i = P.indexOf('banco') + 2
    expect(wordAt(P, i, 'es')).toEqual({ word: 'banco', start: P.indexOf('banco'), end: P.indexOf('banco') + 5 })
  })

  it('游標在單字結尾（點到最後一個字母右半邊）也算該字', () => {
    const end = P.indexOf('banco') + 5
    expect(wordAt(P, end, 'es')?.word).toBe('banco')
  })

  it('支援帶重音與 ñ 的字', () => {
    expect(wordAt(P, P.indexOf('abrió') + 4, 'es')?.word).toBe('abrió')
  })

  it('點在標點或空白之間回傳 null', () => {
    expect(wordAt('a — b', 2, 'es')).toBeNull()
  })

  it('點在數字上回傳 null（不查數字）', () => {
    expect(wordAt('Tiene 42 años', 7, 'es')).toBeNull()
  })

  it('沒有語言碼也能運作', () => {
    expect(wordAt('Ciao bella', 6)?.word).toBe('bella')
  })
})

describe('sentenceContext', () => {
  it('回傳所在句與前後句', () => {
    const ctx = sentenceContext(P, P.indexOf('banco'), 'es')
    expect(ctx).toEqual({
      sentence: 'Fue al banco para sacar dinero.',
      before: 'María abrió la ventana.',
      after: '¿Dónde estaba el abuelo?',
    })
  })

  it('第一句沒有前句、最後一句沒有後句', () => {
    expect(sentenceContext(P, 0, 'es').before).toBe('')
    expect(sentenceContext(P, P.length - 3, 'es').after).toBe('')
  })

  it('過長的句子會被截短', () => {
    const long = 'palabra '.repeat(200) + 'final.'
    const ctx = sentenceContext(long, 5, 'es')
    expect(ctx.sentence.length).toBeLessThanOrEqual(500)
  })

  it('長句截短時保留目標字附近的文字', () => {
    const long = 'uno '.repeat(150) + 'objetivo ' + 'dos '.repeat(150) + 'fin.'
    const ctx = sentenceContext(long, long.indexOf('objetivo'), 'es')
    expect(ctx.sentence).toContain('objetivo')
    expect(ctx.sentence.length).toBeLessThanOrEqual(500)
  })

  it('超長段落（數萬字）也能快速取得上下文', () => {
    const huge = 'Una frase corta aquí. '.repeat(5000)
    const offset = Math.floor(huge.length / 2)
    const t0 = performance.now()
    const ctx = sentenceContext(huge, offset, 'es')
    expect(performance.now() - t0).toBeLessThan(50)
    expect(ctx.sentence).toBe('Una frase corta aquí.')
    expect(ctx.before).toBe('Una frase corta aquí.')
  })
})
