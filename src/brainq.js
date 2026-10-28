// 動腦的出題：找規律、選卡片找不同、迷宮。純函式，不碰 DOM；rng 由呼叫的人傳（測試好寫）。

function brainShuffle (arr, rng) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const pickN = (list, n, rng) => brainShuffle(list, rng).slice(0, n)

// 規律和找不同用的圖（都有 Twemoji 圖檔）
export const BRAIN_ICONS = ['🐶', '🐱', '🐰', '🐸', '🐟', '🐢', '🐝', '🦋', '🐞', '🐧', '🍎', '🍌', '🍓', '🍊', '🍒', '🍩', '🍪', '⭐', '🌸', '🌻', '🎈', '🎁', '🚗', '🚀', '⚽']

// ---- 找規律 ----
// b 是不是 a 轉一圈（BA 是 AB 轉一圈，在一排 ABAB 裡也算重複的一段，不能當錯的選項）
function isRotation (a, b) {
  if (a.length !== b.length) return false
  return a.some((_, k) => a.every((x, i) => x === b[(i + k) % b.length]))
}
// 規律的樣子：字母代表第幾種圖。階級越高，樣子越長、越多種
const PATTERN_TYPES = [
  ['AB'], ['AB', 'AAB', 'ABB'], ['AAB', 'ABB', 'ABC'], ['ABC', 'AABB', 'ABB'], ['AABB', 'ABAC', 'ABCC'], ['ABAC', 'ABCC', 'AABC'],
]
// 三種題：補空格（一排裡空一格，選缺的那個）、找重複（選出一直重複的那一段）、換材料（選用別的圖排出同樣規律的那一排）。
// 低階只有補空格；中階加找重複；高階再加換材料（較簡單的題型照樣穿插）
export function patternQuestion (tier, rng) {
  const t = Math.max(0, Math.min(5, tier))
  const type = PATTERN_TYPES[t][Math.floor(rng() * PATTERN_TYPES[t].length)]
  const kinds = [...new Set(type)]
  const icons = pickN(BRAIN_ICONS, kinds.length, rng)
  const iconOf = ch => icons[kinds.indexOf(ch)]
  const unit = [...type].map(iconOf)
  const modes = t <= 1 ? ['fill'] : t <= 3 ? ['fill', 'repeat'] : ['fill', 'repeat', 'translate']
  const mode = modes[Math.floor(rng() * modes.length)]
  // 一排至少重複兩次多一點
  const len = Math.max(6, unit.length * 2 + 2)
  const row = Array.from({ length: len }, (_, i) => unit[i % unit.length])
  if (mode === 'fill') {
    const blank = unit.length + Math.floor(rng() * (len - unit.length)) // 前面至少完整出現一次
    const answer = row[blank]
    const others = pickN(BRAIN_ICONS.filter(x => x !== answer && !icons.includes(x)), 1, rng)
    const pool = [...new Set([answer, ...icons.filter(x => x !== answer), ...others])].slice(0, 3)
    return { mode, type, row, blank, options: brainShuffle(pool.map(x => [x]), rng), answer: [answer] }
  }
  if (mode === 'repeat') {
    // 選項：正確的那一段，加兩段一定不對的：少一個的、最後一個換成別的圖的（都不能剛好是正確那段轉一圈）
    const newIcon = pickN(BRAIN_ICONS.filter(x => !icons.includes(x)), 1, rng)[0]
    const wrong = [unit.slice(0, -1), [...unit.slice(0, -1), newIcon], [newIcon, ...unit.slice(1)]]
    const opts = [unit]
    for (const o of wrong) if (opts.length < 3 && !opts.some(p => p.join() === o.join()) && !isRotation(o, unit)) opts.push(o)
    return { mode, type, row, blank: -1, options: brainShuffle(opts, rng), answer: unit }
  }
  // translate：換一組圖排同樣的樣子；錯的兩排用別的樣子
  const icons2 = pickN(BRAIN_ICONS.filter(x => !icons.includes(x)), Math.max(kinds.length, 3), rng)
  const make = (ty) => {
    const ks = [...new Set(ty)]
    return Array.from({ length: Math.max(4, ty.length + 2) }, (_, i) => icons2[ks.indexOf(ty[i % ty.length])])
  }
  const wrongTypes = ['AB', 'AAB', 'ABB', 'ABC', 'AABB'].filter(x => x !== type)
  const pickedWrong = pickN(wrongTypes, 2, rng)
  const answer = make(type)
  const opts = [answer, ...pickedWrong.map(make)]
  return { mode, type, row: row.slice(0, Math.max(4, type.length + 2)), blank: -1, options: brainShuffle(opts, rng), answer }
}

// ---- 選卡片找不同 ----
// 一排卡片裡只有一張不一樣。階級越高卡片越多、差別越小：換一種圖 → 換顏色 → 左右顛倒 → 轉個方向 → 變小一點
export const ODD_ASYM = ['🐟', '🐢', '🐝', '🚗', '🚀', '🍌', '🍒']
const ODD_KINDS = [['icon'], ['icon', 'color'], ['color', 'flip'], ['flip', 'turn'], ['turn', 'small', 'flip'], ['small', 'flip', 'turn']]
export function oddQuestion (tier, rng) {
  const t = Math.max(0, Math.min(5, tier))
  const n = t <= 1 ? 3 : t <= 3 ? 4 : 6
  const kind = ODD_KINDS[t][Math.floor(rng() * ODD_KINDS[t].length)]
  // 左右顛倒、轉方向只用不對稱的圖（星星、足球翻過來看不出差別）
  const [icon, other] = pickN(kind === 'flip' || kind === 'turn' ? ODD_ASYM : BRAIN_ICONS, 2, rng)
  const odd = Math.floor(rng() * n)
  return { n, odd, icon, kind, other }
}

// ---- 迷宮 ----
// 格子迷宮（深度優先挖路，每格之間不是牆就是通道，一定走得到）。walls[y][x] = { n, e, s, w } true 表示有牆
export function makeMaze (w, h, rng) {
  const walls = Array.from({ length: h }, () => Array.from({ length: w }, () => ({ n: true, e: true, s: true, w: true })))
  const seen = Array.from({ length: h }, () => Array(w).fill(false))
  const stack = [[0, 0]]
  seen[0][0] = true
  const dirs = [['n', 0, -1, 's'], ['e', 1, 0, 'w'], ['s', 0, 1, 'n'], ['w', -1, 0, 'e']]
  while (stack.length) {
    const [x, y] = stack[stack.length - 1]
    const next = brainShuffle(dirs, rng).filter(([, dx, dy]) => {
      const nx = x + dx; const ny = y + dy
      return nx >= 0 && ny >= 0 && nx < w && ny < h && !seen[ny][nx]
    })
    if (!next.length) { stack.pop(); continue }
    const [d, dx, dy, back] = next[0]
    walls[y][x][d] = false
    walls[y + dy][x + dx][back] = false
    seen[y + dy][x + dx] = true
    stack.push([x + dx, y + dy])
  }
  return walls
}
// 從起點走得到的每一格離起點幾步（寬度優先）；用來挑寶物位置、驗證迷宮
export function mazeDistances (walls, sx = 0, sy = 0) {
  const h = walls.length; const w = walls[0].length
  const dist = Array.from({ length: h }, () => Array(w).fill(-1))
  dist[sy][sx] = 0
  const q = [[sx, sy]]
  const step = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] }
  while (q.length) {
    const [x, y] = q.shift()
    for (const [d, [dx, dy]] of Object.entries(step)) {
      if (walls[y][x][d]) continue
      const nx = x + dx; const ny = y + dy
      if (dist[ny][nx] < 0) { dist[ny][nx] = dist[y][x] + 1; q.push([nx, ny]) }
    }
  }
  return dist
}
// 迷宮大小和寶物數照階級：最小 4×3、最大 9×6；中階起要先撿到寶物出口才會開，進階把一個寶物藏在死路裡
export const MAZE_SIZES = [[4, 3], [5, 3], [5, 4], [6, 4], [7, 5], [9, 6]]
export function mazeLevel (tier, rng) {
  const t = Math.max(0, Math.min(5, tier))
  const [w, h] = MAZE_SIZES[t]
  const walls = makeMaze(w, h, rng)
  const dist = mazeDistances(walls)
  const exit = [w - 1, h - 1]
  const treasures = t <= 1 ? 0 : t <= 3 ? 1 : 2
  // 寶物放在離起點比較遠、又不是出口的格子
  const cells = []
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!(x === 0 && y === 0) && !(x === exit[0] && y === exit[1])) cells.push([x, y, dist[y][x]])
  // 死路：只有一個開口的格子
  const deadEnd = ([x, y]) => ['n', 'e', 's', 'w'].filter(d => !walls[y][x][d]).length === 1
  const far = cells.sort((a, b) => b[2] - a[2])
  const items = []
  if (treasures >= 2) { const d = far.find(c => deadEnd(c)); if (d) items.push([d[0], d[1]]) }
  for (const c of far) {
    if (items.length >= treasures) break
    if (!items.some(([x, y]) => x === c[0] && y === c[1])) items.push([c[0], c[1]])
  }
  return { w, h, walls, start: [0, 0], exit, items }
}

// ---- 經典找不同 ----
// 場景 600×420：天空和草地上放 7 樣東西（切格子放，不會疊在一起）。右邊那張改 3～5 個地方：
// 少一個、換成別的、左右顛倒、變大（低到中階），換顏色、變小（高階）
export const SPOT_ICONS = ['🌳', '🌻', '🌸', '🐶', '🐱', '🐰', '🐢', '🐝', '🦋', '🐞', '🍎', '🍓', '🎈', '🚗', '🏠', '⭐', '☀️', '🐟', '🐸', '🍄']
export function spotScene (tier, rng) {
  const t = Math.max(0, Math.min(5, tier))
  const cols = 4; const rows = 3
  const cells = brainShuffle([...Array(cols * rows).keys()], rng).slice(0, 7)
  const icons = pickN(SPOT_ICONS, 7, rng)
  const left = cells.map((c, i) => ({
    icon: icons[i],
    x: Math.round((c % cols + 0.5 + (rng() - 0.5) * 0.3) * 600 / cols),
    y: Math.round((Math.floor(c / cols) + 0.5 + (rng() - 0.5) * 0.25) * 420 / rows),
    s: Math.round(70 + rng() * 30),
    flip: false,
    hue: 0,
  }))
  const n = t <= 1 ? 3 : t <= 3 ? 4 : 5
  const kinds = t <= 1 ? ['gone', 'swap'] : t <= 3 ? ['gone', 'swap', 'flip', 'big'] : ['swap', 'flip', 'hue', 'small', 'big']
  const right = left.map(o => ({ ...o }))
  const spare = SPOT_ICONS.filter(x => !icons.includes(x))
  const diffs = pickN([...left.keys()], n, rng).map(i => {
    const o = right[i]
    const kind = kinds[Math.floor(rng() * kinds.length)]
    if (kind === 'gone') o.gone = true
    else if (kind === 'swap') o.icon = spare.splice(Math.floor(rng() * spare.length), 1)[0]
    else if (kind === 'flip') o.flip = true
    else if (kind === 'hue') o.hue = 150
    else if (kind === 'small') o.s = Math.round(o.s * 0.6)
    else if (kind === 'big') o.s = Math.round(o.s * 1.45)
    return { i, kind, x: o.x, y: o.y, r: Math.max(left[i].s, o.s) * 0.75 }
  })
  return { left, right, diffs }
}
