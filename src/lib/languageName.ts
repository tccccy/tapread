/** 常見的學習語言（設定頁與書庫的語言選單共用） */
export const COMMON_LANGUAGES = ['en', 'es', 'pt', 'it', 'fr', 'de', 'nl', 'ru', 'ja', 'ko'] as const

export function languageLabel(code: string): string {
  if (!code) return '未指定語言'
  try {
    return new Intl.DisplayNames(['zh-Hant'], { type: 'language' }).of(code) ?? code
  } catch {
    return code
  }
}
