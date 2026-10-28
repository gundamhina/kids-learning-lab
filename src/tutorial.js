// 畫法跟遊戲裡一樣是手繪風：每樣東西都有深一階的描邊，整張場景用 #wobble 微微抖動（style.css 的 .tut-scene）。
// 教學：每個玩法第一次玩之前，先放一段小手示範怎麼操作。全是圖、不用字，她看得懂就好。
// 示範只教「怎麼操作」（點、拖、畫、按），不教答案。動畫在 style.css 的 .tut-* 那一段，一輪 3.6 秒一直重播。
// showTutorial(root, kind, onGo)：蓋在遊戲畫面上，按綠色播放鍵才開始；回傳一個關掉它的函式。

const INK = '#2B3A4A'
const WOOD = '#B08A63'
const FONT = 'font-family="Microsoft JhengHei, Noto Sans TC, PingFang TC, sans-serif" font-weight="900"'

// 手指尖在 (0, 0)，動畫只改整組的位移
const HAND = `
  <rect x="-22" y="40" width="68" height="62" rx="26" fill="#FFE3C4" stroke="#8E6D4C" stroke-width="4"/>
  <rect x="-11" y="-2" width="22" height="62" rx="11" fill="#FFE3C4" stroke="#8E6D4C" stroke-width="4"/>
  <rect x="-7" y="44" width="14" height="14" fill="#FFE3C4"/>
  <path d="M8 58 v-6 M24 60 v-8" stroke="#8E6D4C" stroke-width="3" stroke-linecap="round"/>`

const hand = cls => `<g class="tut-hand ${cls}">${HAND}</g>`
const ripple = (cls, x, y) => `<circle class="tut-ripple ${cls}" cx="${x}" cy="${y}" r="34" fill="none" stroke="#E8C86A" stroke-width="7"/>`
const sparks = (cls, x, y) => [[-60, -30], [55, -40], [-40, 45], [60, 35], [0, -70]].map(([dx, dy], i) =>
  `<text class="tut-spark ${cls}" x="${x + dx}" y="${y + dy}" font-size="34" fill="${['#E8C86A', '#E39AA8', '#6B9E6B', '#4A6FA5', '#E0955B'][i]}" text-anchor="middle" dominant-baseline="central">★</text>`).join('')

// 喇叭：先「聽」
const SPEAKER = `<g class="tut-speaker"><path d="M60 70 h22 l26 -22 v68 l-26 -22 h-22 z" fill="#E0955B" stroke="#A8683A" stroke-width="5" stroke-linejoin="round"/>
  <path class="tut-wave w1" d="M122 68 q10 14 0 28" stroke="#E0955B" stroke-width="6" fill="none" stroke-linecap="round"/>
  <path class="tut-wave w2" d="M136 58 q18 24 0 48" stroke="#E0955B" stroke-width="6" fill="none" stroke-linecap="round"/></g>`

const SCENES = {
  // 聽音，點泡泡
  fishing: `
    <path d="M0 214 V370 a30 30 0 0 0 30 30 H610 a30 30 0 0 0 30 -30 V214 z" fill="#8FC7D2"/>
    <path d="M0 214 q40 -12 80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0" stroke="#3F7A96" stroke-width="5" fill="none"/>
    ${SPEAKER}
    <g class="tut-fish-b1"><circle cx="250" cy="262" r="54" fill="#E3F2F4" stroke="#3F7A96" stroke-width="6"/><text x="250" y="264" font-size="62" ${FONT} fill="${INK}" text-anchor="middle" dominant-baseline="central">ㄅ</text></g>
    <g><circle cx="420" cy="276" r="54" fill="#E3F2F4" stroke="#3F7A96" stroke-width="6"/><text x="420" y="278" font-size="62" ${FONT} fill="${INK}" text-anchor="middle" dominant-baseline="central">ㄆ</text></g>
    ${ripple('tut-fish-r', 250, 262)}${sparks('tut-fish-s', 250, 262)}
    ${hand('tut-fish-hand')}`,

  // 聽音，拍冒出來的
  whack: `
    <path d="M0 250 V370 a30 30 0 0 0 30 30 H610 a30 30 0 0 0 30 -30 V250 z" fill="#9BC47F"/>
    ${SPEAKER}
    ${[180, 320, 460].map(x => `<ellipse cx="${x}" cy="300" rx="64" ry="22" fill="#3E2A1A" stroke="#2B1D12" stroke-width="4"/>`).join('')}
    <clipPath id="tut-hole"><rect x="240" y="100" width="160" height="202"/></clipPath>
    <g clip-path="url(#tut-hole)"><g class="tut-mole"><circle cx="320" cy="250" r="50" fill="#FBF1DA" stroke="#8A6A4C" stroke-width="5"/><text x="320" y="252" font-size="60" ${FONT} fill="${INK}" text-anchor="middle" dominant-baseline="central">ㄅ</text></g></g>
    ${[180, 320, 460].map(x => `<path d="M${x - 66} 300 a66 22 0 0 0 132 0" fill="#B98D5E" stroke="#7A5636" stroke-width="4"/>`).join('')}
    ${ripple('tut-whack-r', 320, 250)}${sparks('tut-whack-s', 320, 240)}
    ${hand('tut-whack-hand')}`,

  // 翻兩張一樣的
  memory: `
    ${[130, 250, 370, 490].map((x, i) => `
      <g class="tut-card c${i}">
        <rect class="back" x="${x - 10}" y="130" width="100" height="130" rx="18" fill="#5F8F5F" stroke="#3F6A3F" stroke-width="5"/>
        <text class="back" x="${x + 40}" y="198" font-size="40" fill="#F6E7C8" text-anchor="middle" dominant-baseline="central">🐾</text>
        <rect class="front" x="${x - 10}" y="130" width="100" height="130" rx="18" fill="#FFFDF7" stroke="#C39A1E" stroke-width="5"/>
        <text class="front" x="${x + 40}" y="198" font-size="62" ${FONT} fill="${INK}" text-anchor="middle" dominant-baseline="central">ㄇ</text>
      </g>`).join('')}
    ${sparks('tut-mem-s', 300, 200)}
    ${hand('tut-mem-hand')}`,

  // 符號找朋友：看上面的符號，點第一個字有這個音的那張圖（跟釣魚同一套點擊動畫，正解在 250,262）
  friend: `
    <rect x="270" y="20" width="100" height="100" rx="18" fill="#FFFDF7" stroke="${WOOD}" stroke-width="6"/>
    <text x="320" y="72" font-size="64" ${FONT} fill="${INK}" text-anchor="middle" dominant-baseline="central">ㄇ</text>
    <g class="tut-fish-b1"><rect x="200" y="212" width="100" height="100" rx="18" fill="#FFFDF7" stroke="${WOOD}" stroke-width="5"/>
    <text x="250" y="264" font-size="62" text-anchor="middle" dominant-baseline="central">🐱</text></g>
    <rect x="370" y="212" width="100" height="100" rx="18" fill="#FFFDF7" stroke="${WOOD}" stroke-width="5"/>
    <text x="420" y="264" font-size="62" text-anchor="middle" dominant-baseline="central">🍎</text>
    ${ripple('tut-fish-r', 250, 262)}${sparks('tut-fish-s', 250, 262)}
    ${hand('tut-fish-hand')}`,

  // 數一數：點數字卡（跟釣魚同一套點擊動畫，正解在 250,262）
  count: `
    <rect x="200" y="20" width="240" height="150" rx="20" fill="#FFFDF7" stroke="${WOOD}" stroke-width="6"/>
    <text x="260" y="100" font-size="56" text-anchor="middle" dominant-baseline="central">🐟</text>
    <text x="320" y="80" font-size="56" text-anchor="middle" dominant-baseline="central">🐟</text>
    <text x="380" y="110" font-size="56" text-anchor="middle" dominant-baseline="central">🐟</text>
    <g class="tut-fish-b1"><rect x="205" y="217" width="90" height="90" rx="18" fill="#FFF3B0" stroke="#C39A1E" stroke-width="5"/>
    <text x="250" y="264" font-size="60" ${FONT} fill="${INK}" text-anchor="middle" dominant-baseline="central">3</text></g>
    <rect x="345" y="217" width="90" height="90" rx="18" fill="#FFF3B0" stroke="#C39A1E" stroke-width="5"/>
    <text x="390" y="264" font-size="60" ${FONT} fill="${INK}" text-anchor="middle" dominant-baseline="central">5</text>
    ${ripple('tut-fish-r', 250, 262)}${sparks('tut-fish-s', 250, 262)}
    ${hand('tut-fish-hand')}`,

  // 做數量：把東西拖進盒子（跟填空同一套拖曳動畫，盒子的空位在 371,132）
  make: `
    <rect x="80" y="40" width="110" height="120" rx="18" fill="#FFF3B0" stroke="#C39A1E" stroke-width="6"/>
    <text x="135" y="100" font-size="80" ${FONT} fill="${INK}" text-anchor="middle" dominant-baseline="central">1</text>
    <rect class="tut-fill-blank" x="300" y="60" width="150" height="140" rx="18" fill="none" stroke="${WOOD}" stroke-width="5" stroke-dasharray="12 9"/>
    <g class="tut-fill-tile"><text x="325" y="304" font-size="60" text-anchor="middle" dominant-baseline="central">🐟</text></g>
    <text x="475" y="304" font-size="60" text-anchor="middle" dominant-baseline="central">🐟</text>
    ${sparks('tut-fill-s', 371, 132)}
    ${hand('tut-fill-hand')}`,

  // 比多少：點比較多的那一框（點擊動畫在 250,262）
  compare: `
    <g class="tut-fish-b1"><rect x="150" y="170" width="200" height="190" rx="20" fill="#FFFDF7" stroke="${WOOD}" stroke-width="6"/>
    <text x="210" y="230" font-size="46" text-anchor="middle" dominant-baseline="central">🍓</text><text x="290" y="230" font-size="46" text-anchor="middle" dominant-baseline="central">🍓</text>
    <text x="210" y="300" font-size="46" text-anchor="middle" dominant-baseline="central">🍓</text><text x="290" y="300" font-size="46" text-anchor="middle" dominant-baseline="central">🍓</text></g>
    <rect x="390" y="170" width="200" height="190" rx="20" fill="#FFFDF7" stroke="${WOOD}" stroke-width="6"/>
    <text x="490" y="265" font-size="46" text-anchor="middle" dominant-baseline="central">🍓</text>
    <rect x="310" y="40" width="120" height="80" rx="16" fill="#FFFDF7" stroke="${WOOD}" stroke-width="5"/>
    <g fill="#E0955B"><circle cx="340" cy="94" r="10"/><circle cx="362" cy="94" r="10"/><circle cx="384" cy="94" r="10"/><circle cx="406" cy="94" r="10"/><circle cx="351" cy="72" r="10"/><circle cx="373" cy="72" r="10"/><circle cx="395" cy="72" r="10"/></g>
    ${ripple('tut-fish-r', 250, 262)}${sparks('tut-fish-s', 250, 262)}
    ${hand('tut-fish-hand')}`,

  // 找規律：一排裡空一格，點缺的那個（點擊動畫在 250,262）
  pattern: `
    <rect x="90" y="50" width="460" height="100" rx="18" fill="#FFFDF7" stroke="${WOOD}" stroke-width="6"/>
    <text x="150" y="100" font-size="52" text-anchor="middle" dominant-baseline="central">🍎</text>
    <text x="250" y="100" font-size="52" text-anchor="middle" dominant-baseline="central">🍌</text>
    <text x="350" y="100" font-size="52" text-anchor="middle" dominant-baseline="central">🍎</text>
    <rect x="420" y="66" width="70" height="70" rx="14" fill="none" stroke="#E0955B" stroke-width="5" stroke-dasharray="9 7"/>
    <g class="tut-fish-b1"><rect x="205" y="217" width="90" height="90" rx="18" fill="#FFF3B0" stroke="#C39A1E" stroke-width="5"/>
    <text x="250" y="264" font-size="52" text-anchor="middle" dominant-baseline="central">🍌</text></g>
    <rect x="345" y="217" width="90" height="90" rx="18" fill="#FFF3B0" stroke="#C39A1E" stroke-width="5"/>
    <text x="390" y="264" font-size="52" text-anchor="middle" dominant-baseline="central">🍓</text>
    ${ripple('tut-fish-r', 250, 262)}${sparks('tut-fish-s', 250, 262)}
    ${hand('tut-fish-hand')}`,

  // 找不同：點不一樣的那張（點擊動畫在 250,262）
  odd: `
    <g class="tut-fish-b1"><rect x="190" y="200" width="120" height="120" rx="20" fill="#FFFDF7" stroke="${WOOD}" stroke-width="5"/>
    <text x="250" y="262" font-size="64" text-anchor="middle" dominant-baseline="central" transform="translate(500 0) scale(-1 1)">🐟</text></g>
    <rect x="190" y="50" width="120" height="120" rx="20" fill="#FFFDF7" stroke="${WOOD}" stroke-width="5"/>
    <text x="250" y="112" font-size="64" text-anchor="middle" dominant-baseline="central">🐟</text>
    <rect x="340" y="50" width="120" height="120" rx="20" fill="#FFFDF7" stroke="${WOOD}" stroke-width="5"/>
    <text x="400" y="112" font-size="64" text-anchor="middle" dominant-baseline="central">🐟</text>
    <rect x="340" y="200" width="120" height="120" rx="20" fill="#FFFDF7" stroke="${WOOD}" stroke-width="5"/>
    <text x="400" y="262" font-size="64" text-anchor="middle" dominant-baseline="central">🐟</text>
    ${ripple('tut-fish-r', 250, 262)}${sparks('tut-fish-s', 250, 262)}
    ${hand('tut-fish-hand')}`,

  // 迷宮：按方向鍵走到房子（點擊動畫按的是往右的鍵，在 250,262）
  maze: `
    <rect x="300" y="40" width="300" height="200" rx="14" fill="#FFFDF7"/>
    <path d="M300 40h300v200H300z M400 40v120 M500 140v100" fill="none" stroke="#6E9C58" stroke-width="10" stroke-linecap="round"/>
    <text x="350" y="190" font-size="54" text-anchor="middle" dominant-baseline="central">🐶</text>
    <text x="550" y="90" font-size="54" text-anchor="middle" dominant-baseline="central">🏠</text>
    <g class="tut-fish-b1"><circle cx="250" cy="262" r="44" fill="#8A6FB0" stroke="#5E4880" stroke-width="5"/>
    <path d="M232 262h36 M254 246l16 16-16 16" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></g>
    ${ripple('tut-fish-r', 250, 262)}${sparks('tut-fish-s', 250, 262)}
    ${hand('tut-fish-hand')}`,

  // 認字母：看上面的字母，點開頭是這個字母的圖（點擊動畫在 250,262）
  letterpic: `
    <rect x="250" y="20" width="140" height="100" rx="18" fill="#FFFDF7" stroke="${WOOD}" stroke-width="6"/>
    <text x="320" y="72" font-size="64" font-family="Arial, sans-serif" font-weight="900" fill="${INK}" text-anchor="middle" dominant-baseline="central">Aa</text>
    <g class="tut-fish-b1"><rect x="200" y="212" width="100" height="100" rx="18" fill="#FFFDF7" stroke="${WOOD}" stroke-width="5"/>
    <text x="250" y="264" font-size="62" text-anchor="middle" dominant-baseline="central">🍎</text></g>
    <rect x="370" y="212" width="100" height="100" rx="18" fill="#FFFDF7" stroke="${WOOD}" stroke-width="5"/>
    <text x="420" y="264" font-size="62" text-anchor="middle" dominant-baseline="central">🐶</text>
    ${ripple('tut-fish-r', 250, 262)}${sparks('tut-fish-s', 250, 262)}
    ${hand('tut-fish-hand')}`,

  // 聽字母：先聽，點聽到的字母（點擊動畫在 250,262）
  letterhear: `
    ${SPEAKER}
    <g class="tut-fish-b1"><rect x="200" y="212" width="100" height="100" rx="18" fill="#FFFDF7" stroke="${WOOD}" stroke-width="5"/>
    <text x="250" y="264" font-size="64" font-family="Arial, sans-serif" font-weight="900" fill="${INK}" text-anchor="middle" dominant-baseline="central">B</text></g>
    <rect x="370" y="212" width="100" height="100" rx="18" fill="#FFFDF7" stroke="${WOOD}" stroke-width="5"/>
    <text x="420" y="264" font-size="64" font-family="Arial, sans-serif" font-weight="900" fill="${INK}" text-anchor="middle" dominant-baseline="central">D</text>
    ${ripple('tut-fish-r', 250, 262)}${sparks('tut-fish-s', 250, 262)}
    ${hand('tut-fish-hand')}`,

  // 拼單字：把字母拖進下一格（跟填空同一套拖曳動畫，空格在 371,132）
  wordspell: `
    <text x="110" y="120" font-size="80" text-anchor="middle" dominant-baseline="central">🐱</text>
    <rect x="200" y="80" width="300" height="110" rx="20" fill="#FFFDF7" stroke="${WOOD}" stroke-width="7"/>
    <text x="250" y="132" font-size="60" font-family="Arial, sans-serif" font-weight="900" fill="${INK}" text-anchor="middle" dominant-baseline="central">C</text>
    <text x="300" y="132" font-size="60" font-family="Arial, sans-serif" font-weight="900" fill="${INK}" text-anchor="middle" dominant-baseline="central">A</text>
    <rect class="tut-fill-blank" x="336" y="92" width="70" height="80" rx="14" fill="none" stroke="#E0955B" stroke-width="5" stroke-dasharray="10 8"/>
    <g class="tut-fill-tile"><rect x="285" y="262" width="80" height="80" rx="16" fill="#FFF3B0" stroke="#F6F3E6" stroke-width="5"/>
    <text x="325" y="304" font-size="56" font-family="Arial, sans-serif" font-weight="900" fill="${INK}" text-anchor="middle" dominant-baseline="central">T</text></g>
    <rect x="435" y="262" width="80" height="80" rx="16" fill="#FFF3B0" stroke="#F6F3E6" stroke-width="5"/>
    <text x="475" y="304" font-size="56" font-family="Arial, sans-serif" font-weight="900" fill="${INK}" text-anchor="middle" dominant-baseline="central">D</text>
    ${sparks('tut-fill-s', 371, 132)}
    ${hand('tut-fill-hand')}`,

  // 從詞拉一條線到圖
  match: `
    <rect x="60" y="148" width="190" height="110" rx="20" fill="#FFFDF7" stroke="${WOOD}" stroke-width="6"/>
    <text x="155" y="205" font-size="58" ${FONT} fill="${INK}" text-anchor="middle" dominant-baseline="central">ㄇㄠ</text>
    <g class="tut-match-pic"><rect x="430" y="143" width="120" height="120" rx="22" fill="#FFFDF7" stroke="${WOOD}" stroke-width="5"/>
    <text x="490" y="205" font-size="70" text-anchor="middle" dominant-baseline="central">🐱</text></g>
    <line class="tut-match-line" x1="252" y1="203" x2="428" y2="203" stroke="#6B9E6B" stroke-width="10" stroke-linecap="round" stroke-dasharray="176" stroke-dashoffset="176"/>
    ${sparks('tut-match-s', 490, 203)}
    ${hand('tut-match-hand')}`,

  // 把一塊拖進空格
  fill: `
    <rect x="150" y="60" width="340" height="140" rx="24" fill="#FFFDF7" stroke="${WOOD}" stroke-width="8"/>
    <text x="255" y="132" font-size="80" ${FONT} fill="${INK}" text-anchor="middle" dominant-baseline="central">ㄚ</text>
    <rect class="tut-fill-blank" x="336" y="88" width="70" height="88" rx="14" fill="none" stroke="#E0955B" stroke-width="5" stroke-dasharray="10 8"/>
    <g class="tut-fill-tile"><rect x="285" y="262" width="80" height="80" rx="16" fill="#FFF3B0" stroke="#C39A1E" stroke-width="5"/>
    <text x="325" y="304" font-size="56" ${FONT} fill="${INK}" text-anchor="middle" dominant-baseline="central">ㄧ</text></g>
    <rect x="435" y="262" width="80" height="80" rx="16" fill="#FFF3B0" stroke="#C39A1E" stroke-width="5"/>
    <text x="475" y="304" font-size="56" ${FONT} fill="${INK}" text-anchor="middle" dominant-baseline="central">ㄨ</text>
    ${sparks('tut-fill-s', 371, 132)}
    ${hand('tut-fill-hand')}`,

  // 把調號拖進音節右邊的空格（跟填空同一套動畫，位置對齊）
  tone: `
    <text x="80" y="130" font-size="90" text-anchor="middle" dominant-baseline="central">🐴</text>
    <rect x="200" y="40" width="240" height="160" rx="24" fill="#FFFDF7" stroke="${WOOD}" stroke-width="8"/>
    <text x="310" y="90" font-size="58" ${FONT} fill="${INK}" text-anchor="middle" dominant-baseline="central">ㄇ</text>
    <text x="310" y="148" font-size="58" ${FONT} fill="${INK}" text-anchor="middle" dominant-baseline="central">ㄚ</text>
    <rect class="tut-fill-blank" x="351" y="106" width="40" height="52" rx="8" fill="none" stroke="#E0955B" stroke-width="5" stroke-dasharray="8 6"/>
    <g class="tut-fill-tile"><rect x="285" y="262" width="80" height="80" rx="16" fill="#FFF3B0" stroke="#C39A1E" stroke-width="5"/>
    <path d="M309 292 L325 314 L341 292" stroke="${INK}" stroke-width="7" fill="none"/></g>
    <rect x="435" y="262" width="80" height="80" rx="16" fill="#FFF3B0" stroke="#C39A1E" stroke-width="5"/>
    <path d="M465 316 L485 288" stroke="${INK}" stroke-width="7" fill="none"/>
    ${sparks('tut-fill-s', 371, 132)}
    ${hand('tut-fill-hand')}`,

  // 拼拼看：先聽，再把磁磚拖進牌子上的下一格（跟填空同一套動畫，空格位置對齊）
  spell: `
    ${SPEAKER}
    <rect x="290" y="6" width="162" height="196" rx="22" fill="#FFFDF7" stroke="${WOOD}" stroke-width="8"/>
    <text x="371" y="46" font-size="50" ${FONT} fill="${INK}" text-anchor="middle" dominant-baseline="central">ㄇ</text>
    <rect class="tut-fill-blank" x="336" y="92" width="70" height="80" rx="14" fill="none" stroke="#E0955B" stroke-width="5" stroke-dasharray="10 8"/>
    <g class="tut-fill-tile"><rect x="285" y="262" width="80" height="80" rx="16" fill="#FFF3B0" stroke="#C39A1E" stroke-width="5"/>
    <text x="325" y="304" font-size="56" ${FONT} fill="${INK}" text-anchor="middle" dominant-baseline="central">ㄠ</text></g>
    <rect x="435" y="262" width="80" height="80" rx="16" fill="#FFF3B0" stroke="#C39A1E" stroke-width="5"/>
    <text x="475" y="304" font-size="56" ${FONT} fill="${INK}" text-anchor="middle" dominant-baseline="central">ㄡ</text>
    ${sparks('tut-fill-s', 371, 132)}
    ${hand('tut-fill-hand')}`,

  // 在板子上寫
  write: `
    <rect x="170" y="70" width="300" height="280" rx="26" fill="#FFFDF7" stroke="${WOOD}" stroke-width="8"/>
    <path class="tut-write-ink" d="M250 130 L250 280 L400 280" stroke="${INK}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" fill="none" stroke-dasharray="300" stroke-dashoffset="300"/>
    <g class="tut-write-ok"><circle cx="470" cy="340" r="36" fill="#6B9E6B" stroke="#466E46" stroke-width="5"/><path d="M454 340 l11 11 l20 -22" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>
    ${hand('tut-write-hand')}`,

  // 學寫字：板子上一筆淡淡的，起點有圓點，小手從圓點照箭頭寫過去
  learn: `
    <rect x="170" y="70" width="300" height="280" rx="26" fill="#FFFDF7" stroke="${WOOD}" stroke-width="8"/>
    <path d="M250 130 L250 280 L400 280" stroke="#F3D3B8" stroke-width="30" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path class="tut-write-ink" d="M250 130 L250 280 L400 280" stroke="#E0955B" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" fill="none" stroke-dasharray="300" stroke-dashoffset="300"/>
    <path d="M236 168 L250 190 L264 168 Z" fill="#E0955B"/>
    <circle cx="250" cy="130" r="16" fill="#E0955B" stroke="#FFFDF7" stroke-width="5"/>
    <g class="tut-write-ok"><circle cx="470" cy="340" r="36" fill="#6B9E6B" stroke="#466E46" stroke-width="5"/><path d="M454 340 l11 11 l20 -22" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>
    ${hand('tut-write-hand')}`,

  // 看牌子、按麥克風、唸出來
  speak: `
    <rect x="245" y="40" width="150" height="150" rx="22" fill="#FFFDF7" stroke="${WOOD}" stroke-width="8"/>
    <text x="320" y="118" font-size="96" ${FONT} fill="${INK}" text-anchor="middle" dominant-baseline="central">ㄚ</text>
    <circle cx="170" cy="300" r="56" fill="#F6E7C8" stroke="#8A6A4C" stroke-width="5"/>
    <circle cx="150" cy="286" r="6" fill="${INK}"/><circle cx="190" cy="286" r="6" fill="${INK}"/>
    <ellipse class="tut-speak-mouth" cx="170" cy="318" rx="14" ry="10" fill="#C8553D"/>
    <path class="tut-wave s1" d="M244 282 q14 18 0 36" stroke="#E0955B" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path class="tut-wave s2" d="M262 268 q24 32 0 64" stroke="#E0955B" stroke-width="6" fill="none" stroke-linecap="round"/>
    <g class="tut-speak-mic"><circle cx="480" cy="300" r="52" fill="#C8553D" stroke="#8A3A2A" stroke-width="6"/>
    <rect x="468" y="272" width="24" height="40" rx="12" fill="#fff"/><path d="M458 302 a22 22 0 0 0 44 0 M480 324 v12" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/></g>
    ${sparks('tut-speak-s', 320, 115)}
    ${hand('tut-speak-hand')}`,
}

// 寫數字、寫字母的教學跟學寫字一樣
SCENES.numwrite = SCENES.learn
SCENES.abcwrite = SCENES.learn

const GO_SVG = '<svg viewBox="0 0 24 24" width="64" height="64" fill="#fff"><path d="M8 5v14l11-7z"/></svg>'

export function hasTutorial (kind) { return !!SCENES[kind] }

export function showTutorial (root, kind, onGo) {
  const wrap = document.createElement('div')
  wrap.className = 'tut'
  wrap.innerHTML = `
    <div class="tut-card">
      <svg class="tut-scene tut-${kind}" viewBox="0 0 640 400" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="636" height="396" rx="30" fill="#F7F1E3" stroke="#B08A63" stroke-width="4"/>
        ${SCENES[kind] || ''}
      </svg>
      <button class="tut-go" aria-label="開始">${GO_SVG}</button>
    </div>`
  root.appendChild(wrap)
  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    wrap.classList.add('out')
    setTimeout(() => wrap.remove(), 250)
  }
  wrap.querySelector('.tut-go').addEventListener('pointerdown', e => {
    e.stopPropagation()
    close()
    onGo()
  })
  return close
}
