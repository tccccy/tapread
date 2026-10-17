// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { splitIntoSections, createHtmlBook } from '../src/lib/formats/htmlBook'
import { docxToHtml } from '../src/lib/formats/docx'

describe('splitIntoSections', () => {
  it('依 h1 切章節，標題作為章名', () => {
    const s = splitIntoSections('<h1>Uno</h1><p>a</p><h1>Dos</h1><p>b</p>')
    expect(s.map((x) => x.title)).toEqual(['Uno', 'Dos'])
    expect(s[1].html).toContain('<p>b</p>')
  })

  it('沒有 h1 時改用 h2', () => {
    expect(splitIntoSections('<h2>A</h2><p>x</p><h2>B</h2><p>y</p>').map((x) => x.title)).toEqual(['A', 'B'])
  })

  it('第一個標題前的內容自成一節（無章名）', () => {
    const s = splitIntoSections('<p>prólogo</p><h1>Uno</h1><p>a</p>')
    expect(s).toHaveLength(2)
    expect(s[0]).toMatchObject({ title: '' })
    expect(s[0].html).toContain('prólogo')
  })

  it('完全沒有標題時整份文件一節', () => {
    expect(splitIntoSections('<p>a</p><p>b</p>')).toHaveLength(1)
  })

  it('空文件仍回傳一節，避免閱讀器出錯', () => {
    expect(splitIntoSections('')).toHaveLength(1)
  })
})

describe('createHtmlBook', () => {
  const book = createHtmlBook('<h1>Uno</h1><p>a</p><h1>Dos &amp; tres</h1><p>b</p>', { title: 'Mi <doc>', language: 'es' })

  it('metadata 與目錄', () => {
    expect(book.metadata).toEqual({ title: 'Mi <doc>', language: 'es' })
    expect(book.toc.map((t) => t.label)).toEqual(['Uno', 'Dos & tres'])
  })

  it('每節可產生文件，語言與標題正確跳脫', () => {
    const doc = book.sections[1].createDocument()
    expect(doc.documentElement.lang).toBe('es')
    expect(doc.title).toBe('Mi <doc>')
    expect(doc.body.textContent).toContain('b')
  })

  it('resolveHref 指到正確章節', () => {
    expect(book.resolveHref(book.toc[1].href).index).toBe(1)
  })

  it('size 為正數（閱讀進度用）', () => {
    expect(book.sections.every((s) => s.size > 0)).toBe(true)
  })
})

describe('docxToHtml', () => {
  it('把 Word 轉成 HTML，保留標題、段落與粗體', async () => {
    const buf = readFileSync('tests/fixtures/muestra.docx')
    const html = await docxToHtml(new Blob([buf]))
    expect(html).toContain('<h1>Capítulo uno</h1>')
    expect(html).toContain('<strong>Más tarde fue al banco para sacar dinero.</strong>')
  })
})
