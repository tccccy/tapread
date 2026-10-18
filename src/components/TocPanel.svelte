<script lang="ts">
  import { onMount } from 'svelte'
  import type { TocEntry } from '../lib/reading/toc'

  let { entries, currentHref, onSelect, onClose }: {
    entries: TocEntry[]
    /** 目前所在章節的連結，用來標示與捲到該處 */
    currentHref?: string
    onSelect: (href: string) => void
    onClose: () => void
  } = $props()

  let list = $state<HTMLOListElement>()

  // 打開時把目前的章節捲到看得見的地方
  onMount(() => {
    list?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'center' })
  })
</script>

<div class="sheet glass" role="dialog" aria-label="目錄">
  <header>
    <h2>目錄</h2>
    <button class="close" onclick={onClose} aria-label="關閉目錄">完成</button>
  </header>
  {#if entries.length === 0}
    <p class="muted">這本書沒有目錄，可以用下方的進度條跳轉。</p>
  {:else}
    <ol bind:this={list}>
      {#each entries as entry, i (i)}
        <li>
          <button
            style:padding-left="{14 + entry.depth * 18}px"
            class:current={entry.href === currentHref}
            aria-current={entry.href === currentHref}
            onclick={() => onSelect(entry.href)}
          >{entry.label}</button>
        </li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .sheet {
    position: fixed;
    z-index: 30;
    left: 12px;
    right: 12px;
    bottom: calc(12px + env(safe-area-inset-bottom));
    max-height: min(70dvh, 620px);
    display: flex;
    flex-direction: column;
    padding: 14px 10px 10px;
    background: var(--surface-strong);
    color: var(--text);
  }
  @media (min-width: 700px) {
    .sheet { left: auto; bottom: auto; top: calc(64px + env(safe-area-inset-top)); right: 16px; width: 380px; }
  }
  header { display: flex; align-items: center; justify-content: space-between; padding: 0 8px 8px; }
  h2 { margin: 0; font-size: 1.15rem; }
  .close { min-height: 36px; padding: 0.3rem 0.95rem; }
  ol { list-style: none; margin: 0; padding: 0; overflow-y: auto; }
  li button {
    width: 100%;
    text-align: left;
    border: none;
    background: none;
    border-radius: var(--radius);
    min-height: 44px;
    padding-top: 8px;
    padding-bottom: 8px;
    padding-right: 12px;
    line-height: 1.35;
  }
  li button:hover { background: var(--accent-soft); }
  li button.current { background: var(--accent-soft); color: var(--accent-ink); font-weight: 600; }
  .muted { color: var(--muted); padding: 0 8px; }
</style>
