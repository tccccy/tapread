<script lang="ts">
  import Library from './components/Library.svelte'
  import Reader from './components/Reader.svelte'
  import Settings from './components/Settings.svelte'
  import VocabHome, { type ReviewMode } from './components/VocabHome.svelte'
  import Review from './components/Review.svelte'

  /** 單字本的位置（語言分頁＋書本篩選），從閃卡或書中返回時還原 */
  type VocabPlace = { language?: string; bookId?: number }
  type ReaderScreen = { name: 'reader'; bookId: number; jumpTo?: string; returnToVocab?: VocabPlace }

  type Screen =
    | { name: 'library' }
    | ReaderScreen
    | { name: 'settings'; returnTo: ReaderScreen | null }
    | ({ name: 'vocab' } & VocabPlace)
    | { name: 'review'; language: string; bookId: number | undefined; mode: ReviewMode }

  let screen = $state<Screen>({ name: 'library' })

  const openLibrary = () => (screen = { name: 'library' })
  const openBook = (bookId: number) => (screen = { name: 'reader', bookId })
  const openVocab = (place: VocabPlace = {}) => (screen = { name: 'vocab', ...place })
</script>

{#if screen.name === 'library'}
  <Library onOpen={openBook} onOpenSettings={() => (screen = { name: 'settings', returnTo: null })} onOpenVocab={() => openVocab()} />
{:else if screen.name === 'reader'}
  {@const reader = screen}
  <Reader
    bookId={reader.bookId}
    jumpTo={reader.jumpTo}
    onClose={() => (reader.returnToVocab ? openVocab(reader.returnToVocab) : openLibrary())}
    onOpenSettings={() => (screen = { name: 'settings', returnTo: reader })}
  />
{:else if screen.name === 'settings'}
  {@const returnTo = screen.returnTo}
  <Settings onBack={() => (returnTo ? (screen = returnTo) : openLibrary())} />
{:else if screen.name === 'vocab'}
  <VocabHome
    initialLanguage={screen.language}
    initialBookId={screen.bookId}
    onBack={openLibrary}
    onReview={(language, bookId, mode) => (screen = { name: 'review', language, bookId, mode })}
    onJump={(bookId, cfi, language, filterBookId) =>
      (screen = { name: 'reader', bookId, jumpTo: cfi, returnToVocab: { language, bookId: filterBookId } })}
  />
{:else}
  {@const { language, bookId, mode } = screen}
  <Review {language} {bookId} {mode} onDone={() => openVocab({ language, bookId })} />
{/if}
