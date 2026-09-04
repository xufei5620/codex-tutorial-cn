#!/usr/bin/env python3
"""从 content/ 与 chapters.json 生成：
  site/     —— 离线多文件站点（仓库用，双击 index.html 即可阅读，无 JavaScript）
  preview.html —— 单页预览（claude.ai artifact 用，含极少量 JavaScript 做路由）
"""
import html, json, re, os, shutil, hashlib, datetime, sys, tempfile, zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))          # 仓库里的 src/
CONTENT = os.path.join(ROOT, 'content')
SITE = os.path.abspath(os.path.join(ROOT, '..'))           # 仓库根目录 = 站点根目录
MAINT = os.path.join(ROOT, 'maintainer')
# 由本脚本生成、每次重建前先清掉的东西（其余文件如 .git、src/ 不动）
GENERATED = ['index.html', '404.html', 'robots.txt', 'prompts.html', 'README.md', 'manifest.json', 'SHA256SUMS.txt',
             'assets', 'downloads', 'deploy', 'templates', 'specs', 'schemas', 'registry',
             'maintenance-release.html', 'notion-workflow.html', 'source-research.html'] + [f'ch{i:02d}.html' for i in range(1, 100)]

def reject_duplicate_json_keys(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f'duplicate JSON key: {key!r}')
        result[key] = value
    return result


def load_json(path):
    with open(path, encoding='utf-8') as handle:
        return json.load(handle, object_pairs_hook=reject_duplicate_json_keys)


cfg = load_json(os.path.join(ROOT, 'chapters.json'))
MODULES_CFG = load_json(os.path.join(ROOT, 'modules-v1.json'))
UNIT_BY_ID = {unit['id']: unit for unit in MODULES_CFG['units']}
RETIREMENT_BY_ID = {record['unitId']: record for record in MODULES_CFG.get('retirementRecords', [])}
COLLECTION_TITLE = {item['key']: item['title'] for item in MODULES_CFG['collections']}
COLLECTION_PREFIX = {item['key']: item['idPrefix'] for item in MODULES_CFG['collections']}
TASK_TITLE = {item['key']: item['title'] for item in MODULES_CFG['taskTypes']}
SITE_TITLE = cfg['site']['title']
TAGLINE = cfg['site']['tagline']
CH = cfg['chapters']
PARTS = cfg['parts']
EXTRAS = cfg['extras']
ORDER = [c for p in PARTS for c in p['chapters']]
STATUS_LABEL = {
    'outline': '大纲',
    'draft': '草稿',
    'source-and-rights-review': '来源与权利复核',
    'editorial-reviewed': '已编辑审校',
    'verification': '验证中',
    'acceptance-ready': '待验收',
    'stable': '稳定',
    'retired': '已退役',
}
PIPELINE_INDEX = {status: index for index, status in enumerate(STATUS_LABEL)}
FORMALLY_REVIEWED = {'editorial-reviewed', 'verification', 'acceptance-ready', 'stable'}
ARTIFACT_STATUSES = {
    'draft-seed-unverified', 'review-in-progress', 'acceptance-ready', 'stable', 'retired',
}
LOCKED_STABLE_GATES = [
    'framework-user-approved',
    'all-required-content-acceptance-ready',
    'source-and-rights-clear',
    'required-platform-verification-complete',
    'offline-build-and-links-pass',
    'accessibility-and-safety-gates-pass',
    'release-artifacts-reproducible',
]
LOCKED_LESSON_COUNTS = {
    'ch01': 5, 'ch02': 5, 'ch03': 8, 'ch04': 6, 'ch05': 6, 'ch06': 6,
    'ch07': 6, 'ch08': 8, 'ch09': 5, 'ch10': 5, 'ch11': 5,
}
LOCKED_ACTIVE_PROMPT_COUNTS = {
    'prompt-common': 6,
    'prompt-ecommerce': 5,
    'prompt-food': 5,
    'prompt-media': 5,
    'prompt-education': 5,
}
SHARED_PROMPT_ID = 'PRM-COM-0003'
SHARED_PROMPT_PLACEMENTS = list(LOCKED_ACTIVE_PROMPT_COUNTS)

css = open(os.path.join(CONTENT, 'style.css'), encoding='utf-8').read()
ZIP_NAME = f"codex-tutorial-cn-v{cfg['site']['version']}-offline.zip"
FAVICON = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#084a51"/><path d="M18 16h20a8 8 0 0 1 8 8v24H26a8 8 0 0 0-8 8z" fill="#dcecee"/><path d="M18 16v40" stroke="#0e6b74" stroke-width="4"/><path d="M26 26h14M26 34h14" stroke="#084a51" stroke-width="3" stroke-linecap="round"/></svg>'''
NOT_FOUND = '''  <header class="hero"><div class="hero-in"><p class="eyebrow">404</p><h1>找不到这一页</h1><p class="lede">链接可能拼错了，或者这一页已经改了名字。</p><div class="hero-actions"><a class="btn" href="/">回到目录</a></div></div></header>
  <main id="content"><p>如果你是从别处点链接过来的，请按第 11 章 11.5 的方式告诉维护者是哪个链接失效了。</p></main>'''

TEXT_SUFFIXES = {
    '.cfg', '.conf', '.css', '.html', '.ini', '.json', '.md', '.sha256', '.svg', '.toml', '.txt', '.xml', '.yml', '.yaml',
}
TEXT_NAMES = {'Caddyfile', 'Dockerfile'}
BINARY_SUFFIXES = {'.avif', '.gif', '.ico', '.jpeg', '.jpg', '.png', '.webp'}


def validate_binary_asset(path, suffix):
    if os.path.getsize(path) > 20 * 1024 * 1024:
        raise ValueError(f'public binary asset exceeds 20 MiB: {path}')
    with open(path, 'rb') as handle:
        header = handle.read(32)
    signatures = {
        '.png': header.startswith(b'\x89PNG\r\n\x1a\n'),
        '.jpg': header.startswith(b'\xff\xd8\xff'),
        '.jpeg': header.startswith(b'\xff\xd8\xff'),
        '.gif': header.startswith((b'GIF87a', b'GIF89a')),
        '.webp': header.startswith(b'RIFF') and header[8:12] == b'WEBP',
        '.ico': header.startswith(b'\x00\x00\x01\x00'),
        '.avif': len(header) >= 12 and header[4:8] == b'ftyp' and b'avif' in header[8:32],
    }
    if not signatures.get(suffix, False):
        raise ValueError(f'public binary asset does not match its file type: {path}')


def write_text(path, text):
    normalized = str(text).replace('\r\n', '\n').replace('\r', '\n').rstrip('\n') + '\n'
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8', newline='\n') as handle:
        handle.write(normalized)


def write_json(path, value):
    write_text(path, json.dumps(value, ensure_ascii=False, indent=2))


def copy_public_file(source, target):
    if os.path.islink(source):
        raise ValueError(f'public source must not be a symbolic link: {source}')
    suffix = os.path.splitext(source)[1].lower()
    if suffix in TEXT_SUFFIXES or os.path.basename(source) in TEXT_NAMES:
        with open(source, encoding='utf-8') as handle:
            payload = handle.read()
        if suffix == '.json':
            json.loads(payload, object_pairs_hook=reject_duplicate_json_keys)
        write_text(target, payload)
    elif suffix in BINARY_SUFFIXES:
        validate_binary_asset(source, suffix)
        os.makedirs(os.path.dirname(target), exist_ok=True)
        shutil.copy2(source, target)
    else:
        raise ValueError(f'unsupported public file type: {source}')


def copy_public_path(source, target):
    if os.path.islink(source):
        raise ValueError(f'public source must not be a symbolic link: {source}')
    if os.path.isdir(source):
        for directory, names, files in os.walk(source):
            names.sort()
            for name in names:
                if os.path.islink(os.path.join(directory, name)):
                    raise ValueError(f'public source must not be a symbolic link: {os.path.join(directory, name)}')
            relative = os.path.relpath(directory, source)
            destination = target if relative == '.' else os.path.join(target, relative)
            os.makedirs(destination, exist_ok=True)
            for name in sorted(files):
                copy_public_file(os.path.join(directory, name), os.path.join(destination, name))
    else:
        copy_public_file(source, target)


def read(name):
    return open(os.path.join(CONTENT, name + '.html'), encoding='utf-8').read()


def apply_unit_metadata(source):
    def annotate(match):
        opening, unit_id, body, closing = match.groups()
        unit = UNIT_BY_ID.get(unit_id)
        if unit is None:
            raise ValueError(f'HTML references unknown data-unit-id: {unit_id}')
        opening = re.sub(
            r'\sdata-(?:content-status|verification-state|collection-keys|task-key|placement-collections)=(?:"[^"]*"|\'[^\']*\')',
            '',
            opening,
        )
        metadata = (
            f' data-content-status="{html.escape(unit["contentStatus"], quote=True)}"'
            f' data-verification-state="{html.escape(unit["verificationState"], quote=True)}"'
        )
        if unit['kind'] == 'prompt-card':
            collection_label = '、'.join(COLLECTION_TITLE[key] for key in unit['collectionKeys'])
            task_label = TASK_TITLE[unit['taskKey']]
            metadata += (
                f' data-collection-keys="{html.escape(" ".join(unit["collectionKeys"]), quote=True)}"'
                f' data-task-key="{html.escape(unit["taskKey"], quote=True)}"'
            )
            metadata += (
                ' data-placement-collections="'
                + html.escape(' '.join(unit['placementCollectionKeys']), quote=True)
                + '"'
            )
            body, badge_count = re.subn(
                r'<span class="badge [^"]+">[^<]+</span>',
                f'<span class="badge {unit["contentStatus"]}">{STATUS_LABEL[unit["contentStatus"]]}</span>',
                body,
                count=1,
            )
            if badge_count != 1:
                raise ValueError(f'{unit_id}: prompt card must contain exactly one heading status badge')
            body, taxonomy_count = re.subn(
                r'(<dt>\s*行业\s*/\s*任务分类\s*</dt>\s*<dd>).*?(</dd>)',
                rf'\g<1>{html.escape(collection_label)}｜{html.escape(task_label)}\g<2>',
                body,
                count=1,
                flags=re.S,
            )
            if taxonomy_count != 1:
                raise ValueError(f'{unit_id}: prompt card taxonomy field is missing')
        if unit['contentStatus'] == 'retired':
            retirement = RETIREMENT_BY_ID.get(unit_id)
            if retirement is None:
                raise ValueError(f'{unit_id}: retired unit is missing its retirement tombstone')
            if unit['kind'] != 'prompt-card':
                body, heading_count = re.subn(
                    r'</h2>',
                    f' <span class="badge retired">{STATUS_LABEL["retired"]}</span></h2>',
                    body,
                    count=1,
                )
                if heading_count != 1:
                    raise ValueError(f'{unit_id}: retired unit heading is missing')
            heading = re.match(r'(.*?</h2>)', body, flags=re.S)
            if heading is None:
                raise ValueError(f'{unit_id}: retired unit heading is missing')
            replacement = retirement['replacementPath']
            if replacement:
                page, anchor = replacement.split('#', 1)
                target = page.removesuffix('.html')
                replacement_html = (
                    f'<a href="{{{{link:{target}#{anchor}}}}}">转到替代内容</a>'
                )
            else:
                replacement_html = '当前没有替代内容'
            notice = (
                '<aside class="callout note retirement-notice" data-label="本单元已退役">'
                f'<p>{html.escape(retirement["reason"])} {replacement_html}。</p>'
                '</aside>'
            )
            body = heading.group(1) + notice
        opening = opening.replace(f'data-unit-id="{unit_id}"', f'data-unit-id="{unit_id}"{metadata}')
        return opening + body + closing

    return re.sub(
        r'(<section\b[^>]*\bdata-unit-id="([^"]+)"[^>]*>)(.*?)(</section>)',
        annotate,
        source,
        flags=re.S,
    )


def apply_prompt_overview(source):
    for unit in (item for item in MODULES_CFG['units'] if item['kind'] == 'prompt-card'):
        unit_id = unit['id']
        pattern = re.compile(
            rf'(<tr><td>{re.escape(unit_id)}</td><td><a href="#{re.escape(unit["sourceAnchor"])}">)'
            r'(.*?)(</a></td><td>)(.*?)(</td><td><span class="badge )[^\"]+(\">)'
            r'(.*?)(</span></td></tr>)',
            flags=re.S,
        )

        def replace_row(match):
            return (
                match.group(1)
                + html.escape(unit['title'])
                + match.group(3)
                + html.escape(TASK_TITLE[unit['taskKey']])
                + match.group(5)
                + unit['contentStatus']
                + match.group(6)
                + STATUS_LABEL[unit['contentStatus']]
                + match.group(8)
            )

        source, count = pattern.subn(replace_row, source, count=1)
        if count != 1:
            raise ValueError(f'{unit_id}: prompt overview row is missing')
    return source


def apply_page_metadata(page_id, source):
    source = apply_unit_metadata(source)
    if page_id in CH:
        status = CH[page_id]['status']
        source, count = re.subn(
            r'(<p class="kicker">第 \d+ 章 )<span class="badge [^"]+">[^<]+</span>',
            rf'\g<1><span class="badge {status}">{STATUS_LABEL[status]}</span>',
            source,
            count=1,
        )
        if count != 1:
            raise ValueError(f'{page_id}: chapter status badge is missing')
    elif page_id == 'prompts':
        source = apply_prompt_overview(source)
    return source

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
    visible_statuses = sorted({chapter['status'] for chapter in CH.values()}, key=PIPELINE_INDEX.__getitem__)
    legend = ''.join(
        f'<li><span class="dot {status}"></span>{STATUS_LABEL[status]}</li>'
        for status in visible_statuses
    )
    out.append(f'    <div class="side-foot"><ul class="legend">{legend}</ul></div>')
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
    body = apply_page_metadata(pid, read(pid))
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

def home_body(mode, offline=False):
    L = lambda t, a=None: resolve_links('{{link:%s%s}}' % (t, '#' + a if a else ''), mode, 'home')
    seeded = sum(1 for c in CH.values() if c['status'] != 'outline')
    reviewed = sum(1 for c in CH.values() if c['status'] in FORMALLY_REVIEWED)
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
        <li><a href="registry/modules-v1.json" download>内容单元目录（JSON）</a> / <a href="schemas/modules-v1.schema.json">Schema</a><span class="muted">65 个课程模块与现有提示词卡的状态登记</span></li>
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
    if MODULES_CFG['status'] == 'draft-seed-unverified':
        progress_label = f'{seeded} / {len(CH)} 章已有草稿种子'
        notice = ('全部 11 章均已有可读的「<strong>草稿种子</strong>」，但这些种子<strong>不算完成课程</strong>：'
                  '内容依据 2026 年 9 月 1 日查阅的官方文档撰写，<strong>尚未逐条复核或实测</strong>。')
    elif MODULES_CFG['status'] == 'stable':
        progress_label = f'{seeded} / {len(CH)} 章已有正式正文'
        notice = '本版本已通过稳定版发布门槛；仍请结合每个单元标注的平台、复核日期与限制条件阅读。'
    else:
        progress_label = f'{seeded} / {len(CH)} 章已有正文'
        notice = ('课程正在按内容单元逐条完成来源复核、编辑审校和平台验证；'
                  '不同章节可能处于不同阶段，请以页面徽章和登记表为准。')
    legend_html = ''.join(
        f'<li>{badge(status)} 当前有章节处于此阶段</li>'
        for status in sorted({chapter['status'] for chapter in CH.values()}, key=PIPELINE_INDEX.__getitem__)
    )
    return f'''  <header class="hero">
    <div class="hero-in">
      <p class="eyebrow">零基础 · 在线 / 离线阅读 · Windows / macOS</p>
      <h1>{SITE_TITLE}</h1>
      <p class="lede">写给第一次接触 AI 与 Codex 的读者：不需要编程、命令行或 Git 基础。在线阅读，或下载离线版——解压后双击打开即可，无需联网、无需账号。</p>
      <div class="hero-actions">
        <a class="btn" href="{L('ch01')}">从第 1 章开始</a>
        {('<span class="btn ghost" aria-disabled="true">当前已是离线版</span>' if offline else '<a class="btn ghost" href="downloads/' + ZIP_NAME + '" download>下载离线版（ZIP）</a>') if mode == 'multi' else ''}
        <p class="progress">{progress_label}；正式审校 {reviewed} / {len(CH)} 章</p>
      </div>
    </div>
  </header>
  <main id="content">
    <aside class="callout note" data-label="阅读须知">
      <p>{notice} 软件界面更新很快，若你看到的按钮名称与教程不同，以屏幕上实际显示为准，并欢迎反馈。</p>
      <ul class="legend">
        {legend_html}
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
      <p>本教程为纯静态 HTML：无 JavaScript、无远程资源、无跟踪。在线版与离线版的课程正文和示例一致；离线版解压后双击 <code>index.html</code> 即可阅读。版本 {cfg['site']['version']}（{cfg['site']['date']}），更新记录见<a href="{L('ch11', 's3')}">第 11 章</a>。</p>
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

def collect_file_records(root):
    records = []
    for directory, names, files in os.walk(root):
        names.sort()
        for name in sorted(files):
            if name in ('manifest.json', 'SHA256SUMS.txt'):
                continue
            path = os.path.join(directory, name)
            relative = os.path.relpath(path, root).replace(os.sep, '/')
            payload = open(path, 'rb').read()
            records.append({'path': relative, 'size': len(payload), 'sha256': hashlib.sha256(payload).hexdigest()})
    return records


def write_manifest_and_sums(root, artifact):
    records = collect_file_records(root)
    manifest = {
        'schemaVersion': '1.0.0',
        'artifact': artifact,
        'version': cfg['site']['version'],
        'status': MODULES_CFG['status'],
        'generatedDate': cfg['site']['date'],
        'entry': 'index.html',
        'files': records,
    }
    write_json(os.path.join(root, 'manifest.json'), manifest)
    write_text(os.path.join(root, 'SHA256SUMS.txt'), ''.join(
        f"{record['sha256']}  {record['path']}\n" for record in records
    ))
    return records


def build_offline_stage(stage_root):
    package_root = os.path.join(stage_root, 'codex-tutorial-cn')
    os.makedirs(package_root)
    offline_roots = sorted(set(GENERATED) - {
        '404.html', 'deploy', 'downloads', 'README.md', 'robots.txt', 'index.html', 'manifest.json', 'SHA256SUMS.txt',
    })
    for name in offline_roots:
        if not os.path.exists(os.path.join(SITE, name)):
            continue
        copy_public_path(os.path.join(SITE, name), os.path.join(package_root, name))
    write_text(os.path.join(package_root, 'index.html'),
               page_shell(SITE_TITLE, 'home', home_body('multi', offline=True)))
    write_manifest_and_sums(package_root, 'codex-tutorial-cn-offline')
    return package_root


def build_offline_zip(package_root, zip_path):
    year, month, day = (int(value) for value in cfg['site']['date'].split('-'))
    zip_time = (year, month, day, 0, 0, 0)
    # ZIP_STORED avoids platform/zlib-specific DEFLATE bytes. The course is small,
    # so byte-for-byte reproducibility matters more than compression ratio.
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_STORED) as package:
        entries = []
        for directory, names, files in os.walk(package_root):
            names.sort()
            for name in sorted(files):
                entries.append(os.path.join(directory, name))
        for path in sorted(entries, key=lambda item: os.path.relpath(item, os.path.dirname(package_root)).replace(os.sep, '/')):
            archive_name = os.path.relpath(path, os.path.dirname(package_root)).replace(os.sep, '/')
            info = zipfile.ZipInfo(archive_name, date_time=zip_time)
            info.compress_type = zipfile.ZIP_STORED
            info.create_system = 3
            info.external_attr = 0o644 << 16
            with open(path, 'rb') as handle:
                package.writestr(info, handle.read())


def aggregate_content_status(units):
    if not units:
        raise ValueError('cannot aggregate an empty content unit set')
    try:
        return min((unit['contentStatus'] for unit in units), key=PIPELINE_INDEX.__getitem__)
    except KeyError as error:
        raise ValueError(f'unknown content status: {error.args[0]}') from None


def validate_source_inputs():
    if MODULES_CFG['contentVersion'] != cfg['site']['version']:
        raise ValueError('modules-v1 contentVersion must match chapters.json site.version')
    if MODULES_CFG['generatedDate'] != cfg['site']['date']:
        raise ValueError('modules-v1 generatedDate must match chapters.json site.date')
    if datetime.date.fromisoformat(MODULES_CFG['generatedDate']) > datetime.date.today():
        raise ValueError('modules-v1 generatedDate must not be in the future')
    if MODULES_CFG['status'] not in ARTIFACT_STATUSES:
        raise ValueError(f'unsupported module catalog status: {MODULES_CFG["status"]}')
    if len(UNIT_BY_ID) != len(MODULES_CFG['units']):
        raise ValueError('modules-v1 contains duplicate unit IDs')

    for chapter_id, chapter in CH.items():
        chapter_units = [unit for unit in MODULES_CFG['units'] if unit['chapterId'] == chapter_id]
        aggregate = aggregate_content_status(chapter_units)
        if chapter['status'] != aggregate:
            raise ValueError(
                f'{chapter_id} status must equal the least-advanced registered unit status '
                f'({chapter["status"]} != {aggregate})'
            )
    prompt_units = [unit for unit in MODULES_CFG['units'] if unit['kind'] == 'prompt-card']
    for unit in prompt_units:
        if len(unit['collectionKeys']) != 1:
            raise ValueError(f'{unit["id"]}: prompt card must have exactly one home collection')
        home_collection = unit['collectionKeys'][0]
        if not unit['id'].startswith(f'PRM-{COLLECTION_PREFIX[home_collection]}-'):
            raise ValueError(f'{unit["id"]}: prompt ID prefix differs from its home collection')
        expected_placements = (
            SHARED_PROMPT_PLACEMENTS if unit['id'] == SHARED_PROMPT_ID else unit['collectionKeys']
        )
        if unit['placementCollectionKeys'] != expected_placements:
            raise ValueError(f'{unit["id"]}: prompt placement collections differ from the locked plan')
    prompt_status = aggregate_content_status(prompt_units)
    if EXTRAS['prompts']['status'] != prompt_status:
        raise ValueError(
            'prompts entry status must equal the least-advanced registered prompt status '
            f'({EXTRAS["prompts"]["status"]} != {prompt_status})'
        )
    if MODULES_CFG['status'] in {'acceptance-ready', 'stable'}:
        active_states = {'acceptance-ready', 'stable'}
        for chapter_id, required_count in LOCKED_LESSON_COUNTS.items():
            active_count = sum(
                1
                for unit in MODULES_CFG['units']
                if unit['kind'] == 'lesson-module'
                and unit['chapterId'] == chapter_id
                and unit['contentStatus'] in active_states
            )
            if active_count < required_count:
                raise ValueError(
                    f'{chapter_id} active lesson coverage is below the locked minimum '
                    f'({active_count} < {required_count})'
                )
        active_prompts = [unit for unit in prompt_units if unit['contentStatus'] in active_states]
        if len(active_prompts) != 26:
            raise ValueError(f'active unique prompt coverage differs from the locked total ({len(active_prompts)} != 26)')
        placement_count = sum(len(unit['placementCollectionKeys']) for unit in active_prompts)
        if placement_count != 30:
            raise ValueError(
                f'active prompt placement coverage differs from the locked total ({placement_count} != 30)'
            )
        for collection_key, required_count in LOCKED_ACTIVE_PROMPT_COUNTS.items():
            active_count = sum(1 for unit in active_prompts if collection_key in unit['collectionKeys'])
            required_placements = required_count + (0 if collection_key == 'prompt-common' else 1)
            active_placements = sum(
                1 for unit in active_prompts if collection_key in unit['placementCollectionKeys']
            )
            if active_count != required_count or active_placements != required_placements:
                raise ValueError(
                    f'{collection_key} active prompt coverage differs from the locked plan '
                    f'(unique {active_count} != {required_count} or placements '
                    f'{active_placements} != {required_placements})'
                )

    framework = load_json(os.path.join(MAINT, 'framework-v1.json'))
    if framework['releaseGate'].get('requiredBeforeStable') != LOCKED_STABLE_GATES:
        raise ValueError('releaseGate.requiredBeforeStable differs from the locked policy')
    expected_decisions = {
        'draft-seed-unverified': 'course-beta-in-development',
        'review-in-progress': 'course-beta-in-development',
        'acceptance-ready': 'course-acceptance-pending',
        'stable': 'course-stable-approved',
        'retired': 'course-retired',
    }
    decision = framework['releaseGate']['currentDecision']
    expected_decision = expected_decisions[MODULES_CFG['status']]
    if decision != expected_decision:
        raise ValueError(
            'releaseGate.currentDecision must be explicitly advanced with the catalog status '
            f'({decision} != {expected_decision})'
        )
    if MODULES_CFG['status'] == 'stable':
        seed = framework['currentSeedContent']
        if (
            not seed.get('final')
            or not seed.get('countsAsCompletedCourseContent')
            or seed.get('designation') != 'formal-course'
            or seed.get('reviewPolicy') != 'accepted-item-by-item'
        ):
            raise ValueError('stable release requires currentSeedContent to be marked final course content')
    return framework


def build_site():
    reg = validate_source_inputs()
    for name in GENERATED:
        p = os.path.join(SITE, name)
        if os.path.isdir(p): shutil.rmtree(p)
        elif os.path.exists(p): os.remove(p)
    os.makedirs(os.path.join(SITE, 'assets'))
    write_text(os.path.join(SITE, 'assets', 'style.css'), css)
    write_text(os.path.join(SITE, 'assets', 'favicon.svg'), FAVICON)
    write_text(os.path.join(SITE, 'index.html'), page_shell(SITE_TITLE, 'home', home_body('multi')))
    write_text(os.path.join(SITE, '404.html'), page_shell(f'找不到页面｜{SITE_TITLE}', 'home', NOT_FOUND, css_href='/assets/style.css'))
    write_text(os.path.join(SITE, 'robots.txt'), 'User-agent: *\nAllow: /\nDisallow: /templates/\nDisallow: /specs/\nDisallow: /schemas/\nDisallow: /registry/\nDisallow: /src/\nDisallow: /deploy/\n')
    copy_public_path(os.path.join(ROOT, 'deploy'), os.path.join(SITE, 'deploy'))
    for cid in ORDER:
        c = CH[cid]
        write_text(os.path.join(SITE, cid + '.html'),
                   page_shell(f'第 {c["num"]} 章 {c["title"]}｜{SITE_TITLE}', '', doc_page(cid, 'multi')))
    for eid, e in EXTRAS.items():
        write_text(os.path.join(SITE, eid + '.html'),
                   page_shell(f'{e["title"]}｜{SITE_TITLE}', '', doc_page(eid, 'multi')))
    # 维护者文件：从原仓库原样复制
    for name in ['maintenance-release.html', 'notion-workflow.html', 'source-research.html', 'templates', 'specs', 'schemas']:
        src = os.path.join(MAINT, name)
        dst = os.path.join(SITE, name)
        copy_public_path(src, dst)
    # 登记表
    os.makedirs(os.path.join(SITE, 'registry'))
    reg['frameworkDefinitionStatus'] = reg['status']
    reg['catalogStatus'] = MODULES_CFG['status']
    reg['contentVersion'] = cfg['site']['version']
    reg['artifactVersion'] = cfg['site']['version']
    # Keep the legacy cross-registry `status` projection for compatibility while
    # preserving the framework definition's own lifecycle in a separate field.
    reg['status'] = MODULES_CFG['status']
    reg['chapters'] = [{'number': CH[c]['num'], 'title': CH[c]['title'], 'status': CH[c]['status'], 'file': c + '.html'} for c in ORDER]
    reg['productNote'] = ('2026-07-09 起 Codex 桌面应用并入 ChatGPT 桌面应用（macOS/Windows），'
                          '教程中的“Codex”指从 ChatGPT 产品下拉菜单或当前版本提供的产品入口选择的 Codex。')
    reg['generatedDate'] = cfg['site']['date']
    write_json(os.path.join(SITE, 'registry', 'framework-v1.json'), reg)
    copy_public_file(os.path.join(ROOT, 'modules-v1.json'), os.path.join(SITE, 'registry', 'modules-v1.json'))
    # README
    write_text(os.path.join(SITE, 'README.md'), readme())
    # 在线站点 manifest + SHA256SUMS；downloads 单独校验，避免自包含。
    online_records = []
    online_roots = sorted(set(GENERATED) - {'manifest.json', 'SHA256SUMS.txt', 'downloads'})
    for generated_name in online_roots:
        generated_path = os.path.join(SITE, generated_name)
        if os.path.isfile(generated_path):
            payload = open(generated_path, 'rb').read()
            online_records.append({
                'path': generated_name.replace(os.sep, '/'),
                'size': len(payload),
                'sha256': hashlib.sha256(payload).hexdigest(),
            })
        elif os.path.isdir(generated_path):
            for directory, names, files in os.walk(generated_path):
                names.sort()
                for name in sorted(files):
                    path = os.path.join(directory, name)
                    relative = os.path.relpath(path, SITE).replace(os.sep, '/')
                    payload = open(path, 'rb').read()
                    online_records.append({
                        'path': relative,
                        'size': len(payload),
                        'sha256': hashlib.sha256(payload).hexdigest(),
                    })
    online_records.sort(key=lambda record: record['path'])
    online_manifest = {
        'schemaVersion': '1.0.0', 'artifact': 'codex-tutorial-cn-online',
        'version': cfg['site']['version'], 'status': MODULES_CFG['status'],
        'generatedDate': cfg['site']['date'], 'entry': 'index.html', 'files': online_records,
    }
    write_json(os.path.join(SITE, 'manifest.json'), online_manifest)
    write_text(os.path.join(SITE, 'SHA256SUMS.txt'), ''.join(
        f"{record['sha256']}  {record['path']}\n" for record in online_records
    ))

    downloads = os.path.join(SITE, 'downloads')
    os.makedirs(downloads)
    zip_path = os.path.join(downloads, ZIP_NAME)
    with tempfile.TemporaryDirectory(prefix='codex-tutorial-offline-') as stage_root:
        package_root = build_offline_stage(stage_root)
        build_offline_zip(package_root, zip_path)
    zip_digest = hashlib.sha256(open(zip_path, 'rb').read()).hexdigest()
    write_text(zip_path + '.sha256', f'{zip_digest}  {os.path.basename(zip_path)}')

def readme():
    rows = '\n'.join(f"| {CH[c]['num']:02d} | [{CH[c]['title']}]({c}.html) | {STATUS_LABEL[CH[c]['status']]} |" for c in ORDER)
    if MODULES_CFG['status'] == 'draft-seed-unverified':
        release_note = '11 章均有「草稿种子」，但不算完成课程；内容依据官方文档撰写，尚未逐条复核或实测。'
    elif MODULES_CFG['status'] == 'stable':
        release_note = '本版本已通过稳定版发布门槛；具体平台与复核限制以内容单元目录为准。'
    else:
        release_note = '课程正在按内容单元逐条复核、审校与验证；各章进度见下表。'
    return f'''# {SITE_TITLE}

写给第一次接触 AI 与 Codex 的中文读者的离线教程。不需要编程、命令行或 Git 基础。

**怎么读：** 离线 HTML 是主要交付：下载首页的「离线版 ZIP」（也可以 Code → Download ZIP），解压后双击 `index.html`。全站纯 HTML + CSS，无 JavaScript、无远程资源，不联网也能看。

**可选在线预览：** 如需把同一批生成页面放到服务器，再看 [deploy/DEPLOY.md](deploy/DEPLOY.md)。在线部署不是课程完成或正式发布的必要条件。

**当前版本：** {cfg['site']['version']}（{cfg['site']['date']}）。{release_note}

> 2026 年 7 月 9 日起，Codex 桌面应用已并入「ChatGPT 桌面应用」（macOS / Windows）。本教程所说的 Codex，指从 ChatGPT 产品下拉菜单或当前版本提供的产品入口选择的 **Codex**。

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
- [`registry/modules-v1.json`](registry/modules-v1.json) / [`schemas/modules-v1.schema.json`](schemas/modules-v1.schema.json) —— 71 个当前内容单元的双状态目录与校验规则
- `manifest.json`、`SHA256SUMS.txt` —— 文件清单与校验和

## 维护约定

**改内容的正确姿势：** 编辑 `src/content/` 里对应章节的 HTML 片段（章节标题、状态在 `src/chapters.json`）。首次维护先运行 `python -m pip install -r requirements-dev.txt`；然后运行 `python src/build.py` 重新生成页面、README、清单和离线 ZIP，再运行 `python src/check.py --strict --verify-generated`。构建器本身只使用 Python 标准库；固定的 `jsonschema` 仅用于维护者和 CI 的严格登记表检查。跨页链接写成 `{{{{link:ch04}}}}` 或 `{{{{link:prompts#prm-com-0001}}}}`，构建时自动换成正确地址。

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
    write_text(os.path.join(ROOT, 'preview.html'), html)  # 内部预览用，不属于站点

if __name__ == '__main__':
    build_site()
    build_preview()
    print('built site/ and preview.html')
