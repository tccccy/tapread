<script lang="ts">
  import Library from './components/Library.svelte'
  import Reader from './components/Reader.svelte'

  let openBookId = $state<number | null>(null)
</script>

{#if openBookId === null}
  <Library onOpen={(id) => (openBookId = id)} />
{:else}
  <Reader bookId={openBookId} onClose={() => (openBookId = null)} />
{/if}
