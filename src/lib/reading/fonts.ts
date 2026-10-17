// 網頁字型：打包在 App 內（不連 Google），選到才載入；中文字型依 unicode-range 切片，只下載用到的字
import type { WebFamily } from './prefs'

// 只載入閱讀需要的字重；西文另含斜體
const LOADERS: Record<WebFamily, () => Promise<unknown>[]> = {
  'Literata': () => [
    import('@fontsource/literata/400.css'),
    import('@fontsource/literata/400-italic.css'),
    import('@fontsource/literata/700.css'),
  ],
  'Noto Serif TC': () => [
    import('@fontsource/noto-serif-tc/400.css'),
    import('@fontsource/noto-serif-tc/700.css'),
  ],
  'LXGW WenKai TC': () => [
    import('@fontsource/lxgw-wenkai-tc/400.css'),
    import('@fontsource/lxgw-wenkai-tc/700.css'),
  ],
  'EB Garamond': () => [
    import('@fontsource/eb-garamond/400.css'),
    import('@fontsource/eb-garamond/400-italic.css'),
    import('@fontsource/eb-garamond/700.css'),
  ],
}

const loading = new Map<WebFamily, Promise<void>>()

/** 把字型宣告載入主頁面（之後才讀得到 @font-face 規則） */
export function loadWebFonts(families: WebFamily[]): Promise<void> {
  return Promise.all(families.map((family) => {
    let p = loading.get(family)
    if (!p) {
      p = Promise.all(LOADERS[family]()).then(() => undefined)
      // 失敗（例如離線且沒快取）時下次可以重試
      p.catch(() => loading.delete(family))
      loading.set(family, p)
    }
    return p
  })).then(() => undefined)
}

const URL_IN_CSS = /url\((['"]?)([^'")]+)\1\)/g
const unquote = (s: string) => s.trim().replace(/^['"]|['"]$/g, '')

/**
 * 取出主頁面裡指定字型的 @font-face，網址改成絕對路徑，給書本 iframe 用。
 * 書本 iframe 是 blob: 網址，相對路徑在那裡解析不到。
 */
export function fontFaceCss(families: WebFamily[]): string {
  if (families.length === 0) return ''
  const wanted = new Set<string>(families)
  const out: string[] = []
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      continue // 跨來源的樣式表讀不到，本來就不會有我們的字型
    }
    const base = sheet.href ?? document.baseURI
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSFontFaceRule)) continue
      if (!wanted.has(unquote(rule.style.getPropertyValue('font-family')))) continue
      out.push(rule.cssText.replace(URL_IN_CSS, (_, _q, url: string) => `url("${new URL(url, base).href}")`))
    }
  }
  return out.join('\n')
}
