// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { textToHtml, titleFromText } from '../src/lib/formats/textBook'
import { bookFormat, checkBookFile } from '../src/lib/bookFile'

describe('textToHtml', () => {
  it('空行分段，段內換行保留', () => {
    expect(textToHtml('Hola.\nAdiós.\n\nOtro párrafo.')).toBe('<p>Hola.<br>Adiós.</p><p>Otro párrafo.</p>')
  })

  it('跳脫 HTML，貼上的文字不會變成標籤或腳本', () => {
    expect(textToHtml('<script>alert(1)</script> & "x"')).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;</p>')
  })

  it('# 開頭的行當成章節標題', () => {
    expect(textToHtml('# Capítulo 1\nTexto.\n\n## Parte\nMás.')).toBe('<h1>Capítulo 1</h1><p>Texto.</p><h2>Parte</h2><p>Más.</p>')
  })

  it('Windows 換行與多餘空行都能處理', () => {
    expect(textToHtml('a\r\n\r\n\r\nb  ')).toBe('<p>a</p><p>b</p>')
  })
})

describe('titleFromText', () => {
  it('用第一行當標題（去掉 # 並截短）', () => {
    expect(titleFromText('# El viaje\nTexto')).toBe('El viaje')
    expect(titleFromText('x'.repeat(100))).toBe(`${'x'.repeat(40)}…`)
  })

  it('沒有內容時給預設標題', () => {
    expect(titleFromText('   ')).toBe('貼上的文章')
  })
})

describe('.txt 檔', () => {
  it('認得副檔名，檔案檢查通過', async () => {
    expect(bookFormat('nota.TXT')).toBe('txt')
    expect(await checkBookFile(new File(['hola'], 'nota.txt'))).toEqual({ ok: true })
  })
})
