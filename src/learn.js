// 學寫字：純練習，不記進度。一個符號先照筆順示範一次，再讓她一筆一筆寫：
// 這一筆淡淡的橘色、起筆處有一個會跳的圓點和方向箭頭；寫對了這一筆變綠色、換下一筆，寫錯了再示範這一筆。
// 筆順資料是教育部的（strokeplay.js）。也可以疊在「寫給狗狗看」上面用（overlay），教完回去原本那一題。
// 介面：teach(symbol) 回 Promise，整個字寫完才 resolve；onReplay 由板子上的按鈕自己處理；celebrate、sad、destroy。

import { dogSvg, bgHtml } from './art.js'
import { stagePoint, stageOffset, mountBgs } from './ui.js'
import { strokeSvg, lessonSvg, strokeFault, strokeCount } from './strokeplay.js'

const LEARN_PAD = 540 // 板子內部邊長（CSS px，跟 .pad 一樣）
const LEARN_GUIDE = 30 // 範本距板子邊的距離，範本是 480×480
const LEARN_INK = 22
const LEARN_REPLAY_SVG = '<svg viewBox="0 0 24 24" width="44" height="44" fill="#fff"><path d="M8 5v14l11-7z"/></svg>'
const LEARN_CLOSE_SVG = '<svg viewBox="0 0 24 24" width="40" height="40" fill="#fff"><path d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"/></svg>'

export function createLearn (root, { color = 0, overlay = false, onClose = null, onFault = null } = {}) {
  root.innerHTML = (overlay ? '<div class="learn-backdrop"></div>' : bgHtml('room')) + '<div class="frame">' +
    (overlay ? `<button class="round-btn learn-close" aria-label="回去">${LEARN_CLOSE_SVG}</button>` : '<div class="dog-wrap write-dog">' + dogSvg(color) + '</div>') +
    `<div class="pad-wrap learn-pad">
       <div class="learn-guide"></div>
       <canvas class="pad" width="${LEARN_PAD}" height="${LEARN_PAD}"></canvas>
       <button class="pad-undo learn-replay" aria-label="再看一次">${LEARN_REPLAY_SVG}</button>
     </div></div>`
  if (!overlay) mountBgs(root)
  const dogWrap = root.querySelector('.write-dog')
  const padWrap = root.querySelector('.learn-pad')
  const guide = root.querySelector('.learn-guide')
  const canvas = root.querySelector('.pad')
  const ctx = canvas.getContext('2d')
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = LEARN_INK
  ctx.strokeStyle = '#2B3A4A'
  if (overlay && onClose) root.querySelector('.learn-close').addEventListener('pointerdown', e => { e.stopPropagation(); onClose() })

  let symbol = null
  let k = 0 // 正在教第幾筆
  let locked = true
  let drawing = null
  let finish = null // teach() 的 resolve
  let timer = null
  let gone = false

  // 板子上的點（CSS px）換成筆順資料的 2048 座標
  function toGlyph ([x, y]) { return [(x - LEARN_GUIDE) / (LEARN_PAD - LEARN_GUIDE * 2) * 2048, (y - LEARN_GUIDE) / (LEARN_PAD - LEARN_GUIDE * 2) * 2048] }
  function canvasPoint (e) {
    const [px, py] = stagePoint(e)
    const [ox, oy] = stageOffset(canvas)
    return [(px - ox) / canvas.offsetWidth * LEARN_PAD, (py - oy) / canvas.offsetHeight * LEARN_PAD]
  }
  function clearInk () { ctx.clearRect(0, 0, LEARN_PAD, LEARN_PAD) }
  function wait (ms) { return new Promise(resolve => { timer = setTimeout(resolve, ms) }) }

  // 示範整個字；示範完換她寫第 k 筆
  async function demo () {
    locked = true
    clearInk()
    const { svg, duration } = strokeSvg(symbol, { speed: 0.8 })
    guide.innerHTML = svg
    await wait(duration + 500)
    if (gone) return
    showStroke(false)
  }
  // 顯示正在教的這一筆；again 為 true 時先示範這一筆
  async function showStroke (again) {
    locked = true
    const { svg, duration } = lessonSvg(symbol, { done: k, current: k, animateCurrent: again })
    guide.innerHTML = svg
    if (again) {
      await wait(duration + 250)
      if (gone) return
      guide.innerHTML = lessonSvg(symbol, { done: k, current: k }).svg
    }
    locked = false
  }

  canvas.addEventListener('pointerdown', e => {
    if (locked) return
    clearInk()
    drawing = [canvasPoint(e)]
    try { canvas.setPointerCapture(e.pointerId) } catch (err) { /* 不給鎖也能畫 */ }
  })
  canvas.addEventListener('pointermove', e => {
    if (!drawing) return
    const p = canvasPoint(e)
    const last = drawing[drawing.length - 1]
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 2) return
    drawing.push(p)
    ctx.beginPath()
    ctx.moveTo(last[0], last[1])
    ctx.lineTo(p[0], p[1])
    ctx.stroke()
  })
  // 放開手指就判這一筆
  const endStroke = async () => {
    if (!drawing) return
    const pts = drawing.map(toGlyph)
    drawing = null
    locked = true
    const fault = strokeFault(symbol, k, pts)
    guide.classList.remove('fault-direction', 'fault-order')
    if (!fault) {
      k++
      clearInk()
      if (k >= strokeCount(symbol)) {
        guide.innerHTML = lessonSvg(symbol, { done: k }).svg
        await celebrate()
        if (gone) return
        const done = finish
        finish = null
        if (done) done()
        return
      }
      showStroke(false)
      return
    }
    // 寫錯：晃一下、狗狗歪頭，說出錯在哪（方向反了：起點圓點跳大一點；寫成別的筆：這一筆亮起來），再示範這一筆
    shakePad()
    sad()
    if (fault !== 'shape') guide.classList.add('fault-' + fault)
    if (onFault) onFault(fault, symbol)
    await wait(450)
    if (gone) return
    clearInk()
    showStroke(true)
  }
  canvas.addEventListener('pointerup', endStroke)
  canvas.addEventListener('pointercancel', endStroke)

  root.querySelector('.learn-replay').addEventListener('pointerdown', () => { if (symbol && !locked) { k = 0; demo() } })

  function shakePad () {
    padWrap.classList.remove('shake')
    void padWrap.offsetWidth
    padWrap.classList.add('shake')
  }
  function celebrate () {
    return new Promise(resolve => {
      padWrap.classList.add('glow')
      if (dogWrap) { dogWrap.classList.remove('jump'); void dogWrap.offsetWidth; dogWrap.classList.add('jump') }
      setTimeout(() => { padWrap.classList.remove('glow'); resolve() }, 800)
    })
  }
  function sad () {
    if (!dogWrap) return
    dogWrap.classList.remove('tilt')
    void dogWrap.offsetWidth
    dogWrap.classList.add('tilt')
  }

  // 教一個符號，整個字寫完才 resolve
  function teach (sym) {
    symbol = sym
    k = 0
    padWrap.dataset.symbol = sym
    return new Promise(resolve => {
      finish = resolve
      demo()
    })
  }
  function destroy () { gone = true; clearTimeout(timer); root.innerHTML = ''; finish = null }

  return { teach, celebrate, sad, destroy, pad: padWrap }
}
