import { describe, it, expect } from 'vitest'
import { loadAppearance, saveAppearance, bookTheme } from '../src/lib/appearance'

const memoryStorage = () => {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  }
}

describe('loadAppearance / saveAppearance', () => {
  it('預設跟隨系統', () => {
    expect(loadAppearance(memoryStorage())).toBe('system')
  })

  it('存了再讀回來一樣', () => {
    const storage = memoryStorage()
    saveAppearance(storage, 'dark')
    expect(loadAppearance(storage)).toBe('dark')
  })

  it('不認得的值回到跟隨系統', () => {
    const storage = memoryStorage()
    storage.setItem('tapread.appearance', 'purple')
    expect(loadAppearance(storage)).toBe('system')
  })
})

describe('bookTheme', () => {
  it('閱讀頁指定了紙張色就照紙張色', () => {
    expect(bookTheme('sepia', 'dark')).toBe('sepia')
    expect(bookTheme('night', 'light')).toBe('night')
  })

  it('紙張「跟隨系統」時改跟 App 手動選的深淺色', () => {
    expect(bookTheme('auto', 'dark')).toBe('night')
    expect(bookTheme('auto', 'light')).toBe('paper')
  })

  it('App 也跟隨系統時維持自動', () => {
    expect(bookTheme('auto', 'system')).toBe('auto')
  })
})
