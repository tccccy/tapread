<script lang="ts">
  import { onMount } from 'svelte'
  import { db } from '../lib/db'
  import { requestPersistentStorage } from '../lib/library'
  import { formatBytes, REMIND_AFTER_DAYS } from '../lib/backup/reminder'

  let { lastBackupAt, onBackupNow }: {
    /** 上次匯出備份的時間；從沒備份過為 null */
    lastBackupAt: number | null
    onBackupNow: () => void
  } = $props()

  const DAY = 86_400_000
  const dateFormat = new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric' })

  let usage = $state<number | null>(null)
  let quota = $state<number | null>(null)
  let persisted = $state<boolean | null>(null)
  let counts = $state({ books: 0, words: 0, quotes: 0 })
  let asking = $state(false)
  let persistMessage = $state('')

  const ratio = $derived(usage !== null && quota ? Math.min(1, usage / quota) : 0)
  const daysSince = $derived(lastBackupAt === null ? null : Math.floor((Date.now() - lastBackupAt) / DAY))
  const overdue = $derived(counts.books > 0 && (daysSince === null || daysSince >= REMIND_AFTER_DAYS))

  async function refresh() {
    try {
      const estimate = await navigator.storage?.estimate?.()
      usage = estimate?.usage ?? null
      quota = estimate?.quota ?? null
      persisted = (await navigator.storage?.persisted?.()) ?? null
      counts = { books: await db.books.count(), words: await db.vocab.count(), quotes: await db.highlights.count() }
    } catch (e) {
      console.warn('讀取儲存空間失敗', e)
    }
  }

  async function askPersist() {
    asking = true
    try {
      persisted = await requestPersistentStorage()
      persistMessage = persisted ? '' : '瀏覽器這次沒有同意。加入主畫面、常常使用之後再試一次，通常就會同意。'
    } catch (e) {
      console.warn('申請持久保存失敗', e)
      persistMessage = '申請失敗，請稍後再試。'
    } finally {
      asking = false
    }
  }

  onMount(refresh)
</script>

<section class="storage">
  <h2>儲存空間</h2>

  <div class="usage">
    {#if usage !== null}
      <div class="bar" role="img" aria-label={`已使用 ${formatBytes(usage)}`}><div style:width="{Math.max(ratio * 100, 1)}%"></div></div>
      <p>已使用 <strong>{formatBytes(usage)}</strong>{#if quota}，這台裝置最多可用約 {formatBytes(quota)}{/if}</p>
    {:else}
      <p class="muted">這個瀏覽器無法顯示使用量。</p>
    {/if}
    <p class="counts">{counts.books} 本書・{counts.words} 個單字・{counts.quotes} 則書摘</p>
  </div>

  <dl>
    <dt>持久保存</dt>
    <dd>
      {#if persisted}
        <span class="ok">✓ 已開啟</span>：空間不足時，瀏覽器不會自動清掉這裡的資料。
      {:else if persisted === false}
        <span class="warn">未開啟</span>：裝置空間不足時，資料有可能被瀏覽器清掉。
        <button class="small" disabled={asking} onclick={askPersist}>{asking ? '申請中…' : '申請持久保存'}</button>
        {#if persistMessage}<span class="muted block">{persistMessage}</span>{/if}
      {:else}
        <span class="muted">這個瀏覽器不支援。</span>
      {/if}
    </dd>

    <dt>上次備份</dt>
    <dd>
      {#if lastBackupAt === null}
        <span class:warn={overdue}>還沒備份過</span>
      {:else}
        <span class:warn={overdue}>{dateFormat.format(lastBackupAt)}（{daysSince === 0 ? '今天' : `${daysSince} 天前`}）</span>
      {/if}
      {#if overdue}
        <span class="block">建議定期備份：換手機、清除瀏覽器資料時，可以靠備份把書和單字找回來。</span>
        <button class="small primary" onclick={onBackupNow}>現在備份 ↓</button>
      {/if}
    </dd>
  </dl>
</section>

<style>
  .storage { margin-top: 28px; }
  h2 { font-size: 1rem; margin: 0 0 10px; }
  .usage { margin-bottom: 12px; }
  .usage p { margin: 6px 0 0; }
  .bar { height: 10px; border-radius: 999px; background: var(--accent-soft); overflow: hidden; }
  .bar div { height: 100%; border-radius: 999px; background: var(--accent); }
  .counts { color: var(--muted); font-size: 0.9rem; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 10px 14px; margin: 0; }
  dt { color: var(--muted); font-size: 0.9rem; padding-top: 2px; white-space: nowrap; }
  dd { margin: 0; line-height: 1.6; }
  .ok { color: var(--accent-ink); font-weight: 600; }
  .warn { color: var(--danger); font-weight: 600; }
  .muted { color: var(--muted); font-size: 0.88rem; }
  .block { display: block; margin-top: 4px; }
  .small { min-height: 36px; padding: 0.25rem 0.9rem; font-size: 0.88rem; margin-top: 6px; display: inline-block; }
</style>
