<script lang="ts">
  import type { Tab } from './TabBar.svelte'
  import GuideShot from './GuideShot.svelte'
  import HomeScreenGuide from './HomeScreenGuide.svelte'

  let { onGo }: { onGo: (tab: Tab) => void } = $props()

  // 章節目錄：主要功能在前
  const SECTIONS = [
    { id: 'lookup', icon: '👆', title: '點字查詢與收藏' },
    { id: 'select', icon: '✍️', title: '片語、整句翻譯與劃線' },
    { id: 'vocab', icon: '🗂', title: '單字本與複習' },
    { id: 'import', icon: '📥', title: '匯入書與貼上文章' },
    { id: 'reader', icon: 'Aa', title: '閱讀頁：設定、目錄、翻頁、發音' },
    { id: 'shelf', icon: '📚', title: '書架' },
    { id: 'book', icon: '⭐️', title: '書的頁面：評分、心得、書摘' },
    { id: 'stats', icon: '⏱', title: '閱讀統計與目標' },
    { id: 'settings', icon: '⚙️', title: '設定與外觀' },
    { id: 'mobile', icon: '📱', title: '在手機、平板上使用' },
    { id: 'backup', icon: '🔄', title: '備份與換裝置' },
    { id: 'privacy', icon: '🔒', title: '資料與隱私' },
    { id: 'faq', icon: '？', title: '常見問題' },
  ]

  // 點目錄：展開該章節並捲過去
  function jump(id: string) {
    const el = document.getElementById(`guide-${id}`) as HTMLDetailsElement | null
    if (!el) return
    el.open = true
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
</script>

<main>
  <header>
    <h1>使用教學</h1>
    <p class="sub">TapRead 讓你讀外文書時，點一下不懂的字就看到它在這一句裡的中文意思，收藏起來用字卡複習。第一次使用照著下面三步開始。</p>
  </header>

  <section class="start glass" aria-label="快速開始">
    <h2 class="start-title">快速開始</h2>
    <ol>
      <li>
        <span class="num">1</span>
        <div>
          <h3>設定 Gemini 金鑰</h3>
          <p>點字查詢用的是 Google 的 Gemini AI。到 Google AI Studio 用 Google 帳號免費申請一把金鑰，貼到「設定」按「測試並儲存」，約 2 分鐘。設定頁有一步一步的說明。</p>
          <button onclick={() => onGo('settings')}>前往設定 →</button>
        </div>
      </li>
      <li>
        <span class="num">2</span>
        <div>
          <h3>放一本書進來</h3>
          <p>到「書架」按「＋ 匯入」選 EPUB、PDF、Word（.docx）或 .txt；或按「貼上文章」貼一段外文。匯入後會直接打開。</p>
          <button onclick={() => onGo('shelf')}>前往書架 →</button>
        </div>
      </li>
      <li>
        <span class="num">3</span>
        <div>
          <h3>點一下不懂的字</h3>
          <p>下方會出現卡片，告訴你這個字<strong>在這一句裡</strong>的意思。想記住就按「☆ 收藏」，之後到「單字本」複習。</p>
        </div>
      </li>
      <li>
        <span class="num">＋</span>
        <div>
          <h3>手機、平板：加入主畫面</h3>
          <p>加到主畫面後就像 App 一樣全螢幕開啟，資料也比較不會被瀏覽器清掉。</p>
          <button onclick={() => jump('mobile')}>看加入主畫面的步驟 →</button>
        </div>
      </li>
    </ol>
  </section>

  <nav class="toc glass" aria-label="教學目錄">
    {#each SECTIONS as s, i (s.id)}
      <button onclick={() => jump(s.id)}><span class="toc-num">{i + 1}</span>{s.title}</button>
    {/each}
  </nav>

  <!-- 1 -->
  <details id="guide-lookup" class="glass" open>
    <summary><span class="icon" aria-hidden="true">👆</span>點字查詢與收藏</summary>
    <div class="body">
      <p class="lead">這是 TapRead 最主要的功能：讀到不懂的字，直接點它。</p>
      <GuideShot src="lookup.jpg" height={1167} alt="閱讀頁點了 abrió 之後，下方出現查字卡片：原形 abrir、動詞、此句意思「打開（窗戶）」" caption="點了「abrió」：卡片顯示原形、詞性與此句意思" />
      <h3>查字卡片上有什麼</h3>
      <ul>
        <li><strong>單字與原形</strong>：例如點到 <em>abrió</em>，會顯示「→ abrir」。</li>
        <li><strong>詞性</strong>：例如「動詞」「名詞」「片語動詞」。</li>
        <li><strong>此句意思</strong>：這個字在<strong>這一句</strong>裡的中文意思，不是字典上的第一個解釋。</li>
        <li><strong>字典釋義</strong>：最常見的幾個意思。</li>
        <li><strong>補充</strong>：動詞時態、慣用語、容易誤會的地方。</li>
        <li><strong>🔊</strong>：聽單字發音（念得比較慢）；<strong>念整句</strong>：聽整個句子。</li>
      </ul>
      <h3>收藏</h3>
      <ul>
        <li>按「<strong>☆ 收藏</strong>」：連同這個句子、書名和書中位置一起存進單字本，再按一次「★ 已收藏」可以取消。</li>
        <li>同一個字在不同句子、不同書裡收藏，會合併成同一個字，保留每一個例句。</li>
        <li>收藏後，這個字在<strong>所有書</strong>裡出現時都會上色提醒你。</li>
      </ul>
      <h3>書頁上的顏色</h3>
      <p class="legend">
        <span class="chip vocab">收藏的字</span>
        <span class="chip lookup">正在查的字</span>
        <span class="chip quote">書摘（劃線）</span>
      </p>
      <p class="note">收藏的字越不熟顏色越深；複習到「已熟」就不再標示。點書頁上沒有字的地方，或按 Esc，可以關掉卡片。</p>
    </div>
  </details>

  <!-- 2 -->
  <details id="guide-select" class="glass" open>
    <summary><span class="icon" aria-hidden="true">✍️</span>片語、整句翻譯與劃線</summary>
    <div class="body">
      <p>手指<strong>長按</strong>一個字，再拖動藍色把手調整選取範圍（電腦用滑鼠拖曳）。選好停下來後，畫面上方會出現按鈕：</p>
      <ul>
        <li><strong>查詢「…」</strong>（選 8 個字以內）：當成片語查，例如 <em>give up</em>、<em>se dio cuenta</em>。卡片會給原形片語（例如 <em>darse cuenta</em>），一樣可以收藏，收藏後整個片語在書裡都會上色。</li>
        <li><strong>翻譯「…」</strong>（選更長的句子）：顯示整句自然的中文翻譯，加上最多 5 個文法重點（例如時態、慣用語）。翻過的句子會記住，再翻一次不用等。</li>
        <li><strong>劃線</strong>：把選取的文字存成書摘，在書頁上以底色標示。翻譯卡片上也有「劃線」按鈕。</li>
      </ul>
      <div class="shots">
        <GuideShot src="select.jpg" height={720} alt="選取 sacar dinero 後，上方出現「查詢」與「劃線」按鈕" caption="選取片語：上方出現「查詢」「劃線」" />
        <GuideShot src="translate.jpg" height={1169} alt="選取整句後的翻譯卡片，有中文翻譯與文法重點" caption="選取整句：翻譯與文法重點" />
      </div>
      <p class="note">劃過的句子可以在「書的頁面 → 書摘」看到、加註記或刪除。</p>
    </div>
  </details>

  <!-- 3 -->
  <details id="guide-vocab" class="glass">
    <summary><span class="icon" aria-hidden="true">🗂</span>單字本與複習</summary>
    <div class="body">
      <h3>單字本首頁</h3>
      <ul>
        <li>依<strong>語言分頁</strong>（西班牙文、英文……），每個語言各自管理。</li>
        <li>上方數字：收藏的字、<strong>待複習</strong>（今天該複習的）、<strong>已熟</strong>。</li>
        <li>「<strong>開始複習</strong>」：只複習到期的字；「<strong>全部未熟的字再練一次</strong>」：不管有沒有到期都練。</li>
      </ul>
      <div class="shots">
        <GuideShot src="vocab.jpg" height={1022} alt="單字本：語言分頁、篩選、數字統計、開始複習、匯出 Word 與單字清單" caption="單字本首頁" />
        <GuideShot src="review.jpg" height={749} alt="複習字卡翻面後：單字、書中原句、意思，以及不記得、記得、已熟三個按鈕" caption="複習字卡（翻面後）" />
      </div>
      <h3>篩選</h3>
      <ul>
        <li><strong>熟練度</strong>：新字、學習中、已熟。</li>
        <li><strong>詞性</strong>：名詞、動詞、形容詞、副詞、片語、其他。</li>
        <li><strong>收藏時間</strong>：今天、最近 7 天、最近 30 天。</li>
        <li><strong>書</strong>：只看某幾本書收藏的字。</li>
      </ul>
      <p class="note">篩選後，複習和匯出都只針對篩選出的字。例如只複習某本書的動詞。</p>
      <h3>字卡複習</h3>
      <ol class="steps">
        <li>看單字和書中原句，先在心裡想意思。</li>
        <li>按「翻面看意思」。</li>
        <li>依自己的感覺選：<strong>不記得</strong>（10 分鐘後再出現）、<strong>記得</strong>（間隔拉長：1 天 → 3 天 → 7 天）、<strong>已熟</strong>（不再排複習，書裡也不再上色）。</li>
      </ol>
      <p class="note">電腦上可以用鍵盤：空白鍵或 Enter 翻面，1、2、3 分別是不記得、記得、已熟。已熟的字如果又在新的句子收藏，會重新排入複習。</p>
      <h3>單字清單</h3>
      <ul>
        <li><strong>搜尋</strong>：可以搜尋單字、意思或例句。</li>
        <li>排序：最新收藏、字母順序、最不熟的在前。</li>
        <li>每個字可以展開看字典釋義和所有例句；例句旁的「<strong>回到書中</strong>」會打開當初遇到它的那一頁並標出來（不會改變你的閱讀進度）。</li>
        <li>「移除這句」只刪一個例句；「移除整個字」把字從單字本刪掉。</li>
      </ul>
      <h3>匯出 Word</h3>
      <p>單字本的「<strong>匯出 Word</strong>」會把目前篩選出的字做成 Word 表格：單字、詞性、意思、書中例句（單字以粗體標出）、此句意思與書名。可以列印、分享或交作業用。</p>
    </div>
  </details>

  <!-- 4 -->
  <details id="guide-import" class="glass">
    <summary><span class="icon" aria-hidden="true">📥</span>匯入書與貼上文章</summary>
    <div class="body">
      <h3>支援的檔案</h3>
      <ul>
        <li><strong>EPUB</strong>：電子書最常見的格式，排版最好，所有閱讀設定都能用。</li>
        <li><strong>PDF</strong>：需要是文字型 PDF（文字可以選取）。掃描成圖片的 PDF 沒有文字，無法點字查詢。</li>
        <li><strong>Word（.docx）</strong>：依標題自動分章節。舊版 .doc 要先在 Word 另存成 .docx。</li>
        <li><strong>純文字（.txt）</strong>。</li>
      </ul>
      <h3>怎麼匯入</h3>
      <ul>
        <li>書架右上角「<strong>＋ 匯入</strong>」選檔案（書架空的時候中間也有按鈕）。</li>
        <li>電腦上也可以把檔案直接拖進視窗。</li>
        <li>匯入時會自動讀出書名、作者、語言和封面；PDF、Word 沒有標語言時，會用設定裡的「預設學習語言」。</li>
      </ul>
      <h3>貼上文章</h3>
      <ul>
        <li>書架右上角「<strong>貼上文章</strong>」：貼一段外文（新聞、網頁文章、歌詞都可以），就能像書一樣點字、收藏、劃線。</li>
        <li>可以自己取標題（不填會用第一行）、選語言。</li>
        <li>以 <code>#</code> 開頭的行會變成章節標題，出現在目錄裡。</li>
      </ul>
      <GuideShot src="paste.jpg" height={936} alt="貼上文章的視窗：文章內容、標題、語言與開始閱讀按鈕" caption="貼上文章" />
    </div>
  </details>

  <!-- 5 -->
  <details id="guide-reader" class="glass">
    <summary><span class="icon" aria-hidden="true">Aa</span>閱讀頁：設定、目錄、翻頁、發音</summary>
    <div class="body">
      <h3>Aa 閱讀設定（右上角）</h3>
      <ul>
        <li><strong>字體</strong>：明體（Literata＋思源宋體）、黑體（系統字體）、楷體（霞鶩文楷）、古典（EB Garamond）、原書（用書本自己的字體）。日文書會自動用日文字形。</li>
        <li><strong>字級</strong>：14–28，用滑桿或 A 按鈕調。</li>
        <li><strong>行距</strong>：緊湊、適中、寬鬆。</li>
        <li><strong>頁寬</strong>：窄、適中、寬（iPad 橫放時「寬」很好讀）。</li>
        <li><strong>紙張</strong>：跟隨系統、米白、羊皮紙、夜間。整個閱讀頁（含查字卡片）都會跟著換色。</li>
      </ul>
      <GuideShot src="aa.jpg" height={1169} alt="閱讀設定面板：字體、字級、行距、頁寬、紙張" caption="Aa 閱讀設定" />
      <p class="note">設定會記住，所有書共用。PDF 是固定版面，只能換紙張色。新字體第一次使用時會先用系統字體顯示一下，下載好就換過去，之後不用網路也能用。</p>
      <h3>目錄與進度</h3>
      <ul>
        <li><strong>☰ 目錄</strong>（右上角）：點章節直接跳過去，目前所在章節會標示。</li>
        <li><strong>底部進度條</strong>：拖到想去的位置，放開就跳轉；拖動時會顯示百分比。</li>
        <li>頁首顯示目前的章節名稱。閱讀位置會自動記住，下次從同一頁開始。</li>
      </ul>
      <h3>翻頁</h3>
      <ul>
        <li>點底部兩側的 <strong>‹ ›</strong>，或在書頁上左右滑動。</li>
        <li>電腦：鍵盤左右方向鍵。</li>
      </ul>
      <h3>返回</h3>
      <p>左上角的返回鍵、iPhone 從左邊緣往右滑、Android 的返回鍵，都會回到上一頁（書架會停在你剛才捲到的位置）。</p>
    </div>
  </details>

  <!-- 6 -->
  <details id="guide-shelf" class="glass">
    <summary><span class="icon" aria-hidden="true">📚</span>書架</summary>
    <div class="body">
      <ul>
        <li><strong>繼續閱讀</strong>卡片：最近在讀的書，按「繼續閱讀 →」直接接著讀。</li>
        <li><strong>閱讀統計</strong>卡片：見「閱讀統計與目標」。</li>
        <li><strong>分類方式</strong>（可切換，會記住）：
          <ul>
            <li><strong>閱讀狀態</strong>：正在讀、還沒開始、讀完了。</li>
            <li><strong>語言</strong>：依書的語言分層。</li>
            <li><strong>我的書架</strong>：自己建立書架（例如「小說」「課本」），可以改名、刪除；一本書可以同時放在好幾個書架，沒放的在「未分類」。</li>
          </ul>
        </li>
        <li>每一層書架可以左右滑動。</li>
        <li><strong>封面</strong>：EPUB 用書裡附的封面、PDF 用第一頁；沒有封面的書會依書名自動產生布面封面。</li>
        <li>點<strong>書的封面</strong>進入書的頁面。</li>
      </ul>
      <GuideShot src="shelf.jpg" height={900} alt="書架首頁：繼續閱讀卡片、閱讀統計卡片與分類方式" caption="書架首頁：繼續閱讀、閱讀統計、分類方式" />
    </div>
  </details>

  <!-- 7 -->
  <details id="guide-book" class="glass">
    <summary><span class="icon" aria-hidden="true">⭐️</span>書的頁面：評分、心得、書摘</summary>
    <div class="body">
      <ul>
        <li><strong>開始／繼續閱讀</strong>，以及目前進度。</li>
        <li><strong>標為讀完</strong>：讀到 98% 會自動標記，也可以手動切換「標為讀完／標為還沒讀完」。</li>
        <li><strong>我的評分</strong>：5 顆星，點星星左半邊是半顆；再點一次同樣的分數可以取消。</li>
        <li><strong>心得</strong>：打字會自動儲存，切到別的 App 也會先存起來。</li>
        <li><strong>放在哪個書架</strong>：點選書架名稱加入或移出，也可以在這裡直接建立新書架。</li>
        <li><strong>單字</strong>：「從這本書收藏了 N 個單字 →」會打開單字本，並自動篩選出這本書的字。</li>
        <li><strong>書摘</strong>：閱讀時劃線的句子，依時間排列，顯示章節與日期。可以加一句註記（離開輸入框就會儲存）、「回到書中」或刪除。</li>
        <li><strong>資訊</strong>：可以修改這本書的語言（收藏的字會一起搬到新語言）、看加入與讀完日期、移除這本書（書摘也會一起刪除，單字本的字會保留）。</li>
      </ul>
      <div class="shots">
        <GuideShot src="book.jpg" height={864} alt="書的頁面：4.5 顆星評分、心得、放在哪個書架" caption="評分、心得與書架" />
        <GuideShot src="quotes.jpg" height={533} alt="書摘：劃線的句子、註記、回到書中與刪除" caption="書摘" />
      </div>
    </div>
  </details>

  <!-- 8 -->
  <details id="guide-stats" class="glass">
    <summary><span class="icon" aria-hidden="true">⏱</span>閱讀統計與目標</summary>
    <div class="body">
      <ul>
        <li>書架首頁的統計卡：<strong>今天讀了幾分鐘</strong>（圓環對照每日目標）、<strong>連續閱讀天數</strong>、<strong>最近 7 天</strong>長條圖（達標的日子顏色較深）、<strong>7 天內新收藏的字</strong>。</li>
        <li><strong>每日目標</strong>：在統計卡上選 5–90 分鐘。</li>
        <li>只有真的在讀才計時：最近 3 分鐘內有翻頁、點字或選字才算；App 切到背景會暫停。</li>
        <li>一天讀滿 1 分鐘才算「有讀」，連續天數從今天（或昨天）往回算。</li>
      </ul>
    </div>
  </details>

  <!-- 9 -->
  <details id="guide-settings" class="glass">
    <summary><span class="icon" aria-hidden="true">⚙️</span>設定與外觀</summary>
    <div class="body">
      <ul>
        <li><strong>外觀</strong>：跟隨系統（白天淺色、晚上深色）、淺色、深色，點了立即生效。</li>
        <li><strong>Gemini API 金鑰</strong>：貼上後按「測試並儲存」，會先確認金鑰可用（不消耗額度）。「顯示／隱藏」可以檢查有沒有貼完整。</li>
        <li><strong>模型</strong>：預設 gemini-3.5-flash-lite（快、省額度）；想要更細的解釋可以改成 gemini-3.6-flash。</li>
        <li><strong>預設學習語言</strong>：PDF、Word、貼上的文章常沒有標語言，匯入時會用這個設定；也影響單字本分頁和斷字。</li>
        <li><strong>備份</strong>：見「備份與換裝置」。</li>
      </ul>
    </div>
  </details>

  <!-- 10 -->
  <details id="guide-mobile" class="glass">
    <summary><span class="icon" aria-hidden="true">📱</span>在手機、平板上使用</summary>
    <div class="body">
      <h3>加入主畫面</h3>
      <p>加入後就像一般 App：有自己的圖示、全螢幕開啟，資料也比較不會被清掉。選你的裝置：</p>
      <HomeScreenGuide />

      <h3>兩個提醒</h3>
      <ul>
        <li>iPhone、iPad 上<strong>一定要加入主畫面</strong>：沒加入的網站久沒打開，Safari 可能清掉書和單字本。</li>
        <li>主畫面的 TapRead 和瀏覽器裡的<strong>資料是分開的</strong>，之後都從圖示打開；瀏覽器裡已有的書用「備份與換裝置」搬過來。</li>
      </ul>

      <h3>在手機上匯入書</h3>
      <ol class="steps">
        <li>先把書存進「檔案」App（從 LINE、Email 選「儲存到檔案」）。</li>
        <li>書架按「＋ 匯入」，會直接打開「檔案」。</li>
        <li>點那本書就會匯入並打開。</li>
      </ol>
    </div>
  </details>

  <!-- 11 -->
  <details id="guide-backup" class="glass">
    <summary><span class="icon" aria-hidden="true">🔄</span>備份與換裝置</summary>
    <div class="body">
      <p>書和單字本都只存在<strong>這台裝置</strong>的瀏覽器裡，不會上傳到任何伺服器，所以不同裝置之間不會自動同步。要搬資料時：</p>
      <ol class="steps">
        <li>舊裝置：「設定 → 備份」→ 匯出。
          <ul>
            <li><strong>完整備份</strong>：含書檔，換新裝置或第一次搬時用。</li>
            <li><strong>單字與進度</strong>：不含書檔，檔案很小，平常同步進度用。</li>
          </ul>
        </li>
        <li>用 AirDrop、iCloud Drive、LINE 等方式把檔案傳到另一台裝置（手機、平板會跳出分享選單）。</li>
        <li>另一台裝置：「設定 → 備份」→ 匯入那個 .zip 檔。</li>
      </ol>
      <h3>匯入會怎麼合併</h3>
      <ul>
        <li>兩邊的資料<strong>合併</strong>，不會覆蓋或重複。</li>
        <li>閱讀進度取讀得比較新的；評分、心得取最後修改的；單字、例句、書摘合在一起；閱讀時間同一天取較多的。</li>
        <li>自訂書架以名稱對應，沒有的會自動建立。</li>
      </ul>
      <h3>儲存空間與備份提醒</h3>
      <ul>
        <li>「設定 → 儲存空間」可以看到用了多少空間、有幾本書和單字、是否開啟「持久保存」，以及上次備份的日期。</li>
        <li><strong>持久保存</strong>：開啟後，裝置空間不足時瀏覽器不會自動清掉資料。顯示「未開啟」時可以按「申請持久保存」（加入主畫面、常常使用之後比較容易被同意）。</li>
        <li><strong>備份提醒</strong>：超過 14 天沒備份（或加入第一本書 3 天後還沒備份過），書架首頁會出現提醒，可以直接「前往備份」或「稍後提醒」（3 天後再提醒）。</li>
      </ul>
      <p class="note">備份不含 Gemini 金鑰，在新裝置要重新貼上。建議定期匯出一份備份存在雲端硬碟。</p>
    </div>
  </details>

  <!-- 12 -->
  <details id="guide-privacy" class="glass">
    <summary><span class="icon" aria-hidden="true">🔒</span>資料與隱私</summary>
    <div class="body">
      <ul>
        <li>書檔、單字本、心得、書摘、閱讀紀錄都只存在你的裝置裡。</li>
        <li>點字時只會把「這個字、所在句子與前後各一句、書名」送給 Google Gemini，整本書不會上傳。整句翻譯同樣只送那幾句。</li>
        <li>金鑰只存在這台裝置的瀏覽器，只會送給 Gemini。</li>
        <li>Gemini 免費方案送出的內容可能被 Google 用來改善產品。</li>
        <li>查過的字和翻過的句子會存在裝置上，再查同一句不會重複送出。</li>
      </ul>
    </div>
  </details>

  <!-- 13 -->
  <details id="guide-faq" class="glass">
    <summary><span class="icon" aria-hidden="true">？</span>常見問題</summary>
    <div class="body">
      <h3>點字後顯示「金鑰無效」</h3>
      <p>到設定確認金鑰有完整複製（以 AIza 開頭），再按「測試並儲存」。</p>
      <h3>顯示「已達使用額度上限」</h3>
      <p>Gemini 免費方案每分鐘、每天有次數限制。稍等一下再試，或隔天額度會重置。</p>
      <h3>PDF 點了沒反應</h3>
      <p>可能是掃描成圖片的 PDF，裡面沒有文字。可以試著找 EPUB 版本，或用文字辨識工具轉成文字後用「貼上文章」。</p>
      <h3>為什麼某個字沒有上色？</h3>
      <p>已經複習到「已熟」的字不會上色；不同形態的字（例如收藏 abrir，書裡出現 abre）要點過收藏一次才會上色。</p>
      <h3>畫面下方出現「有新版本」</h3>
      <p>點一下就會更新到最新版，不會影響你的書和單字本。</p>
      <h3>換了網址或換裝置，書都不見了</h3>
      <p>資料是跟著「網址＋裝置」存的。到原本的裝置匯出備份，再到新的地方匯入（見「備份與換裝置」）。</p>
    </div>
  </details>
</main>

<style>
  main { max-width: 760px; margin: 0 auto; padding: max(16px, env(safe-area-inset-top)) 16px var(--tabbar-space); }
  header { margin-bottom: 18px; }
  h1 { font-size: 1.9rem; margin: 0.5rem 0 6px; }
  .sub { margin: 0; color: var(--muted); line-height: 1.6; }

  .start { padding: 18px 20px; margin-bottom: 14px; }
  .start-title { margin: 0 0 14px; font-size: 1.2rem; }
  .start ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 18px; }
  .start li { display: flex; gap: 14px; align-items: flex-start; }
  .num {
    flex-shrink: 0; width: 34px; height: 34px; border-radius: 50%;
    display: grid; place-items: center;
    background: var(--accent); color: var(--accent-text);
    font-family: var(--font-serif); font-weight: 600;
  }
  .start h3 { margin: 4px 0 4px; font-size: 1.05rem; font-family: var(--font-serif); }
  .start p { margin: 0 0 8px; line-height: 1.6; }
  .start button { min-height: 38px; padding: 0.3rem 1rem; font-size: 0.9rem; }

  .toc { display: flex; flex-wrap: wrap; gap: 8px; padding: 14px 16px; margin-bottom: 4px; }
  .toc button { min-height: 36px; padding: 0.25rem 0.85rem 0.25rem 0.4rem; font-size: 0.88rem; display: inline-flex; align-items: center; gap: 6px; }
  .toc-num {
    width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center;
    background: var(--accent-soft); font-size: 0.75rem; font-variant-numeric: tabular-nums;
  }

  details { margin-top: 12px; padding: 0; overflow: hidden; scroll-margin-top: 16px; }
  summary {
    list-style: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    font-family: var(--font-serif);
    font-size: 1.1rem;
    font-weight: 600;
    min-height: 56px;
  }
  summary::-webkit-details-marker { display: none; }
  summary::after { content: '＋'; margin-left: auto; color: var(--muted); font-family: var(--font-sans); font-weight: 400; }
  details[open] summary::after { content: '－'; }
  summary:focus-visible { outline: 2px solid var(--accent-ink); outline-offset: -4px; border-radius: var(--radius-lg); }
  .icon {
    width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
    display: grid; place-items: center;
    background: var(--accent-soft); font-size: 1rem; font-family: var(--font-serif);
  }
  .body { padding: 0 20px 18px; line-height: 1.75; }
  .body h3 { font-size: 0.98rem; margin: 16px 0 4px; font-family: var(--font-sans); }
  .body h3:first-child { margin-top: 0; }
  .body p { margin: 0 0 8px; }
  .body ul, .body ol { margin: 0 0 8px; padding-left: 1.2em; display: grid; gap: 6px; }
  .body li ul { margin-top: 6px; }
  .lead { font-weight: 600; }
  .shots { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; align-items: start; margin: 8px 0 12px; }
  .body > :global(figure) { margin: 8px 0 12px; }
  .note { font-size: 0.88rem; color: var(--muted); }
  code { font-size: 0.9em; padding: 0 4px; border-radius: 4px; background: var(--accent-soft); }

  .legend { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .chip { padding: 1px 8px; border-radius: 4px; font-family: var(--font-serif); }
  .chip.vocab { background: rgba(169, 154, 137, 0.45); }
  .chip.lookup { background: #725b48; color: #ffffff; }
  .chip.quote { background: rgba(216, 200, 181, 0.75); color: #1e1a16; }
</style>
