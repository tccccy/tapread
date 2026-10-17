<script lang="ts">
  import { onMount } from 'svelte'
  import {
    FONTS, SPACINGS, WIDTHS, PALETTES, FONT_SIZE, webFamiliesOf, fontStack,
    type ReadingPrefs, type FontId, type ThemeId,
  } from '../lib/reading/prefs'
  import { loadWebFonts } from '../lib/reading/fonts'

  let { prefs, language, fixedLayout, onChange, onClose }: {
    prefs: ReadingPrefs
    language: string
    /** PDF 是固定版面，字體、字級、行距、頁寬都不能改 */
    fixedLayout: boolean
    onChange: (next: ReadingPrefs) => void
    onClose: () => void
  } = $props()

  const FONT_ORDER: FontId[] = ['serif', 'sans', 'kai', 'classic', 'original']
  const THEME_ORDER: ThemeId[] = ['auto', 'paper', 'sepia', 'night']
  const set = (patch: Partial<ReadingPrefs>) => onChange({ ...prefs, ...patch })

  // 字體選項要用各自的字體顯示，打開面板時先載入（只會下載「Aa 文」這幾個字所在的切片）
  onMount(() => {
    loadWebFonts(FONT_ORDER.flatMap(webFamiliesOf)).catch((err) => console.warn('載入字體預覽失敗', err))
  })
</script>

<div class="sheet glass" role="dialog" aria-label="閱讀設定">
  <header>
    <h2>閱讀設定</h2>
    <button class="close" onclick={onClose} aria-label="關閉閱讀設定">完成</button>
  </header>

  {#if fixedLayout}
    <p class="note">PDF 是固定版面，字體、大小與行距無法調整；紙張顏色只會改變頁面外圍。</p>
  {:else}
    <section>
      <h3>字體</h3>
      <div class="fonts" role="radiogroup" aria-label="字體">
        {#each FONT_ORDER as id (id)}
          {@const def = FONTS[id]}
          <button
            class="font"
            class:selected={prefs.font === id}
            role="radio"
            aria-checked={prefs.font === id}
            onclick={() => set({ font: id })}
          >
            <span class="sample" style:font-family={fontStack(id, language) ?? 'var(--font-serif)'}>
              {#if id === 'original'}<em>Aa</em>{:else}Aa 文{/if}
            </span>
            <span class="label">{def.label}</span>
            <span class="hint">{def.note}</span>
          </button>
        {/each}
      </div>
    </section>

    <section>
      <h3>字級 <span class="value">{prefs.fontSize}</span></h3>
      <div class="size">
        <button class="step" onclick={() => set({ fontSize: prefs.fontSize - 1 })} disabled={prefs.fontSize <= FONT_SIZE.min} aria-label="縮小字體">
          <span style:font-size="0.8rem">A</span>
        </button>
        <input
          type="range"
          min={FONT_SIZE.min}
          max={FONT_SIZE.max}
          step="1"
          value={prefs.fontSize}
          oninput={(e) => set({ fontSize: Number(e.currentTarget.value) })}
          aria-label="字級"
        />
        <button class="step" onclick={() => set({ fontSize: prefs.fontSize + 1 })} disabled={prefs.fontSize >= FONT_SIZE.max} aria-label="放大字體">
          <span style:font-size="1.3rem">A</span>
        </button>
      </div>
    </section>

    <section class="pair">
      <div>
        <h3>行距</h3>
        <div class="segmented" role="radiogroup" aria-label="行距">
          {#each Object.entries(SPACINGS) as [id, s] (id)}
            <button role="radio" aria-checked={prefs.spacing === id} class:selected={prefs.spacing === id}
              onclick={() => set({ spacing: id as ReadingPrefs['spacing'] })}>{s.label}</button>
          {/each}
        </div>
      </div>
      <div>
        <h3>頁寬</h3>
        <div class="segmented" role="radiogroup" aria-label="頁寬">
          {#each Object.entries(WIDTHS) as [id, w] (id)}
            <button role="radio" aria-checked={prefs.width === id} class:selected={prefs.width === id}
              onclick={() => set({ width: id as ReadingPrefs['width'] })}>{w.label}</button>
          {/each}
        </div>
      </div>
    </section>
  {/if}

  <section>
    <h3>紙張</h3>
    <div class="themes" role="radiogroup" aria-label="紙張顏色">
      {#each THEME_ORDER as id (id)}
        <button class="theme" role="radio" aria-checked={prefs.theme === id} class:selected={prefs.theme === id} onclick={() => set({ theme: id })}>
          {#if id === 'auto'}
            <span class="swatch auto" style:--a={PALETTES.paper.background} style:--b={PALETTES.night.background}></span>
            <span class="label">跟隨系統</span>
          {:else}
            <span class="swatch" style:background={PALETTES[id].background} style:color={PALETTES[id].text}>Aa</span>
            <span class="label">{PALETTES[id].label}</span>
          {/if}
        </button>
      {/each}
    </div>
  </section>
</div>

<style>
  .sheet {
    position: fixed;
    z-index: 30;
    left: 12px;
    right: 12px;
    bottom: calc(12px + env(safe-area-inset-bottom));
    max-height: min(78dvh, 620px);
    overflow-y: auto;
    padding: 14px 18px 18px;
    background: var(--surface-strong);
    color: var(--text);
  }
  /* 平板、電腦：從右上角的 Aa 按鈕下方展開 */
  @media (min-width: 700px) {
    .sheet { left: auto; bottom: auto; top: calc(64px + env(safe-area-inset-top)); right: 16px; width: 400px; }
  }
  header { display: flex; align-items: center; justify-content: space-between; }
  h2 { margin: 0; font-size: 1.15rem; }
  .close { min-height: 36px; padding: 0.3rem 0.95rem; }
  section { margin-top: 16px; }
  h3 {
    margin: 0 0 8px;
    font-family: var(--font-sans);
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--muted);
    display: flex;
    justify-content: space-between;
  }
  .value { font-variant-numeric: tabular-nums; }
  .note { margin: 14px 0 0; color: var(--muted); font-size: 0.9rem; }

  .fonts { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
  .font {
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    border-radius: var(--radius); padding: 10px 2px 8px; min-height: 0;
    border: 1.5px solid var(--border);
  }
  .sample { font-size: 1.35rem; line-height: 1.3; white-space: nowrap; }
  .font .label { font-size: 0.85rem; }
  .hint { font-size: 0.62rem; color: var(--muted); text-align: center; line-height: 1.2; min-height: 2.4em; }

  .size { display: flex; align-items: center; gap: 10px; }
  .size input { flex: 1; accent-color: var(--accent); padding: 0; border: none; background: none; }
  .step { width: 44px; padding: 0; display: grid; place-items: center; }

  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .segmented { display: flex; background: var(--accent-soft); border-radius: 999px; padding: 3px; }
  .segmented button {
    flex: 1; min-height: 36px; padding: 0.3rem 0; border: none; background: none; font-size: 0.9rem;
  }

  .themes { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .theme { display: flex; flex-direction: column; align-items: center; gap: 6px; border: none; background: none; padding: 4px 0; min-height: 0; }
  .swatch {
    width: 46px; height: 46px; border-radius: 50%;
    display: grid; place-items: center; font-family: var(--font-serif); font-size: 0.95rem;
    border: 1.5px solid var(--border);
  }
  .swatch.auto { background: linear-gradient(135deg, var(--a) 50%, var(--b) 50%); }
  .theme .label { font-size: 0.78rem; }

  .selected.font, .theme.selected .swatch { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-soft); }
  .segmented .selected { background: var(--surface-solid); box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12); font-weight: 600; }

  /* 手機：面板矮一點，才看得到後面書本的變化 */
  @media (max-width: 480px) {
    .fonts { gap: 6px; }
    .font { padding: 8px 0 6px; }
    .sample { font-size: 1.05rem; }
    .hint { display: none; }
    section { margin-top: 12px; }
  }
</style>
