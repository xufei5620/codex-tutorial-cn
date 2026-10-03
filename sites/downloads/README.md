# Learning Studio v5.6 的 COS 下载入口

两站的管理工具教程沿用 v5.6 学习空间布局，直接提供三组按系统和架构标注的安装包按钮：星芒 AI 管理工具、Codex 桌面端离线包、Claude Desktop 离线包。管理工具是主下载入口；另外两组仅在正常安装失败或网络异常时备用。按钮直接访问对应 COS 文件，不再打开飞书；Codex Windows 安装包与许可文件并列，Claude Windows 完整 MSIX 不需要单独许可文件。

- 按量站：`https://docs-new.solov.cc/guide/manager#download-installers`
- 订阅站：`https://docs-sub.solov.cc/guide/manager#download-installers`
- 原 `/guide/download` 兼容跳转到本站上述选择区。

## 更新来源

两站读取固定 COS 桶的 `xingmang/latest.json`、`chatgpt/latest.json` 和 `claude/latest.json`。索引由管理工具仓库的发布同步和官方包定时同步工作流生成；安装包来自不可变版本目录。用户下载文件直接访问 COS，教程站仅代理小 JSON。

浏览器读取同源 `/cos-download-index/xingmang.json`、`/cos-download-index/chatgpt.json` 与 `/cos-download-index/claude.json`。现有 Pages CI 使用 Node 有界读取这三份公开 COS 清单，执行相同的 schema 校验和公开字段投影，写入两站静态资源。`_routes.json` 的 include 与 exclude 都是这三条精确路径；exclude 优先，索引直接由静态 ASSETS 服务，不经过当前失败的 Worker 出网链路。`_headers` 对索引强制 JSON、no-store 和 nosniff。没有新源主机、上传密钥或用户请求头转发。

页面初始化只读取三份小清单，安装说明与摘要区不再触发请求。索引或安装包还未上传时，不会编造下载地址。页面显示准备状态，并提供重试和本站客服入口。提供哪个系统以实际清单为准，不根据文件名猜测；Codex Mac 完整 ZIP、星芒 DMG 与 Claude Mac Universal 包分别说明，不将 Universal 复制成两份架构包。显示名称使用 Codex 桌面端，内部仍保留 `chatgpt` 产品与官方文件名。

## 首次上线顺序

1. 先上传已经核验的安装包，再上传对应索引。核对匿名读取、文件大小、Content-Type 与完整摘要。Codex Windows MSIX 和离线许可必须同版本、同架构；Claude Windows 完整 MSIX 使用 `SkipLicense`，不混用 Codex 许可。
2. 完成本地 mock 测试、两站实际 VitePress 构建和 Pages Functions 编译。
3. 提交 PR，等待 Claude 审查后再合并。原生产 `sites` 工作流在 main 合并后部署两站；没有新服务器或 SSH 配置要求。保留既有 Cloudflare Secrets。
4. 上线后验收两站的选择区、各平台真实下载与旧路由跳转，再发布指向该入口的管理工具版本。

后续只更新 COS 索引即可更新下载选项，教程无需随每次发布修改文件 URL。关闭生产同步不会删除已发布对象。教程源码验证不代表已部署，下载通过也不等于用户安装成功。

## 静态镜像自动更新

`sites` 工作流保留 main 推送与手动触发，并每六小时刷新三份公开清单后使用已有 Pages 凭据部署两站。可以手动触发以立即反映刚完成的 COS 同步。读取仅限固定 HTTPS、10 秒、256 KiB，拒绝重定向；源失败或无效 schema 使本次 CI 失败，不发布替代空数据。

首次 404 的产品生成对应合法空清单，页面显示准备中。Actions 缓存仅记录曾读取到的公开规范清单，恢复时再次验证路径、大小和 schema；如果该产品已有有效安装包而源后来 404，则停止部署，保留现有站点。缓存不会作为新的 COS 数据源或绕过读取失败。镜像生成文件和缓存均不进入 Git，缓存不含任何凭据。

## 索引读取诊断

保留的 Function 诊断源码中，502 响应仍使用固定中文错误，另外提供固定枚举 `stage`、`code` 和可选数字 `upstreamStatus`。这些 Function 已从三条索引路径排除，当前静态镜像不会产生这些诊断头。对应响应头是 `X-Xingmang-Index-Stage`、`X-Xingmang-Index-Code`、`X-Xingmang-Upstream-Status`；HEAD 仅返回头。

阶段包括 `init`（尚未发起 fetch）、`transport`（fetch 调用失败）、`response`（响应元数据或重定向）、`status`（非预期 HTTP 状态）、`body`（类型、大小、流或 JSON）、`schema`（产品清单校验）和 `internal`。诊断不会返回原始异常、上游 URL、查询参数、请求头、Cookie 或令牌。只有收到合法 HTTP 状态时才提供 100–599 的数字。

入站 `Request.signal` 和自建取消控制器保持原实现。浏览器请求保留 `credentials: omit`；Worker 上游请求仅使用固定 URL 和构造的 Accept/no-cache 头，不携带浏览器专用 credentials 字段，不转发入站 Cookie/Authorization。这一单字段对照用于定位 transport 失败，不代表已经确认某个 Worker API 不兼容。仓库和部署工作流没有设置运行时兼容日期，实际值仍可能来自 Pages dashboard。

## 验证

在 `sites` 目录执行：

```sh
npm ci
node --test tools/tests/*.test.mjs studio/tests/*.test.mjs downloads/*.test.mjs
node downloads/mirror.mjs
npm run build
node tools/check-routes.mjs
npx wrangler pages functions build --outdir /path/to/private-local-preview
```

Functions 编译命令只生成本地产物，不部署。公开部署仍按现有 main 工作流和人工审查执行。
