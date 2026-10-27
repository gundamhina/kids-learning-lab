// 連連看。左邊 4 個詞的注音，右邊 4 張圖打亂，從詞拉線到圖。對了線留著，錯了線消失。
// 介面：start(words)、onPair(fn(word, pickedWord))、onPicTap(fn(word))、markCorrect(word, pickedWord)、markWrong(word, pickedWord)、onDone(fn)、layout、destroy。
// 沒選詞的時候點圖，會呼叫 onPicTap（主流程拿去唸這個詞）。

import { dogSvg, bgHtml, symbolMarkup, wordPicMarkup } from './art.js'
import { STAGE, mountBgs, framePoint } from './ui.js'

// 版面：詞卡右緣（線的起點）、圖卡左緣（線的終點）、四列的中心 y
function geom () {
  if (!STAGE.portrait) return { left: 330, right: 740, rows: [120, 290, 460, 630], w: 1200, h: 800 }
  const H = STAGE.h
  const step = Math.min(300, (H - 430) / 3) // 列距最多 300，太高的螢幕就把四列擠在中間
  const mid = (260 + H - 170) / 2
  return { left: 330, right: 600, rows: [0, 1, 2, 3].map(i => Math.round(mid + (i - 1.5) * step)), w: 800, h: H }
}

function shuffleWords (arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function createMatchLine (root, { color = 0 } = {}) {
  root.innerHTML = bgHtml('room') + '<div class="frame">' +
    '<div class="dog-wrap match-dog">' + dogSvg(color) + '</div>' +
    '<svg class="lines" xmlns="http://www.w3.org/2000/svg"><g class="done"></g><line class="live" x1="0" y1="0" x2="0" y2="0"/></svg>' +
    '<div class="match-words"></div><div class="match-pics"></div></div>'
  mountBgs(root)
  const frame = root.querySelector('.frame')
  const dogWrap = root.querySelector('.match-dog')
  const wordsEl = root.querySelector('.match-words')
  const picsEl = root.querySelector('.match-pics')
  const linesSvg = root.querySelector('.lines')
  const doneG = root.querySelector('.lines .done')
  const live = root.querySelector('.lines .live')
  let pairFn = null
  let doneFn = null
  let picTapFn = null
  let remaining = 0
  let drag = null // { word, x0, y0 }
  let selected = null // 點一下詞再點一下圖也可以
  let drawn = [] // 已畫好的線 { word, picked, cls }，換版面時重畫

  function anchorOfWord (word) {
    const g = geom()
    const i = [...wordsEl.children].findIndex(c => c.dataset.symbol === word)
    return [g.left, g.rows[i]]
  }
  function anchorOfPic (word) {
    const g = geom()
    const i = [...picsEl.children].findIndex(c => c.dataset.symbol === word)
    return [g.right, g.rows[i]]
  }

  wordsEl.addEventListener('pointerdown', e => {
    const card = e.target.closest('.mword')
    if (!card || card.classList.contains('matched')) return
    wordsEl.querySelectorAll('.mword').forEach(c => c.classList.remove('picked'))
    card.classList.add('picked')
    selected = card.dataset.symbol
    const [x0, y0] = anchorOfWord(selected)
    drag = { word: selected, x0, y0 }
    live.setAttribute('x1', x0); live.setAttribute('y1', y0)
    live.setAttribute('x2', x0); live.setAttribute('y2', y0)
    live.classList.add('show')
    try { card.setPointerCapture(e.pointerId) } catch (err) { /* 不給鎖也能拉 */ }
  })
  root.addEventListener('pointermove', e => {
    if (!drag) return
    const [x, y] = framePoint(e, frame)
    live.setAttribute('x2', x); live.setAttribute('y2', y)
  })
  function endDrag (e) {
    if (!drag) return
    const el = document.elementFromPoint(e.clientX, e.clientY)
    const pic = el && el.closest('.mpic')
    live.classList.remove('show')
    const word = drag.word
    drag = null
    if (pic && !pic.classList.contains('matched') && pairFn) {
      selected = null
      wordsEl.querySelectorAll('.mword').forEach(c => c.classList.remove('picked'))
      pairFn(word, pic.dataset.symbol)
    }
    // 沒拉到圖：保留選取，讓她點圖也行
  }
  root.addEventListener('pointerup', endDrag)
  root.addEventListener('pointercancel', endDrag)
  picsEl.addEventListener('pointerdown', e => {
    const pic = e.target.closest('.mpic')
    if (!pic || drag) return
    if (!selected) { if (picTapFn) picTapFn(pic.dataset.symbol); return }
    if (pic.classList.contains('matched') || !pairFn) return
    const word = selected
    selected = null
    wordsEl.querySelectorAll('.mword').forEach(c => c.classList.remove('picked'))
    pairFn(word, pic.dataset.symbol)
  })

  function start (words) {
    remaining = words.length
    selected = null
    drag = null
    drawn = []
    doneG.innerHTML = ''
    wordsEl.innerHTML = words.map(w => `
      <div class="mword" data-symbol="${w}"><span>${symbolMarkup(w)}</span></div>`).join('')
    picsEl.innerHTML = shuffleWords(words).map(w => `
      <div class="mpic" data-symbol="${w}">${wordPicMarkup(w)}</div>`).join('')
    layout()
  }

  // 依目前版面放卡片、設線的畫布大小，並把畫過的線重畫
  function layout () {
    const g = geom()
    linesSvg.setAttribute('viewBox', `0 0 ${g.w} ${g.h}`)
    linesSvg.setAttribute('width', g.w)
    linesSvg.setAttribute('height', g.h)
    ;[...wordsEl.children].forEach((c, i) => { c.style.top = (g.rows[i] - 80) + 'px' })
    ;[...picsEl.children].forEach((c, i) => { c.style.top = (g.rows[i] - 80) + 'px' })
    doneG.innerHTML = ''
    for (const d of drawn) drawLine(d.word, d.picked, d.cls)
  }

  function drawLine (word, pickedWord, cls) {
    const [x1, y1] = anchorOfWord(word)
    const [x2, y2] = anchorOfPic(pickedWord)
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2)
    l.setAttribute('class', cls)
    doneG.appendChild(l)
    return l
  }
  function markCorrect (word, pickedWord) {
    drawn.push({ word, picked: pickedWord, cls: 'ok' })
    drawLine(word, pickedWord, 'ok')
    const w = wordsEl.querySelector(`.mword[data-symbol="${word}"]`)
    const p = picsEl.querySelector(`.mpic[data-symbol="${pickedWord}"]`)
    if (w) w.classList.add('matched')
    if (p) { p.classList.add('matched'); p.classList.remove('answer-glow') }
    dogWrap.classList.remove('jump')
    void dogWrap.offsetWidth
    dogWrap.classList.add('jump')
    remaining--
    if (remaining === 0 && doneFn) setTimeout(doneFn, 900)
  }
  // 同一個詞連錯兩次以上：它的圖一直發亮
  function markAnswer (word) {
    const p = picsEl.querySelector(`.mpic[data-symbol="${word}"]`)
    if (p) p.classList.add('answer-glow')
  }
  function markWrong (word, pickedWord) {
    const l = drawLine(word, pickedWord, 'bad')
    setTimeout(() => l.remove(), 700)
    const p = picsEl.querySelector(`.mpic[data-symbol="${pickedWord}"]`)
    if (p) { p.classList.remove('shake'); void p.offsetWidth; p.classList.add('shake') }
    dogWrap.classList.remove('tilt')
    void dogWrap.offsetWidth
    dogWrap.classList.add('tilt')
  }

  return {
    start,
    onPair (fn) { pairFn = fn },
    onDone (fn) { doneFn = fn },
    onPicTap (fn) { picTapFn = fn },
    markCorrect,
    markWrong,
    markAnswer,
    layout,
    destroy () { root.innerHTML = ''; pairFn = doneFn = picTapFn = null },
  }
}
