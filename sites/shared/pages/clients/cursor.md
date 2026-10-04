---
title: Cursor 使用与接入说明
description: 安装 Cursor，分清编辑器自带模型与终端工具两种用法，在 Cursor 里用本站接入的 Codex 或 Claude Code 完成第一次调用。
---
# Cursor 使用与接入说明

Cursor 是带 AI 功能的代码编辑器。它**不是**本站的客户端：安装 Cursor 不会自动接入本站，Cursor 自带的模型、补全和 Agent 也不会因为你有本站%%KEY_WORD%%就改走本站。本篇推荐的做法是：在 Cursor 的终端或扩展里运行已经接好本站的 Codex / Claude Code。

**从哪里开始：** 还没装 Cursor，从 [安装前准备](#prepare)开始。已经装好，先看 [两种用法怎么选](#choose-mode)，再去 [终端用法](#terminal-mode)。只想了解 Cursor 自带的 Key 设置，直接看 [自带 Key 的边界](#builtin-keys)。

## 1. 先选你要的用法 {#choose-mode}

| 用法 | 适合谁 | 走哪里的额度 |
| --- | --- | --- |
| **A. 终端 / 扩展用法（推荐）**：在 Cursor 里运行 Codex 或 Claude Code | 已有本站账号，想在编辑器里看文件、改文件 | 本站%%KEY_WORD%%所属分组的额度 |
| **B. Cursor 自带模型**：用 Cursor 的聊天、Agent、Tab 补全 | 使用 Cursor 自己的账号与套餐 | Cursor 套餐，或你在 Cursor 中填写的官方厂商 Key |

两种用法的认证和计费互不相通。A 路线成功，不代表 Cursor 自带聊天也走了本站；B 路线里填了 Key，也不代表本站能看到这些调用。

**完成标志：** 已经知道自己走 A 还是 B。走 A：继续 [安装前准备](#prepare)。只关心 B：可跳到 [自带 Key 的边界](#builtin-keys)。

## 2. 安装前准备 {#prepare}

1. 按 [注册与准备](/guide/account)登录本站，确认账户有可用额度。
2. 在 [%%KEY_WORD%%页面](%%KEYS_URL%%)准备一个有效的%%KEY_WORD%%，在 [模型页面](%%MODELS_URL%%)记下当前分组可用的模型 ID。
3. 先按对应教程装好并接通一个终端工具：[Codex](/clients/codex) 或 [Claude Code](/clients/claude-code)。在系统终端里能正常对话，再来 Cursor 里使用，排错会简单很多。
4. 在桌面或文档目录新建一个空的练习文件夹，例如 `cursor-practice`。不要用含有合同、账号、私人照片等敏感资料的文件夹练习。

终端工具需要 Node.js 时，安装和检查方法见 [Node.js 与终端](/clients/nodejs)，本篇不重复。

**完成标志：** 本站有额度和%%KEY_WORD%%；Codex 或 Claude Code 至少一个已在系统终端里调用成功；练习文件夹已建好。还没接通终端工具时，先回对应教程，不要在 Cursor 里同时排查两件事。

## 3. 安装 Cursor {#install}

安装包从 [Cursor 官方下载页](https://cursor.com/downloads)获取。不要从网盘、群文件或不明网站下载“破解版”“汉化版”。

### Windows {#windows}

1. 打开 [Cursor 官方下载页](https://cursor.com/downloads)，选择 Windows 版本，等待下载完成。
2. 打开“下载”文件夹，双击刚下载的安装程序。
3. 按安装程序的提示一步步完成安装，安装界面以当前版本为准。
4. 从“开始”菜单搜索 **Cursor** 并打开。

### macOS {#mac}

1. 打开 [Cursor 官方下载页](https://cursor.com/downloads)，选择 Mac 版本，等待下载完成。
2. 双击下载的文件，把 **Cursor** 拖到 **Applications / 应用程序** 文件夹。
3. 从“应用程序”文件夹打开 Cursor；首次打开时按 macOS 的来源确认提示操作。

### 首次启动 {#first-launch}

1. 按界面提示登录 **Cursor 账号**。这是 Cursor 自己的账号，不要在这里填写本站账号、密码或%%KEY_WORD%%。
2. 首次启动可能出现导入设置、主题、语言等选项，按自己习惯选择即可，以当前版本界面为准。
3. 在顶部菜单选择 **File（文件）→ Open Folder（打开文件夹）**，打开第 2 节建好的练习文件夹。
4. 如果弹出是否信任该文件夹的提示，确认显示的是练习文件夹后再选择信任。

**完成标志：** Cursor 能独立打开，左侧文件栏显示的是练习文件夹。打不开或提示安装包损坏时，回官方下载页核对系统与芯片版本后重新下载，不要关闭系统安全保护来强行运行。

## 4. 用法 A：在 Cursor 终端里运行 Codex / Claude Code {#terminal-mode}

这是本站推荐的接入方式。Cursor 只负责提供窗口和终端，真正连接本站的是终端里运行的 Codex 或 Claude Code，它们读取的是你在对应教程里写好的配置。

1. 在顶部菜单找到 **Terminal（终端）**，选择新建终端。菜单名以当前版本界面为准。
2. 看终端提示符里的路径，确认当前位置是练习文件夹。路径不对时，先关闭这个终端，回到第 3 节用 **Open Folder** 重新打开练习文件夹。
3. 先检查工具能被找到：Codex 输入 `codex --version`，Claude Code 输入 `claude --version`。
4. 看到版本号后，输入 `codex` 或 `claude` 启动工具，等待进入它的对话输入区。
5. 出现工作目录或信任确认时，确认显示的是练习文件夹，再选择继续。

Windows 若提示 `codex.ps1` 被系统策略阻止，改用 `codex.cmd --version` 和 `codex.cmd` 启动；详细说明见 [Codex 教程](/clients/codex#install-cli-command)。不要为此修改执行策略或改用管理员终端。

**还可以装官方扩展（可选）：** OpenAI 官方说明 Codex 扩展支持 Cursor；Anthropic 官方也提供可安装到 Cursor 的 Claude Code 扩展。扩展的安装、打开方式和本站配置位置，与 [VS Code 页面的扩展用法](/clients/vscode#extension-mode)相同，按那里的步骤操作即可。第一次接入建议先用终端，确认成功后再试扩展。

**完成标志：** 在 Cursor 的终端里进入了 Codex 或 Claude Code 的对话输入区。接下来做 [第一次调用](#first-call)。提示“找不到命令”时，看 [失败时下一步](#troubleshooting)。

## 5. 用法 B：Cursor 自带 Key 的边界 {#builtin-keys}

根据 [Cursor 官方 API Key 说明](https://cursor.com/help/models-and-usage/api-keys)，自带 Key 在 **Cursor Settings → Models** 中填写，官方列出的提供方是 OpenAI、Anthropic、Google、Azure OpenAI 和 AWS Bedrock。官方同时说明：自带 Key **只用于聊天模型**，Tab 补全仍使用 Cursor 自己的模型。

1. 打开 **Cursor Settings → Models**，查看当前版本提供哪些 Key 输入框。
2. 对照下表判断，再决定是否填写。

| 你看到的情况 | 怎么做 |
| --- | --- |
| 只有官方厂商（OpenAI、Anthropic 等）的 Key 输入框 | 这些框是给官方厂商 Key 用的。本站%%KEY_WORD%%与官方厂商 Key 不是同一种凭据，**不要填入本站密钥** |
| 界面里另有可自定义地址的选项 | 本站尚未验证 Cursor 自带聊天走自定义地址的效果，先不要当作已支持；需要时联系 [客服](/contact)确认 |
| 想用 Cursor 的 Agent、Tab 补全 | 按 Cursor 官方说明，使用 Cursor 账号与套餐 |

只有客户端确实支持对应自定义基址和协议，才尝试填写本站信息。不要使用破解、修改程序或伪造服务身份来强行接入。官方同时提示：使用自带 Key 时，数据处理遵循你所选提供方的隐私政策。

**完成标志：** 已明白 Cursor 自带功能和本站接入是两回事。想用本站额度，回到 [用法 A](#terminal-mode)。

## 6. 第一次调用与成功标志 {#first-call}

1. 在 Cursor 终端里已经启动的 Codex 或 Claude Code 对话输入区，发送下面的文字。注意是发给工具的对话框，不是在工具启动前的终端命令行里输入。

```text
这是连接测试。请用一句话回复“连接测试完成”。
不要联网，不读写文件，不执行其他工具。
```

2. 等待出现完整回复。
3. 打开 [本站控制台](%%CONSOLE_URL%%)，进入调用或用量记录，找到刚才的时间、模型和状态。
4. 回复和记录都对得上，再让工具读一读练习文件夹里的文件；第一次写入只限定一个文件。

截图求助时，遮住%%KEY_WORD%%、账号和私人路径。不要把完整密钥发到聊天、截图或客服。

**完成标志：** 工具有完整回复，本站有对应记录。两者缺一项都不算接通，详细判断见 [验证第一次调用](/guide/verify)。接下来可以做 [第一次任务](/learn/first-task) 和 [文件夹练习](/learn/working-with-files)。

## 7. 失败时下一步 {#troubleshooting}

| 现象 | 下一步 |
| --- | --- |
| Cursor 终端提示找不到 `codex` 或 `claude` | 先在系统终端检查同一命令；系统终端也找不到，回 [Codex](/clients/codex) 或 [Claude Code](/clients/claude-code) 教程重装或检查 PATH。刚装好时，完全退出 Cursor 再打开 |
| 系统终端能用，Cursor 终端不能用 | 完全退出 Cursor 后重新打开，让它读取新的环境；仍不行时检查两边用的是否是同一种终端（PowerShell、zsh 等） |
| 工具要求登录官方账号 | 说明没有读到本站配置。回对应教程核对配置文件，不要用官方登录代替本站配置 |
| 模型不存在或无权限 | 回 [模型页面](%%MODELS_URL%%)核对当前分组可用的模型 ID |
| 有回复，但本站没有记录 | 可能用的是 Cursor 自带聊天，或工具走了官方登录。确认是在终端里的 Codex / Claude Code 中发送的 |
| 在 Cursor Settings 填了本站密钥但不生效 | 这是预期结果，见 [自带 Key 的边界](#builtin-keys)，改用用法 A |
| 远程窗口、WSL、容器里找不到工具 | 命令实际在远程环境里运行，需要在那个环境里另外安装和配置 |

仍未解决时按 [排错顺序](/guide/troubleshooting)整理 Cursor 版本、工具版本、时间和脱敏错误，再联系 [客服](/contact)。

## 官方参考

核对日期：2026-10-04。

- [Cursor 安装说明](https://cursor.com/help/getting-started/install)
- [Cursor 自带 API Key 说明](https://cursor.com/help/models-and-usage/api-keys)
- [Codex IDE 扩展（支持编辑器列表）](https://developers.openai.com/codex/ide)
- [Claude Code VS Code 扩展（含 Cursor 安装入口）](https://code.claude.com/docs/en/vs-code)

菜单名称可能随版本变化，以当前版本界面为准。本页未将 Cursor 自带功能的自定义网关能力标为已支持。
