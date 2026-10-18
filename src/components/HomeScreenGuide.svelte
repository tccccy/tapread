<script lang="ts">
  // 教學頁：各裝置「加入主畫面」的示意圖＋簡短步驟
  type Device = 'iphone' | 'ipad' | 'android' | 'desktop'

  const DEVICES: { id: Device; label: string }[] = [
    { id: 'iphone', label: 'iPhone' },
    { id: 'ipad', label: 'iPad' },
    { id: 'android', label: 'Android' },
    { id: 'desktop', label: '電腦' },
  ]

  const STEPS: Record<Device, { steps: string[]; tip: string }> = {
    iphone: {
      steps: [
        '用 Safari 打開 TapRead，點下方的分享按鈕（方框加向上箭頭；新版 iOS 在「⋯」選單裡）',
        '往下滑，點「加入主畫面」',
        '點右上角「加入」，之後從主畫面的圖示打開',
      ],
      tip: '用 Chrome 也可以：網址列右邊的分享按鈕 →「加入主畫面」。',
    },
    ipad: {
      steps: [
        '用 Safari 打開 TapRead，點右上角的分享按鈕（方框加向上箭頭；或在「⋯」選單裡）',
        '點「加入主畫面」',
        '點「加入」，之後從主畫面的圖示打開',
      ],
      tip: '橫放閱讀時，Aa 設定的「頁寬：寬」最好讀。',
    },
    android: {
      steps: [
        '用 Chrome 打開 TapRead，點右上角的選單（三個點 ⋮）',
        '點「加到主畫面」或「安裝應用程式」',
        '點「安裝」，圖示會出現在主畫面',
      ],
      tip: '三星瀏覽器：右下角選單（三條線）→「新增頁面至」→「主螢幕」。',
    },
    desktop: {
      steps: [
        '用 Chrome 或 Edge 打開 TapRead',
        '點網址列右側的「安裝」圖示',
        '點「安裝」，會變成獨立視窗的 App',
      ],
      tip: 'Mac 的 Safari：選單「檔案」→「加入 Dock」。',
    },
  }

  let device = $state<Device>(/iPad|Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1 ? 'ipad'
    : /iPhone|iPod/.test(navigator.userAgent) ? 'iphone'
    : /Android/.test(navigator.userAgent) ? 'android' : 'iphone')
</script>

<div class="tabs" role="tablist" aria-label="選擇裝置">
  {#each DEVICES as d (d.id)}
    <button role="tab" aria-selected={device === d.id} class:on={device === d.id} onclick={() => (device = d.id)}>{d.label}</button>
  {/each}
</div>

<div class="panel" role="tabpanel">
  <div class="art" aria-hidden="true">
    {#if device === 'iphone'}
      <svg viewBox="0 0 320 250">
        <!-- 手機 -->
        <rect x="20" y="8" width="120" height="234" rx="20" class="frame" />
        <rect x="30" y="20" width="100" height="10" rx="5" class="faint" />
        <g class="lines"><path d="M36 50h86M36 62h76M36 74h82M36 92h86M36 104h70M36 116h80" /></g>
        <rect x="26" y="196" width="108" height="34" rx="12" class="bar" />
        <path d="M42 216l-5-4 5-4M50 208l5 4-5 4" class="ico" />
        <g class="ico"><path d="M80 218v-14M75 208l5-5 5 5M74 212h-3v10h18v-10h-3" /></g>
        <rect x="104" y="206" width="12" height="12" rx="2" class="ico" />
        <circle cx="126" cy="212" r="2" class="dot" />
        <circle cx="80" cy="212" r="15" class="ring" />
        <circle cx="96" cy="190" r="10" class="badge" /><text x="96" y="194" class="num">1</text>
        <!-- 箭頭 -->
        <path d="M150 125h22l-6-6M172 125l-6 6" class="arrow" />
        <!-- 分享選單 -->
        <rect x="182" y="40" width="128" height="170" rx="14" class="sheet" />
        <g class="lines"><path d="M196 64h70M196 92h80M196 176h60" /></g>
        <rect x="190" y="118" width="112" height="30" rx="8" class="hit" />
        <text x="198" y="138" class="label">加入主畫面</text>
        <rect x="282" y="125" width="12" height="12" rx="3" class="ico" /><path d="M288 128v6M285 131h6" class="ico" />
        <circle cx="302" cy="116" r="10" class="badge" /><text x="302" y="120" class="num">2</text>
      </svg>
    {:else if device === 'ipad'}
      <svg viewBox="0 0 320 230">
        <rect x="10" y="20" width="300" height="200" rx="18" class="frame" />
        <rect x="22" y="32" width="276" height="26" rx="8" class="bar" />
        <rect x="90" y="38" width="140" height="14" rx="7" class="faint" />
        <g class="ico"><path d="M264 50v-12M259 41l5-5 5 5M258 44h-3v9h18v-9h-3" /></g>
        <circle cx="264" cy="44" r="14" class="ring" />
        <circle cx="282" cy="28" r="10" class="badge" /><text x="282" y="32" class="num">1</text>
        <g class="lines"><path d="M34 80h120M34 94h110M34 108h118M34 126h120M34 140h96M34 154h112" /></g>
        <!-- 彈出選單 -->
        <rect x="176" y="70" width="122" height="130" rx="12" class="sheet" />
        <g class="lines"><path d="M190 92h70M190 118h76" /></g>
        <rect x="184" y="140" width="106" height="28" rx="8" class="hit" />
        <text x="192" y="159" class="label">加入主畫面</text>
        <circle cx="290" cy="138" r="10" class="badge" /><text x="290" y="142" class="num">2</text>
      </svg>
    {:else if device === 'android'}
      <svg viewBox="0 0 320 250">
        <rect x="20" y="8" width="120" height="234" rx="18" class="frame" />
        <rect x="28" y="22" width="104" height="22" rx="8" class="bar" />
        <rect x="36" y="28" width="66" height="10" rx="5" class="faint" />
        <g class="dot"><circle cx="122" cy="27" r="2" /><circle cx="122" cy="33" r="2" /><circle cx="122" cy="39" r="2" /></g>
        <circle cx="122" cy="33" r="13" class="ring" />
        <circle cx="132" cy="14" r="10" class="badge" /><text x="132" y="18" class="num">1</text>
        <g class="lines"><path d="M36 64h86M36 76h76M36 88h82M36 106h86M36 118h70" /></g>
        <path d="M150 110h22l-6-6M172 110l-6 6" class="arrow" />
        <rect x="182" y="30" width="128" height="160" rx="12" class="sheet" />
        <g class="lines"><path d="M196 54h80M196 78h66M196 102h74" /></g>
        <rect x="190" y="118" width="112" height="30" rx="8" class="hit" />
        <text x="198" y="138" class="label">安裝應用程式</text>
        <circle cx="302" cy="116" r="10" class="badge" /><text x="302" y="120" class="num">2</text>
        <g class="lines"><path d="M196 172h70" /></g>
      </svg>
    {:else}
      <svg viewBox="0 0 320 210">
        <rect x="10" y="14" width="300" height="186" rx="12" class="frame" />
        <circle cx="26" cy="28" r="4" class="faint" /><circle cx="40" cy="28" r="4" class="faint" /><circle cx="54" cy="28" r="4" class="faint" />
        <rect x="20" y="40" width="280" height="24" rx="12" class="bar" />
        <rect x="34" y="47" width="150" height="10" rx="5" class="faint" />
        <g class="ico"><rect x="252" y="45" width="18" height="13" rx="2" /><path d="M261 48v6M258 51l3 3 3-3" /></g>
        <circle cx="261" cy="52" r="15" class="ring" />
        <circle cx="280" cy="34" r="10" class="badge" /><text x="280" y="38" class="num">1</text>
        <g class="lines"><path d="M30 86h130M30 100h116M30 114h124M30 132h130M30 146h100" /></g>
        <rect x="176" y="76" width="122" height="100" rx="12" class="sheet" />
        <text x="190" y="102" class="label">安裝 TapRead？</text>
        <rect x="236" y="136" width="52" height="26" rx="13" class="hit" />
        <text x="248" y="154" class="label">安裝</text>
        <circle cx="290" cy="132" r="10" class="badge" /><text x="290" y="136" class="num">2</text>
      </svg>
    {/if}
  </div>

  <ol>
    {#each STEPS[device].steps as step, i (i)}
      <li><span class="n">{i + 1}</span>{step}</li>
    {/each}
  </ol>
  <p class="tip">{STEPS[device].tip}</p>
</div>

<style>
  .tabs { display: flex; background: var(--accent-soft); border-radius: 999px; padding: 3px; margin-bottom: 14px; }
  .tabs button { flex: 1; min-height: 38px; padding: 0.3rem 0; border: none; background: none; font-size: 0.92rem; }
  .tabs .on { background: var(--surface-solid); box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12); font-weight: 600; }

  .panel { display: grid; grid-template-columns: minmax(0, 300px) 1fr; gap: 18px; align-items: center; }
  @media (max-width: 600px) { .panel { grid-template-columns: 1fr; } }
  .art svg { width: 100%; height: auto; display: block; }

  ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
  li { display: flex; gap: 10px; align-items: flex-start; line-height: 1.6; }
  .n {
    flex-shrink: 0; width: 24px; height: 24px; margin-top: 1px; border-radius: 50%;
    display: grid; place-items: center; font-size: 0.8rem; font-weight: 700;
    background: var(--accent-ink); color: var(--surface-solid);
  }
  .tip { grid-column: 1 / -1; margin: 0; font-size: 0.86rem; color: var(--muted); }

  /* 示意圖的顏色跟著深淺色主題 */
  .frame { fill: var(--surface-solid); stroke: var(--text); stroke-width: 2.5; opacity: 0.9; }
  .bar { fill: var(--accent-soft); }
  .faint { fill: var(--border); }
  .lines path { stroke: var(--muted); stroke-width: 3; stroke-linecap: round; opacity: 0.45; fill: none; }
  .ico { fill: none; stroke: var(--text); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .dot, .dot circle { fill: var(--text); }
  .ring { fill: none; stroke: var(--accent-ink); stroke-width: 3; }
  .badge { fill: var(--accent-ink); }
  .num { fill: var(--surface-solid); font-size: 12px; font-weight: 700; text-anchor: middle; font-family: var(--font-sans); }
  .arrow { fill: none; stroke: var(--muted); stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
  .sheet { fill: var(--surface-solid); stroke: var(--border); stroke-width: 1.5; }
  .hit { fill: var(--accent-soft); stroke: var(--accent-ink); stroke-width: 2; }
  .label { fill: var(--text); font-size: 13px; font-weight: 600; font-family: var(--font-sans); }
</style>
