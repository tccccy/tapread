<script lang="ts">
  import { onMount } from 'svelte'
  import { registerSW } from 'virtual:pwa-register'

  // iPad 上常常整天開著不關，定期向伺服器確認有沒有新版本；
  // iOS 在背景會暫停計時器，所以切回 App 時也檢查一次（最多每 5 分鐘一次）
  const CHECK_INTERVAL_MS = 60 * 60 * 1000
  const MIN_CHECK_GAP_MS = 5 * 60 * 1000
  // 換版時偶爾等不到新版本接手（例如 iOS 另一個視窗還開著舊版），逾時就直接重新載入
  const UPDATE_FALLBACK_MS = 5000

  let needRefresh = $state(false)
  let updating = $state(false)
  let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null

  onMount(() => {
    let registration: ServiceWorkerRegistration | undefined
    let lastCheck = 0

    const check = async () => {
      if (!registration || Date.now() - lastCheck < MIN_CHECK_GAP_MS) return
      lastCheck = Date.now()
      await registration.update().catch(() => {})
      // 先前按了「稍後」：同一個新版本不會再觸發 onNeedRefresh，這裡補提示
      if (registration.waiting) needRefresh = true
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }

    updateSW = registerSW({
      onNeedRefresh: () => (needRefresh = true),
      onRegisteredSW: (_url, reg) => {
        registration = reg
        lastCheck = Date.now()
      },
      onRegisterError: (e) => console.error('Service Worker 註冊失敗', e),
    })
    const timer = setInterval(check, CHECK_INTERVAL_MS)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  })

  async function update() {
    updating = true
    setTimeout(() => location.reload(), UPDATE_FALLBACK_MS)
    try {
      await updateSW?.(true)
    } catch (e) {
      console.error('更新失敗', e)
      location.reload()
    }
  }
</script>

{#if needRefresh}
  <div class="update" role="status">
    <span>有新版本可以使用。</span>
    <button class="primary" disabled={updating} onclick={update}>{updating ? '更新中…' : '更新'}</button>
    <button disabled={updating} onclick={() => (needRefresh = false)}>稍後</button>
  </div>
{/if}

<style>
  .update {
    position: fixed;
    left: 50%;
    bottom: max(16px, env(safe-area-inset-bottom));
    transform: translateX(-50%);
    z-index: 100;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px 10px 16px;
    background: var(--surface);
    border: 1px solid var(--accent);
    border-radius: 14px;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.2);
    width: max-content;
    max-width: calc(100% - 32px);
  }
</style>
