<script lang="ts">
  import { onMount } from 'svelte'
  import {
    activeFilterCount, facetCounts, EMPTY_FILTERS, LEVEL_BUCKETS, POS_GROUPS, CEFR_LEVELS,
    type VocabFilters, type LevelBucket, type PosGroup, type CefrLevel, type SavedWithin,
  } from '../lib/vocab/filters'
  import type { VocabEntry } from '../lib/vocab/model'

  let { entries, books, filters, now, onChange }: {
    entries: VocabEntry[]
    books: { id: number; title: string }[]
    filters: VocabFilters
    now: number
    onChange: (next: VocabFilters) => void
  } = $props()

  const LEVEL_LABELS: Record<LevelBucket, string> = { new: '新字', learning: '學習中', known: '已熟' }
  const POS_LABELS: Record<PosGroup, string> = { noun: '名詞', verb: '動詞', adj: '形容詞', adv: '副詞', phrase: '片語', other: '其他' }
  const CEFR_LABELS: Record<CefrLevel, string> = { A1: 'A1', A2: 'A2', B1: 'B1', B2: 'B2', C1: 'C1', C2: 'C2', unknown: '未分級' }
  const SAVED_LABELS: Record<SavedWithin, string> = { all: '全部', today: '今天', '7d': '最近 7 天', '30d': '最近 30 天' }

  let open = $state(false)
  const counts = $derived(facetCounts(entries, filters, now))
  const active = $derived(activeFilterCount(filters))
  // 從閃卡或書中返回時若還有篩選，直接展開，避免忘了自己正在篩選
  onMount(() => {
    open = active > 0
  })
  // 只有一本書時不需要書本篩選
  const booksWithWords = $derived(books.filter((b) => counts.books.has(b.id)))

  // 複選切換：回傳新陣列，不修改原本的篩選
  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  const set = (patch: Partial<VocabFilters>) => onChange({ ...filters, ...patch })
</script>

<section class="filters">
  <div class="bar">
    <button class="toggle" aria-expanded={open} onclick={() => (open = !open)}>
      篩選{#if active > 0}<span class="badge">{active}</span>{/if} {open ? '▴' : '▾'}
    </button>
    {#if active > 0}
      <button class="clear" onclick={() => onChange(EMPTY_FILTERS)}>清除篩選</button>
    {/if}
  </div>

  {#if open}
    <div class="panel">
      <div class="group">
        <span class="label">熟練度</span>
        {#each LEVEL_BUCKETS as v (v)}
          <button class="chip" class:on={filters.levels.includes(v)} aria-pressed={filters.levels.includes(v)}
            class:empty={counts.levels[v] === 0} onclick={() => set({ levels: toggle(filters.levels, v) })}>
            {LEVEL_LABELS[v]} <span class="n">{counts.levels[v]}</span>
          </button>
        {/each}
      </div>

      <div class="group">
        <span class="label">難度</span>
        {#each CEFR_LEVELS as v (v)}
          <button class="chip" class:on={filters.cefr.includes(v)} aria-pressed={filters.cefr.includes(v)}
            class:empty={counts.cefr[v] === 0} onclick={() => set({ cefr: toggle(filters.cefr, v) })}>
            {CEFR_LABELS[v]} <span class="n">{counts.cefr[v]}</span>
          </button>
        {/each}
      </div>

      <div class="group">
        <span class="label">詞性</span>
        {#each POS_GROUPS as v (v)}
          <button class="chip" class:on={filters.pos.includes(v)} aria-pressed={filters.pos.includes(v)}
            class:empty={counts.pos[v] === 0} onclick={() => set({ pos: toggle(filters.pos, v) })}>
            {POS_LABELS[v]} <span class="n">{counts.pos[v]}</span>
          </button>
        {/each}
      </div>

      <div class="group">
        <span class="label">收藏時間</span>
        {#each Object.keys(SAVED_LABELS) as SavedWithin[] as v (v)}
          <button class="chip" class:on={filters.saved === v} aria-pressed={filters.saved === v}
            onclick={() => set({ saved: v })}>
            {SAVED_LABELS[v]} <span class="n">{counts.saved[v]}</span>
          </button>
        {/each}
      </div>

      {#if booksWithWords.length > 1}
        <div class="group">
          <span class="label">書</span>
          {#each booksWithWords as b (b.id)}
            <button class="chip book" class:on={filters.bookIds.includes(b.id)} aria-pressed={filters.bookIds.includes(b.id)}
              onclick={() => set({ bookIds: toggle(filters.bookIds, b.id) })}>
              {b.title} <span class="n">{counts.books.get(b.id) ?? 0}</span>
            </button>
          {/each}
        </div>
      {/if}

      <div class="group">
        <span class="label">其他</span>
        <button class="chip" class:on={filters.polysemous} aria-pressed={filters.polysemous}
          class:empty={counts.polysemous === 0} onclick={() => set({ polysemous: !filters.polysemous })}>
          一字多義 <span class="n">{counts.polysemous}</span>
        </button>
      </div>

      <p class="hint">同一類可複選；不同類會同時套用。「開始複習」只會出現篩選後的字。</p>
    </div>
  {/if}
</section>

<style>
  .filters { margin: 4px 0 16px; }
  .bar { display: flex; align-items: center; gap: 8px; }
  .toggle { display: inline-flex; align-items: center; gap: 6px; }
  .badge {
    background: var(--accent); color: var(--accent-text); border-radius: 999px;
    font-size: 0.75rem; min-width: 1.4em; padding: 0 6px; text-align: center;
  }
  .clear { border: none; background: transparent; color: var(--muted); text-decoration: underline; }
  .panel {
    margin-top: 10px; padding: 12px; border: 1px solid var(--border); border-radius: var(--radius);
    background: var(--surface); display: grid; gap: 10px;
  }
  .group { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
  .label { width: 4.5em; flex-shrink: 0; color: var(--muted); font-size: 0.85rem; }
  .chip {
    min-height: 36px; padding: 2px 10px; border-radius: 999px; font-size: 0.9rem;
    background: var(--bg); border: 1px solid var(--border);
  }
  .chip.on { background: var(--accent); color: var(--accent-text); border-color: var(--accent); }
  .chip.empty:not(.on) { opacity: 0.45; }
  .chip.book { max-width: 14em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .n { opacity: 0.7; font-size: 0.8em; margin-left: 2px; }
  .hint { margin: 0; color: var(--muted); font-size: 0.8rem; }
  @media (max-width: 480px) {
    .label { width: 100%; }
  }
</style>
