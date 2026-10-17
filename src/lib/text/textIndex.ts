// 區塊內文字的索引：把文字節點串成一段全文，並記錄每個節點在全文中的起點。
// <br> 與區塊元素邊界視為空格，避免 PDF 文字層相鄰兩行的字黏在一起。
const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'])
const BLOCK = /^(P|DIV|LI|BLOCKQUOTE|DD|DT|TD|TH|H[1-6]|FIGCAPTION|PRE|SECTION|ARTICLE|TR|UL|OL)$/

export interface TextIndex {
  text: string
  segments: { node: Text; start: number }[]
}

export function buildTextIndex(root: Element): TextIndex {
  const parts: string[] = []
  const segments: TextIndex['segments'] = []
  let length = 0
  let endsWithSpace = true
  // 分隔空格延後到下一段文字出現時才加，避免開頭／結尾多出空格
  let pendingSeparator = false

  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const data = (node as Text).data
      if (!data) return
      if (pendingSeparator && !endsWithSpace && !/^\s/.test(data)) {
        parts.push(' ')
        length += 1
      }
      pendingSeparator = false
      segments.push({ node: node as Text, start: length })
      parts.push(data)
      length += data.length
      endsWithSpace = /\s$/.test(data)
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const tag = (node as Element).tagName.toUpperCase()
    if (SKIP.has(tag)) return
    if (tag === 'BR') {
      pendingSeparator = true
      return
    }
    const isBlock = BLOCK.test(tag) && node !== root
    if (isBlock) pendingSeparator = true
    for (const child of Array.from(node.childNodes)) visit(child)
    if (isBlock) pendingSeparator = true
  }

  visit(root)
  return { text: parts.join(''), segments }
}

/** 文字節點內的位置 → 全文偏移 */
export function offsetOf(index: TextIndex, node: Node, nodeOffset: number): number | null {
  const seg = index.segments.find((s) => s.node === node)
  return seg ? seg.start + nodeOffset : null
}

const locate = (index: TextIndex, offset: number, preferEnd: boolean) => {
  for (const seg of index.segments) {
    const end = seg.start + seg.node.data.length
    if (offset >= seg.start && (offset < end || (preferEnd && offset === end))) {
      return { node: seg.node, offset: offset - seg.start }
    }
  }
  return null
}

/** 全文偏移 → Range；落在插入的空格上或超出範圍時回傳 null */
export function rangeFor(index: TextIndex, start: number, end: number): Range | null {
  const a = locate(index, start, false)
  const b = locate(index, end, true)
  if (!a || !b) return null
  const range = a.node.ownerDocument.createRange()
  range.setStart(a.node, a.offset)
  range.setEnd(b.node, b.offset)
  return range
}
