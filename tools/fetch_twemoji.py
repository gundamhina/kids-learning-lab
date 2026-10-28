# -*- coding: utf-8 -*-
"""把每個詞的圖（表情符號）下載成 Twemoji 的 SVG，放在 img/emoji/。

用法：python tools/fetch_twemoji.py（改過 gen_syllables.py 的詞之後跑，已經有的不會重抓）
為什麼：表情符號交給系統字型畫的話，Windows 10 看不到比較新的（會變方框），每台裝置長得也不一樣。
換成同一套圖檔，哪台都一樣。

圖的來源：Twemoji（https://github.com/jdecked/twemoji），圖檔授權 CC BY 4.0，要標出處（README、家長區有寫）。
檔名規則跟 Twemoji 一樣：碼位轉小寫十六進位用「-」接起來；沒有 ZWJ（200D）的就拿掉 FE0F。
src/art.js 的 twemojiName() 用同一套規則找檔名，兩邊要一起改。
"""
import os, sys, urllib.request

sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import gen_syllables as g

VERSION = '15.1.0'
BASE = f'https://cdn.jsdelivr.net/gh/jdecked/twemoji@{VERSION}/assets/svg/'
OUT = os.path.join(HERE, '..', 'img', 'emoji')


def twemoji_name(emoji):
    if '‍' not in emoji:
        emoji = emoji.replace('️', '')
    return '-'.join(f'{ord(c):x}' for c in emoji)


# 詞庫以外要用的圖：英文字母的例詞（src/english.js）
EXTRA_ICONS = ['🎩', '🪺', '🦉', '🐍', '🦄', '📦', '🪀', '🧶']


def main():
    os.makedirs(OUT, exist_ok=True)
    icons = [ic for name, items in g.parse_words() for t, z, ic in items] + EXTRA_ICONS
    got, skipped, failed = 0, 0, []
    for ic in icons:
        path = os.path.join(OUT, twemoji_name(ic) + '.svg')
        if os.path.exists(path):
            skipped += 1
            continue
        try:
            with urllib.request.urlopen(BASE + twemoji_name(ic) + '.svg', timeout=20) as r:
                open(path, 'wb').write(r.read())
            got += 1
        except Exception as e:
            failed.append(f'{ic} {twemoji_name(ic)}: {e}')
    print(f'下載 {got}，已經有 {skipped}，失敗 {len(failed)}')
    for f in failed:
        print('  ', f)
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
