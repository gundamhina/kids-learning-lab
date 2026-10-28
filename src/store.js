// 進度存取：多位使用者、每人一份進度、匯出匯入。storage 用參數傳進來，測試時換成假的。

import { createState, withWallet, emptyTrack, emptyTracks } from './scheduler.js'

const PREFIX = 'zhuyin-rescue:'
const PROFILES_KEY = 'zhuyin-rescue-profiles'

function isValidState (s) {
  if (!s || typeof s !== 'object') return false
  if (s.version === 2) return !!(s.tracks && s.tracks.listen && s.tracks.read && s.tracks.write)
  return s.version === 1 && !!s.mastery && !!s.confusions
}

// 舊存檔（version 1）：紀錄在最外層，全部當成「聽」那一軌
function migrate (s) {
  if (s.version === 2) {
    const split = s.tracks.word ? s : splitWordTrack(s)
    // 之後新加的軌（例如調軌），舊存檔沒有就補空的
    return { ...split, tracks: { ...emptyTracks(), ...split.tracks } }
  }
  const { mastery, confusions, tier, recent, ...shared } = s
  return {
    ...shared,
    version: 2,
    lockTier: shared.lockTier == null ? null : shared.lockTier,
    rangeGroups: shared.rangeGroups == null ? null : shared.rangeGroups,
    unlockedUpTo: shared.unlockedUpTo == null ? null : shared.unlockedUpTo,
    tracks: { ...emptyTracks(), listen: { mastery, confusions, tier, recent } },
  }
}

// 2026-09-27 之前連連看、填空記在「讀」：詞的紀錄（音節之間有空白）搬到新的「詞」軌，讀軌留單一符號和拼讀字。
// 讀軌的階級一起帶過去當詞軌的起點，最近答題分不出是哪個玩法的，詞軌從空的開始。
export function splitWordTrack (s) {
  const read = { ...emptyTrack(), ...s.tracks.read }
  const isWord = k => k.includes(' ')
  const pick = (obj, keep) => Object.fromEntries(Object.entries(obj || {}).filter(([k]) => keep(k)))
  const pairHasWord = k => k.split('|').some(isWord)
  const word = {
    ...emptyTrack(),
    mastery: pick(read.mastery, isWord),
    confusions: pick(read.confusions, pairHasWord),
    tier: read.tier,
    log: (read.log || []).filter(e => isWord(e.s)),
  }
  const rest = {
    ...read,
    mastery: pick(read.mastery, k => !isWord(k)),
    confusions: pick(read.confusions, k => !pairHasWord(k)),
    log: (read.log || []).filter(e => !isWord(e.s)),
  }
  return { ...s, tracks: { ...s.tracks, read: rest, word } }
}

function readJson (storage, key, fallback) {
  try {
    const raw = storage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch (err) {
    return fallback
  }
}

export function createStore (storage) {
  function loadProfiles () {
    const p = readJson(storage, PROFILES_KEY, null)
    if (!p || !Array.isArray(p.list)) return { list: [], current: null }
    return { list: p.list, current: p.current || null }
  }
  function saveProfiles (p) {
    storage.setItem(PROFILES_KEY, JSON.stringify(p))
  }

  return {
    load (profileId) {
      const s = readJson(storage, PREFIX + profileId, null)
      return isValidState(s) ? withWallet(migrate(s)) : createState()
    },
    save (profileId, state) {
      storage.setItem(PREFIX + profileId, JSON.stringify(state))
    },
    exportJson (state) {
      return JSON.stringify(state, null, 2)
    },
    importJson (text) {
      const s = JSON.parse(text)
      if (!isValidState(s)) throw new Error('不是 Kids Learning Lab 的存檔')
      return withWallet(migrate(s))
    },

    loadProfiles,
    // adult：老師帳號（教室投影用），不自動升降、不記紀錄、沒有骨頭商店
    addProfile ({ name, color, adult = false }) {
      const p = loadProfiles()
      const profile = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, color }
      if (adult) profile.adult = true
      p.list.push(profile)
      p.current = profile.id
      saveProfiles(p)
      return profile
    },
    setCurrent (id) {
      const p = loadProfiles()
      p.current = id
      saveProfiles(p)
    },
    removeProfile (id) {
      const p = loadProfiles()
      p.list = p.list.filter(x => x.id !== id)
      if (p.current === id) p.current = p.list.length ? p.list[0].id : null
      saveProfiles(p)
      storage.removeItem(PREFIX + id)
    },
  }
}
