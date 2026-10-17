<script lang="ts">
  import { onMount } from 'svelte'
  import { library, type BookSummary } from '../lib/library'
  import { db, type Shelf } from '../lib/db'
  import { createShelfStore, ShelfNameError } from '../lib/books/shelves'
  import { createVocabStore } from '../lib/vocab/store'
  import { bookStatus, type BookStatus } from '../lib/books/bookshelf'
  import { coverUrl, forgetCover } from '../lib/books/covers'
  import { languageLabel, COMMON_LANGUAGES } from '../lib/languageName'
  import { EMPTY_FILTERS } from '../lib/vocab/filters'
  import type { VocabPlace } from './VocabHome.svelte'
  import BookCover from './BookCover.svelte'
  import StarRating from './StarRating.svelte'

  let { bookId, onBack, onRead, onOpenVocab }: {
    bookId: number
    onBack: () => void
    onRead: (id: number) => void
    onOpenVocab: (place: VocabPlace) => void
  } = $props()

  const shelfStore = createShelfStore(db)
  const vocab = createVocabStore(db)
  const REVIEW_SAVE_DELAY_MS = 800
  const STATUS_LABEL: Record<BookStatus, string> = { unread: '還沒開始', reading: '正在讀', finished: '讀完了' }
  const dateFormat = new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric' })

  let book = $state<BookSummary | null>(null)
  let shelves = $state<Shelf[]>([])
  let wordCount = $state(0)
  let backdrop = $state<string | null>(null)
  let review = $state('')
  let reviewState = $state<'idle' | 'saving' | 'saved'>('idle')
  let newShelf = $state('')
  let error = $state('')
  let reviewTimer: ReturnType<typeof setTimeout> | undefined

  const status = $derived(book ? bookStatus(book) : 'unread')
  const percent = $derived(book ? Math.round(book.progress * 100) : 0)

  async function refresh() {
    ;[book, shelves, wordCount] = await Promise.all([
      library.getSummary(bookId).then((b) => b ?? null),
      shelfStore.list(),
      vocab.countByBook(bookId),
    ])
  }

  // iPad 常在背景直接暫停 App：一離開畫面就把還沒存的心得存起來
  function flushReview() {
    if (!reviewTimer) return
    clearTimeout(reviewTimer)
    reviewTimer = undefined
    library.updateBook(bookId, { review }).catch((e) => console.error('儲存心得失敗', e))
  }
  const onHide = () => {
    if (document.visibilityState === 'hidden') flushReview()
  }

  onMount(() => {
    refresh()
      .then(async () => {
        review = book?.review ?? ''
        if (book) backdrop = await coverUrl(book)
      })
      .catch((e) => {
        console.error('讀取書的資料失敗', e)
        error = '讀取失敗，請回書架再試一次。'
      })
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', flushReview)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', flushReview)
      flushReview()
    }
  })

  async function update(patch: Parameters<typeof library.updateBook>[1]) {
    error = ''
    try {
      await library.updateBook(bookId, patch)
      await refresh()
    } catch (e) {
      console.error('更新失敗', e)
      error = '儲存失敗，請再試一次。'
    }
  }

  let reviewEdits = 0
  function onReviewInput() {
    reviewState = 'saving'
    reviewEdits++
    clearTimeout(reviewTimer)
    reviewTimer = setTimeout(async () => {
      reviewTimer = undefined
      const edit = reviewEdits
      await update({ review })
      // 存檔途中又打了字，就維持「儲存中」等下一次存
      if (edit === reviewEdits) reviewState = 'saved'
    }, REVIEW_SAVE_DELAY_MS)
  }

  // 評分先更新畫面再存，連按方向鍵也不會掉格
  function rate(rating: number | null) {
    if (book) book = { ...book, rating: rating ?? undefined }
    update({ rating })
  }

  const inShelf = (id: string) => !!book?.shelfIds?.includes(id)
  const toggleShelf = (id: string) =>
    update({ shelfIds: inShelf(id) ? book!.shelfIds!.filter((s) => s !== id) : [...(book?.shelfIds ?? []), id] })

  async function addShelf(e: SubmitEvent) {
    e.preventDefault()
    error = ''
    try {
      const shelf = await shelfStore.create(newShelf)
      newShelf = ''
      await update({ shelfIds: [...(book?.shelfIds ?? []), shelf.id] })
    } catch (err) {
      error = err instanceof ShelfNameError ? err.message : '建立書架失敗，請再試一次。'
    }
  }

  async function changeLanguage(language: string) {
    if (!book || language === book.language) return
    try {
      await vocab.moveBookLanguage(bookId, book.language, language)
      await library.setLanguage(bookId, language)
      await refresh()
    } catch (e) {
      console.error('設定語言失敗', e)
      error = '設定語言失敗，請再試一次。'
    }
  }

  async function removeBook() {
    if (!book || !confirm(`確定要從書架移除「${book.title}」嗎？已收藏的單字會保留。`)) return
    try {
      await library.deleteBook(bookId)
      forgetCover(bookId)
      onBack()
    } catch (e) {
      console.error('刪除失敗', e)
      error = '刪除失敗，請再試一次。'
    }
  }

  const languageOptions = $derived(
    book && book.language && !(COMMON_LANGUAGES as readonly string[]).includes(book.language)
      ? [...COMMON_LANGUAGES, book.language]
      : [...COMMON_LANGUAGES],
  )
</script>

<main>
  <button class="back" onclick={onBack}>← 書架</button>

  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#if book}
    <section class="top glass">
      {#if backdrop}<div class="backdrop" style:background-image="url({backdrop})" aria-hidden="true"></div>{/if}
      <div class="top-inner">
        <BookCover {book} size="lg" />
        <div class="info">
          <span class="status {status}">{STATUS_LABEL[status]}</span>
          <h1>{book.title}</h1>
          {#if book.author}<p class="author">{book.author}</p>{/if}
          <p class="meta">{book.language ? languageLabel(book.language) : '未指定語言'} · {(book.format ?? 'epub').toUpperCase()}</p>
          <div class="progress">
            <div class="bar"><div style:width="{percent}%"></div></div>
            <span>{percent}%</span>
          </div>
          <div class="actions">
            <button class="primary" onclick={() => onRead(bookId)}>{status === 'unread' ? '開始閱讀' : '繼續閱讀'} →</button>
            {#if status === 'finished'}
              <button onclick={() => update({ finished: false })}>標為還沒讀完</button>
            {:else}
              <button onclick={() => update({ finished: true })}>標為讀完</button>
            {/if}
          </div>
        </div>
      </div>
    </section>

    <section class="card glass">
      <h2>我的評分</h2>
      <StarRating value={book.rating ?? null} onChange={rate} />
      <p class="hint">點星星左半邊是半顆；再點一次同樣的分數可以取消。</p>
    </section>

    <section class="card glass">
      <div class="row-head">
        <h2>心得</h2>
        <span class="save-state" aria-live="polite">{reviewState === 'saving' ? '儲存中…' : reviewState === 'saved' ? '已儲存' : ''}</span>
      </div>
      <textarea
        bind:value={review}
        oninput={onReviewInput}
        rows="5"
        maxlength="5000"
        placeholder="讀完的感想、喜歡的句子、想記住的事……"
        aria-label="心得"
      ></textarea>
    </section>

    <section class="card glass">
      <h2>放在哪個書架</h2>
      <div class="chips">
        {#each shelves as s (s.id)}
          <button class="chip" class:on={inShelf(s.id)} aria-pressed={inShelf(s.id)} onclick={() => toggleShelf(s.id)}>
            {inShelf(s.id) ? '✓ ' : ''}{s.name}
          </button>
        {/each}
      </div>
      <form class="new-shelf" onsubmit={addShelf}>
        <input bind:value={newShelf} placeholder="新書架名稱" maxlength="40" aria-label="新書架名稱" />
        <button type="submit" disabled={!newShelf.trim()}>＋ 建立並放入</button>
      </form>
    </section>

    <section class="card glass">
      <h2>單字</h2>
      {#if wordCount > 0}
        <button class="vocab-link" onclick={() => onOpenVocab({ language: book!.language, filters: { ...EMPTY_FILTERS, bookIds: [bookId] } })}>
          從這本書收藏了 <strong>{wordCount}</strong> 個單字 →
        </button>
      {:else}
        <p class="hint">閱讀時點字、按「☆ 收藏」，單字就會出現在這裡。</p>
      {/if}
    </section>

    <section class="card glass details">
      <h2>資訊</h2>
      <dl>
        <dt>語言</dt>
        <dd>
          <select value={book.language} onchange={(e) => changeLanguage(e.currentTarget.value)} aria-label="這本書的語言">
            {#if !book.language}<option value="">未指定（請選擇）</option>{/if}
            {#each languageOptions as code (code)}
              <option value={code}>{languageLabel(code)}</option>
            {/each}
          </select>
        </dd>
        <dt>加入書架</dt>
        <dd>{dateFormat.format(book.addedAt)}</dd>
        <dt>開始閱讀</dt>
        <dd>{book.startedAt ? dateFormat.format(book.startedAt) : '—'}</dd>
        <dt>讀完</dt>
        <dd>{book.finishedAt ? dateFormat.format(book.finishedAt) : '—'}</dd>
      </dl>
      <button class="remove" onclick={removeBook}>從書架移除這本書</button>
    </section>
  {:else if !error}
    <p class="muted">載入中…</p>
  {/if}
</main>

<style>
  main { max-width: 760px; margin: 0 auto; padding: max(16px, env(safe-area-inset-top)) 16px var(--tabbar-space); }
  .back { margin-bottom: 14px; }
  .error { color: var(--danger); }
  .muted { color: var(--muted); }

  .top { position: relative; overflow: hidden; padding: 22px; }
  /* 封面放大模糊當背景，做出玻璃透光感 */
  .backdrop {
    position: absolute;
    inset: -40px;
    background-size: cover;
    background-position: center;
    filter: blur(40px) saturate(120%);
    opacity: 0.35;
  }
  .top-inner { position: relative; display: flex; gap: 22px; align-items: flex-end; }
  .info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
  h1 { margin: 2px 0 0; font-size: 1.7rem; line-height: 1.25; overflow-wrap: anywhere; }
  .author { margin: 0; font-size: 1.05rem; }
  .meta { margin: 0; color: var(--muted); font-size: 0.85rem; }
  .status { font-size: 0.75rem; padding: 3px 10px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); }
  .status.finished { background: var(--accent); color: var(--accent-text); }
  .progress { display: flex; align-items: center; gap: 10px; width: 100%; color: var(--muted); font-size: 0.85rem; margin: 4px 0; }
  .bar { flex: 1; height: 6px; border-radius: 999px; background: var(--accent-soft); overflow: hidden; }
  .bar div { height: 100%; background: var(--accent); border-radius: 999px; }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }

  .card { padding: 16px 18px; margin-top: 14px; }
  .card h2 { font-size: 1.1rem; margin: 0 0 10px; }
  .row-head { display: flex; justify-content: space-between; align-items: baseline; }
  .save-state { color: var(--muted); font-size: 0.8rem; }
  .hint { color: var(--muted); font-size: 0.85rem; margin: 6px 0 0; }
  textarea { width: 100%; padding: 12px 14px; line-height: 1.6; resize: vertical; font-family: var(--font-serif); }

  .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
  .chip { min-height: 38px; padding: 0 14px; }
  .chip.on { background: var(--accent); color: var(--accent-text); border-color: transparent; }
  .new-shelf { display: flex; gap: 8px; flex-wrap: wrap; }
  .new-shelf input { flex: 1; min-width: 10em; min-height: 44px; padding: 0 14px; border-radius: 999px; }

  .vocab-link { width: 100%; text-align: left; border-radius: var(--radius); }
  .vocab-link strong { color: var(--accent); font-size: 1.15em; }

  dl { display: grid; grid-template-columns: auto 1fr; gap: 10px 16px; margin: 0 0 14px; align-items: center; }
  dt { color: var(--muted); font-size: 0.85rem; }
  dd { margin: 0; }
  select { min-height: 40px; padding: 0 10px; }
  .remove { border: none; background: none; -webkit-backdrop-filter: none; backdrop-filter: none; color: var(--danger); padding: 0; min-height: 36px; text-decoration: underline; }

  @media (max-width: 560px) {
    .top-inner { flex-direction: column; align-items: center; text-align: center; }
    .info { align-items: center; }
    .top :global(.cover.lg) { width: 150px; }
    h1 { font-size: 1.45rem; }
  }
</style>
