<script lang="ts">
  import { splitAround } from '../lib/vocab/list'

  // 書中原句，目標字加底色（文字插值，不用 {@html}，避免書本內容造成 XSS）
  let { sentence, word }: { sentence: string; word: string } = $props()
  const parts = $derived(splitAround(sentence, word))
</script>

<span class="sentence">{parts[0]}{#if parts[1]}<mark>{parts[1]}</mark>{/if}{parts[2]}</span>

<style>
  mark { color: inherit; background: rgba(120, 170, 220, 0.35); border-radius: 4px; padding: 0 2px; font-weight: 700; }
</style>
