// 著色：線稿一塊一塊是封閉的區域，選一個顏色，點哪一塊就塗滿哪一塊（不會塗出界，小孩好上手）。
// 介面：start(index)、onDone(fn(ratio))、onPaint(fn())、destroy。純練習：塗好按打勾，塗了一半以上給骨頭

import { dogSvg, bgHtml } from './art.js'
import { mountBgs } from './ui.js'

const LINE = 'stroke="#2B3A4A" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"'
const colorRegion = shape => shape.replace(/^<(\w+)/, `<$1 class="cr" fill="#FFFFFF" ${LINE}`)
// 每張圖：一串 SVG 形狀（後面的蓋在前面上面），viewBox 600×480
export const COLOR_PICTURES = [
  // 房子
  [
    '<rect x="0" y="0" width="600" height="480"/>', '<rect x="0" y="380" width="600" height="100"/>', '<circle cx="510" cy="80" r="50"/>',
    '<rect x="370" y="110" width="40" height="80"/>', '<path d="M120 200 L300 70 L480 200 Z"/>', '<rect x="150" y="200" width="300" height="190"/>',
    '<rect x="260" y="270" width="80" height="120"/>', '<rect x="175" y="230" width="60" height="60"/>', '<rect x="365" y="230" width="60" height="60"/>',
    '<circle cx="80" cy="420" r="26"/>', '<circle cx="530" cy="430" r="22"/>',
  ],
  // 魚
  [
    '<rect x="0" y="0" width="600" height="480"/>', '<path d="M0 400 q150 -30 300 0 t300 0 V480 H0 Z"/>', '<path d="M440 240 L560 150 L560 330 Z"/>',
    '<ellipse cx="290" cy="240" rx="180" ry="120"/>', '<path d="M250 130 q40 -60 100 -10 Z"/>', '<path d="M240 300 q30 60 90 30 Z"/>',
    '<circle cx="200" cy="215" r="28"/>', '<circle cx="200" cy="215" r="10"/>', '<path d="M300 140 q-40 100 0 200"/>',
    '<circle cx="80" cy="120" r="22"/>', '<circle cx="110" cy="60" r="14"/>', '<path d="M60 400 q-20 -60 10 -120 q20 60 -10 120 Z"/>',
  ],
  // 花
  [
    '<rect x="0" y="0" width="600" height="480"/>', '<path d="M210 380 L390 380 L370 470 L230 470 Z"/>', '<rect x="290" y="210" width="20" height="170"/>',
    '<path d="M300 320 q-90 -40 -110 10 q60 30 110 -10 Z"/>', '<path d="M300 290 q90 -40 110 10 q-60 30 -110 -10 Z"/>',
    ...[0, 60, 120, 180, 240, 300].map(a => `<ellipse cx="${300 + 75 * Math.cos(a * Math.PI / 180)}" cy="${150 + 75 * Math.sin(a * Math.PI / 180)}" rx="55" ry="38" transform="rotate(${a} ${300 + 75 * Math.cos(a * Math.PI / 180)} ${150 + 75 * Math.sin(a * Math.PI / 180)})"/>`),
    '<circle cx="300" cy="150" r="48"/>', '<circle cx="90" cy="90" r="40"/>',
  ],
  // 車子
  [
    '<rect x="0" y="0" width="600" height="480"/>', '<rect x="0" y="360" width="600" height="120"/>', '<path d="M60 330 L80 240 L180 240 L240 160 L400 160 L460 240 L540 250 L550 330 Z"/>',
    '<path d="M255 180 L380 180 L420 240 L220 240 Z"/>', '<rect x="315" y="180" width="12" height="60"/>', '<circle cx="170" cy="340" r="52"/>', '<circle cx="170" cy="340" r="22"/>',
    '<circle cx="440" cy="340" r="52"/>', '<circle cx="440" cy="340" r="22"/>', '<rect x="500" y="260" width="40" height="24" rx="8"/>', '<circle cx="90" cy="80" r="40"/>',
  ],
  // 火箭
  [
    '<rect x="0" y="0" width="600" height="480"/>', '<path d="M300 30 Q380 110 380 260 L380 360 L220 360 L220 260 Q220 110 300 30 Z"/>', '<path d="M300 30 Q340 70 356 120 L244 120 Q260 70 300 30 Z"/>',
    '<circle cx="300" cy="210" r="42"/>', '<path d="M220 280 L150 380 L220 360 Z"/>', '<path d="M380 280 L450 380 L380 360 Z"/>',
    '<path d="M250 360 L350 360 L330 440 L300 470 L270 440 Z"/>', '<path d="M275 360 L325 360 L310 420 L300 440 L290 420 Z"/>',
    '<path d="M80 100 l10 24 26 2 -20 16 6 26 -22 -14 -22 14 6 -26 -20 -16 26 -2 Z"/>', '<path d="M500 300 l8 18 20 2 -16 12 5 20 -17 -11 -17 11 5 -20 -16 -12 20 -2 Z"/>',
  ],
  // 救援隊的狗狗頭
  [
    '<rect x="0" y="0" width="600" height="480"/>', '<ellipse cx="170" cy="230" rx="60" ry="110" transform="rotate(20 170 230)"/>', '<ellipse cx="430" cy="230" rx="60" ry="110" transform="rotate(-20 430 230)"/>',
    '<ellipse cx="300" cy="260" rx="150" ry="140"/>', '<ellipse cx="300" cy="320" rx="80" ry="60"/>', '<path d="M170 140 Q300 20 430 140 Z"/>', '<rect x="160" y="130" width="280" height="26" rx="10"/>',
    '<circle cx="300" cy="95" r="22"/>', '<circle cx="250" cy="240" r="18"/>', '<circle cx="350" cy="240" r="18"/>', '<ellipse cx="300" cy="300" rx="28" ry="20"/>',
  ],
].map(list => list.map(colorRegion))

export const PALETTE = ['#E5534B', '#F08C3A', '#F5C542', '#8BC34A', '#3E9E5A', '#5AB4E5', '#3F6FC4', '#9B6BD1', '#F28FB5', '#A0714F', '#5A6470', '#FFFFFF']
const CHECK = '<svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
const UNDO = '<svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>'

export function createColoring (root, { color = 0 } = {}) {
  root.innerHTML = bgHtml('room') + '<div class="frame color-frame">' +
    `<div class="dog-wrap brain-dog">${dogSvg(color)}</div>` +
    '<div class="color-paper"><svg class="color-svg" viewBox="0 0 600 480" xmlns="http://www.w3.org/2000/svg"></svg></div>' +
    `<div class="color-palette">${PALETTE.map((c, i) => `<button class="color-dot ${i === 0 ? 'on' : ''}" data-c="${c}" style="--c:${c}" aria-label="顏色 ${i + 1}"></button>`).join('')}</div>` +
    `<button class="round-btn color-undo" aria-label="上一步">${UNDO}</button>` +
    `<button class="round-btn home color-ok" aria-label="畫好了">${CHECK}</button></div>`
  mountBgs(root)
  const svg = root.querySelector('.color-svg')
  let cur = PALETTE[0]
  let doneFn = null
  let paintFn = null
  let history = []
  let locked = true

  root.querySelector('.color-palette').addEventListener('pointerdown', e => {
    const b = e.target.closest('.color-dot')
    if (!b) return
    cur = b.dataset.c
    root.querySelectorAll('.color-dot').forEach(x => x.classList.toggle('on', x === b))
  })
  svg.addEventListener('pointerdown', e => {
    const r = e.target.closest('.cr')
    if (!r || locked) return
    const before = r.getAttribute('fill')
    if (before === cur) return
    history.push([r, before])
    r.setAttribute('fill', cur)
    if (paintFn) paintFn()
  })
  root.querySelector('.color-undo').addEventListener('pointerdown', () => {
    const last = history.pop()
    if (last) last[0].setAttribute('fill', last[1])
  })
  root.querySelector('.color-ok').addEventListener('pointerdown', () => {
    if (locked || !doneFn) return
    const regions = [...svg.querySelectorAll('.cr')]
    doneFn(regions.filter(r => r.getAttribute('fill') !== '#FFFFFF').length / regions.length)
  })
  return {
    start (i) {
      svg.innerHTML = COLOR_PICTURES[i % COLOR_PICTURES.length].join('')
      history = []
      locked = false
    },
    lock () { locked = true },
    svgEl: svg,
    onDone (fn) { doneFn = fn },
    onPaint (fn) { paintFn = fn },
    layout () {},
    destroy () { root.innerHTML = ''; doneFn = paintFn = null },
  }
}
