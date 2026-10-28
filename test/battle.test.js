import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BATTLE_GAMES, battleQuestion, guestLevel, profileLevel } from '../src/battleq.js'
import { createState } from '../src/scheduler.js'
import { GROUPS } from '../src/data.js'

function seeded (seed) {
  let s = seed
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
}

test('每個對戰玩法、每個程度出的題，正解都在選項裡', () => {
  for (const g of BATTLE_GAMES) {
    for (let level = 1; level <= 6; level++) {
      const rng = seeded(level * 31 + g.key.length)
      let prev = null
      for (let i = 0; i < 30; i++) {
        const q = battleQuestion(g.key, guestLevel(level), rng, prev)
        assert.equal(q.game, g.key)
        assert.ok(q.options.length >= 2, `${g.key} 至少兩個選項`)
        assert.ok(q.answer >= 0 && q.answer < q.options.length, `${g.key} 第 ${level} 級正解索引 ${q.answer}`)
        prev = q
      }
    }
  }
})

test('客人程度越高，注音、數數、字母的範圍越大', () => {
  const low = guestLevel(1)
  const high = guestLevel(6)
  assert.ok(low.symbols.length < high.symbols.length)
  assert.ok(low.countMax < high.countMax)
  assert.ok(low.letters.length < high.letters.length)
  assert.equal(low.tier('count'), 0)
  assert.equal(high.tier('count'), 5)
  assert.deepEqual(guestLevel(99).symbols, high.symbols)
})

test('使用者照自己的進度：鎖的難度、解鎖的組、家長設的數數範圍', () => {
  const state = { ...createState(), lockTier: 4, countMax: 20 }
  const lvl = profileLevel(state)
  assert.equal(lvl.tier('friend'), 4)
  assert.equal(lvl.countMax, 20)
  assert.deepEqual(lvl.symbols, GROUPS[0]) // 新的使用者只開第一組
  assert.equal(lvl.letters.length, 5)
})

test('數一數的數量不超過範圍，找朋友只出開了的符號', () => {
  const lvl = guestLevel(1)
  const rng = seeded(7)
  for (let i = 0; i < 50; i++) {
    const c = battleQuestion('count', lvl, rng)
    assert.ok(c.prompt.n >= 1 && c.prompt.n <= lvl.countMax)
    assert.equal(c.prompt.points.length, c.prompt.n)
    const f = battleQuestion('friend', lvl, rng)
    assert.ok(lvl.symbols.includes(f.prompt.symbol))
  }
})
