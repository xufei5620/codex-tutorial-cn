# 星芒 Learning Studio v5.4 — 提交与维护

这是已确认 v5.4 预览的新学习空间实现，不是合并旧 PR #13 的视觉。通用内容位于 `content/`，两站业务资料仍从各站 site.json、errors.md、faq.md 读取；原始 `src/content/` 不改写。

## 范围

- 课程按逸尘图文目录组织，配图放在 `sites/shared/img/yichen/`。来源记录沿用预览，不声称本轮核验全部官方课程。
- 新深蓝侧栏、浅色阅读区、暖金学习卡片；原有营销首页 HTML 不在本 PR 中改版。
- 本章有序步骤分别预留截图位；说明小节可隐藏补充图；不以模拟界面替代真实截图。
- 本站账户页、各工具文章、FAQ、错误码保留独立路由；首页既有 /guide/start、/clients/codex 等路径继续有效。

## 本地编辑与正式保存的区别

打开 `/screenshots` 后进入本机编辑，或给具体文章加 `?edit=1`。每个位置最多6张PNG/JPG/WebP，每张12MB、3200万像素；取消选图不改动已有图片；原比例显示、放大、替换、说明、隐藏、按站保存。生产站点没有本机写盘接口，截图编辑入口不会出现。

### 本地自动保存

在 `sites` 目录先执行 `npm run build`，再执行 `npm run local:new`（按量站，4184）或 `npm run local:sub`（订阅站，4183）。这两个命令仅监听本机；旧的 `vitepress preview` 没有自动保存接口。

上传、粘贴、替换、移除、保存图注或改变隐藏设置后，页面自动保存：

- 图片：`sites/<站点>/public/screenshots/<内容哈希>.png|jpg|webp`。
- 图注、位置和设置：`sites/studio/screenshots/<站点>.json`。
- 旧清单：`sites/studio/screenshots/.local-backups/<站点>/`。旧图片不会自动删除，便于恢复。

看到“已自动保存到本机”才代表磁盘确认成功；“正在保存”时请等待。失败可重试，内容同时保留浏览器草稿。初始化时自动恢复浏览器旧草稿；若与磁盘内容冲突，暂停保存并保留两份，先导出当前备份再加载磁盘版本。两个窗口同时修改也会检查版本，避免静默覆盖。

阅读模式只显示已经保存的截图；进入截图编辑后先补“建议截图”，可勾选“显示可选截图位”再处理其他位置。旧截图 ID 会保留提示，不会被静默删掉。

自动保存后的新图片无需重建即可在当前本机预览显示。重新启动仍使用同一端口；正式构建时会读取已保存清单。此功能不会 Git commit、push、上传 GitHub 或部署。静态线上页面没有本地写盘接口，仍使用浏览器草稿和手动导出。

导出 JSON 使用 `xingmang-screenshots/1`，包含图片数据，兼容 v5.3 / v5.4 预览备份。找不到的旧ID保留并提示，不静默删除；跨站默认拒绝，只能显式接受允许共用的软件截图。IndexedDB 是本机缓存，导出备份可用于其他设备。

要把本地截图发布进站点：先构建，再执行（默认只检查）

```sh
cd sites
npm ci
npm run build
node studio/import-screenshots.mjs --site sub2api --file /path/to/screenshots-sub2api-v5.4.json
# 确认位置和站点正确以后，才加 --apply
```

应用时图片写入本站 public/screenshots 的内容哈希文件；配置写入 studio/screenshots/sub2api.json，自动保存旧清单备份。不自动提交、推送或发布。另一个站使用 newapi 参数。需要人工核对脱敏，工具不会自动遮盖敏感信息。

## 编写正文与业务配置

- 章节：`content/yichen/catalog.json` 与 `content/yichen/chapters/`。
- 下载网址、版本、架构、客服链接：各站site.json。空网址不生成假下载按钮。
- FAQ和错误码仍为各站独立Markdown。

### 逸尘图文整合说明

课程目录与配图按 [逸尘 Codex 图文教程](https://github.com/xianyu110/awesome-codex-tutorial/tree/master/tutorials/yichen-codex-articles) 组织。购买、套餐、中转、联系方式、联盟链接、变现路线和线下活动正文不纳入本站。配图仅用于本地课程展示；如需公开发布，请先确认原作者的图片与文字授权。

`studio/prepare.mjs` 先复用原项目的两站变量、二维码与公共材料，再产生新课程页面和 studio.generated.json。不要直接修改 generated 文件。源JSON改变后重建才生效。

## 发布边界

合并到 main 会触发现有生产 workflow，分别构建和发布 Sub2API 与 NewAPI。验证记录应对应实际提交：运行单元测试，实际构建两站并检查页面；分别记录源码提交、构建检查及线上发布状态。
