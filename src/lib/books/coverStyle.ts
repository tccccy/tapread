// 沒有封面的書（Word、或 EPUB 沒附封面）：依書名產生固定的布面配色
const PALETTE = [
  { background: '#8a5a3b', color: '#fbf1e4' }, // 咖啡
  { background: '#5f6f52', color: '#f3f0e2' }, // 橄欖綠
  { background: '#3f5466', color: '#eef1f2' }, // 霧藍
  { background: '#a4683f', color: '#fff4e6' }, // 焦糖
  { background: '#6b4e6e', color: '#f6eef5' }, // 梅紫
  { background: '#c9b28f', color: '#3a2a20' }, // 亞麻
  { background: '#2f3a33', color: '#e9e3d4' }, // 墨綠
  { background: '#9c4f43', color: '#fbece6' }, // 磚紅
]

const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.codePointAt(0)!) | 0, 7)

export const generatedCoverColors = (title: string) => PALETTE[Math.abs(hash(title)) % PALETTE.length]
