// 書本目錄（foliate 的 book.toc，可能巢狀）攤平成一層清單給目錄面板用

export interface RawTocItem {
  label?: string
  href?: string
  subitems?: RawTocItem[] | null
}

export interface TocEntry {
  label: string
  href: string
  depth: number
}

// 太深的目錄（例如每一小節都列）在手機上不好讀，最多顯示三層
const MAX_DEPTH = 2

export function flattenToc(items: RawTocItem[] | undefined | null, depth = 0): TocEntry[] {
  if (!items) return []
  return items.flatMap((item) => {
    const label = (item.label ?? '').replace(/\s+/g, ' ').trim()
    const self = label && item.href ? [{ label, href: item.href, depth }] : []
    const children = depth < MAX_DEPTH ? flattenToc(item.subitems, depth + 1) : []
    return [...self, ...children]
  })
}
