// 把所有模組接起來：使用者、狀態、出題、三種玩法、畫面切換。

import { addBones, buyItem, wearItem, teamOf, partnerOf, setPartner, recordRound, claimDaily, dailyView, DAILY_GOAL, markSeen, recommendTrack, dayKey, questionReward, roundBonus, comboBonus, buildRound, recordAnswer, resetProgress, pickSymbols, singleSymbolState, noWordsState, wordsOnlyState, activePool, effectiveTier, trackView, applyTrack, toneOfSyllable, toneTiles, buildToneRound, syllablesOnlyState, spellTiles, buildFriendQuestion } from './scheduler.js'
import { createStore } from './store.js'
import { createAudio } from './audio.js'
import { createFishing } from './fishing.js'
import { createWhack, WHACK_SPEEDS } from './whack.js'
import { createMemory } from './memory.js'
import { createSpeak, speechAvailable, createListener, matchesSymbol, openMicMeter } from './speak.js'
import { createWrite } from './write.js'
import { createLearn } from './learn.js'
import { createChart } from './chart.js'
import { createMatchLine } from './matchline.js'
import { createFillBlank } from './fillblank.js'
import { createSpell } from './spell.js'
import { createFriend } from './friend.js'
import { createCount, createMake, createCompare, createCalc } from './mathgames.js'
import { createPattern, createOdd, createMaze, createAnalogy, createTiles } from './braingames.js'
import { patternQuestion, oddQuestion, mazeLevel, spotScene, analogyQuestion, tilesQuestion } from './brainq.js'
import { createColoring, COLOR_PICTURES } from './coloring.js'
import { createSpot } from './spot.js'
import { DIGIT_SYMBOLS, UPPER_SYMBOLS } from './latinstrokes.js'
import { LETTER_GROUPS, SPELL_GROUPS, ENGLISH_ICON, letterOptions, letterPictureQuestion, wordTiles } from './english.js'
import { countViewOf, countOptions, makePoolSize, compareQuestion, scatter, COUNT_ICONS, countMixed, CALC_GROUPS, parseCalc, calcLook, calcSay } from './mathq.js'
import { renderShop } from './shop.js'
import { openBattle, canBattle } from './battle.js'
import { setOutfit, boneSvg, ownedMates, bgHtml, UX_ICONS, twemojiName } from './art.js'
const ENG_SPEAKER = '<svg viewBox="0 0 24 24" width="150" height="150" fill="#E0955B"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="#E0955B" stroke-width="2" fill="none" stroke-linecap="round"/></svg>'
import { burstAt, flyBones, bump, buzz } from './fx.js'
import { showTutorial, hasTutorial } from './tutorial.js'
import { WORD_ICON, coreOf } from './data.js'
import { renderNight, NIGHT_TASKS } from './ui.js'
import { fitStage, layoutBg, mountBgs, goFullscreenOnPhone, showScreen, renderProfiles, renderHome, renderResult, playResult, renderPanel, panelMessage, openRangePicker, watchArtSlots } from './ui.js'
import { renderCheck } from './check.js'

const SETTINGS_KEY = 'zhuyin-rescue-settings'
const MEMORY_PAIRS = 5
// 每個玩法練哪一軌：聽（釣魚、打地鼠）、讀（唸給狗狗聽）、寫（寫給狗狗看）、詞（連連看、填空）、調（聲調填空）、拼（拼拼看）
// 翻牌只借「聽」那一軌的出題池挑符號，不寫任何紀錄進去
const TRACK_OF = { fishing: 'listen', whack: 'listen', memory: 'listen', speak: 'read', write: 'write', match: 'word', fill: 'word', tone: 'tone', learn: 'write', spell: 'spell', friend: 'friend', count: 'count', make: 'count', compare: 'compare', calc: 'calc', pattern: 'pattern', odd: 'odd', maze: 'maze', letterpic: 'letter', letterhear: 'letter', wordspell: 'eword', numwrite: 'count', abcwrite: 'letter', spot: 'spot', coloring: 'pattern', analogy: 'pattern', tiles: 'pattern' }
// 純練習的玩法：不記進度、沒有玩完的骨頭、不算今天的腳印
const PRACTICE_KINDS = ['memory', 'learn', 'numwrite', 'abcwrite', 'coloring']
const LEARN_SYMBOLS = 3 // 學寫字一局教幾個符號
const MATCH_PAIRS = 4
// 唸給狗狗聽的狀態訊息，寫給旁邊的大人看
const MIC_MSG = {
  silent: '沒聽到聲音，靠近一點再唸一次',
  // 麥克風有收到聲音、辨識卻沒回任何字：單一個注音太短，辨識服務常常直接丟掉，連唸兩次比較聽得懂（三次有效但小孩嫌累）
  unclear: '有聽到聲音，但聽不出是哪個字：一個注音連唸兩次，例如「ㄅㄅ」',
  unclearWord: '有聽到聲音，但聽不出是哪個詞：唸大聲、慢一點再試一次',
  denied: '麥克風被封鎖了：按網址列左邊的鎖頭或圖示，把麥克風改成「允許」，再重新整理',
  nomic: '找不到麥克風，或麥克風被別的程式占用',
  listening: '我在聽…',
  network: '語音辨識要連網才能用，請確認網路',
  unavailable: '這個瀏覽器沒有語音辨識，請用 Chrome',
}

function loadSettings () {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {} } catch (err) { return {} }
}
function saveSettings (s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)) }

function main () {
  const stage = document.getElementById('stage')
  // 螢幕大小或方向變了：舞台變形、背景重鋪、正在玩的遊戲重排
  function relayout () {
    const changed = fitStage(stage)
    if (!changed) return
    document.querySelectorAll('.bg').forEach(layoutBg)
    if (game && game.layout) game.layout()
  }
  fitStage(stage)
  window.addEventListener('resize', relayout)
  window.addEventListener('orientationchange', () => setTimeout(relayout, 300))
  if (window.visualViewport) window.visualViewport.addEventListener('resize', relayout)
  // 手機上碰畫面就進全螢幕並鎖橫向（只在真的點下去時有效；退出全螢幕後再點會再進）
  document.addEventListener('pointerdown', goFullscreenOnPhone)
  watchArtSlots()
  showInstallHint()

  const store = createStore(localStorage)
  let settings = loadSettings()
  const audio = createAudio(() => settings)

  let profile = null
  let state = null

  // 背景音樂只在這幾個畫面放；進遊戲就停，才不會蓋掉注音的聲音
  const MUSIC_SCREENS = ['profiles', 'home', 'shop', 'result']
  let currentScreen = null
  function updateMusic () {
    if (!audio.ready()) return
    if (MUSIC_SCREENS.includes(currentScreen) && !settings.musicOff) audio.startMusic()
    else audio.stopMusic()
  }
  function show (name) {
    currentScreen = name
    showScreen(name)
    updateMusic()
  }
  function today () { return dayKey(Date.now()) }

  // 第一次碰畫面才能出聲（瀏覽器規定），順便把音樂打開；點到按鈕輕輕「啵」一聲
  document.addEventListener('pointerdown', e => {
    const first = !audio.ready()
    audio.unlock()
    if (first) updateMusic()
    const btn = e.target.closest('button, .card, .profile-card')
    if (btn && !btn.disabled && !btn.closest('#screen-panel') && !btn.classList.contains('mic-btn')) audio.pop()
  }, true)

  const profilesEl = document.getElementById('screen-profiles')
  const homeEl = document.getElementById('screen-home')
  const gameEl = document.getElementById('screen-game')
  const resultEl = document.getElementById('screen-result')
  const panelEl = document.getElementById('screen-panel')

  // ---- 選人 ----
  function goProfiles () {
    renderProfiles(profilesEl, {
      profiles: store.loadProfiles(),
      onPick (id) { audio.unlock(); pickProfile(id) },
      onAdd (info) { audio.unlock(); const p = store.addProfile(info); pickProfile(p.id) },
      onGear: gearTap,
    })
    show('profiles')
  }

  function pickProfile (id) {
    const profiles = store.loadProfiles()
    profile = profiles.list.find(p => p.id === id)
    if (!profile) return goProfiles()
    store.setCurrent(id)
    state = store.load(id)
    // 老師帳號：一定鎖難度、一定指定範圍，第一次進來先給第 3 階、第 1 組
    if (profile.adult) {
      if (state.lockTier == null || !(state.rangeGroups && state.rangeGroups.length)) {
        state = { ...state, lockTier: state.lockTier == null ? 2 : state.lockTier, rangeGroups: state.rangeGroups && state.rangeGroups.length ? state.rangeGroups : [0] }
        store.save(id, state)
      }
    }
    setOutfit(myColor(), state.worn)
    goHome()
  }

  // ---- 首頁 ----
  // 唸唸看要用 Google 的語音辨識，沒網路就先藏起來；網路斷了或回來時，首頁跟著重畫
  function canSpeak () { return speechAvailable() && navigator.onLine !== false }
  const onNetChange = () => { if (currentScreen === 'home' && profile) goHome() }
  window.addEventListener('online', onNetChange)
  window.addEventListener('offline', onNetChange)

  // 今天推薦哪個玩法：今天練最少的那一軌，軌裡再照日子輪
  function recommendGame () {
    const t = recommendTrack(state, today())
    const odd = Math.floor(Date.now() / 86400000) % 2
    if (t === 'listen') return odd ? 'whack' : 'fishing'
    if (t === 'word') return odd ? 'fill' : 'match'
    if (t === 'tone') return 'tone'
    if (t === 'spell') return 'spell'
    if (t === 'friend') return 'friend'
    if (t === 'count') return odd ? 'make' : 'count'
    if (t === 'compare') return 'compare'
    if (t === 'calc') return 'calc'
    if (t === 'pattern' || t === 'odd' || t === 'maze') return t
    if (t === 'letter') return odd ? 'letterhear' : 'letterpic'
    if (t === 'eword') return 'wordspell'
    if (t === 'spot') return 'spot'
    if (t === 'read') return canSpeak() ? 'speak' : 'match'
    return 'write'
  }

  // 老師調的打地鼠速度：0 慢、1 中、2 快；沒調過是中
  function whackSpeed () { return WHACK_SPEEDS[state.whackSpeed] ? state.whackSpeed : 1 }

  // 每天玩幾局（家長區設，0＝不限）：今天玩滿了就只給晚上收尾畫面。延長的局數記在今天的 daily.extra
  function limitReached () {
    if (isTeacher() || !state.dailyLimit) return false
    const d = dailyView(state, today())
    const extra = state.daily && state.daily.date === today() ? state.daily.extra || 0 : 0
    return d.rounds >= state.dailyLimit + extra
  }
  function showNight () {
    destroyGame()
    const task = NIGHT_TASKS[Math.floor(Math.random() * NIGHT_TASKS.length)]
    renderNight(homeEl, {
      color: myColor(),
      task,
      extendBy: state.extendBy || 2,
      onExtend: () => {
        const d = state.daily && state.daily.date === today() ? state.daily : { date: today(), rounds: 0, claimed: false }
        state = { ...state, daily: { ...d, extra: (d.extra || 0) + (state.extendBy || 2) } }
        store.save(profile.id, state)
        goHome()
      },
      onGear: gearTap,
    })
    show('home')
    audio.sayText('今天練習完囉！' + task[1])
  }

  // 螢幕時間：在遊戲畫面、而且畫面看得到時，每 15 秒記一次（家長區「每天玩幾分鐘」），只留最近 60 天
  setInterval(() => {
    if (currentScreen !== 'game' || document.visibilityState !== 'visible' || !profile || isTeacher()) return
    const k = today()
    const st = { ...(state.screenTime || {}), [k]: ((state.screenTime || {})[k] || 0) + 15000 }
    for (const d of Object.keys(st).sort().slice(0, -60)) delete st[d]
    state = { ...state, screenTime: st }
    store.save(profile.id, state)
  }, 15000)

  function goHome () {
    if (limitReached()) return showNight()
    destroyGame()
    const daily = { ...dailyView(state, today()), goal: DAILY_GOAL }
    const teacher = isTeacher() ? { tier: state.lockTier, range: state.rangeGroups || [], hidden: state.hiddenGames || [], whack: whackSpeed() } : null
    renderHome(homeEl, { profile, speech: canSpeak(), bones: state.bones, partner: myColor(), team: teamOf(state, profile.color), daily, recommend: recommendGame(), musicOn: !settings.musicOff, teacher, battle: canBattle(), onRerender: goHome })
    // 點下方的隊員：換牠出任務（配件跟著戴到牠身上）
    homeEl.querySelectorAll('[data-partner]').forEach(b => b.addEventListener('pointerdown', () => {
      const c = parseInt(b.dataset.partner, 10)
      if (c === myColor()) return
      state = setPartner(state, c, profile.color)
      store.save(profile.id, state)
      setOutfit(myColor(), state.worn)
      audio.ding()
      goHome()
    }))
    homeEl.querySelector('#btn-who').addEventListener('pointerdown', goProfiles)
    homeEl.querySelector('#btn-chest').addEventListener('pointerdown', openChest)
    // 老師：點難度直接換；點範圍打開挑選
    homeEl.querySelectorAll('[data-tier]').forEach(b => b.addEventListener('pointerdown', () => {
      state = { ...state, lockTier: parseInt(b.dataset.tier, 10) }
      store.save(profile.id, state)
      goHome()
    }))
    homeEl.querySelectorAll('[data-whack]').forEach(b => b.addEventListener('pointerdown', () => {
      state = { ...state, whackSpeed: parseInt(b.dataset.whack, 10) }
      store.save(profile.id, state)
      goHome()
    }))
    const rangeBtn = homeEl.querySelector('#btn-range')
    if (rangeBtn) rangeBtn.addEventListener('pointerdown', () => openRangePicker(homeEl, {
      range: state.rangeGroups || [],
      onDone (range) { state = { ...state, rangeGroups: range }; store.save(profile.id, state); goHome() },
    }))
    homeEl.querySelector('#btn-music').addEventListener('pointerdown', e => {
      settings = { ...settings, musicOff: !settings.musicOff }
      saveSettings(settings)
      const b = e.currentTarget
      b.classList.toggle('off', !!settings.musicOff)
      b.innerHTML = settings.musicOff ? UX_ICONS.musicOff : UX_ICONS.musicOn
      updateMusic()
    })
    const shopBtn = homeEl.querySelector('#btn-shop')
    if (shopBtn) shopBtn.addEventListener('pointerdown', () => { audio.unlock(); openShop() })
    const battleBtn = homeEl.querySelector('#btn-battle')
    if (battleBtn) battleBtn.addEventListener('pointerdown', () => { audio.unlock(); openBattleScreen() })
    homeEl.querySelectorAll('[data-game]').forEach(card => {
      card.addEventListener('pointerdown', () => { audio.unlock(); startGame(card.dataset.game) })
    })
    homeEl.querySelector('#btn-gear').addEventListener('pointerdown', gearTap)
    show('home')
  }

  // 開寶箱：蓋子打開、星星爆開、骨頭一根根飛進商店按鈕
  function openChest (e) {
    const chest = e.currentTarget
    const before = state.bones
    const next = claimDaily(state, today())
    if (next === state) return
    state = next
    store.save(profile.id, state)
    const bonus = state.bones - before
    chest.classList.remove('ready')
    chest.classList.add('opening')
    chest.disabled = true
    audio.chest()
    buzz(40)
    burstAt(chest, { count: 20, spread: 1.4 })
    const shopBtn = homeEl.querySelector('#btn-shop')
    const countEl = shopBtn.querySelector('b')
    const k = Math.min(bonus, 8)
    flyBones(chest, shopBtn.querySelector('.bone-ic'), k, (i, last) => {
      audio.tick()
      countEl.textContent = last ? state.bones : before + Math.round(bonus * (i + 1) / k)
      bump(shopBtn)
      if (last) setTimeout(() => { chest.classList.remove('opening'); chest.classList.add('claimed') }, 300)
    })
  }

  // ---- 狗狗商店 ----
  const shopEl = document.getElementById('screen-shop')
  let shopTab = 'acc'
  function openShop () {
    destroyGame()
    renderShop(shopEl, {
      profile,
      state,
      tab: shopTab,
      onTab (t) { shopTab = t; openShop() },
      onBuy (item) {
        const next = buyItem(state, item)
        if (next.owned.length === (state.owned || []).length) return
        state = next
        store.save(profile.id, state)
        setOutfit(myColor(), state.worn)
        audio.cheer()
        openShop()
      },
      onWear (slot, id) {
        state = wearItem(state, slot, id)
        store.save(profile.id, state)
        setOutfit(myColor(), state.worn)
        audio.ding()
        openShop()
      },
      onClose: goHome,
    })
    show('shop')
  }

  // ---- 對戰：兩個人擠一台觸控螢幕 ----
  const battleEl = document.getElementById('screen-battle')
  let battle = null
  function openBattleScreen () {
    destroyGame()
    if (battle) battle.destroy()
    battle = openBattle(battleEl, {
      profiles: store.loadProfiles(),
      currentId: profile.id,
      loadState: id => id === profile.id ? state : store.load(id),
      audio,
      // 對戰的骨頭存進那個人的存檔；是現在這個人就連手上的 state 一起改
      onBones (id, n) {
        if (id === profile.id) { state = addBones(state, n); store.save(id, state) } else store.save(id, addBones(store.load(id), n))
      },
      onExit () { battle.destroy(); battle = null; goHome() },
    })
    show('battle')
  }

  // ---- 骨頭（積分）：答對就有，玩完一局再送 ----
  const bonesEl = gameEl.querySelector('#bones')
  bonesEl.querySelector('.bone-ic').innerHTML = boneSvg()
  let roundBones = 0
  function showBones () { bonesEl.querySelector('b').textContent = state.bones }
  function floatPlus (n) {
    const f = document.createElement('span')
    f.className = 'bone-float'
    f.textContent = '+' + n
    bonesEl.appendChild(f)
    setTimeout(() => f.remove(), 1200)
  }
  // 存檔馬上存；畫面上的數字等骨頭飛到了才加。fromEl 是骨頭飛出來的地方（答對的泡泡、地鼠…）
  // 老師帳號（教室投影）：難度、範圍由老師指定，不記紀錄、不自動升降，也沒有骨頭
  function isTeacher () { return !!(profile && profile.adult) }
  // 出任務的隊員（顏色）：她在首頁點選的那位，沒選過就是建立使用者時選的
  function myColor () { return partnerOf(state, profile.color) }

  function gain (n, fromEl = null) {
    if (!n || isTeacher()) return
    state = addBones(state, n)
    store.save(profile.id, state)
    roundBones += n
    if (!fromEl) { showBones(); floatPlus(n); return }
    flyBones(fromEl, bonesEl.querySelector('.bone-ic'), n, (i, last) => {
      audio.tick()
      if (!last) return
      showBones()
      bump(bonesEl)
      floatPlus(n)
    })
  }

  // ---- 連對：第一次就答對一題接一題，火焰上的數字往上加；連 3 題、連 5 題有額外骨頭（照階級，comboBonus） ----
  const comboEl = gameEl.querySelector('#combo')
  comboEl.querySelector('.flame').innerHTML = UX_ICONS.flame
  let combo = 0
  function setCombo (n) {
    combo = n
    comboEl.hidden = n < 2
    if (n < 2) return
    comboEl.querySelector('b').textContent = n
    bump(comboEl)
    comboEl.classList.remove('pop')
    void comboEl.offsetWidth
    comboEl.classList.add('pop')
  }
  // 答對：星星、骨頭、特效、震動、連對。el 是答對的那個東西（找不到就不放特效）
  // bones 是這題值幾根，照難度算（questionReward），要在記錄這題之前算好
  function rewardCorrect (first, el, bones) {
    earned.push(first)
    setStars()
    gain(bones, el)
    if (el) burstAt(el)
    buzz(25)
    if (!first) return
    setCombo(combo + 1)
    if (combo >= 2) audio.combo(combo)
    const extra = comboBonus(currentView(), combo) // 連 3 題、連 5 題的獎勵，照階級
    if (extra) setTimeout(() => gain(extra, comboEl), 450)
  }
  function rewardWrong () {
    setCombo(0)
    buzz([40, 60, 40])
  }

  // 齒輪 2 秒內連點三下才開大人面板。每點一下齒輪旁顯示還差幾下，讓大人知道它沒壞。
  let gearTaps = []
  let gearHintTimer = null
  function gearTap (e) {
    const now = Date.now()
    gearTaps = gearTaps.filter(t => now - t < 2000)
    gearTaps.push(now)
    if (gearTaps.length >= 3) { gearTaps = []; hideGearHint(); openPanel(); return }
    const gear = e.currentTarget
    let hint = gear.parentElement.querySelector('.gear-hint')
    if (!hint) {
      hint = document.createElement('div')
      hint.className = 'gear-hint'
      gear.parentElement.appendChild(hint)
    }
    hint.textContent = '再點 ' + (3 - gearTaps.length) + ' 下進家長區'
    clearTimeout(gearHintTimer)
    gearHintTimer = setTimeout(hideGearHint, 2000)
  }
  function hideGearHint () {
    document.querySelectorAll('.gear-hint').forEach(el => el.remove())
  }

  // ---- 遊戲共用 ----
  const playArea = gameEl.querySelector('.play-area')
  const starsEl = gameEl.querySelector('.progress-stars')
  const replayBtn = gameEl.querySelector('#btn-replay')
  let game = null
  let learnOverlay = null // 「寫寫看」上面疊的學寫字
  let kind = null
  let earned = []
  let starTotal = 5

  function setStars () {
    starsEl.innerHTML = ''
    for (let i = 0; i < starTotal; i++) {
      const s = document.createElement('span')
      s.className = 'star' + (i < earned.length ? (earned[i] ? ' lit' : ' dim') : '')
      s.textContent = '★'
      starsEl.appendChild(s)
    }
  }

  function destroyGame () {
    clearIdle()
    if (learnOverlay) { learnOverlay.destroy(); learnOverlay = null }
    if (game) game.destroy()
    game = null
    if (listener) { listener.stop(); listener = null }
    if (meter) { meter.stop(); meter = null }
    cancelAnimationFrame(meterRaf)
    audio.stop()
  }

  function startGame (which) {
    destroyGame()
    sayTargetFn = null
    bonesEl.hidden = isTeacher() || which === 'chart' // 老師帳號沒有骨頭；注音表只是看
    gameEl.querySelector('#btn-help').classList.toggle('hidden', !hasTutorial(which))
    kind = which
    earned = []
    roundBones = 0
    setCombo(0)
    starsEl.innerHTML = ''
    showBones()
    show('game')
    // 第一次玩這個遊戲：先看小手示範，按播放鍵才開始
    if (hasTutorial(which) && !isTeacher() && !(state.seen && state.seen[which])) {
      playArea.innerHTML = bgHtml({ fishing: 'scene', whack: 'garden' }[which] || 'room')
      mountBgs(playArea)
      showTutorial(gameEl, which, () => {
        state = markSeen(state, which)
        store.save(profile.id, state)
        if (kind === which && currentScreen === 'game') runGame(which)
      })
      return
    }
    runGame(which)
  }

  function runGame (which) {
    if (which === 'memory') return runMemory()
    if (which === 'learn') return runLearn()
    if (which === 'chart') return runChart()
    if (which === 'speak') return runSpeak()
    if (which === 'match') return runMatch()
    if (which === 'fill') return runFill('syllable')
    if (which === 'tone') return runFill('tone')
    if (which === 'spell') return runSpell()
    if (which === 'friend') return runFriend()
    if (which === 'count') return runCount()
    if (which === 'make') return runMake()
    if (which === 'compare') return runCompare()
    if (which === 'calc') return runCalc()
    if (which === 'pattern') return runPattern()
    if (which === 'odd') return runOdd()
    if (which === 'maze') return runMaze()
    if (which === 'letterpic') return runLetterPic()
    if (which === 'letterhear') return runLetterHear()
    if (which === 'wordspell') return runWordSpell()
    if (which === 'spot') return runSpot()
    if (which === 'analogy') return runAnalogy()
    if (which === 'tiles') return runTiles()
    if (which === 'coloring') return runColoring()
    if (which === 'numwrite') return runLatinWrite(DIGIT_SYMBOLS, 'num', s => audio.sayText(s))
    if (which === 'abcwrite') return runLatinWrite(UPPER_SYMBOLS, 'abc', s => audio.sayEnglish(s))
    runQuestions(which)
  }

  gameEl.querySelector('#btn-quit').addEventListener('pointerdown', () => {
    busy = false
    clearIdle()
    gameEl.querySelectorAll('.tut').forEach(t => t.remove())
    goHome()
  })
  // 「？」再看一次怎麼玩（蓋在遊戲上，按播放鍵回去繼續玩）
  gameEl.querySelector('#btn-help').addEventListener('pointerdown', () => {
    if (!kind || !hasTutorial(kind) || gameEl.querySelector('.tut')) return
    showTutorial(gameEl, kind, () => {})
  })

  // 記到目前玩法那一軌
  function commit (answer) {
    if (isTeacher()) return
    const track = TRACK_OF[kind]
    state = applyTrack(state, track, recordAnswer(trackView(state, track), answer))
    store.save(profile.id, state)
  }
  // 手機、不是加到主畫面開的、又沒有全螢幕 API（app 內建瀏覽器）：提示改用 Chrome 加到主畫面
  function showInstallHint () {
    const hint = document.getElementById('install-hint')
    if (!hint) return
    const coarse = window.matchMedia('(pointer: coarse)').matches
    const standalone = window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches
    const dismissed = (() => { try { return localStorage.getItem('zhuyin-rescue-hint') === '1' } catch (e) { return false } })()
    if (!coarse || standalone || dismissed || document.fullscreenEnabled) return
    hint.hidden = false
    hint.addEventListener('pointerdown', e => {
      e.stopPropagation()
      hint.hidden = true
      try { localStorage.setItem('zhuyin-rescue-hint', '1') } catch (err) { /* 存不了就下次再提示 */ }
    })
  }

  // 家長按了「下一局只練最弱的」：這一軌的下一局題目只從那幾題出，用過一次就清掉
  function currentView () {
    const t = TRACK_OF[kind]
    const v = trackView(state, t)
    if (state.focus && state.focus.track === t) return { ...v, focus: state.focus.items }
    return v
  }

  function finishRound () {
    destroyGame()
    setCombo(0)
    // 翻牌、學寫字是純練習：沒有玩完的骨頭，也不算今天的腳印
    let daily = null
    if (!PRACTICE_KINDS.includes(kind) && !isTeacher()) {
      gain(roundBonus(currentView()))
      state = recordRound(state, today())
      store.save(profile.id, state)
      daily = { ...dailyView(state, today()), goal: DAILY_GOAL }
    }
    if (state.focus && state.focus.track === TRACK_OF[kind]) { state = { ...state, focus: null }; store.save(profile.id, state) }
    const perfect = !PRACTICE_KINDS.includes(kind) && earned.length > 0 && earned.every(Boolean)
    renderResult(resultEl, myColor(), { roundBones, bones: state.bones, mates: isTeacher() ? [] : teamOf(state, profile.color).filter(c => c !== myColor()), daily, perfect, teacher: isTeacher() })
    resultEl.querySelector('#btn-again').addEventListener('pointerdown', () => { if (limitReached()) showNight(); else startGame(kind) })
    resultEl.querySelector('#btn-home').addEventListener('pointerdown', goHome)
    show('result')
    audio.cheer()
    playResult(resultEl, earned, {
      onTick: () => audio.tick(),
      onPaw: () => { audio.combo(3); buzz(20) },
      onPerfect: crown => { audio.fanfare(); burstAt(crown, { count: 24, spread: 1.6 }) },
    })
  }

  // ---- 釣魚、打地鼠：聽音選形 ----
  let round = []
  let index = 0
  let firstAttempt = true
  // 答錯三級提示（2026-10-27 起）：同一題錯第 1 次，錯的晃、重唸題目；錯第 2 次起，正解一直發亮；
  // 錯第 3 次以上再加示範：狗狗唸「是這一個」，再唸一次答案
  let wrongs = 0
  function wrongStep () { wrongs = Math.min(3, wrongs + 1); return wrongs }
  async function sayDemo (target, myGame) {
    await audio.sayText('是這一個')
    if (game === myGame) await audio.say(target)
  }
  let askedAt = 0
  let busy = false
  let idleTimer = null

  function clearIdle () { clearTimeout(idleTimer); idleTimer = null }
  // 唸題目：預設照注音（官方錄音、代表字）；英文的玩法換成英文語音
  let sayTargetFn = null
  const sayTarget = (t, opts) => sayTargetFn ? sayTargetFn(t, opts) : audio.say(t, opts)

  // 發呆太久：重唸一次、正確的晃一下。之後每隔同樣秒數再來一次。
  function armIdle (q, myIndex, myGame) {
    clearIdle()
    if (!q.idleHint) return
    idleTimer = setTimeout(async () => {
      if (index !== myIndex || game !== myGame || busy) return
      await sayTarget(q.target)
      if (index !== myIndex || game !== myGame) return
      game.hint()
      armIdle(q, myIndex, myGame)
    }, q.idleHint * 1000)
  }

  function runQuestions (which) {
    if (which === 'whack') game = createWhack(playArea, { color: myColor(), slow: isTeacher() ? WHACK_SPEEDS[whackSpeed()] : 1 })
    else if (which === 'write') game = createWrite(playArea, { color: myColor() })
    else game = createFishing(playArea, { color: myColor() })
    replayBtn.classList.remove('hidden')
    // 寫字只出單一符號；聽的玩法不出詞
    const v = currentView()
    round = which === 'write' ? buildRound(singleSymbolState(v), Math.random, roundSize()) : buildRound(noWordsState(v), Math.random, roundSize())
    index = 0
    starTotal = round.length
    setStars()
    game.onAnswer(onPick)
    askQuestion()
  }

  // 聲音一出來就開放點擊，不等唸完。一開始沒有提示，發呆太久才提示。
  async function askQuestion () {
    const q = round[index]
    const myIndex = index
    const myGame = game
    firstAttempt = true
    wrongs = 0
    clearIdle()
    busy = true
    game.start(q, { isTrace: kind === 'write' && effectiveTier(currentView()) <= 1 })
    game.lock()
    await wait(350)
    let opened = false
    const open = () => {
      if (opened || index !== myIndex || game !== myGame) return
      opened = true
      game.unlock()
      askedAt = Date.now()
      busy = false
    }
    await audio.say(q.target, { onStart: open })
    open()
    if (index === myIndex && game === myGame) armIdle(q, myIndex, myGame)
  }

  replayBtn.addEventListener('pointerdown', () => {
    if (kind === 'memory' || kind === 'learn' || kind === 'speak' || kind === 'match' || kind === 'fill' || kind === 'tone' || !round[index]) return
    if (busy) return
    sayTarget(round[index].target)
  })

  async function onPick (symbol, el = null) {
    if (busy) return
    const q = round[index]
    const ms = Date.now() - askedAt
    // 描寫沒蓋好：不算錯，晃一下讓她再寫
    if (symbol === '__miss__') { audio.wrong(); game.shake(); game.sad(); game.offerLearn(() => openLearnOverlay(q)); return }
    // 寫寫看按「不會寫」：答案已經照筆順寫在板子上；記成不會（跟寫錯一樣算），但不放錯的音效、不晃，
    // 唸一次答案、出現「教我寫」，她照著寫對才換下一題
    if (symbol === '__giveup__') {
      clearIdle()
      if (firstAttempt) { commit({ target: q.target, ok: false, picked: null, ms, drill: q.drill }); firstAttempt = false }
      setCombo(0) // 連對斷掉，但不震動
      game.offerLearn(() => openLearnOverlay(q))
      const myIndex = index; const myGame = game
      setTimeout(async () => { if (index !== myIndex || game !== myGame) return; await audio.say(q.target) }, 300)
      return
    }
    // 聽寫辨識不出是哪個：算錯但不記混淆對，答案會顯示在板子上讓她照著寫
    if (symbol === '__unknown__') {
      if (firstAttempt) { commit({ target: q.target, ok: false, picked: null, ms, drill: q.drill }); firstAttempt = false }
      rewardWrong()
      audio.wrong(); game.shake(); game.sad()
      if (kind === 'write') game.offerLearn(() => openLearnOverlay(q))
      const myIndex = index; const myGame = game
      setTimeout(async () => { if (index !== myIndex || game !== myGame) return; await audio.say(q.target) }, 500)
      return
    }
    if (symbol === q.target) {
      busy = true
      clearIdle()
      game.lock()
      const bones = questionReward(currentView(), q.target, firstAttempt)
      if (firstAttempt) commit({ target: q.target, ok: true, picked: symbol, ms, drill: q.drill })
      rewardCorrect(firstAttempt, el || playArea.querySelector('.pad-wrap'), bones)
      audio.stop()
      if (kind === 'whack') audio.crunch(); else if (kind === 'write') audio.ding(); else audio.splash()
      await game.celebrate(symbol)
      if (!game) return // 中途按了回首頁
      audio.ding()
      await wait(250)
      if (!game) return
      index++
      if (index >= round.length) return finishRound()
      askQuestion()
      return
    }
    // 答錯：第一次才記錄；錯的晃、狗狗歪頭、重唸一次。錯第二次起正解一直發亮，第三次起再示範（三級提示）
    if (firstAttempt) {
      commit({ target: q.target, ok: false, picked: symbol, ms, drill: q.drill })
      firstAttempt = false
    }
    const step = wrongStep()
    rewardWrong()
    audio.wrong()
    game.shake(symbol)
    game.sad()
    if (step >= 2 && game.mark) game.mark(q.target)
    if (kind === 'write') game.offerLearn(() => openLearnOverlay(q))
    const myIndex = index
    const myGame = game
    setTimeout(async () => {
      if (index !== myIndex || game !== myGame) return
      if (step >= 3 && game.mark) await sayDemo(q.target, myGame)
      else await audio.say(q.target)
      if (index !== myIndex || game !== myGame) return
      armIdle(q, myIndex, myGame)
    }, 500)
  }

  // ---- 唸給狗狗聽（讀）：她看符號自己唸，遊戲不先播音。每題判完狗狗唸一次答案。只記唸對。 ----
  let speakTries = 0
  let listener = null
  let meter = null // 音量計（openMicMeter）
  let meterRaf = 0
  function runSpeak () {
    game = createSpeak(playArea, { color: myColor() })
    replayBtn.classList.add('hidden') // 讀的練習不給聽
    // 每按一次麥克風開一次辨識；網站在 https 上，Chrome 記得權限不會每次問
    if (listener) listener.stop()
    const myGame = game
    listener = createListener()
    listener.onInterim(text => { if (game === myGame && text) game.heard(text) }) // 邊聽邊顯示聽到什麼
    listener.start()
    // 先開音量計（順便要一次麥克風權限），被擋就直接告訴大人，不用等她按
    openMicMeter().then(m => {
      if (game !== myGame) { if (!m.error) m.stop(); return }
      if (m.error) {
        if (m.error === 'denied' || m.error === 'nomic') { game.notice(MIC_MSG[m.error]); game.setMicEnabled(false) }
        return
      }
      meter = m
    })
    round = buildRound(currentView(), Math.random, roundSize())
    index = 0
    starTotal = round.length
    setStars()
    game.onMic(onMicPressed)
    askSpeak()
  }

  async function askSpeak () {
    const q = round[index]
    speakTries = 0
    firstAttempt = true
    busy = true
    game.show(q.target)
    await wait(400)
    busy = false
  }

  // 沒聽到的時候寫給大人看：麥克風收到的最大音量、用的是哪個裝置、辨識的經過
  function micReport () {
    const parts = []
    if (meter) {
      const pct = Math.round(meter.peak() * 100)
      parts.push(`最大音量 ${pct}%` + (pct < 3 ? '（麥克風幾乎沒收到聲音）' : ''))
      parts.push(`麥克風：${meter.label}` + (meter.muted() ? '（被靜音）' : ''))
    }
    parts.push('辨識：' + listener.debug())
    return parts.join('　')
  }

  // 沒回字的時候分兩種：麥克風根本沒收到聲音，還是有聲音但辨識聽不懂
  function silentMsg (target) {
    const hadSound = (meter && meter.peak() >= 0.1) || /(sound|speech)/.test(listener.debug())
    if (!hadSound) return MIC_MSG.silent
    return target.includes(' ') ? MIC_MSG.unclearWord : MIC_MSG.unclear
  }

  async function onMicPressed () {
    if (busy || !game) return
    const q = round[index]
    const myGame = game
    busy = true
    audio.stop()
    game.setListening(true)
    game.notice(MIC_MSG.listening, false)
    // 聽的時候按鈕外圈跟著音量跳
    if (meter) meter.resetPeak()
    const tickMeter = () => {
      if (game !== myGame || !meter) return
      game.setLevel(meter.level())
      meterRaf = requestAnimationFrame(tickMeter)
    }
    tickMeter()
    const { status, transcripts } = await listener.next(5000, alts => matchesSymbol(q.target, alts))
    cancelAnimationFrame(meterRaf)
    if (game !== myGame) return
    game.setLevel(0)
    game.setListening(false)
    // 沒聽到聲音、或麥克風／辨識不能用：不算她唸錯，不播答案
    if (status !== 'heard') {
      if (status === 'silent') { game.notice(silentMsg(q.target) + '　' + micReport(), false); game.sad() } else { game.notice(MIC_MSG[status] || MIC_MSG.unavailable); game.setMicEnabled(false) }
      busy = false
      return
    }
    game.heard(transcripts[0] || '')
    if (matchesSymbol(q.target, transcripts)) {
      const bones = questionReward(currentView(), q.target, firstAttempt)
      if (firstAttempt) commit({ target: q.target, ok: true, picked: q.target, ms: 0, drill: q.drill })
      rewardCorrect(firstAttempt, playArea.querySelector('.sign'), bones)
      audio.ding()
      await game.celebrate()
      if (game !== myGame) return
      await audio.say(q.target) // 對答案：狗狗唸一次正確的
      if (game !== myGame) return
      await wait(200)
      index++
      if (index >= round.length) return finishRound()
      askSpeak()
      return
    }
    // 沒聽出來或唸錯：狗狗歪頭、唸一次答案。兩次沒過就跳下一題，不記錯
    firstAttempt = false
    rewardWrong()
    speakTries++
    game.sad()
    await audio.say(q.target)
    if (game !== myGame) return
    if (speakTries >= 2) {
      earned.push(false)
      setStars()
      await wait(400)
      index++
      if (index >= round.length) return finishRound()
      askSpeak()
      return
    }
    busy = false
  }

  // ---- 連連看（讀）：4 個詞配 4 張圖，記在讀那軌 ----
  function runMatch () {
    game = createMatchLine(playArea, { color: myColor() })
    replayBtn.classList.add('hidden')
    const words = pickSymbols(wordsOnlyState(currentView()), Math.random, MATCH_PAIRS)
    starTotal = words.length
    setStars()
    const firstTry = {}
    const wrongsOf = {} // 每個詞各自錯幾次（三級提示）
    for (const w of words) firstTry[w] = true
    busy = false
    game.onPair(async (word, picked) => {
      if (busy) return
      if (word === picked) {
        busy = true
        const bones = questionReward(currentView(), word, firstTry[word])
        if (firstTry[word]) commit({ target: word, ok: true, picked: word, ms: 0, drill: null })
        rewardCorrect(firstTry[word], playArea.querySelector(`.mpic[data-symbol="${picked}"]`), bones)
        audio.ding()
        game.markCorrect(word, picked)
        await audio.say(word) // 對答案：唸一次這個詞
        busy = false
        return
      }
      if (firstTry[word]) { commit({ target: word, ok: false, picked, ms: 0, drill: null }); firstTry[word] = false }
      // 三級提示：同一個詞錯第一次只晃，第二次起它的圖一直發亮，第三次起再示範（唸「是這一個」和這個詞）
      wrongsOf[word] = Math.min(3, (wrongsOf[word] || 0) + 1)
      rewardWrong()
      audio.wrong()
      game.markWrong(word, picked)
      if (wrongsOf[word] >= 2) game.markAnswer(word)
      if (wrongsOf[word] >= 3) sayDemo(word, game)
    })
    game.onPicTap(w => { if (!busy) audio.say(w) }) // 點圖聽這個詞怎麼唸
    game.onDone(finishRound)
    game.start(words)
  }

  // ---- 填空（讀）：詞少一個音節，拖對的音節進去 ----
  // 填空（mode 'syllable'）與聲調填空（mode 'tone'）共用：一個挑缺的音節，一個挑缺的調號
  function runFill (mode) {
    game = createFillBlank(playArea, { color: myColor() })
    replayBtn.classList.add('hidden')
    const v = wordsOnlyState(currentView(), { pictures: mode !== 'tone' })
    // 聲調填空專挑聲調難分辨的詞，空格放在最難的音節
    round = mode === 'tone' ? buildToneRound(v, Math.random, roundSize()) : buildRound(v, Math.random, roundSize())
    index = 0
    starTotal = round.length
    setStars()
    const pool = activePool(v)
    const allSyllables = [...new Set(pool.flatMap(w => w.split(' ')))]
    let correct = null
    const askFill = () => {
      const q = round[index]
      const syls = q.target.split(' ')
      const bi = mode === 'tone' ? q.blank : Math.floor(Math.random() * syls.length)
      let tiles
      if (mode === 'tone') {
        correct = toneOfSyllable(syls[bi])
        tiles = toneTiles(correct, effectiveTier(currentView()), Math.random)
      } else {
        correct = syls[bi]
        const others = allSyllables.filter(s => s !== correct && !syls.includes(s))
        tiles = [correct]
        while (tiles.length < 3 && others.length) tiles.push(others.splice(Math.floor(Math.random() * others.length), 1)[0])
        tiles.sort(() => Math.random() - 0.5)
      }
      firstAttempt = true
      wrongs = 0
      busy = true
      game.start(q, { blankIndex: bi, tiles, mode })
      // 只聽不看圖的詞：狗狗先唸一次再開放作答（點喇叭可以再聽）
      if (!WORD_ICON[q.target]) {
        const myGame = game
        audio.say(q.target).then(() => { if (game === myGame) { game.unlock(); busy = false } })
        return
      }
      setTimeout(() => { if (game) { game.unlock(); busy = false } }, 350)
    }
    game.onPicTap(() => { if (!busy && round[index]) audio.say(round[index].target) })
    game.onAnswer(async syl => {
      if (busy) return
      const q = round[index]
      const myGame = game
      if (syl === correct) {
        busy = true
        game.lock()
        const bones = questionReward(currentView(), q.target, firstAttempt)
        if (firstAttempt) commit({ target: q.target, ok: true, picked: q.target, ms: 0, drill: q.drill })
        rewardCorrect(firstAttempt, playArea.querySelector('.fill-sign'), bones)
        audio.ding()
        game.fill(syl)
        await game.celebrate()
        if (game !== myGame) return
        await audio.say(q.target) // 對答案
        if (game !== myGame) return
        index++
        if (index >= round.length) return finishRound()
        askFill()
        return
      }
      if (firstAttempt) { commit({ target: q.target, ok: false, picked: null, ms: 0, drill: q.drill }); firstAttempt = false }
      // 三級提示：看的練習錯第一次只晃（唸出來等於說答案），第二次起正確那塊一直發亮，第三次起再示範
      const step = wrongStep()
      rewardWrong()
      audio.wrong()
      game.bounce(syl)
      game.sad()
      if (step >= 2) game.mark(correct)
      if (step >= 3) sayDemo(q.target, myGame)
    })
    askFill()
  }

  // ---- 符號找朋友：看符號（狗狗先唸），從三張圖卡選第一個字有這個音的。記在「認」軌，對錯算在符號上 ----
  // 學寫字寫錯一筆：說出錯在哪。形狀不像就不說話，直接再示範一次
  function sayStrokeFault (fault, symbol) {
    // 記下錯在哪（家長區「筆順最常錯在哪」）
    if (profile && !isTeacher()) {
      const f = state.strokeFaults || { direction: 0, order: 0, shape: 0, bySymbol: {} }
      state = { ...state, strokeFaults: { ...f, [fault]: (f[fault] || 0) + 1, bySymbol: { ...f.bySymbol, [symbol]: (f.bySymbol[symbol] || 0) + 1 } } }
      store.save(profile.id, state)
    }
    if (fault === 'direction') audio.sayText('從圓點開始寫')
    else if (fault === 'order') audio.sayText('先寫亮起來的這一筆')
  }

  function runFriend () {
    game = createFriend(playArea, { color: myColor() })
    replayBtn.classList.remove('hidden') // 再聽一次符號的音
    round = buildRound(singleSymbolState(currentView()), Math.random, roundSize())
    index = 0
    starTotal = round.length
    setStars()
    let answer = null
    const askFriend = async () => {
      const q = round[index]
      const myIndex = index
      const myGame = game
      const fq = buildFriendQuestion(q.target, effectiveTier(currentView()), Math.random)
      answer = fq.answer
      firstAttempt = true
      wrongs = 0
      clearIdle()
      busy = true
      game.start(q.target, fq.options, answer)
      await wait(350)
      let opened = false
      const open = () => {
        if (opened || index !== myIndex || game !== myGame) return
        opened = true
        game.unlock()
        askedAt = Date.now()
        busy = false
      }
      await audio.say(q.target, { onStart: open })
      open()
      if (index === myIndex && game === myGame) armIdle(q, myIndex, myGame)
    }
    game.onAnswer(async (word, el) => {
      if (busy) return
      const q = round[index]
      const myGame = game
      const ms = Date.now() - askedAt
      if (word === answer) {
        busy = true
        clearIdle()
        game.lock()
        const bones = questionReward(currentView(), q.target, firstAttempt)
        if (firstAttempt) commit({ target: q.target, ok: true, picked: q.target, ms, drill: q.drill })
        rewardCorrect(firstAttempt, el, bones)
        audio.ding()
        await game.celebrate(word)
        if (game !== myGame) return
        await audio.say(q.target) // 把符號和詞連在一起唸：「ㄇ，貓」
        if (game !== myGame) return
        await audio.say(word)
        if (game !== myGame) return
        index++
        if (index >= round.length) return finishRound()
        askFriend()
        return
      }
      if (firstAttempt) { commit({ target: q.target, ok: false, picked: null, ms, drill: q.drill }); firstAttempt = false }
      // 三級提示：錯第一次重唸符號，第二次起朋友那張一直發亮，第三次起再示範
      const step = wrongStep()
      rewardWrong()
      audio.wrong()
      game.shake(word)
      game.sad()
      if (step >= 2) game.mark()
      setTimeout(() => {
        if (game !== myGame || busy) return
        if (step >= 3) sayDemo(answer, myGame)
        else audio.say(q.target)
      }, 450)
    })
    askFriend()
  }

  // ---- 數學 ----
  // 數一數、做數量記在「數」軌（題目是數字，照星星一組一組解鎖，最多數到幾由家長設，預設 10）；比多少記在「比」軌
  function countMax () { return state.countMax || 10 }
  // 每局題數：家長區可選 3、5、8、10，所有玩法共用（翻牌、學寫字、連連看、迷宮另有自己的數量）
  function roundSize () { return [3, 5, 8, 10].includes(state.roundSize) ? state.roundSize : 5 }
  function countRound () { return buildRound(countViewOf(currentView(), countMax()), Math.random, roundSize()) }
  const pickIcon = () => COUNT_ICONS[Math.floor(Math.random() * COUNT_ICONS.length)]
  // 一題的共用流程：開題、唸題目、答對換下一題、答錯三級提示（錯 1 次重唸題目、2 次起標出答案、3 次起再示範）
  function mathQuestions ({ ask, target, isRight, onRight, sayQuestion, demoText }) {
    let q = null
    const next = async () => {
      q = round[index]
      const myIndex = index
      const myGame = game
      firstAttempt = true
      wrongs = 0
      clearIdle()
      busy = true
      ask(q)
      await wait(300)
      let opened = false
      const open = () => {
        if (opened || index !== myIndex || game !== myGame) return
        opened = true
        game.unlock()
        askedAt = Date.now()
        busy = false
      }
      await sayQuestion(q, open)
      open()
      // 發呆太久（只有最低兩階）：重唸題目、答案晃一下
      if (q.idleHint && index === myIndex && game === myGame) {
        idleTimer = setTimeout(async () => {
          if (index !== myIndex || game !== myGame || busy) return
          await sayQuestion(q)
          if (index === myIndex && game === myGame) game.hint()
        }, q.idleHint * 1000)
      }
    }
    game.onAnswer(async (picked, el) => {
      if (busy) return
      const myGame = game
      const ms = Date.now() - askedAt
      const t = target(q)
      if (isRight(q, picked)) {
        busy = true
        clearIdle()
        game.lock()
        const bones = questionReward(currentView(), t, firstAttempt)
        if (firstAttempt) commit({ target: t, ok: true, picked: t, ms, drill: null })
        rewardCorrect(firstAttempt, el, bones)
        audio.ding()
        await game.celebrate(picked)
        if (game !== myGame) return
        if (onRight) await onRight(q)
        if (game !== myGame) return
        index++
        if (index >= round.length) return finishRound()
        next()
        return
      }
      if (firstAttempt) { commit({ target: t, ok: false, picked: null, ms, drill: null }); firstAttempt = false }
      const step = wrongStep()
      rewardWrong()
      audio.wrong()
      game.shake(picked)
      game.sad()
      if (step >= 2) game.mark()
      setTimeout(async () => {
        if (game !== myGame || busy) return
        if (step >= 3) { await audio.sayText('是這一個'); const t = demoText(q); if (t && game === myGame) audio.sayText(t) } else sayQuestion(q)
      }, 450)
    })
    next()
  }

  // 數一數：框裡有幾個東西，從三張數字卡選。點東西會蓋上數字、唸出來，幫她一個一個數
  function runCount () {
    game = createCount(playArea, { color: myColor() })
    replayBtn.classList.add('hidden')
    round = countRound()
    index = 0
    starTotal = round.length
    setStars()
    game.onCountTap(k => audio.sayText(String(k)))
    const tier = effectiveTier(currentView())
    mathQuestions({
      ask: q => {
        const n = Number(q.target)
        q.mix = tier >= 3 && n <= 10 && Math.random() < 0.6 ? countMixed(n, tier, Math.random) : null
        game.start(n, pickIcon(), countOptions(n, tier, Math.random), scatter(n, Math.random), q.mix)
      },
      target: q => q.target,
      isRight: (q, picked) => picked === Number(q.target),
      onRight: q => audio.sayText(q.target + '個'),
      sayQuestion: (q, onStart) => audio.sayText(q.mix ? '左上角這個，有幾個？' : '有幾個？', { onStart }),
      demoText: q => q.target + '個',
    })
  }

  // 做數量：看數字，把東西點進盒子裡，放好按打勾
  function runMake () {
    game = createMake(playArea, { color: myColor() })
    replayBtn.classList.add('hidden')
    round = countRound()
    index = 0
    starTotal = round.length
    setStars()
    game.onMove(k => { if (k > 0) audio.sayText(String(k)) })
    mathQuestions({
      ask: q => game.start(Number(q.target), pickIcon(), makePoolSize(Number(q.target), effectiveTier(currentView()))),
      target: q => q.target,
      isRight: (q, picked) => picked === Number(q.target),
      onRight: q => audio.sayText(q.target + '個，放好了'),
      sayQuestion: (q, onStart) => audio.sayText('放' + q.target + '個', { onStart }),
      demoText: q => '要放' + q.target + '個',
    })
  }

  // 比多少：左右兩框，問哪一邊比較多或比較少
  function runCompare () {
    game = createCompare(playArea, { color: myColor() })
    replayBtn.classList.add('hidden')
    const tier = effectiveTier(trackView(state, 'compare'))
    round = Array.from({ length: roundSize() }, (_, i) => {
      const q = compareQuestion(tier, Math.random, i % 2 ? 'less' : 'more', { equal: tier >= 4 })
      return { ...q, target: q.ask, idleHint: tier <= 1 ? 10 : 0 }
    }).sort(() => Math.random() - 0.5)
    index = 0
    starTotal = round.length
    setStars()
    mathQuestions({
      ask: q => game.start(q, pickIcon(), { left: scatter(q.left, Math.random), right: scatter(q.right, Math.random) }),
      target: q => q.target,
      isRight: (q, picked) => picked === q.answer,
      onRight: q => audio.sayText(q.answer === 'equal' ? '兩邊一樣多' : q.ask === 'more' ? '這邊比較多' : '這邊比較少'),
      sayQuestion: (q, onStart) => audio.sayText((q.ask === 'more' ? '哪一邊比較多？' : '哪一邊比較少？') + (q.equal ? '還是一樣多？' : ''), { onStart }),
      demoText: q => q.answer === 'equal' ? '兩邊一樣多' : q.ask === 'more' ? '這邊比較多' : '這邊比較少',
    })
  }

  // 加減：十以內，一組一組解鎖（加到 5、5 以內減、加到 10…）；怎麼出照階級：只有圖 → 數字配圖 → 只有數字
  function runCalc () {
    game = createCalc(playArea, { color: myColor() })
    replayBtn.classList.add('hidden')
    // 階級越高開越多組：第 1 階至少開第 1 組、第 6 階六組全開；練熟了照常自動往後開
    const tier = effectiveTier(currentView())
    round = buildRound({ ...currentView(), groups: CALC_GROUPS, rangeGroups: null, unlockedUpTo: tier + 1, known: [] }, Math.random, roundSize())
    index = 0
    starTotal = round.length
    setStars()
    const look = calcLook(tier)
    mathQuestions({
      ask: q => {
        const c = parseCalc(q.target)
        game.start(c, pickIcon(), countOptions(c.answer, tier, Math.random), look)
      },
      target: q => q.target,
      isRight: (q, picked) => picked === parseCalc(q.target).answer,
      onRight: q => audio.sayText(calcSay(q.target, true)),
      // 只有圖的時候不唸算式：加法問一共幾個、減法問還剩幾個
      sayQuestion: (q, onStart) => audio.sayText(look === 'pictures' ? (parseCalc(q.target).op === '+' ? '一共有幾個？' : '拿走打叉的，還剩幾個？') : calcSay(q.target), { onStart }),
      demoText: q => calcSay(q.target, true),
    })
  }

  // ---- 動腦 ----
  // 找規律、找不同：一局 5 題，題型照這一軌的階級；記錄的題目是題型（找規律 'fill:AB'、找不同 'odd:flip'）
  function brainRound (make) {
    const tier = effectiveTier(currentView())
    return Array.from({ length: roundSize() }, () => ({ ...make(tier), idleHint: tier <= 1 ? 10 : 0 }))
  }
  const PATTERN_ASK = { fill: '空格裡是哪一個？', repeat: '哪一段一直重複？', translate: '哪一排的規律一樣？' }
  function runPattern () {
    game = createPattern(playArea, { color: myColor() })
    replayBtn.classList.add('hidden')
    round = brainRound(tier => { const p = patternQuestion(tier, Math.random); return { ...p, target: p.mode + ':' + p.type } })
    index = 0
    starTotal = round.length
    setStars()
    mathQuestions({
      ask: q => game.start(q),
      target: q => q.target,
      isRight: (q, i) => i === game.answerIndex(),
      onRight: null,
      sayQuestion: (q, onStart) => audio.sayText(PATTERN_ASK[q.mode], { onStart }),
      demoText: () => '',
    })
  }
  // 圖形類比、拼板補洞：跟找規律記在同一軌（律），題目是變化的種類、板子大小
  function runAnalogy () {
    game = createAnalogy(playArea, { color: myColor() })
    replayBtn.classList.add('hidden')
    round = brainRound(tier => { const a = analogyQuestion(tier, Math.random); return { ...a, target: 'analogy:' + a.kind } })
    index = 0
    starTotal = round.length
    setStars()
    mathQuestions({
      ask: q => game.start(q),
      target: q => q.target,
      isRight: (q, i) => i === q.answerIndex,
      onRight: null,
      sayQuestion: (q, onStart) => audio.sayText('上面這個變成這樣，下面的會變成哪一個？', { onStart }),
      demoText: () => '',
    })
  }
  function runTiles () {
    game = createTiles(playArea, { color: myColor() })
    replayBtn.classList.add('hidden')
    round = brainRound(tier => { const t = tilesQuestion(tier, Math.random); return { ...t, target: 'tiles:' + t.n } })
    index = 0
    starTotal = round.length
    setStars()
    mathQuestions({
      ask: q => game.start(q),
      target: q => q.target,
      isRight: (q, i) => i === q.answerIndex,
      onRight: null,
      sayQuestion: (q, onStart) => audio.sayText('照左邊的圖，缺的是哪一塊？', { onStart }),
      demoText: () => '',
    })
  }
  function runOdd () {
    game = createOdd(playArea, { color: myColor() })
    replayBtn.classList.add('hidden')
    round = brainRound(tier => { const o = oddQuestion(tier, Math.random); return { ...o, target: 'odd:' + o.kind } })
    index = 0
    starTotal = round.length
    setStars()
    mathQuestions({
      ask: q => game.start(q),
      target: q => q.target,
      isRight: (q, i) => i === q.odd,
      onRight: null,
      sayQuestion: (q, onStart) => audio.sayText('哪一個不一樣？', { onStart }),
      demoText: () => '',
    })
  }
  // 迷宮：一局三關，從比較簡單的開始，最後一關是這一軌現在的階級。撞牆三次以上這一關就不算第一次就會
  function runMaze () {
    game = createMaze(playArea, { color: myColor() })
    replayBtn.classList.add('hidden')
    const tier = effectiveTier(currentView())
    round = [Math.max(0, tier - 2), Math.max(0, tier - 1), tier].map(t => ({ target: 'maze' + t, level: mazeLevel(t, Math.random) }))
    index = 0
    starTotal = round.length
    setStars()
    let bumps = 0
    const myGame = game
    const next = () => {
      bumps = 0
      const lv = round[index].level
      game.start(lv)
      audio.sayText(lv.items.length ? '先撿骨頭，再回家' : '走回家')
      game.unlock()
    }
    game.onBump(() => { bumps++; audio.wrong(); buzz(30) })
    game.onMove(k => { if (k === 'item') { audio.ding(); buzz(20) } })
    game.onDone(async () => {
      const q = round[index]
      const ok = bumps < 3
      const bones = questionReward(currentView(), q.target, ok)
      if (!isTeacher()) commit({ target: q.target, ok, picked: q.target, ms: 0, drill: null })
      rewardCorrect(ok, playArea.querySelector('.maze-exit'), bones)
      audio.cheer()
      await wait(900)
      if (game !== myGame) return
      index++
      if (index >= round.length) return finishRound()
      next()
    })
    next()
  }

  // 經典找不同：一局三頁，差異 3～5 個照階級。點錯三次以上這一頁就不算第一次就會；點錯兩次起標出一個（三級提示的意思）
  function runSpot () {
    game = createSpot(playArea, { color: myColor() })
    replayBtn.classList.add('hidden')
    const tier = effectiveTier(currentView())
    round = [Math.max(0, tier - 1), tier, tier].map(t => ({ target: 'spot' + t, scene: spotScene(t, Math.random) }))
    index = 0
    starTotal = round.length
    setStars()
    let misses = 0
    const myGame = game
    const next = () => {
      misses = 0
      game.start(round[index].scene)
      audio.sayText('找找看，哪裡不一樣？')
    }
    game.onMiss(() => {
      misses++
      audio.wrong()
      if (misses === 2 || misses === 4) game.mark()
    })
    game.onFound(() => { audio.ding(); buzz(20) })
    game.onDone(async () => {
      const q = round[index]
      const ok = misses < 3
      const bones = questionReward(currentView(), q.target, ok)
      commit({ target: q.target, ok, picked: q.target, ms: 0, drill: null })
      rewardCorrect(ok, playArea.querySelector('.spot-dots'), bones)
      audio.cheer()
      await wait(1200)
      if (game !== myGame) return
      index++
      if (index >= round.length) return finishRound()
      next()
    })
    next()
  }

  // 著色：照順序換一張線稿；選顏色、點一塊塗滿。塗了一半以上按打勾就完成（給 2 根），太少請她多塗一點
  function runColoring () {
    game = createColoring(playArea, { color: myColor() })
    replayBtn.classList.add('hidden')
    starTotal = 1
    setStars()
    const pic = (state.colorNext || 0) % COLOR_PICTURES.length
    if (!isTeacher()) { state = { ...state, colorNext: pic + 1 }; store.save(profile.id, state) }
    game.start(pic)
    game.onPaint(() => audio.pop())
    game.onDone(async ratio => {
      if (ratio < 0.5) { audio.sayText('再多塗一點點'); return }
      game.lock()
      earned.push(true)
      setStars()
      gain(2, game.svgEl)
      audio.cheer()
      await wait(800)
      finishRound()
    })
  }

  // ---- 拼拼看：聽一個音，照順序（由上往下）把符號拖進空格拼出來 ----
  // 放對一塊唸那個符號，全部拼好唸整個音對答案。中間放錯一塊這題就算錯（只記一次），可以繼續拼完。
  function runSpell () {
    spellFlow({
      game: createSpell(playArea, { color: myColor() }),
      round: buildRound(syllablesOnlyState(currentView()), Math.random, roundSize()),
      piecesOf: q => [...coreOf(q.target)],
      tilesOf: q => spellTiles(q.target, effectiveTier(currentView()), Math.random),
      sayPiece: p => audio.say(p),
    })
  }
  // 拼的共用流程（注音拼拼看、英文拼單字）：照順序把磁磚放進格子；放對一塊唸那一塊，全部拼好唸整個。
  // 中間放錯一次這題就算錯（只記一次）；三級提示：錯 1 次重唸整個、2 次起下一塊一直發亮、3 次起再示範那一塊
  function spellFlow ({ game: g, round: r, piecesOf, tilesOf, sayPiece }) {
    game = g
    replayBtn.classList.remove('hidden')
    round = r
    index = 0
    starTotal = round.length
    setStars()
    let pieces = []
    let placed = 0
    const askSpell = async () => {
      const q = round[index]
      const myIndex = index
      const myGame = game
      pieces = piecesOf(q)
      placed = 0
      firstAttempt = true
      wrongs = 0
      clearIdle()
      busy = true
      game.start(q, { pieces, tiles: tilesOf(q) })
      await wait(350)
      let opened = false
      const open = () => {
        if (opened || index !== myIndex || game !== myGame) return
        opened = true
        game.unlock()
        busy = false
      }
      await sayTarget(q.target, { onStart: open })
      open()
      if (index === myIndex && game === myGame) armIdle(q, myIndex, myGame)
    }
    game.onAnswer(async sym => {
      if (busy) return
      const q = round[index]
      const myGame = game
      if (sym === pieces[placed]) {
        placed++
        game.fill(sym)
        if (placed < pieces.length) {
          sayPiece(sym)
          if (wrongs >= 2) game.mark() // 已經在標答案了：換下一塊亮
          armIdle(q, index, myGame)
          return
        }
        busy = true
        clearIdle()
        game.lock()
        const bones = questionReward(currentView(), q.target, firstAttempt)
        if (firstAttempt) commit({ target: q.target, ok: true, picked: q.target, ms: 0, drill: q.drill })
        audio.ding()
        game.complete()
        rewardCorrect(firstAttempt, playArea.querySelector('.spell-sign'), bones)
        await game.celebrate()
        if (game !== myGame) return
        await sayTarget(q.target) // 對答案
        if (game !== myGame) return
        index++
        if (index >= round.length) return finishRound()
        askSpell()
        return
      }
      if (firstAttempt) { commit({ target: q.target, ok: false, picked: null, ms: 0, drill: q.drill }); firstAttempt = false }
      const step = wrongStep()
      rewardWrong()
      audio.wrong()
      game.bounce(sym)
      game.sad()
      if (step >= 2) game.mark()
      const need = pieces[placed]
      setTimeout(async () => {
        if (game !== myGame || busy) return
        if (step >= 3) { await audio.sayText('是這一個'); if (game === myGame) sayPiece(need) } else sayTarget(q.target)
      }, 450)
    })
    askSpell()
  }

  // ---- 英文：認字母、聽發音（字軌，題目是大寫字母）、拼單字（拼英軌，題目是單字） ----
  const engView = groups => ({ ...currentView(), groups, rangeGroups: null, unlockedUpTo: null, known: [] })
  const engImg = w => `<img class="emoji emoji-img" src="img/emoji/${twemojiName(ENGLISH_ICON[w])}.svg" alt="">`
  const engLetter = l => `<span class="eng-big">${l}<small>${l.toLowerCase()}</small></span>`
  // 看大字母（狗狗唸字母），從三張圖選開頭是這個字母的；答對唸「A, apple」
  function runLetterPic () {
    sayTargetFn = (t, opts) => audio.sayEnglish(t, opts)
    game = createFriend(playArea, { color: myColor(), symbolHtml: engLetter, picHtml: engImg })
    replayBtn.classList.remove('hidden')
    round = buildRound(engView(LETTER_GROUPS), Math.random, roundSize())
    engChoice(q => letterPictureQuestion(q.target, effectiveTier(currentView()), Math.random), (q, w) => audio.sayEnglish(q.target + ', ' + w))
  }
  // 聽一個字母，從幾張字母卡選
  function runLetterHear () {
    sayTargetFn = (t, opts) => audio.sayEnglish(t, opts)
    game = createFriend(playArea, { color: myColor(), symbolHtml: () => ENG_SPEAKER, picHtml: l => `<span class="eng-card">${l}<small>${l.toLowerCase()}</small></span>` })
    replayBtn.classList.remove('hidden')
    round = buildRound(engView(LETTER_GROUPS), Math.random, roundSize())
    engChoice(q => ({ answer: q.target, options: letterOptions(q.target, effectiveTier(currentView()), Math.random) }), q => audio.sayEnglish(q.target))
  }
  // 認字母、聽發音共用：唸題目、選一張；三級提示照「符號找朋友」
  function engChoice (makeQ, onRight) {
    index = 0
    starTotal = round.length
    setStars()
    let answer = null
    const ask = async () => {
      const q = round[index]
      const myIndex = index
      const myGame = game
      const eq = makeQ(q)
      answer = eq.answer
      firstAttempt = true
      wrongs = 0
      clearIdle()
      busy = true
      game.start(q.target, eq.options, answer)
      await wait(350)
      let opened = false
      const open = () => {
        if (opened || index !== myIndex || game !== myGame) return
        opened = true
        game.unlock()
        askedAt = Date.now()
        busy = false
      }
      await audio.sayEnglish(q.target, { onStart: open })
      open()
      if (index === myIndex && game === myGame) armIdle(q, myIndex, myGame)
    }
    game.onAnswer(async (word, el) => {
      if (busy) return
      const q = round[index]
      const myGame = game
      const ms = Date.now() - askedAt
      if (word === answer) {
        busy = true
        clearIdle()
        game.lock()
        const bones = questionReward(currentView(), q.target, firstAttempt)
        if (firstAttempt) commit({ target: q.target, ok: true, picked: q.target, ms, drill: q.drill })
        rewardCorrect(firstAttempt, el, bones)
        audio.ding()
        await game.celebrate(word)
        if (game !== myGame) return
        await onRight(q, word)
        if (game !== myGame) return
        index++
        if (index >= round.length) return finishRound()
        ask()
        return
      }
      if (firstAttempt) { commit({ target: q.target, ok: false, picked: null, ms, drill: q.drill }); firstAttempt = false }
      const step = wrongStep()
      rewardWrong()
      audio.wrong()
      game.shake(word)
      game.sad()
      if (step >= 2) game.mark()
      setTimeout(async () => {
        if (game !== myGame || busy) return
        if (step >= 3) { await audio.sayText('是這一個'); if (game === myGame) audio.sayEnglish(answer) } else audio.sayEnglish(q.target)
      }, 450)
    })
    ask()
  }
  // 拼單字：看圖聽單字，把字母照順序拖進橫排的格子
  function runWordSpell () {
    sayTargetFn = (t, opts) => audio.sayEnglish(t, opts)
    spellFlow({
      game: createSpell(playArea, { color: myColor(), horizontal: true, glyph: l => `<b class="eng-tile">${l}</b>`, whole: w => `<b class="eng-whole">${w}</b>`, picHtml: engImg }),
      round: buildRound(engView(SPELL_GROUPS), Math.random, roundSize()),
      piecesOf: q => q.target.toUpperCase().split(''),
      tilesOf: q => wordTiles(q.target, effectiveTier(currentView()), Math.random),
      sayPiece: l => audio.sayEnglish(l),
    })
  }

  // ---- 翻牌：純遊玩。不寫進熟練度、混淆對、升降級，骨頭也只有配對那一點，沒有過關獎勵 ----
  function runMemory () {
    game = createMemory(playArea)
    replayBtn.classList.add('hidden')
    const symbols = pickSymbols(noWordsState(trackView(state, 'listen')), Math.random, MEMORY_PAIRS)
    starTotal = symbols.length
    setStars()
    game.onFlip(sym => { audio.flip(); audio.say(sym) })
    game.onPair(sym => {
      const cards = playArea.querySelectorAll(`.mcard[data-symbol="${sym}"]`)
      earned.push(true)
      setStars()
      gain(1, cards[1] || null)
      cards.forEach(c => burstAt(c, { count: 8 }))
      audio.ding()
    })
    game.onDone(finishRound)
    game.start(symbols)
  }

  // ---- 學寫字：純練習。從「寫」軌最不熟的單一符號開始，照教育部筆順一筆一筆教，寫完一個給 1 根 ----
  async function runLearn () {
    game = createLearn(playArea, { color: myColor(), onFault: sayStrokeFault })
    replayBtn.classList.add('hidden')
    const symbols = pickSymbols(singleSymbolState(trackView(state, 'write')), Math.random, LEARN_SYMBOLS)
    starTotal = symbols.length
    setStars()
    const myGame = game
    for (const sym of symbols) {
      audio.say(sym)
      await game.teach(sym)
      if (game !== myGame) return
      earned.push(true)
      setStars()
      gain(1, game.pad)
      audio.ding()
      await wait(300)
      if (game !== myGame) return
    }
    finishRound()
  }

  // ---- 數字筆順、英文筆順：照順序一次教三個（0、1、2… 或 A、B、C…），接著上次教到的地方；純練習，寫完一個給 1 根 ----
  async function runLatinWrite (list, key, say) {
    game = createLearn(playArea, { color: myColor(), onFault: sayStrokeFault })
    replayBtn.classList.add('hidden')
    const next = (state.writeNext && state.writeNext[key]) || 0
    const symbols = [0, 1, 2].map(i => list[(next + i) % list.length])
    starTotal = symbols.length
    setStars()
    const myGame = game
    for (const [i, sym] of symbols.entries()) {
      say(sym)
      await game.teach(sym)
      if (game !== myGame) return
      if (!isTeacher()) {
        state = { ...state, writeNext: { ...(state.writeNext || {}), [key]: (next + i + 1) % list.length } }
        store.save(profile.id, state)
      }
      earned.push(true)
      setStars()
      gain(1, game.pad)
      audio.ding()
      await wait(300)
      if (game !== myGame) return
    }
    finishRound()
  }

  // ---- 注音表：37 個符號，點一個就照筆順寫一次、唸出來。純看，不記進度、不給骨頭 ----
  function runChart () {
    game = createChart(playArea, { onPick: sym => audio.say(sym) })
    replayBtn.classList.add('hidden')
  }

  // 「寫給狗狗看」寫錯後按「教我寫」：學寫字疊在上面教這個符號，教完回到同一題再寫一次。
  // 這題已經記成錯了，回來再寫對只拿重試的骨頭。
  function openLearnOverlay (q) {
    if (learnOverlay || !game) return
    clearIdle()
    busy = true
    game.lock()
    audio.stop()
    const myGame = game
    const el = document.createElement('div')
    el.className = 'learn-overlay'
    playArea.appendChild(el)
    let closed = false
    const close = () => {
      if (closed) return
      closed = true
      if (learnOverlay) learnOverlay.destroy()
      learnOverlay = null
      el.remove()
      if (game !== myGame) return
      game.start(q, { isTrace: effectiveTier(currentView()) <= 1 })
      game.unlock()
      busy = false
      audio.say(q.target)
      armIdle(q, index, myGame)
    }
    learnOverlay = createLearn(el, { color: myColor(), overlay: true, onClose: close, onFault: sayStrokeFault })
    audio.say(q.target)
    learnOverlay.teach(q.target).then(close)
  }

  // ---- 大人面板 ----
  let panelTrack = 'listen'
  let panelPage = null // 進度格看哪一頁；null 跟著軌道走
  function openPanel () {
    destroyGame()
    renderPanel(panelEl, {
      profile,
      profiles: store.loadProfiles(),
      state: state ? trackView(state, panelTrack) : null,
      full: state,
      track: panelTrack,
      page: panelPage,
      onTrack (t) { panelTrack = t; panelPage = null; openPanel() },
      onPage (p) { panelPage = p; openPanel() },
      // 調完音量放一段聽聽看；背景音樂放三秒
      onVolumeTest (key) {
        audio.unlock()
        if (key === 'voiceVol') audio.say('ㄅ')
        else if (key === 'sfxVol') audio.ding()
        else {
          audio.startMusic()
          audio.setMusicVolume()
          setTimeout(() => { if (currentScreen === 'panel') audio.stopMusic() }, 3000)
        }
      },
      settings,
      voices: audio.listVoices(),
      onKnownChange (symbol, checked) {
        const known = state.known.filter(s => s !== symbol)
        if (checked) known.push(symbol)
        state = { ...state, known }
        store.save(profile.id, state)
        openPanel()
      },
      onSettings (next) {
        settings = next
        saveSettings(settings)
        openPanel()
      },
      // 階級、最近答題是這一軌的；其他（鎖階、範圍、跳級）各軌共用
      onStateChange (partial) {
        const trackKeys = ['tier', 'recent']
        if (Object.keys(partial).some(k => trackKeys.includes(k))) {
          state = applyTrack(state, panelTrack, { ...trackView(state, panelTrack), ...partial })
        } else {
          state = { ...state, ...partial }
        }
        store.save(profile.id, state)
        openPanel()
      },
      onExport () {
        const blob = new Blob([store.exportJson(state)], { type: 'application/json' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = 'kids-learning-lab-' + profile.name + '.json'
        a.click()
      },
      onImport (text) {
        try {
          state = store.importJson(text)
          store.save(profile.id, state)
          openPanel()
        } catch (err) {
          panelMessage(panelEl, '匯入失敗：' + err.message)
        }
      },
      onResetProgress () {
        state = resetProgress(state)
        store.save(profile.id, state)
        openPanel()
      },
      onRemoveProfile (id) {
        store.removeProfile(id)
        if (profile && profile.id === id) {
          profile = null
          state = null
        }
        openPanel()
      },
      onClose () { profile ? goHome() : goProfiles() },
      onSay (symbol) { audio.say(symbol) },
      onCheck: openCheck,
    })
    show('panel')
  }

  // 發音檢查台：借用家長區的畫面容器
  function openCheck () {
    renderCheck(panelEl, {
      audio,
      settings,
      onSettings (next) { settings = next; saveSettings(settings) },
      onClose: openPanel,
    })
    show('panel')
  }

  // 開機：有記住上次的人就直接進首頁，否則選人
  const profiles = store.loadProfiles()
  if (profiles.current && profiles.list.some(p => p.id === profiles.current)) {
    pickProfile(profiles.current)
  } else {
    goProfiles()
  }
}

function wait (ms) { return new Promise(r => setTimeout(r, ms)) }

document.addEventListener('DOMContentLoaded', main)

// 離線版：註冊 sw.js，第一次有網路打開就把整個遊戲存進裝置。直接開檔案（file://）不支援，就照舊上網用
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('離線版註冊失敗：', err))
  })
}
