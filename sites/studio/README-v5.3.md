# 星芒 Learning Studio v5.3 — 提交与维护

这是已确认 v5.3 预览的新学习空间实现，不是合并旧 PR #13 的视觉。通用内容位于 `content/`，两站业务资料仍从各站 site.json、errors.md、faq.md 读取；原始 `src/content/` 不改写。

## 范围

- 11章、64小节、18个官方资料改编教学单元、6个原创行业练习；来源记录沿用预览，不声称本轮核验全部官方课程。
- 新深蓝侧栏、浅色阅读区、暖金学习卡片；原有营销首页 HTML 不在本 PR 中改版。
- 本章有序步骤分别预留截图位；说明小节可隐藏补充图；不以模拟界面替代真实截图。
- 本站账户页、各工具文章、FAQ、错误码保留独立路由；首页既有 /guide/start、/clients/codex 等路径继续有效。

## 本地编辑与正式保存的区别

打开 `/screenshots` 后进入本机编辑，或给具体文章加 `?edit=1`。读者默认没有上传工具。编辑界面不会提交后台，不是身份认证或后台权限系统。每个位置最多6张PNG/JPG/WebP，每张12MB、3200万像素；取消选图不改动已有图片；原比例显示、放大、替换、说明、隐藏、按站保存。

保存 JSON 使用 `xingmang-screenshots/1`，兼容 v5.3 预览备份。找不到的旧ID保留并提示，不静默删除；跨站默认拒绝，只能显式接受允许共用的软件截图。IndexedDB 是本机缓存，不能替代备份。

工具栏可导出 **11章课程** 阅读HTML和本地补图HTML。它们独立运行，已有图片嵌入；工具接入、FAQ等链接仍去本站文档，并不声称是整站离线包。正式在线截图管理包含完整元数据、粘贴、拖入和清单；离线补图版提供上传、图注、移除、隐藏和JSON备份。

要把本地截图发布进站点：先构建，再执行（默认只检查）

```sh
cd sites
npm ci
npm run build
node studio/import-screenshots.mjs --site sub2api --file /path/to/screenshots-sub2api-v5.3.json
# 确认位置和站点正确以后，才加 --apply
```

应用时图片写入本站 public/screenshots 的内容哈希文件；配置写入 studio/screenshots/sub2api.json，自动保存旧清单备份。不自动提交、推送或发布。另一个站使用 newapi 参数。需要人工核对脱敏，工具不会自动遮盖敏感信息。

## 编写正文与业务配置

- 章节：`content/ch01.json`～`ch11.json`。
- 正文融合单元：`content/units-1.json`～`units-3.json`；章节用unitId引用，共18单元。
- 行业练习：`content/industries.json`。引用与核对记录：`content/sources.json`。
- 下载网址、版本、架构、客服链接：各站site.json。空网址不生成假下载按钮。
- FAQ和错误码仍为各站独立Markdown，保留旧文；旧版中具体额度、路径、时间承诺需站主复核。本PR没有重新验证接口业务。

`studio/prepare.mjs` 先复用原项目的两站变量、二维码与公共材料，再产生新课程页面和 studio.generated.json。不要直接修改 generated 文件。源JSON改变后重建才生效。

## 发布边界

新工作分支 `feat/learning-studio-v5-3` 包含旧PR的基础设施修复，但使用全新学习界面。新PR应整体审阅；无需先把旧PR合并。main与两套正式域名本次不修改。合并main仍会触发现有生产workflow，须另行确认。

此次提交不等于所有按钮截图已补齐、不等于完整官方课程已同步、不等于安装包与账号流程已实测。预览、CI和最终发布分别记录。构建依赖原有审计告警不因新界面自动消失。
