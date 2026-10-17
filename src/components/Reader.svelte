<script lang="ts">
  import { onMount } from 'svelte'
  import { library } from '../lib/library'
  import { createFoliateView, ensureHighlightStyle, type FoliateView, type RelocateDetail } from '../lib/foliate'
  import { loadBook, type OpenableBook } from '../lib/openBook'
  import { db } from '../lib/db'
  import { loadSettings } from '../lib/settings'
  import { createLookup } from '../lib/lookup'
  import { createDefinitionCache } from '../lib/definitionCache'
  import { createGeminiDefiner, aiErrorMessage, AiError } from '../lib/ai/gemini'
  import { tapToWord } from '../lib/text/tapToWord'
  import { setLookupHighlight } from '../lib/text/domHit'
  import { applyVocabHighlights } from '../lib/text/vocabHighlight'
  import { selectionToLookup, type SelectedPhrase } from '../lib/text/selectPhrase'
  import { createVocabStore } from '../lib/vocab/store'
  import type { Definition } from '../lib/ai/definition'
  import LookupCard, { type CardState } from './LookupCard.svelte'
  import ReadingSettings from './ReadingSettings.svelte'
  import { loadReadingPrefs, saveReadingPrefs, bookCss, webFamiliesOf, WIDTHS, type ReadingPrefs } from '../lib/reading/prefs'
  import { loadWebFonts, fontFaceCss } from '../lib/reading/fonts'
  import { loadAppearance, bookTheme } from '../lib/appearance'
  import { createActivityClock } from '../lib/stats/readingStats'
  import { addReadingTime } from '../lib/stats/readingLog'

  let { bookId, jumpTo, backLabel = '書架', onClose, onOpenSettings }: {
    bookId: number
    /** 從單字本「回到書中」開啟：跳到該句、不改變閱讀進度 */
    jumpTo?: string
    /** 返回鍵上顯示要回到哪裡 */
    backLabel?: string
    onClose: () => void
    onOpenSettings: () => void
  } = $props()

  const peek = $derived(jumpTo !== undefined)

  let container: HTMLDivElement
  let view: FoliateView | null = null
  let title = $state('')
  let chapter = $state('')
  let progress = $state(0)
  let error = $state('')
  let loading = $state(true)
  let language = $state('')
  // 「Aa」閱讀設定；PDF 是固定版面，只能換紙張色
  let prefs = $state<ReadingPrefs>(loadReadingPrefs(localStorage))
  let showPrefs = $state(false)
  let fixedLayout = $state(false)
  let prefsSeq = 0
  let prefsTimer: ReturnType<typeof setTimeout> | undefined
  let card = $state<CardState | null>(null)
  // 目前卡片對應的查詢內容，收藏時用
  let current: { word: string; sentence: string; definition: Definition; savedId: string | null; cfi?: string } | null = null
  let saving = false
  let refreshSeq = 0
  const vocab = createVocabStore(db)
  let vocabLevels = new Map<string, number>()

  // 每次開書時讀一次設定；從設定頁回來會重新掛載
  const settings = loadSettings(localStorage)
  const lookup = createLookup({
    cache: createDefinitionCache(db),
    define: createGeminiDefiner({ apiKey: settings.geminiApiKey, model: settings.geminiModel }),
    model: settings.geminiModel,
  })
  let lookupSeq = 0
  // 連點多個字時取消前一個請求，避免浪費免費額度
  let lookupController: AbortController | null = null
  let highlightedDoc: Document | null = null
  // foliate 可能重複載入同一章節，避免重複綁定監聽器
  const boundDocs = new WeakSet<Document>()
  // 每個 iframe 文件對應的章節（PDF 為頁）索引；PDF 的固定版面 getContents 不提供 index
  const docIndex = new WeakMap<Document, number>()
  let openedBook: OpenableBook | null = null
  // 「回到書中」要標出的位置；頁面重新繪製時（PDF 文字層較晚出現、改視窗大小）會再標一次，直到使用者點別的字
  let pendingJump: string | null = null

  const SETTINGS_ERRORS = ['no-key', 'auth', 'model']

  function cancelLookup() {
    lookupSeq++
    lookupController?.abort()
    lookupController = null
  }

  function closeCard() {
    pendingJump = null
    cancelLookup()
    card = null
    if (highlightedDoc) setLookupHighlight(highlightedDoc, null)
    highlightedDoc = null
  }

  // 套用排版：先載入選到的字型，再把字型宣告一起放進書本 iframe（iframe 讀不到主頁面的字型）
  async function applyPrefs() {
    const renderer = view?.renderer
    if (!renderer || fixedLayout) return
    const seq = ++prefsSeq
    const current = prefs
    const families = webFamiliesOf(current.font)
    // 字型載不到（例如離線且沒快取）就用系統字體，不擋住閱讀
    await loadWebFonts(families).catch((err) => console.warn('載入字型失敗，改用系統字體', err))
    if (seq !== prefsSeq || view?.renderer !== renderer) return
    renderer.setAttribute('max-inline-size', `${WIDTHS[current.width].px}px`)
    // 紙張「跟隨系統」時，書本內文改跟設定頁手動選的深淺色
    const theme = bookTheme(current.theme, loadAppearance(localStorage))
    renderer.setStyles?.(bookCss({ ...current, theme }, language, fontFaceCss(families)))
  }

  function changePrefs(next: ReadingPrefs) {
    prefs = saveReadingPrefs(localStorage, next)
    // 拖動字級滑桿時每一格都會觸發，稍等一下再重排，避免一直重新分頁
    clearTimeout(prefsTimer)
    prefsTimer = setTimeout(applyPrefs, 120)
  }

  // 閱讀時間：最近 3 分鐘內有翻頁、點字才算在讀；切到背景時暫停。每累積一分鐘寫入一次
  const IDLE_MS = 180_000
  const TICK_MS = 15_000
  const clock = createActivityClock({ idleMs: IDLE_MS, start: Date.now() })
  let unsavedSeconds = 0
  const markActive = () => clock.activity(Date.now())

  function flushReading() {
    unsavedSeconds += clock.tick(Date.now())
    const seconds = unsavedSeconds
    unsavedSeconds = 0
    if (seconds > 0) addReadingTime(db, seconds).catch((err) => console.warn('記錄閱讀時間失敗', err))
  }

  function tickReading() {
    unsavedSeconds += clock.tick(Date.now())
    if (unsavedSeconds >= 60) flushReading()
  }

  function onVisibility() {
    if (document.visibilityState === 'hidden') {
      flushReading()
      clock.pause(Date.now())
    } else {
      clock.resume(Date.now())
    }
  }

  async function onBookClick(doc: Document, e: MouseEvent) {
    markActive()
    // 設定面板開著時，點書本只是關掉面板
    if (showPrefs) {
      showPrefs = false
      return
    }
    const target = e.target as Element | null
    if (target?.closest('a')) return
    if (!doc.getSelection()?.isCollapsed) return

    const tapped = tapToWord(doc, e.clientX, e.clientY, language)
    if (!tapped) {
      closeCard()
      return
    }
    await lookupTarget(doc, tapped)
  }

  // 拖曳選取幾個字後，畫面上方出現「查詢」按鈕；等選取停下來才顯示，調整選取範圍時不閃動
  let selected = $state<{ doc: Document; phrase: SelectedPhrase } | null>(null)
  let selectionTimer: ReturnType<typeof setTimeout> | undefined
  function onSelectionChange(doc: Document) {
    markActive()
    clearTimeout(selectionTimer)
    selectionTimer = setTimeout(() => {
      const phrase = selectionToLookup(doc, language)
      if (phrase) selected = { doc, phrase }
      else if (selected?.doc === doc) selected = null
    }, 400)
  }

  async function lookupSelection() {
    const target = selected
    if (!target) return
    selected = null
    // 清掉系統的選取（iPad 的拷貝選單），改用查詢標示
    target.doc.getSelection()?.removeAllRanges()
    showPrefs = false
    await lookupTarget(target.doc, target.phrase)
  }

  async function lookupTarget(doc: Document, tapped: SelectedPhrase) {
    if (highlightedDoc && highlightedDoc !== doc) setLookupHighlight(highlightedDoc, null)
    setLookupHighlight(doc, tapped.range)
    highlightedDoc = doc

    cancelLookup()
    const seq = lookupSeq
    const controller = new AbortController()
    lookupController = controller
    card = { status: 'loading', word: tapped.word }
    try {
      const { definition } = await lookup({
        word: tapped.word,
        sentence: tapped.sentence,
        before: tapped.before,
        after: tapped.after,
        language,
        bookTitle: title,
      }, controller.signal)
      if (seq !== lookupSeq) return
      const found = await vocab.findSaved(language, tapped.word, tapped.sentence).catch((err) => {
        console.warn('查詢單字本失敗', err)
        return undefined
      })
      if (seq !== lookupSeq) return
      current = { word: tapped.word, sentence: tapped.sentence, definition, savedId: found?.id ?? null, cfi: cfiOf(doc, tapped.range) }
      card = { status: 'done', word: tapped.word, definition, saved: !!found }
    } catch (err) {
      if (seq !== lookupSeq) return
      console.error('查詞失敗', err)
      card = {
        status: 'error',
        word: tapped.word,
        message: aiErrorMessage(err),
        needsSettings: err instanceof AiError && SETTINGS_ERRORS.includes(err.kind),
      }
    }
  }

  const loadedDocs = () => view?.renderer.getContents?.().map((c) => c.doc) ?? []

  async function refreshVocabHighlights() {
    // 連續收藏／取消時，只採用最後一次的結果
    const seq = ++refreshSeq
    const levels = await vocab.formLevels(language)
    if (seq !== refreshSeq) return
    vocabLevels = levels
    for (const doc of loadedDocs()) applyVocabHighlights(doc, vocabLevels, language)
  }

  async function toggleSave() {
    const target = current
    if (!target || saving || card?.status !== 'done') return
    saving = true
    const wasSaved = target.savedId !== null
    card = { ...card, saved: !wasSaved }
    try {
      let savedId: string | null = null
      if (target.savedId) {
        await vocab.unsave(target.savedId, target.word, target.sentence)
      } else {
        const { word, sentence, definition, cfi } = target
        savedId = (await vocab.save({ language, word, sentence, definition, bookId, bookTitle: title, cfi })).id
      }
      if (current === target) current = { ...target, savedId }
      await refreshVocabHighlights()
    } catch (err) {
      console.error('更新單字本失敗', err)
      // 只還原同一張卡；使用者若已改查別的字就不動
      if (current === target && card?.status === 'done') card = { ...card, saved: wasSaved }
    } finally {
      saving = false
    }
  }

  // 單字在書中的位置；算不出來（例如特殊排版）時就不存，只是無法「回到書中」
  function cfiOf(doc: Document, range: Range): string | undefined {
    const index = docIndex.get(doc) ?? view?.renderer.getContents?.().find((c) => c.doc === doc)?.index
    if (!view || index === undefined) return undefined
    try {
      return view.getCFI(index, range)
    } catch (err) {
      console.warn('無法計算書中位置', err)
      return undefined
    }
  }

  function highlightCfi(cfi: string) {
    try {
      const target = view?.resolveNavigation(cfi)
      const doc = loadedDocs().find((d) => target && docIndex.get(d) === target.index)
        ?? view?.renderer.getContents?.().find((c) => c.index === target?.index)?.doc
      const range = doc && target?.anchor?.(doc)
      if (!doc || !range) return
      setLookupHighlight(doc, range)
      highlightedDoc = doc
    } catch (err) {
      console.warn('無法標示書中位置', err)
    }
  }

  const onKey = (e: KeyboardEvent) => {
    markActive()
    // 在設定面板的滑桿上按方向鍵是調字級，不是翻頁
    const typing = (e.target as Element | null)?.closest?.('input, textarea, select')
    if (e.key === 'Escape' && showPrefs) showPrefs = false
    else if (e.key === 'Escape') closeCard()
    else if (typing) return
    else if (e.key === 'ArrowLeft') view?.goLeft()
    else if (e.key === 'ArrowRight') view?.goRight()
  }

  const onRelocate = (e: Event) => {
    markActive()
    const detail = (e as CustomEvent<RelocateDetail>).detail
    // 排版中途 foliate 可能算出 NaN（分頁數暫時為 0），略過這次
    if (!Number.isFinite(detail.fraction)) return
    progress = detail.fraction
    chapter = detail.tocItem?.label ?? ''
    if (peek) return
    library.saveLocation(bookId, { cfi: detail.cfi, progress }).catch((err) => {
      console.error('儲存閱讀位置失敗', err)
    })
  }

  // 翻頁、滑動、跳章後原本的字已不在畫面上；resize 重排（reason: anchor）則保留
  const PAGE_MOVES = ['page', 'snap', 'scroll', 'navigation']
  const onRendererRelocate = (e: Event) => {
    const { reason } = (e as CustomEvent<{ reason?: string }>).detail
    if (reason && PAGE_MOVES.includes(reason)) closeCard()
  }

  // PDF 的文字層在 load 之後才非同步畫出，重新繪製時也會整個換掉；內容變動後重新上色並重新標示跳轉位置
  function watchForRedraw(doc: Document) {
    const win = doc.defaultView
    if (!win || !doc.body) return
    let scheduled = false
    new win.MutationObserver(() => {
      if (scheduled) return
      scheduled = true
      win.requestAnimationFrame(() => {
        scheduled = false
        applyVocabHighlights(doc, vocabLevels, language)
        if (pendingJump && docIndex.get(doc) === view?.resolveNavigation(pendingJump)?.index) highlightCfi(pendingJump)
      })
    }).observe(doc.body, { childList: true, subtree: true })
  }

  // 書本內容在 iframe 裡，鍵盤事件要另外綁
  const onSectionLoad = (e: Event) => {
    const { doc, index } = (e as CustomEvent<{ doc: Document; index: number }>).detail
    if (typeof index === 'number') docIndex.set(doc, index)
    ensureHighlightStyle(doc)
    if (boundDocs.has(doc)) return
    boundDocs.add(doc)
    watchForRedraw(doc)
    doc.addEventListener('keydown', onKey)
    doc.addEventListener('click', (ev) => onBookClick(doc, ev))
    doc.addEventListener('selectionchange', () => onSelectionChange(doc))
    applyVocabHighlights(doc, vocabLevels, language)
  }

  onMount(() => {
    let cancelled = false
    pendingJump = jumpTo ?? null
    ;(async () => {
      try {
        const book = await library.getBook(bookId)
        if (!book) throw new Error(`找不到書：${bookId}`)
        if (cancelled) return
        title = book.title
        language = book.language
        vocabLevels = await vocab.formLevels(language).catch((err) => {
          console.error('讀取單字本失敗', err)
          return new Map<string, number>()
        })
        if (cancelled) return
        const v = createFoliateView()
        view = v
        container.append(v)
        v.addEventListener('relocate', onRelocate)
        v.addEventListener('load', onSectionLoad)
        const format = book.format ?? 'epub'
        fixedLayout = format === 'pdf'
        openedBook = await loadBook(book.file, format, {
          fileName: `${book.title}.${format}`,
          title: book.title,
          language: book.language,
        })
        if (cancelled) return
        await v.open(openedBook)
        if (cancelled) return
        v.renderer.addEventListener('relocate', onRendererRelocate)
        const start = jumpTo ?? book.lastCfi
        await v.init(start ? { lastLocation: start } : { showTextStart: true })
        if (cancelled) return
        // 要等第一個章節載入後再設樣式，否則 foliate 會讀到空的 view
        await applyPrefs()
        if (cancelled) return
        if (jumpTo) highlightCfi(jumpTo)
      } catch (err) {
        if (cancelled) return
        console.error('開啟書本失敗', err)
        error = '無法開啟這本書。'
      } finally {
        if (!cancelled) loading = false
      }
    })()
    document.addEventListener('keydown', onKey)
    document.addEventListener('visibilitychange', onVisibility)
    const readingTimer = setInterval(tickReading, TICK_MS)

    return () => {
      cancelled = true
      clearTimeout(prefsTimer)
      clearTimeout(selectionTimer)
      cancelLookup()
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('visibilitychange', onVisibility)
      clearInterval(readingTimer)
      flushReading()
      view?.close()
      view?.remove()
      view = null
      openedBook?.destroy?.()
      openedBook = null
    }
  })
</script>

<div class="reader" data-reading-theme={prefs.theme === 'auto' ? undefined : prefs.theme}>
  <header>
    <button onclick={onClose} aria-label={`回${backLabel}`}>← {backLabel}</button>
    <div class="heading">
      <span class="title">{title}</span>
      {#if chapter}<span class="chapter">{chapter}</span>{/if}
    </div>
    <span class="progress">{Math.round(progress * 100)}%</span>
    <button class="aa" class:active={showPrefs} onclick={() => (showPrefs = !showPrefs)} aria-label="閱讀設定" aria-expanded={showPrefs}>Aa</button>
  </header>
  {#if peek}<p class="peek-note">從單字本開啟：可以自由翻閱，不會改變你的閱讀進度。</p>{/if}

  <div class="stage">
    <div class="view-host" bind:this={container}></div>
    {#if loading}<p class="status">載入中…</p>{/if}
    {#if error}<p class="status error" role="alert">{error}</p>{/if}
    {#if selected}
      <button class="phrase primary" onclick={lookupSelection}>
        查詢「{selected.phrase.word.length > 24 ? `${selected.phrase.word.slice(0, 24)}…` : selected.phrase.word}」
      </button>
    {/if}
    {#if card}<LookupCard {card} onClose={closeCard} {onOpenSettings} onToggleSave={toggleSave} />{/if}
  </div>
  {#if showPrefs}
    <ReadingSettings {prefs} {language} {fixedLayout} onChange={changePrefs} onClose={() => (showPrefs = false)} />
  {/if}

  <footer>
    <button onclick={() => view?.goLeft()} aria-label="上一頁">‹ 上一頁</button>
    <button onclick={() => view?.goRight()} aria-label="下一頁">下一頁 ›</button>
  </footer>
</div>

<style>
  .reader {
    /* 直接用視窗高度（外層容器沒有固定高度）；dvh 會扣掉手機瀏覽器的網址列 */
    height: 100vh;
    height: 100dvh;
    display: flex;
    flex-direction: column;
    background: var(--paper);
    color: var(--text);
    transition: background 0.2s;
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  }
  header, footer {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
  }
  footer { justify-content: space-between; }
  .title { font-family: var(--font-serif); }
  .phrase {
    /* 不用 transform 置中：按鈕按下時的縮放動畫也用 transform，會互相蓋掉 */
    position: absolute; z-index: 12; top: 10px; left: 0; right: 0; margin: 0 auto; width: fit-content;
    max-width: calc(100% - 32px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .aa { font-family: var(--font-serif); font-size: 1.05rem; padding: 0.3rem 0.9rem; }
  .aa.active { background: var(--accent); color: var(--accent-text); border-color: transparent; }
  .heading { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .title, .chapter { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .title { font-weight: 600; }
  .chapter, .progress { color: var(--muted); font-size: 0.85rem; }
  .stage { flex: 1; min-height: 0; position: relative; }
  .view-host { position: absolute; inset: 0; }
  .view-host :global(foliate-view) { display: block; width: 100%; height: 100%; }
  .status { position: absolute; inset: 0; display: grid; place-items: center; margin: 0; color: var(--muted); }
  .error { color: var(--danger); }
  .peek-note { margin: 0 16px 6px; padding: 6px 14px; font-size: 0.85rem; color: var(--muted); background: var(--accent-soft); border-radius: 999px; }
</style>
