// 經典找不同：左右（直的時候上下）兩張場景，點到不一樣的地方，兩張都圈起來。全部找到就過關。
// 介面：start(scene)、onFound(fn(k, left))、onMiss(fn())、onDone(fn())、mark()（標出一個還沒找到的）、destroy

import { dogSvg, bgHtml, twemojiName } from './art.js'
import { mountBgs } from './ui.js'

const SPOT_W = 600
const SPOT_H = 420
function spotSceneHtml (objs) {
  return `<svg class="spot-bg" viewBox="0 0 ${SPOT_W} ${SPOT_H}" preserveAspectRatio="none"><rect width="600" height="420" fill="#D8ECF4"/><path d="M0 270 q150 -40 300 0 t300 0 V420 H0z" fill="#B9DA9C"/></svg>` +
    objs.filter(o => !o.gone).map(o => {
      const tf = o.flip ? 'transform:scaleX(-1);' : ''
      const hue = o.hue ? `filter:hue-rotate(${o.hue}deg) saturate(1.4);` : ''
      return `<img class="spot-obj" src="img/emoji/${twemojiName(o.icon)}.svg" alt="" draggable="false" style="left:${(100 * (o.x - o.s / 2) / SPOT_W).toFixed(2)}%;top:${(100 * (o.y - o.s / 2) / SPOT_H).toFixed(2)}%;width:${(100 * o.s / SPOT_W).toFixed(2)}%;${tf}${hue}">`
    }).join('') + '<div class="spot-marks"></div>'
}

export function createSpot (root, { color = 0 } = {}) {
  root.innerHTML = bgHtml('room') + '<div class="frame spot-frame">' +
    `<div class="dog-wrap brain-dog">${dogSvg(color)}</div>` +
    '<div class="spot-pane" data-side="l"></div><div class="spot-pane" data-side="r"></div><div class="spot-dots"></div></div>'
  mountBgs(root)
  const panes = [...root.querySelectorAll('.spot-pane')]
  const dotsEl = root.querySelector('.spot-dots')
  let scene = null
  let found = []
  let locked = true
  let foundFn = null
  let missFn = null
  let doneFn = null

  function circle (d, cls = 'spot-ring') {
    for (const p of panes) {
      const c = document.createElement('div')
      c.className = cls
      c.style.left = (100 * (d.x - d.r) / SPOT_W) + '%'
      c.style.top = (100 * (d.y - d.r) / SPOT_H) + '%'
      c.style.width = (100 * 2 * d.r / SPOT_W) + '%'
      c.style.height = (100 * 2 * d.r / SPOT_H) + '%'
      p.querySelector('.spot-marks').appendChild(c)
    }
  }
  function drawDots () {
    dotsEl.innerHTML = scene.diffs.map((_, k) => `<span class="spot-dot ${found.includes(k) ? 'on' : ''}"></span>`).join('')
  }
  for (const p of panes) {
    p.addEventListener('pointerdown', e => {
      if (locked) return
      const r = p.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width * SPOT_W
      const y = (e.clientY - r.top) / r.height * SPOT_H
      const k = scene.diffs.findIndex((d, i) => !found.includes(i) && Math.hypot(d.x - x, d.y - y) <= d.r)
      if (k < 0) {
        p.classList.remove('shake'); void p.offsetWidth; p.classList.add('shake')
        if (missFn) missFn()
        return
      }
      found.push(k)
      panes.forEach(q => q.querySelectorAll('.spot-hint').forEach(h => h.remove()))
      circle(scene.diffs[k])
      drawDots()
      if (foundFn) foundFn(k, scene.diffs.length - found.length)
      if (found.length === scene.diffs.length) {
        locked = true
        panes.forEach(q => q.classList.add('done'))
        if (doneFn) doneFn()
      }
    })
  }
  return {
    start (sc) {
      scene = sc
      found = []
      panes[0].innerHTML = spotSceneHtml(sc.left)
      panes[1].innerHTML = spotSceneHtml(sc.right)
      panes.forEach(q => q.classList.remove('done'))
      drawDots()
      locked = false
    },
    // 提示：還沒找到的其中一個閃一下
    mark () {
      const k = scene.diffs.findIndex((_, i) => !found.includes(i))
      if (k >= 0) circle(scene.diffs[k], 'spot-hint')
    },
    lock () { locked = true },
    onFound (fn) { foundFn = fn },
    onMiss (fn) { missFn = fn },
    onDone (fn) { doneFn = fn },
    layout () {},
    destroy () { root.innerHTML = ''; foundFn = missFn = doneFn = null },
  }
}
