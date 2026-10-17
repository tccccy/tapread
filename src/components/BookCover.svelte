<script lang="ts">
  import { untrack } from 'svelte'
  import { coverUrl } from '../lib/books/covers'
  import { generatedCoverColors } from '../lib/books/coverStyle'
  import type { BookSummary } from '../lib/db'

  let { book, size = 'md' }: { book: Pick<BookSummary, 'id' | 'title' | 'author' | 'format'>; size?: 'sm' | 'md' | 'lg' } = $props()

  // undefined：載入中；null：沒有封面，用布面封面
  let url = $state<string | null | undefined>(undefined)
  let el: HTMLDivElement
  const colors = $derived(generatedCoverColors(book.title))
  const id = $derived(book.id)

  // 捲進畫面才載入封面；只在換了另一本書時重來（父層重新整理資料不會讓封面閃一下）
  $effect(() => {
    void id
    let alive = true
    url = undefined
    const load = () =>
      untrack(() => coverUrl(book)).then((u) => {
        if (alive) url = u
      })
    if (!('IntersectionObserver' in window)) {
      load()
      return () => (alive = false)
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        observer.disconnect()
        load()
      }
    }, { rootMargin: '200px' })
    observer.observe(el)
    return () => {
      alive = false
      observer.disconnect()
    }
  })
</script>

<div class="cover {size}" aria-hidden="true" bind:this={el}>
  {#if url}
    <img src={url} alt="" loading="lazy" decoding="async" />
  {:else if url === null}
    <div class="made" style:background-color={colors.background} style:color={colors.color}>
      <span class="title">{book.title}</span>
      {#if book.author}<span class="author">{book.author}</span>{/if}
    </div>
  {:else}
    <div class="loading"></div>
  {/if}
</div>

<style>
  .cover {
    aspect-ratio: 2 / 3;
    border-radius: 4px 8px 8px 4px;
    overflow: hidden;
    position: relative;
    box-shadow: 0 10px 22px rgba(60, 38, 22, 0.28), 0 2px 4px rgba(60, 38, 22, 0.2);
    background: var(--surface-strong);
  }
  /* 書背的光影 */
  .cover::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, rgba(0, 0, 0, 0.16) 0, rgba(255, 255, 255, 0.12) 3%, transparent 7%);
    pointer-events: none;
  }
  .sm { width: 92px; }
  .md { width: 120px; }
  .lg { width: 180px; }
  img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .made {
    width: 100%;
    height: 100%;
    padding: 12% 10%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    /* 布面紋理 */
    background-image:
      repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.05) 0 1px, transparent 1px 3px),
      repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.05) 0 1px, transparent 1px 3px);
  }
  .title {
    font-family: var(--font-serif);
    font-weight: 600;
    line-height: 1.2;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-line-clamp: 5;
    line-clamp: 5;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .sm .title { font-size: 0.78rem; }
  .md .title { font-size: 0.95rem; }
  .lg .title { font-size: 1.3rem; }
  .author { font-size: 0.7em; opacity: 0.8; }
  .sm .author { font-size: 0.62rem; }
  .loading { width: 100%; height: 100%; background: linear-gradient(110deg, var(--surface) 30%, var(--surface-strong) 50%, var(--surface) 70%); }
</style>
