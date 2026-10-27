// 選人、首頁、結算、大人面板、舞台縮放。

import { GROUPS, REP_CHAR, GROUP_NAMES, WORD_TEXT } from './data.js'
import { stars, activePool, effectiveTier, unlockedCount, lifetimeStats, dailyStats, TIERS, TRACKS, TRACK_NAMES } from './scheduler.js'
import { dogSvg, confettiHtml, DOG_COLORS, bgHtml, cardArt, boneSvg, SHOP_ICONS, UX_ICONS, DOG_NAMES } from './art.js'


// 舞台會跟著螢幕比例變形，所以不留邊：
//   橫的：高固定 800，寬照螢幕比例 1200～1800。畫面元素排在正中央 1200×800 的 .frame 裡，背景鋪滿整個舞台。
//   直的：寬固定 800，高照螢幕比例 1100～1800。.frame 就是整個舞台，各畫面另有直版排法（#stage.portrait）。
// 舞台大小放在 STAGE，也寫成 CSS 變數 --W、--H 給樣式用。
export const STAGE = { w: 1200, h: 800, portrait: false }

export function fitStage (stage) {
  const vv = window.visualViewport
  const vw = vv ? vv.width : window.innerWidth
  const vh = vv ? vv.height : window.innerHeight
  const portrait = vh > vw
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
  const W = portrait ? 800 : Math.round(clamp(800 * vw / vh, 1200, 1800))
  const H = portrait ? Math.round(clamp(800 * vh / vw, 1100, 1800)) : 800
  const changed = W !== STAGE.w || H !== STAGE.h || portrait !== STAGE.portrait
  STAGE.w = W
  STAGE.h = H
  STAGE.portrait = portrait
  stage.style.width = W + 'px'
  stage.style.height = H + 'px'
  stage.style.setProperty('--W', W + 'px')
  stage.style.setProperty('--H', H + 'px')
  stage.classList.toggle('portrait', portrait)
  const scale = Math.min(vw / W, vh / H)
  const x = (vw - W * scale) / 2
  const y = (vh - H * scale) / 2
  stage.style.transform = `translate(${x}px, ${y}px) scale(${scale})`
  return changed
}

// 背景層定位。橫的：放大到填滿舞台、貼底（碼頭那張靠左，其他置中）。
// 直的：草原一樣蓋滿（放大到填滿高度，左右裁掉）；碼頭那張要留住碼頭和狗狗的比例，
// 所以只放大到占畫面下半（至少填滿寬），貼左下，上面由 .bg-fill 的天空色補。縮放結果記在 dataset 給釣魚算竿尖用。
export function layoutBg (el) {
  const art = el.querySelector('.bg-art')
  if (!art) return
  const { w: W, h: H, portrait } = STAGE
  let s, x, y
  if (portrait && el.dataset.fit === 'left') {
    // 螢幕越高，碼頭放得越大（1100 高時剛好填滿寬，1800 高時放大到 1.3 倍）
    s = Math.max(W / 1200, 0.667 + (H - 1100) / 700 * 0.633)
    x = 0
    y = H - 800 * s
  } else if (portrait) {
    s = H / 800
    x = (W - 1200 * s) / 2
    y = 0
  } else {
    s = Math.max(W / 1200, H / 800)
    y = H - 800 * s
    x = el.dataset.fit === 'left' ? 0 : (W - 1200 * s) / 2
  }
  art.style.transform = `translate(${x}px, ${y}px) scale(${s})`
  art.dataset.s = s
  art.dataset.x = x
  art.dataset.y = y
}
export function mountBgs (root) {
  root.querySelectorAll('.bg').forEach(layoutBg)
}

// 螢幕座標換成舞台座標（1200×800 那套），縮放、旋轉都算進去。拖曳、畫字都用這個。
export function stagePoint (e) {
  const stage = document.getElementById('stage')
  const m = new DOMMatrix(getComputedStyle(stage).transform)
  const p = m.inverse().transformPoint(new DOMPoint(e.clientX, e.clientY))
  return [p.x, p.y]
}

// 螢幕座標換成某個 .frame 裡的座標（橫的時候 frame 不在舞台左上角）
export function framePoint (e, frame) {
  const [x, y] = stagePoint(e)
  return [x - frame.offsetLeft, y - frame.offsetTop]
}

// 元素在舞台裡的位置（不含 transform），一路加 offsetLeft/offsetTop 到舞台
export function stageOffset (el) {
  let x = 0
  let y = 0
  // offsetLeft 是從外層的框線裡面算起，所以每往外一層要把那層的框線（clientLeft／clientTop）加回去
  for (let n = el; n && n.id !== 'stage'; n = n.offsetParent) {
    x += n.offsetLeft
    y += n.offsetTop
    const p = n.offsetParent
    if (p && p.id !== 'stage') { x += p.clientLeft; y += p.clientTop }
  }
  return [x, y]
}

// 手機：第一次點的時候進全螢幕並鎖橫向（要在使用者手勢裡呼叫；iPhone 不支援就算了）
let fullscreenPending = false
export function goFullscreenOnPhone () {
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches
  const standalone = window.matchMedia && window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches
  if (!coarse || standalone || fullscreenPending || document.fullscreenElement || !document.documentElement.requestFullscreen) return
  fullscreenPending = true
  document.documentElement.requestFullscreen({ navigationUI: 'hide' }).then(() => {
    if (screen.orientation && screen.orientation.lock) return screen.orientation.lock('landscape')
  }).catch(() => {}).finally(() => { fullscreenPending = false })
}

// 換畫面：新畫面疊在舊畫面上面淡入，舊的等淡入完才藏起來。以前是從全透明淡入，中間會露出後面的深色底，看起來像閃一下
export function showScreen (name) {
  const next = document.getElementById('screen-' + name)
  document.querySelectorAll('.screen').forEach(el => {
    if (el === next || !el.classList.contains('active')) return
    el.classList.remove('active')
    el.classList.add('leaving')
    clearTimeout(el._leave)
    el._leave = setTimeout(() => el.classList.remove('leaving'), 320)
  })
  if (next) { next.classList.remove('leaving'); next.classList.add('active') }
}

// 手繪圖插槽：<img> 載入好才把底下的向量圖藏起來（onload 加 has-art）。
// 畫面每重畫一次 onload 都要等一下才觸發，中間會先露出向量圖再換成手繪圖，看起來像閃一下。
// 瀏覽器快取裡的圖一放進去就 complete，在畫出來之前（MutationObserver 的時間點）先補上 has-art 就不會閃。
export function watchArtSlots () {
  const stage = document.getElementById('stage')
  if (!stage || typeof MutationObserver === 'undefined') return
  const mark = img => { if (img.complete && img.naturalWidth && img.parentElement) img.parentElement.classList.add('has-art') }
  new MutationObserver(list => {
    for (const m of list) {
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue
        if (n.matches('img.art-slot')) mark(n)
        n.querySelectorAll('img.art-slot').forEach(mark)
      }
    }
  }).observe(stage, { childList: true, subtree: true })
}

const GEAR_SVG = `<svg viewBox="0 0 24 24" width="40" height="40" fill="#fff"><path d="M19.4 13a7.6 7.6 0 0 0 .1-1 7.6 7.6 0 0 0-.1-1l2.1-1.6a.5.5 0 0 0 .1-.6l-2-3.5a.5.5 0 0 0-.6-.2l-2.5 1a7.3 7.3 0 0 0-1.7-1l-.4-2.6a.5.5 0 0 0-.5-.4h-4a.5.5 0 0 0-.5.4l-.4 2.6a7.3 7.3 0 0 0-1.7 1l-2.5-1a.5.5 0 0 0-.6.2l-2 3.5a.5.5 0 0 0 .1.6L4.6 11a7.6 7.6 0 0 0-.1 1 7.6 7.6 0 0 0 .1 1l-2.1 1.6a.5.5 0 0 0-.1.6l2 3.5a.5.5 0 0 0 .6.2l2.5-1a7.3 7.3 0 0 0 1.7 1l.4 2.6a.5.5 0 0 0 .5.4h4a.5.5 0 0 0 .5-.4l.4-2.6a7.3 7.3 0 0 0 1.7-1l2.5 1a.5.5 0 0 0 .6-.2l2-3.5a.5.5 0 0 0-.1-.6L19.4 13zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/></svg>`

// 選人畫面：每人一張卡（狗狗頭像＋名字），最後一張是「＋」
export function renderProfiles (root, { profiles, onPick, onAdd, onGear }) {
  root.innerHTML = `
    ${bgHtml('home')}
    <div class="profiles">
      ${profiles.list.map(p => `
        <button class="profile-card ${p.adult ? 'adult' : ''}" data-id="${p.id}" aria-label="${p.name}">
          <div class="profile-avatar" style="background:${DOG_COLORS[p.color % DOG_COLORS.length].main}22">${dogSvg(p.color)}</div>
          <div class="profile-name">${escapeHtml(p.name)}</div>
          ${p.adult ? '<div class="profile-badge">老師</div>' : ''}
        </button>`).join('')}
      <button class="profile-card add" id="btn-add-profile" aria-label="新增">
        <div class="profile-plus">＋</div>
      </button>
    </div>
    <div class="profile-form hidden" id="profile-form">
      <div class="profile-form-box">
        <div class="color-pick">${DOG_COLORS.map((c, i) => `
          <button class="color-dot ${i === 0 ? 'on' : ''}" data-color="${i}" style="background:${c.main}"></button>`).join('')}
        </div>
        <input id="profile-name" maxlength="6" placeholder="名字">
        <div class="kind-pick">
          <button class="kind-btn on" data-kind="kid">小孩</button>
          <button class="kind-btn" data-kind="adult">老師（投影）</button>
        </div>
        <div class="profile-form-actions">
          <button id="profile-cancel">取消</button>
          <button id="profile-ok" class="primary">好</button>
        </div>
      </div>
    </div>
    <button class="gear" id="btn-gear" aria-label="大人面板">${GEAR_SVG}</button>`
  mountBgs(root)

  // 老師帳號要 2 秒內連點三下才進得去，免得小孩自己點進去改難度；每點一下顯示還差幾下
  const taps = {}
  root.querySelectorAll('.profile-card[data-id]').forEach(b => {
    b.addEventListener('pointerdown', () => {
      if (!b.classList.contains('adult')) { onPick(b.dataset.id); return }
      const now = Date.now()
      taps[b.dataset.id] = (taps[b.dataset.id] || []).filter(t => now - t < 2000).concat(now)
      const left = 3 - taps[b.dataset.id].length
      if (left <= 0) { taps[b.dataset.id] = []; onPick(b.dataset.id); return }
      const badge = b.querySelector('.profile-badge')
      badge.textContent = '再點 ' + left + ' 下'
      clearTimeout(b._hint)
      b._hint = setTimeout(() => { badge.textContent = '老師' }, 2000)
    })
  })
  let adult = false
  root.querySelectorAll('.kind-btn').forEach(k => {
    k.onclick = () => {
      adult = k.dataset.kind === 'adult'
      root.querySelectorAll('.kind-btn').forEach(x => x.classList.toggle('on', x === k))
    }
  })
  const form = root.querySelector('#profile-form')
  let color = 0
  root.querySelector('#btn-add-profile').addEventListener('pointerdown', () => {
    form.classList.remove('hidden')
    root.querySelector('#profile-name').focus()
  })
  root.querySelectorAll('.color-dot').forEach(d => {
    d.onclick = () => {
      color = parseInt(d.dataset.color, 10)
      root.querySelectorAll('.color-dot').forEach(x => x.classList.toggle('on', x === d))
    }
  })
  root.querySelector('#profile-cancel').onclick = () => form.classList.add('hidden')
  root.querySelector('#profile-ok').onclick = () => {
    const name = root.querySelector('#profile-name').value.trim()
    if (!name) return
    onAdd({ name, color, adult })
  }
  root.querySelector('#btn-gear').addEventListener('pointerdown', onGear)
}

// 首頁：目前使用者的狗狗、三張玩法卡
// daily = { rounds, claimed, streak, goal }；recommend = 推薦的玩法；musicOn = 背景音樂開著沒
// teacher = { tier, range, whack }：老師帳號，首頁上方換成難度、範圍和打地鼠速度，沒有骨頭、寶箱、商店、隊員
// partner：出任務的隊員（顏色）；team：自己原本那位加上買回家的隊員，首頁下方一排，點誰誰出任務
export function renderHome (root, { profile, speech = true, bones = 0, partner = null, team = [], daily = null, recommend = null, musicOn = true, teacher = null }) {
  const me = partner == null ? profile.color : partner
  const d = daily || { rounds: 0, claimed: false, streak: 0, goal: 10 }
  const chestState = d.claimed ? 'claimed' : d.rounds >= d.goal ? 'ready' : 'locked'
  const paws = Array.from({ length: d.goal }, (_, i) => `<span class="paw ${i < d.rounds ? 'on' : ''}">${UX_ICONS.paw}</span>`).join('')
  root.innerHTML = `
    ${bgHtml('home')}
    <button class="who" id="btn-who" aria-label="換人">
      <div class="who-avatar">${dogSvg(me)}</div>
      <div class="who-name">${escapeHtml(profile.name)}</div>
    </button>
    ${teacher ? teacherBarHtml(teacher) : `<button class="shop-btn" id="btn-shop" aria-label="商店"><span class="bone-ic">${boneSvg()}</span><b>${bones}</b><span class="shop-word">${SHOP_ICONS.bag}</span></button>`}
    <div class="daily ${teacher ? 'hidden' : ''}" id="daily">
      <div class="streak ${d.streak ? '' : 'cold'}" title="連續 ${d.streak} 天">${UX_ICONS.flame}<b>${d.streak}</b></div>
      <div class="paws" title="今天玩了 ${Math.min(d.rounds, d.goal)} 局">${paws}</div>
      <button class="chest ${chestState}" id="btn-chest" aria-label="寶箱" ${chestState === 'ready' ? '' : 'disabled'}>${UX_ICONS.chest}</button>
    </div>
    <button class="music-btn ${musicOn ? '' : 'off'}" id="btn-music" aria-label="背景音樂">${musicOn ? UX_ICONS.musicOn : UX_ICONS.musicOff}</button>
    ${homeCardsHtml({ speech, teacher })}
    <div class="mates home-mates">${teacher || team.length < 2 ? '' : team.map(c => `<button class="mate ${c === me ? 'on' : ''}" data-partner="${c}" aria-label="${DOG_NAMES[c]}出任務">${dogSvg(c, { mate: c !== me })}</button>`).join('')}</div>
    <button class="gear" id="btn-gear" aria-label="大人面板">${GEAR_SVG}</button>`
  mountBgs(root)
  bindCategories(root)
  // 今天推薦：那張卡發光、角落蓋一個腳印；手機兩層時，它所在的類別卡也蓋一個
  if (!teacher && recommend) {
    const stamp = el => {
      el.classList.add('recommend')
      const badge = document.createElement('span')
      badge.className = 'rec-badge'
      badge.innerHTML = UX_ICONS.paw
      el.appendChild(badge)
    }
    root.querySelectorAll(`.card[data-game="${recommend}"]`).forEach(stamp)
    const cat = CATEGORIES.find(c => c.games.includes(recommend))
    const tile = cat && root.querySelector(`.cat-tile[data-cat="${cat.key}"]`)
    if (tile) stamp(tile)
  }
}

// ---- 首頁的玩法分類：聽、看、寫、說 ----
// 小孩不識字，類別靠圖示和顏色分。網頁（筆電）一層：同一頁分四區；手機兩層：先選類別再選玩法。
export const CATEGORIES = [
  { key: 'listen', name: '聽', color: '#4A6FA5', games: ['fishing', 'whack', 'memory'] },
  { key: 'look', name: '看', color: '#5E9A6B', games: ['friend', 'match', 'fill', 'tone'] },
  { key: 'write', name: '寫', color: '#D9844B', games: ['chart', 'learn', 'write', 'spell'] },
  { key: 'speak', name: '說', color: '#C8553D', games: ['speak'] },
]
const CAT_ICONS = {
  listen: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 9a5 5 0 1 1 10 0c0 3-2.5 4-3 6.5-.4 2-1.8 3.5-4 3.5"/><path d="M10 9.5a2 2 0 1 1 4 0c0 1.3-1.3 1.8-1.5 3"/></svg>',
  look: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3.2" fill="#fff"/></svg>',
  write: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l1.2-4.4L16.4 4.4a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L8.4 18.8z"/><path d="M14.5 6.3l3.2 3.2"/></svg>',
  speak: '<svg viewBox="0 0 24 24" fill="#fff"><path d="M12 15a4 4 0 0 0 4-4V6a4 4 0 1 0-8 0v5a4 4 0 0 0 4 4zm6-4a6 6 0 0 1-12 0H4a8 8 0 0 0 7 7.9V22h2v-3.1A8 8 0 0 0 20 11h-2z"/></svg>',
}
const BACK_SVG = '<svg viewBox="0 0 24 24" width="44" height="44" fill="#fff"><path d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z"/></svg>'
// 手機：短邊不到 600、手指操作。筆電（Surface 也是觸控但螢幕大）用一層
export function isPhone () {
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches
  return coarse && Math.min(window.innerWidth, window.innerHeight) < 600
}
let openCategory = null // 手機兩層：從遊戲回來時留在剛剛那一類
function gameCardHtml (game) {
  return `<button class="card" data-game="${game}" aria-label="${GAME_NAMES[game]}"><div class="card-pic">${cardArt(game)}</div></button>`
}
function homeCardsHtml ({ speech, teacher }) {
  const hidden = teacher ? teacher.hidden || [] : []
  const visible = g => !(g === 'speak' && !speech) && !hidden.includes(g)
  const cats = CATEGORIES.map(c => ({ ...c, games: c.games.filter(visible) })).filter(c => c.games.length)
  if (!isPhone()) {
    return `<div class="cards cat-grid" id="cards">${cats.map(c => `
      <div class="cat-block" style="--cat:${c.color}">
        <div class="cat-head" title="${c.name}">${CAT_ICONS[c.key]}<b>${c.name}</b></div>
        <div class="cat-cards">${c.games.map(gameCardHtml).join('')}</div>
      </div>`).join('')}</div>`
  }
  if (openCategory && !cats.some(c => c.key === openCategory && c.games.length > 1)) openCategory = null
  // 只有一個玩法的類別（說），類別卡本身就是那個玩法
  const tile = c => c.games.length === 1
    ? `<button class="cat-tile" data-cat="${c.key}" data-game="${c.games[0]}" style="--cat:${c.color}" aria-label="${GAME_NAMES[c.games[0]]}">${CAT_ICONS[c.key]}<b>${c.name}</b></button>`
    : `<button class="cat-tile" data-cat="${c.key}" data-open="${c.key}" style="--cat:${c.color}" aria-label="${c.name}">${CAT_ICONS[c.key]}<b>${c.name}</b></button>`
  return `<div class="cards cat-menu ${openCategory ? 'hidden' : ''}" id="cards">${cats.map(tile).join('')}</div>
    ${cats.filter(c => c.games.length > 1).map(c => `
    <div class="cards cat-sub ${openCategory === c.key ? '' : 'hidden'}" data-sub="${c.key}" style="--cat:${c.color}">
      <div class="cat-sub-top"><button class="round-btn cat-back" aria-label="回類別">${BACK_SVG}</button><div class="cat-sub-head">${CAT_ICONS[c.key]}</div></div>
      <div class="cat-sub-cards">${c.games.map(gameCardHtml).join('')}</div>
    </div>`).join('')}`
}
// 手機兩層：點類別打開、點返回回到類別
function bindCategories (root) {
  const menu = root.querySelector('.cat-menu')
  if (!menu) return
  root.querySelectorAll('[data-open]').forEach(t => t.addEventListener('pointerdown', () => {
    openCategory = t.dataset.open
    menu.classList.add('hidden')
    root.querySelectorAll('.cat-sub').forEach(s => s.classList.toggle('hidden', s.dataset.sub !== openCategory))
  }))
  root.querySelectorAll('.cat-back').forEach(b => b.addEventListener('pointerdown', () => {
    openCategory = null
    root.querySelectorAll('.cat-sub').forEach(s => s.classList.add('hidden'))
    menu.classList.remove('hidden')
  }))
}

export function renderResult (root, color = 0, { roundBones = 0, bones = 0, mates = [], daily = null, perfect = false, teacher = false } = {}) {
  root.innerHTML = `
    ${bgHtml('home')}
    <div class="result-burst"></div>
    <div class="confetti-wrap">${confettiHtml()}</div>
    <div class="result-dogs ${mates.length >= 3 ? 'many' : ''}">${dogSvg(color)}${mates.map(c => dogSvg(c, { mate: true })).join('')}</div>
    <div class="result-stars">${'<span class="star">★</span>'.repeat(5)}</div>
    ${teacher ? '' : `<div class="result-bones" id="result-bones" data-gain="${roundBones}" data-total="${bones}"><span class="bone-ic">${boneSvg()}</span> +<b class="rb-gain">0</b>　<small>共 <span class="rb-total">${bones - roundBones}</span></small></div>`}
    ${perfect ? `<div class="result-crown" id="result-crown">${UX_ICONS.crown}</div>` : ''}
    ${daily ? `<div class="result-daily">${Array.from({ length: daily.goal }, (_, i) => `<span class="paw ${i < daily.rounds - 1 ? 'on' : ''} ${i === daily.rounds - 1 ? 'new' : ''}">${UX_ICONS.paw}</span>`).join('')}${daily.rounds >= daily.goal && !daily.claimed ? `<span class="chest ready">${UX_ICONS.chest}</span>` : ''}</div>` : ''}
    <div class="result-actions hidden" id="result-actions">
      <button class="round-btn" id="btn-again" aria-label="再玩一次">
        <svg viewBox="0 0 24 24" width="64" height="64" fill="#fff"><path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/></svg>
      </button>
      <button class="round-btn home" id="btn-home" aria-label="回首頁">
        <svg viewBox="0 0 24 24" width="64" height="64" fill="#fff"><path d="M12 3 2 12h3v8h6v-6h2v6h6v-8h3z"/></svg>
      </button>
    </div>`
  mountBgs(root)
}

// 結算動畫：星星一顆顆亮，接著骨頭數字往上跳、今天的腳印蓋上去，全對的話皇冠掉下來；3 秒後出按鈕
export function playResult (root, earned, { onTick = () => {}, onPerfect = () => {}, onPaw = () => {} } = {}) {
  const starEls = root.querySelectorAll('.result-stars .star')
  starEls.forEach(s => s.classList.remove('lit'))
  earned.forEach((ok, i) => {
    if (!ok) return
    setTimeout(() => starEls[i].classList.add('lit'), 400 + i * 350)
  })
  root.querySelector('#result-actions').classList.add('hidden')
  const bonesEl = root.querySelector('#result-bones')
  const starsDone = 400 + earned.length * 350 + 300
  if (bonesEl) {
    setTimeout(() => {
      bonesEl.classList.add('show')
      const gainN = parseInt(bonesEl.dataset.gain, 10) || 0
      const total = parseInt(bonesEl.dataset.total, 10) || 0
      const gainEl = bonesEl.querySelector('.rb-gain')
      const totalEl = bonesEl.querySelector('.rb-total')
      const steps = Math.min(gainN, 20)
      for (let i = 1; i <= steps; i++) {
        setTimeout(() => {
          const v = Math.round(gainN * i / steps)
          gainEl.textContent = v
          totalEl.textContent = total - gainN + v
          onTick()
        }, i * 60)
      }
    }, starsDone)
  }
  const paw = root.querySelector('.result-daily .paw.new')
  if (paw) setTimeout(() => { paw.classList.add('on', 'stamp'); onPaw() }, starsDone + 1400)
  const crown = root.querySelector('#result-crown')
  if (crown) setTimeout(() => { crown.classList.add('show'); onPerfect(crown) }, starsDone + 700)
  setTimeout(() => root.querySelector('#result-actions').classList.remove('hidden'), 3000)
}

// 第 14 組起有名字（聲母組＋韻類），前面的組顯示符號本身
// ---- 老師帳號：首頁上方的難度和範圍 ----
function groupLabel (i, g) { return g.length > 8 || i >= 10 ? groupName(i, g).trim() : g.join('') }
function rangeSummary (range) {
  if (!range.length) return '還沒選'
  const names = range.slice(0, 2).map(i => groupLabel(i, GROUPS[i]))
  return names.join('、') + (range.length > 2 ? ` 等 ${range.length} 組` : '')
}
function teacherBarHtml ({ tier, range, whack = 1 }) {
  return `<div class="teacher-bar">
    <span class="tb-label">難度</span>
    ${[0, 1, 2, 3, 4, 5].map(t => `<button class="tier-btn ${t === tier ? 'on' : ''}" data-tier="${t}" title="${tierLabel(TIERS[t])}">${t + 1}</button>`).join('')}
    <button class="range-btn" id="btn-range"><span class="tb-label">範圍</span> ${escapeHtml(rangeSummary(range))}</button>
    <span class="tb-label tb-whack">地鼠</span>
    ${['慢', '中', '快'].map((name, i) => `<button class="tier-btn ${i === whack ? 'on' : ''}" data-whack="${i}" title="打地鼠速度">${name}</button>`).join('')}
  </div>`
}

// 範圍挑選：跟家長區一樣分三頁，勾好按「好」。回呼 onDone(索引陣列)
export function openRangePicker (root, { range = [], onDone }) {
  let page = 'symbols'
  const picked = new Set(range)
  const wrap = document.createElement('div')
  wrap.className = 'range-picker'
  root.appendChild(wrap)
  const draw = () => {
    wrap.innerHTML = `<div class="rp-box">
      <div class="rp-tabs">${Object.keys(PAGE_NAMES).map(p => `<button class="track-tab ${p === page ? 'on' : ''}" data-page="${p}">${PAGE_NAMES[p]}</button>`).join('')}
        <button class="rp-clear" id="rp-clear">這頁全不選</button><button class="rp-all" id="rp-all">這頁全選</button></div>
      <div class="rp-groups">${GROUPS.map((g, i) => pageOf(i, g) !== page ? '' : `
        <label class="rp-group ${picked.has(i) ? 'on' : ''}"><input type="checkbox" data-g="${i}" ${picked.has(i) ? 'checked' : ''}> ${i + 1}. ${escapeHtml(groupLabel(i, g))}</label>`).join('')}</div>
      <div class="rp-foot"><span>已選 ${picked.size} 組</span><button class="primary" id="rp-ok" ${picked.size ? '' : 'disabled'}>好</button></div>
    </div>`
    wrap.querySelectorAll('[data-page]').forEach(b => { b.onclick = () => { page = b.dataset.page; draw() } })
    wrap.querySelectorAll('[data-g]').forEach(cb => {
      cb.onchange = () => { const i = parseInt(cb.dataset.g, 10); if (cb.checked) picked.add(i); else picked.delete(i); draw() }
    })
    const onPage = () => GROUPS.map((g, i) => i).filter(i => pageOf(i, GROUPS[i]) === page)
    wrap.querySelector('#rp-all').onclick = () => { onPage().forEach(i => picked.add(i)); draw() }
    wrap.querySelector('#rp-clear').onclick = () => { onPage().forEach(i => picked.delete(i)); draw() }
    wrap.querySelector('#rp-ok').onclick = () => { wrap.remove(); onDone([...picked].sort((a, b) => a - b)) }
  }
  draw()
}

// 組太長時顯示組名：第 11–13 組是結合韻，第 14 組起用 syllables.js 產生的組名；都沒有就列出全部符號
const COMPOUND_NAMES = { 10: 'ㄧ結合韻', 11: 'ㄨ結合韻', 12: 'ㄩ結合韻' }
function groupName (i, g) {
  const n = i >= 13 ? GROUP_NAMES[i - 13] : COMPOUND_NAMES[i]
  return ' ' + (n ? n + '（' + g.length + ' 個）' : g.join(''))
}

function starColor (n) {
  if (n >= 4) return 'green'
  if (n >= 2) return 'yellow'
  return 'red'
}

function escapeHtml (s) {
  return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
}

// 大人面板：目前使用者的熟練度色塊、已經認得、試聽設定、匯出匯入、刪除使用者
const DISTRACT_LABEL = { random: '隨機', shape: '形似', sound: '音似' }
function tierLabel (t) {
  const idle = t.idleHint ? `發呆 ${t.idleHint} 秒才提示` : '不提示'
  const sim = t.similar >= 1 ? `一定放${DISTRACT_LABEL[t.distract]}干擾` : `${Math.round(t.similar * 10)} 成機率放形似音似干擾`
  return `${t.options} 選項、${sim}、${idle}`
}

// 兩段式確認：第一下按鈕變成確認文字，4 秒內再按一下才執行。不用瀏覽器對話框。
function armButton (btn, confirmText, onConfirm) {
  const original = btn.textContent
  let timer = null
  btn.onclick = () => {
    if (btn.classList.contains('armed')) {
      clearTimeout(timer)
      onConfirm()
      return
    }
    btn.classList.add('armed')
    btn.textContent = confirmText
    timer = setTimeout(() => { btn.classList.remove('armed'); btn.textContent = original }, 4000)
  }
}

// 長期統計：累計題數與答對率，加最近 14 天每天練了幾題（藍＝答對、橘＝答錯，疊起來是當天總題數）
function statsHtml (state) {
  const life = lifetimeStats(state)
  const days = dailyStats(state, 14)
  const max = Math.max(1, ...days.map(d => d.total))
  const pct = life.total ? Math.round(life.correct / life.total * 100) : 0
  const bars = days.map(d => {
    const h = Math.round(d.total / max * 100)
    const hOk = d.total ? Math.round(d.correct / d.total * h) : 0
    const tip = `${d.date}：${d.total} 題，答對 ${d.correct}`
    return `<div class="dbar" title="${tip}" aria-label="${tip}">
      <div class="dbar-col" style="height:${h}%">
        <div class="dbar-bad" style="height:${100 - (d.total ? hOk / h * 100 : 0)}%"></div>
        <div class="dbar-ok" style="flex:1"></div>
      </div>
      <div class="dbar-n">${d.total || ''}</div>
      <div class="dbar-date">${d.date}</div>
    </div>`
  }).join('')
  return `
      <div class="panel-row panel-stats">
        <div class="stats-sum">累計 <b>${life.total}</b> 題，答對 <b>${life.correct}</b>（${pct}%）</div>
        <div class="dchart">
          <div class="dchart-title">最近 14 天每天練幾題　<span class="lg lg-ok"></span>答對　<span class="lg lg-bad"></span>答錯</div>
          <div class="dbars">${bars}</div>
        </div>
      </div>`
}

// 進度格分三頁：注音符號（第 1–13 組）、拼讀字、詞。詞的組多，全部擠在一頁太長
const PAGE_NAMES = { symbols: '注音符號', syllables: '拼讀字', words: '詞' }
function pageOf (gi, g) {
  if (gi < 13) return 'symbols'
  return g[0].includes(' ') ? 'words' : 'syllables'
}
const VOLUMES = [['voiceVol', '發音'], ['sfxVol', '音效'], ['musicVol', '背景音樂']]
const volPct = (settings, key) => Math.round((typeof settings[key] === 'number' ? settings[key] : 1) * 100)
// 音量那一列：家長區、老師後台都放在最上面
function volumeRowHtml (settings) {
  return `<div class="panel-row panel-volume"><b>音量</b><span class="vol-row">${VOLUMES.map(([k, label]) => `<label>${label} <input type="range" id="vol-${k}" data-vol="${k}" min="0" max="100" step="5" value="${volPct(settings, k)}"> <span class="vol-val">${volPct(settings, k)}%</span></label>`).join('')}</span></div>`
}
// 音量：拉的時候數字跟著變，放手存起來並放一段聽聽看
function bindVolume (root, settings, onSettings, onVolumeTest) {
  root.querySelectorAll('[data-vol]').forEach(inp => {
    const val = inp.parentElement.querySelector('.vol-val')
    inp.oninput = () => { val.textContent = inp.value + '%' }
    inp.onchange = () => {
      onSettings({ ...settings, [inp.dataset.vol]: parseInt(inp.value, 10) / 100 })
      if (onVolumeTest) onVolumeTest(inp.dataset.vol)
    }
  })
}
// 首頁的玩法卡，老師後台可以挑上課要顯示哪幾個
export const GAME_NAMES = { fishing: '釣魚', whack: '打地鼠', memory: '翻牌', match: '連連看', fill: '填空', tone: '聲調填空', write: '寫寫看', learn: '學寫字', speak: '唸唸看', chart: '注音表', spell: '拼拼看', friend: '符號找朋友' }

export function renderPanel (root, opts) {
  if (opts.profile && opts.profile.adult) return renderTeacherPanel(root, opts)
  return renderFamilyPanel(root, opts)
}

// 老師後台：老師帳號不記紀錄、沒有骨頭，只放上課要調的東西
function renderTeacherPanel (root, { profile, profiles, state, settings, voices, onSettings, onVolumeTest, onStateChange, onRemoveProfile, onClose, onCheck }) {
  const hidden = state.hiddenGames || []
  const range = state.rangeGroups || []
  const voiceOptions = voices.map(v =>
    `<option value="${v.name}" ${settings.voiceName === v.name ? 'selected' : ''}>${v.name} (${v.lang})</option>`).join('')
  root.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h2>老師後台　<small>目前：${escapeHtml(profile.name)}</small></h2>
        <button class="panel-close" id="panel-close">關閉</button>
      </div>
      ${volumeRowHtml(settings)}
      <div class="panel-row">
        <b>上課設定</b>
        <label>難度
          <select id="t-tier">${TIERS.map((t, i) => `<option value="${i}" ${state.lockTier === i ? 'selected' : ''}>第 ${i + 1} 階：${tierLabel(t)}</option>`).join('')}</select>
        </label>
        <span>範圍：${escapeHtml(rangeSummary(range))}</span>
        <button id="t-range">選範圍</button>
        <span class="panel-hint-inline">首頁上方也可以直接換。老師帳號不記練習紀錄，不會自動升降級。</span>
      </div>
      <div class="panel-row">
        <b>首頁顯示的玩法</b>
        ${Object.entries(GAME_NAMES).map(([k, name]) => `<label class="game-toggle"><input type="checkbox" data-game-show="${k}" ${hidden.includes(k) ? '' : 'checked'}> ${name}</label>`).join('')}
      </div>
      <div class="panel-row">
        <label>語音
          <select id="sel-voice"><option value="">自動</option>${voiceOptions}</select>
        </label>
        <label>語速 <input type="range" id="rng-rate" min="0.5" max="1.2" step="0.05" value="${settings.rate || 0.8}"> <span id="rate-val">${settings.rate || 0.8}</span></label>
        <button id="btn-check">發音檢查</button>
      </div>
      <div class="panel-row panel-users">
        <b>使用者</b>${profiles.list.map(p => `
        <div class="puser">
          <span class="puser-dot" style="background:${DOG_COLORS[p.color % DOG_COLORS.length].main}"></span>
          <span class="puser-name">${escapeHtml(p.name)}${p.adult ? '（老師）' : ''}${profile.id === p.id ? '（目前）' : ''}</span>
          <button class="danger" data-remove="${p.id}">刪除</button>
        </div>`).join('')}
      </div>
      <p class="panel-hint">資料來源：發音為教育部《國語注音符號手冊》錄音（CC BY 4.0）；讀音照教育部《國語辭典簡編本》；筆順為教育部《國字標準字體筆順學習網》（CC BY-NC-ND 3.0 臺灣）；詞的圖為 Twemoji（CC BY 4.0）。</p>
    </div>`
  root.querySelector('#panel-close').onclick = onClose
  root.querySelector('#btn-check').onclick = onCheck
  bindVolume(root, settings, onSettings, onVolumeTest)
  root.querySelector('#t-tier').onchange = e => onStateChange({ lockTier: parseInt(e.target.value, 10) })
  root.querySelector('#t-range').onclick = () => {
    root.scrollTop = 0
    openRangePicker(root, { range, onDone: r => onStateChange({ rangeGroups: r }) })
  }
  root.querySelectorAll('[data-game-show]').forEach(cb => {
    cb.onchange = () => {
      const off = [...root.querySelectorAll('[data-game-show]')].filter(x => !x.checked).map(x => x.dataset.gameShow)
      // 至少留一個玩法
      if (off.length >= Object.keys(GAME_NAMES).length) { cb.checked = true; return }
      onStateChange({ hiddenGames: off })
    }
  })
  root.querySelector('#sel-voice').onchange = e => onSettings({ ...settings, voiceName: e.target.value })
  const rng = root.querySelector('#rng-rate')
  rng.oninput = () => { root.querySelector('#rate-val').textContent = rng.value }
  rng.onchange = () => onSettings({ ...settings, rate: parseFloat(rng.value) })
  root.querySelectorAll('[data-remove]').forEach(btn => {
    armButton(btn, '確定刪除？連進度一起刪', () => onRemoveProfile(btn.dataset.remove))
  })
}

function renderFamilyPanel (root, { profile, profiles, state, track = 'listen', page = null, onTrack, onPage, settings, voices, onKnownChange, onSettings, onVolumeTest, onStateChange, onExport, onImport, onResetProgress, onRemoveProfile, onClose, onSay, onCheck }) {
  // 沒指定頁：看詞軌、調軌就開詞那頁，其他軌開注音符號
  const curPage = page || (track === 'word' || track === 'tone' ? 'words' : 'symbols')
  const lifetime = state ? lifetimeStats(state) : { bySymbol: {} }
  const usersHtml = profiles.list.length
    ? profiles.list.map(p => `
      <div class="puser">
        <span class="puser-dot" style="background:${DOG_COLORS[p.color % DOG_COLORS.length].main}"></span>
        <span class="puser-name">${escapeHtml(p.name)}${profile && profile.id === p.id ? '（目前）' : ''}</span>
        <button class="danger" data-remove="${p.id}">刪除</button>
      </div>`).join('')
    : '<span>還沒有使用者</span>'
  const pool = state ? activePool(state) : []
  const pageCounts = {}
  GROUPS.forEach((g, gi) => { const p = pageOf(gi, g); pageCounts[p] = (pageCounts[p] || 0) + 1 })
  const pageTabs = `<div class="panel-row panel-pages"><b>進度</b>${Object.keys(PAGE_NAMES).map(p =>
    `<button class="track-tab ${p === curPage ? 'on' : ''}" data-page="${p}">${PAGE_NAMES[p]}（${pageCounts[p] || 0} 組）</button>`).join('')}</div>`
  const groupsHtml = !state ? '' : pageTabs + GROUPS.map((g, gi) => pageOf(gi, g) !== curPage ? '' : `
    <div class="pgroup">
      <div class="pgroup-title">第 ${gi + 1} 組${groupName(gi, g)}${g.every(s => pool.includes(s)) ? '' : '（未解鎖）'}</div>
      <div class="ptiles">${g.map(s => {
        const n = stars(state, s)
        const known = state.known.includes(s)
        const hist = (state.mastery[s] && state.mastery[s].history) || []
        const life = lifetime.bySymbol[s]
        const isWord = s.includes(' ')
        return `<div class="ptile ${starColor(n)}${isWord ? ' is-word' : ''}">
          <button class="ptile-sym" data-say="${s}" title="${isWord ? s + '　' : ''}點一下試聽">${isWord ? WORD_TEXT[s] || s : s}</button>
          <div class="ptile-stars">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</div>
          <div class="ptile-hist" title="最近 10 次答對／已答">${hist.length ? '近 ' + hist.filter(h => h.ok).length + '/' + hist.length : '沒練過'}${life ? '　累計 ' + life.correct + '/' + life.total : ''}</div>
          <label class="ptile-known"><input type="checkbox" data-known="${s}" ${known ? 'checked' : ''}> 認得</label>
          ${isWord ? `<span class="ptile-zy">${s}</span>` : `<input class="ptile-rep" data-rep="${s}" value="${(settings.repChar && settings.repChar[s]) || REP_CHAR[s]}" maxlength="2" title="唸成什麼字">`}
        </div>`
      }).join('')}</div>
    </div>`).join('')

  const confusions = state ? Object.keys(state.confusions) : []
  const voiceOptions = voices.map(v =>
    `<option value="${v.name}" ${settings.voiceName === v.name ? 'selected' : ''}>${v.name} (${v.lang})</option>`).join('')

  root.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h2>大人面板　<small>${profile ? '目前：' + escapeHtml(profile.name) : '尚未選人'}</small></h2>
        <button class="panel-close" id="panel-close">關閉</button>
      </div>
      ${volumeRowHtml(settings)}
      <div class="panel-row panel-users">
        <b>使用者</b>${usersHtml}
      </div>
      ${profile ? `
      <div class="panel-row panel-tracks">
        <b>看哪一軌</b>
        ${TRACKS.map(t => `<button class="track-tab ${t === track ? 'on' : ''}" data-track="${t}">${TRACK_NAMES[t]}</button>`).join('')}
        <span class="panel-hint-inline">聽＝釣魚、打地鼠；讀＝唸唸看；寫＝寫寫看、學寫字；詞＝連連看、填空；調＝聲調填空。翻牌、學寫字是純練習，不記進度。星星、混淆、階級、解鎖各軌分開算，下面的設定各軌共用。</span>
      </div>
      <div class="panel-row">
        <div>「${TRACK_NAMES[track]}」目前出題階級：<b>${effectiveTier(state) + 1}</b> / 6（${tierLabel(TIERS[effectiveTier(state)])}）</div>
        <div>自動判定：第 <b>${state.tier + 1}</b> 階
          <button class="mini" id="tier-down" title="降一階" ${state.tier <= 0 ? 'disabled' : ''}>−</button>
          <button class="mini" id="tier-up" title="跳一階" ${state.tier >= TIERS.length - 1 ? 'disabled' : ''}>＋</button>
          ，最近 10 題 ${state.recent.filter(Boolean).length}/${state.recent.length} 對</div>
        <div>混淆中：${confusions.length ? confusions.map(k => k.replace('|', '／')).join('、') : '沒有'}</div>
      </div>
      ${profile ? statsHtml(state) : ''}
      ${profile ? `
      <div class="panel-row">
        <b>骨頭</b> 現在 <b>${state.bones || 0}</b> 根（累計賺過 ${state.bonesTotal || 0}，買了 ${(state.owned || []).length} 件配件）
        <button class="mini" id="bones-minus" title="扣 100 根">−100</button>
        <button class="mini" id="bones-plus" title="送 100 根">＋100</button>
        <span class="panel-hint-inline">照題目難度給：第一次就答對，階級 1–2 給 1 根、3–4 給 2 根、5–6 給 3 根；還不熟的符號多 1 根、已經很熟的（4 顆星以上）少 1 根，最少 1 根。錯了才答對：低階不給、其他 1 根。連 3 題、連 5 題另外多 1～4 根，玩完一局再送 1～3 根，也都照階級。翻牌是純遊玩：配對一對 1 根、沒有過關獎勵。</span>
      </div>` : ''}
      <div class="panel-row panel-difficulty">
        <label>難度
          <select id="sel-tier">
            <option value="" ${state.lockTier == null ? 'selected' : ''}>自動（連對升、連錯降）</option>
            ${TIERS.map((t, i) => `<option value="${i}" ${state.lockTier === i ? 'selected' : ''}>鎖在第 ${i + 1} 階：${tierLabel(t)}</option>`).join('')}
          </select>
        </label>
        <div class="range-pick">
          <label><input type="checkbox" id="range-auto" ${!(state.rangeGroups && state.rangeGroups.length) ? 'checked' : ''}> 範圍自動解鎖</label>
          <label class="${(state.rangeGroups && state.rangeGroups.length) ? 'dimmed' : ''}">已解鎖到第
            <select id="sel-unlocked" ${(state.rangeGroups && state.rangeGroups.length) ? 'disabled' : ''}>
              ${GROUPS.map((g, i) => `<option value="${i + 1}" ${unlockedCount(state) === i + 1 ? 'selected' : ''}>${i + 1} 組（${g.length > 8 ? groupName(i, g).trim() : g.join('')}）</option>`).join('')}
            </select>，之後照常自動往後解鎖
          </label>
          <span class="range-groups ${!(state.rangeGroups && state.rangeGroups.length) ? 'dimmed' : ''}">
            ${GROUPS.map((g, i) => `<label><input type="checkbox" data-range="${i}" ${(state.rangeGroups || []).includes(i) ? 'checked' : ''}> ${i + 1}.${g.length > 8 ? groupName(i, g) : g.join('')}</label>`).join('')}
          </span>
        </div>
      </div>` : ''}
      <div class="panel-row">
        <label>語音
          <select id="sel-voice"><option value="">自動</option>${voiceOptions}</select>
        </label>
        <label>語速 <input type="range" id="rng-rate" min="0.5" max="1.2" step="0.05" value="${settings.rate || 0.8}"> <span id="rate-val">${settings.rate || 0.8}</span></label>
        <button id="btn-check">發音檢查${Object.keys(settings.audioIssues || {}).length ? '（' + Object.keys(settings.audioIssues).length + ' 個有問題）' : ''}</button>
        ${profile ? `
        <button id="btn-export">匯出進度</button>
        <label class="file-btn">匯入進度<input type="file" id="file-import" accept=".json"></label>
        <button id="btn-reset" class="danger">清除練習紀錄（全部五軌）</button>` : ''}
        <span id="panel-msg" class="panel-msg"></span>
      </div>
      <p class="panel-hint">資料來源：發音為教育部《國語注音符號手冊》錄音（CC BY 4.0）；讀音照教育部《國語辭典簡編本》；筆順為教育部《國字標準字體筆順學習網》（CC BY-NC-ND 3.0 臺灣）；詞的圖為 Twemoji（CC BY 4.0）。</p>
      <p class="panel-hint">點符號可以試聽。「認得」勾起來的符號從 3 星起算並直接進入出題。每格右下方的字是語音合成實際唸的代表字，唸得怪可以改。</p>
      ${profile ? groupsHtml : '<p class="panel-hint">先回選人畫面選一個人，才看得到進度。</p>'}
    </div>`

  root.querySelector('#panel-close').onclick = onClose
  root.querySelector('#btn-check').onclick = onCheck
  root.querySelectorAll('[data-track]').forEach(b => { b.onclick = () => onTrack(b.dataset.track) })
  root.querySelectorAll('[data-page]').forEach(b => { b.onclick = () => onPage(b.dataset.page) })
  bindVolume(root, settings, onSettings, onVolumeTest)
  root.querySelectorAll('[data-say]').forEach(b => { b.onclick = () => onSay(b.dataset.say) })
  root.querySelectorAll('[data-known]').forEach(cb => {
    cb.onchange = () => onKnownChange(cb.dataset.known, cb.checked)
  })
  root.querySelectorAll('[data-rep]').forEach(inp => {
    inp.onchange = () => {
      const repChar = { ...(settings.repChar || {}) }
      const v = inp.value.trim()
      if (v && v !== REP_CHAR[inp.dataset.rep]) repChar[inp.dataset.rep] = v
      else delete repChar[inp.dataset.rep]
      onSettings({ ...settings, repChar })
    }
  })
  root.querySelector('#sel-voice').onchange = e => onSettings({ ...settings, voiceName: e.target.value })
  const rng = root.querySelector('#rng-rate')
  rng.oninput = () => { root.querySelector('#rate-val').textContent = rng.value }
  rng.onchange = () => onSettings({ ...settings, rate: parseFloat(rng.value) })
  if (profile) {
    root.querySelector('#sel-tier').onchange = e => {
      onStateChange({ lockTier: e.target.value === '' ? null : parseInt(e.target.value, 10) })
    }
    root.querySelector('#bones-minus').onclick = () => onStateChange({ bones: Math.max(0, (state.bones || 0) - 100) })
    root.querySelector('#bones-plus').onclick = () => onStateChange({ bones: (state.bones || 0) + 100, bonesTotal: (state.bonesTotal || 0) + 100 })
    root.querySelector('#tier-down').onclick = () => onStateChange({ tier: Math.max(0, state.tier - 1), recent: [] })
    root.querySelector('#tier-up').onclick = () => onStateChange({ tier: Math.min(TIERS.length - 1, state.tier + 1), recent: [] })
    root.querySelector('#sel-unlocked').onchange = e => onStateChange({ unlockedUpTo: parseInt(e.target.value, 10) })
    const readRange = () => [...root.querySelectorAll('[data-range]:checked')].map(cb => parseInt(cb.dataset.range, 10))
    root.querySelector('#range-auto').onchange = e => {
      if (e.target.checked) onStateChange({ rangeGroups: null })
      else onStateChange({ rangeGroups: readRange().length ? readRange() : [0] })
    }
    root.querySelectorAll('[data-range]').forEach(cb => {
      cb.onchange = () => onStateChange({ rangeGroups: readRange() })
    })
    root.querySelector('#btn-export').onclick = onExport
    armButton(root.querySelector('#btn-reset'), '確定清除？星星和混淆紀錄會歸零，認得與難度設定保留', onResetProgress)
    root.querySelector('#file-import').onchange = e => {
      const f = e.target.files[0]
      if (!f) return
      const reader = new FileReader()
      reader.onload = () => onImport(String(reader.result))
      reader.readAsText(f)
    }
  }
  root.querySelectorAll('[data-remove]').forEach(btn => {
    armButton(btn, '確定刪除？連進度一起刪', () => onRemoveProfile(btn.dataset.remove))
  })
}

export function panelMessage (root, text) {
  const el = root.querySelector('#panel-msg')
  if (el) el.textContent = text
}
