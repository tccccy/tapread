<script lang="ts">
  import { onMount } from 'svelte'
  import Bookshelf from './components/Bookshelf.svelte'
  import BookDetail from './components/BookDetail.svelte'
  import Reader from './components/Reader.svelte'
  import Settings from './components/Settings.svelte'
  import VocabHome, { type VocabPlace } from './components/VocabHome.svelte'
  import Review from './components/Review.svelte'
  import UpdateBanner from './components/UpdateBanner.svelte'
  import TabBar, { type Tab } from './components/TabBar.svelte'

  type Screen =
    | { name: 'shelf' }
    | { name: 'book'; bookId: number }
    | { name: 'reader'; bookId: number; jumpTo?: string }
    /** fromReader：從閱讀頁進來（有返回鍵、不顯示分頁列） */
    | { name: 'settings'; fromReader?: boolean }
    | { name: 'vocab'; place: VocabPlace }
    | { name: 'review'; place: VocabPlace; ids: string[] }

  // 往內走（書架 → 書 → 閱讀）時記下上一頁與捲動位置；搭配瀏覽器歷史，
  // iPhone 往右滑、Android 返回鍵、App 內的返回鍵都回到上一層
  type Entry = { screen: Screen; scrollY: number }
  let screen = $state<Screen>({ name: 'shelf' })
  let stack = $state<Entry[]>([])

  const TAB_OF: Partial<Record<Screen['name'], Tab>> = { shelf: 'shelf', book: 'shelf', vocab: 'vocab', settings: 'settings' }
  const activeTab = $derived(screen.name === 'settings' && screen.fromReader ? null : TAB_OF[screen.name] ?? null)
  const BACK_LABEL: Partial<Record<Screen['name'], string>> = { shelf: '書架', book: '這本書', vocab: '單字本' }
  const backLabel = $derived(BACK_LABEL[stack.at(-1)?.screen.name ?? 'shelf'] ?? '返回')

  function go(next: Screen) {
    stack.push({ screen, scrollY: window.scrollY })
    history.pushState({ tapread: stack.length }, '')
    screen = next
    window.scrollTo(0, 0)
  }

  // 離開單字本前，把目前的語言與篩選記進歷史，返回時才還原得回來
  function leaveVocab(place: VocabPlace, next: Screen) {
    screen = { name: 'vocab', place }
    go(next)
  }

  function back() {
    if (stack.length > 0) history.back() // 由 popstate 切回上一頁
    else screen = { name: 'shelf' }
  }

  function onPopState() {
    const prev = stack.pop()
    screen = prev?.screen ?? { name: 'shelf' }
    const y = prev?.scrollY ?? 0
    requestAnimationFrame(() => window.scrollTo(0, y))
  }

  // 切換分頁：從頭開始，不保留上一個分頁的瀏覽路徑
  function selectTab(tab: Tab) {
    stack = []
    history.replaceState({ tapread: 0 }, '')
    screen = tab === 'shelf' ? { name: 'shelf' } : tab === 'vocab' ? { name: 'vocab', place: {} } : { name: 'settings' }
    window.scrollTo(0, 0)
  }

  onMount(() => {
    history.replaceState({ tapread: 0 }, '')
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  })
</script>

<div class="app" class:with-tabbar={activeTab !== null}>
  {#if screen.name === 'shelf'}
    <Bookshelf
      onOpenBook={(bookId) => go({ name: 'book', bookId })}
      onRead={(bookId) => go({ name: 'reader', bookId })}
      onOpenSettings={() => selectTab('settings')}
    />
  {:else if screen.name === 'book'}
    {@const detailId = screen.bookId}
    <BookDetail
      bookId={detailId}
      onBack={back}
      onRead={(bookId) => go({ name: 'reader', bookId })}
      onOpenVocab={(place) => go({ name: 'vocab', place })}
      onJump={(cfi) => go({ name: 'reader', bookId: detailId, jumpTo: cfi })}
    />
  {:else if screen.name === 'reader'}
    <Reader
      bookId={screen.bookId}
      jumpTo={screen.jumpTo}
      {backLabel}
      onClose={back}
      onOpenSettings={() => go({ name: 'settings', fromReader: true })}
    />
  {:else if screen.name === 'settings'}
    <Settings onBack={screen.fromReader ? back : undefined} />
  {:else if screen.name === 'vocab'}
    <VocabHome
      initialPlace={screen.place}
      onReview={(place, ids) => leaveVocab(place, { name: 'review', place, ids })}
      onJump={(bookId, cfi, place) => leaveVocab(place, { name: 'reader', bookId, jumpTo: cfi })}
    />
  {:else}
    {@const { place, ids } = screen}
    <Review language={place.language ?? ''} {ids} preferBookIds={place.filters?.bookIds ?? []} onDone={back} />
  {/if}
</div>

{#if activeTab !== null}<TabBar active={activeTab} onSelect={selectTab} />{/if}
<UpdateBanner />

<style>
  .app { min-height: 100%; }
  /* 電腦寬螢幕：分頁列在左側，內容往右讓開 */
  @media (min-width: 1100px) {
    .app.with-tabbar { padding-left: 240px; }
  }
</style>
