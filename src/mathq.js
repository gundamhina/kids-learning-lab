// 數學（數數）的出題：純函式，不碰 DOM。數一數、做數量共用「數」軌（題目是數字 '1'～'20'），比多少記在「比」軌（題目是 'more'／'less'）。

// 數字分組，照這一軌的星星一組一組解鎖（跟注音一樣，練熟一組開下一組）
export const COUNT_GROUPS = [
  ['1', '2', '3'], ['4', '5'], ['6', '7'], ['8', '9', '10'],
  ['11', '12', '13', '14', '15'], ['16', '17', '18', '19', '20'],
]
// 家長設的範圍（最多數到幾）對到前幾組：5 → 前兩組、10 → 前四組、20 → 全部
export function countGroupsUpTo (max) {
  return COUNT_GROUPS.filter(g => Number(g[g.length - 1]) <= max)
}
// 數學的「數」軌畫面：換成數字的組、不管注音的範圍與跳級設定
export function countViewOf (view, max = 10) {
  return { ...view, groups: countGroupsUpTo(max), rangeGroups: null, unlockedUpTo: null, known: [] }
}

function mathShuffle (arr, rng) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 數一數的三張數字卡：答案加兩個相近的數。低階差 2～4（好分），中階差 2～3，高階差 1～2（數漏一個就會選錯）
export function countOptions (n, tier, rng) {
  const minGap = tier >= 4 ? 1 : 2
  const maxGap = tier >= 4 ? 2 : tier >= 2 ? 3 : 4
  const near = []
  for (let d = minGap; d <= maxGap; d++) near.push(n - d, n + d)
  const picked = mathShuffle(near.filter(x => x >= 1), rng).slice(0, 2)
  for (let x = n + minGap; picked.length < 2; x++) if (!picked.includes(x)) picked.push(x) // n 很小時往上補
  return [n, ...picked].sort((a, b) => a - b)
}

// 做數量：盒子外面放幾個（答案再多 2～4 個，階級越高越多，不能全部丟進去就算對）
export function makePoolSize (n, tier) {
  return n + 2 + Math.min(2, Math.floor(tier / 2))
}

// 比多少：左右兩邊各幾個、問多還是少。低階差 3 以上、數量小；高階差 1、數量大，
// 而且少的那邊東西畫大一點（不能只看哪邊占的地方大）
export function compareQuestion (tier, rng, ask = rng() < 0.5 ? 'more' : 'less') {
  const max = tier >= 4 ? 10 : tier >= 2 ? 8 : 5
  const minGap = tier >= 4 ? 1 : tier >= 2 ? 2 : 3
  let a, b
  do {
    a = 1 + Math.floor(rng() * max)
    b = 1 + Math.floor(rng() * max)
  } while (Math.abs(a - b) < minGap)
  const bigFewer = tier >= 3
  return { left: a, right: b, ask, answer: (ask === 'more') === (a > b) ? 'left' : 'right', bigFewer }
}

// 數的東西：每題換一種（都有 Twemoji 圖檔）
export const COUNT_ICONS = ['🐟', '🍎', '🍓', '🚗', '🎈', '⭐', '🍪', '🐞', '🌸', '🐶', '🐱', '🐰', '🥚', '🍌', '🐸', '🐝', '🍩', '🐢', '🦋', '🐌', '🍒', '🌻', '⚽', '🎁', '🐧', '🍊', '🚀']

// 東西在框裡的位置：切成格子，每格放一個、稍微歪一點，才不會疊在一起。回傳 0～1 的座標
export function scatter (n, rng, cols = n <= 6 ? 3 : n <= 12 ? 4 : 5) {
  const rows = Math.max(1, Math.ceil(n / cols))
  const cells = mathShuffle([...Array(cols * rows).keys()], rng).slice(0, n)
  return cells.map(c => [
    (c % cols + 0.5 + (rng() - 0.5) * 0.35) / cols,
    (Math.floor(c / cols) + 0.5 + (rng() - 0.5) * 0.3) / rows,
  ])
}
