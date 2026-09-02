# Codex 中文入门教程

写给第一次接触 AI 与 Codex 的中文读者的离线教程。不需要编程、命令行或 Git 基础。

**怎么读：** 在线版部署好后直接打开网址；或者下载首页的「离线版 ZIP」（也可以 Code → Download ZIP），解压后双击 `index.html`。全站纯 HTML + CSS，无 JavaScript、无远程资源，不联网也能看。

**怎么部署到自己的服务器：** 见 [deploy/DEPLOY.md](deploy/DEPLOY.md)——Docker 一条命令，或 Caddy / Nginx 复制文件即可，没有构建步骤。

**当前版本：** 0.2.1（2026-09-02）。11 章全部有正文，均为「草稿」：依据官方文档撰写，尚未在真实电脑上逐步实测。

> 2026 年 7 月 9 日起，Codex 桌面应用已并入「ChatGPT 桌面应用」（macOS / Windows）。本教程所说的 Codex，指该应用左上角菜单里的 **Codex** 视图。

| 章 | 标题 | 状态 |
|---|---|---|
| 01 | [开始前：边界、安全与阅读方法](ch01.html) | 草稿 |
| 02 | [认识 AI 与 Codex](ch02.html) | 草稿 |
| 03 | [安装、登录与界面](ch03.html) | 草稿 |
| 04 | [第一次对话：把需求说清楚](ch04.html) | 草稿 |
| 05 | [日常协作：检查、修改与回退](ch05.html) | 草稿 |
| 06 | [插件](ch06.html) | 草稿 |
| 07 | [Skill](ch07.html) | 草稿 |
| 08 | [常见任务场景](ch08.html) | 草稿 |
| 09 | [完整虚构案例](ch09.html) | 草稿 |
| 10 | [排错、安全与求助](ch10.html) | 草稿 |
| 11 | [参考与维护](ch11.html) | 草稿 |

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

**改内容的正确姿势：** 编辑 `src/content/` 里对应章节的 HTML 片段（章节标题、状态在 `src/chapters.json`），运行 `python3 src/build.py`（只需要 Python 3，无第三方依赖），根目录下的所有页面、README、清单、离线 ZIP 会一起重新生成；再运行 `python3 src/check.py` 检查链接、锚点、徽章与登记表；把生成结果一并提交。跨页链接写成 `{link:ch04}` 或 `{link:prompts#prm-com-0001}`，构建时自动换成正确地址。

每一章底部都有「维护者信息」：模块 ID、风险级别、来源与权利、验证状态、复核日期。新增或修改内容请使用 `templates/` 中的模板，并在第 11 章更新版本记录与验证状态表。来源清单见第 11 章 11.2。
