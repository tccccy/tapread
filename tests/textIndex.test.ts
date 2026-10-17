// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { buildTextIndex, offsetOf, rangeFor } from '../src/lib/text/textIndex'

const block = (html: string) => {
  const div = document.createElement('div')
  div.innerHTML = html
  document.body.replaceChildren(div)
  return div
}
const textNodes = (el: Element) => {
  const out: Text[] = []
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  for (let n = w.nextNode(); n; n = w.nextNode()) out.push(n as Text)
  return out
}

describe('buildTextIndex', () => {
  it('一般段落：等同文字內容', () => {
    expect(buildTextIndex(block('María <em>abrió</em> la ventana.')).text).toBe('María abrió la ventana.')
  })

  it('<br> 換行視為空格（PDF 文字層的行與行之間）', () => {
    const el = block('<span>Fue al</span><br><span>banco ayer.</span>')
    expect(buildTextIndex(el).text).toBe('Fue al banco ayer.')
  })

  it('換行前已有空白時不重複加空格', () => {
    expect(buildTextIndex(block('<span>Fue al </span><br><span>banco.</span>')).text).toBe('Fue al banco.')
  })

  it('區塊元素之間也加空格', () => {
    expect(buildTextIndex(block('<p>Uno.</p><p>Dos.</p>')).text).toBe('Uno. Dos.')
  })

  it('略過 script 與 style', () => {
    expect(buildTextIndex(block('Hola<style>p{}</style> mundo<script>x()</script>')).text).toBe('Hola mundo')
  })
})

describe('offsetOf / rangeFor', () => {
  it('節點位置 ↔ 全文偏移可互相轉換（跨越 <br> 插入的空格）', () => {
    const el = block('<span>Fue al</span><br><span>banco ayer.</span>')
    const index = buildTextIndex(el)
    const second = textNodes(el)[1]
    const offset = offsetOf(index, second, 0)
    expect(offset).toBe(index.text.indexOf('banco'))
    const range = rangeFor(index, offset!, offset! + 5)
    expect(range?.toString()).toBe('banco')
  })

  it('跨節點的範圍', () => {
    const el = block('ab<b>cd</b>ef')
    const index = buildTextIndex(el)
    expect(rangeFor(index, 1, 5)?.toString()).toBe('bcde')
  })

  it('不在索引內的節點回傳 null', () => {
    const el = block('hola')
    const other = document.createTextNode('x')
    expect(offsetOf(buildTextIndex(el), other, 0)).toBeNull()
  })

  it('超出範圍回傳 null', () => {
    const index = buildTextIndex(block('hola'))
    expect(rangeFor(index, 2, 99)).toBeNull()
  })
})
