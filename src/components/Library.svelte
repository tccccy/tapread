<script lang="ts">
  import { onMount } from 'svelte'
  import { library, requestPersistentStorage, isQuotaError, type BookSummary } from '../lib/library'
  import { checkBookFile, bookFileErrorMessage } from '../lib/bookFile'
  import { makeBook } from '../lib/foliate'
  import { normalizeMetadata } from '../lib/metadata'

  let { onOpen, onOpenSettings, onOpenVocab }: {
    onOpen: (id: number) => void
    onOpenSettings: () => void
    onOpenVocab: () => void
  } = $props()

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
      const book = await makeBook(file)
      const meta = normalizeMetadata(book.metadata, file.name)
      const id = await library.addBook({ ...meta, file })
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
        {busy ? '匯入中…' : '匯入 EPUB'}
      </button>
    </div>
  </header>

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}

  {#if books.length === 0}
    <section class="empty">
      <p>書庫是空的。</p>
      <p class="muted">點「匯入 EPUB」選檔，或把檔案拖進這個視窗。<br />書只會存在這台裝置的瀏覽器裡，不會上傳。</p>
    </section>
  {:else}
    <ul>
      {#each books as book (book.id)}
        <li>
          <button class="book" onclick={() => onOpen(book.id)}>
            <span class="title">{book.title}</span>
            <span class="muted">
              {book.author || '作者不詳'}{book.language ? ` · ${book.language.toUpperCase()}` : ''} · {percent(book.progress)}
            </span>
          </button>
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
  header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  h1 { font-size: 1.5rem; margin: 0.5rem 0; }
  .actions { display: flex; gap: 8px; }
  .error { color: var(--danger); }
  .empty { text-align: center; padding: 15vh 0; }
  .muted { color: var(--muted); font-size: 0.9rem; }
  ul { list-style: none; padding: 0; margin: 16px 0; display: grid; gap: 10px; }
  li { display: flex; gap: 8px; }
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
</style>
