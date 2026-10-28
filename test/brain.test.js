import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { patternQuestion, oddQuestion, makeMaze, mazeDistances, mazeLevel, BRAIN_ICONS, spotScene, SPOT_ICONS } from '../src/brainq.js';
import { twemojiName } from '../src/art.js';

let seed = 9;
const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const same = (a, b) => a.join() === b.join();

test('找規律：三個選項不重複，只有一個是答案；補空格的答案就是那一格', () => {
  for (let tier = 0; tier < 6; tier++) {
    for (let k = 0; k < 200; k++) {
      const q = patternQuestion(tier, rng);
      assert.equal(q.options.length, 3, JSON.stringify(q));
      assert.equal(q.options.filter(o => same(o, q.answer)).length, 1);
      assert.equal(new Set(q.options.map(o => o.join())).size, 3);
      if (q.mode === 'fill') assert.equal(q.row[q.blank], q.answer[0]);
      if (tier <= 1) assert.equal(q.mode, 'fill', '低階只出補空格');
    }
  }
});

test('選卡片找不同：卡片數照階級，不一樣的那張在範圍內', () => {
  for (let tier = 0; tier < 6; tier++) {
    for (let k = 0; k < 50; k++) {
      const q = oddQuestion(tier, rng);
      assert.ok(q.odd >= 0 && q.odd < q.n);
      assert.notEqual(q.icon, q.other);
    }
  }
});

test('迷宮：每一格都走得到；寶物不在起點和出口', () => {
  for (let tier = 0; tier < 6; tier++) {
    for (let k = 0; k < 20; k++) {
      const m = mazeLevel(tier, rng);
      const dist = mazeDistances(m.walls);
      assert.ok(dist.every(row => row.every(d => d >= 0)), '有走不到的格子');
      for (const [x, y] of m.items) {
        assert.ok(!(x === 0 && y === 0) && !(x === m.exit[0] && y === m.exit[1]));
      }
      assert.equal(m.items.length, tier <= 1 ? 0 : tier <= 3 ? 1 : 2);
    }
  }
  // 牆要兩邊一致
  const w = makeMaze(6, 4, rng);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 5; x++) assert.equal(w[y][x].e, w[y][x + 1].w);
});

test('動腦的圖都有圖檔', () => {
  for (const icon of BRAIN_ICONS) assert.ok(existsSync('img/emoji/' + twemojiName(icon) + '.svg'), icon);
});

test('經典找不同：差異數量照階級，每個差異右邊真的不一樣，圖檔都在', () => {
  for (let tier = 0; tier < 6; tier++) {
    for (let k = 0; k < 30; k++) {
      const sc = spotScene(tier, rng);
      assert.equal(sc.diffs.length, tier <= 1 ? 3 : tier <= 3 ? 4 : 5);
      assert.equal(new Set(sc.diffs.map(d => d.i)).size, sc.diffs.length);
      for (const d of sc.diffs) assert.notDeepEqual(sc.left[d.i], sc.right[d.i]);
      const same = sc.left.filter((o, i) => !sc.diffs.some(d => d.i === i));
      for (const o of same) assert.deepEqual(o, sc.right[sc.left.indexOf(o)]);
    }
  }
  for (const icon of SPOT_ICONS) assert.ok(existsSync('img/emoji/' + twemojiName(icon) + '.svg'), icon);
});
