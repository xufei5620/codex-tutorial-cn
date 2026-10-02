# Learning Studio v5.6 的 COS 下载入口

两站的管理工具教程沿用 v5.6 学习空间布局。金色「下载安装包」按钮展开系统选择区，不再打开飞书，也不默认下载第一个 Windows 包。

- 按量站：`https://docs-new.solov.cc/guide/manager#download-installers`
- 订阅站：`https://docs-sub.solov.cc/guide/manager#download-installers`
- 原 `/guide/download` 兼容跳转到本站上述选择区。

## 更新来源

两站读取固定 COS 桶的 `xingmang/latest.json` 和 `chatgpt/latest.json`。索引由管理工具仓库的发布同步和官方包定时同步工作流生成；安装包来自不可变版本目录。用户下载文件直接访问 COS，教程站仅代理小 JSON。

浏览器读取同源 `/cos-download-index/xingmang.json` 与 `/cos-download-index/chatgpt.json`。`sites/functions/` 中的 Cloudflare Pages Function 只允许这两个公开索引，限制超时、响应体和重定向，不使用上传密钥，不转发用户 Cookie 或 Authorization。生成的 `_routes.json` 只包含两个索引路径。

索引或安装包还未上传时，不会编造下载地址。页面显示同步状态，并提供重试和本站客服入口。提供哪个系统以实际清单为准，不根据文件名猜测；Mac 官方完整 ZIP 与星芒 DMG 分开说明。

## 首次上线顺序

1. 先上传已经核验的安装包，再上传两份索引。核对匿名读取、文件大小、Content-Type 与完整摘要。Windows 官方 MSIX 和离线许可必须同版本、同架构。
2. 完成本地 mock 测试、两站实际 VitePress 构建和 Pages Functions 编译。
3. 提交 PR，等待 Claude 审查后再合并。原生产 `sites` 工作流在 main 合并后部署两站；没有新服务器或 SSH 配置要求。保留既有 Cloudflare Secrets。
4. 上线后验收两站的选择区、各平台真实下载与旧路由跳转，再发布指向该入口的管理工具版本。

后续只更新 COS 索引即可更新下载选项，教程无需随每次发布修改文件 URL。关闭生产同步不会删除已发布对象。教程源码验证不代表已部署，下载通过也不等于用户安装成功。

## 验证

在 `sites` 目录执行：

```sh
npm ci
node --test tools/tests/*.test.mjs studio/tests/*.test.mjs downloads/*.test.mjs
npm run build
node tools/check-routes.mjs
npx wrangler pages functions build --outdir /path/to/private-local-preview
```

Functions 编译命令只生成本地产物，不部署。公开部署仍按现有 main 工作流和人工审查执行。
