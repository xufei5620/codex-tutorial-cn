# 给 AI 代理（Codex 等）的仓库规则

这是一套写给零基础中文读者的 **Codex 桌面应用入门教程**，纯静态 HTML + CSS，可离线阅读。
仓库根目录就是站点根目录。**当前任务与完整交接说明在 `src/HANDOFF.md`，动手前先读它。**

## 绝对不要做的事

1. **不要直接改根目录的 HTML / README.md / manifest.json / SHA256SUMS.txt / downloads/**。它们全部由 `python3 src/build.py` 生成，会被覆盖。改内容只改 `src/content/*.html` 与 `src/chapters.json`。
2. **不要加 JavaScript、内联 style、远程资源**（外链 `<a href="https://…">` 允许）。`src/check.py` 会拦。
3. **不要引入构建工具或第三方依赖**。构建与检查只用 Python 3 标准库（`jsonschema` 可选）。
4. **不要改 `main` 分支、不要打 tag、不要发 Release、不要开启 GitHub Pages**。在指定的工作分支提交并推送，由用户审阅合并。
5. **不要写入任何真实的人名、公司、账号、客户数据或截图里的账号信息**。示例只用虚构品牌「蓝溪文具」（店主老周、店员小梅、李姐）。
6. **不要把没有官方来源或没有实测过的产品细节写成事实**。写不准的地方用「以实际界面为准」之类的保留语，并在维护者信息块里记录待验证。

## 每次改动后的固定动作

```
python3 src/build.py     # Windows 上可能是 py -3 src/build.py
python3 src/check.py     # 退出码 0 才算过
git status               # 只应出现你有意改动的文件及其生成物
```

## 写作约定（读者是零基础）

- 短句、白话，术语第一次出现要解释；界面英文名后面附中文，如 `Ask for approval（先问我）`。
- 三条安全底线贯穿全书：不交真实数据、权限留在 Ask for approval、审批弹窗先读完再点，含「删除」一律拒绝。
- 跨页链接写 `{{link:ch04}}`、`{{link:ch04#s3}}`、`{{link:prompts#prm-com-0001}}`；小节 `<section id="sN">` 的顺序必须和「本章内容」导航一致。
- 章节标题、状态（只有 `draft` / `outline` / `reviewed` 三种）、版本号以 `src/chapters.json` 为唯一来源。
- 每章末尾「维护者信息」块（模块 ID、风险、来源、验证状态、复核日期）要随改动更新；产品事实来源记入 `src/research/sources.md`，查阅要点记入 `src/research/notes.md`。
