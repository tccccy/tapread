// 沒有封面的書（Word、或 EPUB 沒附封面）：依書名產生固定的布面配色
const PALETTE = [
  { background: '#725b48', color: '#f1e9dc' }, // Warm Walnut
  { background: '#5f6f52', color: '#f3f0e2' }, // 橄欖綠
  { background: '#3f5466', color: '#eef1f2' }, // 霧藍
  { background: '#a99a89', color: '#1e1a16' }, // Mushroom Taupe
  { background: '#6b4e6e', color: '#f6eef5' }, // 梅紫
  { background: '#d8c8b5', color: '#1e1a16' }, // Soft Sand
  { background: '#2f3a33', color: '#e9e3d4' }, // 墨綠
  { background: '#403329', color: '#f1e9dc' }, // Deep Mocha
]

const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.codePointAt(0)!) | 0, 7)

export const generatedCoverColors = (title: string) => PALETTE[Math.abs(hash(title)) % PALETTE.length]
