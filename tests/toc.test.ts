import { describe, it, expect } from 'vitest'
import { flattenToc } from '../src/lib/reading/toc'

describe('flattenToc', () => {
  it('巢狀目錄攤平並記錄層級', () => {
    const toc = [
      { label: '第一部', href: 'a.html', subitems: [{ label: '第一章', href: 'a.html#1' }, { label: '第二章', href: 'a.html#2' }] },
      { label: '後記', href: 'b.html' },
    ]
    expect(flattenToc(toc)).toEqual([
      { label: '第一部', href: 'a.html', depth: 0 },
      { label: '第一章', href: 'a.html#1', depth: 1 },
      { label: '第二章', href: 'a.html#2', depth: 1 },
      { label: '後記', href: 'b.html', depth: 0 },
    ])
  })

  it('去掉空白標題與沒有連結的項目、整理多餘空白', () => {
    expect(flattenToc([{ label: '  Capítulo\n uno ', href: 'c.html' }, { label: '', href: 'd.html' }, { label: 'x' }])).toEqual([
      { label: 'Capítulo uno', href: 'c.html', depth: 0 },
    ])
  })

  it('沒有目錄時回傳空陣列', () => {
    expect(flattenToc(undefined)).toEqual([])
  })
})
