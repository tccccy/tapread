<script lang="ts" module>
  import type { Definition } from '../lib/ai/definition'
  import type { Translation } from '../lib/ai/translate'

  export type CardState =
    | { status: 'loading'; word: string }
    | { status: 'done'; word: string; definition: Definition; saved: boolean; sentence: string }
    | { status: 'translated'; word: string; translation: Translation }
    | { status: 'error'; word: string; message: string; needsSettings: boolean }
</script>

<script lang="ts">
  import { canSpeak, speak } from '../lib/speech'

  let { card, language, onClose, onOpenSettings, onToggleSave, onHighlight }: {
    card: CardState
    /** 書的語言，發音用 */
    language: string
    onClose: () => void
    onOpenSettings: () => void
    onToggleSave: () => void
    /** 整句翻譯：把這句劃線存成書摘 */
    onHighlight: () => void
  } = $props()

  let highlighted = $state(false)
  $effect(() => {
    // 換成另一句時，劃線按鈕回到可按的狀態
    void card.word
    highlighted = false
  })

  const speechOk = canSpeak()
</script>

<section class="card" aria-live="polite">
  <header>
    <div class="headword">
      <span class="word" class:sentence={card.status === 'translated' || (card.status === 'loading' && card.word.length > 60)}>{card.word}</span>
      {#if speechOk}
        <button class="speak" onclick={() => speak(card.word, language, card.status === 'translated' ? 0.9 : 0.8)} aria-label={`念出 ${card.word}`}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" /><path class="wave" d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" /></svg>
        </button>
      {/if}
      {#if card.status === 'done'}
        {@const d = card.definition}
        <span class="meta">
          {#if d.lemma.toLocaleLowerCase() !== card.word.toLocaleLowerCase()}→ {d.lemma}{/if}
          {#if d.pos}<span class="pos">{d.pos}</span>{/if}
          {#if d.cefr}<span class="pos" title="CEFR 難度">{d.cefr}</span>{/if}
        </span>
      {/if}
    </div>
    <div class="tools">
      {#if card.status === 'translated'}
        <button class="save" class:saved={highlighted} disabled={highlighted} onclick={() => { highlighted = true; onHighlight() }}>
          {highlighted ? '已劃線' : '劃線'}
        </button>
      {/if}
      {#if card.status === 'done'}
        <button class="save" class:saved={card.saved} onclick={onToggleSave} aria-pressed={card.saved}>
          {card.saved ? '★ 已收藏' : '☆ 收藏'}
        </button>
      {/if}
      <button class="close" onclick={onClose} aria-label="關閉釋義">✕</button>
    </div>
  </header>

  {#if card.status === 'loading'}
    <p class="muted">查詢中…</p>
  {:else if card.status === 'error'}
    <p class="error" role="alert">{card.message}</p>
    {#if card.needsSettings}<button class="primary" onclick={onOpenSettings}>前往設定</button>{/if}
  {:else if card.status === 'translated'}
    {@const t = card.translation}
    <dl>
      <dt>翻譯</dt>
      <dd class="context">{t.translation}</dd>
      {#if t.grammar.length > 0}
        <dt>重點</dt>
        <dd>
          <ul class="grammar">
            {#each t.grammar as g, i (i)}
              <li><strong>{g.part}</strong>　{g.explanation}</li>
            {/each}
          </ul>
        </dd>
      {/if}
    </dl>
  {:else}
    {@const d = card.definition}
    <dl>
      {#if speechOk && card.sentence}
        <dd><button class="speak-sentence" onclick={() => speak(card.sentence, language)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" /><path class="wave" d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" /></svg>
          念整句
        </button></dd>
      {/if}
      <dt>此句意思</dt>
      <dd class="context">{d.contextMeaning}</dd>
      {#if d.dictMeaning}
        <dt>字典釋義</dt>
        <dd>{d.dictMeaning}</dd>
      {/if}
      {#if d.note}
        <dt>補充</dt>
        <dd>{d.note}</dd>
      {/if}
    </dl>
  {/if}
</section>

<style>
  .card {
    position: absolute;
    left: 50%;
    bottom: 12px;
    transform: translateX(-50%);
    width: min(640px, calc(100% - 24px));
    max-height: 45%;
    overflow-y: auto;
    background: var(--surface-strong);
    -webkit-backdrop-filter: var(--glass-blur);
    backdrop-filter: var(--glass-blur);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--glass-shadow);
    padding: 14px 18px 18px;
    z-index: 10;
  }
  header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .headword { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; min-width: 0; }
  .word { font-size: 1.35rem; font-weight: 700; overflow-wrap: anywhere; }
  .meta { color: var(--muted); }
  .pos {
    margin-left: 6px;
    font-size: 0.8rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 1px 6px;
  }
  .tools { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
  .save { min-height: 36px; padding: 4px 10px; font-size: 0.9rem; }
  .save.saved { color: var(--accent-ink); border-color: var(--accent); }
  .close { border: none; background: transparent; min-height: 36px; padding: 4px 8px; color: var(--muted); }
  dl { margin: 8px 0 0; display: grid; gap: 4px; }
  dt { color: var(--muted); font-size: 0.8rem; margin-top: 6px; }
  dd { margin: 0; line-height: 1.5; }
  .context { font-size: 1.1rem; font-weight: 600; }
  .muted { color: var(--muted); }
  .error { color: var(--danger); }
  .word.sentence { font-size: 1rem; font-weight: 500; font-family: var(--font-serif); line-height: 1.5; }
  .grammar { margin: 0; padding-left: 1.1em; display: grid; gap: 4px; }
  .grammar strong { font-family: var(--font-serif); }
  .speak { width: 36px; min-height: 36px; padding: 0; display: inline-grid; place-items: center; align-self: center; }
  .speak-sentence { min-height: 32px; padding: 2px 12px 2px 8px; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 4px; }
  .speak svg, .speak-sentence svg { width: 18px; height: 18px; fill: currentColor; }
  .speak .wave, .speak-sentence .wave { fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; }
</style>
