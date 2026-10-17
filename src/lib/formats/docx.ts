// Word（.docx）→ HTML；mammoth 只在需要時才載入，不拖慢首頁
type MammothInput = { arrayBuffer: ArrayBuffer; buffer: ArrayBuffer }
type Mammoth = { convertToHtml: (input: MammothInput) => Promise<{ value: string }> }

export async function docxToHtml(file: Blob): Promise<string> {
  const mod = (await import('mammoth')) as unknown as Mammoth & { default?: Mammoth }
  const mammoth = mod.default ?? mod
  const data = await file.arrayBuffer()
  // 瀏覽器版讀 arrayBuffer、Node 版（測試）讀 buffer；兩者底層都接受 ArrayBuffer
  const { value } = await mammoth.convertToHtml({ arrayBuffer: data, buffer: data })
  return value
}
