<script lang="ts">
  import { onMount } from 'svelte'
  import { library, requestPersistentStorage, isQuotaError, type BookSummary } from '../lib/library'
  import { checkBookFile, bookFileErrorMessage, bookFormat } from '../lib/bookFile'
  import { loadBook } from '../lib/openBook'
  import { normalizeMetadata } from '../lib/metadata'
  import { loadSettings } from '../lib/settings'
  import { db, type Shelf } from '../lib/db'
  import { createShelfStore, ShelfNameError } from '../lib/books/shelves'
  import { groupBooks, continueReading, UNSHELVED_KEY, type GroupMode } from '../lib/books/bookshelf'
  import { saveCoverOnImport } from '../lib/books/covers'
  import BookCover from './BookCover.svelte'

  let { onOpenBook, onRead, onOpenSettings }: {
    /** 書的頁面（評分、評語） */
    onOpenBook: (id: number) => void
    /** 直接打開閱讀 */
    onRead: (id: number) => void
    onOpenSettings: () => void
  } = $props()

  const shelfStore = createShelfStore(db)
  const MODE_KEY = 'tapread.shelfMode'
  const MODES: { id: GroupMode; label: string }[] = [
    { id: 'status', label: '閱讀狀態' },
    { id: 'language', label: '語言' },
    { id: 'shelves', label: '我的書架' },
  ]

  // 還沒設定金鑰時顯示首次使用引導（從設定頁回來會重新掛載、重新判斷）
  const needsKey = !loadSettings(localStorage).geminiApiKey
  let books = $state<BookSummary[]>([])
  let shelves = $state<Shelf[]>([])
  let mode = $state<GroupMode>(loadMode())
  let loaded = $state(false)
  let error = $state('')
  let busy = $state(false)
  let dragging = $state(false)
  let newShelfName = $state('')
  let addingShelf = $state(false)
  let fileInput: HTMLInputElement

  const hero = $derived(continueReading(books))
  const groups = $derived(groupBooks(books, mode, shelves))

  function loadMode(): GroupMode {
    try {
      const saved = localStorage.getItem(MODE_KEY)
      return saved === 'language' || saved === 'shelves' ? saved : 'status'
    } catch {
      return 'status'
    }
  }

  function setMode(next: GroupMode) {
    mode = next
    try {
      localStorage.setItem(MODE_KEY, next)
    } catch {
      // 隱私模式等無法存：只是下次不記得，沒關係
    }
  }

  async function refresh() {
    ;[books, shelves] = await Promise.all([library.listBooks(), shelfStore.list()])
    loaded = true
  }

  onMount(() => {
    refresh().catch((e) => {
      console.error('讀取書架失敗', e)
      error = '讀取書架失敗，請重新整理頁面。'
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
      // 在自訂書架模式下匯入：先放進「未分類」，使用者再到書的頁面選書架
      await saveCoverOnImport(id, file, format, meta.title).catch((e) => console.warn('取封面失敗', e))
      requestPersistentStorage().catch((e) => console.warn('無法要求持久儲存', e))
      onRead(id)
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

  async function runShelf(action: () => Promise<unknown>) {
    error = ''
    try {
      await action()
      await refresh()
    } catch (e) {
      if (e instanceof ShelfNameError) error = e.message
      else {
        console.error('更新書架失敗', e)
        error = '更新書架失敗，請再試一次。'
      }
    }
  }

  async function addShelf(e: SubmitEvent) {
    e.preventDefault()
    await runShelf(() => shelfStore.create(newShelfName))
    if (!error) {
      newShelfName = ''
      addingShelf = false
    }
  }

  function renameShelf(id: string, current: string) {
    const name = prompt('書架名稱', current)
    if (name !== null && name.trim() !== current) runShelf(() => shelfStore.rename(id, name))
  }

  function removeShelf(id: string, name: string) {
    if (confirm(`刪除書架「${name}」？書不會被刪除，只會從這個書架移出。`)) runShelf(() => shelfStore.remove(id))
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
    <div>
      <h1>我的書架</h1>
      <p class="sub">{books.length > 0 ? `共 ${books.length} 本書` : '把想讀的外文書放上來'}</p>
    </div>
    <!-- 不設 accept：iOS 對 .epub 的 accept 支援不一，改由 checkBookFile 驗證 -->
    <input bind:this={fileInput} type="file" hidden onchange={onPick} />
    <button class="primary add" disabled={busy} onclick={() => fileInput.click()} aria-label="匯入檔案">
      {busy ? '匯入中…' : '＋ 匯入'}
    </button>
  </header>

  {#if needsKey}
    <section class="welcome glass" aria-labelledby="welcome-title">
      <h2 id="welcome-title">歡迎使用 TapRead</h2>
      <p>讀外文時點一下不懂的字，就會看到它在這一句裡的中文意思，還能收藏起來複習。</p>
      <ol>
        <li><strong>設定 Gemini 金鑰</strong>：免費，約 2 分鐘，點字查詢需要它</li>
        <li><strong>匯入一本書</strong>：EPUB、PDF 或 Word（.docx）</li>
      </ol>
      <button class="primary" onclick={onOpenSettings}>設定金鑰</button>
      <p class="small">你的書、單字本與金鑰都只存在這台裝置，不會上傳到任何伺服器。</p>
    </section>
  {/if}

  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#if hero}
    <section class="hero glass" aria-label="繼續閱讀">
      <button class="hero-cover" onclick={() => onOpenBook(hero.id)} aria-label={`${hero.title} 的頁面`}>
        <BookCover book={hero} size="md" />
      </button>
      <div class="hero-info">
        <span class="eyebrow">繼續閱讀</span>
        <h2>{hero.title}</h2>
        {#if hero.author}<p class="author">{hero.author}</p>{/if}
        <div class="progress" aria-label={`進度 ${percent(hero.progress)}`}>
          <div class="bar"><div style:width={percent(hero.progress)}></div></div>
          <span>{percent(hero.progress)}</span>
        </div>
        <button class="primary" onclick={() => onRead(hero.id)}>繼續閱讀 →</button>
      </div>
    </section>
  {/if}

  {#if loaded && books.length === 0}
    <section class="empty glass">
      <p class="big">書架是空的</p>
      <p class="muted">點右上角「＋ 匯入」選檔，或把檔案拖進這個視窗。<br />支援 EPUB、PDF、Word（.docx）。檔案只會存在這台裝置。</p>
    </section>
  {:else if books.length > 0}
    <div class="modes glass" role="radiogroup" aria-label="書架分類方式">
      {#each MODES as m (m.id)}
        <button role="radio" aria-checked={mode === m.id} class:on={mode === m.id} onclick={() => setMode(m.id)}>{m.label}</button>
      {/each}
    </div>

    {#if mode === 'shelves'}
      <div class="shelf-tools">
        {#if addingShelf}
          <form class="new-shelf" onsubmit={addShelf}>
            <!-- svelte-ignore a11y_autofocus -->
            <input bind:value={newShelfName} placeholder="書架名稱，例如：西文小說" maxlength="40" autofocus aria-label="新書架名稱" />
            <button class="primary" type="submit">建立</button>
            <button type="button" onclick={() => { addingShelf = false; newShelfName = '' }}>取消</button>
          </form>
        {:else}
          <button onclick={() => (addingShelf = true)}>＋ 新書架</button>
          {#if shelves.length === 0}<span class="muted">建立書架後，到書的頁面把書放進去。</span>{/if}
        {/if}
      </div>
    {/if}

    {#each groups as g (g.key)}
      <section class="shelf">
        <div class="shelf-head">
          <h2>{g.title} <span class="count">{g.books.length}</span></h2>
          {#if mode === 'shelves' && g.key !== UNSHELVED_KEY}
            <div class="shelf-actions">
              <button class="link" onclick={() => renameShelf(g.key, g.title)}>改名</button>
              <button class="link danger" onclick={() => removeShelf(g.key, g.title)}>刪除</button>
            </div>
          {/if}
        </div>
        <div class="shelf-body">
        <div class="row">
          {#each g.books as b (b.id)}
            <button class="book" onclick={() => onOpenBook(b.id)} aria-label={`${b.title}${b.author ? `，${b.author}` : ''}，進度 ${percent(b.progress)}`}>
              <BookCover book={b} size="sm" />
              <span class="mini-bar"><span style:width={percent(b.progress)}></span></span>
              <span class="book-title">{b.title}</span>
            </button>
          {:else}
            <p class="muted shelf-empty">這個書架還沒有書。到書的頁面可以把書放進來。</p>
          {/each}
        </div>
        <div class="ledge" aria-hidden="true"></div>
        </div>
      </section>
    {/each}
  {/if}
</main>

<style>
  main {
    max-width: 980px;
    margin: 0 auto;
    padding: max(20px, env(safe-area-inset-top)) 18px var(--tabbar-space);
    min-height: 100%;
  }
  main.dragging { outline: 3px dashed var(--accent); outline-offset: -10px; border-radius: var(--radius-lg); }
  header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
  h1 { font-size: 2rem; margin: 0.2rem 0 0; }
  .sub { margin: 4px 0 0; color: var(--muted); }
  .add { white-space: nowrap; }
  .error { color: var(--danger); }
  .muted { color: var(--muted); font-size: 0.9rem; line-height: 1.6; }

  .welcome { padding: 18px 20px; margin-bottom: 18px; }
  .welcome h2 { margin: 0 0 6px; font-size: 1.25rem; }
  .welcome p { margin: 0 0 8px; line-height: 1.6; }
  .welcome ol { margin: 0 0 12px; padding-left: 22px; line-height: 1.8; }
  .small { font-size: 0.8rem; color: var(--muted); margin: 12px 0 0 !important; }

  .hero { display: flex; gap: 20px; padding: 18px; margin-bottom: 22px; align-items: center; }
  .hero-cover { padding: 0; border: none; background: none; -webkit-backdrop-filter: none; backdrop-filter: none; min-height: 0; flex-shrink: 0; }
  .hero-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
  .eyebrow { font-size: 0.75rem; letter-spacing: 0.12em; color: var(--accent); text-transform: uppercase; }
  .hero h2 { margin: 0; font-size: 1.35rem; line-height: 1.3; overflow-wrap: anywhere; }
  .author { margin: 0; color: var(--muted); }
  .progress { display: flex; align-items: center; gap: 10px; width: 100%; margin: 6px 0 8px; color: var(--muted); font-size: 0.85rem; }
  .bar { flex: 1; height: 6px; border-radius: 999px; background: var(--accent-soft); overflow: hidden; }
  .bar div { height: 100%; background: var(--accent); border-radius: 999px; }

  .modes { display: inline-flex; padding: 4px; border-radius: 999px; gap: 2px; margin-bottom: 8px; }
  .modes button {
    border: none; background: transparent; -webkit-backdrop-filter: none; backdrop-filter: none;
    min-height: 38px; padding: 0 16px; color: var(--muted);
  }
  .modes button.on { background: var(--accent); color: var(--accent-text); }

  .shelf-tools { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 8px 0; }
  .new-shelf { display: flex; gap: 8px; flex-wrap: wrap; width: 100%; }
  .new-shelf input { flex: 1; min-width: 12em; min-height: 44px; padding: 0 14px; border-radius: 999px; }

  .shelf { margin-top: 22px; }
  .shelf-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
  .shelf h2 { font-size: 1.2rem; margin: 0 0 12px; }
  .count { font-family: var(--font-sans); font-size: 0.8rem; font-weight: 400; color: var(--muted); margin-left: 4px; }
  .shelf-actions { display: flex; gap: 4px; }
  .link {
    border: none; background: none; -webkit-backdrop-filter: none; backdrop-filter: none;
    min-height: 32px; padding: 0 6px; color: var(--muted); font-size: 0.85rem; text-decoration: underline;
  }
  .danger { color: var(--danger); }

  /* 書立在層板上：橫向捲動，層板畫在封面底部 */
  .shelf-body { --cover-h: calc(92px * 1.5); position: relative; }
  .row {
    position: relative;
    z-index: 1;
    display: flex;
    gap: 18px;
    overflow-x: auto;
    padding: 4px 6px 6px;
    scroll-snap-type: x proximity;
    -webkit-overflow-scrolling: touch;
  }
  .ledge {
    position: absolute;
    left: 0;
    right: 0;
    top: calc(4px + var(--cover-h));
    height: 14px;
    border-radius: 3px;
    background: linear-gradient(180deg, var(--shelf-top) 0 40%, var(--shelf-front) 40% 100%);
    box-shadow: 0 8px 14px var(--shelf-shadow);
    pointer-events: none;
    z-index: 0;
  }
  .book {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0;
    width: 92px;
    flex-shrink: 0;
    padding: 0;
    border: none;
    background: none;
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
    border-radius: 6px;
    min-height: 0;
    text-align: left;
    scroll-snap-align: start;
  }
  .book:hover :global(.cover) { transform: translateY(-3px); }
  .book :global(.cover) { transition: transform 0.15s; }
  .mini-bar { display: block; height: 3px; margin: 20px 4px 0; border-radius: 999px; background: var(--accent-soft); overflow: hidden; }
  .mini-bar span { display: block; height: 100%; background: var(--accent); }
  .book-title {
    margin-top: 6px;
    font-size: 0.8rem;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .shelf-empty { margin: 0; padding: 12px 4px calc(var(--cover-h) - 30px); }

  .empty { text-align: center; padding: 40px 20px; }
  .big { font-family: var(--font-serif); font-size: 1.3rem; margin: 0 0 6px; }

  @media (min-width: 700px) {
    .shelf-body { --cover-h: calc(120px * 1.5); }
    .row { gap: 24px; }
    .book { width: 120px; }
    .book :global(.cover.sm) { width: 120px; }
    .book-title { font-size: 0.85rem; }
  }
  @media (max-width: 480px) {
    .hero { gap: 14px; padding: 14px; }
    .hero :global(.cover.md) { width: 96px; }
    h1 { font-size: 1.7rem; }
  }
</style>
