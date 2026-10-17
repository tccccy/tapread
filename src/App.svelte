<script lang="ts">
  import Library from './components/Library.svelte'
  import Reader from './components/Reader.svelte'
  import Settings from './components/Settings.svelte'
  import VocabHome, { type ReviewMode } from './components/VocabHome.svelte'
  import Review from './components/Review.svelte'

  type Screen =
    | { name: 'library' }
    | { name: 'reader'; bookId: number }
    | { name: 'settings'; returnTo: number | null }
    | { name: 'vocab' }
    | { name: 'review'; language: string; bookId: number | undefined; mode: ReviewMode }

  let screen = $state<Screen>({ name: 'library' })

  const openLibrary = () => (screen = { name: 'library' })
  const openBook = (bookId: number) => (screen = { name: 'reader', bookId })
  const openSettings = (returnTo: number | null) => (screen = { name: 'settings', returnTo })
  const openVocab = () => (screen = { name: 'vocab' })
</script>

{#if screen.name === 'library'}
  <Library onOpen={openBook} onOpenSettings={() => openSettings(null)} onOpenVocab={openVocab} />
{:else if screen.name === 'reader'}
  {@const bookId = screen.bookId}
  <Reader {bookId} onClose={openLibrary} onOpenSettings={() => openSettings(bookId)} />
{:else if screen.name === 'settings'}
  {@const returnTo = screen.returnTo}
  <Settings onBack={() => (returnTo === null ? openLibrary() : openBook(returnTo))} />
{:else if screen.name === 'vocab'}
  <VocabHome onBack={openLibrary} onReview={(language, bookId, mode) => (screen = { name: 'review', language, bookId, mode })} />
{:else}
  <Review language={screen.language} bookId={screen.bookId} mode={screen.mode} onDone={openVocab} />
{/if}
