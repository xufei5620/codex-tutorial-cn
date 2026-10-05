# 星芒AI 教程站点（sites/）

这里是两个 VitePress 教程站的全部源码：

| 站点 | 目录 | 域名 | 对应业务 |
|---|---|---|---|
| 订阅站 | `sub2api/` | docs-sub.solov.cc | api.solov.cc |
| 按量站 | `newapi/` | docs-new.solov.cc | xm.solov.cc |

push 到 main 后，`.github/workflows/sites.yml` 自动构建两站并发布到 Cloudflare Pages。PR 上由 `.github/workflows/sites-check.yml` 跑测试、构建，并把构建结果与 main 对比，差异写在 Actions 的运行摘要里。

## 目录

```
sites/
├── shared/
│   ├── pages/        两站共用的页面（Markdown），可用 %%占位符%%
│   ├── nav.json      两站共用的顶栏和侧栏
│   ├── img/          共用图片，发布为 /img/shared/...
│   └── admin/        网页后台（Sveltia CMS）配置，发布为 /admin/
├── sub2api/ newapi/  每站一份，结构相同：
│   ├── site.json     站名、业务地址、客服、下载入口
│   ├── pages/        只属于本站的页面（首页、FAQ、错误码、账户准备等），原样发布
│   ├── overrides/    （可选）同路径替换某个共用页面
│   ├── public/       本站静态文件（logo、客服二维码、本地截图）
│   └── .vitepress/   入口，只引用 theme/，一般不用改
├── theme/            两站共用的主题：组件、样式、站点配置
├── build/            生成脚本：把以上内容组装成 <站点>/.src/
├── studio/           课程内容（content/）、截图记录（screenshots/）与本地截图工具
├── downloads/        安装包下载索引（见 downloads/README.md）
├── functions/        Cloudflare Pages Functions（下载索引同源转发）
├── tools/            构建检查与对比工具
└── homepage-routes.json  首页已经发出去的教程链接，构建检查保证它们一直有效
```

`<站点>/.src/` 和 `.vitepress/dist/` 都是生成的，已在 `.gitignore` 里，不要手改。

## 常见改动

**改两站都有的教程**：编辑 `shared/pages/` 下的文件。可用的占位符有 `%%SITE_NAME%%`、`%%BASE_URL%%`、`%%CODEX_BASE_URL%%`、`%%OPENCLAW_BASE_URL%%`、`%%KEYS_URL%%`、`%%MODELS_URL%%`、`%%CONSOLE_URL%%`、`%%DOCS_URL%%`、`%%KEY_WORD%%`、`%%HOURS%%`、`%%DOWNLOAD_URL%%`，构建时按各站 `site.json` 替换。写错占位符名会直接报错。

**只改某一站**：

- 该站独有的页面在 `<站点>/pages/`，直接改。
- 某个共用页面要给一站换一版：把同路径文件放到 `<站点>/overrides/`。
- `pages/` 里的文件和共用页面重名时构建会报错，避免两份内容互相覆盖。

**加一篇新页面并放进导航**：

1. 文件放进 `shared/pages/`（两站都有）或 `<站点>/pages/`（一站有）。
2. 在 `shared/nav.json` 的侧栏里加 `{ "link": "/clients/xxx" }`。不写 `text` 时自动用页面标题；只在一站出现时加 `"sites": ["newapi"]`。

**改客服**：只改 `<站点>/site.json` 的 `contact`。两站必须各用各的：订阅站有企业微信和 Telegram，按量站只有企业微信。构建时会检查链接是 HTTPS、上传的二维码文件确实存在；`tools/tests/contact-guard.test.mjs` 和 `tools/check-contacts.mjs` 会拦住把客服写死在共用代码里、或一站出现另一站客服的情况。`qr_mode` 为 `auto` 时企业微信二维码由链接自动生成。

**图片**：共用页面里可以按文件位置写相对路径，例如在 `shared/pages/clients/codex.md` 里写 `![说明](../../img/clients/nodejs-download-win.png)`，VS Code 能直接预览，网站构建时自动换成 `/img/shared/...`。

**Codex 零基础课程**：目录在 `studio/content/yichen/catalog.json`，章节在 `studio/content/yichen/chapters/`，配图在 `shared/img/yichen/`。来源说明见 `studio/content/sources.json`。

**配套练习（提示词页）**：仍取自仓库根目录的 `src/content/prompts.html`，由 `build/prompts.mjs` 转换。

## 截图

共用和本站页面里每个编号步骤都会自动生成一个截图位，ID 由页面路径和步骤位置决定（如 `doc-guide-start-s01-step02`）。调整步骤顺序会改变 ID，已有截图会提示“找不到位置”，不会被删掉。

在本机补截图：

```sh
cd sites
npm ci
npm run build
npm run local:sub   # 订阅站，http://localhost:4183；按量站用 local:new（4184）
```

打开 `/screenshots`，或在任意页面地址后加 `?edit=1`。上传、替换、写说明后自动保存：图片存到 `<站点>/public/screenshots/`，记录存到 `studio/screenshots/<站点>.json`，旧记录备份在 `studio/screenshots/.local-backups/`。看到“已自动保存到本机”才算保存成功。之后把这两处文件提交即可发布。

从别人导出的截图备份导入：

```sh
node studio/import-screenshots.mjs --site sub2api --file 备份.json          # 先检查
node studio/import-screenshots.mjs --site sub2api --file 备份.json --apply  # 确认后写入
```

截图要人工确认已经遮住密钥、账号等敏感信息，工具不会自动处理。

## 本地预览和检查

```sh
cd sites
npm ci
npm run dev:sub        # 或 dev:new，边改边看
npm test               # 单元测试
npm run format         # 统一代码格式（CI 会用 format:check 检查）
npm run build          # 构建两站
node tools/check-routes.mjs    # 链接、首页入口都能打开
node tools/check-contacts.mjs  # 每站只含自己的客服
```

改了生成脚本或主题，想确认读者看到的内容没变：先在 main 上构建一次，把 `sub2api/.vitepress/dist` 复制到别处，再在自己的分支上构建，然后：

```sh
npm run compare -- 旧的dist目录 sub2api/.vitepress/dist
```

它会忽略文件名里的哈希，只列出页面文字、链接、公开文件的变化。PR 上 CI 会自动做这一步。

## 生成流程

`npm run build` 前会先运行 `node build/index.mjs <站点>`，它：

1. 读取并校验 `site.json`（只许指向本站域名、客服设置完整）。
2. 渲染共用页面（或本站 overrides）、复制本站页面、生成课程章节页和几个组件页。
3. 收集搜索文本和截图位，写出 `site.generated.json`、`nav.generated.json`、`studio.generated.json`。
4. 复制静态文件，生成企业微信二维码、`_headers`、`_routes.json`。

全部写到 `<站点>/.src/`，每次重新生成。脚本不联网、不部署。各部分在 `build/` 下按用途分文件：`site.mjs`（站点设置）、`nav.mjs`（导航）、`docs.mjs`（搜索与截图位）、`course.mjs`（课程）、`prompts.mjs`（提示词页）。

## 网页后台

`https://docs-sub.solov.cc/admin/`（Sveltia CMS），用 GitHub 账号登录，保存即提交到 main 并自动发布。可编辑的文件范围见 `shared/admin/config.yml`。

## 旧文档

`maintainers/archive/` 里是早期版本的整合说明，只作历史记录，其中的路径和流程已经过时。
