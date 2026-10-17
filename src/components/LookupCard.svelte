<script lang="ts" module>
  import type { Definition } from '../lib/ai/definition'

  export type CardState =
    | { status: 'loading'; word: string }
    | { status: 'done'; word: string; definition: Definition; saved: boolean }
    | { status: 'error'; word: string; message: string; needsSettings: boolean }
</script>

<script lang="ts">
  let { card, onClose, onOpenSettings, onToggleSave }: {
    card: CardState
    onClose: () => void
    onOpenSettings: () => void
    onToggleSave: () => void
  } = $props()
</script>

<section class="card" aria-live="polite">
  <header>
    <div class="headword">
      <span class="word">{card.word}</span>
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
  {:else}
    {@const d = card.definition}
    <dl>
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
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.18);
    padding: 12px 16px 16px;
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
  .save.saved { color: var(--accent); border-color: var(--accent); }
  .close { border: none; background: transparent; min-height: 36px; padding: 4px 8px; color: var(--muted); }
  dl { margin: 8px 0 0; display: grid; gap: 4px; }
  dt { color: var(--muted); font-size: 0.8rem; margin-top: 6px; }
  dd { margin: 0; line-height: 1.5; }
  .context { font-size: 1.1rem; font-weight: 600; }
  .muted { color: var(--muted); }
  .error { color: var(--danger); }
</style>
