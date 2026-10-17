export function languageLabel(code: string): string {
  if (!code) return '未指定語言'
  try {
    return new Intl.DisplayNames(['zh-Hant'], { type: 'language' }).of(code) ?? code
  } catch {
    return code
  }
}
