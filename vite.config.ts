import { cpSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'

// EPUB 可能夾帶 JavaScript；foliate-js 的 iframe 因 WebKit bug 必須 allow-scripts，
// 沙盒形同無效，所以必須用 CSP 擋掉 'self' 以外的所有腳本（見 vendor/foliate-js/README.md）。
// 書本 iframe 是 blob: 網址，會繼承這個頁面的 CSP。
const contentSecurityPolicy = (dev: boolean) =>
  [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' blob:",
    "img-src 'self' blob: data:",
    "font-src 'self' blob: data:",
    "media-src 'self' blob:",
    `connect-src 'self' blob: https://generativelanguage.googleapis.com${dev ? ' ws://localhost:* ws://*:*' : ''}`,
    "frame-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')

// GitHub Pages 等靜態主機無法設定 HTTP 標頭，改用 <meta>
const cspMeta = (): Plugin => {
  let dev = false
  return {
    name: 'csp-meta',
    configResolved(config) {
      dev = config.command === 'serve'
    },
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: contentSecurityPolicy(dev) },
        injectTo: 'head-prepend',
      },
    ],
  }
}

// foliate-js 的 pdf.js 需要兩處建置時修補（不改 vendor 原始檔，升級時才不會被覆蓋）：
// 1. 以 new URL(`vendor/pdfjs/${path}`, import.meta.url) 載入 worker、字型與 cmap；Vite 會把這種樣板字串
//    改寫成 import.meta.glob，打包後在瀏覽器裡無法執行 → 改成字串相加讓 Vite 不處理，再把資料夾複製過去。
// 2. 頁面重新繪製（例如視窗大小改變）時沒有清空文字層，同一頁的文字會重複疊兩份，點字時會取錯句子。
const PDFJS_PATCHES: [original: string, patched: string][] = [
  [
    'new URL(`vendor/pdfjs/${path}`, import.meta.url)',
    "new URL('vendor/pdfjs/' + path, import.meta.url)",
  ],
  [
    "const container = doc.querySelector('.textLayer')",
    "const container = doc.querySelector('.textLayer'); container.replaceChildren()",
  ],
  [
    "const div = doc.querySelector('.annotationLayer')",
    "const div = doc.querySelector('.annotationLayer'); div.replaceChildren()",
  ],
]

const patchFoliatePdf = (): Plugin => ({
  name: 'patch-foliate-pdf',
  enforce: 'pre',
  transform(code, id) {
    if (!id.endsWith('vendor/foliate-js/pdf.js')) return null
    return PDFJS_PATCHES.reduce((out, [original, patched]) => {
      // 升級 foliate-js 後若程式碼改了，直接讓建置失敗，避免默默壞掉
      if (!out.includes(original)) throw new Error(`foliate-js pdf.js 已改變，找不到：${original}；請更新 vite.config.ts`)
      return out.replace(original, patched)
    }, code)
  },
})

const PDFJS_DIR = fileURLToPath(new URL('./vendor/foliate-js/vendor/pdfjs', import.meta.url))

// 開發伺服器會把 .css 請求轉成 JS 模組，但 pdf.js 是用 fetch 讀 CSS 文字再塞進頁面，所以這幾個檔案要原樣送出
const servePdfjsCssRaw = (): Plugin => ({
  name: 'serve-pdfjs-css-raw',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const m = req.url?.match(/\/vendor\/foliate-js\/vendor\/pdfjs\/([\w-]+\.css)(\?|$)/)
      if (!m) return next()
      res.setHeader('Content-Type', 'text/css; charset=utf-8')
      res.end(readFileSync(`${PDFJS_DIR}/${m[1]}`))
    })
  },
})

const copyPdfjsAssets = (): Plugin => ({
  name: 'copy-pdfjs-assets',
  apply: 'build',
  closeBundle() {
    const from = PDFJS_DIR
    const to = fileURLToPath(new URL('./dist/assets/vendor/pdfjs', import.meta.url))
    cpSync(from, to, { recursive: true, filter: (src) => !src.endsWith('.map') })
  },
})

export default defineConfig({
  // 相對路徑，部署到 GitHub Pages 子路徑也能用
  base: './',
  plugins: [
    cspMeta(),
    patchFoliatePdf(),
    servePdfjsCssRaw(),
    copyPdfjsAssets(),
    svelte(),
    VitePWA({
      // 有新版本時先詢問（UpdateBanner），不在使用者閱讀時突然換版
      registerType: 'prompt',
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: '多語閱讀器',
        short_name: '閱讀器',
        description: '讀外文書時點詞即得上下文釋義，書檔只存在你的裝置',
        lang: 'zh-Hant-TW',
        theme_color: '#2f5d50',
        background_color: '#f7f5f0',
        display: 'standalone',
        start_url: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // foliate-js 的 PDF.js 很大，P4 之前不預先快取
        globIgnores: ['**/pdf*.js', '**/pdfjs/**'],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
