export interface Settings {
  geminiApiKey: string
  geminiModel: string
  /** 檔案沒有標註語言時（PDF、Word 常見）使用；空字串代表交給 AI 判斷 */
  defaultLanguage: string
}

export const DEFAULT_SETTINGS: Settings = {
  geminiApiKey: '',
  geminiModel: 'gemini-3.5-flash-lite',
  defaultLanguage: '',
}

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export class SettingsValidationError extends Error {
  name = 'SettingsValidationError'
}

const STORAGE_KEY = 'polyglot-reader.settings'
const MODEL_NAME = /^[a-z0-9][a-z0-9.\-]*$/i
// 金鑰要放進 HTTP 標頭：只允許可見 ASCII
const API_KEY = /^[\x21-\x7e]*$/
const LANGUAGE_CODE = /^([a-z]{2,3})?$/

const normalize = (raw: Partial<Settings>): Settings => ({
  geminiApiKey: typeof raw.geminiApiKey === 'string' ? raw.geminiApiKey.trim() : '',
  geminiModel: (typeof raw.geminiModel === 'string' && raw.geminiModel.trim()) || DEFAULT_SETTINGS.geminiModel,
  defaultLanguage: typeof raw.defaultLanguage === 'string' ? raw.defaultLanguage.trim().toLowerCase() : '',
})

export function loadSettings(storage: KeyValueStorage): Settings {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? normalize(parsed) : DEFAULT_SETTINGS
  } catch (e) {
    console.warn('讀取設定失敗，使用預設值', e)
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(storage: KeyValueStorage, settings: Settings): Settings {
  const next = normalize(settings)
  if (!API_KEY.test(next.geminiApiKey)) throw new SettingsValidationError('金鑰格式不正確：不能含空白、換行或全形字元。')
  if (!MODEL_NAME.test(next.geminiModel)) throw new SettingsValidationError('模型名稱只能包含英數字、點與連字號。')
  if (!LANGUAGE_CODE.test(next.defaultLanguage)) throw new SettingsValidationError('預設學習語言的代碼不正確。')
  storage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}
