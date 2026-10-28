// 發音與音效。語音合成唸代表字；audio/ 資料夾有錄音就改播錄音；音效全部現場合成。

import { REP_CHAR } from './data.js'

// getSettings 回傳目前設定 { voiceName, rate, repChar, voiceVol, sfxVol, musicVol }，每次唸都重新拿，面板改了馬上生效。
// 三個音量都是 0～1，沒設就是 1：voiceVol 發音（錄音和語音合成）、sfxVol 音效、musicVol 背景音樂。
export function createAudio (getSettings) {
  let ctx = null
  let voices = []
  const recordingExists = {} // 符號 → true/false，第一次試過就記住
  let sfxBus = null // 所有音效先經過這一個音量鈕

  function vol (key) {
    const v = getSettings()[key]
    return typeof v === 'number' ? Math.min(1, Math.max(0, v)) : 1
  }
  function sfxOut () {
    if (!sfxBus) { sfxBus = ctx.createGain(); sfxBus.connect(ctx.destination) }
    sfxBus.gain.value = vol('sfxVol')
    return sfxBus
  }

  function refreshVoices () {
    if (!('speechSynthesis' in window)) return
    voices = window.speechSynthesis.getVoices()
  }
  if ('speechSynthesis' in window) {
    refreshVoices()
    window.speechSynthesis.onvoiceschanged = refreshVoices
  }

  function pickVoice () {
    refreshVoices()
    const settings = getSettings()
    if (settings.voiceName) {
      const chosen = voices.find(v => v.name === settings.voiceName)
      if (chosen) return chosen
    }
    const tw = voices.filter(v => /zh[-_]TW/i.test(v.lang))
    return tw.find(v => /Google/i.test(v.name)) || tw[0] ||
      voices.find(v => /^zh/i.test(v.lang)) || null
  }

  // 第一次觸碰時呼叫：建立 AudioContext、暖機語音合成。
  function unlock () {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (AC) ctx = new AC()
    }
    if (ctx && ctx.state === 'suspended') ctx.resume()
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(' ')
      u.volume = 0
      window.speechSynthesis.speak(u)
    }
  }

  function speakTts (text) {
    return new Promise(resolve => {
      if (!('speechSynthesis' in window)) return resolve()
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'zh-TW'
      u.rate = getSettings().rate || 0.8
      u.volume = vol('voiceVol')
      const v = pickVoice()
      if (v) u.voice = v
      let done = false
      const finish = () => { if (!done) { done = true; resolve() } }
      u.onend = finish
      u.onerror = finish
      setTimeout(finish, 3000) // 語音卡住也不要卡遊戲
      window.speechSynthesis.speak(u)
    })
  }

  const RECORDING_EXTS = ['wav', 'mp3']
  // 打包時 build.js 把 audio/ 裡有的檔名寫進 AUDIO_FILES：有錄音的一開網頁就先載好，沒錄音的不用上網找。
  // 單獨載入模組（沒經過打包）時沒有這份清單，照舊一個一個試。
  // eslint-disable-next-line no-undef
  const knownFiles = typeof AUDIO_FILES === 'undefined' ? null : AUDIO_FILES
  const preloaded = {} // 網址 → 已經載好的 Audio，重複用
  if (knownFiles && typeof Audio !== 'undefined') {
    for (const f of knownFiles) {
      const dot = f.lastIndexOf('.')
      const url = 'audio/' + encodeURIComponent(f.slice(0, dot)) + f.slice(dot)
      const el = new Audio()
      el.preload = 'auto'
      el.src = url
      preloaded[url] = el
    }
  }
  // 有清單時：這個符號的錄音網址，沒有就是 null
  function knownUrl (symbol) {
    for (const ext of RECORDING_EXTS) {
      if (knownFiles.includes(symbol + '.' + ext)) return 'audio/' + encodeURIComponent(symbol) + '.' + ext
    }
    return null
  }
  let currentEl = null // 正在播的錄音，換題時先停掉

  // onStart 在聲音真的開始出來時呼叫，讓遊戲可以提早開放點擊
  function playFile (url, onStart) {
    return new Promise(resolve => {
      const el = preloaded[url] || new Audio(url)
      try { el.currentTime = 0 } catch (err) { /* 還沒載好就從頭播 */ }
      el.volume = vol('voiceVol')
      currentEl = el
      el.onplaying = () => { if (onStart) onStart() }
      el.onended = () => resolve(true)
      // 被 stop() 中斷也要讓等待的人繼續。同一個 Audio 重複用：上一次被停掉的 pause 事件晚一步才到，這時已經又在播了，不算
      el.onpause = () => { if (el.paused) resolve(true) }
      el.onerror = () => resolve(false)
      el.play().catch(() => resolve(false))
    })
  }

  // audio/ㄅ.wav 或 audio/ㄅ.mp3，哪個有就播哪個。找過一次的結果記住，不重複試。
  async function playRecording (symbol, onStart) {
    const known = recordingExists[symbol]
    if (known === false) return false
    if (typeof known === 'string') return playFile(known, onStart)
    if (knownFiles) {
      const url = knownUrl(symbol)
      recordingExists[symbol] = url || false
      return url ? playFile(url, onStart) : false
    }
    for (const ext of RECORDING_EXTS) {
      const url = 'audio/' + encodeURIComponent(symbol) + '.' + ext
      if (await playFile(url, onStart)) { recordingExists[symbol] = url; return true }
    }
    recordingExists[symbol] = false
    return false
  }

  // 查這個符號會用哪個音源：'recording' 或 'tts'。只載入不播放，結果一樣記進 recordingExists。
  function sourceOf (symbol) {
    const known = recordingExists[symbol]
    if (known === false) return Promise.resolve('tts')
    if (typeof known === 'string') return Promise.resolve('recording')
    if (knownFiles) {
      recordingExists[symbol] = knownUrl(symbol) || false
      return Promise.resolve(recordingExists[symbol] ? 'recording' : 'tts')
    }
    return new Promise(resolve => {
      const tryExt = i => {
        if (i >= RECORDING_EXTS.length) { recordingExists[symbol] = false; return resolve('tts') }
        const url = 'audio/' + encodeURIComponent(symbol) + '.' + RECORDING_EXTS[i]
        const el = new Audio()
        el.preload = 'metadata'
        el.onloadedmetadata = () => { recordingExists[symbol] = url; resolve('recording') }
        el.onerror = () => tryExt(i + 1)
        el.src = url
      }
      tryExt(0)
    })
  }

  function stop () {
    if (currentEl) { currentEl.pause(); currentEl = null }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  }

  // 唸一個符號。回傳 Promise，唸完才 resolve。有官方錄音就播錄音，沒有才用語音合成。
  async function say (symbol, { onStart } = {}) {
    stop()
    if (await playRecording(symbol, onStart)) return
    const settings = getSettings()
    const text = (settings.repChar && settings.repChar[symbol]) || REP_CHAR[symbol] || symbol
    if (onStart) onStart()
    await speakTts(text)
  }

  // 唸英文（字母、單字）：挑英文的聲音，沒有就交給瀏覽器
  function sayEnglish (text, { onStart } = {}) {
    stop()
    return new Promise(resolve => {
      if (!('speechSynthesis' in window)) { if (onStart) onStart(); return resolve() }
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'en-US'
      u.rate = 0.85
      u.volume = vol('voiceVol')
      const all = window.speechSynthesis.getVoices()
      const v = all.find(x => /^en[-_]US/i.test(x.lang)) || all.find(x => /^en/i.test(x.lang))
      if (v) u.voice = v
      let done = false
      const finish = () => { if (!done) { done = true; resolve() } }
      u.onstart = () => { if (onStart) onStart() }
      u.onend = finish
      u.onerror = finish
      setTimeout(() => { if (onStart) onStart(); finish() }, 3000)
      window.speechSynthesis.speak(u)
    })
  }

  // 唸一句話（數學題的「有幾個？」這類），不找錄音檔，直接語音合成
  async function sayText (text, { onStart } = {}) {
    stop()
    if (onStart) onStart()
    await speakTts(text)
  }

  function tone (freq, start, dur, type = 'sine', gain = 0.25) {
    if (!ctx) return
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, ctx.currentTime + start)
    g.gain.setValueAtTime(0, ctx.currentTime + start)
    g.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.02)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur)
    o.connect(g).connect(sfxOut())
    o.start(ctx.currentTime + start)
    o.stop(ctx.currentTime + start + dur + 0.05)
  }

  function ding () { tone(880, 0, 0.18); tone(1320, 0.12, 0.3) }
  function wrong () {
    if (!ctx) return
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'triangle'
    o.frequency.setValueAtTime(300, ctx.currentTime)
    o.frequency.linearRampToValueAtTime(380, ctx.currentTime + 0.25)
    g.gain.setValueAtTime(0.2, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
    o.connect(g).connect(sfxOut())
    o.start()
    o.stop(ctx.currentTime + 0.4)
  }
  function splash () {
    if (!ctx) return
    const len = ctx.sampleRate * 0.35
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2)
    const src = ctx.createBufferSource()
    src.buffer = buf
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = 1200
    const g = ctx.createGain()
    g.gain.value = 0.4
    src.connect(f).connect(g).connect(sfxOut())
    src.start()
  }
  // 咬餅乾：短短的雜訊
  function crunch () {
    if (!ctx) return
    const len = Math.floor(ctx.sampleRate * 0.12)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.5)
    const src = ctx.createBufferSource()
    src.buffer = buf
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = 2200
    const g = ctx.createGain()
    g.gain.value = 0.5
    src.connect(f).connect(g).connect(sfxOut())
    src.start()
    tone(180, 0.02, 0.1, 'square', 0.08)
  }
  // 翻牌：輕輕一聲
  function flip () { tone(660, 0, 0.07, 'triangle', 0.15) }
  function cheer () {
    const notes = [523, 659, 784, 1047]
    notes.forEach((n, i) => tone(n, i * 0.12, 0.35, 'triangle', 0.2))
    tone(1319, 0.5, 0.6, 'triangle', 0.2)
  }

  // 按鈕：輕輕的「啵」
  function pop () { tone(520, 0, 0.06, 'sine', 0.12); tone(780, 0.03, 0.06, 'sine', 0.08) }
  // 骨頭飛進計數器、結算數字往上跳：小小的「叮」
  function tick () { tone(1480 + Math.random() * 200, 0, 0.05, 'triangle', 0.07) }
  // 連對：越多越高
  function combo (level) {
    const base = 660 * Math.pow(2, Math.min(level, 8) / 12 * 2)
    tone(base, 0, 0.12, 'triangle', 0.18); tone(base * 1.5, 0.08, 0.2, 'triangle', 0.14)
  }
  // 開寶箱
  function chest () {
    ;[392, 523, 659, 784, 1047, 1319].forEach((n, i) => tone(n, i * 0.07, 0.4, 'triangle', 0.16))
    tone(1568, 0.5, 0.8, 'sine', 0.12)
  }
  // 五題全部第一次就答對
  function fanfare () {
    ;[523, 523, 523, 698, 880, 784, 1047].forEach((n, i) => tone(n, [0, 0.14, 0.28, 0.42, 0.62, 0.78, 0.94][i], 0.3, 'square', 0.06))
    tone(1047, 0.94, 0.9, 'triangle', 0.16)
  }

  // ---- 背景音樂：只在首頁、商店、結算放；進遊戲就停，才不會蓋掉注音的聲音 ----
  // 用合成的音樂盒：C–Am–F–G 四個和弦輪流，每小節八個分散和弦音，外加一個低音。音量很小。
  const CHORDS = [
    [261.6, 329.6, 392.0], // C
    [220.0, 261.6, 329.6], // Am
    [174.6, 220.0, 261.6], // F
    [196.0, 246.9, 293.7], // G
  ]
  const ARP = [0, 1, 2, 3, 2, 1, 2, 1] // 3 是根音高八度
  const EIGHTH = 0.32
  const MUSIC_LEVEL = 0.06 // 音量 100% 時背景音樂的大小，本來就要很小聲
  let musicGain = null
  let musicTimer = null
  let nextNote = 0
  let noteNo = 0
  function musicNote (freq, when, dur, type, vol) {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.value = freq
    g.gain.setValueAtTime(0, when)
    g.gain.linearRampToValueAtTime(vol, when + 0.015)
    g.gain.exponentialRampToValueAtTime(0.0008, when + dur)
    o.connect(g).connect(musicGain)
    o.start(when)
    o.stop(when + dur + 0.05)
  }
  function scheduleMusic () {
    while (nextNote < ctx.currentTime + 0.5) {
      const bar = Math.floor(noteNo / 8) % CHORDS.length
      const step = noteNo % 8
      const chord = CHORDS[bar]
      const i = ARP[step]
      const freq = i === 3 ? chord[0] * 2 : chord[i]
      musicNote(freq * 2, nextNote, 0.9, 'triangle', 0.5)
      if (step === 0) musicNote(chord[0] / 2, nextNote, EIGHTH * 7, 'sine', 0.6)
      nextNote += EIGHTH
      noteNo++
    }
  }
  function startMusic () {
    if (!ctx || musicTimer) return
    musicGain = ctx.createGain()
    musicGain.gain.setValueAtTime(0, ctx.currentTime)
    musicGain.gain.linearRampToValueAtTime(MUSIC_LEVEL * vol('musicVol'), ctx.currentTime + 1.2)
    musicGain.connect(ctx.destination)
    nextNote = ctx.currentTime + 0.1
    noteNo = 0
    scheduleMusic()
    musicTimer = setInterval(scheduleMusic, 150)
  }
  function stopMusic () {
    if (!musicTimer) return
    clearInterval(musicTimer)
    musicTimer = null
    const g = musicGain
    musicGain = null
    g.gain.cancelScheduledValues(ctx.currentTime)
    g.gain.setValueAtTime(g.gain.value, ctx.currentTime)
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4)
    setTimeout(() => g.disconnect(), 600)
  }
  // 面板拉了背景音樂的音量：正在放的音樂馬上跟著變
  function setMusicVolume () {
    if (!musicGain) return
    musicGain.gain.cancelScheduledValues(ctx.currentTime)
    musicGain.gain.setTargetAtTime(MUSIC_LEVEL * vol('musicVol'), ctx.currentTime, 0.1)
  }
  function ready () { return !!ctx }

  return { unlock, ready, say, sayText, sayEnglish, stop, sourceOf, setMusicVolume, ding, wrong, splash, crunch, flip, cheer, pop, tick, combo, chest, fanfare, startMusic, stopMusic, listVoices: () => { refreshVoices(); return voices } }
}
