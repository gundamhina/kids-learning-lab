// 對戰：兩個人擠一台觸控螢幕（平板、觸控筆電），各答各的，先答對 N 題的贏。
// 版面兩種：左右各半（並排坐），面對面（平板平放，上半邊整個轉 180 度）。
// 每個人可以是既有的使用者（照自己的進度出題），也可以是客人（大人選程度 1～6）。
// 答錯照三級提示：錯一次搖一下，錯兩次起正解發亮。對戰不記練習紀錄，使用者玩完有骨頭（贏的多一點）。

import { dogSvg, bgHtml, symbolMarkup, wordPicMarkup, twemojiName, DOG_COLORS, confettiHtml, cardArt, UX_ICONS } from './art.js'
import { mountBgs } from './ui.js'
import { BATTLE_GAMES, battleGame, battleQuestion, guestLevel, profileLevel } from './battleq.js'
import { ODD_STYLE, analogyItem, triTile, AN_ARROW } from './braingames.js'
import { ENGLISH_ICON } from './english.js'
import { burstAt, buzz } from './fx.js'

const BATTLE_KEY = 'kids-learning-lab-battle'
const GOALS = [5, 8, 10]
const SUBJECT_NAMES = { zhuyin: '注音', math: '數學', english: '英文', brain: '動腦' }
export const BATTLE_WIN_BONES = 10
export const BATTLE_PLAY_BONES = 5

const VS_SVG = '<svg viewBox="0 0 48 48" width="56" height="56"><text x="24" y="33" text-anchor="middle" font-size="25" font-weight="900" fill="#fff" font-family="Arial Black, Arial, sans-serif">VS</text></svg>'
const HOME_SVG = '<svg viewBox="0 0 24 24" width="40" height="40" fill="#fff"><path d="M12 3 2 12h3v8h6v-6h2v6h6v-8h3z"/></svg>'
const AGAIN_SVG = '<svg viewBox="0 0 24 24" width="44" height="44" fill="#fff"><path d="M12 5V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z"/></svg>'
const CROWN_SVG = '<svg viewBox="0 0 64 44" width="150" height="103"><path d="M4 14l14 12L32 4l14 22 14-12-6 28H10z" fill="#F2C94C" stroke="#B8860B" stroke-width="3" stroke-linejoin="round"/><circle cx="32" cy="30" r="4" fill="#E07A5F"/></svg>'

// 怎麼坐：左右各半、上下面對面（上面那個人的臉倒過來）
const seatFace = (x, y, flip) => `<g transform="translate(${x} ${y})${flip ? ' rotate(180)' : ''}"><circle r="10" fill="#FFE08A" stroke="#2B3A4A" stroke-width="2.4"/><circle cx="-3.5" cy="-2" r="1.6" fill="#2B3A4A"/><circle cx="3.5" cy="-2" r="1.6" fill="#2B3A4A"/><path d="M-4 3q4 3.5 8 0" stroke="#2B3A4A" stroke-width="2" fill="none" stroke-linecap="round"/></g>`
const SEAT_LR = `<svg viewBox="0 0 96 64" width="96" height="64"><rect x="3" y="3" width="90" height="58" rx="8" fill="#fff" stroke="currentColor" stroke-width="4"/><path d="M48 6v52" stroke="currentColor" stroke-width="3" stroke-dasharray="5 4"/>${seatFace(25, 32)}${seatFace(71, 32)}</svg>`
const SEAT_FACE = `<svg viewBox="0 0 96 64" width="96" height="64"><rect x="3" y="3" width="90" height="58" rx="8" fill="#fff" stroke="currentColor" stroke-width="4"/><path d="M6 32h84" stroke="currentColor" stroke-width="3" stroke-dasharray="5 4"/>${seatFace(48, 17, true)}${seatFace(48, 47)}</svg>`
const PLAY_SVG = '<svg viewBox="0 0 24 24" width="40" height="40" fill="#fff"><path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 7 4.5z"/></svg>'
const SUBJECT_COLORS = { zhuyin: '#4A6FA5', math: '#D9844B', english: '#3F8F8C', brain: '#8A6FB0' }

function battleEsc (s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])) }
const emojiImg = icon => `<img class="bt-img" src="img/emoji/${twemojiName(icon)}.svg" alt="" draggable="false">`

function loadBattleSettings () {
  try { return JSON.parse(localStorage.getItem(BATTLE_KEY)) || {} } catch (e) { return {} }
}
function saveBattleSettings (s) {
  try { localStorage.setItem(BATTLE_KEY, JSON.stringify(s)) } catch (e) { /* 存不了就下次重選 */ }
}

// 平板或觸控螢幕才能對戰：要有觸控，而且不是手機（手機兩個人的手指擠不下）
export function canBattle () {
  if (new URLSearchParams(location.search).has('battle')) return true // 截圖、桌機測試用
  const touch = (navigator.maxTouchPoints || 0) > 0 || (window.matchMedia && window.matchMedia('(any-pointer: coarse)').matches)
  return touch && Math.min(window.innerWidth, window.innerHeight) >= 600
}

// ---- 畫題目、選項 ----
function promptHtml (q) {
  const p = q.prompt
  if (q.game === 'friend') return `<div class="bt-sign bt-symbol">${symbolMarkup(p.symbol)}</div>`
  if (q.game === 'zword') return `<div class="bt-sign bt-word w${p.word.split(' ').length}">${symbolMarkup(p.word)}</div>`
  if (q.game === 'count') return `<div class="bt-box bt-count">${itemsHtml(p.icon, p.points, p.points.length)}</div>`
  if (q.game === 'compare') return '<div class="bt-ask">哪邊多？</div>'
  if (q.game === 'letterpic') return `<div class="bt-sign bt-letter">${p.letter}<small>${p.letter.toLowerCase()}</small></div>`
  if (q.game === 'picletter') return `<div class="bt-sign bt-pic">${emojiImg(p.icon)}</div>`
  if (q.game === 'pattern') return `<div class="bt-row" style="--len:${p.row.length}">${p.row.map((icon, i) => i === p.blank ? '<span class="bt-cell bt-blank"></span>' : `<span class="bt-cell">${emojiImg(icon)}</span>`).join('')}</div>`
  if (q.game === 'analogy') return `<div class="bt-analogy"><span class="bt-cell">${analogyItem(p.a)}</span>${AN_ARROW}<span class="bt-cell">${analogyItem(p.b)}</span><span class="bt-gap"></span><span class="bt-cell">${analogyItem(p.c)}</span>${AN_ARROW}<span class="bt-cell bt-blank"></span></div>`
  if (q.game === 'tiles') {
    const board = (hole) => `<div class="bt-board" style="--bn:${p.n}">${p.board.map((o, i) => `<span class="bt-tcell${i === hole ? ' bt-hole' : ''}">${i === hole ? '' : triTile(o)}</span>`).join('')}</div>`
    return `<div class="bt-tiles">${board(-1)}${board(p.hole)}</div>`
  }
  return ''
}
// 東西照 0～1 的座標擺進框裡（座標由 mathq.scatter 算）；越多越小
// 框是正方形，大小、位置都用框的百分比
function itemsHtml (icon, points, n, scale = 1) {
  const s = (n <= 6 ? 24 : n <= 10 ? 19 : n <= 15 ? 15 : 13) * scale
  const pos = v => `clamp(2%, ${(v * 100 - s / 2).toFixed(1)}%, ${(98 - s).toFixed(1)}%)`
  return points.map(([x, y]) => `<span class="bt-item" style="left:${pos(x)};top:${pos(y)};width:${s}%;height:${s}%">${emojiImg(icon)}</span>`).join('')
}
function optionHtml (q, o) {
  if (q.game === 'friend' || q.game === 'zword') return `<span class="bt-pic">${wordPicMarkup(o)}</span>`
  if (q.game === 'letterpic') return `<span class="bt-pic">${emojiImg(ENGLISH_ICON[o])}</span>`
  if (q.game === 'picletter') return `<span class="bt-letter">${o}<small>${o.toLowerCase()}</small></span>`
  if (q.game === 'count') return `<span class="bt-num">${o}</span>`
  if (q.game === 'compare') return `<span class="bt-box">${itemsHtml(o.icon, o.points, 10, q.prompt.bigFewer && o.n < Math.max(...q.options.map(x => x.n)) ? 1.3 : 1)}</span>`
  if (q.game === 'pattern') return `<span class="bt-group n${o.length}">${o.map(emojiImg).join('')}</span>`
  if (q.game === 'odd') return `<img class="bt-img" src="img/emoji/${twemojiName(o.icon)}.svg" alt="" draggable="false"${o.kind && ODD_STYLE[o.kind] ? ` style="${ODD_STYLE[o.kind]}"` : ''}>`
  if (q.game === 'analogy') return analogyItem(o)
  if (q.game === 'tiles') return triTile(o)
  return ''
}

function playerName (pl) { return pl.guest ? `客人 ${'★'.repeat(pl.level)}` : pl.name }
function playerAvatar (pl) { return dogSvg(pl.color) }

// ---- 對戰畫面 ----
// opts：profiles（使用者清單）、currentId、loadState(id)、audio、onBones(id, n)、onExit()
export function openBattle (root, opts) {
  const saved = loadBattleSettings()
  const profiles = opts.profiles.list
  const findProfile = id => profiles.find(p => p.id === id)
  const asPlayer = x => {
    if (x && !x.guest && findProfile(x.id)) { const p = findProfile(x.id); return { id: p.id, name: p.name, color: p.color, adult: !!p.adult } }
    return { guest: true, level: x && x.level ? x.level : 3, color: x && typeof x.color === 'number' ? x.color : 3 }
  }
  const cfg = {
    game: battleGame(saved.game) ? saved.game : 'count',
    layout: saved.layout === 'face' ? 'face' : 'lr',
    goal: GOALS.includes(saved.goal) ? saved.goal : 5,
    players: [asPlayer(saved.players ? saved.players[0] : { id: opts.currentId }), asPlayer(saved.players ? saved.players[1] : null)],
  }
  // 第一個人沒存過就是現在選的人
  if (!saved.players && findProfile(opts.currentId)) cfg.players[0] = asPlayer({ id: opts.currentId })
  let timers = []
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t }
  const clearTimers = () => { timers.forEach(clearTimeout); timers = [] }

  function persist () {
    saveBattleSettings({ game: cfg.game, layout: cfg.layout, goal: cfg.goal, players: cfg.players.map(p => p.guest ? { guest: true, level: p.level, color: p.color } : { id: p.id }) })
  }

  // ---- 設定 ----
  // 橫的：左邊選人、怎麼坐、幾題、開始；右邊玩法（注音、數學、英文一排，動腦一排）。直的：由上往下排，開始在最下面
  function renderSetup () {
    clearTimers()
    const slot = i => {
      const pl = cfg.players[i]
      const seat = cfg.layout === 'face' ? (i === 0 ? '下面' : '上面') : (i === 0 ? '左邊' : '右邊')
      return `<button class="bt-slot" data-slot="${i}" style="--c:${DOG_COLORS[pl.color % DOG_COLORS.length].main}">
        <span class="bt-seat-tag">${seat}</span><span class="bt-slot-dog">${playerAvatar(pl)}</span>
        <b>${pl.guest ? '客人' : battleEsc(pl.name)}</b>${pl.guest ? `<small class="bt-stars">${'★'.repeat(pl.level)}</small>` : ''}</button>`
    }
    const subjects = Object.keys(SUBJECT_NAMES).map(s => `<div class="bt-subject" style="--sc:${SUBJECT_COLORS[s]}"><span class="bt-subject-name">${SUBJECT_NAMES[s]}</span><div class="bt-cards">${BATTLE_GAMES.filter(g => g.subject === s).map(g =>
      `<button class="bt-card ${g.key === cfg.game ? 'on' : ''}" data-game="${g.key}" aria-label="${g.name}"><span class="card-pic">${cardArt(g.card || g.key)}</span><small>${g.name}</small></button>`).join('')}</div></div>`).join('')
    root.innerHTML = bgHtml('home') + `<div class="bt-setup">
      <div class="bt-setup-top"><button class="round-btn bt-back" aria-label="回首頁">${HOME_SVG}</button><h2>對戰</h2></div>
      <div class="bt-side">
        <div class="bt-players">${slot(0)}<span class="bt-vs">${VS_SVG}</span>${slot(1)}</div>
        <div class="bt-fields">
          <div class="bt-field"><span class="bt-label">怎麼坐</span><div class="bt-choice-row">
            <button class="bt-seat ${cfg.layout === 'lr' ? 'on' : ''}" data-layout="lr">${SEAT_LR}<small>左右坐</small></button>
            <button class="bt-seat ${cfg.layout === 'face' ? 'on' : ''}" data-layout="face">${SEAT_FACE}<small>面對面</small></button></div></div>
          <div class="bt-field"><span class="bt-label">先答對幾題</span><div class="bt-choice-row">${GOALS.map(g => `<button class="bt-goal ${cfg.goal === g ? 'on' : ''}" data-goal="${g}">${g}</button>`).join('')}</div></div>
        </div>
      </div>
      <div class="bt-games">${subjects}</div>
      <button class="bt-start" aria-label="開始">${PLAY_SVG}開始</button>
    </div>`
    mountBgs(root)
    root.querySelector('.bt-back').addEventListener('pointerdown', opts.onExit)
    root.querySelector('.bt-start').addEventListener('pointerdown', () => { persist(); startMatch() })
    root.querySelectorAll('.bt-slot').forEach(b => b.addEventListener('pointerdown', () => openPicker(Number(b.dataset.slot))))
    const pick = (sel, fn) => root.querySelectorAll(sel).forEach(b => b.addEventListener('pointerdown', () => { fn(b); persist(); renderSetup() }))
    pick('.bt-card', b => { cfg.game = b.dataset.game })
    pick('.bt-seat', b => { cfg.layout = b.dataset.layout })
    pick('.bt-goal', b => { cfg.goal = Number(b.dataset.goal) })
  }

  // 選人：既有的使用者，或客人（選程度 1～6）。選了另一邊已經在用的人就兩邊對調
  function openPicker (i) {
    const other = cfg.players[1 - i]
    const box = document.createElement('div')
    box.className = 'bt-picker'
    box.innerHTML = `<div class="bt-picker-box">
      <div class="bt-picker-list">${profiles.map(p => `<button class="bt-pick" data-id="${p.id}"><span class="bt-slot-dog">${dogSvg(p.color)}</span><b>${battleEsc(p.name)}</b></button>`).join('')}</div>
      <div class="bt-guest"><b>客人</b>${[1, 2, 3, 4, 5, 6].map(l => `<button class="bt-level" data-level="${l}">${'★'.repeat(l)}</button>`).join('')}</div>
      <p class="bt-picker-note">客人的星星是程度：1 顆最簡單，6 顆最難。</p>
    </div>`
    root.appendChild(box)
    box.addEventListener('pointerdown', e => {
      const pick = e.target.closest('.bt-pick')
      const lv = e.target.closest('.bt-level')
      if (!pick && !lv) { if (e.target === box) box.remove(); return }
      const next = pick ? asPlayer({ id: pick.dataset.id }) : { guest: true, level: Number(lv.dataset.level), color: other.guest ? (other.color + 2) % 6 : (cfg.players[i].guest ? cfg.players[i].color : 3) }
      if (!next.guest && !other.guest && other.id === next.id) cfg.players[1 - i] = cfg.players[i]
      cfg.players[i] = next
      persist()
      renderSetup()
    })
  }

  // ---- 比賽 ----
  function startMatch () {
    clearTimers()
    const game = cfg.game
    const lanes = cfg.players.map((pl, i) => ({
      i, pl, score: 0, q: null, wrongs: 0, locked: true,
      lvl: pl.guest ? guestLevel(pl.level) : profileLevel(opts.loadState(pl.id)),
    }))
    let over = false
    const laneHtml = l => `<div class="bt-lane" data-lane="${l.i}" style="--c:${DOG_COLORS[l.pl.color % DOG_COLORS.length].main}">
      <div class="bt-head"><span class="bt-head-dog">${playerAvatar(l.pl)}</span><b>${battleEsc(playerName(l.pl))}</b>
        <span class="bt-paws">${Array.from({ length: cfg.goal }, () => `<span class="paw">${UX_ICONS.paw}</span>`).join('')}</span></div>
      <div class="bt-body ${game === 'odd' ? 'no-prompt' : ''}" data-game="${game}"><div class="bt-prompt"></div><div class="bt-choices"></div></div>
      <div class="bt-cover"><span class="bt-count-num"></span></div>
    </div>`
    root.innerHTML = bgHtml('room') + `<div class="bt-match ${cfg.layout}">${laneHtml(lanes[0])}${laneHtml(lanes[1])}
      <div class="bt-mid"><button class="round-btn bt-quit" aria-label="結束">${HOME_SVG}</button></div></div>`
    mountBgs(root)
    lanes.forEach(l => { l.el = root.querySelector(`.bt-lane[data-lane="${l.i}"]`) })
    const quit = root.querySelector('.bt-quit')
    // 離開要按兩下（小孩手肘很容易碰到中間）：第一下變紅，2 秒內再按才離開
    quit.addEventListener('pointerdown', () => {
      if (over) return
      if (quit.classList.contains('armed')) { clearTimers(); renderSetup(); return }
      quit.classList.add('armed')
      later(() => quit.classList.remove('armed'), 2000)
    })

    function ask (l) {
      l.q = battleQuestion(game, l.lvl, Math.random, l.q)
      l.wrongs = 0
      const body = l.el.querySelector('.bt-body')
      body.querySelector('.bt-prompt').innerHTML = promptHtml(l.q)
      const choices = body.querySelector('.bt-choices')
      choices.style.setProperty('--n', l.q.options.length)
      choices.className = `bt-choices n${l.q.options.length}`
      choices.innerHTML = l.q.options.map((o, k) => `<button class="bt-opt" data-k="${k}">${optionHtml(l.q, o)}</button>`).join('')
      l.locked = false
    }
    function tap (l, k, btn) {
      if (over || l.locked || btn.classList.contains('right')) return
      if (k === l.q.answer) {
        l.locked = true
        btn.classList.add('right')
        l.score++
        const paw = l.el.querySelectorAll('.bt-paws .paw')[l.score - 1]
        if (paw) paw.classList.add('on')
        burstAt(btn)
        opts.audio.ding()
        buzz(25)
        if (l.score >= cfg.goal) return finish(l)
        later(() => { if (!over) ask(l) }, 650)
        return
      }
      // 答錯：搖一下；錯兩次起正解發亮。停一下下才能再點，亂點不划算
      l.wrongs++
      btn.classList.remove('shake')
      void btn.offsetWidth
      btn.classList.add('shake')
      opts.audio.wrong()
      buzz([40, 60, 40])
      if (l.wrongs >= 2) {
        const right = l.el.querySelector(`.bt-opt[data-k="${l.q.answer}"]`)
        if (right) right.classList.add('answer-glow')
      }
      l.locked = true
      later(() => { l.locked = false }, 500)
    }
    lanes.forEach(l => l.el.querySelector('.bt-choices').addEventListener('pointerdown', e => {
      const b = e.target.closest('.bt-opt')
      if (b) tap(l, Number(b.dataset.k), b)
    }))

    function finish (winner) {
      over = true
      lanes.forEach(l => { l.locked = true })
      opts.audio.fanfare()
      buzz([60, 40, 120])
      for (const l of lanes) {
        const won = l === winner
        const bones = l.pl.guest || l.pl.adult ? 0 : won ? BATTLE_WIN_BONES : BATTLE_PLAY_BONES
        if (bones) opts.onBones(l.pl.id, bones)
        const cover = l.el.querySelector('.bt-cover')
        cover.className = 'bt-cover show ' + (won ? 'win' : 'lose')
        cover.innerHTML = (won ? `<div class="bt-crown">${CROWN_SVG}</div>${confettiHtml(30)}` : '') +
          `<div class="bt-result-dog">${playerAvatar(l.pl)}</div><b class="bt-result-word">${won ? '贏了！' : '好棒！'}</b>` +
          (bones ? `<span class="bt-result-bones">＋${bones} 根骨頭</span>` : '')
      }
      const mid = root.querySelector('.bt-mid')
      mid.classList.add('done')
      mid.innerHTML = `<button class="round-btn bt-again" aria-label="再一場">${AGAIN_SVG}</button><button class="round-btn bt-quit" aria-label="回設定">${HOME_SVG}</button>`
      mid.querySelector('.bt-again').addEventListener('pointerdown', startMatch)
      mid.querySelector('.bt-quit').addEventListener('pointerdown', renderSetup)
    }

    // 3、2、1 開始：兩邊同時出第一題
    const covers = lanes.map(l => l.el.querySelector('.bt-cover'))
    const countdown = n => {
      covers.forEach(c => { c.className = 'bt-cover show counting'; c.querySelector('.bt-count-num').textContent = n })
      opts.audio.tick()
      if (n > 1) later(() => countdown(n - 1), 700)
      else later(() => { covers.forEach(c => { c.className = 'bt-cover' }); opts.audio.ding(); lanes.forEach(ask) }, 700)
    }
    if (game === 'compare') opts.audio.sayText('點東西比較多的那一邊')
    later(() => countdown(3), game === 'compare' ? 1600 : 300)
  }

  renderSetup()
  return { destroy () { clearTimers(); root.innerHTML = '' } }
}
