<script lang="ts">
  import { onMount } from 'svelte'
  import { db } from '../lib/db'
  import { loadReadingDays } from '../lib/stats/readingLog'
  import {
    dayKey, streakDays, lastSevenDays, loadGoal, saveGoal, countSavedSince, sevenDaysAgo, GOAL_OPTIONS, type ReadingDays,
  } from '../lib/stats/readingStats'

  const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
  // 連續天數最多往回算一年
  const LOOKBACK_DAYS = 400

  let days = $state<ReadingDays>(new Map())
  let goal = $state(loadGoal(localStorage))
  let savedThisWeek = $state(0)
  let today = $state(new Date())

  const minutes = (seconds: number) => Math.floor(seconds / 60)
  const todayMinutes = $derived(minutes(days.get(dayKey(today)) ?? 0))
  const streak = $derived(streakDays(days, today))
  const week = $derived(lastSevenDays(days, today))
  const weekMinutes = $derived(week.reduce((sum, d) => sum + minutes(d.seconds), 0))
  // 長條圖的高度上限：本週最多的一天或目標，取大者
  const scale = $derived(Math.max(goal, ...week.map((d) => minutes(d.seconds)), 1))
  const ratio = $derived(Math.min(1, todayMinutes / goal))
  const RING = 2 * Math.PI * 34

  function changeGoal(e: Event) {
    goal = Number((e.currentTarget as HTMLSelectElement).value)
    saveGoal(localStorage, goal)
  }

  onMount(async () => {
    today = new Date()
    const since = dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - LOOKBACK_DAYS))
    try {
      const [loaded, entries] = await Promise.all([loadReadingDays(db, since), db.vocab.toArray()])
      days = loaded
      savedThisWeek = countSavedSince(entries, sevenDaysAgo(today))
    } catch (err) {
      console.warn('讀取閱讀統計失敗', err)
    }
  })
</script>

<section class="stats glass" aria-label="閱讀統計">
  <div class="today">
    <svg viewBox="0 0 80 80" class="ring" aria-hidden="true">
      <circle cx="40" cy="40" r="34" class="track" />
      <circle cx="40" cy="40" r="34" class="fill" stroke-dasharray={RING} stroke-dashoffset={RING * (1 - ratio)} />
    </svg>
    <div class="ring-label">
      <strong>{todayMinutes}</strong>
      <span>/ {goal} 分</span>
    </div>
  </div>

  <div class="summary">
    <p class="headline">
      {#if todayMinutes >= goal}今天的目標完成了 🎉{:else}今天再讀 {goal - todayMinutes} 分鐘就達標{/if}
    </p>
    <div class="numbers">
      <div><strong>{streak}</strong><span>連續天數</span></div>
      <div><strong>{weekMinutes}</strong><span>7 天分鐘</span></div>
      <div><strong>{savedThisWeek}</strong><span>7 天新字</span></div>
    </div>
    <label class="goal">
      每日目標
      <select value={goal} onchange={changeGoal}>
        {#each GOAL_OPTIONS as m (m)}<option value={m}>{m} 分鐘</option>{/each}
      </select>
    </label>
  </div>

  <div class="week" role="img" aria-label={`最近 7 天共讀 ${weekMinutes} 分鐘`}>
    {#each week as d (d.date)}
      {@const m = minutes(d.seconds)}
      <div class="day" class:met={m >= goal} class:is-today={d.date === dayKey(today)}>
        <div class="bar"><div style:height="{(m / scale) * 100}%"></div></div>
        <span>{WEEKDAYS[new Date(`${d.date}T12:00`).getDay()]}</span>
      </div>
    {/each}
  </div>
</section>

<style>
  .stats {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 18px;
    align-items: center;
    padding: 16px 18px;
    margin-bottom: 22px;
  }
  .today { position: relative; width: 84px; height: 84px; }
  .ring { width: 100%; height: 100%; transform: rotate(-90deg); }
  .ring circle { fill: none; stroke-width: 8; }
  .track { stroke: var(--accent-soft); }
  .fill { stroke: var(--accent); stroke-linecap: round; transition: stroke-dashoffset 0.6s; }
  .ring-label { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.1; }
  .ring-label strong { font-family: var(--font-serif); font-size: 1.5rem; }
  .ring-label span { font-size: 0.72rem; color: var(--muted); }

  .summary { min-width: 0; display: flex; flex-direction: column; gap: 8px; }
  .headline { margin: 0; font-weight: 600; }
  .numbers { display: flex; gap: 18px; }
  .numbers div { display: flex; flex-direction: column; }
  .numbers strong { font-family: var(--font-serif); font-size: 1.2rem; }
  .numbers span { font-size: 0.75rem; color: var(--muted); }
  .goal { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: var(--muted); }
  .goal select { padding: 4px 8px; font-size: 16px; }

  .week { display: flex; gap: 6px; height: 84px; align-items: stretch; }
  .day { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 18px; }
  .day .bar { flex: 1; width: 10px; border-radius: 999px; background: var(--accent-soft); display: flex; align-items: flex-end; overflow: hidden; }
  .day .bar div { width: 100%; border-radius: 999px; background: color-mix(in srgb, var(--accent) 55%, transparent); }
  .day.met .bar div { background: var(--accent); }
  .day span { font-size: 0.7rem; color: var(--muted); }
  .day.is-today span { color: var(--accent-ink); font-weight: 700; }

  /* 手機：長條圖移到下一行 */
  @media (max-width: 560px) {
    .stats { grid-template-columns: auto 1fr; }
    .week { grid-column: 1 / -1; justify-content: space-between; height: 64px; }
  }
</style>
