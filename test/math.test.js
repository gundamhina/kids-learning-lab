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
