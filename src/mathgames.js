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
    '<div class="cnt-panel"></div><div class="num-cards"></div>')
  const panel = root.querySelector('.cnt-panel')
  const cardsEl = root.querySelector('.num-cards')
  let handler = null
  let tapFn = null
  let locked = true
  let answer = 0
  let counted = 0

  panel.addEventListener('pointerdown', e => {
    const it = e.target.closest('.cnt-item')
    if (!it || locked || it.classList.contains('counted')) return
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

  function start (n, icon, options, points) {
    answer = n
    counted = 0
    locked = true
    panel.classList.remove('glow')
    placeItems(panel, icon, points, itemSize(n))
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
    '<div class="cmp-ask"></div><div class="cmp-side" data-side="left"></div><div class="cmp-side" data-side="right"></div>')
  const askEl = root.querySelector('.cmp-ask')
  const sides = { left: root.querySelector('.cmp-side[data-side="left"]'), right: root.querySelector('.cmp-side[data-side="right"]') }
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
    const fewer = q.left < q.right ? 'left' : 'right'
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

