import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // 相對路徑，部署到 GitHub Pages 子路徑也能用
  base: './',
  plugins: [
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
