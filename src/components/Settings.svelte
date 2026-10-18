<script lang="ts">
  import { loadSettings, saveSettings, validateSettings, SettingsValidationError } from '../lib/settings'
  import { languageLabel, COMMON_LANGUAGES } from '../lib/languageName'
  import { testGeminiKey, aiErrorMessage, AiError } from '../lib/ai/gemini'
  import BackupSection from './BackupSection.svelte'
  import StorageSection from './StorageSection.svelte'
  import { loadLastBackup } from '../lib/backup/reminder'
  import { loadAppearance, saveAppearance, applyAppearance, type Appearance } from '../lib/appearance'

  const APPEARANCES: { id: Appearance; label: string }[] = [
    { id: 'system', label: '跟隨系統' },
    { id: 'light', label: '淺色' },
    { id: 'dark', label: '深色' },
  ]
  let appearance = $state<Appearance>(loadAppearance(localStorage))
  let lastBackupAt = $state<number | null>(loadLastBackup(localStorage))

  // 外觀點了就生效，不用按「儲存」
  function chooseAppearance(next: Appearance) {
    appearance = next
    saveAppearance(localStorage, next)
    applyAppearance(next)
  }

  const AI_STUDIO_KEY_URL = 'https://aistudio.google.com/apikey'

  // 已經在設定頁，不需要再叫使用者「到設定」
  const TEST_MESSAGES: Partial<Record<string, string>> = {
    auth: 'Google 回覆這把金鑰無效。請確認有完整複製（以 AIza 開頭），或回 AI Studio 重新建立一把。',
    model: '金鑰沒問題，但找不到這個模型名稱。清空「模型」欄位會改回預設值。',
  }

  /** 從閱讀頁進來時才有返回鍵；從分頁列進來就不需要 */
  let { onBack }: { onBack?: () => void } = $props()

  const initial = loadSettings(localStorage)
  let apiKey = $state(initial.geminiApiKey)
  let model = $state(initial.geminiModel)
  let defaultLanguage = $state(initial.defaultLanguage)
  let showKey = $state(false)
  let message = $state('')
  let error = $state('')
  let testing = $state(false)

  // 先確認 Gemini 接受這把金鑰（查詢模型資訊，不消耗額度），成功才儲存
  async function testAndSave() {
    message = ''
    error = ''
    testing = true
    try {
      // 先驗證格式，避免把格式錯誤的金鑰送出去
      const candidate = validateSettings({ geminiApiKey: apiKey, geminiModel: model, defaultLanguage })
      const { displayName } = await testGeminiKey({ apiKey: candidate.geminiApiKey, model: candidate.geminiModel })
      const saved = saveSettings(localStorage, candidate)
      apiKey = saved.geminiApiKey
      model = saved.geminiModel
      message = `✓ 金鑰可以使用（${displayName}），已儲存。`
    } catch (err) {
      error = err instanceof SettingsValidationError
        ? err.message
        : (err instanceof AiError && TEST_MESSAGES[err.kind]) || aiErrorMessage(err)
      if (!(err instanceof SettingsValidationError)) console.warn('測試金鑰失敗', err)
    } finally {
      testing = false
    }
  }

  function save(e: SubmitEvent) {
    e.preventDefault()
    message = ''
    error = ''
    try {
      const saved = saveSettings(localStorage, { geminiApiKey: apiKey, geminiModel: model, defaultLanguage })
      apiKey = saved.geminiApiKey
      model = saved.geminiModel
      defaultLanguage = saved.defaultLanguage
      message = '已儲存。'
    } catch (err) {
      if (err instanceof SettingsValidationError) {
        error = err.message
      } else {
        console.error('儲存設定失敗', err)
        error = '儲存失敗，瀏覽器可能封鎖了本機儲存。'
      }
    }
  }
</script>

<main>
  <header>
    {#if onBack}<button onclick={onBack}>← 返回閱讀</button>{/if}
    <h1>設定</h1>
  </header>

  <section class="appearance">
    <h2>外觀</h2>
    <div class="segmented" role="radiogroup" aria-label="外觀">
      {#each APPEARANCES as a (a.id)}
        <button type="button" role="radio" aria-checked={appearance === a.id} class:selected={appearance === a.id}
          onclick={() => chooseAppearance(a.id)}>{a.label}</button>
      {/each}
    </div>
    <p class="muted">跟隨系統：白天米白、晚上深咖啡。</p>
  </section>

  <form onsubmit={save}>
    <section>
      <h2>Gemini API 金鑰</h2>
      <ol class="steps">
        <li>打開 <a href={AI_STUDIO_KEY_URL} target="_blank" rel="noopener noreferrer">Google AI Studio 金鑰頁面</a>，用 Google 帳號登入</li>
        <li>按「Create API key」（建立 API 金鑰），複製那串以 <code>AIza</code> 開頭的文字</li>
        <li>貼到下面，按「測試並儲存」</li>
      </ol>
      <p class="muted">免費申請。金鑰只存在這台裝置的瀏覽器，不會傳給 Gemini 以外的地方。免費方案送出的內容可能被 Google 用來改善產品。</p>
      <div class="row">
        <input
          type={showKey ? 'text' : 'password'}
          bind:value={apiKey}
          disabled={testing}
          placeholder="貼上 API 金鑰"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          aria-label="Gemini API 金鑰"
        />
        <button type="button" onclick={() => (showKey = !showKey)}>{showKey ? '隱藏' : '顯示'}</button>
      </div>
      <button type="button" class="primary test" disabled={testing || !apiKey.trim()} onclick={testAndSave}>
        {testing ? '測試中…' : '測試並儲存'}
      </button>
    </section>

    <section>
      <h2>模型</h2>
      <p class="muted">預設 gemini-3.5-flash-lite（便宜、快）。想要更細的解釋可改成 gemini-3.6-flash。</p>
      <input bind:value={model} disabled={testing} autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="模型名稱" />
    </section>

    <section>
      <h2>預設學習語言</h2>
      <p class="muted">PDF 與 Word 檔通常沒有標註語言，匯入時會用這個設定。影響單字本的語言分類與書中的斷字。</p>
      <select bind:value={defaultLanguage} aria-label="預設學習語言">
        <option value="">交給 AI 判斷</option>
        {#each COMMON_LANGUAGES as code (code)}
          <option value={code}>{languageLabel(code)}</option>
        {/each}
      </select>
    </section>

    <section class="privacy">
      <h2>會送出什麼</h2>
      <p class="muted">點一個字時，只會把「這個字、所在句子與前後各一句、書名」送給 Gemini。整本書不會上傳。</p>
    </section>

    <div class="actions">
      <button class="primary" type="submit">儲存</button>
      {#if message}<span class="ok" role="status">{message}</span>{/if}
      {#if error}<span class="error" role="alert">{error}</span>{/if}
    </div>
  </form>

  <StorageSection {lastBackupAt} onBackupNow={() => document.getElementById('backup')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
  <BackupSection onExported={() => (lastBackupAt = loadLastBackup(localStorage))} />
</main>

<style>
  main { max-width: 640px; margin: 0 auto; padding: max(16px, env(safe-area-inset-top)) 16px 32px; }
  header { display: flex; align-items: center; gap: 12px; }
  h1 { font-size: 1.5rem; margin: 0.5rem 0; }
  h2 { font-size: 1rem; margin: 0 0 6px; }
  .appearance { margin-top: 16px; }
  .segmented { display: flex; max-width: 360px; background: var(--accent-soft); border-radius: 999px; padding: 3px; }
  .segmented button { flex: 1; min-height: 40px; padding: 0.3rem 0; border: none; background: none; }
  .segmented .selected { background: var(--surface-solid); box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12); font-weight: 600; }
  section { margin-top: 24px; }
  .row { display: flex; gap: 8px; }
  input {
    flex: 1;
    width: 100%;
    min-height: 44px;
    font: inherit;
    font-size: 16px; /* 16px 以上 iOS 才不會自動放大 */
    color: var(--text);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0 12px;
  }
  select {
    width: 100%; min-height: 44px; font: inherit; font-size: 16px; color: var(--text);
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 0 10px;
  }
  .steps { margin: 0 0 8px; padding-left: 22px; line-height: 1.7; }
  .steps code { font-size: 0.9em; background: var(--surface); border: 1px solid var(--border); border-radius: 4px; padding: 0 4px; }
  .test { margin-top: 10px; width: 100%; }
  .muted { color: var(--muted); font-size: 0.9rem; line-height: 1.5; margin: 0 0 8px; }
  a { color: var(--accent-ink); }
  .actions { margin-top: 24px; display: flex; align-items: center; gap: 12px; }
  .ok { color: var(--accent-ink); }
  .error { color: var(--danger); }
</style>
