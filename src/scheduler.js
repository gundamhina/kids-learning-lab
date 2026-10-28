// 出題邏輯：熟練度、解鎖、加權出題、混淆對加練、階級升降。
// 純函式，不碰 DOM，不碰 localStorage。所有函式回傳新狀態，不改舊的。

import { GROUPS, SYMBOLS, SIMILAR_SHAPE, SIMILAR_SOUND, coreOf, WORD_ICON, WORDS, EASY_PICTURE_WORDS } from './data.js'

export const HISTORY_CAP = 10
export const RECENT_CAP = 10
export const ROUND_SIZE = 5
export const UNLOCK_STARS = 4
export const DRILL_CLEAR_STREAK = 3

// 一個數字代表整體難度，往上走選項變多、干擾項變刁、提示變少。
// similar：這題放形似／音似干擾項的機率（每階都會放，只是低階不一定）。
// distract：形似、音似誰先放（shape 先放長得像的，sound 先放聽起來像的）。
// idleHint：幾秒沒點就重唸並晃一下正確的（0 = 不提示）。只有最低兩階有，其他一律沒有。
// 一開始永遠沒有提示，答錯也不顯示答案，只重唸一次。
export const TIERS = [
  { options: 2, distract: 'shape', similar: 0.6, idleHint: 10 },
  { options: 3, distract: 'shape', similar: 0.7, idleHint: 10 },
  { options: 3, distract: 'shape', similar: 1, idleHint: 0 },
  { options: 4, distract: 'shape', similar: 1, idleHint: 0 },
  { options: 4, distract: 'sound', similar: 1, idleHint: 0 },
  { options: 6, distract: 'sound', similar: 1, idleHint: 0 },
]

// 聽（釣魚、打地鼠）、讀（唸給狗狗聽）、寫（寫給狗狗看）、詞（連連看、填空）、調（聲調填空）、拼（拼拼看）各軌分開記，練的是不同的東西。
// 調軌也是拿詞出題，但記的是「這個詞的聲調會不會」，所以不跟詞軌共用星星。
// 拼軌拿結合韻和拼讀字出題，記的是「聽到這個音，拼不拼得出來」。
// 認軌（符號找朋友）記的是「看到這個符號，知不知道哪些詞有這個音」。
// 數學：數軌（數一數、做數量，題目是數字）、比軌（比多少，題目是 more／less）
export const TRACKS = ['listen', 'read', 'write', 'word', 'tone', 'spell', 'friend', 'count', 'compare']
export const TRACK_NAMES = { listen: '聽', read: '讀', write: '寫', word: '詞', tone: '調', spell: '拼', friend: '認', count: '數', compare: '比' }
// 注音的軌（家長區注音進度頁只列這些）
export const ZHUYIN_TRACKS = ['listen', 'read', 'write', 'word', 'tone', 'spell', 'friend']
const TRACK_FIELDS = ['mastery', 'confusions', 'tier', 'recent', 'log']
export const LOG_CAP = 3000

export function emptyTrack () {
  return { mastery: {}, confusions: {}, tier: 0, recent: [], log: [] }
}
export function emptyTracks () {
  return Object.fromEntries(TRACKS.map(t => [t, emptyTrack()]))
}

// version 2：家長設定在外層共用，練習紀錄分軌記。
export function createState ({ known = [], groups = null } = {}) {
  return {
    version: 2,
    known: [...known],
    groups,
    lockTier: null, // 家長鎖定的階級；null 表示自動
    rangeGroups: null, // 家長指定的練習組別索引；null 或空表示自動解鎖
    unlockedUpTo: null, // 家長手動跳級：至少解鎖到第幾組（1 起算）；null 表示不干預
    tracks: emptyTracks(),
    ...emptyWallet(),
  }
}

// 骨頭（積分）與商店：各軌共用。bones 現在有幾根、bonesTotal 累計賺過幾根、owned 買過的配件、worn 每個部位戴著哪一件
export function emptyWallet () {
  return { bones: 0, bonesTotal: 0, owned: [], worn: {}, daily: null, streak: { last: null, count: 0 }, seen: {}, partner: null }
}
// 舊存檔沒有這幾個欄位，補上。daily 今天玩了幾局、寶箱開了沒；streak 連續天數；seen 看過哪些玩法的教學
export function withWallet (state) {
  return {
    ...emptyWallet(),
    ...state,
    owned: [...(state.owned || [])],
    worn: { ...(state.worn || {}) },
    streak: { ...(state.streak || { last: null, count: 0 }) },
    seen: { ...(state.seen || {}) },
  }
}
export function addBones (state, n) {
  const s = withWallet(state)
  return { ...s, bones: Math.max(0, s.bones + n), bonesTotal: s.bonesTotal + Math.max(0, n) }
}
// 買配件：骨頭不夠或已經有了就原樣回傳
export function buyItem (state, item) {
  const s = withWallet(state)
  if (s.owned.includes(item.id) || s.bones < item.price) return s
  const next = { ...s, bones: s.bones - item.price, owned: [...s.owned, item.id] }
  // 配件買了自動戴上；隊員這種沒有部位的，買了就是回家了
  if (item.slot) next.worn = { ...s.worn, [item.slot]: item.id }
  return next
}
// 出任務的隊員：自己原本那位（建立使用者時選的顏色），或已經買回家的隊員。沒選過、或選的還沒買，就是原本那位
export function teamOf (state, ownColor) {
  const owned = (state.owned || []).filter(id => id.startsWith('mate-')).map(id => parseInt(id.slice(5), 10))
  return [ownColor, ...owned.filter(c => c !== ownColor)]
}
export function partnerOf (state, ownColor) {
  const p = state.partner
  return typeof p === 'number' && teamOf(state, ownColor).includes(p) ? p : ownColor
}
export function setPartner (state, color, ownColor) {
  if (!teamOf(state, ownColor).includes(color)) return state
  return { ...withWallet(state), partner: color }
}

// 戴上（id）或脫掉（null）某個部位的配件；沒買過的不能戴
export function wearItem (state, slot, id) {
  const s = withWallet(state)
  if (id && !s.owned.includes(id)) return s
  const worn = { ...s.worn }
  if (id) worn[slot] = id; else delete worn[slot]
  return { ...s, worn }
}

// 把一軌攤平成舊格式（外層設定 + 這軌的紀錄），給出題、記錄、面板用。
export function trackView (state, track) {
  const t = (state.tracks && state.tracks[track]) || emptyTrack()
  const { tracks, ...shared } = state
  return { ...shared, ...emptyTrack(), ...t, track }
}

// 把攤平的一軌寫回去，只動這軌的紀錄欄位。
export function applyTrack (state, track, view) {
  const patch = {}
  for (const k of TRACK_FIELDS) patch[k] = view[k]
  return { ...state, tracks: { ...state.tracks, [track]: { ...state.tracks[track], ...patch } } }
}

// 自動解鎖到第幾組（1 起算）：練熟一組開下一組，再跟家長手動跳級的值取大者
export function unlockedCount (state) {
  const groups = state.groups || GROUPS
  let n = 1
  while (n < groups.length && groupAverage(state, groups[n - 1]) >= UNLOCK_STARS) n++
  const manual = typeof state.unlockedUpTo === 'number' ? state.unlockedUpTo : 1
  return Math.min(groups.length, Math.max(n, manual))
}

// 清除練習紀錄：每一軌的星星、混淆對、階級、最近答題全部歸零。名字、認得、難度鎖、範圍都保留。
// 傳攤平的一軌進來就只清那一軌。
export function resetProgress (state) {
  if (state.tracks) {
    return { ...state, tracks: emptyTracks() }
  }
  return { ...state, ...emptyTrack() }
}

// 出題實際用的階級：家長有鎖就用鎖的，否則用自動升降的
export function effectiveTier (state) {
  return typeof state.lockTier === 'number' ? state.lockTier : state.tier
}

// 0–5 星。只看最近 10 次；樣本少時星星不會超過樣本數，避免答對一次就 5 星。
export function stars (state, symbol) {
  const history = (state.mastery[symbol] && state.mastery[symbol].history) || []
  if (history.length === 0) return state.known.includes(symbol) ? 3 : 0
  const okCount = history.filter(h => h.ok).length
  return Math.min(Math.round((okCount / history.length) * 5), history.length)
}

// 間隔複習：熟了（4 顆星以上）的題目，隔 3、7、14、30 天再拿出來考一次。
// 到期時考對，間隔拉長一級；答錯就回到第一級。mastery 每題記 last（上次出現）、box（現在第幾級）、n（總共出現幾次）
export const REVIEW_DAYS = [3, 7, 14, 30]
const DAY_MS = 86400000
export function reviewDue (state, s, now = Date.now()) {
  const m = state.mastery[s]
  if (!m || !m.last || stars(state, s) < 4) return false
  return now - m.last >= REVIEW_DAYS[Math.min(m.box || 0, REVIEW_DAYS.length - 1)] * DAY_MS
}
// 出現過幾次（舊存檔沒有 n，用最近紀錄的筆數）
function seenCount (state, s) {
  const m = state.mastery[s]
  if (!m) return 0
  return typeof m.n === 'number' ? m.n : (m.history || []).length
}
export const MIN_EXPOSURE = 3

function groupAverage (state, group) {
  return group.reduce((sum, s) => sum + stars(state, s), 0) / group.length
}

// 目前可出題的符號。家長有指定範圍就只出那幾組；否則是已解鎖的組 + 家長勾「已經認得」的。
export function activePool (state) {
  const groups = state.groups || GROUPS
  if (Array.isArray(state.rangeGroups) && state.rangeGroups.length) {
    return state.rangeGroups.filter(i => groups[i]).flatMap(i => groups[i])
  }
  const pool = groups.slice(0, unlockedCount(state)).flat()
  for (const s of state.known) {
    if (!pool.includes(s)) pool.push(s)
  }
  return pool
}

function weightedPick (items, weightOf, rng) {
  const weights = items.map(weightOf)
  const total = weights.reduce((a, b) => a + b, 0)
  let r = rng() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r < 0) return items[i]
  }
  return items[items.length - 1]
}

function shuffle (arr, rng) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function partnersOf (symbol, pairs) {
  const out = []
  for (const [a, b] of pairs) {
    if (a === symbol) out.push(b)
    else if (b === symbol) out.push(a)
  }
  return out
}

// 兩個字有幾個位置的符號一樣（長度不同算 0）。詞（有空白）改成比音節：有幾個音節相同。
function sharedSymbols (a, b) {
  if (a.includes(' ') || b.includes(' ')) {
    const sa = a.split(' ').map(coreOf)
    const sb = b.split(' ').map(coreOf)
    return sa.filter(x => sb.includes(x)).length
  }
  a = coreOf(a)
  b = coreOf(b)
  if (a.length !== b.length) return 0
  let n = 0
  for (let i = 0; i < a.length; i++) if (a[i] === b[i]) n++
  return n
}

// 干擾項：形似、音似的對先放（誰先看 mode），拼讀字再放只差一個符號的；不夠再隨機補。
// useSimilar 為 false 時整題隨機。
function pickDistractors (target, pool, count, mode, rng, useSimilar = true) {
  const candidates = pool.filter(s => s !== target)
  const preferred = []
  if (useSimilar) {
    const first = mode === 'sound' ? SIMILAR_SOUND : SIMILAR_SHAPE
    const second = mode === 'sound' ? SIMILAR_SHAPE : SIMILAR_SOUND
    preferred.push(...shuffle(partnersOf(target, first), rng))
    preferred.push(...shuffle(partnersOf(target, second), rng))
    // 拼讀字：只差一個符號的；詞：至少共用一個音節的
    if (target.includes(' ')) {
      preferred.push(...shuffle(candidates.filter(c => sharedSymbols(target, c) >= 1), rng))
    } else if (coreOf(target).length > 1) {
      preferred.push(...shuffle(candidates.filter(c => sharedSymbols(target, c) >= coreOf(target).length - 1), rng))
    }
  }
  const chosen = []
  for (const p of preferred) {
    if (chosen.length >= count) break
    if (candidates.includes(p) && !chosen.includes(p)) chosen.push(p)
  }
  const rest = shuffle(candidates.filter(s => !chosen.includes(s)), rng)
  while (chosen.length < count && rest.length) chosen.push(rest.pop())
  return chosen
}

function pairKey (a, b) {
  return [a, b].sort().join('|')
}

// 一局 5 題。一題來自最弱的三個；另一題先給到期該複習的（最久沒出現的優先），沒有就也從最弱的挑；
// 有混淆對時，插一題二選一加練。其他題照權重抽：越不熟越常出，出現不到 3 次的、到期該複習的也拉高
export function buildRound (state, rng, size = ROUND_SIZE, now = Date.now()) {
  const pool = activePool(state)
  const tier = TIERS[effectiveTier(state)]
  const optionCount = Math.min(tier.options, pool.length)
  const weakest = [...pool].sort((a, b) => stars(state, a) - stars(state, b)).slice(0, 3)
  const due = pool.filter(s => reviewDue(state, s, now)).sort((a, b) => state.mastery[a].last - state.mastery[b].last)
  const weightOf = s => {
    let w = Math.pow(6 - stars(state, s), 2)
    if (seenCount(state, s) < MIN_EXPOSURE) w = Math.max(w, 16)
    if (reviewDue(state, s, now)) w = Math.max(w, 25)
    return w
  }

  const slots = shuffle([...Array(size).keys()], rng)
  const forced = new Set(slots.slice(0, 2))
  const drillKeys = Object.keys(state.confusions)
  const drillSlot = drillKeys.length ? slots[2] : -1

  const round = []
  for (let i = 0; i < size; i++) {
    if (i === drillSlot) {
      const key = drillKeys[Math.floor(rng() * drillKeys.length)]
      const pair = key.split('|')
      const target = pair[Math.floor(rng() * 2)]
      round.push({ target, options: shuffle(pair, rng), idleHint: tier.idleHint, drill: key })
      continue
    }
    // 強迫的兩格：第一格最弱的；第二格到期該複習的（有的話）
    const isReviewSlot = forced.has(i) && i === slots[1] && due.length
    const source = forced.has(i) ? weakest : pool
    const target = isReviewSlot ? due.shift() : weightedPick(source, weightOf, rng)
    // 詞比較大，最多 4 個選項
    const count = target.includes(' ') ? Math.min(optionCount, 4) : optionCount
    const distractors = pickDistractors(target, pool, count - 1, tier.distract, rng, rng() < tier.similar)
    round.push({ target, options: shuffle([target, ...distractors], rng), idleHint: tier.idleHint, drill: null })
  }
  return round
}

// 寫字用：只留單一符號的組（前十組）。家長指定的範圍若沒有單一符號組，退回第一組。
export function singleSymbolState (state) {
  const groups = state.groups || GROUPS
  const singles = [...groups.keys()].filter(i => groups[i].every(s => s.length === 1))
  let chosen
  if (Array.isArray(state.rangeGroups) && state.rangeGroups.length) {
    chosen = state.rangeGroups.filter(i => singles.includes(i))
  } else {
    chosen = singles.filter(i => i < unlockedCount(state))
  }
  if (!chosen.length) chosen = [singles[0]]
  return { ...state, rangeGroups: chosen }
}

function isWordGroup (g) { return g.length > 0 && g[0].includes(' ') }

// 聽的玩法（釣魚、打地鼠、翻牌）不出詞：把詞的組排除。範圍全是詞就退回第一組。
export function noWordsState (state) {
  const groups = state.groups || GROUPS
  const nonWord = [...groups.keys()].filter(i => !isWordGroup(groups[i]))
  let chosen
  if (Array.isArray(state.rangeGroups) && state.rangeGroups.length) {
    chosen = state.rangeGroups.filter(i => nonWord.includes(i))
  } else {
    chosen = nonWord.filter(i => i < unlockedCount(state))
  }
  if (!chosen.length) chosen = [nonWord[0]]
  return { ...state, rangeGroups: chosen }
}

// 連連看、填空只出詞：家長範圍裡有詞的組就用那些，否則全部詞的組。
// 連連看、填空要看圖，只用有圖的詞；聲調填空傳 { pictures: false }，只聽不看圖的詞也出。
export function wordsOnlyState (state, { pictures = true } = {}) {
  const groups = state.groups || GROUPS
  const wordIdx = [...groups.keys()].filter(i => isWordGroup(groups[i]) && (!pictures || groups[i].every(w => WORD_ICON[w])))
  let chosen = []
  if (Array.isArray(state.rangeGroups) && state.rangeGroups.length) {
    chosen = state.rangeGroups.filter(i => wordIdx.includes(i))
  }
  if (!chosen.length) chosen = wordIdx
  return { ...state, rangeGroups: chosen }
}

// ---- 符號找朋友 ----
// 三張圖卡裡，「第一個字的注音有這個符號」的那張是朋友（ㄇ→貓 ㄇㄠ、ㄠ→小鳥 ㄋㄧㄠˇ 不算，第一個字是「小」）。
// 另外兩張的第一個字都不能有這個符號。階級高時（看這階的 similar 機率），其中一張故意挑第一個字有它易混音的詞（ㄅ配開頭ㄆ的詞）
const PICTURE_WORDS = WORDS.filter(w => WORD_ICON[w])
const firstSyllable = w => coreOf(w.split(' ')[0])
export function friendWords (symbol, words = PICTURE_WORDS) {
  return words.filter(w => firstSyllable(w).includes(symbol))
}
// 圖都用一眼叫得出名字的詞；好認的朋友不到兩個的符號（ㄗ），答案才從全部有圖的詞挑
export function buildFriendQuestion (symbol, tier, rng, words = EASY_PICTURE_WORDS) {
  const t = TIERS[Math.max(0, Math.min(TIERS.length - 1, tier))]
  let friends = friendWords(symbol, words)
  if (friends.length < 2) friends = friendWords(symbol, PICTURE_WORDS)
  const answer = friends[Math.floor(rng() * friends.length)]
  const others = words.filter(w => !firstSyllable(w).includes(symbol))
  const partners = [...partnersOf(symbol, SIMILAR_SOUND), ...partnersOf(symbol, SIMILAR_SHAPE)]
  const picked = []
  if (partners.length && rng() < t.similar) {
    const near = others.filter(w => partners.some(p => firstSyllable(w).includes(p)))
    if (near.length) picked.push(near[Math.floor(rng() * near.length)])
  }
  const rest = shuffle(others.filter(w => !picked.includes(w) && WORD_ICON[w] !== WORD_ICON[answer]), rng)
  while (picked.length < 2 && rest.length) {
    const w = rest.pop()
    if (!picked.some(p => WORD_ICON[p] === WORD_ICON[w])) picked.push(w)
  }
  return { answer, options: shuffle([answer, ...picked], rng) }
}

// ---- 拼拼看 ----
// 只出兩個符號以上、不是詞的組（結合韻、拼讀字）。家長範圍裡有這種組就用那些；
// 否則這一軌自己解鎖：第一組一定有，前一組平均練到 UNLOCK_STARS 顆星才開下一組（家長手動跳級也算）。
function isSpellGroup (g) { return g.length > 0 && g.every(s => !s.includes(' ') && coreOf(s).length > 1) }
export function syllablesOnlyState (state) {
  const groups = state.groups || GROUPS
  const idx = [...groups.keys()].filter(i => isSpellGroup(groups[i]))
  let chosen = []
  if (Array.isArray(state.rangeGroups) && state.rangeGroups.length) {
    chosen = state.rangeGroups.filter(i => idx.includes(i))
  }
  if (!chosen.length && idx.length) {
    const manual = typeof state.unlockedUpTo === 'number' ? state.unlockedUpTo : 0
    chosen = [idx[0]]
    for (let k = 1; k < idx.length; k++) {
      if (idx[k] < manual || groupAverage(state, groups[idx[k - 1]]) >= UNLOCK_STARS) chosen.push(idx[k])
      else break
    }
  }
  return { ...state, rangeGroups: chosen }
}

// 符號分三類：聲符、介符（ㄧㄨㄩ）、韻符。干擾項盡量跟空格同一類，才不能只靠位置猜
const MEDIALS = ['ㄧ', 'ㄨ', 'ㄩ']
function symbolKind (sym) {
  if (MEDIALS.includes(sym)) return 'medial'
  return SYMBOLS.indexOf(sym) < 21 ? 'initial' : 'final'
}
// 每階多放幾塊不在答案裡的磁磚
const SPELL_EXTRA = [1, 2, 2, 3, 3, 3]
// 拼拼看的磁磚：答案的每個符號各一塊，再加幾塊干擾項，打亂。
// 干擾項先放答案符號的形似／音似（誰先看這階的 distract，放不放看 similar 機率），再補同一類的，都不重複、不跟答案撞。
export function spellTiles (target, tier, rng) {
  const t = TIERS[Math.max(0, Math.min(TIERS.length - 1, tier))]
  const pieces = [...coreOf(target)]
  const extra = SPELL_EXTRA[Math.max(0, Math.min(SPELL_EXTRA.length - 1, tier))]
  const chosen = []
  const add = s => { if (s && SYMBOLS.includes(s) && !pieces.includes(s) && !chosen.includes(s) && chosen.length < extra) chosen.push(s) }
  if (rng() < t.similar) {
    const first = t.distract === 'sound' ? SIMILAR_SOUND : SIMILAR_SHAPE
    const second = t.distract === 'sound' ? SIMILAR_SHAPE : SIMILAR_SOUND
    for (const p of shuffle(pieces, rng)) {
      for (const q of shuffle(partnersOf(p, first), rng)) add(q)
      for (const q of shuffle(partnersOf(p, second), rng)) add(q)
    }
  }
  const kinds = pieces.map(symbolKind)
  for (const s of shuffle(SYMBOLS.filter(x => kinds.includes(symbolKind(x))), rng)) add(s)
  for (const s of shuffle(SYMBOLS, rng)) add(s)
  return shuffle([...pieces, ...chosen], rng)
}

// ---- 聲調填空 ----
// 聲調的代號：'1' 一聲（課本不標）、ˊ 二聲、ˇ 三聲、ˋ 四聲、˙ 輕聲
export const TONE_ORDER = ['1', 'ˊ', 'ˇ', 'ˋ', '˙']
export function toneOfSyllable (syl) {
  if (syl.startsWith('˙')) return '˙'
  const last = syl.slice(-1)
  return 'ˊˇˋ'.includes(last) ? last : '1'
}
export function stripTone (syl) { return syl.replace(/[ˊˇˋ˙]/g, '') }
// 最容易跟它搞混的調號：二三聲互相混最多；輕聲跟一聲都是平平的；一聲跟四聲都從高的地方開始
export const TONE_PARTNER = { 'ˊ': 'ˇ', 'ˇ': 'ˊ', '˙': '1', '1': 'ˋ', 'ˋ': '1' }
// 可以選的調號：低階兩個、中階三個、高階四個，最容易搞混的那個一定在裡面；
// 輕聲只有答案是輕聲、或到了高階才出現。照一二三四輕的順序排
export function toneTiles (correct, tier, rng) {
  const count = tier <= 1 ? 2 : tier <= 3 ? 3 : 4
  const picked = [correct, TONE_PARTNER[correct]]
  const pool = TONE_ORDER.filter(t => !picked.includes(t) && (t !== '˙' || tier >= 4))
  while (picked.length < count && pool.length) picked.push(pool.splice(Math.floor(rng() * pool.length), 1)[0])
  return TONE_ORDER.filter(t => picked.includes(t))
}

// 一個詞裡每個音節的聲調有多難分辨（越大越難）：
// 3 三聲接三聲：前一個唸起來像二聲，寫的卻是三聲（小狗、水果）
// 2 輕聲、二聲、其他三聲：二三聲最容易混，輕聲聽起來又短又輕
// 1 一聲；0.5 四聲，最好認
export function toneHardness (word) {
  const syls = word.split(' ')
  return syls.map((s, i) => {
    const t = toneOfSyllable(s)
    if (t === 'ˇ' && syls[i + 1] && toneOfSyllable(syls[i + 1]) === 'ˇ') return 3
    if (t === '˙' || t === 'ˊ' || t === 'ˇ') return 2
    return t === '1' ? 1 : 0.5
  })
}

// 聲調填空的一局：只挑有難分辨音節的詞（至少一個 2 分以上），越難、越不熟的越常出；
// 空格放在最難的那個音節（一樣難就隨機挑）。回 [{ target, blank, drill }]
export function buildToneRound (state, rng, size = ROUND_SIZE) {
  const pool = activePool(state)
  const hard = pool.filter(w => Math.max(...toneHardness(w)) >= 2)
  const candidates = hard.length ? hard : pool
  const weightOf = w => Math.max(...toneHardness(w)) * (6 - stars(state, w))
  const bag = [...candidates]
  const round = []
  while (round.length < size && candidates.length) {
    if (!bag.length) bag.push(...candidates) // 詞不夠一局就重複
    const total = bag.reduce((sum, w) => sum + weightOf(w), 0)
    let r = rng() * total
    let i = 0
    while (i < bag.length - 1 && (r -= weightOf(bag[i])) > 0) i++
    const target = bag.splice(i, 1)[0]
    const h = toneHardness(target)
    const top = Math.max(...h)
    const idx = h.map((v, k) => v === top ? k : -1).filter(k => k >= 0)
    round.push({ target, blank: idx[Math.floor(rng() * idx.length)], drill: null })
  }
  return round
}

// 翻牌用：從出題池挑 n 個不重複的符號，弱的優先。池子不夠就全給。
export function pickSymbols (state, rng, n) {
  let candidates = activePool(state)
  const weightOf = s => Math.pow(6 - stars(state, s), 2)
  const chosen = []
  while (chosen.length < n && candidates.length) {
    const s = weightedPick(candidates, weightOf, rng)
    chosen.push(s)
    candidates = candidates.filter(x => x !== s)
  }
  return chosen
}

function adjustTier (tier, recent) {
  if (recent.length < RECENT_CAP) return { tier, recent }
  const okCount = recent.filter(Boolean).length
  if (okCount >= 9) return { tier: Math.min(tier + 1, TIERS.length - 1), recent: [] }
  if (okCount < 6) return { tier: Math.max(tier - 1, 0), recent: [] }
  return { tier, recent }
}

// 每題只記第一次點的結果。picked 是她點的符號；drill 是這題若為加練題的混淆對 key。
// at 是答題時間（毫秒），寫進長期日誌；不給就用現在。
export function recordAnswer (state, { target, ok, picked, ms, drill = null, at = Date.now() }) {
  const old = state.mastery[target] || {}
  const oldHistory = old.history || []
  const history = [...oldHistory, { ok, ms }].slice(-HISTORY_CAP)
  // 複習級數：到期時考對升一級；答錯回到第一級；沒到期考對維持
  const box = !ok ? 0 : (reviewDue(state, target, at) ? Math.min((old.box || 0) + 1, REVIEW_DAYS.length - 1) : (old.box || 0))
  const n = (typeof old.n === 'number' ? old.n : oldHistory.length) + 1
  const mastery = { ...state.mastery, [target]: { history, last: at, box, n } }
  const log = [...(state.log || []), { at, s: target, ok }].slice(-LOG_CAP)

  const confusions = { ...state.confusions }
  if (!ok && picked && picked !== target) {
    confusions[pairKey(target, picked)] = { streak: 0 }
  }
  if (drill && confusions[drill]) {
    if (!ok) {
      confusions[drill] = { streak: 0 }
    } else {
      const streak = confusions[drill].streak + 1
      if (streak >= DRILL_CLEAR_STREAK) delete confusions[drill]
      else confusions[drill] = { streak }
    }
  }

  const { tier, recent } = adjustTier(state.tier, [...state.recent, ok].slice(-RECENT_CAP))
  return { ...state, mastery, confusions, tier, recent, log }
}

// 長期統計：累計題數、答對數，以及每個符號的累計
export function lifetimeStats (state) {
  const bySymbol = {}
  let total = 0, correct = 0
  for (const e of state.log || []) {
    total++
    if (e.ok) correct++
    const b = bySymbol[e.s] || (bySymbol[e.s] = { total: 0, correct: 0 })
    b.total++
    if (e.ok) b.correct++
  }
  return { total, correct, bySymbol }
}

// 最近 days 天每天的題數與答對數（本地日期），今天在最後一格
export function dailyStats (state, days, now = Date.now()) {
  const out = []
  const keyOf = d => `${d.getMonth() + 1}/${d.getDate()}`
  const index = {}
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    const row = { date: keyOf(d), total: 0, correct: 0 }
    index[keyOf(d) + '|' + d.getFullYear()] = row
    out.push(row)
  }
  for (const e of state.log || []) {
    const d = new Date(e.at)
    const row = index[keyOf(d) + '|' + d.getFullYear()]
    if (!row) continue
    row.total++
    if (e.ok) row.correct++
  }
  return out
}


// ---- 每日目標與連續天數 ----
// 一天玩滿 DAILY_GOAL 局（翻牌不算）就能開寶箱。日期都用當地時間的 'YYYY-MM-DD'，由呼叫的人傳進來，測試才好寫。
export const DAILY_GOAL = 10

export function dayKey (ms) {
  const d = new Date(ms)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}
function prevDay (key) {
  const [y, m, d] = key.split('-').map(Number)
  return dayKey(new Date(y, m - 1, d - 1).getTime())
}

// 今天的進度。連續天數要昨天或今天有玩才算數，中斷了顯示 0
export function dailyView (state, today) {
  const d = state.daily && state.daily.date === today ? state.daily : { date: today, rounds: 0, claimed: false }
  const st = state.streak || { last: null, count: 0 }
  const alive = st.last === today || st.last === prevDay(today)
  return { date: today, rounds: d.rounds, claimed: d.claimed, streak: alive ? st.count : 0 }
}

// 玩完一局：今天多一個腳印；今天第一局就更新連續天數
export function recordRound (state, today) {
  const s = withWallet(state)
  const d = dailyView(s, today)
  const st = s.streak
  const streak = st.last === today ? st : { last: today, count: st.last === prevDay(today) ? st.count + 1 : 1 }
  return { ...s, daily: { date: today, rounds: d.rounds + 1, claimed: d.claimed }, streak }
}

// 寶箱：30 根起跳，連續每多一天多 5 根，七天封頂 60
export function dailyBonus (streak) {
  return 30 + 5 * Math.min(Math.max(streak - 1, 0), 6)
}

// 開寶箱：蓋滿腳印、今天還沒開過才開得了
export function claimDaily (state, today) {
  const d = dailyView(state, today)
  if (d.claimed || d.rounds < DAILY_GOAL) return state
  return { ...addBones(state, dailyBonus(d.streak)), daily: { date: today, rounds: d.rounds, claimed: true } }
}

// 教學看過了
export function markSeen (state, kind) {
  const s = withWallet(state)
  return { ...s, seen: { ...s.seen, [kind]: true } }
}

// 今天推薦練哪一軌：今天答題數最少的那一軌；一樣少就照日子輪，每天換一軌
export function recommendTrack (state, today) {
  const counts = TRACKS.map(t => {
    const log = (state.tracks && state.tracks[t] && state.tracks[t].log) || []
    return log.filter(e => dayKey(e.at) === today).length
  })
  const min = Math.min(...counts)
  const [y, m, d] = today.split('-').map(Number)
  const dayNo = Math.floor(new Date(y, m - 1, d).getTime() / 86400000)
  const tied = TRACKS.filter((t, i) => counts[i] === min)
  return tied[dayNo % tied.length]
}

// ---- 骨頭照題目難度給：太簡單的題目給少一點 ----
// 第一次就答對：階級 0–1 給 1 根、2–3 給 2 根、4–5 給 3 根；
// 這個符號還不熟（0–1 顆星，包含第一次看到）多 1 根，已經很熟（4–5 顆星）少 1 根，最少 1 根。
// 錯了才答對：低階（0–1）不給，其他給 1 根。state 要傳這一軌的畫面（trackView），而且要在記錄這題之前算。
const TIER_BONES = [1, 1, 2, 2, 3, 3]
export function questionReward (state, target, first) {
  const tier = effectiveTier(state)
  if (!first) return tier >= 2 ? 1 : 0
  const s = stars(state, target)
  let n = TIER_BONES[tier]
  if (s <= 1) n += 1
  if (s >= 4) n -= 1
  return Math.max(1, n)
}

// 玩完一局的骨頭也照階級：低階 1 根、中階 2 根、高階 3 根
export function roundBonus (state) {
  return TIER_BONES[effectiveTier(state)]
}

// 連對獎勵也照階級：連 3 題多「一局獎勵」那麼多，連 5 題再多一根
export function comboBonus (state, combo) {
  const base = TIER_BONES[effectiveTier(state)]
  if (combo === 3) return base
  if (combo === 5) return base + 1
  return 0
}
