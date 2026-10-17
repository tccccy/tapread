<script lang="ts">
  import { loadSettings, saveSettings, SettingsValidationError } from '../lib/settings'
  import { languageLabel, COMMON_LANGUAGES } from '../lib/languageName'

  let { onBack }: { onBack: () => void } = $props()

  const initial = loadSettings(localStorage)
  let apiKey = $state(initial.geminiApiKey)
  let model = $state(initial.geminiModel)
  let defaultLanguage = $state(initial.defaultLanguage)
  let showKey = $state(false)
  let message = $state('')
  let error = $state('')

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
    <button onclick={onBack}>← 書庫</button>
    <h1>設定</h1>
  </header>

  <form onsubmit={save}>
    <section>
      <h2>Gemini API 金鑰</h2>
      <p class="muted">
        到 <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a>
        免費申請。金鑰只存在這台裝置的瀏覽器，不會傳給 Gemini 以外的地方。
      </p>
      <div class="row">
        <input
          type={showKey ? 'text' : 'password'}
          bind:value={apiKey}
          placeholder="貼上 API 金鑰"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          aria-label="Gemini API 金鑰"
        />
        <button type="button" onclick={() => (showKey = !showKey)}>{showKey ? '隱藏' : '顯示'}</button>
      </div>
    </section>

    <section>
      <h2>模型</h2>
      <p class="muted">預設 gemini-3.5-flash-lite（便宜、快）。想要更細的解釋可改成 gemini-3.6-flash。</p>
      <input bind:value={model} autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="模型名稱" />
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
</main>

<style>
  main { max-width: 640px; margin: 0 auto; padding: max(16px, env(safe-area-inset-top)) 16px 32px; }
  header { display: flex; align-items: center; gap: 12px; }
  h1 { font-size: 1.5rem; margin: 0.5rem 0; }
  h2 { font-size: 1rem; margin: 0 0 6px; }
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
  .muted { color: var(--muted); font-size: 0.9rem; line-height: 1.5; margin: 0 0 8px; }
  a { color: var(--accent); }
  .actions { margin-top: 24px; display: flex; align-items: center; gap: 12px; }
  .ok { color: var(--accent); }
  .error { color: var(--danger); }
</style>
