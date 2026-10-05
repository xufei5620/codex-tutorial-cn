// Generate the complete VitePress source for one site into <site>/.src/.
// Hand-written inputs are never modified; .src/ is wiped and rebuilt on every run.
// No network, shell or deployment.
//
// Inputs
//   shared/pages/    pages for both sites, with %%NAME%% placeholders from site.json
//   <site>/overrides/ optional per-site replacement for a shared page (same placeholders)
//   <site>/pages/    pages that exist only on this site, copied as they are
//   <site>/public/   this site's static files (logo, contact images, local screenshots)
//   shared/img, shared/admin, studio/content, studio/screenshots, src/content/prompts.html
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { copyTree, listFiles, markGenerated, readJson, render, writeBelow } from './util.mjs'
import { WECOM_QR, loadSite, pagesHeaders, pagesRoutes, publicContact, publicSite, qrSVG, templateVars } from './site.mjs'
import { stagePrompts } from './prompts.mjs'
import { attachCourseFigures, loadCourse } from './course.mjs'
import { collectDocs } from './docs.mjs'
import { buildNav } from './nav.mjs'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const OUTPUT = '.src'

// Files that older builds wrote next to the hand-written sources. Removed so they cannot be
// mistaken for sources; none of them was ever committed.
const LEGACY_OUTPUTS = [
  'clients', 'learn', 'industry',
  ...['download', 'choose-tool', 'connection-basics', 'manager', 'verify', 'troubleshooting', 'recovery', 'account'].map((n) => `guide/${n}.md`),
  'contact.md', 'screenshots.md', 'skills.md', 'tools.md',
  'nav.generated.json', 'site.generated.json', 'course-provenance.generated.json', 'studio.generated.json',
  'public/admin', 'public/img/shared', 'public/img/course', 'public/img/contact/wecom-auto.svg',
  'public/_headers', 'public/_routes.json', 'public/studio'
]

// Never copied from <site>/public: the build writes these itself.
const GENERATED_PUBLIC = ['_headers', '_routes.json', 'admin/', 'img/shared/', 'img/course/', WECOM_QR, 'studio/']

const page = (title, body, extra = '') => markGenerated(`---\ntitle: ${title}\noutline: false\n${extra}---\n${body}`)

const CONTACT_PAGE =
  '---\ntitle: 联系客服\noutline: false\n---\n# 联系客服\n\n<SupportCard />\n\n## 求助前准备\n\n' +
  '提供工具与系统版本、模型 ID、大致时间、脱敏错误文案和请求 ID。账户或订单问题仅在确认的客服会话中提供必要资料。\n\n' +
  '不要发送 API Key、Authorization、Cookie、密码、验证码、未使用兑换码或整包原始配置。\n\n' +
  '[排错顺序](/guide/troubleshooting) · [常见问题](/faq) · [错误码](/errors)\n'

const SKILL_SLOTS = [
  ['skills-editor', '保存 SKILL.md'],
  ['skills-install', '确认技能目录与发现'],
  ['skills-test', '按技能检查一次结果']
]

export function generate(id, root = ROOT) {
  const siteDirectory = path.join(root, id)
  const shared = path.join(root, 'shared')
  const out = path.join(siteDirectory, OUTPUT)
  const site = loadSite(id, siteDirectory)
  const vars = templateVars(site)
  const contact = publicContact(site)
  const pub = publicSite(site, vars, contact)

  for (const name of LEGACY_OUTPUTS) fs.rmSync(path.join(siteDirectory, name), { recursive: true, force: true })
  for (const dir of ['guide', 'image']) {
    const left = path.join(siteDirectory, dir)
    if (fs.existsSync(left) && !listFiles(left).length) fs.rmSync(left, { recursive: true })
  }
  fs.rmSync(out, { recursive: true, force: true })
  const write = (name, body) => writeBelow(out, name, body)

  // Pages. A shared page may be replaced per site by overrides/; pages/ adds site-only pages.
  const pages = new Map()
  const add = (name, body, source) => {
    if (pages.has(name)) throw Error(`${source} 与已有页面重名：${name}`)
    pages.set(name, body)
  }
  const pageRoot = path.join(shared, 'pages'), overrideRoot = path.join(siteDirectory, 'overrides')
  for (const name of [...new Set([...listFiles(pageRoot), ...listFiles(overrideRoot)])].filter((n) => n.endsWith('.md'))) {
    const custom = path.join(overrideRoot, name)
    const source = fs.existsSync(custom) ? custom : path.join(pageRoot, name)
    add(name, markGenerated(render(fs.readFileSync(source, 'utf8'), vars)), 'shared/pages')
  }
  const sitePages = path.join(siteDirectory, 'pages')
  for (const name of listFiles(sitePages).filter((n) => n.endsWith('.md'))) add(name, fs.readFileSync(path.join(sitePages, name), 'utf8'), id + '/pages')

  const prompts = stagePrompts(path.dirname(root))
  for (const [name, body] of prompts.pages) add(name, markGenerated(body), 'src/content')
  add('contact.md', markGenerated(CONTACT_PAGE), 'build')

  const manifest = []
  const { catalog, chapters, sources } = loadCourse(path.join(root, 'studio/content'))
  for (const ch of chapters) {
    attachCourseFigures(ch, manifest)
    add('learn/codex/' + ch.id + '.md', page(JSON.stringify(ch.title), `\n<StudioChapter chapter-id="${ch.id}" />\n`), 'course')
  }
  add('learn/codex/index.md', page('Codex 零基础', '<StudioHub kind="course" />\n'), 'build')
  add('learn/claude/index.md', page('Claude 教程', '<StudioHub kind="claude" />\n'), 'build')
  // The account guide keeps the site's own start page text under a second address.
  if (!pages.has('guide/start.md')) throw Error(id + '/pages/guide/start.md is required')
  add('guide/account.md', markGenerated(pages.get('guide/start.md')), 'build')
  add('skills.md', page('Skill 动手工坊', '<SkillWorkshop />\n'), 'build')
  add('tools.md', page('工具接入', '<StudioHub kind="tools" />\n'), 'build')
  add('screenshots.md', page('截图管理', '<ScreenshotCatalog />\n', 'search: false\n'), 'build')
  for (const [name, body] of pages) write(name, body)

  // Screenshot slots: course figures, the skill workshop, then every step-by-step page.
  for (const [slot, title] of SKILL_SLOTS)
    manifest.push({ id: slot, route: '/skills', group: 'Skill 动手工坊', section: title, title, target: '按当前产品记录' + title + '的实际界面', optional: true, capturePolicy: 'optional', siteOnly: false })
  const ordered = listFiles(out).map((n) => n.replaceAll('\\', '/')).filter((n) => n.endsWith('.md') && !n.startsWith('public/'))
  const docs = collectDocs(ordered.map((n) => [n, pages.get(n)]), manifest)
  if (new Set(manifest.map((s) => s.id)).size !== manifest.length) throw Error('Duplicate screenshot ID')

  const shotsFile = path.join(root, 'studio/screenshots', id + '.json')
  const shots = fs.existsSync(shotsFile) ? readJson(shotsFile) : { schema: 'xingmang-screenshots/1', version: '5.6', siteId: id, records: {} }
  if (shots.siteId !== id) throw Error('Screenshot site mismatch')

  const studio = {
    version: '5.6',
    site: { ...pub, console_url: site.console_url, keys_url: site.keys_url, models_url: site.models_url },
    catalog,
    chapters,
    sources,
    manifest,
    docs,
    shots,
    scope: {
      totalChapters: chapters.length,
      totalSections: chapters.reduce((n, c) => n + c.sections.length, 0),
      totalFigures: chapters.reduce((n, c) => n + (c.imageCount || 0), 0),
      note: '课程目录与配图按逸尘图文教程组织；购买、套餐、中转和线下引流正文未收录。'
    }
  }
  write('site.generated.json', JSON.stringify(pub, null, 2))
  write('nav.generated.json', JSON.stringify(buildNav(readJson(path.join(siteDirectory, 'nav.json')), catalog, prompts.sidebar), null, 2) + '\n')
  write('studio.generated.json', JSON.stringify(studio))

  // Static files: the site's own first, then everything the build provides.
  copyTree(path.join(siteDirectory, 'public'), path.join(out, 'public'), (name) => {
    const rel = name.replaceAll('\\', '/')
    return !GENERATED_PUBLIC.some((g) => (g.endsWith('/') ? rel.startsWith(g) : rel === g))
  })
  copyTree(path.join(shared, 'img'), path.join(out, 'public/img/shared'))
  copyTree(path.join(shared, 'admin'), path.join(out, 'public/admin'))
  const cmsBranch = process.env.DOCS_CMS_BRANCH
  if (cmsBranch) {
    if (!/^[A-Za-z0-9._/-]+$/.test(cmsBranch) || cmsBranch.includes('..')) throw Error('Invalid CMS branch')
    const config = path.join(out, 'public/admin/config.yml')
    if (fs.existsSync(config)) fs.writeFileSync(config, fs.readFileSync(config, 'utf8').replace(/^  branch:.*$/m, '  branch: ' + cmsBranch))
  }
  if (contact.wecom_qr) write('public/' + WECOM_QR, qrSVG(contact.wecom_url))
  write('public/_headers', pagesHeaders(site))
  write('public/_routes.json', pagesRoutes())
  write('public/studio/screenshot-map.json', JSON.stringify(manifest))

  console.log(`${id}: ${pages.size} pages / ${chapters.length} chapters / ${studio.scope.totalFigures} figures / ${manifest.length} screenshot slots`)
  return studio
}

if (process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  try {
    const ids = process.argv.slice(2)
    if (!ids.length) throw Error('Usage: node build/index.mjs sub2api|newapi [...]')
    for (const id of ids) generate(id)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
