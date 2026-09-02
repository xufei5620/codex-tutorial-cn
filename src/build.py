#!/usr/bin/env python3
"""从 content/ 与 chapters.json 生成：
  site/     —— 离线多文件站点（仓库用，双击 index.html 即可阅读，无 JavaScript）
  preview.html —— 单页预览（claude.ai artifact 用，含极少量 JavaScript 做路由）
"""
import json, re, os, shutil, hashlib, datetime, sys

ROOT = os.path.dirname(os.path.abspath(__file__))          # 仓库里的 src/
CONTENT = os.path.join(ROOT, 'content')
SITE = os.path.abspath(os.path.join(ROOT, '..'))           # 仓库根目录 = 站点根目录
MAINT = os.path.join(ROOT, 'maintainer')
# 由本脚本生成、每次重建前先清掉的东西（其余文件如 .git、src/ 不动）
GENERATED = ['index.html', '404.html', 'robots.txt', 'prompts.html', 'README.md', 'manifest.json', 'SHA256SUMS.txt',
             'assets', 'downloads', 'deploy', 'templates', 'specs', 'schemas', 'registry',
             'maintenance-release.html', 'notion-workflow.html', 'source-research.html'] + [f'ch{i:02d}.html' for i in range(1, 100)]

cfg = json.load(open(os.path.join(ROOT, 'chapters.json'), encoding='utf-8'))
SITE_TITLE = cfg['site']['title']
TAGLINE = cfg['site']['tagline']
CH = cfg['chapters']
PARTS = cfg['parts']
EXTRAS = cfg['extras']
ORDER = [c for p in PARTS for c in p['chapters']]
STATUS_LABEL = {'draft': '草稿', 'outline': '大纲', 'reviewed': '已复核'}

css = open(os.path.join(CONTENT, 'style.css'), encoding='utf-8').read()
ZIP_NAME = f"codex-tutorial-cn-v{cfg['site']['version']}-offline.zip"
FAVICON = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#084a51"/><path d="M18 16h20a8 8 0 0 1 8 8v24H26a8 8 0 0 0-8 8z" fill="#dcecee"/><path d="M18 16v40" stroke="#0e6b74" stroke-width="4"/><path d="M26 26h14M26 34h14" stroke="#084a51" stroke-width="3" stroke-linecap="round"/></svg>'''
NOT_FOUND = '''  <header class="hero"><div class="hero-in"><p class="eyebrow">404</p><h1>找不到这一页</h1><p class="lede">链接可能拼错了，或者这一页已经改了名字。</p><div class="hero-actions"><a class="btn" href="/">回到目录</a></div></div></header>
  <main id="content"><p>如果你是从别处点链接过来的，请按第 11 章 11.5 的方式告诉维护者是哪个链接失效了。</p></main>'''


def read(name):
    return open(os.path.join(CONTENT, name + '.html'), encoding='utf-8').read()

# ---------- 链接与锚点 ----------
def resolve_links(html, mode, page_id):
    """{{link:X}} / {{link:X#anchor}} → 多文件: X.html#anchor ; 单页: #X-anchor"""
    def rep(m):
        target, anchor = m.group(1), m.group(2)
        if mode == 'multi':
            fname = 'index.html' if target == 'home' else target + '.html'
            return fname + ('#' + anchor if anchor else '')
        else:
            return '#' + target + ('-' + anchor if anchor else '')
    return re.sub(r'\{\{link:([\w-]+)(?:#([\w-]+))?\}\}', rep, html)

def localize_anchors(html, page_id):
    """单页模式：把页内 id / #href 加上页面前缀，避免各章 id 冲突。"""
    html = re.sub(r'\bid="([\w-]+)"', lambda m: f'id="{page_id}-{m.group(1)}"', html)
    html = re.sub(r'href="#([\w-]+)"', lambda m: f'href="#{page_id}-{m.group(1)}"', html)
    return html

# ---------- 组件 ----------
def badge(status, text=None):
    return f'<span class="badge {status}">{text or STATUS_LABEL[status]}</span>'

def sidebar(current, mode):
    L = lambda t, a=None: resolve_links('{{link:%s%s}}' % (t, '#' + a if a else ''), mode, current)
    out = [f'    <a class="brand" href="{L("home")}">{SITE_TITLE}<small>{TAGLINE}</small></a>',
           f'    <a class="side-toc-link" href="{L("home")}">← 全部章节</a>',
           '    <nav aria-label="全部章节">']
    for p in PARTS:
        out.append(f'      <p class="part-label">{p["short"]}</p>')
        out.append('      <ol class="chapters">')
        for cid in p['chapters']:
            c = CH[cid]
            cur = ' class="is-current"' if cid == current else ''
            aria = ' aria-current="page"' if cid == current else ''
            out.append(f'        <li{cur}><a href="{L(cid)}"{aria}><span class="n">{c["num"]:02d}</span><span class="t">{c["title"]}</span><span class="dot {c["status"]}" title="{STATUS_LABEL[c["status"]]}"></span></a></li>')
        out.append('      </ol>')
    for eid, e in EXTRAS.items():
        cur = ' is-current' if eid == current else ''
        out.append(f'      <a class="side-entry{cur}" href="{L(eid)}">{e["title"]}</a>')
    out.append('    </nav>')
    out.append('    <div class="side-foot"><ul class="legend"><li><span class="dot draft"></span>草稿</li><li><span class="dot outline"></span>大纲</li></ul></div>')
    return '\n'.join(out)

def pager(cid, mode):
    L = lambda t: resolve_links('{{link:%s}}' % t, mode, cid)
    i = ORDER.index(cid)
    prev_html = next_html = ''
    if i > 0:
        p = CH[ORDER[i-1]]
        prev_html = f'      <a class="prev" href="{L(ORDER[i-1])}"><span class="k">上一章</span><span class="t">第 {p["num"]} 章　{p["title"]}</span></a>'
    else:
        prev_html = '      <span class="spacer"></span>'
    if i < len(ORDER) - 1:
        n = CH[ORDER[i+1]]
        next_html = f'      <a class="next" href="{L(ORDER[i+1])}"><span class="k">下一章</span><span class="t">第 {n["num"]} 章　{n["title"]}</span></a>'
    else:
        next_html = f'      <a class="next" href="{L("home")}"><span class="k">全书结束</span><span class="t">返回目录</span></a>'
    return prev_html + '\n' + next_html

def doc_page(pid, mode):
    body = read(pid)
    if mode == 'single':
        body = localize_anchors(body, pid)
    body = resolve_links(body, mode, pid)
    home = resolve_links('{{link:home}}', mode, pid)
    pg = f'    <nav class="pager">\n{pager(pid, mode)}\n    </nav>\n' if pid in CH else ''
    return f'''<div class="layout">
  <aside class="sidebar">
{sidebar(pid, mode)}
  </aside>
  <main class="doc-main" id="{'content' if mode=='multi' else pid+'-content'}">
    <article class="chapter{' prompts' if pid=='prompts' else ''}">
{body}
    </article>
{pg}    <footer class="page"><p>本页为离线教程的一部分，无需联网阅读。<a href="{home}">返回目录</a></p></footer>
  </main>
</div>'''

def home_body(mode):
    L = lambda t, a=None: resolve_links('{{link:%s%s}}' % (t, '#' + a if a else ''), mode, 'home')
    done = sum(1 for c in CH.values() if c['status'] != 'outline')
    toc = []
    for p in PARTS:
        toc.append(f'    <section class="part">\n      <div class="part-head"><h2>{p["label"]}</h2><p>{p["desc"]}</p></div>\n      <ol class="toc">')
        for cid in p['chapters']:
            c = CH[cid]
            toc.append(f'        <li><a href="{L(cid)}"><span class="n">{c["num"]:02d}</span><span class="t">{c["title"]}</span><span class="d">{c["desc"]}</span>{badge(c["status"])}</a></li>')
        toc.append('      </ol>\n    </section>')
    toc = '\n'.join(toc)
    extras = '\n'.join(f'      <a class="entry" href="{L(eid)}"><strong>{e["title"]}</strong>{badge(e["status"], e["badge"])}<span>{e["desc"]}</span></a>' for eid, e in EXTRAS.items())
    if mode == 'multi':
        aux = '''      <ul class="aux">
        <li><a href="specs/2026-09-01-framework-first-addendum.html">框架说明</a><span class="muted">定位、受众与首版边界</span></li>
        <li><a href="maintenance-release.html">维护与发布流程</a><span class="muted">状态机、复验周期、撤回规则</span></li>
        <li><a href="source-research.html">来源研究方法</a><span class="muted">外部素材的权利登记规则</span></li>
        <li><a href="notion-workflow.html">Notion 工作流（暂缓）</a><span class="muted">留待将来协作时启用</span></li>
        <li><a href="templates/module-template.html">课程模块模板</a><span class="muted">写新章节时复制使用</span></li>
        <li><a href="templates/prompt-card-template.html">提示词卡模板</a><span class="muted">写新卡片时复制使用</span></li>
        <li><a href="templates/plugin-template.html">插件模板</a> / <a href="templates/skill-template.html">Skill 模板</a><span class="muted">扩展条目模板</span></li>
        <li><a href="templates/source-review-template.html">来源复核模板</a> / <a href="templates/verification-template.html">验证记录模板</a><span class="muted">复核与实测记录</span></li>
        <li><a href="registry/framework-v1.json" download>框架登记表（JSON）</a><span class="muted">机器可读的进度与规则登记</span></li>
      </ul>'''
    else:
        aux = '''      <ul class="aux">
        <li><span class="dead" title="预览未收录，见仓库">框架说明</span><span class="muted">定位、受众与首版边界</span></li>
        <li><span class="dead" title="预览未收录，见仓库">维护与发布流程</span><span class="muted">状态机、复验周期、撤回规则</span></li>
        <li><span class="dead" title="预览未收录，见仓库">来源研究方法</span><span class="muted">外部素材的权利登记规则</span></li>
        <li><span class="dead" title="预览未收录，见仓库">课程模块模板 / 提示词卡模板 / 插件模板 / Skill 模板</span><span class="muted">写新内容时复制使用</span></li>
        <li><span class="dead" title="预览未收录，见仓库">来源复核模板 / 验证记录模板</span><span class="muted">复核与实测记录</span></li>
        <li><span class="dead" title="预览未收录，见仓库">框架登记表（JSON）</span><span class="muted">机器可读的进度与规则登记</span></li>
      </ul>'''
    return f'''  <header class="hero">
    <div class="hero-in">
      <p class="eyebrow">零基础 · 在线 / 离线阅读 · Windows / macOS</p>
      <h1>{SITE_TITLE}</h1>
      <p class="lede">写给第一次接触 AI 与 Codex 的读者：不需要编程、命令行或 Git 基础。在线阅读，或下载离线版——解压后双击打开即可，无需联网、无需账号。</p>
      <div class="hero-actions">
        <a class="btn" href="{L('ch01')}">从第 1 章开始</a>
        {('<a class="btn ghost" href="downloads/' + ZIP_NAME + '" download>下载离线版（ZIP）</a>') if mode == 'multi' else ''}
        <p class="progress">正文草稿已完成 {done} / {len(CH)} 章</p>
      </div>
    </div>
  </header>
  <main id="content">
    <aside class="callout note" data-label="阅读须知">
      <p>全部 11 章均已有可读正文，但都还是「<strong>草稿</strong>」：内容依据 2026 年 9 月 1 日查阅的官方文档撰写，<strong>尚未在真实的 Windows / macOS 电脑上逐步实测</strong>。软件界面更新很快，若你看到的按钮名称与教程不同，以屏幕上实际显示为准，并欢迎反馈。每一章都会经过写作、复核、实测三步后才标记为完成。</p>
      <ul class="legend">
        <li>{badge('draft')} 正文可读，待复核与实测</li>
        <li>{badge('outline')} 只有规划，正文未写</li>
      </ul>
    </aside>

{toc}

    <section class="part">
      <div class="part-head"><h2>独立入口</h2><p>与章节并列，随时可查</p></div>
{extras}
    </section>

    <details class="maint">
      <summary>维护者资料（读者可以忽略）</summary>
{aux}
    </details>

    <footer>
      <p>本教程为纯静态 HTML：无 JavaScript、无远程资源、无跟踪。在线版与离线版内容完全相同，离线版解压后双击 <code>index.html</code> 即可阅读。版本 {cfg['site']['version']}（{cfg['site']['date']}），更新记录见<a href="{L('ch11', 's3')}">第 11 章</a>。</p>
    </footer>
  </main>'''

# ---------- 多文件站点 ----------
DESCRIPTION = '写给零基础中文读者的 Codex 入门教程：安装登录、把需求说清楚、检查与回退、插件、Skill、常见场景与完整案例。纯静态网页，可在线读也可下载离线读。'

def page_shell(title, body_class, inner, css_href='assets/style.css', desc=DESCRIPTION):
    cls = f' class="{body_class}"' if body_class else ''
    return f'''<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title}</title>
  <meta name="description" content="{desc}">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{desc}">
  <meta property="og:type" content="website">
  <meta name="theme-color" content="#084a51">
  <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="{css_href}">
</head>
<body{cls}>
  <a class="skip" href="#content">跳到正文</a>
{inner}
</body>
</html>
'''

def build_site():
    for name in GENERATED:
        p = os.path.join(SITE, name)
        if os.path.isdir(p): shutil.rmtree(p)
        elif os.path.exists(p): os.remove(p)
    os.makedirs(os.path.join(SITE, 'assets'))
    open(os.path.join(SITE, 'assets', 'style.css'), 'w', encoding='utf-8').write(css)
    open(os.path.join(SITE, 'assets', 'favicon.svg'), 'w', encoding='utf-8').write(FAVICON)
    open(os.path.join(SITE, 'index.html'), 'w', encoding='utf-8').write(
        page_shell(SITE_TITLE, 'home', home_body('multi')))
    open(os.path.join(SITE, '404.html'), 'w', encoding='utf-8').write(
        page_shell(f'找不到页面｜{SITE_TITLE}', 'home', NOT_FOUND, css_href='/assets/style.css'))
    open(os.path.join(SITE, 'robots.txt'), 'w', encoding='utf-8').write('User-agent: *\nAllow: /\nDisallow: /templates/\nDisallow: /specs/\nDisallow: /schemas/\nDisallow: /registry/\nDisallow: /src/\nDisallow: /deploy/\n')
    shutil.copytree(os.path.join(ROOT, 'deploy'), os.path.join(SITE, 'deploy'))
    for cid in ORDER:
        c = CH[cid]
        open(os.path.join(SITE, cid + '.html'), 'w', encoding='utf-8').write(
            page_shell(f'第 {c["num"]} 章 {c["title"]}｜{SITE_TITLE}', '', doc_page(cid, 'multi')))
    for eid, e in EXTRAS.items():
        open(os.path.join(SITE, eid + '.html'), 'w', encoding='utf-8').write(
            page_shell(f'{e["title"]}｜{SITE_TITLE}', '', doc_page(eid, 'multi')))
    # 维护者文件：从原仓库原样复制
    for name in ['maintenance-release.html', 'notion-workflow.html', 'source-research.html', 'templates', 'specs', 'schemas']:
        src = os.path.join(MAINT, name)
        dst = os.path.join(SITE, name)
        (shutil.copytree if os.path.isdir(src) else shutil.copy2)(src, dst)
    # 登记表
    os.makedirs(os.path.join(SITE, 'registry'))
    reg = json.load(open(os.path.join(MAINT, 'framework-v1.json'), encoding='utf-8'))
    reg['version'] = cfg['site']['version']
    reg['status'] = 'draft-complete-unverified'
    reg['chapters'] = [{'number': CH[c]['num'], 'title': CH[c]['title'], 'status': CH[c]['status'], 'file': c + '.html'} for c in ORDER]
    reg['productNote'] = ('2026-07-09 起 Codex 桌面应用并入 ChatGPT 桌面应用（macOS/Windows），'
                          '教程中的“Codex”指该应用左上角菜单中的 Codex 视图。')
    reg['generatedDate'] = cfg['site']['date']
    json.dump(reg, open(os.path.join(SITE, 'registry', 'framework-v1.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    # README
    open(os.path.join(SITE, 'README.md'), 'w', encoding='utf-8').write(readme())
    # manifest + SHA256SUMS
    files = []
    for dp, dns, fns in os.walk(SITE):
        dns[:] = [d for d in dns if d not in ('.git', 'src', 'downloads')]
        for fn in fns:
            if fn in ('manifest.json', 'SHA256SUMS.txt') or fn.startswith('.'):
                continue
            p = os.path.join(dp, fn)
            rel = os.path.relpath(p, SITE).replace(os.sep, '/')
            data = open(p, 'rb').read()
            files.append({'path': rel, 'size': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
    files.sort(key=lambda f: f['path'])
    manifest = {'schemaVersion': '1.0.0', 'artifact': 'codex-tutorial-cn', 'version': cfg['site']['version'],
                'status': 'draft-complete-unverified', 'generatedDate': cfg['site']['date'], 'entry': 'index.html', 'files': files}
    json.dump(manifest, open(os.path.join(SITE, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    open(os.path.join(SITE, 'SHA256SUMS.txt'), 'w', encoding='utf-8').write(
        ''.join(f"{f['sha256']}  {f['path']}\n" for f in files))
    # 离线版 ZIP（放进 downloads/，不计入清单，避免自包含）
    import zipfile
    dl = os.path.join(SITE, 'downloads'); os.makedirs(dl)
    zpath = os.path.join(dl, ZIP_NAME)
    # 可重现打包：时间戳固定为站点日期、条目按名称排序、权限固定，同样的源文件必然得到逐字节相同的 ZIP
    y, m, d = (int(x) for x in cfg['site']['date'].split('-'))
    zip_time = (y, m, d, 0, 0, 0)
    with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_DEFLATED) as z:
        for dp, dns, fns in os.walk(SITE):
            dns[:] = sorted(d for d in dns if d not in ('.git', 'src', 'downloads', 'deploy'))
            for fn in sorted(fns):
                if fn.startswith('.'): continue
                p = os.path.join(dp, fn)
                arcname = os.path.join('codex-tutorial-cn', os.path.relpath(p, SITE)).replace(os.sep, '/')
                zi = zipfile.ZipInfo(arcname, date_time=zip_time)
                zi.compress_type = zipfile.ZIP_DEFLATED
                zi.create_system = 3
                zi.external_attr = 0o644 << 16
                with open(p, 'rb') as f:
                    z.writestr(zi, f.read())

def readme():
    rows = '\n'.join(f"| {CH[c]['num']:02d} | [{CH[c]['title']}]({c}.html) | {STATUS_LABEL[CH[c]['status']]} |" for c in ORDER)
    return f'''# {SITE_TITLE}

写给第一次接触 AI 与 Codex 的中文读者的离线教程。不需要编程、命令行或 Git 基础。

**怎么读：** 在线版部署好后直接打开网址；或者下载首页的「离线版 ZIP」（也可以 Code → Download ZIP），解压后双击 `index.html`。全站纯 HTML + CSS，无 JavaScript、无远程资源，不联网也能看。

**怎么部署到自己的服务器：** 见 [deploy/DEPLOY.md](deploy/DEPLOY.md)——Docker 一条命令，或 Caddy / Nginx 复制文件即可，没有构建步骤。

**当前版本：** {cfg['site']['version']}（{cfg['site']['date']}）。11 章全部有正文，均为「草稿」：依据官方文档撰写，尚未在真实电脑上逐步实测。

> 2026 年 7 月 9 日起，Codex 桌面应用已并入「ChatGPT 桌面应用」（macOS / Windows）。本教程所说的 Codex，指该应用左上角菜单里的 **Codex** 视图。

| 章 | 标题 | 状态 |
|---|---|---|
{rows}

独立入口：[行业提示词库](prompts.html)（首批 6 张跨行业通用卡）。

## 目录结构

- `index.html`、`ch01.html` … `ch11.html`、`prompts.html` —— 读者页面
- `assets/` —— 共用样式与图标；`404.html`、`robots.txt` —— 在线部署用
- `downloads/` —— 离线版 ZIP（由构建脚本生成）
- `deploy/` —— 服务器部署配置与说明
- `src/` —— **内容源与构建脚本**：改内容请改 `src/content/*.html` 与 `src/chapters.json`，然后运行 `python3 src/build.py` 重新生成以上全部页面（不要直接改根目录的 HTML，会被覆盖）；`python3 src/check.py` 做发布前检查
- `templates/`、`specs/`、`schemas/`、`registry/`、`maintenance-release.html`、`source-research.html`、`notion-workflow.html` —— 维护者资料
- `manifest.json`、`SHA256SUMS.txt` —— 文件清单与校验和

## 维护约定

**改内容的正确姿势：** 编辑 `src/content/` 里对应章节的 HTML 片段（章节标题、状态在 `src/chapters.json`），运行 `python3 src/build.py`（只需要 Python 3，无第三方依赖），根目录下的所有页面、README、清单、离线 ZIP 会一起重新生成；再运行 `python3 src/check.py` 检查链接、锚点、徽章与登记表；把生成结果一并提交。跨页链接写成 `{{link:ch04}}` 或 `{{link:prompts#prm-com-0001}}`，构建时自动换成正确地址。

每一章底部都有「维护者信息」：模块 ID、风险级别、来源与权利、验证状态、复核日期。新增或修改内容请使用 `templates/` 中的模板，并在第 11 章更新版本记录与验证状态表。来源清单见第 11 章 11.2。
'''

# ---------- 单页预览 ----------
def build_preview():
    routes = [f'<div class="route home" id="home" hidden>\n{home_body("single")}\n</div>']
    for pid in ORDER + list(EXTRAS):
        routes.append(f'<div class="route" id="{pid}" hidden>\n{doc_page(pid, "single")}\n</div>')
    js = '''<script>
(function () {
  var routes = Array.prototype.slice.call(document.querySelectorAll('.route'));
  function show() {
    var id = location.hash.replace('#', '') || 'home';
    var el = document.getElementById(id);
    if (!el) { el = document.getElementById('home'); }
    var route = el.closest ? el.closest('.route') : null;
    if (!route) return;
    routes.forEach(function (p) { p.hidden = (p !== route); });
    if (el === route) { window.scrollTo(0, 0); } else { setTimeout(function () { el.scrollIntoView({ behavior: 'instant', block: 'start' }); }, 0); }
  }
  window.addEventListener('hashchange', show);
  show();
})();
</script>'''
    html = f'''<title>{SITE_TITLE}</title>
<style>
{css}
.preview-bar {{ background: var(--paper); border-bottom: 2px solid var(--accent); color: var(--muted); font-size: .85rem; padding: .5rem 1.2rem; }}
.preview-bar strong {{ color: var(--accent-deep); }}
.dead {{ color: #9aa7ad; }}
.route .layout {{ min-height: auto; }}
</style>
<div class="preview-bar"><strong>站点预览</strong>｜版本 {cfg['site']['version']}（{cfg['site']['date']}）。正式版为离线多文件网页：下载仓库后双击 index.html 即可阅读。</div>
{chr(10).join(routes)}
{js}
'''
    open(os.path.join(ROOT, 'preview.html'), 'w', encoding='utf-8').write(html)  # 内部预览用，不属于站点

if __name__ == '__main__':
    build_site()
    build_preview()
    print('built site/ and preview.html')
