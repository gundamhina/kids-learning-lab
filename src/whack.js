// 打地鼠玩法。符號從洞裡冒出來又縮回去，同時會有兩三個在外面，狗狗喊一個音，拍到對的就過關。
// 不計時、不扣分：沒拍到就等它下次再冒出來，拍錯才算錯（交給 main.js 記錄）。
// 介面跟釣魚一樣：start、lock/unlock、hint、shake、celebrate、sad、onAnswer、layout、destroy。

import { dogSvg, bgHtml, symbolMarkup } from './art.js'
import { STAGE, mountBgs } from './ui.js'

const HOLES = [[330, 430], [600, 430], [870, 430], [460, 620], [730, 620], [1000, 620]]
const UP_MS = 3200 // 每一個冒出來停多久（2026-09-25 使用者說太快，從 2100 放慢）
const POP_MS = 1100 // 每隔多久冒下一個（UP_MS／POP_MS ≈ 3，同時最多三個在外面）
// 老師首頁可以調的三種速度（慢、中、快）：兩個時間一起乘，同時在外面的數量不變
export const WHACK_SPEEDS = [1.5, 1, 0.65]

// 直的：兩欄三排，在狗狗下面、星星上面那段置中，排距 190～300
function holesFor () {
  if (!STAGE.portrait) return HOLES
  const top = 400
  const bottom = STAGE.h - 120
  const step = Math.max(190, Math.min(300, (bottom - top - 200) / 2))
  const y0 = (top + bottom) / 2 - step + 10
  return [0, 1, 2].flatMap(r => [[230, y0 + r * step], [570, y0 + r * step]])
}

function shuffleList (arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function createWhack (root, { color = 0, slow = 1 } = {}) {
  const upMs = UP_MS * slow
  const popMs = POP_MS * slow
  root.innerHTML = bgHtml('garden') + '<div class="frame">' +
    '<div class="dog-wrap whack-dog">' + dogSvg(color) + '</div>' +
    '<div class="holes">' + HOLES.map(() => `
      <div class="hole">
        <div class="hole-back"></div>
        <div class="mole"><span></span></div>
        <div class="hole-front"></div>
      </div>`).join('') + '</div></div>'
  mountBgs(root)
  const dogWrap = root.querySelector('.whack-dog')
  const holes = [...root.querySelectorAll('.hole')]
  const moles = holes.map(h => h.querySelector('.mole'))
  const hideTimers = new Map() // mole → 縮回去的計時器
  let handler = null
  let locked = true
  let current = null
  let running = false
  let timer = null
  let queue = []
  let glowOnce = false
  let marked = false // 答錯兩次以上：這一題的正解每次冒出來都發亮

  function layout () {
    holesFor().forEach(([x, y], i) => {
      holes[i].style.left = (x - 110) + 'px'
      holes[i].style.top = (y - 90) + 'px'
    })
  }
  layout()

  root.addEventListener('pointerdown', e => {
    const mole = e.target.closest('.mole')
    if (!mole || locked || !handler || !mole.classList.contains('up')) return
    handler(mole.dataset.symbol, mole)
  })

  function upMoles () { return moles.filter(m => m.classList.contains('up')) }
  function moleOf (symbol) { return upMoles().find(m => m.dataset.symbol === symbol) || null }
  function hideMole (m) {
    clearTimeout(hideTimers.get(m))
    hideTimers.delete(m)
    m.classList.remove('up')
  }
  function hideAll () { moles.forEach(hideMole) }

  // 出場順序：干擾項隨機，目標排在第 2 個，之後每 3 個出現一次
  function refill () {
    const distractors = shuffleList(current.options.filter(s => s !== current.target))
    const seq = []
    let d = 0
    for (let i = 0; i < 9; i++) {
      if (i % 3 === 1) seq.push(current.target)
      else { seq.push(distractors[d % distractors.length]); d++ }
    }
    queue.push(...seq)
  }

  // 每 popMs 從空的洞冒一個出來；同一個符號不會同時出現兩個
  function popNext () {
    if (!running) return
    timer = setTimeout(popNext, popMs)
    if (queue.length < 3) refill()
    const free = moles.filter(m => !m.classList.contains('up'))
    if (!free.length) return
    const showing = new Set(upMoles().map(m => m.dataset.symbol))
    const idx = queue.findIndex(s => !showing.has(s))
    if (idx < 0) return
    const sym = queue.splice(idx, 1)[0]
    const mole = free[Math.floor(Math.random() * free.length)]
    mole.dataset.symbol = sym
    mole.querySelector('span').innerHTML = symbolMarkup(sym)
    mole.classList.remove('shake', 'hit', 'hint-loop')
    if (sym === current.target && (glowOnce || marked)) {
      mole.classList.add('hint-loop')
      glowOnce = false
    }
    mole.classList.add('up')
    hideTimers.set(mole, setTimeout(() => hideMole(mole), upMs))
  }

  function stopLoop () {
    running = false
    clearTimeout(timer)
    timer = null
  }

  function start (question) {
    current = question
    locked = true
    queue = []
    glowOnce = false
    marked = false
    stopLoop()
    hideAll()
    moles.forEach(m => m.classList.remove('hit', 'shake', 'hint-loop'))
  }

  function unlock () {
    locked = false
    if (!running) { running = true; timer = setTimeout(popNext, 200) }
  }
  function lock () { locked = true }

  // 提示：目標在外面就發光；不在就等它下一次冒出來時發一次
  function hint () {
    const m = moleOf(current.target)
    if (m) {
      m.classList.remove('hint-loop')
      void m.offsetWidth
      m.classList.add('hint-loop')
      return
    }
    glowOnce = true
  }
  // 答錯第二次起：正解每次冒出來都發亮，直到打中
  function mark () {
    marked = true
    const m = moleOf(current.target)
    if (m) m.classList.add('hint-loop')
  }
  function shake (symbol) {
    const mole = moleOf(symbol)
    if (!mole) return
    mole.classList.remove('shake')
    void mole.offsetWidth
    mole.classList.add('shake')
  }

  // 拍到了：停止冒出，其他的縮回去，拍到的那一個彈一下留在外面
  function celebrate (symbol) {
    return new Promise(resolve => {
      stopLoop()
      const mole = moleOf(symbol)
      upMoles().forEach(m => { if (m !== mole) hideMole(m) })
      if (mole) { clearTimeout(hideTimers.get(mole)); mole.classList.remove('hint-loop'); mole.classList.add('hit') }
      dogWrap.classList.remove('jump')
      void dogWrap.offsetWidth
      dogWrap.classList.add('jump')
      setTimeout(() => { if (mole) { mole.classList.remove('hit'); hideMole(mole) } resolve() }, 650)
    })
  }
  function sad () {
    dogWrap.classList.remove('tilt')
    void dogWrap.offsetWidth
    dogWrap.classList.add('tilt')
  }
  function onAnswer (fn) { handler = fn }
  function destroy () { stopLoop(); hideAll(); root.innerHTML = ''; handler = null }

  return { start, unlock, lock, hint, mark, shake, celebrate, sad, onAnswer, layout, destroy }
}
