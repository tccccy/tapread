<script lang="ts">
  // 教學頁的截圖：手機畫面的比例，延遲載入
  let { src, alt, caption, width = 540, height }: {
    /** public/guide 裡的檔名 */
    src: string
    alt: string
    caption?: string
    width?: number
    height: number
  } = $props()
</script>

<figure>
  <img src={`./guide/${src}`} {alt} {width} {height} loading="lazy" decoding="async" />
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  figure { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; }
  img {
    width: 100%;
    max-width: 260px;
    height: auto;
    border-radius: 18px;
    border: 1px solid var(--border);
    box-shadow: var(--glass-shadow);
    background: var(--surface-solid);
  }
  figcaption { font-size: 0.8rem; color: var(--muted); text-align: center; }
</style>
