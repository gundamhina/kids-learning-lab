// 拼拼看。聽一個音（結合韻或拼讀字），牌子上有一格一格的空格（幾個符號就幾格，由上往下），
// 下面幾塊符號磁磚，照順序一塊一塊拖進去（點一下也行），拼出這個音。拼完牌子換成完整的音節（含調號）。
// 介面：start(q, { pieces, tiles })、lock/unlock、onAnswer(fn(symbol))、fill(symbol)、complete()、bounce(symbol)、hint()、
//       celebrate、sad、layout、destroy。對錯由呼叫的人判斷：下一個空格應該放 pieces[filled]。

import { dogSvg, bgHtml, symbolMarkup } from './art.js'
import { STAGE, mountBgs, stagePoint, framePoint } from './ui.js'

const SPELL_TILE = 160
// 磁磚中心點：橫的放在牌子右邊，三塊以內一排、四塊兩排兩塊、五六塊兩排三塊；直的放在牌子下面，一樣的排法
function spellTileSlots (n, top) {
  const cols = n <= 3 ? n : n === 4 ? 2 : 3
  const rows = Math.ceil(n / cols)
  const cx = STAGE.portrait ? 400 : 860
  const cy = STAGE.portrait ? top + (rows - 1) * 95 : 390
  const step = STAGE.portrait ? 200 : 190
  return Array.from({ length: n }, (_, i) => {
    const r = Math.floor(i / cols)
    const m = Math.min(cols, n - r * cols) // 最後一排可能比較少，置中
    const c = i - r * cols
    return [Math.round(cx + (c - (m - 1) / 2) * step), Math.round(cy + (r - (rows - 1) / 2) * 190)]
  })
}

// glyph：磁磚和格子裡怎麼畫（預設注音）；whole：拼完整個怎麼畫；picHtml：有的話牌子旁邊放一張圖；
// horizontal：格子橫排（英文拼單字）
// 橫排（英文拼單字）：牌子固定在上面，磁磚排在下面；直的時候四塊一排
function spellTileSlotsH (n) {
  const cols = Math.min(n, STAGE.portrait ? 4 : 7)
  const rows = Math.ceil(n / cols)
  const cx = STAGE.portrait ? 400 : 600
  const top = STAGE.portrait ? 760 : 520
  return Array.from({ length: n }, (_, i) => {
    const r = Math.floor(i / cols)
    const m = Math.min(cols, n - r * cols)
    return [Math.round(cx + (i - r * cols - (m - 1) / 2) * 175), top + r * 185]
  })
}

export function createSpell (root, { color = 0, glyph = symbolMarkup, whole = symbolMarkup, picHtml = null, horizontal = false } = {}) {
  root.innerHTML = bgHtml('room') + `<div class="frame${horizontal ? ' spell-h' : ''}">` + (picHtml ? '<div class="spell-pic"></div>' : '') +
    '<div class="dog-wrap spell-dog">' + dogSvg(color) + '</div>' +
    '<div class="sign spell-sign"><div class="sign-board"><div class="spell-slots"></div></div><div class="sign-post"></div></div>' +
    '<div class="tiles"></div></div>'
  mountBgs(root)
  const frame = root.querySelector('.frame')
  const dogWrap = root.querySelector('.spell-dog')
  const signEl = root.querySelector('.spell-sign')
  const slotsEl = root.querySelector('.spell-slots')
  const tilesEl = root.querySelector('.tiles')
  let handler = null
  let locked = true
  let current = null
  let pieces = []
  let filled = 0
  let drag = null

  function renderSlots () {
    slotsEl.innerHTML = pieces.map((p, i) => i < filled
      ? `<div class="spell-slot filled"><span>${glyph(p)}</span></div>`
      : `<div class="spell-slot ${i === filled ? 'next' : ''}"></div>`).join('')
  }

  tilesEl.addEventListener('pointerdown', e => {
    const t = e.target.closest('.tile')
    if (!t || locked) return
    const [sx, sy] = framePoint(e, frame)
    drag = { t, startX: sx, startY: sy, ox: parseFloat(t.style.left), oy: parseFloat(t.style.top), moved: false }
    t.classList.add('dragging')
    try { t.setPointerCapture(e.pointerId) } catch (err) { /* 不給鎖也能拖 */ }
  })
  tilesEl.addEventListener('pointermove', e => {
    if (!drag) return
    const [sx, sy] = framePoint(e, frame)
    const dx = sx - drag.startX
    const dy = sy - drag.startY
    if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true
    drag.t.style.left = (drag.ox + dx) + 'px'
    drag.t.style.top = (drag.oy + dy) + 'px'
  })
  function endDrag (e) {
    if (!drag) return
    const { t, ox, oy, moved } = drag
    drag = null
    t.classList.remove('dragging')
    // 點一下，或拖到牌子上放手，都算放進下一格
    let hit = !moved
    if (moved) {
      const b = signEl.querySelector('.sign-board').getBoundingClientRect()
      const [x0, y0] = stagePoint({ clientX: b.left, clientY: b.top })
      const [x1, y1] = stagePoint({ clientX: b.right, clientY: b.bottom })
      const [px, py] = stagePoint(e)
      hit = px > x0 - 60 && px < x1 + 60 && py > y0 - 60 && py < y1 + 60
    }
    if (hit && handler) { handler(t.dataset.symbol); return }
    t.classList.add('returning')
    t.style.left = ox + 'px'
    t.style.top = oy + 'px'
    setTimeout(() => t.classList.remove('returning'), 350)
  }
  tilesEl.addEventListener('pointerup', endDrag)
  tilesEl.addEventListener('pointercancel', endDrag)

  // 直的：牌子和磁磚整組在畫面裡置中；橫的牌子位置交給 CSS
  function tilesTop () {
    if (!STAGE.portrait) return 0
    const rows = tilesEl.children.length > 3 ? 2 : 1
    const groupH = 520 + rows * 190
    const groupTop = 130 + Math.max(0, (STAGE.h - 130 - 110 - groupH) / 2)
    signEl.style.top = groupTop + 'px'
    return groupTop + 520 + SPELL_TILE / 2
  }
  const slotsFor = n => horizontal ? spellTileSlotsH(n) : spellTileSlots(n, tilesTop())
  function slotOf (i) {
    return slotsFor(tilesEl.children.length)[i]
  }
  function placeTiles () {
    // 橫的：牌子依格數長高，中心對齊畫面中間（跟右邊的磁磚同高）
    if (horizontal) signEl.style.top = (STAGE.portrait ? 420 : 90) + 'px'
    else if (!STAGE.portrait) signEl.style.top = Math.round(390 - signEl.querySelector('.sign-board').offsetHeight / 2) + 'px'
    const tiles = [...tilesEl.children]
    const slots = slotsFor(tiles.length)
    tiles.forEach((t, i) => {
      if (t.classList.contains('dragging') || t.classList.contains('gone')) return
      t.style.left = (slots[i][0] - SPELL_TILE / 2) + 'px'
      t.style.top = (slots[i][1] - SPELL_TILE / 2) + 'px'
    })
  }

  function start (question, { pieces: ps, tiles }) {
    current = question
    pieces = ps
    filled = 0
    locked = true
    signEl.classList.remove('glow', 'done')
    const picEl = root.querySelector('.spell-pic')
    if (picEl && picHtml) picEl.innerHTML = picHtml(question.target)
    renderSlots()
    tilesEl.innerHTML = ''
    tiles.forEach(sym => {
      const t = document.createElement('div')
      t.className = 'tile'
      t.dataset.symbol = sym
      t.innerHTML = `<span>${glyph(sym)}</span>`
      tilesEl.appendChild(t)
    })
    placeTiles()
  }
  function tileOf (sym) { return tilesEl.querySelector(`.tile[data-symbol="${sym}"]:not(.gone)`) } // 英文同一個字母可能有兩塊
  function unlock () { locked = false }
  function lock () { locked = true }
  // 對了：這個符號放進下一格，那塊磁磚消失
  function fill (sym) {
    filled++
    renderSlots()
    const t = tileOf(sym)
    if (t) t.classList.add('gone')
  }
  // 全部拼好：空格換成完整的音節（直排、含調號），跟課本一樣
  function complete () {
    slotsEl.innerHTML = `<div class="spell-whole">${whole(current.target)}</div>`
    signEl.classList.add('done')
  }
  // 錯了：彈回原位晃一下
  function bounce (sym) {
    const t = tileOf(sym)
    if (!t) return
    const [cx, cy] = slotOf([...tilesEl.children].indexOf(t))
    t.classList.add('returning')
    t.style.left = (cx - SPELL_TILE / 2) + 'px'
    t.style.top = (cy - SPELL_TILE / 2) + 'px'
    setTimeout(() => { t.classList.remove('returning', 'shake'); void t.offsetWidth; t.classList.add('shake') }, 300)
  }
  // 答錯第二次起：下一塊該放的一直發亮（放進去之後換下一塊亮，由 main.js 再叫一次）
  function mark () {
    tilesEl.querySelectorAll('.answer-glow').forEach(t => t.classList.remove('answer-glow'))
    const t = tileOf(pieces[filled])
    if (t) t.classList.add('answer-glow')
  }
  // 發呆提示：下一塊該放的晃一下
  function hint () {
    const t = tileOf(pieces[filled])
    if (!t) return
    t.classList.remove('shake')
    void t.offsetWidth
    t.classList.add('shake')
  }
  function celebrate () {
    return new Promise(resolve => {
      signEl.classList.add('glow')
      dogWrap.classList.remove('jump')
      void dogWrap.offsetWidth
      dogWrap.classList.add('jump')
      setTimeout(resolve, 700)
    })
  }
  function sad () {
    dogWrap.classList.remove('tilt')
    void dogWrap.offsetWidth
    dogWrap.classList.add('tilt')
  }
  function onAnswer (fn) { handler = fn }
  function layout () { placeTiles() }
  function destroy () { root.innerHTML = ''; handler = null }

  return { start, unlock, lock, fill, complete, bounce, hint, mark, celebrate, sad, onAnswer, layout, destroy }
}
