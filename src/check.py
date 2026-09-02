#!/usr/bin/env python3
"""站点质检（在仓库根目录运行：python3 src/check.py）。只需 Python 3；装了 jsonschema 会顺带校验登记表。

检查项：
1. 根目录每个 .html 的站内链接（.html 文件与 #锚点）都存在；
2. 无 <script>、无内联 style、无远程资源（<link>/<img>/<script> 指向 http(s)）——超链接 <a href="https://…"> 允许；
3. 每个正文页的「本章内容」导航与实际小节一一对应，id 不重复；
4. 章节页徽章与 src/chapters.json 的状态一致；
5. registry/framework-v1.json 符合 schemas/framework-v1.schema.json（需要 jsonschema）；
6. 构建产物是否与源文件一致：提示先运行 build.py，再看 git status。
退出码非 0 = 有问题。
"""
import json, re, sys, pathlib, html

ROOT = pathlib.Path(__file__).resolve().parent.parent
errs = []
cfg = json.loads((ROOT / 'src/chapters.json').read_text(encoding='utf-8'))
STATUS_ZH = {'draft': '草稿', 'outline': '大纲', 'reviewed': '已复核'}

pages = sorted(ROOT.glob('*.html'))
ids_cache = {}
def ids_of(p):
    if p not in ids_cache:
        ids_cache[p] = re.findall(r'\bid="([^"]+)"', p.read_text(encoding='utf-8'))
    return ids_cache[p]

link_total = 0
for p in pages:
    s = p.read_text(encoding='utf-8')
    rel = p.name
    # 2. 脚本 / 内联样式 / 远程资源
    if re.search(r'<script\b', s): errs.append(f'{rel}: 含 <script>')
    for m in re.finditer(r'<(link|img|script|iframe)\b[^>]*\b(?:href|src)="(https?:)?//', s):
        errs.append(f'{rel}: 远程资源 {m.group(0)[:60]}')
    for m in re.finditer(r'\sstyle="', s): errs.append(f'{rel}: 内联 style 属性'); break
    # 1. 站内链接
    for m in re.finditer(r'\bhref="([^"]+)"', s):
        href = html.unescape(m.group(1))
        if href.startswith(('http://', 'https://', 'mailto:', 'tel:')): continue
        link_total += 1
        path, _, frag = href.partition('#')
        if path == '': target = p
        elif path == '/': target = ROOT / 'index.html'
        elif path.startswith('/'): target = ROOT / path.lstrip('/')
        else: target = (p.parent / path)
        if target.is_dir(): target = target / 'index.html'
        if not target.exists(): errs.append(f'{rel}: 断链 {href}'); continue
        if frag and target.suffix == '.html' and frag not in ids_of(target): errs.append(f'{rel}: 锚点不存在 {href}')
    # 3. id 重复；section-nav 与小节
    ids = ids_of(p); dup = {i for i in ids if ids.count(i) > 1}
    if dup: errs.append(f'{rel}: id 重复 {sorted(dup)}')
    nav = re.search(r'<nav class="section-nav".*?</nav>', s, re.S)
    if nav:
        nav_targets = re.findall(r'href="#([^"]+)"', nav.group(0))
        sections = [i for i in re.findall(r'<section\b[^>]*\bid="([^"]+)"', s)]
        if nav_targets != sections:
            errs.append(f'{rel}: 「本章内容」导航 {nav_targets} 与实际小节 {sections} 不一致')
    # 4. 徽章
    m = re.match(r'ch(\d{2})\.html', rel)
    if m:
        cid = f'ch{m.group(1)}'; want = cfg['chapters'][cid]['status']
        b = re.search(r'<p class="kicker">第 \d+ 章 <span class="badge (\w+)">([^<]+)</span>', s)
        if not b: errs.append(f'{rel}: 缺少章头徽章')
        elif b.group(1) != want or b.group(2) != STATUS_ZH.get(want, want):
            errs.append(f'{rel}: 徽章 {b.group(1)}/{b.group(2)} 与 chapters.json 状态 {want} 不一致')

# 5. 登记表
try:
    import jsonschema
    jsonschema.validate(json.loads((ROOT / 'registry/framework-v1.json').read_text(encoding='utf-8')),
                        json.loads((ROOT / 'schemas/framework-v1.schema.json').read_text(encoding='utf-8')))
    schema_msg = 'registry 通过 schema 校验'
except ImportError:
    schema_msg = 'registry 未校验（未安装 jsonschema，可选）'
except Exception as e:
    errs.append(f'registry 不符合 schema：{getattr(e, "message", e)}'); schema_msg = ''

print(f'页面 {len(pages)} 个，站内链接 {link_total} 条；{schema_msg}')
if errs:
    print('\n'.join('✗ ' + e for e in errs)); sys.exit(1)
print('✓ 全部检查通过（提醒：修改 src/ 后先运行 python3 src/build.py，再用 git status 确认生成文件已同步）')
