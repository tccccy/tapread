<script lang="ts">
  import { onMount } from 'svelte'
  import { library, requestPersistentStorage, isQuotaError, type BookSummary } from '../lib/library'
  import { checkBookFile, bookFileErrorMessage, bookFormat } from '../lib/bookFile'
  import { loadBook } from '../lib/openBook'
  import { normalizeMetadata } from '../lib/metadata'
  import { loadSettings } from '../lib/settings'
  import { languageLabel, COMMON_LANGUAGES } from '../lib/languageName'
  import { db } from '../lib/db'
  import { createVocabStore } from '../lib/vocab/store'

  const vocab = createVocabStore(db)

  let { onOpen, onOpenSettings, onOpenVocab }: {
    onOpen: (id: number) => void
    onOpenSettings: () => void
    onOpenVocab: () => void
  } = $props()

  // 還沒設定金鑰時顯示首次使用引導（從設定頁回來會重新掛載、重新判斷）
  const needsKey = !loadSettings(localStorage).geminiApiKey
  let books = $state<BookSummary[]>([])
  let error = $state('')
  let busy = $state(false)
  let dragging = $state(false)
  let fileInput: HTMLInputElement

  const refresh = async () => {
    books = await library.listBooks()
  }

  onMount(() => {
    refresh().catch((e) => {
      console.error('讀取書庫失敗', e)
      error = '讀取書庫失敗，請重新整理頁面。'
    })
  })

  async function importFile(file: File) {
    if (busy) return
    busy = true
    error = ''
    try {
      const check = await checkBookFile(file)
      if (!check.ok) {
        error = bookFileErrorMessage(check.reason)
        return
      }
      const format = bookFormat(file.name) ?? 'epub'
      const fallbackTitle = file.name.replace(/\.[^.]+$/, '')
      const book = await loadBook(file, format, { fileName: file.name, title: fallbackTitle, language: '' })
      const meta = normalizeMetadata(book.metadata, file.name)
      book.destroy?.()
      // PDF、Word 常沒有標註語言，改用設定裡的預設學習語言
      const language = meta.language || loadSettings(localStorage).defaultLanguage
      const id = await library.addBook({ ...meta, language, format, file })
      requestPersistentStorage().catch((e) => console.warn('無法要求持久儲存', e))
      onOpen(id)
    } catch (e) {
      console.error('匯入失敗', e)
      error = isQuotaError(e)
        ? '裝置儲存空間不足，請先移除一些書再匯入。'
        : '無法開啟這本書，檔案可能已損壞、格式不受支援，或尚未下載到這台裝置。'
    } finally {
      busy = false
    }
  }

  function onPick(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (file) importFile(file)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    dragging = false
    const file = e.dataTransfer?.files[0]
    if (file) importFile(file)
  }

  async function remove(book: BookSummary) {
    if (!confirm(`確定要從書庫移除「${book.title}」嗎？`)) return
    try {
      await library.deleteBook(book.id)
      await refresh()
    } catch (e) {
      console.error('刪除失敗', e)
      error = '刪除失敗，請再試一次。'
    }
  }

  // 沒有語言的書（PDF、Word 常見）：選了語言後，連同先前收藏在「未指定語言」下的字一起搬過去
  async function setLanguage(book: BookSummary, language: string) {
    if (!language) return
    try {
      await library.setLanguage(book.id, language)
      await vocab.moveBookLanguage(book.id, book.language, language)
      await refresh()
    } catch (e) {
      console.error('設定語言失敗', e)
      error = '設定語言失敗，請再試一次。'
    }
  }

  const percent = (p: number) => `${Math.round(p * 100)}%`
</script>

<main
  class:dragging
  ondragover={(e) => { e.preventDefault(); dragging = true }}
  ondragleave={() => (dragging = false)}
  ondrop={onDrop}
>
  <header>
    <h1>我的書庫</h1>
    <!-- 不設 accept：iOS 對 .epub 的 accept 支援不一，改由 checkBookFile 驗證 -->
    <input bind:this={fileInput} type="file" hidden onchange={onPick} />
    <div class="actions">
      <button onclick={onOpenVocab}>單字本</button>
      <button onclick={onOpenSettings}>設定</button>
      <button class="primary" disabled={busy} onclick={() => fileInput.click()}>
        {busy ? '匯入中…' : '匯入檔案'}
      </button>
    </div>
  </header>

  {#if needsKey}
    <section class="welcome" aria-labelledby="welcome-title">
      <h2 id="welcome-title">歡迎使用 TapRead</h2>
      <p>讀外文時點一下不懂的字，就會看到它在這一句裡的中文意思，還能收藏起來複習。</p>
      <ol>
        <li><strong>設定 Gemini 金鑰</strong>：免費，約 2 分鐘，點字查詢需要它</li>
        <li><strong>匯入一本書</strong>：EPUB、PDF 或 Word（.docx）</li>
      </ol>
      <button class="primary" onclick={onOpenSettings}>設定金鑰</button>
      <p class="muted small">你的書、單字本與金鑰都只存在這台裝置，不會上傳到任何伺服器。</p>
    </section>
  {/if}

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}

  {#if books.length === 0}
    <section class="empty">
      <p>書庫是空的。</p>
      <p class="muted">點「匯入檔案」選檔，或把檔案拖進這個視窗。支援 EPUB、PDF、Word（.docx）。<br />檔案只會存在這台裝置的瀏覽器裡，不會上傳。</p>
    </section>
  {:else}
    <ul>
      {#each books as book (book.id)}
        <li>
          <button class="book" onclick={() => onOpen(book.id)}>
            <span class="title">{book.title}</span>
            <span class="muted">
              {book.author || '作者不詳'}{book.language ? ` · ${languageLabel(book.language)}` : ''} · {percent(book.progress)}
            </span>
          </button>
          {#if !book.language}
            <select class="lang" aria-label={`設定「${book.title}」的語言`} onchange={(e) => setLanguage(book, e.currentTarget.value)}>
              <option value="">選擇語言</option>
              {#each COMMON_LANGUAGES as code (code)}
                <option value={code}>{languageLabel(code)}</option>
              {/each}
            </select>
          {/if}
          <button class="remove" aria-label={`移除 ${book.title}`} onclick={() => remove(book)}>移除</button>
        </li>
      {/each}
    </ul>
  {/if}
</main>

<style>
  main {
    max-width: 760px;
    margin: 0 auto;
    padding: max(16px, env(safe-area-inset-top)) 16px 32px;
    min-height: 100%;
  }
  main.dragging { outline: 3px dashed var(--accent); outline-offset: -8px; }
  header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 12px; }
  h1 { font-size: 1.5rem; margin: 0.5rem 0; }
  .actions { display: flex; gap: 8px; }
  /* 手機上按鈕文字不換行；空間不夠時整排移到標題下方 */
  .actions button { white-space: nowrap; }
  .error { color: var(--danger); }
  .empty { text-align: center; padding: 15vh 0; }
  .muted { color: var(--muted); font-size: 0.9rem; }
  ul { list-style: none; padding: 0; margin: 16px 0; display: grid; gap: 10px; }
  ul > li { display: flex; gap: 8px; }
  .book {
    flex: 1;
    min-width: 0;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px 14px;
  }
  .title { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .remove { color: var(--danger); }
  .welcome {
    margin: 16px 0; padding: 16px 18px; border-radius: 14px;
    background: var(--surface); border: 1px solid var(--accent);
  }
  .welcome h2 { margin: 0 0 6px; font-size: 1.15rem; }
  .welcome p { margin: 0 0 8px; line-height: 1.6; }
  .welcome ol { margin: 0 0 12px; padding-left: 22px; line-height: 1.8; }
  .small { font-size: 0.8rem; margin: 10px 0 0 !important; }
  .lang {
    min-height: 44px; max-width: 8.5rem; font: inherit; font-size: 16px; color: var(--accent);
    background: var(--surface); border: 1px solid var(--accent); border-radius: var(--radius); padding: 0 6px;
  }
</style>
