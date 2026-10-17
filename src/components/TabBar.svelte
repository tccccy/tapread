<script lang="ts" module>
  export type Tab = 'shelf' | 'vocab' | 'settings'
</script>

<script lang="ts">
  let { active, onSelect }: { active: Tab | null; onSelect: (tab: Tab) => void } = $props()

  const TABS: { id: Tab; label: string; icon: string }[] = [
    // 書架、卡片、齒輪（線條圖示，跟著文字顏色）
    { id: 'shelf', label: '書架', icon: 'M4 4h3v16H4zM9 4h3v16H9zM14.5 4.6l2.9-.8 4.1 15.4-2.9.8zM3 21h18' },
    { id: 'vocab', label: '單字本', icon: 'M7 3h11a2 2 0 0 1 2 2v12M4 7a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM8 11h5M8 15h3' },
    { id: 'settings', label: '設定', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z' },
  ]
</script>

<nav class="tabbar glass" aria-label="主要頁面">
  <div class="brand" aria-hidden="true">TapRead</div>
  {#each TABS as t (t.id)}
    <button class:active={active === t.id} aria-current={active === t.id ? 'page' : undefined} onclick={() => onSelect(t.id)}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d={t.icon} /></svg>
      <span>{t.label}</span>
    </button>
  {/each}
</nav>

<style>
  .tabbar {
    position: fixed;
    z-index: 50;
    left: 50%;
    bottom: max(14px, env(safe-area-inset-bottom));
    transform: translateX(-50%);
    display: flex;
    gap: 4px;
    padding: 6px;
    border-radius: 999px;
    background: var(--surface-strong);
  }
  .brand { display: none; }
  button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-width: 76px;
    min-height: 54px;
    padding: 4px 14px;
    border: none;
    background: transparent;
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
    color: var(--muted);
    font-size: 0.75rem;
  }
  button.active { background: var(--accent); color: var(--accent-text); box-shadow: 0 6px 16px rgba(138, 90, 59, 0.28); }
  svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }

  /* 電腦寬螢幕：改成左側欄（像 Readowl） */
  @media (min-width: 1100px) {
    .tabbar {
      left: 20px;
      top: 20px;
      bottom: 20px;
      transform: none;
      flex-direction: column;
      justify-content: flex-start;
      width: 200px;
      padding: 22px 12px;
      border-radius: var(--radius-lg);
      gap: 6px;
    }
    .brand {
      display: block;
      font-family: var(--font-serif);
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--accent);
      padding: 0 12px 18px;
    }
    button {
      flex-direction: row;
      justify-content: flex-start;
      gap: 12px;
      min-height: 48px;
      border-radius: var(--radius);
      font-size: 1rem;
      padding: 0 14px;
    }
  }
</style>
