// 寫給狗狗看。低階級是描寫（板子上有淡淡的範本），高階級是聽寫（空白板子）。
// 判定：描寫看蓋到範本多少；聽寫把筆跡跟這題的候選符號比，最像的當她寫的。
// 介面跟釣魚一樣：start、lock/unlock、hint、shake、celebrate、sad、onAnswer、destroy。

import { dogSvg, bgHtml } from './art.js'
import { stagePoint, stageOffset, mountBgs } from './ui.js'
import { normalizePoints, rasterize, coverage, bestMatch } from './ink.js'
import { SIMILAR_SHAPE } from './data.js'
import { strokeSvg } from './strokeplay.js'
import { STROKES } from './strokes.js'

const PAD = 560 // 板子邊長（舞台座標）
const GRID = 64 // 比對用小圖邊長
const INK_WIDTH = 24
// 聽寫判定：跟正確答案的距離要小於這個才算對；比對時把形似對也放進候選，亂畫不會剛好對
const ACCEPT_DISTANCE = 8
const KNOWN_DISTANCE = 12 // 最像的那個要夠像才算「她寫成別的」，否則算認不出來
const CHECK_SVG = `<svg viewBox="0 0 24 24" width="70" height="70" fill="#fff"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>`
// 「教我寫」：一枝筆加一個播放三角形
const LEARN_BTN_SVG = `<svg viewBox="0 0 24 24" width="52" height="52" fill="#fff"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75z"/><path d="M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75z"/><path d="M14 15v6l5-3z"/></svg>`
// 「不會寫」：一隻眼睛（看答案）
const GIVEUP_SVG = `<svg viewBox="0 0 24 24" width="54" height="54" fill="#fff"><path d="M12 5C6.5 5 2.7 9.2 1.5 12c1.2 2.8 5 7 10.5 7s9.3-4.2 10.5-7C21.3 9.2 17.5 5 12 5zm0 11.5A4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 0 1 0 9z"/><circle cx="12" cy="12" r="2.4"/></svg>`
const UNDO_SVG = `<svg viewBox="0 0 24 24" width="44" height="44" fill="#fff"><path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/></svg>`

const glyphCache = {}
// 把符號畫成比對用的小圖。用教育部筆順的字形（跟板子上給她看的範本同一個），沒有筆順資料才退回字型。同一個符號只算一次。
function glyphBitmap (symbol) {
  if (glyphCache[symbol]) return glyphCache[symbol]
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#000'
  if (STROKES[symbol]) {
    ctx.setTransform(256 / 2048, 0, 0, 256 / 2048, 0, 0)
    for (const s of STROKES[symbol]) ctx.fill(new Path2D(s.d))
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  } else {
    ctx.font = '900 190px "Microsoft JhengHei", "Noto Sans TC", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(symbol, 128, 136)
  }
  const data = ctx.getImageData(0, 0, 256, 256).data
  const pts = []
  for (let y = 0; y < 256; y += 2) {
    for (let x = 0; x < 256; x += 2) {
      if (data[(y * 256 + x) * 4 + 3] > 128) pts.push([x, y])
    }
  }
  const norm = normalizePoints([pts], GRID, 6)
  const bm = rasterize(norm[0].map(p => [p]), GRID, 2.2)
  glyphCache[symbol] = bm
  return bm
}

function inkBitmap (strokes) {
  const norm = normalizePoints(strokes, GRID, 6)
  return rasterize(norm, GRID, 3)
}

export function createWrite (root, { color = 0 } = {}) {
  root.innerHTML = bgHtml('room') + '<div class="frame">' +
    '<div class="dog-wrap write-dog">' + dogSvg(color) + '</div>' +
    `<div class="pad-wrap">
       <div class="pad-tpl hidden"></div>
       <div class="pad-strokes"></div>
       <canvas class="pad" width="${PAD}" height="${PAD}"></canvas>
       <button class="pad-undo" aria-label="重寫">${UNDO_SVG}</button>
       <button class="pad-ok" aria-label="好了">${CHECK_SVG}</button>
       <button class="pad-learn hidden" aria-label="教我寫">${LEARN_BTN_SVG}</button>
       <button class="pad-giveup" aria-label="不會寫">${GIVEUP_SVG}</button>
     </div></div>`
  mountBgs(root)
  const dogWrap = root.querySelector('.write-dog')
  const padWrap = root.querySelector('.pad-wrap')
  const canvas = root.querySelector('.pad')
  const ctx = canvas.getContext('2d')
  const tplEl = root.querySelector('.pad-tpl') // 描寫的淡色範本（教育部字形）
  const strokesEl = root.querySelector('.pad-strokes')
  const learnBtn = root.querySelector('.pad-learn')
  let learnFn = null
  learnBtn.addEventListener('pointerdown', e => { e.stopPropagation(); if (learnFn) learnFn() })
  let handler = null
  let locked = true
  let current = null
  let trace = false
  let strokes = []
  let drawing = null

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = INK_WIDTH
  ctx.strokeStyle = '#2B3A4A'

  // 用舞台座標算，手機直拿舞台轉 90 度時也對
  function canvasPoint (e) {
    const [px, py] = stagePoint(e)
    const [ox, oy] = stageOffset(canvas)
    return [(px - ox) / canvas.offsetWidth * PAD, (py - oy) / canvas.offsetHeight * PAD]
  }
  canvas.addEventListener('pointerdown', e => {
    if (locked) return
    drawing = [canvasPoint(e)]
    strokes.push(drawing)
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
  const endStroke = () => {
    if (!drawing) return
    if (drawing.length === 1) { // 點一下也留個點
      ctx.beginPath(); ctx.arc(drawing[0][0], drawing[0][1], INK_WIDTH / 2, 0, Math.PI * 2); ctx.fillStyle = '#2B3A4A'; ctx.fill()
    }
    drawing = null
  }
  canvas.addEventListener('pointerup', endStroke)
  canvas.addEventListener('pointercancel', endStroke)

  function clearInk () {
    strokes = []
    drawing = null
    ctx.clearRect(0, 0, PAD, PAD)
  }
  root.querySelector('.pad-undo').addEventListener('pointerdown', () => { if (!locked) clearInk() })

  // 「不會寫」：還沒寫也能按。擦掉她寫的，照筆順把答案寫出來，交給 main.js 記成不會（不算寫錯，不晃不歪頭）
  const giveupBtn = root.querySelector('.pad-giveup')
  giveupBtn.addEventListener('pointerdown', e => {
    e.stopPropagation()
    if (locked || !handler) return
    clearInk()
    reveal(false)
    handler('__giveup__', null)
  })

  // 「好了」：把筆跡判成某個符號交給 main.js
  root.querySelector('.pad-ok').addEventListener('pointerdown', () => {
    if (locked || !handler) return
    const inkPts = strokes.flat().length
    if (inkPts < 6) { shakePad(); return }
    const ink = inkBitmap(strokes)
    if (trace) {
      const { covered, stray } = coverage(glyphBitmap(current.target), ink, GRID, 3)
      const ok = covered >= 0.7 && stray <= 0.3
      reveal(ok)
      handler(ok ? current.target : '__miss__', null)
      return
    }
    // 候選：這題的選項，加上目標的形似對
    const cands = new Set(current.options)
    for (const [a, b] of SIMILAR_SHAPE) {
      if (a === current.target) cands.add(b)
      if (b === current.target) cands.add(a)
    }
    const templates = {}
    for (const s of cands) templates[s] = glyphBitmap(s)
    const ranked = bestMatch(ink, templates, GRID)
    const best = ranked[0]
    const targetScore = ranked.find(r => r.symbol === current.target).score
    let verdict
    if (best.symbol === current.target && targetScore < ACCEPT_DISTANCE) verdict = current.target
    else if (best.symbol !== current.target && best.score < KNOWN_DISTANCE) verdict = best.symbol
    else verdict = '__unknown__'
    reveal(verdict === current.target)
    handler(verdict, null)
  })

  // 對答案：把正確符號疊在她寫的字上。對的：整個字淡綠色；錯的：照教育部的筆順一筆一筆用橘色寫出來
  // 範本、答案都用教育部筆順網的字形，板子上只有一種字
  function reveal (ok) {
    tplEl.classList.add('hidden')
    giveupBtn.classList.add('hidden') // 答案已經在板子上了
    strokesEl.innerHTML = ok
      ? strokeSvg(current.target, { animate: false, color: 'rgba(107,158,107,0.7)', ghost: null }).svg
      : strokeSvg(current.target).svg
    strokesEl.classList.add('show')
  }

  function shakePad () {
    padWrap.classList.remove('shake')
    void padWrap.offsetWidth
    padWrap.classList.add('shake')
  }

  // isTrace 由 main.js 依階級決定
  function start (question, { isTrace = false } = {}) {
    current = question
    trace = isTrace
    locked = true
    clearInk()
    // 先把上一題的答案整個拿掉（不淡出），再放這一題的範本，換題時才不會閃到答案
    strokesEl.innerHTML = ''
    strokesEl.classList.remove('show')
    tplEl.classList.remove('flash')
    tplEl.innerHTML = strokeSvg(question.target, { animate: false, color: '#D5DEE8', ghost: null }).svg
    tplEl.classList.toggle('hidden', !trace)
    learnBtn.classList.add('hidden')
    giveupBtn.classList.remove('hidden')
    learnFn = null
    padWrap.classList.remove('shake', 'glow')
  }
  function unlock () { locked = false }
  function lock () { locked = true }
  // 提示：閃一下範本
  function hint () {
    tplEl.classList.remove('hidden')
    tplEl.classList.add('flash')
    setTimeout(() => { tplEl.classList.remove('flash'); if (!trace) tplEl.classList.add('hidden') }, 1500)
  }
  function shake () { shakePad() }
  function celebrate () {
    return new Promise(resolve => {
      padWrap.classList.add('glow')
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
  // 寫錯之後出現「教我寫」按鈕
  function offerLearn (fn) {
    learnFn = fn
    learnBtn.classList.remove('hidden')
  }
  function onAnswer (fn) { handler = fn }
  function destroy () { root.innerHTML = ''; handler = null; learnFn = null }

  return { start, unlock, lock, hint, shake, celebrate, sad, offerLearn, onAnswer, destroy }
}
