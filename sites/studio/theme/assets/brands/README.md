# 教程品牌图标来源

这些静态资源只用于辨识教程所讲的工具。品牌和商标属于各权利人，不表示本站得到品牌方认证或背书。页面从构建产物加载图标，不请求第三方图标 CDN。

## Lobe Icons（8 个 SVG）

- 项目：<https://github.com/lobehub/lobe-icons>
- 固定提交：`82e641b4fece9d1028a127149af9ded00df5ac0c`
- 原始路径：`packages/static-svg/icons/`
- 本地文件：`openai.svg`、`claude-color.svg`、`gemini-color.svg`、`grok.svg`、`openclaw-color.svg`、`opencode.svg`、`deepseek-color.svg`、`cursor.svg`
- 字节保持原样，许可全文见 `LICENSE.lobe-icons.txt`（MIT）。这是 Lobe Icons 收录的品牌图形，不将其来源描述为品牌方发布的官方素材包。
- Codex 教程使用 OpenAI 标志，DeepSeek Harness 教程使用 DeepSeek 标志。

## Hermes Agent（PNG）

- 官方项目：<https://github.com/NousResearch/hermes-agent>
- 固定提交：`343500b3547e12530457c2fda60ec687e25118b4`
- 原始路径：`apps/desktop/assets/appx/Square44x44Logo.targetsize-96_altform-unplated.png`
- 本地文件：`hermes.png`，96 × 96，字节保持原样。
- 许可全文见 `LICENSE.hermes-agent.txt`（MIT）。

## Visual Studio Code（SVG）

- 官方品牌页面：<https://code.visualstudio.com/brand>
- 官方素材包：<https://code.visualstudio.com/assets/branding/visual-studio-code-icons.zip>
- 来源文件：`visual-studio-code-icons/vscode.svg`，字节保持原样；2026-10-04 获取，压缩包说明标注版本 2021-06-21。
- 使用蓝色 stable 标志，不使用 Insiders 或应用图标；保持比例，教程中只用作 Visual Studio Code 产品标识。
- 素材包原始说明见 `LICENSE.vscode.txt`。此图标按微软品牌指南用于教程，不套用其他图标的 MIT 许可。

## 星芒 AI

- 官方项目：<https://github.com/xufei5620/xingmang-ai-manager>
- 来源提交：`93033e6331ca095f74f130a51264b356fcfcaaf4`
- 原始路径：`assets/brand/v3/symbol-standard.svg`
- 本地文件：`xingmang.svg`，直接复用管理工具 v3 的标准图形标；字节保持原样，未重绘。
- 此标记属于星芒 AI 自有品牌资源，仅在本站用于管理工具的产品标识，不使用教程站旧的蓝紫色 `/logo.png`。
- 保留管理工具仓库的原始权利声明于 `LICENSE.xingmang.txt`；这是专有品牌资源，不套用第三方图标的 MIT 许可。

## 资源边界

SVG 均通过本地检查：无脚本、事件属性、`foreignObject`、DOCTYPE、外部引用或嵌入图片，仅允许本文件内的渐变、遮罩和滤镜引用。组件以 `<img>` 引用，不将 SVG 文本通过 `v-html` 注入页面。
