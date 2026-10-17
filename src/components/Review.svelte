<script lang="ts">
  import { onMount } from 'svelte'
  import { db } from '../lib/db'
  import { createVocabStore } from '../lib/vocab/store'
  import { MAX_LEVEL, type ReviewGrade, type VocabEntry, type VocabExample } from '../lib/vocab/model'
  import { languageLabel } from '../lib/languageName'
  import type { ReviewMode } from './VocabHome.svelte'

  let { language, bookId, mode, onDone }: {
    language: string
    bookId: number | undefined
    mode: ReviewMode
    onDone: () => void
  } = $props()

  const vocab = createVocabStore(db)

  let queue = $state<VocabEntry[]>([])
  let example = $state<VocabExample | null>(null)
  let flipped = $state(false)
  let reviewed = $state(0)
  let total = $state(0)
  let loading = $state(true)
  let busy = $state(false)
  let error = $state('')

  const card = $derived(queue[0] ?? null)

  // 依書篩選時優先用那本書的例句；多個例句時隨機挑一個，換不同句子練習
  const pickExample = (entry: VocabEntry) => {
    const pool = entry.examples.filter((x) => bookId === undefined || x.bookId === bookId)
    const list = pool.length > 0 ? pool : entry.examples
    return list[Math.floor(Math.random() * list.length)] ?? null
  }

  const showNext = (next: VocabEntry[]) => {
    queue = next
    flipped = false
    example = next[0] ? pickExample(next[0]) : null
  }

  // 例句中把目標字切出來加粗（不使用 {@html}，避免書本內容造成 XSS）
  const splitSentence = (sentence: string, word: string) => {
    const i = sentence.toLocaleLowerCase().indexOf(word.toLocaleLowerCase())
    return i < 0 ? [sentence, '', ''] : [sentence.slice(0, i), sentence.slice(i, i + word.length), sentence.slice(i + word.length)]
  }

  onMount(async () => {
    try {
      const cards = mode === 'due'
        ? await vocab.dueCards(language, bookId)
        : (await vocab.list(language, bookId)).filter((e) => e.level < MAX_LEVEL)
      total = cards.length
      showNext(cards)
    } catch (e) {
      console.error('讀取複習卡片失敗', e)
      error = '讀取複習卡片失敗。'
    } finally {
      loading = false
    }
  })

  async function grade(g: ReviewGrade) {
    if (!card || busy) return
    busy = true
    try {
      const updated = await vocab.review(card.id, g)
      reviewed++
      // 不記得的字放回隊尾，這一輪再練一次
      showNext(g === 'again' ? [...queue.slice(1), updated] : queue.slice(1))
    } catch (e) {
      console.error('儲存複習結果失敗', e)
      error = '儲存失敗，請再試一次。'
    } finally {
      busy = false
    }
  }

  async function removeCard() {
    if (!card || !confirm(`確定要把「${card.lemma}」從單字本移除嗎？`)) return
    try {
      await vocab.remove(card.id)
      total--
      showNext(queue.slice(1))
    } catch (e) {
      console.error('移除失敗', e)
      error = '移除失敗，請再試一次。'
    }
  }

  const onKey = (e: KeyboardEvent) => {
    if (!card) return
    if (!flipped && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault()
      flipped = true
    } else if (flipped && e.key === '1') grade('again')
    else if (flipped && e.key === '2') grade('good')
    else if (flipped && e.key === '3') grade('known')
  }
</script>

<svelte:window onkeydown={onKey} />

<main>
  <header>
    <button onclick={onDone}>← 單字本</button>
    <h1>{languageLabel(language)}複習</h1>
    {#if card}<span class="progress">剩 {queue.length} 張</span>{/if}
  </header>

  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#if loading}
    <p class="muted">載入中…</p>
  {:else if !card}
    <section class="done">
      <p class="big">{total === 0 ? '沒有需要複習的字。' : '完成！'}</p>
      {#if reviewed > 0}<p class="muted">這一輪複習了 {reviewed} 次。</p>{/if}
      <button class="primary" onclick={onDone}>回單字本</button>
    </section>
  {:else}
    <section class="card">
      <p class="lemma">{card.lemma}</p>
      {#if example}
        {@const [pre, hit, post] = splitSentence(example.sentence, example.word)}
        <p class="sentence">{pre}<strong>{hit}</strong>{post}</p>
        <p class="source">— {example.bookTitle}</p>
      {/if}

      {#if !flipped}
        <button class="primary flip" onclick={() => (flipped = true)}>翻面看意思</button>
      {:else}
        <div class="answer">
          {#if card.pos}<span class="pos">{card.pos}</span>{/if}
          {#if example}<p class="meaning">{example.contextMeaning}</p>{/if}
          {#if card.dictMeaning}<p><span class="label">字典釋義</span>{card.dictMeaning}</p>{/if}
          {#if example?.note}<p><span class="label">補充</span>{example.note}</p>{/if}
          {#if card.examples.length > 1}
            <details>
              <summary>其他例句（{card.examples.length - 1}）</summary>
              <ul>
                {#each card.examples.filter((x) => x !== example) as x (x.sentence + x.word)}
                  <li><span>{x.sentence}</span><span class="muted">→ {x.contextMeaning}</span></li>
                {/each}
              </ul>
            </details>
          {/if}
        </div>
        <div class="grades">
          <button disabled={busy} onclick={() => grade('again')}>不記得<kbd>1</kbd></button>
          <button class="primary" disabled={busy} onclick={() => grade('good')}>記得<kbd>2</kbd></button>
          <button disabled={busy} onclick={() => grade('known')}>已熟<kbd>3</kbd></button>
        </div>
        <button class="remove" onclick={removeCard}>從單字本移除</button>
      {/if}
    </section>
  {/if}
</main>

<style>
  main { max-width: 640px; margin: 0 auto; padding: max(16px, env(safe-area-inset-top)) 16px 32px; }
  header { display: flex; align-items: center; gap: 12px; }
  h1 { font-size: 1.3rem; margin: 0.5rem 0; flex: 1; }
  .progress { color: var(--muted); font-size: 0.9rem; }
  .card {
    margin-top: 16px; background: var(--surface); border: 1px solid var(--border);
    border-radius: 14px; padding: 24px 20px; display: flex; flex-direction: column; gap: 12px;
  }
  .lemma { font-size: 2rem; font-weight: 700; margin: 0; text-align: center; overflow-wrap: anywhere; }
  .sentence { font-size: 1.1rem; line-height: 1.6; margin: 0; }
  .sentence strong { background: rgba(120, 170, 220, 0.35); border-radius: 4px; padding: 0 2px; }
  .source { color: var(--muted); font-size: 0.85rem; margin: 0; text-align: right; }
  .flip { margin-top: 12px; }
  .answer { border-top: 1px solid var(--border); padding-top: 12px; display: flex; flex-direction: column; gap: 8px; }
  .answer p { margin: 0; line-height: 1.5; }
  .meaning { font-size: 1.25rem; font-weight: 600; }
  .pos { align-self: flex-start; font-size: 0.8rem; border: 1px solid var(--border); border-radius: 6px; padding: 1px 6px; color: var(--muted); }
  .label { color: var(--muted); font-size: 0.8rem; margin-right: 8px; }
  details summary { cursor: pointer; color: var(--muted); }
  details ul { padding-left: 18px; margin: 8px 0 0; display: grid; gap: 6px; }
  details li span { display: block; }
  .grades { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 8px; }
  kbd { margin-left: 6px; font-size: 0.75em; opacity: 0.6; }
  .remove { align-self: center; border: none; background: transparent; color: var(--danger); font-size: 0.85rem; min-height: 36px; }
  .done { text-align: center; padding: 12vh 0; }
  .big { font-size: 1.4rem; }
  .muted { color: var(--muted); font-size: 0.9rem; }
  .error { color: var(--danger); }
</style>
