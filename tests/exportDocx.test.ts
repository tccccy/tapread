import { describe, it, expect } from 'vitest'
import { unzipSync, strFromU8 } from 'fflate'
import { buildVocabDocx, vocabDocxFileName } from '../src/lib/vocab/exportDocx'
import type { VocabEntry } from '../src/lib/vocab/model'

const entry = (over: Partial<VocabEntry> = {}): VocabEntry => ({
  id: 'es|banco',
  language: 'es',
  lemma: 'banco',
  pos: '名詞',
  dictMeaning: '銀行；長椅',
  forms: ['banco'],
  bookIds: [1],
  examples: [{
    word: 'banco',
    sentence: 'Lucía miró el banco del parque.',
    contextMeaning: '長椅',
    note: '',
    bookId: 1,
    bookTitle: 'Mi cuento',
    savedAt: 0,
  }],
  level: 1,
  dueAt: 0,
  createdAt: 0,
  updatedAt: 0,
  ...over,
})

const documentXml = (bytes: Uint8Array) => strFromU8(unzipSync(bytes)['word/document.xml'])

describe('buildVocabDocx', () => {
  it('是 Word 能開的 zip：含必要檔案', () => {
    const files = unzipSync(buildVocabDocx([entry()], { title: '西班牙文單字本' }))
    expect(Object.keys(files)).toEqual(expect.arrayContaining(['[Content_Types].xml', '_rels/.rels', 'word/document.xml']))
  })

  it('包含單字、詞性、意思、書中例句與書名', () => {
    const xml = documentXml(buildVocabDocx([entry()], { title: '西班牙文單字本' }))
    for (const text of ['西班牙文單字本', 'banco', '名詞', '銀行；長椅', '長椅', 'Mi cuento', 'del parque.']) {
      expect(xml).toContain(text)
    }
  })

  it('例句中的單字以粗體標出', () => {
    const xml = documentXml(buildVocabDocx([entry()], { title: 't' }))
    expect(xml).toMatch(/<w:b\/>[\s\S]*?<w:t xml:space="preserve">banco<\/w:t>/)
  })

  it('跳脫 XML 特殊字元並移除控制字元', () => {
    const xml = documentXml(buildVocabDocx([entry({ dictMeaning: 'a < b & "c"\u0001' })], { title: 't' }))
    expect(xml).toContain('a &lt; b &amp; &quot;c&quot;')
    expect(xml).not.toContain('\u0001')
  })

  it('同一個字有多個例句時全部列出', () => {
    const e = entry()
    const two = entry({ examples: [...e.examples, { ...e.examples[0], sentence: 'Fue al banco.', contextMeaning: '銀行' }] })
    const xml = documentXml(buildVocabDocx([two], { title: 't' }))
    expect(xml).toContain('Fue al ')
    expect(xml).toContain('銀行')
  })
})

describe('vocabDocxFileName', () => {
  it('含語言與日期', () => {
    expect(vocabDocxFileName('西班牙文', new Date(2026, 9, 18))).toBe('TapRead 單字本-西班牙文-2026-10-18.docx')
  })
})
