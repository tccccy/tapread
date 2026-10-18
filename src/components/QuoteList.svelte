<script lang="ts">
  import { onMount } from 'svelte'
  import { db, type Highlight } from '../lib/db'
  import { createHighlightStore, MAX_NOTE_CHARS } from '../lib/books/highlights'

  let { bookId, onJump }: {
    bookId: number
    /** 回到書中劃線的位置 */
    onJump: (cfi: string) => void
  } = $props()

  const store = createHighlightStore(db)
  const dateFormat = new Intl.DateTimeFormat('zh-TW', { month: 'numeric', day: 'numeric' })

  let quotes = $state<Highlight[]>([])
  let error = $state('')

  async function load() {
    try {
      quotes = await store.listByBook(bookId)
    } catch (e) {
      console.error('讀取書摘失敗', e)
      error = '讀取書摘失敗，請重新整理頁面。'
    }
  }

  // 註記在離開輸入框時儲存
  async function saveNote(q: Highlight, note: string) {
    if (note.trim() === q.note) return
    try {
      await store.setNote(q.id, note)
      quotes = quotes.map((x) => (x.id === q.id ? { ...x, note: note.trim() } : x))
    } catch (e) {
      console.error('儲存註記失敗', e)
      error = '註記沒有存到，請再試一次。'
    }
  }

  async function remove(q: Highlight) {
    if (!confirm('刪除這則書摘？')) return
    try {
      await store.remove(q.id)
      quotes = quotes.filter((x) => x.id !== q.id)
    } catch (e) {
      console.error('刪除書摘失敗', e)
      error = '刪除失敗，請再試一次。'
    }
  }

  onMount(load)
</script>

<section class="card glass">
  <h2>書摘 {#if quotes.length > 0}<span class="count">{quotes.length}</span>{/if}</h2>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if quotes.length === 0}
    <p class="hint">閱讀時選取喜歡的句子，按「劃線」就會存到這裡。</p>
  {:else}
    <ul>
      {#each quotes as q (q.id)}
        <li>
          <blockquote>{q.text}</blockquote>
          <textarea
            value={q.note}
            onblur={(e) => saveNote(q, e.currentTarget.value)}
            rows="1"
            maxlength={MAX_NOTE_CHARS}
            placeholder="加一句註記…"
            aria-label="書摘註記"
          ></textarea>
          <div class="meta">
            <span>{[q.chapter, dateFormat.format(q.createdAt)].filter(Boolean).join('・')}</span>
            <span class="actions">
              <button class="link" onclick={() => onJump(q.cfi)}>回到書中 →</button>
              <button class="link danger" onclick={() => remove(q)}>刪除</button>
            </span>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .card { padding: 16px 18px; margin-top: 14px; }
  h2 { font-size: 1.1rem; margin: 0 0 10px; }
  .count { font-family: var(--font-sans); font-size: 0.8rem; font-weight: 400; color: var(--muted); margin-left: 4px; }
  .hint { margin: 0; color: var(--muted); font-size: 0.9rem; }
  .error { color: var(--danger); }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; }
  li { padding-bottom: 14px; border-bottom: 1px solid var(--border); }
  li:last-child { border-bottom: none; padding-bottom: 0; }
  blockquote {
    margin: 0 0 8px;
    padding-left: 12px;
    border-left: 3px solid var(--accent);
    font-family: var(--font-serif);
    line-height: 1.65;
    white-space: pre-line;
  }
  textarea { width: 100%; padding: 6px 10px; font-size: 16px; line-height: 1.5; resize: vertical; min-height: 36px; }
  .meta { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 6px; font-size: 0.8rem; color: var(--muted); }
  .actions { display: flex; gap: 4px; flex-shrink: 0; }
  .link { min-height: 32px; padding: 2px 8px; border: none; background: none; color: var(--accent-ink); font-size: 0.85rem; }
  .link.danger { color: var(--danger); }
</style>
