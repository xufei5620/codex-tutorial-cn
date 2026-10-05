# 双站教程整合 v4.4.1

## 状态与边界

这是现有 VitePress 项目的源码整合，不是另一份简化审阅网页。正式预览应来自 `npm run build` 生成的两套 `.vitepress/dist`。源码合并、单元测试和 QR 校验，不能代替完整编译、浏览器验收或实际模型调用。

本轮在 `docs/dual-site-build-v4-4-1-20260908` 工作分支修改，不直接合并 main、不执行生产发布。**合并到 main 后可能触发原有 Cloudflare 发布流程，须先完成预览审查。**

## 内容源

- `shared/pages/`：共用接入教程、实践课、管理工具说明和排错。
- `sub2api/guide/start.md`、`newapi/guide/start.md`：各站账户与计费准备；价格、FAQ、错误码仍保留各站原文。
- 各站 `site.json`：域名、业务入口、独立 Codex 基址、客服、下载元数据。
- 各站 `overrides/`：相同相对路径覆盖共用文章，构建时同样替换变量。
- 原课程仍来自仓库 `src/chapters.json` 和 `src/content/*.html`。不覆盖原稿，不自动升级审校状态。当前原稿版本以该清单为准，不将未取得的其他版本冒充已合入。
- `tools/course-bridge.mjs`：生成 `/learn/codex/` 和原章节，记录每篇来源哈希。缺少课程源文件时失败，不生成占位课程。

## 首页与文章对应

`homepage-routes.json` 保存已交付 v4.4 首页的 20 个教程入口及两站来源。构建检查确认文章路径存在；它不自动改写用户已经粘贴的首页，也不代表域名已发布。

现有首页视觉无需改版。首页通过各站自己的教程域名进入相应文章；需要留在后台子菜单时使用各自真实菜单入口，不构造未存在的路由，也不将 Sub2API 菜单实现直接套用到 NewAPI。

## 客服二维码

各站 `contact.wecom_url` 填写实际客服链接，`qr_mode: auto` 时预构建生成 `/img/contact/wecom-auto.svg`。原有上传图片保留，不被自动二维码覆盖。桌面侧栏、起始页和手机展开卡使用同一站点配置。

本地编码，无第三方二维码请求；代码保留 4 格留白。扫码后的微信会话与链接有效期需要人工验证，二维码解码通过不等于客服已接通。

## 下载信息与编辑

`downloads.windows`、`downloads.macos-arm64`、`downloads.macos-x64` 可填写 HTTPS 网址、版本、日期、架构、SHA-256、更新说明和显示开关。留空显示未公开下载，不制造安装包；填链接不等于上传安装包。两站独立保存，不自动共享实际适配范围。

CMS 只编辑内容源与配置，不编辑生成物。共用 Markdown 支持图文修改；原 11 章 HTML 使用 raw/code 编辑，其目录和状态仍在 `src/chapters.json`。这不是任意拖拽布局编辑器。CMS 实际登录、保存、权限和发布需要人工验收。

预览工作流设置 `DOCS_CMS_BRANCH`，生成的后台配置指向预览分支；源 CMS 默认仍为 main。预览中打开 CMS 前核对配置分支，不误写正式分支。

## 本地构建

在原仓库的工作分支执行：

```sh
cd sites
node --test tools/tests/*.test.mjs
node tools/prebuild.mjs sub2api
node tools/prebuild.mjs newapi
node tools/check-routes.mjs
npm ci
npm run build
```

使用原项目的 VitePress preview 命令分别预览两套 dist，访问终端实际输出的本地地址。不要把 dist HTML 用 file:// 打开后出现的资源问题当作正式部署表现。

生成器不删除人工源文件。长期工作区出现旧生成页时，优先使用新的工作副本检查，不执行不清楚范围的删除命令。

## 本轮实际检查

- Node 22 本地执行了 18 项单元测试并通过；课程测试使用明确标注的 11 章结构样本，不冒充真实正文构建。
- QR 矩阵与独立 Python qrcode 实现对比了 12 个输入，通过；两个实际配置的企业微信链接编码后均解码一致。
- 课程桥接器的本地文件 Git blob SHA 与上传对象一致。
- 本地访问 npm 源失败（域名解析失败），没有完成 VitePress 编译。
- 早期预览任务 34217717324 的 job 102033322091 返回 completed/failure、runner_id=0、steps=[]；尚不能归因于源码或断言账户问题，后续以最新 Actions 注释为准。

## 发布前仍需验证

完整 VitePress 编译；原课程在实际主题中的目录、链接和代码块；两站真实页面与手机内嵌阅读；下载网址和实际安装包；对应客户端的基址与协议；截图敏感信息；微信客服会话；正式 CMS 保存与审批流程。

教程 iframe 不需要登录令牌。宿主不得把登录 token、API Key 等放进文档 URL。文档仅使用嵌入状态调整布局，不消费这些凭据。Referrer-Policy 不能消除初始请求中已经携带的敏感参数，必须在宿主侧避免发送。

不要在 PR、日志、截图或对话中提交真实 API Key、GitHub Token、Cloudflare 密钥或密码。
