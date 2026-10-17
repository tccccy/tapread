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

export default defineConfig({
  // 相對路徑，部署到 GitHub Pages 子路徑也能用
  base: './',
  plugins: [
    cspMeta(),
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
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
