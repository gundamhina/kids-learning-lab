import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { LETTERS, LETTER_WORDS, LETTER_GROUPS, SPELL_WORDS, ENGLISH_ICON, letterOptions, letterPictureQuestion, wordTiles } from '../src/english.js';
import { twemojiName } from '../src/art.js';

let seed = 13;
const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

test('英文：26 個字母都有例詞、都分到組；所有圖都有圖檔；例詞開頭就是那個字母', () => {
  assert.deepEqual(LETTER_GROUPS.flat(), LETTERS);
  for (const l of LETTERS) {
    assert.ok(LETTER_WORDS[l] && LETTER_WORDS[l].length, l);
    for (const [w] of LETTER_WORDS[l]) assert.equal(w[0].toUpperCase(), l, w);
  }
  for (const [w, icon] of Object.entries(ENGLISH_ICON)) assert.ok(existsSync('img/emoji/' + twemojiName(icon) + '.svg'), w + ' ' + icon);
});

test('聽字母：選項不重複、含答案；高階 4 個', () => {
  for (const l of LETTERS) for (let tier = 0; tier < 6; tier++) {
    const o = letterOptions(l, tier, rng);
    assert.equal(new Set(o).size, o.length);
    assert.ok(o.includes(l));
    assert.equal(o.length, tier >= 3 ? 4 : 3);
  }
});

test('認字母：三張圖只有一張開頭是這個字母', () => {
  for (const l of LETTERS) for (let tier = 0; tier < 6; tier++) {
    const q = letterPictureQuestion(l, tier, rng);
    assert.equal(q.options.length, 3);
    assert.deepEqual(q.options.filter(w => w[0].toUpperCase() === l), [q.answer]);
  }
});

test('拼單字的磁磚：每個字母都有（重複的字母兩塊），干擾不跟答案撞', () => {
  for (const [w] of SPELL_WORDS) for (let tier = 0; tier < 6; tier++) {
    const t = wordTiles(w, tier, rng);
    const need = w.toUpperCase().split('');
    for (const c of new Set(need)) assert.ok(t.filter(x => x === c).length >= need.filter(x => x === c).length, w + ' 缺 ' + c);
    assert.equal(t.length, need.length + (tier >= 4 ? 3 : tier >= 2 ? 2 : 1));
  }
});
