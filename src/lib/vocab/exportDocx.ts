// 單字本匯出成 Word（.docx）：一張表格，欄位為單字、詞性、意思、書中例句。
// .docx 是 zip 包 XML，這裡只產生 Word 需要的最少檔案，不另外加套件
import { zipSync, strToU8 } from 'fflate'
import type { VocabEntry, VocabExample } from './model'

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const FONT = '<w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:eastAsia="Microsoft JhengHei"/>'
const HEADER_FILL = 'D8C8B5'
const BORDER_COLOR = 'A99A89'
// 表格欄寬（twips，1 cm ≈ 567）；A4 直式內文寬約 9000
const COLUMNS = [{ label: '單字', width: 1900 }, { label: '詞性', width: 900 }, { label: '意思', width: 2300 }, { label: '書中例句', width: 3900 }]

// XML 1.0 不允許的控制字元（書本文字可能夾帶）
const INVALID_XML = /[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g
const escapeXml = (s: string) =>
  s.replace(INVALID_XML, '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

interface RunStyle { bold?: boolean; italic?: boolean; color?: string; size?: number }

function run(text: string, style: RunStyle = {}): string {
  if (!text) return ''
  const props = [
    FONT,
    style.bold ? '<w:b/>' : '',
    style.italic ? '<w:i/>' : '',
    style.color ? `<w:color w:val="${style.color}"/>` : '',
    style.size ? `<w:sz w:val="${style.size}"/><w:szCs w:val="${style.size}"/>` : '',
  ].join('')
  return `<w:r><w:rPr>${props}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`
}

const paragraph = (runs: string, spacingAfter = 60) =>
  `<w:p><w:pPr><w:spacing w:after="${spacingAfter}"/></w:pPr>${runs}</w:p>`

/** 例句裡把收藏的字（不分大小寫）標成粗體 */
function sentenceRuns(example: VocabExample): string {
  const at = example.sentence.toLocaleLowerCase().indexOf(example.word.toLocaleLowerCase())
  if (at === -1) return run(example.sentence)
  const end = at + example.word.length
  return run(example.sentence.slice(0, at)) + run(example.sentence.slice(at, end), { bold: true }) + run(example.sentence.slice(end))
}

function exampleParagraphs(example: VocabExample): string {
  const gloss = [example.contextMeaning, example.bookTitle ? `《${example.bookTitle}》` : ''].filter(Boolean).join('　')
  return paragraph(sentenceRuns(example), 20) + paragraph(run(gloss, { color: '725B48', size: 18 }), 120)
}

const cell = (width: number, content: string, fill?: string) =>
  `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : ''}</w:tcPr>${content || paragraph('')}</w:tc>`

function entryRow(entry: VocabEntry): string {
  const word = paragraph(run(entry.lemma, { bold: true, size: 24 }) + (entry.cefr ? run(`  ${entry.cefr}`, { color: '725B48', size: 16 }) : ''))
  const contents = [
    word,
    paragraph(run(entry.pos)),
    paragraph(run(entry.dictMeaning)),
    entry.examples.map(exampleParagraphs).join(''),
  ]
  return `<w:tr><w:trPr><w:cantSplit/></w:trPr>${COLUMNS.map((c, i) => cell(c.width, contents[i])).join('')}</w:tr>`
}

const headerRow = () =>
  `<w:tr><w:trPr><w:tblHeader/></w:trPr>${COLUMNS.map((c) => cell(c.width, paragraph(run(c.label, { bold: true })), HEADER_FILL)).join('')}</w:tr>`

const tableBorders = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
  .map((side) => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="${BORDER_COLOR}"/>`).join('')

function documentXml(entries: VocabEntry[], title: string, subtitle: string): string {
  const table = `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${tableBorders}</w:tblBorders>`
    + '<w:tblCellMar><w:top w:w="80" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr>'
    + `<w:tblGrid>${COLUMNS.map((c) => `<w:gridCol w:w="${c.width}"/>`).join('')}</w:tblGrid>`
    + headerRow() + entries.map(entryRow).join('') + '</w:tbl>'
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + `<w:document xmlns:w="${W_NS}"><w:body>`
    + paragraph(run(title, { bold: true, size: 36 }), 80)
    + paragraph(run(subtitle, { color: '6F655B', size: 18 }), 240)
    + table
    + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr>'
    + '</w:body></w:document>'
}

const CONTENT_TYPES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
  + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
  + '<Default Extension="xml" ContentType="application/xml"/>'
  + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
  + '</Types>'

const ROOT_RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
  + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
  + '</Relationships>'

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export function buildVocabDocx(entries: VocabEntry[], { title, subtitle = '' }: { title: string; subtitle?: string }): Uint8Array {
  return zipSync({
    '[Content_Types].xml': strToU8(CONTENT_TYPES),
    '_rels/.rels': strToU8(ROOT_RELS),
    'word/document.xml': strToU8(documentXml(entries, title, subtitle)),
  })
}

const pad = (n: number) => String(n).padStart(2, '0')

export const vocabDocxFileName = (languageLabel: string, date: Date) =>
  `TapRead 單字本-${languageLabel}-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.docx`
