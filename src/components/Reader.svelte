<script lang="ts">
  import { onMount } from 'svelte'
  import { library } from '../lib/library'
  import { createFoliateView, BOOK_CSS, type FoliateView, type RelocateDetail } from '../lib/foliate'
  import { db } from '../lib/db'
  import { loadSettings } from '../lib/settings'
  import { createLookup } from '../lib/lookup'
  import { createDefinitionCache } from '../lib/definitionCache'
  import { createGeminiDefiner, aiErrorMessage, AiError } from '../lib/ai/gemini'
  import { tapToWord } from '../lib/text/tapToWord'
  import { setLookupHighlight } from '../lib/text/domHit'
  import { applyVocabHighlights } from '../lib/text/vocabHighlight'
  import { createVocabStore } from '../lib/vocab/store'
  import type { Definition } from '../lib/ai/definition'
  import LookupCard, { type CardState } from './LookupCard.svelte'

  let { bookId, onClose, onOpenSettings }: {
    bookId: number
    onClose: () => void
    onOpenSettings: () => void
  } = $props()

  let container: HTMLDivElement
  let view: FoliateView | null = null
  let title = $state('')
  let chapter = $state('')
  let progress = $state(0)
  let error = $state('')
  let loading = $state(true)
  let language = ''
  let card = $state<CardState | null>(null)
  // 目前卡片對應的查詢內容，收藏時用
  let current: { word: string; sentence: string; definition: Definition; savedId: string | null } | null = null
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

  const SETTINGS_ERRORS = ['no-key', 'auth', 'model']

  function cancelLookup() {
    lookupSeq++
    lookupController?.abort()
    lookupController = null
  }

  function closeCard() {
    cancelLookup()
    card = null
    if (highlightedDoc) setLookupHighlight(highlightedDoc, null)
    highlightedDoc = null
  }

  async function onBookClick(doc: Document, e: MouseEvent) {
    const target = e.target as Element | null
    if (target?.closest('a')) return
    if (!doc.getSelection()?.isCollapsed) return

    const tapped = tapToWord(doc, e.clientX, e.clientY, language)
    if (!tapped) {
      closeCard()
      return
    }
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
      current = { word: tapped.word, sentence: tapped.sentence, definition, savedId: found?.id ?? null }
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
        const { word, sentence, definition } = target
        savedId = (await vocab.save({ language, word, sentence, definition, bookId, bookTitle: title })).id
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

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeCard()
    else if (e.key === 'ArrowLeft') view?.goLeft()
    else if (e.key === 'ArrowRight') view?.goRight()
  }

  const onRelocate = (e: Event) => {
    const detail = (e as CustomEvent<RelocateDetail>).detail
    // 排版中途 foliate 可能算出 NaN（分頁數暫時為 0），略過這次
    if (!Number.isFinite(detail.fraction)) return
    progress = detail.fraction
    chapter = detail.tocItem?.label ?? ''
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

  // 書本內容在 iframe 裡，鍵盤事件要另外綁
  const onSectionLoad = (e: Event) => {
    const { doc } = (e as CustomEvent<{ doc: Document }>).detail
    if (boundDocs.has(doc)) return
    boundDocs.add(doc)
    doc.addEventListener('keydown', onKey)
    doc.addEventListener('click', (ev) => onBookClick(doc, ev))
    applyVocabHighlights(doc, vocabLevels, language)
  }

  onMount(() => {
    let cancelled = false
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
        await v.open(book.file)
        if (cancelled) return
        v.renderer.addEventListener('relocate', onRendererRelocate)
        await v.init(book.lastCfi ? { lastLocation: book.lastCfi } : { showTextStart: true })
        if (cancelled) return
        // 要等第一個章節載入後再設樣式，否則 foliate 會讀到空的 view
        v.renderer.setStyles?.(BOOK_CSS)
      } catch (err) {
        if (cancelled) return
        console.error('開啟書本失敗', err)
        error = '無法開啟這本書。'
      } finally {
        if (!cancelled) loading = false
      }
    })()
    document.addEventListener('keydown', onKey)

    return () => {
      cancelled = true
      cancelLookup()
      document.removeEventListener('keydown', onKey)
      view?.close()
      view?.remove()
      view = null
    }
  })
</script>

<div class="reader">
  <header>
    <button onclick={onClose} aria-label="回書庫">← 書庫</button>
    <div class="heading">
      <span class="title">{title}</span>
      {#if chapter}<span class="chapter">{chapter}</span>{/if}
    </div>
    <span class="progress">{Math.round(progress * 100)}%</span>
  </header>

  <div class="stage">
    <div class="view-host" bind:this={container}></div>
    {#if loading}<p class="status">載入中…</p>{/if}
    {#if error}<p class="status error" role="alert">{error}</p>{/if}
    {#if card}<LookupCard {card} onClose={closeCard} {onOpenSettings} onToggleSave={toggleSave} />{/if}
  </div>

  <footer>
    <button onclick={() => view?.goLeft()} aria-label="上一頁">‹ 上一頁</button>
    <button onclick={() => view?.goRight()} aria-label="下一頁">下一頁 ›</button>
  </footer>
</div>

<style>
  .reader {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  }
  header, footer {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--border);
  }
  footer { border-bottom: none; border-top: 1px solid var(--border); justify-content: space-between; }
  .heading { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .title, .chapter { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .title { font-weight: 600; }
  .chapter, .progress { color: var(--muted); font-size: 0.85rem; }
  .stage { flex: 1; min-height: 0; position: relative; }
  .view-host { position: absolute; inset: 0; }
  .view-host :global(foliate-view) { display: block; width: 100%; height: 100%; }
  .status { position: absolute; inset: 0; display: grid; place-items: center; margin: 0; color: var(--muted); }
  .error { color: var(--danger); }
</style>
