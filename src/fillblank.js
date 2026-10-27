// 填空。左邊一張圖，牌子上詞的注音少一個音節（空格），下面幾塊音節，拖對的進空格（點一下也行）。
// 聲調填空（mode: 'tone'）也用這個畫面：音節都在，只有一個音節的調號是空格，下面幾塊是調號。
// 介面：start(q, { blankIndex, tiles, mode })、lock/unlock、onAnswer(fn(syllable))、onPicTap(fn(word))、fill()、bounce(syllable)、celebrate、sad、layout、destroy。

import { dogSvg, bgHtml, symbolMarkup, wordPicMarkup, wordSyllableMarkup, toneTileMarkup } from './art.js'
import { stripTone } from './scheduler.js'
import { STAGE, mountBgs, stagePoint, framePoint } from './ui.js'

// 橫的：磁磚中心點（1200×800 frame 座標）
const TILE_SLOTS = { 2: [[480, 620], [760, 620]], 3: [[380, 620], [620, 620], [860, 620]], 4: [[300, 620], [500, 620], [700, 620], [900, 620]] }

// 直的：一排貼著下面，平均分
function tileSlots (n) {
  if (!STAGE.portrait) return TILE_SLOTS[n] || TILE_SLOTS[3]
  const step = n >= 4 ? 200 : 240
  const y = 110 + Math.max(0, (STAGE.h - 200 - 880) / 2) + 800
  return Array.from({ length: n }, (_, i) => [Math.round(400 + (i - (n - 1) / 2) * step), y])
}

export function createFillBlank (root, { color = 0 } = {}) {
  root.innerHTML = bgHtml('room') + '<div class="frame">' +
    '<div class="dog-wrap fill-dog">' + dogSvg(color) + '</div>' +
    '<div class="fill-pic"></div>' +
    '<div class="sign fill-sign"><div class="sign-board"><span class="fill-word"></span></div><div class="sign-post"></div></div>' +
    '<div class="tiles"></div></div>'
  mountBgs(root)
  const frame = root.querySelector('.frame')
  const dogWrap = root.querySelector('.fill-dog')
  const picEl = root.querySelector('.fill-pic')
  const signEl = root.querySelector('.fill-sign')
  const wordEl = root.querySelector('.fill-word')
  const tilesEl = root.querySelector('.tiles')
  let handler = null
  let picTapFn = null
  let locked = true
  let current = null
  let blankIndex = 0
  let mode = 'syllable'
  let drag = null

  // 每個音節畫成詞的一欄，跟連連看一樣大；空格那欄：填音節的是虛線框，填聲調的是音節加調號位置的虛線框
  function renderWord (filled = null) {
    const syls = current.target.split(' ')
    const blankCell = s => {
      if (mode === 'tone') return filled ? wordSyllableMarkup(s) : wordSyllableMarkup(stripTone(s), { toneBlank: true })
      return filled ? wordSyllableMarkup(filled) : '<span class="blank"></span>'
    }
    wordEl.innerHTML = `<span class="word w${syls.length}">${syls.map((s, i) => i === blankIndex ? blankCell(s) : wordSyllableMarkup(s)).join('')}</span>`
  }

  picEl.addEventListener('pointerdown', () => { if (current && picTapFn) picTapFn(current.target) })

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
    // 放到空格上（或沒拖動、點一下）都算選這塊
    const blank = wordEl.querySelector('.blank, .blank-tone')
    let hit = !moved
    if (moved && blank) {
      // 空格中心換成舞台座標，放手的點離它夠近就算放進去
      const b = blank.getBoundingClientRect()
      const [bx, by] = stagePoint({ clientX: (b.left + b.right) / 2, clientY: (b.top + b.bottom) / 2 })
      const [px, py] = stagePoint(e)
      hit = Math.abs(px - bx) < 130 && Math.abs(py - by) < 160
    }
    if (hit && handler) { handler(t.dataset.syllable, t); return }
    t.classList.add('returning')
    t.style.left = ox + 'px'
    t.style.top = oy + 'px'
    setTimeout(() => t.classList.remove('returning'), 350)
  }
  tilesEl.addEventListener('pointerup', endDrag)
  tilesEl.addEventListener('pointercancel', endDrag)

  // 直的：圖、牌子、磁磚整組在畫面裡置中；橫的位置交給 CSS
  function placeTiles () {
    if (STAGE.portrait) {
      const groupTop = 110 + Math.max(0, (STAGE.h - 200 - 880) / 2)
      picEl.style.top = groupTop + 'px'
      signEl.style.top = (groupTop + 280) + 'px'
    } else {
      picEl.style.top = ''
      signEl.style.top = ''
    }
    const tiles = [...tilesEl.children]
    const slots = tileSlots(tiles.length)
    tiles.forEach((t, i) => {
      if (t.classList.contains('dragging') || t.classList.contains('gone')) return
      t.style.left = (slots[i][0] - 80) + 'px'
      t.style.top = (slots[i][1] - 80) + 'px'
    })
  }

  function start (question, { blankIndex: bi, tiles, mode: m = 'syllable' }) {
    current = question
    blankIndex = bi
    mode = m
    locked = true
    picEl.className = 'fill-pic'
    picEl.innerHTML = wordPicMarkup(question.target)
    signEl.classList.remove('glow')
    renderWord()
    tilesEl.innerHTML = ''
    tiles.forEach(syl => {
      const t = document.createElement('div')
      t.className = 'tile'
      t.dataset.syllable = syl
      t.innerHTML = `<span>${mode === 'tone' ? toneTileMarkup(syl) : symbolMarkup(syl)}</span>`
      tilesEl.appendChild(t)
    })
    placeTiles()
  }
  function tileOf (syl) { return tilesEl.querySelector(`.tile[data-syllable="${syl}"]`) }
  function unlock () { locked = false }
  function lock () { locked = true }
  // 對了：音節（或調號）填進空格，那塊磁磚消失
  function fill (syl) {
    renderWord(syl)
    const t = tileOf(syl)
    if (t) t.classList.add('gone')
  }
  // 答錯第二次起：正確那塊一直發亮
  function mark (syl) {
    const t = tileOf(syl)
    if (t) t.classList.add('answer-glow')
  }
  // 錯了：彈回原位晃一下
  function bounce (syl) {
    const t = tileOf(syl)
    if (!t) return
    const i = [...tilesEl.children].indexOf(t)
    const slots = tileSlots(tilesEl.children.length)
    t.classList.add('returning')
    t.style.left = (slots[i][0] - 80) + 'px'
    t.style.top = (slots[i][1] - 80) + 'px'
    setTimeout(() => { t.classList.remove('returning', 'shake'); void t.offsetWidth; t.classList.add('shake') }, 300)
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
  function onPicTap (fn) { picTapFn = fn }
  function layout () { placeTiles() }
  function destroy () { root.innerHTML = ''; handler = picTapFn = null }

  return { start, unlock, lock, fill, mark, bounce, celebrate, sad, onAnswer, onPicTap, layout, destroy }
}
