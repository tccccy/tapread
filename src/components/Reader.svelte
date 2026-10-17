<script lang="ts">
  import { onMount } from 'svelte'
  import { library } from '../lib/library'
  import { createFoliateView, BOOK_CSS, type FoliateView, type RelocateDetail } from '../lib/foliate'

  let { bookId, onClose }: { bookId: number; onClose: () => void } = $props()

  let container: HTMLDivElement
  let view: FoliateView | null = null
  let title = $state('')
  let chapter = $state('')
  let progress = $state(0)
  let error = $state('')
  let loading = $state(true)

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') view?.goLeft()
    else if (e.key === 'ArrowRight') view?.goRight()
  }

  const onRelocate = (e: Event) => {
    const detail = (e as CustomEvent<RelocateDetail>).detail
    progress = detail.fraction ?? 0
    chapter = detail.tocItem?.label ?? ''
    library.saveLocation(bookId, { cfi: detail.cfi, progress }).catch((err) => {
      console.error('儲存閱讀位置失敗', err)
    })
  }

  // 書本內容在 iframe 裡，鍵盤事件要另外綁
  const onSectionLoad = (e: Event) => {
    const { doc } = (e as CustomEvent<{ doc: Document }>).detail
    doc.addEventListener('keydown', onKey)
  }

  onMount(() => {
    let cancelled = false
    ;(async () => {
      try {
        const book = await library.getBook(bookId)
        if (!book) throw new Error(`找不到書：${bookId}`)
        if (cancelled) return
        title = book.title
        const v = createFoliateView()
        view = v
        container.append(v)
        v.addEventListener('relocate', onRelocate)
        v.addEventListener('load', onSectionLoad)
        await v.open(book.file)
        if (cancelled) return
        v.renderer.setStyles?.(BOOK_CSS)
        await v.init(book.lastCfi ? { lastLocation: book.lastCfi } : { showTextStart: true })
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
