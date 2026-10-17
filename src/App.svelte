<script lang="ts">
  import Library from './components/Library.svelte'
  import Reader from './components/Reader.svelte'
  import Settings from './components/Settings.svelte'
  import VocabHome, { type VocabPlace } from './components/VocabHome.svelte'
  import Review from './components/Review.svelte'
  import UpdateBanner from './components/UpdateBanner.svelte'

  type ReaderScreen = { name: 'reader'; bookId: number; jumpTo?: string; returnToVocab?: VocabPlace }

  type Screen =
    | { name: 'library' }
    | ReaderScreen
    | { name: 'settings'; returnTo: ReaderScreen | null }
    | { name: 'vocab'; place: VocabPlace }
    | { name: 'review'; place: VocabPlace; ids: string[] }

  let screen = $state<Screen>({ name: 'library' })

  const openLibrary = () => (screen = { name: 'library' })
  const openBook = (bookId: number) => (screen = { name: 'reader', bookId })
  const openVocab = (place: VocabPlace = {}) => (screen = { name: 'vocab', place })
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
    initialPlace={screen.place}
    onBack={openLibrary}
    onReview={(place, ids) => (screen = { name: 'review', place, ids })}
    onJump={(bookId, cfi, place) => (screen = { name: 'reader', bookId, jumpTo: cfi, returnToVocab: place })}
  />
{:else}
  {@const { place, ids } = screen}
  <Review language={place.language ?? ''} {ids} preferBookIds={place.filters?.bookIds ?? []} onDone={() => openVocab(place)} />
{/if}

<UpdateBanner />
