import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STROKES } from '../src/strokes.js';
import { checkStroke, strokeCount, strokeSvg, strokeFault } from '../src/strokeplay.js';
import { SYMBOLS } from '../src/data.js';

test('37 個注音符號都有教育部的筆順，每一筆都有外框和軌跡', () => {
  for (const s of SYMBOLS) {
    assert.ok(STROKES[s], s + ' 沒有筆順');
    assert.ok(strokeCount(s) >= 1);
    for (const st of STROKES[s]) {
      assert.ok(st.d.startsWith('M'));
      assert.ok(st.track.length >= 1);
    }
  }
  assert.equal(strokeCount('ㄓ'), 4);
  assert.equal(strokeCount('ㄧ'), 1);
});

// 沿著軌跡每段補點，模擬她照著寫
function along (track, jitter = 0) {
  const pts = [];
  for (let i = 1; i < track.length; i++) {
    const [ax, ay] = track[i - 1];
    const [bx, by] = track[i];
    for (let j = 0; j < 10; j++) pts.push([ax + (bx - ax) * j / 10 + jitter, ay + (by - ay) * j / 10 - jitter]);
  }
  const [lx, ly] = track[track.length - 1];
  pts.push([lx + jitter, ly - jitter]);
  return pts;
}

test('學寫字判一筆：照軌跡寫（手有點歪也行）算對', () => {
  for (const s of SYMBOLS) {
    STROKES[s].forEach((st, k) => {
      assert.ok(checkStroke(s, k, along(st.track)), `${s} 第 ${k + 1} 筆照著寫應該算對`);
      assert.ok(checkStroke(s, k, along(st.track, 120)), `${s} 第 ${k + 1} 筆歪一點也要算對`);
    });
  }
});

test('學寫字判一筆：反方向寫、寫到別的地方都不算', () => {
  const st = STROKES['ㄇ'][0];
  assert.equal(checkStroke('ㄇ', 0, along(st.track).reverse()), false, '反方向');
  assert.equal(checkStroke('ㄇ', 0, along(st.track).map(([x, y]) => [x + 900, y])), false, '寫到右邊去');
  // 寫成下一筆
  assert.equal(checkStroke('ㄇ', 0, along(STROKES['ㄇ'][1].track)), false, '先寫了第二筆');
});

test('筆順動畫：每一筆一條會長出來的線，總時間照筆數增加', () => {
  const one = strokeSvg('ㄧ');
  const four = strokeSvg('ㄓ');
  assert.equal((four.svg.match(/strokeDraw/g) || []).length, 4);
  assert.ok(four.duration > one.duration);
});

test('學寫字判一筆錯在哪：反方向、寫成別的筆、都不像', () => {
  const st0 = STROKES['ㄇ'][0];
  const st1 = STROKES['ㄇ'][1];
  assert.equal(strokeFault('ㄇ', 0, along(st0.track)), null, '寫對');
  assert.equal(strokeFault('ㄇ', 0, along(st0.track).reverse()), 'direction');
  assert.equal(strokeFault('ㄇ', 0, along(st1.track)), 'order');
  assert.equal(strokeFault('ㄇ', 0, along(st0.track).map(([x, y]) => [x + 900, y + 900])), 'shape');
});
