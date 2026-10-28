// 符號找朋友。牌子上一個大符號（狗狗先唸），下面三張圖卡，點「第一個字有這個音」的那張。
// 介面：start(symbol, options, answer)、lock/unlock、onAnswer(fn(word, el))、hint()、mark()、shake(word)、celebrate(word)、sad、layout、destroy

import { dogSvg, bgHtml, symbolMarkup, wordPicMarkup } from './art.js'
import { STAGE, mountBgs } from './ui.js'

// symbolHtml、picHtml 可以換掉：英文的「認字母」「聽發音」也用這個畫面（大字母配圖、喇叭配字母卡）
export function createFriend (root, { color = 0, symbolHtml = symbolMarkup, picHtml = wordPicMarkup } = {}) {
  root.innerHTML = bgHtml('room') + '<div class="frame">' +
    '<div class="dog-wrap friend-dog">' + dogSvg(color) + '</div>' +
    '<div class="sign friend-sign"><div class="sign-board"><span class="friend-symbol"></span></div><div class="sign-post"></div></div>' +
    '<div class="friend-cards"></div></div>'
  mountBgs(root)
  const dogWrap = root.querySelector('.friend-dog')
  const signEl = root.querySelector('.friend-sign')
  const symbolEl = root.querySelector('.friend-symbol')
  const cardsEl = root.querySelector('.friend-cards')
  let handler = null
  let locked = true
  let answer = null

  cardsEl.addEventListener('pointerdown', e => {
    const c = e.target.closest('.fcard')
    if (!c || locked || c.classList.contains('right') || !handler) return
    handler(c.dataset.word, c)
  })

  // 直的：牌子和圖卡整組在畫面裡置中；橫的交給 CSS
  function layout () {
    if (!STAGE.portrait) { signEl.style.top = ''; cardsEl.style.top = ''; return }
    const top = 130 + Math.max(0, (STAGE.h - 130 - 110 - 700) / 2)
    signEl.style.top = top + 'px'
    cardsEl.style.top = (top + 420) + 'px'
  }

  function start (symbol, options, ans) {
    answer = ans
    locked = true
    signEl.classList.remove('glow')
    symbolEl.innerHTML = symbolHtml(symbol)
    cardsEl.innerHTML = options.map(w => `<button class="fcard" data-word="${w}" aria-label="${w}">${picHtml(w)}</button>`).join('')
    layout()
  }
  const cardOf = w => cardsEl.querySelector(`.fcard[data-word="${w}"]`)
  function unlock () { locked = false }
  function lock () { locked = true }
  // 發呆提示：朋友那張晃一下
  function hint () {
    const c = cardOf(answer)
    if (!c) return
    c.classList.remove('shake')
    void c.offsetWidth
    c.classList.add('shake')
  }
  // 答錯第二次起：朋友那張一直發亮
  function mark () {
    const c = cardOf(answer)
    if (c) c.classList.add('answer-glow')
  }
  function shake (w) {
    const c = cardOf(w)
    if (!c) return
    c.classList.remove('shake')
    void c.offsetWidth
    c.classList.add('shake')
  }
  function celebrate (w) {
    return new Promise(resolve => {
      const c = cardOf(w)
      if (c) { c.classList.remove('answer-glow'); c.classList.add('right') }
      signEl.classList.add('glow')
      dogWrap.classList.remove('jump')
      void dogWrap.offsetWidth
      dogWrap.classList.add('jump')
      setTimeout(resolve, 700)
    })
  }
  function sad () {
    dogWrap.classList.remove('tilt')
    void dogWrap.offsetWidth
    dogWrap.classList.add('tilt')
  }
  function onAnswer (fn) { handler = fn }
  function destroy () { root.innerHTML = ''; handler = null }

  return { start, unlock, lock, hint, mark, shake, celebrate, sad, onAnswer, layout, destroy }
}
