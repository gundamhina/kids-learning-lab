// 把 src/ 合成一個 dist/index.html。
// 做法：依相依順序串接各模組，拿掉 import 行和 export 關鍵字，全部放進同一個 script 範圍。
// 前提：各模組頂層名稱不能撞。

import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, existsSync, rmSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const root = dirname(fileURLToPath(import.meta.url))
const ORDER = ['syllables.js', 'data.js', 'scheduler.js', 'mathq.js', 'store.js', 'audio.js', 'art.js', 'fishing.js', 'whack.js', 'memory.js', 'speak.js', 'ink.js', 'strokes.js', 'latinstrokes.js', 'strokeplay.js', 'write.js', 'learn.js', 'chart.js', 'matchline.js', 'fillblank.js', 'spell.js', 'friend.js', 'mathgames.js', 'brainq.js', 'braingames.js', 'english.js', 'battleq.js', 'coloring.js', 'spot.js', 'ui.js', 'fx.js', 'tutorial.js', 'shop.js', 'battle.js', 'check.js', 'main.js']

function strip (src, name) {
  return `// ===== ${name} =====\n` + src
    .replace(/^import\s[^\n]*\n/gm, '')
    .replace(/^export\s*\{[^\n]*\}[^\n]*\n/gm, '') // 轉出口（export { X }）在單一範圍裡不需要
    .replace(/^export\s+(const|let|function|async function)\s/gm, '$1 ')
}

// 哪幾隻狗的圖還只是 dog-0 的複本：那幾隻當隊員時要畫隊色領巾才分得出來，換上真的圖就自動不畫
const dogPath = i => join(root, 'img', `dog-${i}.png`)
const dog0 = existsSync(dogPath(0)) ? readFileSync(dogPath(0)) : null
const dogCopies = [1, 2, 3, 4, 5].filter(i => dog0 && existsSync(dogPath(i)) && readFileSync(dogPath(i)).equals(dog0))
// 圖片版本：所有圖檔內容一起算雜湊，換圖網址才會變（art.js 的 IMG_V）
function imageVersion () {
  const h = createHash('sha1')
  const walk = dir => {
    if (!existsSync(dir)) return
    for (const f of readdirSync(dir).sort()) {
      const p = join(dir, f)
      if (/\.(png|jpg|jpeg|webp|svg)$/i.test(f)) h.update(f).update(readFileSync(p))
      else if (f === 'words' || f === 'emoji') walk(p)
    }
  }
  walk(join(root, 'img'))
  return h.digest('hex').slice(0, 8)
}
const imgVersion = imageVersion()
// 有哪些錄音檔先寫進程式：不用每個音都上網試有沒有檔案，沒錄音的直接用語音合成
const audioFiles = existsSync(join(root, 'audio')) ? readdirSync(join(root, 'audio')).filter(f => /\.(mp3|wav)$/i.test(f)) : []
const js = `const DOG_COPIES = ${JSON.stringify(dogCopies)}\nconst AUDIO_FILES = ${JSON.stringify(audioFiles)}\n` + ORDER.map(f => strip(readFileSync(join(root, 'src', f), 'utf8'), f)).join('\n').replace(/__IMG_V__/g, imgVersion)
// 各模組最外層的名稱不能撞：合成同一個範圍後，同名的 function 會靜靜地互相蓋掉，new Function 抓不到
const seen = {}
for (const f of ORDER) {
  const src = readFileSync(join(root, 'src', f), 'utf8')
  for (const m of src.matchAll(/^(?:export\s+)?(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    if (seen[m[1]]) { console.error(`最外層名稱撞到：${m[1]} 同時在 ${seen[m[1]]} 和 ${f}`); process.exit(1) }
    seen[m[1]] = f
  }
}
// 合成後全部在同一個範圍，模組之間頂層名稱撞到會直接是語法錯誤，先在這裡抓出來
try {
  new Function(js) // eslint-disable-line no-new-func
} catch (err) {
  console.error('合成後的 JS 有語法錯誤：', err.message)
  process.exit(1)
}
const css = readFileSync(join(root, 'src', 'style.css'), 'utf8')
// 版號：package.json 的版本 + commit + 打包時間（台北），右下角顯示，重新整理後看得出有沒有換到新版
// GitHub Actions 上用 GITHUB_SHA（就是這次推上去的 commit）；本機用目前的 HEAD
function buildVersion () {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  let sha = process.env.GITHUB_SHA || ''
  if (!sha) { try { sha = execSync('git rev-parse HEAD', { cwd: root }).toString().trim() } catch (err) { /* 沒有 git */ } }
  const when = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date())
  return [`v${pkg.version}`, sha.slice(0, 7), when].filter(Boolean).join(' · ')
}
const version = buildVersion()


const html = readFileSync(join(root, 'src', 'index.html'), 'utf8')
  .replace('__VERSION__', () => version)
  .replace('/*__CSS__*/', () => css)
  .replace('/*__JS__*/', () => js)

mkdirSync(join(root, 'dist'), { recursive: true })
writeFileSync(join(root, 'dist', 'index.html'), html)
copyFileSync(join(root, 'src', 'manifest.webmanifest'), join(root, 'dist', 'manifest.webmanifest'))
console.log('dist/index.html', (html.length / 1024).toFixed(0) + ' KB', version)

// 錄音檔：audio/ 底下的 mp3、wav 一起複製到 dist/audio/
const audioDir = join(root, 'audio')
if (existsSync(audioDir)) {
  mkdirSync(join(root, 'dist', 'audio'), { recursive: true })
  const files = readdirSync(audioDir).filter(f => /\.(mp3|wav)$/i.test(f))
  for (const f of files) copyFileSync(join(audioDir, f), join(root, 'dist', 'audio', f))
  console.log('dist/audio/', files.length, 'files')
}

// 圖片檔：img/ 底下的 png、jpg、webp 一起複製到 dist/img/
const imgDir = join(root, 'img')
if (existsSync(imgDir)) {
  // 先清掉 dist/img，img/ 裡刪掉或改名的圖（例如 PNG 換成 JPG）才不會留在打包裡
  rmSync(join(root, 'dist', 'img'), { recursive: true, force: true })
  mkdirSync(join(root, 'dist', 'img'), { recursive: true })
  const files = readdirSync(imgDir).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
  for (const f of files) copyFileSync(join(imgDir, f), join(root, 'dist', 'img', f))
  // 詞的圖在 img/words/
  const wordsDir = join(imgDir, 'words')
  let wordFiles = []
  if (existsSync(wordsDir)) {
    mkdirSync(join(root, 'dist', 'img', 'words'), { recursive: true })
    wordFiles = readdirSync(wordsDir).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
    for (const f of wordFiles) copyFileSync(join(wordsDir, f), join(root, 'dist', 'img', 'words', f))
  }
  // 詞的圖的表情符號（Twemoji SVG，tools/fetch_twemoji.py 下載）在 img/emoji/
  const emojiDir = join(imgDir, 'emoji')
  let emojiFiles = []
  if (existsSync(emojiDir)) {
    mkdirSync(join(root, 'dist', 'img', 'emoji'), { recursive: true })
    emojiFiles = readdirSync(emojiDir).filter(f => /\.svg$/i.test(f))
    for (const f of emojiFiles) copyFileSync(join(emojiDir, f), join(root, 'dist', 'img', 'emoji', f))
  }
  console.log('dist/img/', files.length, 'files,', wordFiles.length, 'word pictures,', emojiFiles.length, 'emoji')
}

// 離線版：dist/sw.js。清單是 dist/ 底下所有錄音和圖（路徑照網址編碼，每個檔帶自己的內容雜湊），
// 網頁版本用 index.html 的雜湊：每次打包都會變，裝置下次有網路打開就換新版
const assetHash = {}
const listAssets = (dir, prefix) => {
  if (!existsSync(dir)) return
  for (const f of readdirSync(dir).sort()) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) listAssets(p, prefix + encodeURIComponent(f) + '/')
    else if (/\.(png|jpg|jpeg|webp|svg|mp3|wav)$/i.test(f)) assetHash[prefix + encodeURIComponent(f)] = createHash('sha1').update(readFileSync(p)).digest('hex').slice(0, 10)
  }
}
listAssets(join(root, 'dist', 'audio'), 'audio/')
listAssets(join(root, 'dist', 'img'), 'img/')
const shellVersion = createHash('sha1').update(html).digest('hex').slice(0, 10)
const sw = readFileSync(join(root, 'src', 'sw.js'), 'utf8')
  .replace('__SHELL_VERSION__', shellVersion)
  .replace('__ASSETS__', () => JSON.stringify(assetHash))
writeFileSync(join(root, 'dist', 'sw.js'), sw)
console.log('dist/sw.js', Object.keys(assetHash).length, 'files for offline')
