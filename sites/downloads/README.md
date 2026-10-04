# Learning Studio v5.6 的 COS 下载入口

两站的管理工具教程沿用 v5.6 学习空间布局，直接提供三组按系统和架构标注的安装包按钮：星芒 AI 管理工具、Codex 桌面端离线包、Claude Desktop 离线包。管理工具是主下载入口；另外两组仅在正常安装失败或网络异常时备用。按钮直接访问对应 COS 文件，不再打开飞书；Codex Windows 安装包与许可文件并列，Claude Windows 完整 MSIX 不需要单独许可文件。

下载区域仅提供 Windows 与 macOS，两类系统的图标、架构选项和安装说明对三个产品保持一致。历史源索引与缓存中的 Linux 条目仍按原 schema 校验，但公开清单和页面均过滤掉它们；COS 已有文件不删除，其它 Linux 教程不受影响。

管理工具为主下载区，两个桌面客户端归入备用安装包区域。系统按钮保持一排，点击后在正常文档流中展开选项，不覆盖后续内容；一次只展开一个系统面板，可再次点击收起，Escape 返回触发按钮。桌面端的双选项并排，窄屏纵向排列。

芯片选项使用 Intel / AMD、ARM、Apple 芯片、Intel 芯片等可识别名称。Claude Mac 按 DMG 拖拽安装、PKG 安装向导区分，明确两者均为通用包；版本、大小、配套许可及折叠的安装说明和摘要放在相应文件旁。工具接入与下载标题使用本地品牌素材，来源和许可见 `../studio/theme/assets/brands/README.md`。

- 按量站：`https://docs-new.solov.cc/guide/manager#download-installers`
- 订阅站：`https://docs-sub.solov.cc/guide/manager#download-installers`
- 原 `/guide/download` 兼容跳转到本站上述选择区。

## 更新来源

两站读取固定 COS 桶的 `xingmang/latest.json`、`chatgpt/latest.json` 和 `xingmang/offline/claude/latest.json`。Claude 安装包固定存放于 `xingmang/offline/claude/<platform-id>/sha256-<digest>/<fixed-fileName>`，复用已授权的 `xingmang/*` 存储范围；同源入口仍为 `/cos-download-index/claude.json`。索引由管理工具仓库的发布同步和官方包定时同步工作流生成；安装包来自不可变版本目录。用户下载文件直接访问 COS，教程站提供经过校验和公开投影的静态 JSON。

浏览器读取同源 `/cos-download-index/xingmang.json`、`/cos-download-index/chatgpt.json` 与 `/cos-download-index/claude.json`。现有 Pages CI 使用 Node 有界读取这三份公开 COS 清单，执行相同的 schema 校验和公开字段投影，写入两站静态资源。`_routes.json` 的 include 与 exclude 都是这三条精确路径；exclude 优先，索引直接由静态 ASSETS 服务，不经过当前失败的 Worker 出网链路。`_headers` 对索引强制 JSON、no-store 和 nosniff。没有新源主机、上传密钥或用户请求头转发。

页面初始化只读取三份小清单，安装说明与摘要区不再触发请求。索引或安装包还未上传时，不会编造下载地址。页面显示准备状态，并提供重试和本站客服入口。提供哪个系统以实际清单为准，不根据文件名猜测；Codex Mac 完整 ZIP、星芒 DMG 与 Claude Mac Universal 包分别说明，不将 Universal 复制成两份架构包。显示名称使用 Codex 桌面端，内部仍保留 `chatgpt` 产品与官方文件名。

## 首次上线顺序

1. 先上传已经核验的安装包，再上传对应索引。核对匿名读取、文件大小、Content-Type 与完整摘要。Codex Windows MSIX 和离线许可必须同版本、同架构；Claude Windows 完整 MSIX 使用 `SkipLicense`，不混用 Codex 许可。
2. 完成本地 mock 测试、两站实际 VitePress 构建和 Pages Functions 编译。
3. 提交 PR，完成检查后按用户授权合并。原生产 `sites` 工作流在 main 合并后部署两站；没有新服务器或 SSH 配置要求。保留既有 Cloudflare Secrets。
4. 上线后验收两站的选择区、各平台真实下载与旧路由跳转，再发布指向该入口的管理工具版本。

后续只更新 COS 索引即可更新下载选项，教程无需随每次发布修改文件 URL。关闭生产同步不会删除已发布对象。教程源码验证不代表已部署，下载通过也不等于用户安装成功。

## 静态镜像自动更新

`sites` 工作流保留 main 推送与手动触发，并每六小时刷新三份公开清单后使用已有 Pages 凭据部署两站。可以手动触发以立即反映刚完成的 COS 同步。读取仅限固定 HTTPS、10 秒、256 KiB，拒绝重定向；源失败或无效 schema 使本次 CI 失败，不发布替代空数据。

首次 404 的产品通常生成对应合法空清单，页面显示准备中。Codex 桌面端已有安装包完成上传、但总索引尚未发布时，使用 `chatgpt-verified-baseline.json` 中经过完整匿名下载与摘要核验的固定备用清单。没有已发布历史时，它仅在 `chatgpt/latest.json` 返回 404 时启用，有效上游清单优先；页面展示包的实际版本，不宣称最新版。403、超时、网络错误和无效 schema 仍使部署失败。星芒管理工具与 Claude 不使用该备用清单。

从已经发布的固定备用清单切换到第一份完整来源清单期间，自动同步可能先发布只有一个平台的新索引。仅当缓存的 Codex 公开清单与固定备用清单完全相同，且有效、非空的新来源仍缺少备用清单中的某个平台时，教程继续发布同一备用清单，保留已经可用的下载。比较前，旧缓存与固定备用清单均投影为 Windows x64/ARM64、macOS ARM64/x64 四项；新来源覆盖这四项后即可整体切换，不等待 Linux，也不混合新旧条目或不同 Windows 版本。有效空清单仍立即清空；没有缓存或缓存已切换为不同清单后，有效上游恢复直接优先，不将任意旧缓存作为兜底。

Actions 缓存仅记录曾读取到的公开规范清单，恢复时再次验证路径、大小和 schema；如果该产品已有有效安装包而源后来 404，则停止部署，保留现有站点。唯一例外是缓存中的 Codex 清单与固定备用清单的公开内容完全相同，此时允许继续发布同一清单。不同的已发布清单不会被旧备用清单覆盖，因此不会因上游暂时缺失而退回旧版本或丢失平台。镜像生成文件和缓存均不进入 Git，缓存不含任何凭据。

固定备用清单的 Windows 包为 `26.930.2377.0`：2026-10-04（北京时间）重新完整读取了 COS 的 x64、ARM64 MSIX 及各自许可，检查了 SHA-256、有效 Microsoft Marketplace 签名、`OpenAI.Codex` 身份与 `9PLM9XGG6VKS` 许可产品标识。清单只保存公开路径、大小、摘要与校验类型，不保存本机路径或凭据。更新固定清单必须重新核对相应文件，不能从目录名猜测缺失平台。

同日完整匿名读取的另外五包为 macOS ARM64/x64 ZIP、Linux ARM64/x64 DEB 与 x64 RPM，正文 SHA-256 和大小均与先前从官方 `persistent.oaistatic.com` HTTPS 下载的原包记录一致。Mac appcast 对应 `26.930.21537`、build `12776`；Linux 原包元数据版本也是 `26.930.21537`。这些历史核验记录保留在固定 JSON 中，当前只投影其中的 Windows/macOS 四个下载条目。这里没有声称 Mac/Linux 原生签名验证或安装验收已完成。

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
