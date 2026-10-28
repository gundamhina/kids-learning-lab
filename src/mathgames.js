// 數學的三個玩法畫面：數一數、做數量、比多少。出題在 mathq.js，對錯、紀錄、三級提示在 main.js。

import { dogSvg, bgHtml, twemojiName } from './art.js'
import { mountBgs } from './ui.js'

const itemImg = icon => `<img class="cnt-img" src="img/emoji/${twemojiName(icon)}.svg" alt="" draggable="false">`
// 東西的大小跟著數量變小，20 個也放得下
const itemSize = n => n <= 6 ? 120 : n <= 10 ? 100 : n <= 15 ? 84 : 72

function mathShell (root, color, cls, inner) {
  root.innerHTML = bgHtml('room') + `<div class="frame ${cls}">` +
    `<div class="dog-wrap math-dog">${dogSvg(color)}</div>${inner}</div>`
  mountBgs(root)
  const dogWrap = root.querySelector('.math-dog')
  return {
    jump () { dogWrap.classList.remove('jump'); void dogWrap.offsetWidth; dogWrap.classList.add('jump') },
    tilt () { dogWrap.classList.remove('tilt'); void dogWrap.offsetWidth; dogWrap.classList.add('tilt') },
  }
}
function shakeEl (el) {
  if (!el) return
  el.classList.remove('shake')
  void el.offsetWidth
  el.classList.add('shake')
}
// 把東西照 0～1 的座標擺進框裡（座標由 mathq.scatter 算）；用 clamp 夾住，靠邊的也不會超出框
function placeItems (box, icon, points, size, scale = 1) {
  const s = Math.round(size * scale)
  const pos = v => `clamp(10px, calc(${(v * 100).toFixed(2)}% - ${s / 2}px), calc(100% - ${s + 10}px))`
  box.innerHTML = points.map(([x, y], i) => `<button class="cnt-item" data-i="${i}" style="left:${pos(x)};top:${pos(y)};width:${s}px;height:${s}px">${itemImg(icon)}<span class="cnt-badge"></span></button>`).join('')
}

// ---- 數一數：框裡有幾個東西，從三張數字卡選。點東西會蓋上 1、2、3…幫她數（不算作答） ----
export function createCount (root, { color = 0 } = {}) {
  const dog = mathShell(root, color, 'count-frame',
    '<div class="cnt-panel"></div><div class="cnt-target" hidden></div><div class="num-cards"></div>')
  const panel = root.querySelector('.cnt-panel')
  const targetEl = root.querySelector('.cnt-target')
  let target = null
  const cardsEl = root.querySelector('.num-cards')
  let handler = null
  let tapFn = null
  let locked = true
  let answer = 0
  let counted = 0

  panel.addEventListener('pointerdown', e => {
    const it = e.target.closest('.cnt-item')
    if (!it || locked || it.classList.contains('counted')) return
    if (target && it.dataset.icon !== target) { shakeEl(it); return }
    counted++
    it.classList.add('counted')
    it.querySelector('.cnt-badge').textContent = counted
    if (tapFn) tapFn(counted)
  })
  cardsEl.addEventListener('pointerdown', e => {
    const c = e.target.closest('.num-card')
    if (!c || locked || !handler) return
    handler(Number(c.dataset.n), c)
  })

  // mix：mathq.countMixed 的結果（混好幾種東西，只數 mix.target）；沒有就是一種東西
  function start (n, icon, options, points, mix = null) {
    answer = n
    counted = 0
    locked = true
    target = mix ? mix.target : null
    panel.classList.remove('glow')
    targetEl.hidden = !mix
    if (mix) {
      targetEl.innerHTML = itemImg(mix.target) + '<b>?</b>'
      const size = itemSize(mix.items.length)
      const pos = v => `clamp(10px, calc(${(v * 100).toFixed(2)}% - ${size / 2}px), calc(100% - ${size + 10}px))`
      panel.innerHTML = mix.items.map(({ icon: ic, at: [x, y] }, i) => `<button class="cnt-item" data-i="${i}" data-icon="${ic}" style="left:${pos(x)};top:${pos(y)};width:${size}px;height:${size}px">${itemImg(ic)}<span class="cnt-badge"></span></button>`).join('')
    } else placeItems(panel, icon, points, itemSize(n))
    cardsEl.innerHTML = options.map(x => `<button class="num-card" data-n="${x}">${x}</button>`).join('')
  }
  const cardOf = n => cardsEl.querySelector(`.num-card[data-n="${n}"]`)
  return {
    start,
    unlock () { locked = false },
    lock () { locked = true },
    hint () { shakeEl(cardOf(answer)); if (target) shakeEl(targetEl) },
    mark () { const c = cardOf(answer); if (c) c.classList.add('answer-glow') },
    shake (n) { shakeEl(cardOf(n)) },
    celebrate (n) {
      const c = cardOf(n)
      if (c) { c.classList.remove('answer-glow'); c.classList.add('right') }
      if (target) targetEl.querySelector('b').textContent = n
      panel.classList.add('glow')
      dog.jump()
      return new Promise(resolve => setTimeout(resolve, 700))
    },
    sad () { dog.tilt() },
    onAnswer (fn) { handler = fn },
    onCountTap (fn) { tapFn = fn },
    layout () {},
    destroy () { root.innerHTML = ''; handler = tapFn = null },
  }
}

// ---- 做數量：左邊一個數字，把下面的東西點進盒子裡，放好按打勾。盒子裡的點一下會拿出來 ----
const MAKE_OK_SVG = '<svg viewBox="0 0 24 24" width="60" height="60" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
export function createMake (root, { color = 0 } = {}) {
  const dog = mathShell(root, color, 'make-frame',
    '<div class="make-target"></div><div class="make-tray"></div><div class="make-pool"></div>' +
    `<button class="round-btn home make-ok" aria-label="放好了">${MAKE_OK_SVG}</button>`)
  const targetEl = root.querySelector('.make-target')
  const tray = root.querySelector('.make-tray')
  const pool = root.querySelector('.make-pool')
  let handler = null
  let moveFn = null
  let locked = true

  function move (it, to) {
    to.appendChild(it)
    if (moveFn) moveFn(tray.children.length)
  }
  pool.addEventListener('pointerdown', e => {
    const it = e.target.closest('.cnt-item')
    if (it && !locked) move(it, tray)
  })
  tray.addEventListener('pointerdown', e => {
    const it = e.target.closest('.cnt-item')
    if (it && !locked) move(it, pool)
  })
  root.querySelector('.make-ok').addEventListener('pointerdown', () => {
    if (!locked && handler) handler(tray.children.length)
  })

  function start (n, icon, poolSize) {
    locked = true
    targetEl.textContent = n
    targetEl.classList.remove('answer-glow', 'glow')
    tray.innerHTML = ''
    tray.classList.remove('glow')
    pool.innerHTML = Array.from({ length: poolSize }, (_, i) => `<button class="cnt-item" data-i="${i}">${itemImg(icon)}</button>`).join('')
  }
  return {
    start,
    unlock () { locked = false },
    lock () { locked = true },
    hint () { shakeEl(targetEl) },
    mark () { targetEl.classList.add('answer-glow') },
    shake () { shakeEl(tray) },
    celebrate () {
      tray.classList.add('glow')
      targetEl.classList.remove('answer-glow')
      dog.jump()
      return new Promise(resolve => setTimeout(resolve, 700))
    },
    sad () { dog.tilt() },
    onAnswer (fn) { handler = fn },
    onMove (fn) { moveFn = fn },
    layout () {},
    destroy () { root.innerHTML = ''; handler = moveFn = null },
  }
}

// ---- 比多少：左右兩框，問哪一邊比較多（或比較少），點那一框 ----
// 問「多」：一堆點；問「少」：一個點。旁邊寫字給大人看，小孩聽狗狗唸
const MORE_SVG = '<svg viewBox="0 0 120 70" width="96" height="56"><g fill="#E0955B"><circle cx="20" cy="50" r="12"/><circle cx="46" cy="50" r="12"/><circle cx="72" cy="50" r="12"/><circle cx="98" cy="50" r="12"/><circle cx="33" cy="24" r="12"/><circle cx="59" cy="24" r="12"/><circle cx="85" cy="24" r="12"/></g></svg><b>多</b>'
const LESS_SVG = '<svg viewBox="0 0 120 70" width="96" height="56"><g fill="#E0955B"><circle cx="60" cy="40" r="14"/></g></svg><b>少</b>'
export function createCompare (root, { color = 0 } = {}) {
  const dog = mathShell(root, color, 'cmp-frame',
    '<div class="cmp-ask"></div><div class="cmp-side" data-side="left"></div><div class="cmp-side" data-side="right"></div>' +
    '<button class="cmp-equal" data-side="equal" hidden><b>一樣多</b></button>')
  const askEl = root.querySelector('.cmp-ask')
  const sides = { left: root.querySelector('.cmp-side[data-side="left"]'), right: root.querySelector('.cmp-side[data-side="right"]'), equal: root.querySelector('.cmp-equal') }
  let handler = null
  let locked = true
  let answer = null

  for (const [side, el] of Object.entries(sides)) {
    el.addEventListener('pointerdown', () => { if (!locked && handler && !el.classList.contains('right')) handler(side, el) })
  }
  // q：mathq.compareQuestion 的結果；points：兩邊的座標
  function start (q, icon, points) {
    locked = true
    answer = q.answer
    askEl.innerHTML = q.ask === 'more' ? MORE_SVG : LESS_SVG
    askEl.dataset.ask = q.ask
    const fewer = q.left < q.right ? 'left' : q.left > q.right ? 'right' : (Math.random() < 0.5 ? 'left' : 'right')
    sides.equal.hidden = !q.equal
    sides.equal.classList.remove('answer-glow', 'right')
    for (const side of ['left', 'right']) {
      const big = q.bigFewer && side === fewer ? 1.3 : 1
      sides[side].classList.remove('answer-glow', 'right', 'glow')
      placeItems(sides[side], icon, points[side], Math.round(itemSize(Math.max(q.left, q.right)) * 0.8), big)
    }
  }
  return {
    start,
    unlock () { locked = false },
    lock () { locked = true },
    hint () { shakeEl(sides[answer]) },
    mark () { sides[answer].classList.add('answer-glow') },
    shake (side) { shakeEl(sides[side]) },
    celebrate (side) {
      sides[side].classList.remove('answer-glow')
      sides[side].classList.add('right')
      dog.jump()
      return new Promise(resolve => setTimeout(resolve, 700))
    },
    sad () { dog.tilt() },
    onAnswer (fn) { handler = fn },
    layout () {},
    destroy () { root.innerHTML = ''; handler = null },
  }
}

// ---- 加減：上面一排算式（第 1～2 階只有圖、第 3～4 階數字下面有圖、第 5～6 階只有數字），下面三張數字卡 ----
// 減法的圖：一排東西，被拿走的那幾個打叉變淡
const CALC_X = '<svg class="calc-x" viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19" stroke="#C8553D" stroke-width="3.4" stroke-linecap="round"/></svg>'
function calcTerm (n, icon, show, gone = 0) {
  const pics = show ? `<span class="calc-pics n${Math.min(n, 10)}">${Array.from({ length: n }, (_, i) => `<span class="calc-pic${i >= n - gone ? ' gone' : ''}">${itemImg(icon)}${i >= n - gone ? CALC_X : ''}</span>`).join('')}</span>` : ''
  return pics
}
export function createCalc (root, { color = 0 } = {}) {
  const dog = mathShell(root, color, 'calc-frame', '<div class="calc-board"></div><div class="num-cards"></div>')
  const board = root.querySelector('.calc-board')
  const cardsEl = root.querySelector('.num-cards')
  let handler = null
  let locked = true
  let answer = 0
  cardsEl.addEventListener('pointerdown', e => {
    const c = e.target.closest('.num-card')
    if (!c || locked || !handler) return
    handler(Number(c.dataset.n), c)
  })
  // q：mathq.parseCalc 的結果；look：'pictures'、'both'、'numbers'
  function start (q, icon, options, look) {
    answer = q.answer
    locked = true
    board.className = 'calc-board look-' + look
    const num = (n, pics) => `<span class="calc-term">${look === 'pictures' ? '' : `<b class="calc-num">${n}</b>`}${pics}</span>`
    const showPics = look !== 'numbers'
    const op = `<span class="calc-op">${q.op === '+' ? '＋' : '－'}</span>`
    // 減法有圖時：左邊畫 a 個、最後 b 個打叉，右邊只寫減幾（第 1～2 階連數字都不寫，只看打叉）
    const left = q.op === '-' && showPics ? num(q.a, calcTerm(q.a, icon, true, q.b)) : num(q.a, calcTerm(q.a, icon, showPics))
    const right = q.op === '-' && showPics ? (look === 'pictures' ? '' : op + num(q.b, '')) : op + num(q.b, calcTerm(q.b, icon, showPics))
    board.innerHTML = left + right + '<span class="calc-op">＝</span><span class="calc-term"><b class="calc-num calc-q">?</b></span>'
    cardsEl.innerHTML = options.map(x => `<button class="num-card" data-n="${x}">${x}</button>`).join('')
  }
  const cardOf = n => cardsEl.querySelector(`.num-card[data-n="${n}"]`)
  return {
    start,
    unlock () { locked = false },
    lock () { locked = true },
    hint () { shakeEl(cardOf(answer)) },
    mark () { const c = cardOf(answer); if (c) c.classList.add('answer-glow') },
    shake (n) { shakeEl(cardOf(n)) },
    celebrate (n) {
      const c = cardOf(n)
      if (c) { c.classList.remove('answer-glow'); c.classList.add('right') }
      const qm = board.querySelector('.calc-q')
      if (qm) { qm.textContent = n; qm.classList.add('done') }
      board.classList.add('glow')
      dog.jump()
      return new Promise(resolve => setTimeout(resolve, 900))
    },
    sad () { dog.tilt() },
    onAnswer (fn) { handler = fn },
    layout () {},
    destroy () { root.innerHTML = ''; handler = null },
  }
}
