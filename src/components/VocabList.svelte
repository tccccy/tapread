<script lang="ts">
  import { db } from '../lib/db'
  import { createVocabStore } from '../lib/vocab/store'
  import { MAX_LEVEL, type VocabEntry, type VocabExample } from '../lib/vocab/model'
  import { queryVocab, type VocabSort } from '../lib/vocab/list'
  import ExampleSentence from './ExampleSentence.svelte'

  let { entries, language, bookIds, onChanged, onJump }: {
    /** 已套用篩選的字 */
    entries: VocabEntry[]
    language: string
    /** 書庫裡還在的書；書被移除後就不能回到書中 */
    bookIds: Set<number>
    onChanged: () => void
    onJump: (example: VocabExample) => void
  } = $props()

  const vocab = createVocabStore(db)

  let query = $state('')
  let sort = $state<VocabSort>('recent')
  let error = $state('')

  const shown = $derived(queryVocab(entries, { query, sort, locale: language }))
  const dateFormat = new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric' })

  async function run(action: () => Promise<void>) {
    error = ''
    try {
      await action()
      onChanged()
    } catch (e) {
      console.error('更新單字本失敗', e)
      error = '更新失敗，請再試一次。'
    }
  }

  const removeEntry = (e: VocabEntry) => {
    if (confirm(`確定要把「${e.lemma}」和它的 ${e.examples.length} 個例句都移除嗎？`)) run(() => vocab.remove(e.id))
  }

  const removeExample = (e: VocabEntry, x: VocabExample) => {
    if (confirm('確定要移除這個例句嗎？')) run(() => vocab.unsave(e.id, x.word, x.sentence))
  }
</script>

<section class="list">
  <div class="toolbar">
    <input type="search" bind:value={query} placeholder="搜尋單字、意思或例句" aria-label="搜尋單字本" />
    <select bind:value={sort} aria-label="排序">
      <option value="recent">最新收藏</option>
      <option value="alpha">字母順序</option>
      <option value="level">最不熟的在前</option>
    </select>
  </div>

  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#if shown.length === 0}
    <p class="muted">{query ? '找不到符合的字。' : '這裡還沒有字。'}</p>
  {:else}
    <ul>
      {#each shown as e (e.id)}
        <li>
          <details>
            <summary>
              <span class="lemma">{e.lemma}</span>
              {#if e.pos}<span class="pos">{e.pos}</span>{/if}
              <span class="gist">{e.examples[0]?.contextMeaning ?? e.dictMeaning}</span>
              <span class="level" title={`熟練度 ${e.level}/${MAX_LEVEL}`} aria-label={`熟練度 ${e.level}/${MAX_LEVEL}`}>
                {#if e.level >= MAX_LEVEL}已熟{:else}{'●'.repeat(e.level)}{'○'.repeat(MAX_LEVEL - 1 - e.level)}{/if}
              </span>
            </summary>

            <div class="detail">
              {#if e.dictMeaning}<p><span class="label">字典釋義</span>{e.dictMeaning}</p>{/if}
              <ol class="examples">
                {#each e.examples as x (x.word + x.sentence)}
                  <li>
                    <p class="quote"><ExampleSentence sentence={x.sentence} word={x.word} /></p>
                    <p class="meaning">→ {x.contextMeaning}</p>
                    {#if x.note}<p class="note">{x.note}</p>{/if}
                    <p class="source">
                      《{x.bookTitle}》· {dateFormat.format(x.savedAt)}
                      {#if x.cfi && bookIds.has(x.bookId)}
                        <button class="link jump" onclick={() => onJump(x)}>回到書中</button>
                      {/if}
                      <button class="link" onclick={() => removeExample(e, x)}>移除這句</button>
                    </p>
                  </li>
                {/each}
              </ol>
              <button class="link danger" onclick={() => removeEntry(e)}>移除整個字</button>
            </div>
          </details>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .list { margin-top: 28px; }
  .toolbar { display: flex; gap: 8px; }
  input, select {
    min-height: 44px; font: inherit; font-size: 16px; color: var(--text);
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 0 10px;
  }
  input { flex: 1; min-width: 0; }
  ul { list-style: none; padding: 0; margin: 12px 0 0; display: grid; gap: 8px; }
  details { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); }
  summary {
    display: flex; align-items: baseline; gap: 8px; padding: 12px 14px; cursor: pointer;
    list-style: none; min-height: 44px;
  }
  summary::-webkit-details-marker { display: none; }
  .lemma { font-weight: 700; font-size: 1.1rem; }
  .pos { font-size: 0.75rem; color: var(--muted); border: 1px solid var(--border); border-radius: 6px; padding: 0 5px; }
  .gist { flex: 1; min-width: 0; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .level { font-size: 0.75rem; color: var(--accent-ink); letter-spacing: 1px; white-space: nowrap; }
  .detail { padding: 0 14px 14px; border-top: 1px solid var(--border); }
  .detail p { margin: 6px 0 0; line-height: 1.5; }
  .label { color: var(--muted); font-size: 0.8rem; margin-right: 8px; }
  .examples { padding-left: 20px; margin: 10px 0; display: grid; gap: 12px; }
  .quote { font-size: 1.02rem; }
  .meaning { font-weight: 600; }
  .note { color: var(--muted); font-size: 0.9rem; }
  .source { color: var(--muted); font-size: 0.8rem; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .link { border: none; background: transparent; padding: 0 4px; min-height: 32px; color: var(--muted); font-size: 0.8rem; text-decoration: underline; }
  .danger { color: var(--danger); }
  .jump { color: var(--accent-ink); }
  .muted { color: var(--muted); font-size: 0.9rem; }
  .error { color: var(--danger); }
</style>
