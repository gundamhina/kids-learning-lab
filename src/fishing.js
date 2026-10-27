// 釣魚玩法。負責畫泡泡、接點擊、播動畫；對錯的判斷與記錄交給 main.js。
// 介面（跟打地鼠共用）：start(question)、lock/unlock、hint、shake、celebrate(symbol)→Promise、sad、onAnswer(fn)、layout、destroy。
// 狗狗跟碼頭一起放在背景層裡（會跟著背景縮放），泡泡放在 frame 裡。

import { dogSvg, bgHtml, symbolMarkup } from './art.js'
import { STAGE, mountBgs } from './ui.js'

// 橫的：各選項數的泡泡位置（1200×800 frame 座標）
const SLOTS = {
  2: [[620, 600], [960, 600]],
  3: [[560, 620], [800, 560], [1040, 640]],
  4: [[540, 560], [780, 640], [1000, 560], [820, 480]],
  5: [[520, 580], [720, 660], [900, 540], [1060, 660], [700, 490]],
  6: [[500, 560], [680, 650], [860, 540], [1040, 650], [640, 480], [960, 470]],
}

// 直的：泡泡排成格子，最下面一列緊貼狗狗頭頂上方，往上疊；太擠就把列距縮小，最上面不碰到上排按鈕
function bubbleSlots (n, dogTop = STAGE.h - 500) {
  if (!STAGE.portrait) return SLOTS[n] || SLOTS[6]
  const cols = n <= 4 ? 2 : 3
  const rows = Math.ceil(n / cols)
  const cell = 215
  const last = dogTop - 110
  const step = rows > 1 ? Math.min(cell, (last - 200) / (rows - 1)) : cell
  const y0 = last - (rows - 1) * step
  const out = []
  for (let r = 0; r < rows; r++) {
    const inRow = Math.min(cols, n - r * cols)
    const x0 = STAGE.w / 2 - (inRow - 1) * cell / 2
    for (let c = 0; c < inRow; c++) out.push([x0 + c * cell, y0 + r * step])
  }
  return out
}

// 碼頭上插著的一支釣竿（場景座標）。隊員的圖不拿釣竿了（2026-09-29 起每位各自一個職業動作），竿子由這裡畫。
// 竿尖固定在 (426, 278)，釣到的泡泡飛到這裡；釣線從竿尖垂進水裡，末端一個紅白浮標
// 外面包一層 div：場景圖載好時 .has-art > svg 會被藏起來（那是給向量底圖用的）
const ROD_SVG = `<div class="fish-rod"><svg viewBox="0 0 1200 800" width="1200" height="800" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M426 278 Q470 420 520 598" fill="none" stroke="#F6F3E6" stroke-width="2.5" opacity="0.85"/>
  <circle cx="520" cy="604" r="9" fill="#FFFDF7" stroke="#5A3A20" stroke-width="2"/>
  <path d="M511 604 a9 9 0 0 1 18 0 z" fill="#C8553D"/>
  <path d="M366 540 L426 278" stroke="#5A3A20" stroke-width="7" stroke-linecap="round"/>
  <path d="M366 540 L380 478" stroke="#2B3A4A" stroke-width="11" stroke-linecap="round"/>
  <circle cx="386" cy="468" r="10" fill="#B0B8C4" stroke="#5C6C78" stroke-width="3"/>
  <rect x="348" y="528" width="40" height="30" rx="6" fill="#8B6746" stroke="#5A3A20" stroke-width="3"/>
</svg></div>`

export function createFishing (root, { color = 0 } = {}) {
  root.innerHTML = bgHtml('scene', ROD_SVG + '<div class="dog-wrap fish-dog">' + dogSvg(color) + '</div>') +
    '<div class="frame"><div class="bubbles"></div></div>'
  mountBgs(root)
  const bubblesEl = root.querySelector('.bubbles')
  const dogWrap = root.querySelector('.fish-dog')
  const art = root.querySelector('.bg-art')
  const frame = root.querySelector('.frame')
  let handler = null
  let locked = true
  let current = null

  bubblesEl.addEventListener('pointerdown', e => {
    const b = e.target.closest('.bubble')
    if (!b || locked || !handler) return
    handler(b.dataset.symbol, b)
  })

  // 狗狗頭頂在舞台裡的 y：場景層位移加上狗狗在場景裡的位置乘縮放
  function dogTop () {
    return parseFloat(art.dataset.y || 0) + 226 * parseFloat(art.dataset.s || 1) - frame.offsetTop
  }
  function place () {
    const bubbles = [...bubblesEl.children]
    const slots = bubbleSlots(bubbles.length, dogTop())
    bubbles.forEach((b, i) => {
      if (b.classList.contains('caught')) return
      b.style.left = (slots[i][0] - 85) + 'px'
      b.style.top = (slots[i][1] - 85) + 'px'
    })
  }

  function start (question) {
    current = question
    locked = true
    bubblesEl.innerHTML = ''
    question.options.forEach((sym, i) => {
      const b = document.createElement('div')
      b.className = 'bubble'
      b.dataset.symbol = sym
      b.style.animationDelay = (i * 0.35) + 's'
      b.innerHTML = '<span>' + symbolMarkup(sym) + '</span>'
      bubblesEl.appendChild(b)
    })
    place()
  }

  function bubbleOf (symbol) {
    return bubblesEl.querySelector('.bubble[data-symbol="' + symbol + '"]')
  }

  function unlock () { locked = false }
  function lock () { locked = true }

  // 提示：正確的泡泡晃一下就停
  function hint () {
    const b = bubbleOf(current.target)
    if (!b) return
    b.classList.remove('hint-once')
    void b.offsetWidth
    b.classList.add('hint-once')
  }

  // 答錯第二次起：正解一直發亮，直到釣起來
  function mark (symbol) {
    const b = bubbleOf(symbol)
    if (b) b.classList.add('hint-loop')
  }

  function shake (symbol) {
    const b = bubbleOf(symbol)
    if (!b) return
    b.classList.remove('shake')
    void b.offsetWidth
    b.classList.add('shake')
  }

  // 釣起來：泡泡飛向釣竿尖端，狗狗跳一下
  function celebrate (symbol) {
    return new Promise(resolve => {
      const b = bubbleOf(symbol)
      if (!b) return resolve()
      b.classList.remove('hint-loop', 'hint-once', 'shake')
      b.classList.add('caught')
      const x = parseFloat(b.style.left)
      const y = parseFloat(b.style.top)
      // 釣竿尖端在場景座標 (426, 278)（ROD_SVG 畫的那支）。場景層有縮放位移，換成 frame 座標
      const s = parseFloat(art.dataset.s || 1)
      const tipX = parseFloat(art.dataset.x || 0) + 426 * s - frame.offsetLeft
      const tipY = parseFloat(art.dataset.y || 0) + 278 * s - frame.offsetTop
      b.style.transform = `translate(${tipX - 88 - x}px, ${tipY - 88 - y}px) scale(0.5)`
      dogWrap.classList.remove('jump')
      void dogWrap.offsetWidth
      dogWrap.classList.add('jump')
      setTimeout(() => {
        b.classList.add('gone')
        resolve()
      }, 700)
    })
  }

  function sad () {
    dogWrap.classList.remove('tilt')
    void dogWrap.offsetWidth
    dogWrap.classList.add('tilt')
  }

  function onAnswer (fn) { handler = fn }
  function layout () { place() }
  function destroy () { root.innerHTML = ''; handler = null }

  return { start, unlock, lock, hint, mark, shake, celebrate, sad, onAnswer, layout, destroy }
}
