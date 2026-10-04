// Build the local course from 逸尘's published TOC and teaching images.
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../../../..')
const SOURCE = path.join(HERE, 'source.md')
const CHAPTER_DIR = path.join(HERE, 'chapters')
const IMG_DIR = path.join(ROOT, 'sites/shared/img/yichen')
const SKIP_DOWNLOAD = process.argv.includes('--skip-download')
const KEEP = new Set([2, 5])
const TITLE_FIX = {
  2: '从 0 到 1：认清 Codex App 界面',
  5: '实战：办公四件套和本地交付'
}
const SHORT_TITLE = {
  2: '认清界面',
  5: '办公四件套'
}
const HOW_TO = [
  '先看第一章，把左边、中间、右边和设置页看明白。',
  '再看第二章，照着做出一份能打开的 Word、PPT 或网页。'
]
const COVER_FIX = {
  5: '/img/shared/yichen/1782646136969_media_HIAmjXXbcAAjgqS.jpg'
}
const PARTS = [
  {id: 'part-1', n: 1, from: 2, to: 2, label: '先认界面'},
  {id: 'part-2', n: 2, from: 5, to: 5, label: '再做交付'}
]
const PART_INTRO = {
  'part-1': '先把 Codex App 的界面看懂：左边入口、中间对话、右边结果，再翻一遍设置页。',
  'part-2': '照着做一次能打开的结果：文档、演示稿、网页。'
}
const PROMO = /yichen365ai|gamsgo\.com|赚杯咖啡|私信找我|yichen10801|chatgpt\s*plus|plus\s*会员|代充|中转站|关注我|扫码加|微信群|下沉市场|边玩边赚钱|上百付费|变现杠杆|6步赚钱|红包感谢|开卖|拼多多|购买方法|礼品卡|先plus|直接上pro|付费的会员账号/i
const IMG_RE = /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]))

function partOf(n) {
  return PARTS.find(part => n >= part.from && n <= part.to)
}

function skipImage(url) {
  return /profile_images|emoji_v2_svg/i.test(url)
}

function chromeLine(line) {
  const text = line.trim()
  return /^(逸尘|@gengdaJ|·|引用)$/.test(text)
    || /^\d{1,2}月\d{1,2}日$/.test(text)
    || /^\d{1,4}(,\d{3})?$/.test(text)
    || /^\d+(\.\d+)?万$/.test(text)
    || /^https:\/\/(?:x|twitter)\.com\//i.test(text)
}

function localName(url) {
  const raw = decodeURIComponent(url.split('/').pop() || 'image')
  const safe = raw.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/\.+/g, match => match === '..' ? '.' : match)
  return safe.replace(/\.jpg\.jpg$/i, '.jpg').replace(/\.png\.png$/i, '.png') || 'image.jpg'
}

function collectImages(markdown) {
  const seen = new Map()
  for (const match of markdown.matchAll(IMG_RE)) {
    const url = match[2]
    if (skipImage(url) || seen.has(url)) continue
    seen.set(url, localName(url))
  }
  return seen
}

async function downloadOne(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 800) return 'exists'
  const res = await fetch(url, {
    headers: {'User-Agent': 'Mozilla/5.0 CodexTutorialLocal/1.0'},
    redirect: 'follow'
  })
  if (!res.ok) throw new Error(res.status + ' ' + url)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 400) throw new Error('tiny ' + url)
  fs.writeFileSync(dest, buf)
  return 'ok'
}

async function mapPool(items, limit, worker) {
  const out = new Array(items.length)
  let index = 0
  async function run() {
    while (index < items.length) {
      const current = index++
      out[current] = await worker(items[current], current)
    }
  }
  await Promise.all(Array.from({length: Math.min(limit, items.length)}, run))
  return out
}

function extractHowTo(markdown) {
  const block = markdown.split('## 如何使用这份教程')[1]?.split('## 完整目录')[0] || ''
  return block.split(/\r?\n/).map(line => line.replace(/^\d+\.\s*/, '').trim()).filter(line => line && !line.startsWith('#'))
}

function extractPartIntros(markdown) {
  const intros = {}
  for (const part of PARTS) {
    const heading = '## ' + part.label
    const start = markdown.indexOf(heading)
    if (start < 0) continue
    const after = markdown.slice(start + heading.length)
    const end = after.search(/\n### 第 /)
    const text = (end < 0 ? after : after.slice(0, end)).replace(/---/g, '').trim()
    intros[part.id] = text.split(/\n+/).map(line => line.trim()).filter(Boolean).join('')
  }
  return intros
}

function chapterBlocks(markdown) {
  const re = /^### 第 (\d+) 章：(.+)$/gm
  const found = [...markdown.matchAll(re)]
  return found.map((match, index) => {
    const start = match.index + match[0].length
    const end = index + 1 < found.length ? found[index + 1].index : markdown.length
    return {n: Number(match[1]), title: match[2].trim(), raw: markdown.slice(start, end)}
  })
}

function sourceUrl(raw) {
  return raw.match(/来源：\[(https?:\/\/[^\]]+)\]/)?.[1] || ''
}

function bodyText(raw) {
  const marker = raw.indexOf('#### 正文')
  return (marker >= 0 ? raw.slice(marker + '#### 正文'.length) : raw).replace(/\r\n/g, '\n')
}

function linkify(text) {
  return esc(text).replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_, label, href) => {
    if (/gamsgo|yichen365ai|yichen10801/i.test(href)) return esc(label)
    return '<a href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + esc(label) + '</a>'
  }).replace(/(^|[\s>])(https?:\/\/[^\s<]+)/g, (all, prefix, href) => {
    if (/gamsgo|yichen365ai|yichen10801|x\.com|twitter\.com/i.test(href)) return prefix + esc(href.replace(/^https?:\/\//, ''))
    return prefix + '<a href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + esc(href) + '</a>'
  })
}

function figure(src, alt, caption) {
  const cap = caption ? '<figcaption>' + esc(caption) + '</figcaption>' : ''
  return '<figure class="yichen-figure"><img src="' + esc(src) + '" alt="' + esc(caption || alt || '界面配图') + '" loading="lazy">' + cap + '</figure>'
}

// 抓取件里的「图片 N」和文件对不上：设置页被插到搜索/插件/右侧。按实际画面归位。
const PLACE = {
  2: [
    {match: '', files: ['1782645996771_media_HHnH5-xaIAAfPDj.jpg']},
    {match: '到底是什么', files: ['1782645954968_media_HHmxoi_aQAEclcw.jpg']},
    {match: '主界面地图', files: ['1782645964537_media_HHmy7s3akAAZgFO.jpg']},
    {match: '左侧导航', files: ['1782645953649_media_HHmx6cRbEAEdFDk.jpg']},
    {match: '搜索', files: ['1782645940789_media_HHmwSdOaQAAlP2t.png']},
    {match: '插件', files: ['1782645977091_media_HHmyxjWboAAHaaP.jpg']},
    {match: '自动化', files: ['1782645935412_media_HHmwOqGaUAA_S7y.jpg']},
    {match: '设置页 1', files: ['1782645931285_media_HHmwJzpaYAAU3Gp.jpg', '1782645985074_media_HHmzNoabcAA8qzd.jpg']},
    {match: '设置页 2', files: ['1782645922314_media_HHmwGrmaMAA9LPK.jpg', '1782645992808_media_HHmzTE3bMAAg-F8.jpg']},
    {match: '设置页 3', files: ['1782645917683_media_HHmwDkgaUAA8Gjm.jpg']},
    {match: '设置页 4', files: ['1782645912358_media_HHmwAvsaQAAcKvy.jpg']},
    {match: '设置页 5', files: ['1782645897461_media_HHmv9IebQAAD9pr.jpg']},
    {match: '设置页 6', files: ['1782645892030_media_HHmv6UTa0AAJGhH.jpg']},
    {match: '环境和工作树', files: ['1782645887742_media_HHmv3ixasAAxGiI.jpg']},
    {match: '浏览器使用', files: ['1782645874827_media_HHmv0vaakAAf2oq.jpg']},
    {match: '已归档', files: ['1782645907880_media_HHmvw_iacAAfIMi.jpg']}
  ],
  5: [
    {match: '', files: [{file: '1782646031650_media_HIAlj-KaIAAvGu2.jpg', caption: '这一章要做的事：交得出去的文件和网页'}]},
    {match: '四件套', files: [
      {file: '1782646136969_media_HIAmjXXbcAAjgqS.jpg', caption: 'Word 预览'},
      {file: '1782646129762_media_HIAmgWaaYAALLRx.jpg', caption: 'PDF 预览'},
      {file: '1782646125963_media_HIAmdVtbUAAdvp5.jpg', caption: 'PPT 预览'},
      {file: '1782646117680_media_HIAmaWIacAAI8JG.jpg', caption: '表格预览'},
      {file: '1782646108752_media_HIAmXW1bIAAIr4D.jpg', caption: '图片型 PPT 单页'},
      {file: '1782646107522_media_HIAmUTlaYAAaEpT.jpg', caption: '三页拼在一起看'},
      {file: '1782646100947_media_HIAmRSGbAAAxjM3.jpg', caption: '放到 PowerPoint 里'}
    ]},
    {match: '3D 视频', files: [{file: '1782646089029_media_HIAmOONaQAA3uS7.jpg', caption: '国产动画成片画面'}]},
    {match: '早起早睡', files: [
      {file: '1782646077655_media_HIAmIPoaMAA7lCp.jpg', caption: '本地预览网站'},
      {file: '1782646073022_media_HIAmFQha8AAOWt1.jpg', caption: '早睡早起成页'},
      {file: '1782646068823_media_HIAmCMOaYAAQIxT.jpg', caption: '昼夜节律页'},
      {file: '1782646083155_media_HIAmLRabwAAxDTZ.jpg', caption: '连接 Vercel'}
    ]},
    {match: '图文长教程', files: [
      {file: '1782646019187_media_HIAl8MvaEAAmSLO-mosaic.jpg', caption: '用写作 Skill 起草（已打码）'},
      {file: '1782646016086_media_HIAl5MyaIAADs7e.jpg', caption: '图文教程成稿'}
    ]}
  ],
  18: [
    {match: '', files: [
      '1782647033318_media_HJ0R8mjaQAEH_fI.jpg',
      '1782647035657_media_HJ0SCsqbgAArvgO.jpg'
    ]}
  ],
  20: []
}

function stripFigures(html) {
  return String(html || '').replace(/<figure class="yichen-figure">[\s\S]*?<\/figure>/g, '').replace(/\n{3,}/g, '\n\n')
}

function ruleMatches(section, rule) {
  if (!rule.match) return !section.title
  const title = section.title || ''
  const index = title.indexOf(rule.match)
  if (index < 0) return false
  return !/^\d/.test(title.slice(index + rule.match.length))
}

function applyPlacement(sourceN, sections) {
  const rules = PLACE[sourceN]
  if (!rules) return sections
  return sections.map(section => {
    const body = stripFigures(section.body)
    const rule = rules
      .filter(item => ruleMatches(section, item))
      .sort((a, b) => (b.match?.length || 0) - (a.match?.length || 0))[0]
    if (!rule?.files?.length) return {...section, body}
    const figs = rule.files.map(item => {
      const file = typeof item === 'string' ? item : item.file
      const caption = typeof item === 'string' ? '' : item.caption
      return figure('/img/shared/yichen/' + file, section.title || '界面配图', caption)
    }).join('\n')
    if (!section.title) {
      const close = body.indexOf('</p>')
      if (close > 0) return {...section, body: body.slice(0, close + 4) + '\n' + figs + body.slice(close + 4)}
    }
    return {...section, body: figs + '\n' + body}
  })
}

function maybeTable(line) {
  if (line.startsWith('名字 大白话解释')) {
    return '<table class="yichen-table"><thead><tr><th>名字</th><th>大白话</th><th>适合做什么</th></tr></thead><tbody><tr><td>ChatGPT</td><td>普通对话</td><td>问问题、写文案、解释概念、生成文件和图片</td></tr><tr><td>Codex App</td><td>装在电脑上的工作台</td><td>普通对话能做的都能做，还能读本地文件</td></tr><tr><td>云端 Codex</td><td>在官方服务器上跑任务</td><td>电脑关机也能继续跑</td></tr></tbody></table>'
  }
  if (line.startsWith('区域 它是干什么的')) {
    return '<table class="yichen-table"><thead><tr><th>区域</th><th>干什么</th><th>最常用</th></tr></thead><tbody><tr><td>左边导航</td><td>找入口、项目、对话</td><td>新对话、切对话、插件、自动化</td></tr><tr><td>中间对话</td><td>你和 Codex 交流</td><td>输入需求、开始工作</td></tr><tr><td>右边结果</td><td>展示证据和产物</td><td>看来源、预览、看代码变化</td></tr></tbody></table>'
  }
  if (line.startsWith('名词 大白话解释')) {
    return '<table class="yichen-table"><thead><tr><th>名词</th><th>大白话</th><th>例子</th></tr></thead><tbody><tr><td>插件</td><td>能力包</td><td>装了表格插件，更会处理表格</td></tr><tr><td>连接器</td><td>接外部账号</td><td>Gmail、GitHub、Drive</td></tr><tr><td>技能</td><td>固定工作流说明书</td><td>写教程时按我的风格</td></tr><tr><td>MCP</td><td>接外部工具的通道</td><td>调用某个本地服务</td></tr></tbody></table>'
  }
  if (line.startsWith('权限类型 意味着什么')) {
    return '<table class="yichen-table"><thead><tr><th>权限</th><th>意味着什么</th><th>怎么判断</th></tr></thead><tbody><tr><td>文件访问</td><td>要读或改某个文件夹</td><td>路径是不是你允许的项目</td></tr><tr><td>终端命令</td><td>要在电脑上运行命令</td><td>不懂就先让它解释</td></tr><tr><td>浏览器</td><td>要打开或操作网页</td><td>避开付款、删除、发布</td></tr><tr><td>第三方账号</td><td>要连接 Gmail、GitHub 等</td><td>看清授权范围</td></tr><tr><td>电脑操控</td><td>要操作电脑上的 App</td><td>边界先说清楚</td></tr></tbody></table>'
  }
}

function flushList(kind, items, out) {
  if (!items.length) return
  const tag = kind === 'ol' ? 'ol' : 'ul'
  out.push('<' + tag + '>' + items.map(item => '<li>' + linkify(item) + '</li>').join('') + '</' + tag + '>')
  items.length = 0
}

function blocksToHtml(blocks, imageMap, omitImages) {
  const html = []
  let list = []
  let listKind = ''
  const push = item => {
    flushList(listKind, list, html)
    listKind = ''
    html.push(item)
  }
  for (const block of blocks) {
    if (block.type === 'image') {
      if (omitImages) continue
      const file = imageMap.get(block.url)
      if (!file) continue
      push(figure('/img/shared/yichen/' + file, block.alt))
      continue
    }
    const line = block.text
    if (!line || chromeLine(line) || PROMO.test(line)) continue
    if (/^[一二三四五六七八九十百零]+、/.test(line)) {
      push('<h2>' + esc(line.replace(/^[一二三四五六七八九十百零]+、\s*/, '')) + '</h2>')
      continue
    }
    const ordered = line.match(/^\d+[\.、\)]\s*(.+)$/)
    if (ordered) {
      if (listKind !== 'ol') {
        flushList(listKind, list, html)
        listKind = 'ol'
      }
      list.push(ordered[1])
      continue
    }
    const bullet = line.match(/^[-*•]\s+(.+)$/)
    if (bullet) {
      if (listKind !== 'ul') {
        flushList(listKind, list, html)
        listKind = 'ul'
      }
      list.push(bullet[1])
      continue
    }
    if (line.includes('下面这张图是插件页')) {
      push('<p>下面这张是正在工作的界面：左边导航，中间对话，右边是预览和结果。</p>')
      continue
    }
    const table = maybeTable(line)
    if (table) {
      push(table)
      continue
    }
    push('<p>' + linkify(line) + '</p>')
  }
  flushList(listKind, list, html)
  return html.join('\n')
}

function tokenize(body) {
  const blocks = []
  const lines = body.split('\n')
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line === '---') continue
    const images = [...line.matchAll(IMG_RE)]
    if (images.length) {
      let last = 0
      for (const match of images) {
        const before = line.slice(last, match.index).trim()
        if (before) blocks.push({type: 'text', text: before})
        if (!skipImage(match[2])) blocks.push({type: 'image', alt: match[1], url: match[2]})
        last = match.index + match[0].length
      }
      const after = line.slice(last).trim()
      if (after) blocks.push({type: 'text', text: after})
      continue
    }
    blocks.push({type: 'text', text: line})
  }
  return blocks
}

function splitSections(html) {
  if (!html.includes('<h2>')) {
    return html.trim() ? [{title: '', body: html}] : []
  }
  const parts = html.split(/<h2>/)
  const sections = []
  const lead = parts[0].trim()
  if (lead) sections.push({title: '', body: lead})
  for (const part of parts.slice(1)) {
    const close = part.indexOf('</h2>')
    const title = part.slice(0, close).replace(/<[^>]+>/g, '').trim()
    const body = part.slice(close + 5).trim()
    sections.push({title, body})
  }
  return sections.filter(section => section.body || section.title)
}

function firstParagraph(blocks, chapterTitle) {
  for (const block of blocks) {
    if (block.type !== 'text') continue
    const line = block.text.trim()
    if (!line || chromeLine(line) || PROMO.test(line) || /^[一二三四五六七八九十百零]+、/.test(line)) continue
    if (line.length < 12) continue
    if (line === chapterTitle || /^上一篇/.test(line)) continue
    return line
  }
  return ''
}

function firstImage(blocks, imageMap) {
  for (const block of blocks) {
    if (block.type === 'image' && imageMap.has(block.url)) return '/img/shared/yichen/' + imageMap.get(block.url)
  }
  return ''
}

function junkSection(section) {
  return /购买方法|礼品卡|Plus 够不够|账号额度怎么选|关于价格|写在最后|常见踩坑与解决方案|我对 Codex 的理解|小白学习路线|跑完这五个场景/i.test((section.title || '') + (section.body || ''))
}

const SECTION_TITLE = {
  '牛马打工人必备：用 Codex 做 Word、PDF、PPT、Sheets 四件套': '办公四件套：Word、PDF、PPT、Sheets',
  '手搓酷炫 3D 视频：Codex + HyperFrames / Remotion 做《国产动画十大电影》': '3D 视频：国产动画十大电影',
  '早起早睡身体好：一条提示词做网站，并部署到 Vercel': '做网站：早睡早起并部署到 Vercel',
  '自媒体人必备：用 Codex 制作图文长教程': '做一篇图文教程'
}

function trimLeaked(section) {
  const cut = (section.body || '').search(/<p>[^<]*(他们遇到的痛点非常典型|flowchart LR|边学边玩，再边把钱赚了|今天这篇就带大家进入一些实战场景|然后迁移到商业化|此外，这个思路其实还可以迁移|除了让Codex自己写项目之外|当然，这只是一个很基础的网站|然后是把自己过去写作的经验沉淀|下面是另外一个实战demo)/)
  if (cut < 0) return section
  return {...section, body: section.body.slice(0, cut).replace(/(<p>\s*)+$/, '').trim()}
}

function wrapFigureRuns(html) {
  return String(html || '').replace(/(?:<figure class="yichen-figure">[\s\S]*?<\/figure>\s*){2,}/g, match => '<div class="yichen-gallery">' + match.trim() + '</div>')
}

function wrapPrompts(html) {
  return String(html || '').replace(/<p>(请(?:在当前对话里|重新帮我生成)[\s\S]*?)<\/p>\s*(?:<p>要求：<\/p>\s*)?(<ol>[\s\S]*?<\/ol>)?/g, (_, lead, list) => {
    return '<blockquote class="yichen-prompt"><p>' + lead + '</p>' + (list || '') + '</blockquote>'
  })
}

function compactLabelList(html) {
  return String(html || '').replace(/(?:<p>([^<]{1,40}：)<\/p>\s*){5,}/g, match => {
    const items = [...match.matchAll(/<p>([^<]+)<\/p>/g)].map(item => '<li>' + item[1].replace(/：$/, '') + '</li>')
    return '<ul class="yichen-fields">' + items.join('') + '</ul>'
  })
}

function addDownloadHelp(section) {
  if (!/下载和登录/.test(section.title || '') || section.body.includes('/guide/manager')) return section
  return {
    ...section,
    body: section.body + '\n<aside class="yichen-help"><p>如果官网打不开，或第一次不知道安装包在哪，先看本站的管理工具。里面有安装说明和配置恢复，按当前版本跟着做即可。</p><p><a href="/guide/manager">打开管理工具 →</a></p></aside>'
  }
}

function shortenBoast(html) {
  return String(html || '').replace(
    /所以，我直接干脆让Codex来写，我上一篇爆了92W阅读的[\s\S]*?其实80%都是由Codex完成！/,
    '所以，我直接干脆让Codex来写!'
  )
}

function polishSection(section) {
  const trimmed = addDownloadHelp(trimLeaked({...section, title: SECTION_TITLE[section.title] || section.title}))
  return {...trimmed, body: wrapFigureRuns(wrapPrompts(compactLabelList(shortenBoast(trimmed.body))))}
}

function compactInterface(sections) {
  const out = []
  let nav = null
  let settings = null
  for (const section of sections) {
    const title = section.title || ''
    if (/左侧导航|^搜索|^插件|^自动化/.test(title)) {
      if (!nav) {
        nav = {title: '左侧入口：搜索、插件、自动化', body: ''}
        out.push(nav)
      }
      nav.body += (title.includes('左侧导航') ? '' : '<h3>' + esc(title) + '</h3>\n') + section.body + '\n'
      continue
    }
    if (/设置入口|^设置页/.test(title)) {
      if (!settings) {
        settings = {title: '设置页：从常规到归档', body: ''}
        out.push(settings)
      }
      settings.body += (title.includes('设置入口') ? '' : '<h3>' + esc(title.replace(/^设置页\s*/, '')) + '</h3>\n') + section.body + '\n'
      continue
    }
    out.push(section)
  }
  return out.map(polishSection)
}

export async function importYichen() {
  const markdown = fs.readFileSync(SOURCE, 'utf8')
  const imageMap = collectImages(markdown)
  fs.mkdirSync(IMG_DIR, {recursive: true})
  fs.mkdirSync(CHAPTER_DIR, {recursive: true})
  if (!SKIP_DOWNLOAD) {
    const jobs = [...imageMap.entries()]
    let ok = 0
    let fail = 0
    await mapPool(jobs, 4, async ([url, file]) => {
      try {
        await downloadOne(url, path.join(IMG_DIR, file))
        ok++
        process.stdout.write('IMG ' + file + '\n')
      } catch (error) {
        fail++
        imageMap.delete(url)
        process.stderr.write('IMG_FAIL ' + url + ' ' + error.message + '\n')
      }
    })
    process.stdout.write('IMAGES ' + ok + ' ok / ' + fail + ' fail / ' + imageMap.size + ' kept\n')
  } else {
    for (const [url, file] of [...imageMap.entries()]) {
      if (!fs.existsSync(path.join(IMG_DIR, file))) imageMap.delete(url)
    }
  }

  const records = []
  let figureCount = 0

  for (const chapter of chapterBlocks(markdown)) {
    if (!KEEP.has(chapter.n)) continue
    const part = partOf(chapter.n)
    if (!part) continue
    const title = TITLE_FIX[chapter.n] || chapter.title
    const blocks = tokenize(bodyText(chapter.raw))
    const html = blocksToHtml(blocks, imageMap, Boolean(PLACE[chapter.n]))
    const sections = compactInterface(applyPlacement(chapter.n, splitSections(html).filter(section => !junkSection(section))))
    if (!sections.length) continue
    const placed = sections.map(section => section.body).join('\n')
    const images = (placed.match(/class="yichen-figure"/g) || []).length
    figureCount += images
    records.push({
      sourceN: chapter.n,
      title,
      shortTitle: SHORT_TITLE[chapter.n] || title.replace(/：.+$/, '').slice(0, 22),
      part: part.label,
      partLabel: part.label,
      partId: part.id,
      blurb: PART_INTRO[part.id] || '',
      lead: firstParagraph(blocks, chapter.title) || firstParagraph(blocks, title),
      cover: COVER_FIX[chapter.n] || placed.match(/src="(\/img\/shared\/yichen\/[^"]+)"/)?.[1] || firstImage(blocks, imageMap),
      imageCount: images,
      sections
    })
  }

  const catalogChapters = []
  records.forEach((record, index) => {
    const n = index + 1
    const id = 'ch' + String(n).padStart(2, '0')
    const chapter = {id, n, ...record}
    fs.writeFileSync(path.join(CHAPTER_DIR, id + '.json'), JSON.stringify(chapter, null, 2) + '\n')
    catalogChapters.push({
      id, n, title: chapter.title, shortTitle: chapter.shortTitle,
      part: chapter.part, partLabel: chapter.partLabel, partId: chapter.partId,
      blurb: chapter.blurb, lead: chapter.lead, cover: chapter.cover, imageCount: chapter.imageCount
    })
  })
  const keep = new Set(catalogChapters.map(ch => ch.id + '.json'))
  for (const name of fs.readdirSync(CHAPTER_DIR)) {
    if (name.endsWith('.json') && !keep.has(name)) fs.unlinkSync(path.join(CHAPTER_DIR, name))
  }
  const parts = PARTS
    .map(part => ({id: part.id, n: part.n, label: part.label, intro: PART_INTRO[part.id] || ''}))
    .filter(part => catalogChapters.some(ch => ch.partId === part.id))

  const catalog = {
    title: 'Codex 零基础',
    howTo: HOW_TO,
    parts,
    chapters: catalogChapters
  }
  fs.writeFileSync(path.join(HERE, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n')
  process.stdout.write('CATALOG ' + catalogChapters.length + ' chapters / ' + figureCount + ' figures\n')
  return catalog
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  importYichen().catch(error => {
    console.error(error)
    process.exit(1)
  })
}
