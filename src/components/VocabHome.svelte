<script lang="ts" module>
  import type { VocabFilters } from '../lib/vocab/filters'

  /** 單字本的位置（語言分頁＋篩選），從閃卡或書中返回時還原 */
  export type VocabPlace = { language?: string; filters?: VocabFilters }
</script>

<script lang="ts">
  import { onMount } from 'svelte'
  import { db } from '../lib/db'
  import { library, type BookSummary } from '../lib/library'
  import { createVocabStore } from '../lib/vocab/store'
  import { isDue, MAX_LEVEL, type VocabEntry } from '../lib/vocab/model'
  import { applyFilters, EMPTY_FILTERS } from '../lib/vocab/filters'
  import { languageLabel } from '../lib/languageName'
  import VocabList from './VocabList.svelte'
  import VocabFilterPanel from './VocabFilterPanel.svelte'
  import { saveFile, isShareCancel } from '../lib/saveFile'

  let { initialPlace, onReview, onJump }: {
    initialPlace?: VocabPlace
    /** ids：依篩選與模式決定的複習卡片 */
    onReview: (place: VocabPlace, ids: string[]) => void
    onJump: (bookId: number, cfi: string, place: VocabPlace) => void
  } = $props()

  const vocab = createVocabStore(db)

  let languages = $state<{ language: string; count: number }[]>([])
  let language = $state('')
  let filters = $state<VocabFilters>(EMPTY_FILTERS)
  let entries = $state<VocabEntry[]>([])
  let books = $state<BookSummary[]>([])
  let loading = $state(true)
  let error = $state('')
  let now = $state(Date.now())

  const filtered = $derived(applyFilters(entries, filters, now))
  const due = $derived(filtered.filter((e) => isDue(e, now)).sort((a, b) => a.dueAt - b.dueAt))
  const learning = $derived(filtered.filter((e) => e.level < MAX_LEVEL))
  const knownCount = $derived(filtered.length - learning.length)
  const place = $derived<VocabPlace>({ language, filters })

  let exporting = $state(false)
  let exportError = $state('')

  // 匯出目前篩選出的字（含書中例句）；匯出程式只在用到時才載入
  async function exportWord() {
    exporting = true
    exportError = ''
    try {
      const { buildVocabDocx, vocabDocxFileName, DOCX_MIME } = await import('../lib/vocab/exportDocx')
      const label = languageLabel(language)
      const today = new Date()
      const data = buildVocabDocx(filtered, {
        title: `${label}單字本`,
        subtitle: `${filtered.length} 個字・匯出於 ${today.toLocaleDateString('zh-TW')}・TapRead`,
      })
      const file = new File([data as Uint8Array<ArrayBuffer>], vocabDocxFileName(label, today), { type: DOCX_MIME })
      await saveFile(file, `${label}單字本`)
    } catch (e) {
      if (isShareCancel(e)) return
      console.error('匯出 Word 失敗', e)
      exportError = '匯出失敗，請再試一次。'
    } finally {
      exporting = false
    }
  }

  async function selectLanguage(lang: string, keepFilters = false) {
    language = lang
    if (!keepFilters) filters = EMPTY_FILTERS
    now = Date.now()
    const list = await vocab.list(lang)
    // 快速切換語言時，丟掉較慢回來的舊結果
    if (language === lang) entries = list
  }

  // 篩選中的書已經沒有字時，從篩選移除（避免清單莫名變空）
  const pruneBookFilter = () => {
    const remaining = filters.bookIds.filter((id) => entries.some((e) => e.bookIds.includes(id)))
    if (remaining.length !== filters.bookIds.length) filters = { ...filters, bookIds: remaining }
  }

  // 清單中刪除後重新整理；目前語言的字被刪光時切到第一個語言
  async function refresh() {
    try {
      languages = await vocab.languages()
      if (languages.some((l) => l.language === language)) {
        const lang = language
        const list = await vocab.list(lang)
        if (language !== lang) return
        entries = list
        pruneBookFilter()
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
      const start = languages.find((l) => l.language === initialPlace?.language) ?? languages[0]
      if (start) {
        const restoring = start.language === initialPlace?.language && initialPlace?.filters
        if (restoring) filters = initialPlace!.filters!
        await selectLanguage(start.language, !!restoring)
        pruneBookFilter()
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

    <VocabFilterPanel {entries} {books} {filters} {now} onChange={(next) => (filters = next)} />

    <section class="stats">
      <div><strong>{filtered.length}</strong><span>{filtered.length === entries.length ? '收藏的字' : `篩選出的字（共 ${entries.length}）`}</span></div>
      <div><strong>{due.length}</strong><span>待複習</span></div>
      <div><strong>{knownCount}</strong><span>已熟</span></div>
    </section>

    <div class="actions">
      <button class="primary" disabled={due.length === 0} onclick={() => onReview(place, due.map((e) => e.id))}>
        {due.length > 0 ? `開始複習（${due.length} 張）` : '目前沒有到期的字'}
      </button>
      {#if learning.length > 0}
        <button onclick={() => onReview(place, learning.map((e) => e.id))}>全部未熟的字再練一次（{learning.length}）</button>
      {/if}
      <button disabled={exporting || filtered.length === 0} onclick={exportWord}>
        {exporting ? '匯出中…' : `匯出 Word（${filtered.length} 個字，含書中例句）`}
      </button>
      {#if exportError}<p class="error" role="alert">{exportError}</p>{/if}
    </div>

    <VocabList
      entries={filtered}
      {language}
      bookIds={new Set(books.map((b) => b.id))}
      onChanged={refresh}
      onJump={(x) => x.cfi && onJump(x.bookId, x.cfi, place)}
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
