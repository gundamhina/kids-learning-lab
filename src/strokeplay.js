// 照筆順一筆一筆畫出注音符號。資料是教育部筆順學習網的（strokes.js）。
// 做法跟網站一樣：每一筆沿著書寫軌跡畫一條很粗的線，再用這一筆的外框裁切，線慢慢長出來就像在寫。
// strokeSvg(symbol, opts) 回 { svg, duration }：svg 是字串，塞進去動畫就開始；duration 是整個寫完要幾毫秒。

import { STROKES } from './strokes.js'
import { LATIN_STROKES } from './latinstrokes.js'

// 注音（教育部，有外框 d）加上數字、英文字母（自己畫的中心線，沒有外框）
const ALL_STROKES = { ...STROKES, ...LATIN_STROKES }
// 一筆的樣子：有外框就填外框；只有中心線（數字、字母）就用圓頭粗線畫
const trackPath = s => 'M' + s.track.map(p => p[0] + ' ' + p[1]).join(' L')
function strokeShape (s, color, cls = '') {
  const c = cls ? ` class="${cls}"` : ''
  if (s.d) return `<path${c} d="${s.d}" fill="${color}"/>`
  return `<path${c} d="${trackPath(s)}" fill="none" stroke="${color}" stroke-width="${s.track[0][2]}" stroke-linecap="round" stroke-linejoin="round"/>`
}

let uid = 0

function trackLength (track) {
  let len = 0
  for (let i = 1; i < track.length; i++) len += Math.hypot(track[i][0] - track[i - 1][0], track[i][1] - track[i - 1][1])
  return len
}

// 每一筆寫多久：短的也至少 0.35 秒，長的照長度加
export function strokeTimes (symbol, { speed = 1 } = {}) {
  const strokes = ALL_STROKES[symbol] || []
  const GAP = 180
  let at = 0
  return strokes.map(s => {
    const dur = (350 + trackLength(s.track) / 2048 * 900) / speed
    const t = { delay: at, dur }
    at += dur + GAP / speed
    return t
  })
}

// opts：
//   color   寫出來的顏色
//   ghost   底下先放一層淡淡的整個字（null 不放）
//   animate false 就直接畫好（不動）
//   speed   動畫快慢，1 是正常
//   upto    只畫前幾筆（教學一筆一筆來時用）；其他筆只有淡影
//   wait    動畫晚幾毫秒才開始（結合韻兩個符號接著寫時，第二個要等第一個寫完）
export function strokeSvg (symbol, { color = '#E0955B', ghost = 'rgba(43,58,74,0.12)', animate = true, speed = 1, upto = null, wait = 0 } = {}) {
  const strokes = ALL_STROKES[symbol]
  if (!strokes) return { svg: '', duration: 0 }
  const id = 'stk' + (++uid)
  const times = strokeTimes(symbol, { speed })
  const n = upto == null ? strokes.length : upto
  const defs = strokes.map((s, i) => s.d ? `<clipPath id="${id}-${i}"><path d="${s.d}"/></clipPath>` : '').join('')
  const ghostSvg = ghost ? strokes.map(s => strokeShape(s, ghost)).join('') : ''
  const ink = strokes.slice(0, n).map((s, i) => {
    if (!animate) return strokeShape(s, color)
    // 有外框：粗線沿軌跡長出來、用外框裁切；只有中心線：直接用筆寬的線長出來
    const width = s.d ? Math.max(...s.track.map(p => p[2])) * 1.6 : s.track[0][2]
    const clip = s.d ? ` clip-path="url(#${id}-${i})"` : ''
    const { delay, dur } = times[i]
    return `<path d="${trackPath(s)}"${clip} fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1 2" stroke-dashoffset="1" style="animation: strokeDraw ${Math.round(dur)}ms linear ${Math.round(delay + wait)}ms forwards"/>`
  }).join('')
  const last = times[n - 1]
  const duration = animate && last ? wait + last.delay + last.dur : 0
  return {
    svg: `<svg class="stroke-svg" viewBox="0 0 2048 2048" xmlns="http://www.w3.org/2000/svg"><defs>${defs}</defs>${ghostSvg}${ink}</svg>`,
    duration,
  }
}

// 這一筆錯在哪（參考童樂簿的分法）：'direction' 形狀對但從另一頭寫過來；'order' 寫成了這個字的別一筆；
// 'shape' 都不像。寫對回 null
export function strokeFault (symbol, k, points) {
  if (checkStroke(symbol, k, points)) return null
  if (points.length >= 2 && checkStroke(symbol, k, [...points].reverse())) return 'direction'
  const n = (ALL_STROKES[symbol] || []).length
  for (let j = 0; j < n; j++) if (j !== k && checkStroke(symbol, j, points)) return 'order'
  return 'shape'
}

export function strokeCount (symbol) { return (ALL_STROKES[symbol] || []).length }

// 教寫字用的一層：done 前幾筆已經寫好（實心綠）、current 正在教的那一筆（淡橘，起筆處一個會跳的圓點和方向箭頭），
// 其他筆只有淡影。animateCurrent 為 true 時把 current 這一筆示範寫一次。回 { svg, duration }
export function lessonSvg (symbol, { done = 0, current = null, animateCurrent = false, speed = 0.8 } = {}) {
  const strokes = ALL_STROKES[symbol]
  if (!strokes) return { svg: '', duration: 0 }
  const id = 'lsn' + (++uid)
  const parts = strokes.map((s, i) => {
    if (i < done) return strokeShape(s, '#6B9E6B')
    if (i === current) return strokeShape(s, 'rgba(224,149,91,0.28)', 'lesson-current')
    return strokeShape(s, 'rgba(43,58,74,0.10)')
  })
  let extra = ''
  let duration = 0
  if (current != null && strokes[current]) {
    const s = strokes[current]
    const [x0, y0] = s.track[0]
    const [x1, y1] = s.track[1] || [x0 + 1, y0]
    const ang = Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI
    // 方向箭頭放在起點往前一點的地方
    const k = Math.min(1, 260 / (Math.hypot(x1 - x0, y1 - y0) || 1))
    const ax = x0 + (x1 - x0) * k
    const ay = y0 + (y1 - y0) * k
    extra += `<g transform="translate(${ax} ${ay}) rotate(${ang})"><path d="M-40 -60 L50 0 L-40 60 Z" fill="#E0955B"/></g>`
    extra += `<circle class="lesson-dot" cx="${x0}" cy="${y0}" r="95" fill="#E0955B" stroke="#FFFDF7" stroke-width="22"/>`
    if (animateCurrent) {
      const dur = (350 + trackLength(s.track) / 2048 * 900) / speed
      const width = s.d ? Math.max(...s.track.map(p => p[2])) * 1.6 : s.track[0][2]
      const pts = s.track.map(p => p[0] + ' ' + p[1]).join(' L')
      const clip = s.d ? ` clip-path="url(#${id}-c)"` : ''
      extra = (s.d ? `<clipPath id="${id}-c"><path d="${s.d}"/></clipPath>` : '') +
        `<path d="M${pts}"${clip} fill="none" stroke="#E0955B" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1 2" stroke-dashoffset="1" style="animation: strokeDraw ${Math.round(dur)}ms linear 200ms forwards"/>` + extra
      duration = dur + 200
    }
  }
  return { svg: `<svg class="stroke-svg" viewBox="0 0 2048 2048" xmlns="http://www.w3.org/2000/svg">${parts.join('')}${extra}</svg>`, duration }
}

// 判斷她寫的一筆（2048 座標的點）是不是照著第 k 筆寫：起筆夠近、收筆夠近、沿路大部分都有經過、沒有畫到很遠的地方。
// 容許範圍抓得鬆，小孩的手指很粗；方向靠起點和終點分辨。
export function checkStroke (symbol, k, points) {
  const s = (ALL_STROKES[symbol] || [])[k]
  if (!s || !points.length) return false
  const track = s.track.map(p => [p[0], p[1]])
  // 很短的一筆（點）：點一下或短短一畫，落在這一筆附近就算
  if (trackLength(s.track) < 300) {
    const cx = track.reduce((a, p) => a + p[0], 0) / track.length
    const cy = track.reduce((a, p) => a + p[1], 0) / track.length
    return points.every(p => Math.hypot(p[0] - cx, p[1] - cy) < 420)
  }
  if (points.length < 2) return false
  const sample = []
  for (let i = 1; i < track.length; i++) {
    const [ax, ay] = track[i - 1]
    const [bx, by] = track[i]
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 60))
    for (let j = 0; j < n; j++) sample.push([ax + (bx - ax) * j / n, ay + (by - ay) * j / n])
  }
  sample.push(track[track.length - 1])
  const near = (p, list) => Math.min(...list.map(q => Math.hypot(p[0] - q[0], p[1] - q[1])))
  const start = Math.hypot(points[0][0] - track[0][0], points[0][1] - track[0][1])
  const last = points[points.length - 1]
  const end = Math.hypot(last[0] - track[track.length - 1][0], last[1] - track[track.length - 1][1])
  const covered = sample.filter(p => near(p, points) < 330).length / sample.length
  const stray = points.filter(p => near(p, sample) > 420).length / points.length
  return start < 400 && end < 450 && covered >= 0.65 && stray <= 0.3
}
