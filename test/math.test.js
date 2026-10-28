import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COUNT_GROUPS, countGroupsUpTo, countOptions, makePoolSize, compareQuestion, scatter, COUNT_ICONS } from '../src/mathq.js';
import { existsSync } from 'node:fs';
import { twemojiName } from '../src/art.js';

let seed = 5;
const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

test('數數範圍：最多數到 5、10、20 對到前幾組', () => {
  assert.equal(countGroupsUpTo(5).flat().length, 5);
  assert.equal(countGroupsUpTo(10).flat().length, 10);
  assert.equal(countGroupsUpTo(20).flat().length, 20);
  assert.deepEqual(COUNT_GROUPS.flat(), Array.from({ length: 20 }, (_, i) => String(i + 1)));
});

test('數一數的數字卡：三張不重複、都大於 0、含答案；高階一定有差 1 或 2 的', () => {
  for (let n = 1; n <= 20; n++) {
    for (let tier = 0; tier < 6; tier++) {
      const opts = countOptions(n, tier, rng);
      assert.equal(opts.length, 3);
      assert.equal(new Set(opts).size, 3);
      assert.ok(opts.includes(n));
      assert.ok(opts.every(x => x >= 1));
      if (tier >= 4) assert.ok(opts.some(x => x !== n && Math.abs(x - n) <= 2));
    }
  }
});

test('做數量：盒子外面一定比要放的多', () => {
  for (let n = 1; n <= 20; n++) for (let tier = 0; tier < 6; tier++) assert.ok(makePoolSize(n, tier) >= n + 2);
});

test('比多少：兩邊數量照階級拉開，答案是對的那一邊', () => {
  for (let tier = 0; tier < 6; tier++) {
    for (let k = 0; k < 50; k++) {
      const q = compareQuestion(tier, rng);
      assert.notEqual(q.left, q.right);
      assert.ok(Math.abs(q.left - q.right) >= (tier >= 4 ? 1 : tier >= 2 ? 2 : 3));
      const more = q.left > q.right ? 'left' : 'right';
      assert.equal(q.answer, q.ask === 'more' ? more : (more === 'left' ? 'right' : 'left'));
    }
  }
});

test('數的東西：位置在框裡、不重複格子；圖檔都在', () => {
  for (let n = 1; n <= 20; n++) {
    const pts = scatter(n, rng);
    assert.equal(pts.length, n);
    assert.ok(pts.every(([x, y]) => x > 0 && x < 1 && y > 0 && y < 1));
  }
  for (const icon of COUNT_ICONS) assert.ok(existsSync('img/emoji/' + twemojiName(icon) + '.svg'), icon + ' 沒有圖檔');
});

test('加減：六組都是十以內、答案至少 1，減法不會減到負的', async () => {
  const { CALC_GROUPS, parseCalc, calcLook, calcSay } = await import('../src/mathq.js')
  assert.deepEqual(CALC_GROUPS.map(g => g.length), [10, 10, 15, 15, 20, 20])
  const all = CALC_GROUPS.flat()
  assert.equal(new Set(all).size, all.length)
  for (const f of all) {
    const q = parseCalc(f)
    assert.ok(q.answer >= 1 && q.answer <= 10, f)
    assert.ok(q.a <= 10 && q.b >= 1, f)
  }
  assert.equal(calcLook(0), 'pictures')
  assert.equal(calcLook(3), 'both')
  assert.equal(calcLook(5), 'numbers')
  assert.equal(calcSay('7-3', true), '7減3等於4')
})

test('數一數混好幾種：指定那種剛好 n 個，別種的數量跟答案不一樣', async () => {
  const { countMixed } = await import('../src/mathq.js')
  let x = 7
  const rng = () => { x = (x * 16807) % 2147483647; return x / 2147483647 }
  for (let i = 0; i < 50; i++) {
    const n = 1 + (i % 10)
    const m = countMixed(n, 3 + (i % 3), rng)
    const kinds = new Set(m.items.map(it => it.icon))
    assert.equal(m.items.filter(it => it.icon === m.target).length, n)
    assert.ok(kinds.size >= 2)
    for (const k of kinds) if (k !== m.target) assert.notEqual(m.items.filter(it => it.icon === k).length, n)
  }
})

test('比多少高階：一樣多的題目答案是 equal，低階不會出', async () => {
  const { compareQuestion } = await import('../src/mathq.js')
  let x = 11
  const rng = () => { x = (x * 16807) % 2147483647; return x / 2147483647 }
  let equal = 0
  for (let i = 0; i < 200; i++) {
    const q = compareQuestion(5, rng, 'more', { equal: true })
    if (q.answer === 'equal') { equal++; assert.equal(q.left, q.right) } else assert.notEqual(q.left, q.right)
    assert.notEqual(compareQuestion(1, rng, 'more').answer, 'equal')
  }
  assert.ok(equal > 20 && equal < 90, String(equal))
})
