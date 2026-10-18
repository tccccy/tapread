// 依格式把檔案轉成 foliate-js 能開的書：EPUB／PDF 交給 foliate，Word 先轉 HTML
import { makeBook, type FoliateBook } from './foliate'
import { docxToHtml } from './formats/docx'
import { createHtmlBook } from './formats/htmlBook'
import { textToHtml } from './formats/textBook'
import type { BookFormat } from './bookFile'

export type OpenableBook = FoliateBook & { destroy?: () => void }

export async function loadBook(
  file: Blob,
  format: BookFormat,
  fallback: { fileName: string; title: string; language: string },
): Promise<OpenableBook> {
  if (format === 'docx' || format === 'txt') {
    const html = format === 'docx' ? await docxToHtml(file) : textToHtml(await file.text())
    return createHtmlBook(html, { title: fallback.title, language: fallback.language }) as unknown as OpenableBook
  }
  // foliate 依檔頭判斷 EPUB／PDF；從 IndexedDB 取回的可能只是 Blob，補上檔名
  const named = file instanceof File ? file : new File([file], fallback.fileName)
  return makeBook(named)
}
