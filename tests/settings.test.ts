import { describe, expect, it } from 'vitest'
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from '../src/lib/settings'

const memoryStorage = () => {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  }
}

describe('settings', () => {
  it('沒有存過時回傳預設值（預設模型為 gemini-3.5-flash-lite）', () => {
    expect(loadSettings(memoryStorage())).toEqual(DEFAULT_SETTINGS)
    expect(DEFAULT_SETTINGS.geminiModel).toBe('gemini-3.5-flash-lite')
  })

  it('儲存後可讀回，並修剪空白', () => {
    const s = memoryStorage()
    saveSettings(s, { geminiApiKey: '  AIzaTest  ', geminiModel: ' gemini-3.6-flash ' })
    expect(loadSettings(s)).toEqual({ geminiApiKey: 'AIzaTest', geminiModel: 'gemini-3.6-flash' })
  })

  it('模型名稱留空時退回預設', () => {
    const s = memoryStorage()
    saveSettings(s, { geminiApiKey: 'k', geminiModel: '   ' })
    expect(loadSettings(s).geminiModel).toBe(DEFAULT_SETTINGS.geminiModel)
  })

  it('拒絕含空白或非法字元的模型名稱', () => {
    expect(() => saveSettings(memoryStorage(), { geminiApiKey: 'k', geminiModel: 'a b/../c' })).toThrow()
  })

  it('拒絕含換行、空白或非 ASCII 字元的金鑰（HTTP 標頭放不下）', () => {
    for (const bad of ['abc\ndef', 'abc def', 'ＡＩｚａ金鑰']) {
      expect(() => saveSettings(memoryStorage(), { geminiApiKey: bad, geminiModel: '' })).toThrow(/金鑰/)
    }
  })

  it('允許清空金鑰', () => {
    expect(saveSettings(memoryStorage(), { geminiApiKey: '', geminiModel: '' }).geminiApiKey).toBe('')
  })

  it('儲存內容損壞時回傳預設值', () => {
    const s = memoryStorage()
    s.setItem('polyglot-reader.settings', '{bad json')
    expect(loadSettings(s)).toEqual(DEFAULT_SETTINGS)
  })

  it('storage 無法使用（例如隱私模式丟錯）時回傳預設值', () => {
    const broken = { getItem: () => { throw new Error('denied') }, setItem: () => {}, removeItem: () => {} }
    expect(loadSettings(broken)).toEqual(DEFAULT_SETTINGS)
  })
})
