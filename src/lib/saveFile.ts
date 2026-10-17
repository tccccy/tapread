// 把 App 產生的檔案交給使用者：平板、手機用系統分享選單（可 AirDrop、存到「檔案」）；電腦直接下載

const preferShare = (file: File) =>
  matchMedia('(pointer: coarse)').matches && !!navigator.canShare?.({ files: [file] })

function download(file: File) {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** 使用者在分享選單按取消時會丟 AbortError，呼叫端可視為非錯誤 */
export async function saveFile(file: File, title: string): Promise<void> {
  if (!preferShare(file)) return download(file)
  try {
    await navigator.share({ files: [file], title })
  } catch (e) {
    // iOS：產生檔案太久會失去「使用者剛點過」的狀態，分享被拒；改直接下載
    if (e instanceof DOMException && e.name === 'NotAllowedError') download(file)
    else throw e
  }
}

export const isShareCancel = (e: unknown) => e instanceof DOMException && e.name === 'AbortError'
