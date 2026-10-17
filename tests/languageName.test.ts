import { describe, expect, it } from 'vitest'
import { languageLabel } from '../src/lib/languageName'

describe('languageLabel', () => {
  it('語言碼轉成繁中名稱', () => {
    expect(languageLabel('es')).toBe('西班牙文')
    expect(languageLabel('pt')).toBe('葡萄牙文')
  })

  it('空字串或不合法代碼', () => {
    expect(languageLabel('')).toBe('未指定語言')
    expect(languageLabel('!!')).toBe('!!')
  })
})
