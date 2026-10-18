<script lang="ts">
  import { onMount } from 'svelte'
  import { loadSettings } from '../lib/settings'
  import { languageLabel, COMMON_LANGUAGES } from '../lib/languageName'
  import { titleFromText } from '../lib/formats/textBook'

  let { busy, onSubmit, onCancel }: {
    busy: boolean
    onSubmit: (input: { title: string; language: string; text: string }) => void
    onCancel: () => void
  } = $props()

  // 一般文章遠小於這個上限；太長的請用檔案匯入
  const MAX_CHARS = 2_000_000

  let text = $state('')
  let title = $state('')
  let language = $state(loadSettings(localStorage).defaultLanguage)
  let textarea: HTMLTextAreaElement

  const tooLong = $derived(text.length > MAX_CHARS)
  const ready = $derived(text.trim().length > 0 && !tooLong && !busy)

  function submit(e: SubmitEvent) {
    e.preventDefault()
    if (!ready) return
    onSubmit({ title: title.trim() || titleFromText(text), language, text })
  }

  onMount(() => textarea.focus())
</script>

<div class="backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && onCancel()}>
  <div class="dialog glass" role="dialog" aria-modal="true" aria-label="貼上文章">
  <form onsubmit={submit}>
    <h2>貼上文章</h2>
    <p class="muted">貼上一段外文（新聞、文章、歌詞都可以），就能像書一樣點字查詢。以 # 開頭的行會當成章節標題。</p>

    <textarea bind:this={textarea} bind:value={text} rows="10" placeholder="在這裡貼上文字…" aria-label="文章內容"></textarea>
    {#if tooLong}<p class="error" role="alert">文字太長了，請存成 .txt 檔再用「匯入」。</p>{/if}

    <div class="row">
      <label>
        標題
        <input bind:value={title} placeholder={text.trim() ? titleFromText(text) : '自動用第一行'} maxlength="120" />
      </label>
      <label>
        語言
        <select bind:value={language}>
          <option value="">交給 AI 判斷</option>
          {#each COMMON_LANGUAGES as code (code)}<option value={code}>{languageLabel(code)}</option>{/each}
        </select>
      </label>
    </div>

    <div class="actions">
      <button type="button" onclick={onCancel}>取消</button>
      <button type="submit" class="primary" disabled={!ready}>{busy ? '處理中…' : '開始閱讀'}</button>
    </div>
  </form>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: rgba(30, 20, 14, 0.35);
    display: grid;
    place-items: center;
    padding: 16px;
  }
  .dialog {
    width: min(640px, 100%);
    max-height: calc(100dvh - 32px);
    overflow-y: auto;
    padding: 18px 20px;
    background: var(--surface-strong);
  }
  form { display: flex; flex-direction: column; gap: 12px; }
  h2 { margin: 0; font-size: 1.2rem; }
  .muted { margin: 0; color: var(--muted); font-size: 0.88rem; line-height: 1.5; }
  textarea { width: 100%; padding: 12px 14px; line-height: 1.6; resize: vertical; font-family: var(--font-serif); }
  .row { display: grid; grid-template-columns: 1fr 180px; gap: 12px; }
  label { display: flex; flex-direction: column; gap: 4px; font-size: 0.85rem; color: var(--muted); }
  input, select { padding: 8px 10px; }
  .actions { display: flex; justify-content: flex-end; gap: 10px; }
  .error { margin: 0; color: var(--danger); font-size: 0.9rem; }
  @media (max-width: 520px) {
    .row { grid-template-columns: 1fr; }
  }
</style>
