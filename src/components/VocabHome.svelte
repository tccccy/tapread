<script lang="ts">
  import { onMount } from 'svelte'
  import { db } from '../lib/db'
  import { library, type BookSummary } from '../lib/library'
  import { createVocabStore } from '../lib/vocab/store'
  import { isDue, MAX_LEVEL, type VocabEntry } from '../lib/vocab/model'
  import { languageLabel } from '../lib/languageName'
  import VocabList from './VocabList.svelte'

  export type ReviewMode = 'due' | 'all'

  let { initialLanguage, initialBookId, onBack, onReview, onJump }: {
    /** 從閃卡或書中返回時，回到原本的語言分頁與書本篩選 */
    initialLanguage?: string
    initialBookId?: number
    onBack: () => void
    onReview: (language: string, bookId: number | undefined, mode: ReviewMode) => void
    onJump: (bookId: number, cfi: string, language: string, filterBookId: number | undefined) => void
  } = $props()

  const vocab = createVocabStore(db)

  let languages = $state<{ language: string; count: number }[]>([])
  let language = $state('')
  let bookId = $state<number | undefined>(undefined)
  let entries = $state<VocabEntry[]>([])
  let books = $state<BookSummary[]>([])
  let loading = $state(true)
  let error = $state('')
  let now = $state(Date.now())

  const booksInLanguage = $derived(books.filter((b) => entries.some((e) => e.bookIds.includes(b.id))))
  const filtered = $derived(bookId === undefined ? entries : entries.filter((e) => e.bookIds.includes(bookId!)))
  const dueCount = $derived(filtered.filter((e) => isDue(e, now)).length)
  const knownCount = $derived(filtered.filter((e) => e.level >= MAX_LEVEL).length)
  const learningCount = $derived(filtered.length - knownCount)

  async function selectLanguage(lang: string) {
    language = lang
    bookId = undefined
    now = Date.now()
    const list = await vocab.list(lang)
    // 快速切換語言時，丟掉較慢回來的舊結果
    if (language === lang) entries = list
  }

  // 篩選的書已經沒有字時，取消篩選（避免下拉選單空白、清單空白）
  const keepBookFilter = (id: number | undefined) =>
    id !== undefined && entries.some((e) => e.bookIds.includes(id)) ? id : undefined

  // 清單中刪除後重新整理；目前語言的字被刪光時切到第一個語言
  async function refresh() {
    try {
      languages = await vocab.languages()
      if (languages.some((l) => l.language === language)) {
        const lang = language
        const list = await vocab.list(lang)
        if (language !== lang) return
        entries = list
        bookId = keepBookFilter(bookId)
      } else if (languages[0]) {
        await selectLanguage(languages[0].language)
      } else {
        entries = []
      }
    } catch (e) {
      console.error('重新整理單字本失敗', e)
      error = '讀取單字本失敗，請重新整理頁面。'
    }
  }

  onMount(async () => {
    try {
      ;[languages, books] = await Promise.all([vocab.languages(), library.listBooks()])
      const start = languages.find((l) => l.language === initialLanguage) ?? languages[0]
      if (start) {
        await selectLanguage(start.language)
        if (start.language === initialLanguage) bookId = keepBookFilter(initialBookId)
      }
    } catch (e) {
      console.error('讀取單字本失敗', e)
      error = '讀取單字本失敗，請重新整理頁面。'
    } finally {
      loading = false
    }
  })
</script>

<main>
  <header>
    <button onclick={onBack}>← 書庫</button>
    <h1>單字本</h1>
  </header>

  {#if error}
    <p class="error" role="alert">{error}</p>
  {:else if loading}
    <p class="muted">載入中…</p>
  {:else if languages.length === 0}
    <section class="empty">
      <p>還沒有收藏的字。</p>
      <p class="muted">閱讀時點一個字，在釋義卡片上按「☆ 收藏」，就會出現在這裡。</p>
    </section>
  {:else}
    <nav class="tabs" aria-label="語言">
      {#each languages as l (l.language)}
        <button class:active={l.language === language} aria-pressed={l.language === language} onclick={() => selectLanguage(l.language)}>
          {languageLabel(l.language)} <span class="count">{l.count}</span>
        </button>
      {/each}
    </nav>

    {#if booksInLanguage.length > 1}
      <label class="filter">
        <span>只看這本書</span>
        <select bind:value={bookId}>
          <option value={undefined}>全部的書</option>
          {#each booksInLanguage as b (b.id)}
            <option value={b.id}>{b.title}</option>
          {/each}
        </select>
      </label>
    {/if}

    <section class="stats">
      <div><strong>{filtered.length}</strong><span>收藏的字</span></div>
      <div><strong>{dueCount}</strong><span>待複習</span></div>
      <div><strong>{knownCount}</strong><span>已熟</span></div>
    </section>

    <div class="actions">
      <button class="primary" disabled={dueCount === 0} onclick={() => onReview(language, bookId, 'due')}>
        {dueCount > 0 ? `開始複習（${dueCount} 張）` : '目前沒有到期的字'}
      </button>
      {#if learningCount > 0}
        <button onclick={() => onReview(language, bookId, 'all')}>全部未熟的字再練一次（{learningCount}）</button>
      {/if}
    </div>

    <VocabList
      {entries}
      {language}
      {bookId}
      bookIds={new Set(books.map((b) => b.id))}
      onChanged={refresh}
      onJump={(x) => x.cfi && onJump(x.bookId, x.cfi, language, bookId)}
    />
  {/if}
</main>

<style>
  main { max-width: 640px; margin: 0 auto; padding: max(16px, env(safe-area-inset-top)) 16px 32px; }
  header { display: flex; align-items: center; gap: 12px; }
  h1 { font-size: 1.5rem; margin: 0.5rem 0; }
  .tabs { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0; }
  .tabs button.active { background: var(--accent); color: var(--accent-text); border-color: var(--accent); }
  .count { opacity: 0.7; font-size: 0.85em; margin-left: 4px; }
  .filter { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
  select {
    flex: 1; min-height: 44px; font: inherit; font-size: 16px; color: var(--text);
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 0 8px;
  }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .stats div {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 12px; display: flex; flex-direction: column; align-items: center; gap: 4px;
  }
  .stats strong { font-size: 1.6rem; }
  .stats span { color: var(--muted); font-size: 0.85rem; }
  .actions { display: flex; flex-direction: column; gap: 10px; margin-top: 20px; }
  .empty { text-align: center; padding: 15vh 0; }
  .muted { color: var(--muted); font-size: 0.9rem; }
  .error { color: var(--danger); }
</style>
