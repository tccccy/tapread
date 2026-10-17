// 把一份 HTML（例如 Word 轉出來的）包成 foliate-js 能開的「書」：依標題切章節、建目錄
export interface HtmlSection {
  title: string
  html: string
}

export interface HtmlBook {
  metadata: { title: string; language: string }
  dir: 'ltr'
  sections: {
    id: number
    load: () => string
    unload: () => void
    createDocument: () => Document
    size: number
    linear: 'yes'
  }[]
  toc: { label: string; href: string }[]
  resolveHref: (href: string) => { index: number }
  splitTOCHref: (href: string) => number[]
  getTOCFragment: (doc: Document) => Element | null
  isExternal: (uri: string) => boolean
  destroy: () => void
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function splitIntoSections(html: string): HtmlSection[] {
  const body = new DOMParser().parseFromString(html, 'text/html').body
  const level = body.querySelector(':scope > h1') ? 'H1' : body.querySelector(':scope > h2') ? 'H2' : null
  const sections: HtmlSection[] = []
  let current: { title: string; parts: string[] } = { title: '', parts: [] }

  const flush = () => {
    if (current.parts.length > 0) sections.push({ title: current.title, html: current.parts.join('') })
  }

  for (const node of Array.from(body.childNodes)) {
    const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : null
    if (el && el.tagName === level) {
      flush()
      current = { title: (el.textContent ?? '').trim(), parts: [] }
    }
    const markup = el ? el.outerHTML : escapeHtml(node.textContent ?? '')
    if (markup.trim()) current.parts.push(markup)
  }
  flush()
  return sections.length > 0 ? sections : [{ title: '', html: '<p></p>' }]
}

export function createHtmlBook(html: string, { title, language }: { title: string; language: string }): HtmlBook {
  const sections = splitIntoSections(html)
  const urls = new Map<number, string>()

  const page = (s: HtmlSection) =>
    `<!DOCTYPE html><html lang="${escapeHtml(language)}"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body>${s.html}</body></html>`

  return {
    metadata: { title, language },
    dir: 'ltr',
    sections: sections.map((s, index) => {
      const markup = page(s)
      return {
        id: index,
        load: () => {
          const existing = urls.get(index)
          if (existing) return existing
          const url = URL.createObjectURL(new Blob([markup], { type: 'text/html' }))
          urls.set(index, url)
          return url
        },
        unload: () => {
          const url = urls.get(index)
          if (url) URL.revokeObjectURL(url)
          urls.delete(index)
        },
        createDocument: () => new DOMParser().parseFromString(markup, 'text/html'),
        size: markup.length,
        linear: 'yes' as const,
      }
    }),
    toc: sections
      .map((s, index) => ({ label: s.title, href: String(index) }))
      .filter((item) => item.label),
    resolveHref: (href) => ({ index: Number(href.split('#')[0]) || 0 }),
    splitTOCHref: (href) => [Number(href?.split('#')[0]) || 0],
    getTOCFragment: (doc) => doc.body,
    isExternal: (uri) => /^\w+:/i.test(uri),
    destroy: () => {
      for (const url of urls.values()) URL.revokeObjectURL(url)
      urls.clear()
    },
  }
}
