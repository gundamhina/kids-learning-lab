// 英文：26 個字母、字母的例詞、拼單字的詞，以及出題的純函式（不碰 DOM）。
// 認字母、聽發音記在「字」軌（題目是大寫字母），拼單字記在「拼英」軌（題目是單字）。

export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
// 字母一組一組解鎖（照字母順序，每組四到五個）
export const LETTER_GROUPS = [['A', 'B', 'C', 'D', 'E'], ['F', 'G', 'H', 'I', 'J'], ['K', 'L', 'M', 'N', 'O'], ['P', 'Q', 'R', 'S', 'T'], ['U', 'V', 'W', 'X', 'Y', 'Z']]
// 每個字母開頭的詞（圖都有 Twemoji 圖檔）。X 開頭的詞小孩不熟，用 xylophone
export const LETTER_WORDS = {
  A: [['apple', '🍎'], ['ant', '🐜']], B: [['ball', '⚽'], ['banana', '🍌'], ['bee', '🐝']], C: [['cat', '🐱'], ['car', '🚗'], ['cake', '🍰']],
  D: [['dog', '🐶'], ['duck', '🦆'], ['donut', '🍩']], E: [['egg', '🥚'], ['elephant', '🐘']], F: [['fish', '🐟'], ['frog', '🐸']],
  G: [['gift', '🎁'], ['grapes', '🍇'], ['guitar', '🎸']], H: [['house', '🏠'], ['hat', '🎩'], ['horse', '🐴']], I: [['ice cream', '🍦'], ['igloo', '🧊']],
  J: [['juice', '🧃'], ['jellyfish', '🪼']], K: [['kite', '🪁'], ['key', '🔑'], ['koala', '🐨']], L: [['lion', '🦁'], ['lemon', '🍋'], ['leaf', '🍃']],
  M: [['moon', '🌙'], ['monkey', '🐵'], ['milk', '🥛']], N: [['nose', '👃'], ['nest', '🪺']], O: [['orange', '🍊'], ['owl', '🦉'], ['octopus', '🐙']],
  P: [['pig', '🐷'], ['panda', '🐼'], ['pizza', '🍕']], Q: [['queen', '👸']], R: [['rabbit', '🐰'], ['rocket', '🚀'], ['rainbow', '🌈']],
  S: [['sun', '☀️'], ['star', '⭐'], ['snake', '🐍']], T: [['turtle', '🐢'], ['tiger', '🐯'], ['tree', '🌳']], U: [['umbrella', '☂️'], ['unicorn', '🦄']],
  V: [['violin', '🎻'], ['volcano', '🌋']], W: [['watermelon', '🍉'], ['whale', '🐳'], ['watch', '⌚']], X: [['xylophone', '🎹']],
  Y: [['yo-yo', '🪀'], ['yarn', '🧶']], Z: [['zebra', '🦓']],
}
// 長得像、聽起來像的字母（高階的干擾項）
export const LETTER_SIMILAR = [['B', 'D'], ['P', 'Q'], ['M', 'N'], ['U', 'V'], ['V', 'W'], ['C', 'G'], ['E', 'F'], ['I', 'J'], ['O', 'Q'], ['B', 'P'], ['C', 'K'], ['S', 'Z']]
// 拼單字：三個字母的（低階）和四個字母的（高階）
export const SPELL_WORDS = [
  ['cat', '🐱'], ['dog', '🐶'], ['pig', '🐷'], ['sun', '☀️'], ['bus', '🚌'], ['hat', '🎩'], ['bed', '🛏️'], ['fox', '🦊'], ['cup', '☕'],
  ['bug', '🐛'], ['ant', '🐜'], ['egg', '🥚'], ['box', '📦'], ['owl', '🦉'], ['bee', '🐝'], ['car', '🚗'], ['map', '🗺️'],
  ['fish', '🐟'], ['frog', '🐸'], ['duck', '🦆'], ['kite', '🪁'], ['cake', '🍰'], ['lion', '🦁'], ['moon', '🌙'], ['star', '⭐'],
  ['tree', '🌳'], ['milk', '🥛'], ['ball', '⚽'], ['gift', '🎁'], ['nose', '👃'], ['nest', '🪺'],
]
export const SPELL_GROUPS = [SPELL_WORDS.filter(([w]) => w.length === 3).map(([w]) => w), SPELL_WORDS.filter(([w]) => w.length === 4).map(([w]) => w)]
export const ENGLISH_ICON = Object.fromEntries([...Object.values(LETTER_WORDS).flat(), ...SPELL_WORDS])

function engShuffle (arr, rng) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const similarOf = l => LETTER_SIMILAR.filter(p => p.includes(l)).map(p => p[0] === l ? p[1] : p[0])

// 聽發音：聽一個字母，從幾個字母裡選。低階 3 個隨便挑，高階 4 個、一定放長得像或聽起來像的
export function letterOptions (letter, tier, rng) {
  const n = tier >= 3 ? 4 : 3
  const picked = []
  if (tier >= 2) for (const x of engShuffle(similarOf(letter), rng)) if (picked.length < n - 1) picked.push(x)
  for (const x of engShuffle(LETTERS.filter(x => x !== letter), rng)) {
    if (picked.length >= n - 1) break
    if (!picked.includes(x)) picked.push(x)
  }
  return engShuffle([letter, ...picked], rng)
}

// 認字母：看字母，從三張圖選開頭是這個字母的。干擾的兩張開頭都不是這個字母；高階其中一張開頭是長得像的字母（B 配 D 開頭的詞）
export function letterPictureQuestion (letter, tier, rng) {
  const own = LETTER_WORDS[letter]
  const answer = own[Math.floor(rng() * own.length)][0]
  const others = Object.entries(LETTER_WORDS).filter(([l]) => l !== letter)
  const picked = []
  const sim = similarOf(letter).filter(l => LETTER_WORDS[l])
  if (tier >= 3 && sim.length) {
    const l = sim[Math.floor(rng() * sim.length)]
    picked.push(LETTER_WORDS[l][Math.floor(rng() * LETTER_WORDS[l].length)][0])
  }
  for (const [, ws] of engShuffle(others, rng)) {
    if (picked.length >= 2) break
    const w = ws[Math.floor(rng() * ws.length)][0]
    if (!picked.includes(w) && ENGLISH_ICON[w] !== ENGLISH_ICON[answer]) picked.push(w)
  }
  return { answer, options: engShuffle([answer, ...picked], rng) }
}

// 拼單字的字母磁磚：答案的字母各一塊（重複的字母也各一塊），再加 1～3 塊干擾（高階放長得像的）
export function wordTiles (word, tier, rng) {
  const letters = word.toUpperCase().split('')
  const extra = tier >= 4 ? 3 : tier >= 2 ? 2 : 1
  const picked = []
  if (tier >= 2) for (const l of engShuffle(letters, rng)) for (const s of similarOf(l)) if (picked.length < extra && !letters.includes(s) && !picked.includes(s)) picked.push(s)
  for (const x of engShuffle(LETTERS, rng)) {
    if (picked.length >= extra) break
    if (!letters.includes(x) && !picked.includes(x)) picked.push(x)
  }
  return engShuffle([...letters, ...picked], rng)
}
