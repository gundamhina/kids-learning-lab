// 對戰的出題：純函式，不碰 DOM。兩個人各答各的，每人照自己的程度出題（使用者看自己的進度，客人看大人選的程度）。
// 只收「看了就能答、點一下作答」的玩法：聽的玩法兩邊的聲音會疊在一起，拖曳、寫字、迷宮、著色兩個人擠一個螢幕不好玩。
// 每題回傳 { game, prompt, options, answer }：answer 是 options 裡正解的索引，畫面怎麼畫交給 battle.js。

import { GROUPS, EASY_PICTURE_WORDS, WORD_ICON } from './data.js'
import { buildFriendQuestion, trackView, effectiveTier, unlockedCount } from './scheduler.js'
import { countOptions, compareQuestion, scatter, COUNT_ICONS } from './mathq.js'
import { patternQuestion, oddQuestion, analogyQuestion, tilesQuestion } from './brainq.js'
import { LETTER_GROUPS, LETTER_WORDS, letterOptions, letterPictureQuestion } from './english.js'

// card：首頁卡片的圖用哪一張（看注音找圖借連連看的、看圖找字母借聽字母的）
export const BATTLE_GAMES = [
  { key: 'friend', subject: 'zhuyin', track: 'friend', name: '符號找朋友' },
  { key: 'zword', subject: 'zhuyin', track: 'word', name: '看注音找圖', card: 'match' },
  { key: 'count', subject: 'math', track: 'count', name: '數一數' },
  { key: 'compare', subject: 'math', track: 'compare', name: '比多少' },
  { key: 'letterpic', subject: 'english', track: 'letter', name: '認字母' },
  { key: 'picletter', subject: 'english', track: 'letter', name: '看圖找字母', card: 'letterhear' },
  { key: 'pattern', subject: 'brain', track: 'pattern', name: '找規律' },
  { key: 'odd', subject: 'brain', track: 'odd', name: '找不同' },
  { key: 'analogy', subject: 'brain', track: 'pattern', name: '圖形類比' },
  { key: 'tiles', subject: 'brain', track: 'pattern', name: '拼板補洞' },
]
export const battleGame = key => BATTLE_GAMES.find(g => g.key === key)

function battleShuffle (arr, rng) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const battlePick = (list, rng) => list[Math.floor(rng() * list.length)]
// 前十組是單一符號（ㄅㄆㄇ…），後面是結合韻、拼讀字、詞；找朋友只出單一符號
const SYMBOL_GROUPS = GROUPS.slice(0, 10)

// 客人的程度 1～6：階級、注音開到第幾組、數到多少、英文開到第幾組
const GUEST_SYMBOL_GROUPS = [2, 3, 5, 7, 10, 10]
const GUEST_COUNT_MAX = [5, 5, 10, 10, 20, 20]
const GUEST_LETTER_GROUPS = [1, 2, 3, 4, 5, 5]
export function guestLevel (level) {
  const i = Math.max(1, Math.min(6, level)) - 1
  return {
    tier: () => i,
    symbols: SYMBOL_GROUPS.slice(0, GUEST_SYMBOL_GROUPS[i]).flat(),
    countMax: GUEST_COUNT_MAX[i],
    letters: LETTER_GROUPS.slice(0, GUEST_LETTER_GROUPS[i]).flat(),
  }
}

// 使用者：每個玩法照那一軌的階級（家長有鎖就用鎖的），符號、字母照已經解鎖的組，數數照家長設的範圍
export function profileLevel (state) {
  const symbolView = { ...trackView(state, 'friend'), groups: SYMBOL_GROUPS }
  const letterView = { ...trackView(state, 'letter'), groups: LETTER_GROUPS, rangeGroups: null, unlockedUpTo: null, known: [] }
  return {
    tier: track => effectiveTier(trackView(state, track)),
    symbols: SYMBOL_GROUPS.slice(0, unlockedCount(symbolView)).flat(),
    countMax: state.countMax || 10,
    letters: LETTER_GROUPS.slice(0, unlockedCount(letterView)).flat(),
  }
}

// 看注音找圖：一個詞的注音，三張圖選一張；三張圖不能長得一樣（同一個表情符號）
function zwordQuestion (rng) {
  const answer = battlePick(EASY_PICTURE_WORDS, rng)
  const picked = [answer]
  for (const w of battleShuffle(EASY_PICTURE_WORDS, rng)) {
    if (picked.length >= 3) break
    if (!picked.some(p => WORD_ICON[p] === WORD_ICON[w])) picked.push(w)
  }
  const options = battleShuffle(picked, rng)
  return { prompt: { word: answer }, options, answer: options.indexOf(answer) }
}

function buildBattle (game, lvl, rng) {
  const tier = lvl.tier(battleGame(game).track)
  if (game === 'friend') {
    const symbol = battlePick(lvl.symbols, rng)
    const q = buildFriendQuestion(symbol, tier, rng)
    return { prompt: { symbol }, options: q.options, answer: q.options.indexOf(q.answer) }
  }
  if (game === 'zword') return zwordQuestion(rng)
  if (game === 'count') {
    const n = 1 + Math.floor(rng() * lvl.countMax)
    const options = countOptions(n, tier, rng)
    return { prompt: { n, icon: battlePick(COUNT_ICONS, rng), points: scatter(n, rng) }, options, answer: options.indexOf(n) }
  }
  if (game === 'compare') {
    // 對戰一律問「哪邊多」：兩個人同時在玩，沒辦法每題唸「多」還是「少」
    const q = compareQuestion(tier, rng, 'more')
    const icon = battlePick(COUNT_ICONS, rng)
    const side = n => ({ n, icon, points: scatter(n, rng, 3) })
    return { prompt: { bigFewer: q.bigFewer }, options: [side(q.left), side(q.right)], answer: q.answer === 'left' ? 0 : 1 }
  }
  if (game === 'letterpic') {
    const letter = battlePick(lvl.letters, rng)
    const q = letterPictureQuestion(letter, tier, rng)
    return { prompt: { letter }, options: q.options, answer: q.options.indexOf(q.answer) }
  }
  if (game === 'picletter') {
    const letter = battlePick(lvl.letters, rng)
    const [word, icon] = battlePick(LETTER_WORDS[letter], rng)
    const options = letterOptions(letter, tier, rng)
    return { prompt: { word, icon }, options, answer: options.indexOf(letter) }
  }
  if (game === 'pattern') {
    const q = patternQuestion(tier, rng)
    return { prompt: { row: q.row, blank: q.blank, mode: q.mode }, options: q.options, answer: q.options.findIndex(o => o.join() === q.answer.join()) }
  }
  if (game === 'odd') {
    const q = oddQuestion(tier, rng)
    const options = Array.from({ length: q.n }, (_, i) => ({ icon: i === q.odd && q.kind === 'icon' ? q.other : q.icon, kind: i === q.odd ? q.kind : null }))
    return { prompt: null, options, answer: q.odd }
  }
  if (game === 'analogy') {
    const q = analogyQuestion(tier, rng)
    return { prompt: { a: q.a, b: q.b, c: q.c }, options: q.options, answer: q.answerIndex }
  }
  if (game === 'tiles') {
    const q = tilesQuestion(tier, rng)
    return { prompt: { n: q.n, board: q.board, hole: q.hole }, options: q.options, answer: q.answerIndex }
  }
  throw new Error('unknown battle game: ' + game)
}

// 出一題；跟上一題（prev）一樣就重抽，最多試幾次
export function battleQuestion (game, lvl, rng, prev = null) {
  let q = null
  for (let i = 0; i < 6; i++) {
    q = { game, ...buildBattle(game, lvl, rng) }
    if (!prev || JSON.stringify(q.prompt) + q.options.join() !== JSON.stringify(prev.prompt) + prev.options.join()) break
  }
  return q
}
