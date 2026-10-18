// 純文字（貼上的文章、.txt 檔）轉成 HTML，再交給 htmlBook 切章節
const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const HEADING = /^(#{1,2})\s+(.+)$/

/** 空行分段；以 # 或 ## 開頭的行當章節標題（貼長文時可以自己分章） */
export function textToHtml(text: string): string {
  const blocks = text.replace(/\r\n?/g, '\n').split(/\n\s*\n/)
  return blocks.flatMap((block) => {
    const lines = block.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim())
    const out: string[] = []
    let para: string[] = []
    const flush = () => {
      if (para.length) out.push(`<p>${para.map(escapeHtml).join('<br>')}</p>`)
      para = []
    }
    for (const line of lines) {
      const m = line.trim().match(HEADING)
      if (m) {
        flush()
        const level = m[1].length
        out.push(`<h${level}>${escapeHtml(m[2].trim())}</h${level}>`)
      } else {
        para.push(line.trim())
      }
    }
    flush()
    return out
  }).join('')
}

const MAX_TITLE = 40

export function titleFromText(text: string): string {
  const first = text.split(/\r?\n/).map((l) => l.replace(/^#+\s*/, '').trim()).find(Boolean)
  if (!first) return '貼上的文章'
  return first.length > MAX_TITLE ? `${first.slice(0, MAX_TITLE)}…` : first
}
