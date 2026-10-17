<script lang="ts">
  // 5 顆星，可半顆；點星星左半邊＝半顆。鍵盤：左右鍵 ±0.5、Home／Delete 清除
  let { value, onChange, size = 30 }: { value: number | null; onChange: (v: number | null) => void; size?: number } = $props()

  const STARS = [1, 2, 3, 4, 5]
  let slider: HTMLDivElement
  const fill = (i: number) => Math.max(0, Math.min(1, (value ?? 0) - (i - 1)))

  function pick(e: MouseEvent, i: number) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const next = e.clientX - rect.left < rect.width / 2 ? i - 0.5 : i
    onChange(next === value ? null : next) // 再點一次同一個值＝取消
    slider.focus() // 點完後方向鍵仍可微調
  }

  function onKey(e: KeyboardEvent) {
    const v = value ?? 0
    const map: Record<string, number | null> = {
      ArrowRight: Math.min(5, v + 0.5), ArrowUp: Math.min(5, v + 0.5),
      ArrowLeft: v - 0.5, ArrowDown: v - 0.5, Home: null, Delete: null, Backspace: null, End: 5,
    }
    if (!(e.key in map)) return
    e.preventDefault()
    const next = map[e.key]
    onChange(next !== null && next <= 0 ? null : next)
  }
</script>

<div
  bind:this={slider}
  class="stars"
  role="slider"
  aria-orientation="horizontal"
  tabindex="0"
  aria-label="評分"
  aria-valuemin={0}
  aria-valuemax={5}
  aria-valuenow={value ?? 0}
  aria-valuetext={value ? `${value} 顆星` : '尚未評分'}
  onkeydown={onKey}
  style:--size="{size}px"
>
  {#each STARS as i (i)}
    <button type="button" tabindex="-1" class="star" onclick={(e) => pick(e, i)} aria-hidden="true">
      <svg viewBox="0 0 24 24"><path class="empty" d={STAR} /></svg>
      <svg viewBox="0 0 24 24" class="filled" style:clip-path="inset(0 {100 - fill(i) * 100}% 0 0)"><path d={STAR} /></svg>
    </button>
  {/each}
  <span class="value">{value ? value.toFixed(1) : '—'}</span>
</div>

<script lang="ts" module>
  const STAR = 'M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z'
</script>

<style>
  .stars { display: inline-flex; align-items: center; gap: 2px; border-radius: 999px; padding: 2px 6px; }
  .stars:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .star {
    position: relative;
    width: var(--size);
    height: var(--size);
    min-height: 0;
    padding: 0;
    border: none;
    background: none;
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
  svg { position: absolute; inset: 0; width: 100%; height: 100%; }
  .empty { fill: none; stroke: var(--star); stroke-width: 1.4; opacity: 0.55; }
  .filled path { fill: var(--star); }
  /* 觸控螢幕：星星放大，半顆的點擊範圍才夠大 */
  @media (pointer: coarse) {
    .star { width: max(var(--size), 40px); height: max(var(--size), 40px); }
  }
  .value { margin-left: 8px; color: var(--muted); font-variant-numeric: tabular-nums; min-width: 2.2em; }
</style>
