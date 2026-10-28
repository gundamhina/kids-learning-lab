// 動腦的三個玩法畫面：找規律、選卡片找不同、迷宮。出題在 brainq.js，對錯、紀錄、提示在 main.js。

import { dogSvg, bgHtml, twemojiName } from './art.js'
import { STAGE, mountBgs, stagePoint } from './ui.js'

const brainImg = icon => `<img class="brain-img" src="img/emoji/${twemojiName(icon)}.svg" alt="" draggable="false">`
function brainShell (root, color, cls, inner, bg = 'room') {
  root.innerHTML = bgHtml(bg) + `<div class="frame ${cls}"><div class="dog-wrap brain-dog">${dogSvg(color)}</div>${inner}</div>`
  mountBgs(root)
  const dogWrap = root.querySelector('.brain-dog')
  return {
    jump () { dogWrap.classList.remove('jump'); void dogWrap.offsetWidth; dogWrap.classList.add('jump') },
    tilt () { dogWrap.classList.remove('tilt'); void dogWrap.offsetWidth; dogWrap.classList.add('tilt') },
  }
}
function brainShake (el) {
  if (!el) return
  el.classList.remove('shake')
  void el.offsetWidth
  el.classList.add('shake')
}

// ---- 找規律：上面一排圖，下面三個選項 ----
export function createPattern (root, { color = 0 } = {}) {
  const dog = brainShell(root, color, 'pattern-frame', '<div class="pat-row"></div><div class="pat-opts"></div>')
  const rowEl = root.querySelector('.pat-row')
  const optsEl = root.querySelector('.pat-opts')
  let handler = null
  let locked = true
  let q = null
  optsEl.addEventListener('pointerdown', e => {
    const c = e.target.closest('.pat-opt')
    if (!c || locked || !handler || c.classList.contains('right')) return
    handler(Number(c.dataset.i), c)
  })
  function start (question) {
    q = question
    locked = true
    const size = Math.min(110, Math.floor((STAGE.portrait ? 720 : 940) / q.row.length) - 10)
    rowEl.style.setProperty('--tile', size + 'px')
    rowEl.classList.remove('glow')
    rowEl.innerHTML = q.row.map((icon, i) => i === q.blank
      ? '<span class="pat-cell pat-blank">?</span>'
      : `<span class="pat-cell">${brainImg(icon)}</span>`).join('')
    optsEl.innerHTML = q.options.map((o, i) => `<button class="pat-opt n${o.length}" data-i="${i}">${o.map(brainImg).join('')}</button>`).join('')
  }
  const answerIndex = () => q.options.findIndex(o => o.join() === q.answer.join())
  const optOf = i => optsEl.querySelector(`.pat-opt[data-i="${i}"]`)
  return {
    start,
    answerIndex,
    unlock () { locked = false },
    lock () { locked = true },
    hint () { brainShake(optOf(answerIndex())) },
    mark () { const c = optOf(answerIndex()); if (c) c.classList.add('answer-glow') },
    shake (i) { brainShake(optOf(i)) },
    celebrate (i) {
      const c = optOf(i)
      if (c) { c.classList.remove('answer-glow'); c.classList.add('right') }
      const blank = rowEl.querySelector('.pat-blank')
      if (blank) { blank.classList.remove('pat-blank'); blank.innerHTML = brainImg(q.answer[0]) }
      rowEl.classList.add('glow')
      dog.jump()
      return new Promise(resolve => setTimeout(resolve, 800))
    },
    sad () { dog.tilt() },
    onAnswer (fn) { handler = fn },
    layout () {},
    destroy () { root.innerHTML = ''; handler = null },
  }
}

// ---- 選卡片找不同：幾張卡片只有一張不一樣 ----
// kind：icon 換一種圖、color 換顏色、flip 左右顛倒、turn 轉個方向、small 變小
const ODD_STYLE = { color: 'filter:hue-rotate(150deg) saturate(1.4)', flip: 'transform:scaleX(-1)', turn: 'transform:rotate(90deg)', small: 'transform:scale(.72)' }
export function createOdd (root, { color = 0 } = {}) {
  const dog = brainShell(root, color, 'odd-frame', '<div class="odd-grid"></div>')
  const grid = root.querySelector('.odd-grid')
  let handler = null
  let locked = true
  let q = null
  grid.addEventListener('pointerdown', e => {
    const c = e.target.closest('.odd-card')
    if (!c || locked || !handler || c.classList.contains('right')) return
    handler(Number(c.dataset.i), c)
  })
  function start (question) {
    q = question
    locked = true
    grid.className = 'odd-grid n' + q.n
    grid.innerHTML = Array.from({ length: q.n }, (_, i) => {
      const isOdd = i === q.odd
      const icon = isOdd && q.kind === 'icon' ? q.other : q.icon
      const style = isOdd && ODD_STYLE[q.kind] ? ` style="${ODD_STYLE[q.kind]}"` : ''
      return `<button class="odd-card" data-i="${i}"><img class="brain-img" src="img/emoji/${twemojiName(icon)}.svg" alt=""${style} draggable="false"></button>`
    }).join('')
  }
  const cardOf = i => grid.querySelector(`.odd-card[data-i="${i}"]`)
  return {
    start,
    unlock () { locked = false },
    lock () { locked = true },
    hint () { brainShake(cardOf(q.odd)) },
    mark () { const c = cardOf(q.odd); if (c) c.classList.add('answer-glow') },
    shake (i) { brainShake(cardOf(i)) },
    celebrate (i) {
      const c = cardOf(i)
      if (c) { c.classList.remove('answer-glow'); c.classList.add('right') }
      dog.jump()
      return new Promise(resolve => setTimeout(resolve, 700))
    },
    sad () { dog.tilt() },
    onAnswer (fn) { handler = fn },
    layout () {},
    destroy () { root.innerHTML = ''; handler = null },
  }
}

// ---- 迷宮：方向鍵、在迷宮上滑一下、或點旁邊那一格都能走。撿完骨頭出口才會開 ----
const ARROW = d => `<svg viewBox="0 0 24 24" width="48" height="48" fill="#fff" style="transform:rotate(${{ n: 0, e: 90, s: 180, w: 270 }[d]}deg)"><path d="M12 4l7 8h-4.5v8h-5v-8H5z"/></svg>`
const LOCK_SVG = '<svg viewBox="0 0 24 24" class="maze-lock"><rect x="5" y="10" width="14" height="11" rx="2.5" fill="#8A6A4C"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10" fill="none" stroke="#8A6A4C" stroke-width="2.6"/></svg>'
export function createMaze (root, { color = 0 } = {}) {
  brainShell(root, color, 'maze-frame',
    '<div class="maze-box"><svg class="maze-walls"></svg><div class="maze-things"></div><div class="maze-hero"></div></div>' +
    `<div class="maze-pad">${['n', 'w', 'e', 's'].map(d => `<button class="round-btn maze-btn" data-dir="${d}" aria-label="${d}">${ARROW(d)}</button>`).join('')}</div>`,
    'garden')
  const box = root.querySelector('.maze-box')
  const wallsEl = root.querySelector('.maze-walls')
  const things = root.querySelector('.maze-things')
  const hero = root.querySelector('.maze-hero')
  hero.innerHTML = dogSvg(color)
  let level = null
  let pos = [0, 0]
  let cell = 80
  let left = []
  let moveFn = null
  let bumpFn = null
  let doneFn = null
  let locked = true

  function draw () {
    const { w, h, walls, exit } = level
    const maxW = STAGE.portrait ? 720 : 830
    const maxH = STAGE.portrait ? 720 : 560
    cell = Math.floor(Math.min(maxW / w, maxH / h))
    box.style.width = cell * w + 'px'
    box.style.height = cell * h + 'px'
    box.style.setProperty('--cell', cell + 'px')
    wallsEl.setAttribute('viewBox', `0 0 ${w * cell} ${h * cell}`)
    let d = ''
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = walls[y][x]; const X = x * cell; const Y = y * cell
        if (c.n) d += `M${X} ${Y}h${cell}`
        if (c.w) d += `M${X} ${Y}v${cell}`
        if (y === h - 1 && c.s) d += `M${X} ${Y + cell}h${cell}`
        if (x === w - 1 && c.e) d += `M${X + cell} ${Y}v${cell}`
      }
    }
    wallsEl.innerHTML = `<path d="${d}" stroke="#6E9C58" stroke-width="${Math.max(6, cell / 9)}" stroke-linecap="round" fill="none"/>`
    const at = ([x, y]) => `left:${x * cell}px;top:${y * cell}px;width:${cell}px;height:${cell}px`
    things.innerHTML = `<div class="maze-exit ${left.length ? 'locked' : ''}" style="${at(exit)}"><img class="brain-img" src="img/emoji/${twemojiName('🏠')}.svg" alt="">${LOCK_SVG}</div>` +
      left.map(([x, y]) => `<div class="maze-item" data-at="${x},${y}" style="${at([x, y])}"><img class="brain-img" src="img/emoji/${twemojiName('🦴')}.svg" alt=""></div>`).join('')
    placeHero()
  }
  function placeHero () {
    hero.style.width = hero.style.height = cell + 'px'
    hero.style.transform = `translate(${pos[0] * cell}px, ${pos[1] * cell}px)`
  }
  const STEP = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] }
  function go (dir) {
    if (locked || !level) return
    const [x, y] = pos
    if (level.walls[y][x][dir]) {
      hero.classList.remove('bump'); void hero.offsetWidth; hero.classList.add('bump')
      if (bumpFn) bumpFn()
      return
    }
    pos = [x + STEP[dir][0], y + STEP[dir][1]]
    placeHero()
    const k = left.findIndex(([ix, iy]) => ix === pos[0] && iy === pos[1])
    if (k >= 0) {
      left.splice(k, 1)
      const el = things.querySelector(`.maze-item[data-at="${pos[0]},${pos[1]}"]`)
      if (el) el.classList.add('got')
      if (!left.length) things.querySelector('.maze-exit').classList.remove('locked')
      if (moveFn) moveFn('item')
    } else if (moveFn) moveFn('step')
    if (!left.length && pos[0] === level.exit[0] && pos[1] === level.exit[1]) {
      locked = true
      if (doneFn) doneFn()
    }
  }
  root.querySelectorAll('.maze-btn').forEach(b => b.addEventListener('pointerdown', () => go(b.dataset.dir)))
  // 在迷宮上滑一下：往滑的方向走一格；點一下旁邊那一格也走過去
  let sw = null
  box.addEventListener('pointerdown', e => { sw = stagePoint(e) })
  box.addEventListener('pointerup', e => {
    if (!sw) return
    const [x0, y0] = sw
    const [x1, y1] = stagePoint(e)
    sw = null
    const dx = x1 - x0; const dy = y1 - y0
    if (Math.hypot(dx, dy) > 30) { go(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'e' : 'w') : (dy > 0 ? 's' : 'n')); return }
    // 點一下：換成格子座標，跟現在的位置相鄰才走
    const r = box.getBoundingClientRect()
    const sx = r.width / box.offsetWidth
    const cx = Math.floor((e.clientX - r.left) / (cell * sx))
    const cy = Math.floor((e.clientY - r.top) / (cell * sx))
    const ddx = cx - pos[0]; const ddy = cy - pos[1]
    if (Math.abs(ddx) + Math.abs(ddy) === 1) go(ddx === 1 ? 'e' : ddx === -1 ? 'w' : ddy === 1 ? 's' : 'n')
  })
  function onKey (e) {
    const d = { ArrowUp: 'n', ArrowDown: 's', ArrowLeft: 'w', ArrowRight: 'e' }[e.key]
    if (d) { e.preventDefault(); go(d) }
  }
  window.addEventListener('keydown', onKey)

  return {
    start (lv) {
      level = lv
      pos = [...lv.start]
      left = lv.items.map(p => [...p])
      locked = true
      draw()
    },
    unlock () { locked = false },
    lock () { locked = true },
    onMove (fn) { moveFn = fn },
    onBump (fn) { bumpFn = fn },
    onDone (fn) { doneFn = fn },
    layout () { if (level) draw() },
    destroy () { window.removeEventListener('keydown', onKey); root.innerHTML = ''; moveFn = bumpFn = doneFn = null },
  }
}

// ---- 圖形類比：左邊 A → B、C → ?，右邊三個選項 ----
// 變化的畫法：small 變小、flip 左右顛倒、turn 轉 90 度、color 換顏色、two 變兩個
function analogyItem (it) {
  const style = { small: 'transform:scale(.6)', flip: 'transform:scaleX(-1)', turn: 'transform:rotate(90deg)', color: 'filter:hue-rotate(150deg) saturate(1.4)' }[it.t] || ''
  const img = `<img class="brain-img" src="img/emoji/${twemojiName(it.icon)}.svg" alt="" draggable="false" style="${style}">`
  return it.t === 'two' ? `<span class="an-two">${img}${img}</span>` : img
}
const AN_ARROW = '<svg viewBox="0 0 40 24" width="56" height="34"><path d="M2 12h30M24 4l10 8-10 8" fill="none" stroke="#B08A63" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
export function createAnalogy (root, { color = 0 } = {}) {
  const dog = brainShell(root, color, 'analogy-frame', '<div class="an-grid"></div><div class="an-opts"></div>')
  const gridEl = root.querySelector('.an-grid')
  const optsEl = root.querySelector('.an-opts')
  let handler = null
  let locked = true
  let q = null
  optsEl.addEventListener('pointerdown', e => {
    const c = e.target.closest('.an-opt')
    if (!c || locked || !handler || c.classList.contains('right')) return
    handler(Number(c.dataset.i), c)
  })
  const optOf = i => optsEl.querySelector(`.an-opt[data-i="${i}"]`)
  return {
    start (question) {
      q = question
      locked = true
      gridEl.innerHTML = `<div class="an-cell">${analogyItem(q.a)}</div>${AN_ARROW}<div class="an-cell">${analogyItem(q.b)}</div>` +
        `<div class="an-cell">${analogyItem(q.c)}</div>${AN_ARROW}<div class="an-cell an-q">?</div>`
      optsEl.innerHTML = q.options.map((o, i) => `<button class="an-opt" data-i="${i}">${analogyItem(o)}</button>`).join('')
    },
    unlock () { locked = false },
    lock () { locked = true },
    hint () { brainShake(optOf(q.answerIndex)) },
    mark () { const c = optOf(q.answerIndex); if (c) c.classList.add('answer-glow') },
    shake (i) { brainShake(optOf(i)) },
    celebrate (i) {
      const c = optOf(i)
      if (c) { c.classList.remove('answer-glow'); c.classList.add('right') }
      const qc = gridEl.querySelector('.an-q')
      if (qc) { qc.classList.remove('an-q'); qc.innerHTML = analogyItem(q.options[q.answerIndex]) }
      dog.jump()
      return new Promise(resolve => setTimeout(resolve, 800))
    },
    sad () { dog.tilt() },
    onAnswer (fn) { handler = fn },
    layout () {},
    destroy () { root.innerHTML = ''; handler = null },
  }
}

// ---- 拼板補洞：左邊是完整的圖，右邊缺一塊，選轉對方向的三角板 ----
const triTile = o => `<svg class="tri" viewBox="0 0 100 100" style="transform:rotate(${o * 90}deg)"><rect width="100" height="100" fill="#FFFDF7"/><path d="M0 100 L100 100 L100 0 Z" fill="#5AB4E5"/></svg>`
export function createTiles (root, { color = 0 } = {}) {
  const dog = brainShell(root, color, 'tiles-frame', '<div class="tl-board" data-b="model"></div><div class="tl-board" data-b="goal"></div><div class="tl-opts"></div>')
  const model = root.querySelector('[data-b="model"]')
  const goal = root.querySelector('[data-b="goal"]')
  const optsEl = root.querySelector('.tl-opts')
  let handler = null
  let locked = true
  let q = null
  optsEl.addEventListener('pointerdown', e => {
    const c = e.target.closest('.tl-opt')
    if (!c || locked || !handler || c.classList.contains('right')) return
    handler(Number(c.dataset.i), c)
  })
  const optOf = i => optsEl.querySelector(`.tl-opt[data-i="${i}"]`)
  return {
    start (question) {
      q = question
      locked = true
      for (const b of [model, goal]) { b.style.setProperty('--n', q.n); b.classList.remove('glow') }
      model.innerHTML = q.board.map(o => `<span class="tl-cell">${triTile(o)}</span>`).join('')
      goal.innerHTML = q.board.map((o, i) => `<span class="tl-cell ${i === q.hole ? 'tl-hole' : ''}">${i === q.hole ? '' : triTile(o)}</span>`).join('')
      optsEl.innerHTML = q.options.map((o, i) => `<button class="tl-opt" data-i="${i}">${triTile(o)}</button>`).join('')
    },
    unlock () { locked = false },
    lock () { locked = true },
    hint () { brainShake(optOf(q.answerIndex)) },
    mark () { const c = optOf(q.answerIndex); if (c) c.classList.add('answer-glow') },
    shake (i) { brainShake(optOf(i)) },
    celebrate (i) {
      const c = optOf(i)
      if (c) { c.classList.remove('answer-glow'); c.classList.add('right') }
      const h = goal.querySelector('.tl-hole')
      if (h) { h.classList.remove('tl-hole'); h.innerHTML = triTile(q.board[q.hole]) }
      goal.classList.add('glow')
      dog.jump()
      return new Promise(resolve => setTimeout(resolve, 800))
    },
    sad () { dog.tilt() },
    onAnswer (fn) { handler = fn },
    layout () {},
    destroy () { root.innerHTML = ''; handler = null },
  }
}
