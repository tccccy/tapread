<script lang="ts">
  import type { ImportSummary } from '../lib/backup/backup'
  import { db } from '../lib/db'
  import { saveFile, isShareCancel } from '../lib/saveFile'

  let busy = $state<'export' | 'import' | null>(null)
  let message = $state('')
  let error = $state('')
  let fileInput: HTMLInputElement

  // 備份程式與 fflate 只在用到時才載入
  const loadBackup = () => import('../lib/backup/backup')

  const today = () => new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD
  const formatSize = (bytes: number) =>
    bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

  async function exportTo(includeBooks: boolean) {
    busy = 'export'
    message = ''
    error = ''
    try {
      const { exportBackup } = await loadBackup()
      const data = await exportBackup(db, { includeBooks })
      const name = `tapread-${includeBooks ? '完整' : '單字與進度'}-${today()}.zip`
      const file = new File([data as Uint8Array<ArrayBuffer>], name, { type: 'application/zip' })
      await saveFile(file, 'TapRead 備份')
      message = `已匯出 ${name}（${formatSize(file.size)}）。`
    } catch (e) {
      // 使用者在分享選單按取消，不算錯誤
      if (isShareCancel(e)) return
      console.error('匯出失敗', e)
      error = '匯出失敗，請再試一次。'
    } finally {
      busy = null
    }
  }

  const describe = (s: ImportSummary) =>
    [
      s.booksAdded && `新增 ${s.booksAdded} 本書`,
      s.booksUpdated && `更新 ${s.booksUpdated} 本書的閱讀進度`,
      s.wordsAdded && `新增 ${s.wordsAdded} 個單字`,
      s.wordsMerged && `合併 ${s.wordsMerged} 個已有的單字`,
      s.booksSkipped && `${s.booksSkipped} 本書因備份不含書檔而略過（單字照樣匯入）`,
      s.invalid && `${s.invalid} 筆資料格式不正確已略過`,
    ].filter(Boolean).join('、') || '沒有需要更新的內容'

  async function onPick(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    busy = 'import'
    message = ''
    error = ''
    try {
      const { importBackup } = await loadBackup()
      const { BackupFormatError } = await import('../lib/backup/merge')
      try {
        const summary = await importBackup(db, new Uint8Array(await file.arrayBuffer()))
        message = `匯入完成：${describe(summary)}。`
      } catch (err) {
        if (err instanceof BackupFormatError) error = err.message
        else throw err
      }
    } catch (err) {
      console.error('匯入失敗', err)
      error = (err as { name?: string })?.name === 'QuotaExceededError'
        ? '裝置儲存空間不足，請改用「只有單字與進度」的備份。'
        : '匯入失敗，請再試一次。'
    } finally {
      busy = null
    }
  }
</script>

<section>
  <h2>備份與同步</h2>
  <p class="muted">
    把書、閱讀進度與單字本匯出成一個檔案，到另一台裝置（電腦、平板、手機）匯入即可接續。
    重複匯入不會產生重複資料；同一本書以檔案內容辨識，熟練度與進度採用較新的一邊。
    備份<strong>不含</strong> API 金鑰，每台裝置要各自設定。
  </p>
  <div class="buttons">
    <button class="primary" disabled={busy !== null} onclick={() => exportTo(true)}>
      {busy === 'export' ? '匯出中…' : '匯出（含書檔）'}
    </button>
    <button disabled={busy !== null} onclick={() => exportTo(false)}>匯出（只有單字與進度）</button>
    <input bind:this={fileInput} type="file" hidden onchange={onPick} />
    <button disabled={busy !== null} onclick={() => fileInput.click()}>
      {busy === 'import' ? '匯入中…' : '匯入備份檔'}
    </button>
  </div>
  <p class="muted small">「只有單字與進度」檔案很小，適合常常同步；另一台裝置已經有同一本書時，進度與單字會自動對上。</p>
  {#if message}<p class="ok" role="status">{message}</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</section>

<style>
  section { margin-top: 24px; }
  h2 { font-size: 1rem; margin: 0 0 6px; }
  .buttons { display: flex; flex-wrap: wrap; gap: 8px; }
  .muted { color: var(--muted); font-size: 0.9rem; line-height: 1.5; margin: 0 0 8px; }
  .small { font-size: 0.8rem; margin-top: 8px; }
  .ok { color: var(--accent-ink); }
  .error { color: var(--danger); }
</style>
