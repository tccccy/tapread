// App 外觀：跟隨系統／淺色／深色。手動選的值寫在 <html data-theme>，app.css 依此切換色彩
import type { ThemeId } from './reading/prefs'

export type Appearance = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'tapread.appearance'
const VALUES: Appearance[] = ['system', 'light', 'dark']
// 瀏覽器頂列顏色（與 app.css 的 --bg 一致）
const BAR_COLOR = { light: '#f1e9dc', dark: '#2a231e' }

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>

export function loadAppearance(storage: KeyValueStorage): Appearance {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    return VALUES.includes(raw as Appearance) ? (raw as Appearance) : 'system'
  } catch (e) {
    console.warn('讀取外觀設定失敗，改為跟隨系統', e)
    return 'system'
  }
}

export function saveAppearance(storage: KeyValueStorage, appearance: Appearance): void {
  try {
    storage.setItem(STORAGE_KEY, appearance)
  } catch (e) {
    // 存不了（例如私密瀏覽）：這次仍套用，只是下次不會記得
    console.warn('儲存外觀設定失敗', e)
  }
}

/** 套用到整個 App；跟隨系統時移除 data-theme，交給 prefers-color-scheme */
export function applyAppearance(appearance: Appearance): void {
  const root = document.documentElement
  if (appearance === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', appearance)
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const scheme = meta.media.includes('dark') ? 'dark' : 'light'
    meta.content = BAR_COLOR[appearance === 'system' ? scheme : appearance]
  }
}

/** 書本內文的紙張色：閱讀頁的「跟隨系統」改跟 App 手動選的深淺色 */
export function bookTheme(reading: ThemeId, appearance: Appearance): ThemeId {
  if (reading !== 'auto' || appearance === 'system') return reading
  return appearance === 'dark' ? 'night' : 'paper'
}
