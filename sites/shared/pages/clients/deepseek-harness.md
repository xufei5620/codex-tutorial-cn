---
title: DeepSeek Harness 入门说明
description: 用一条命令启动 DeepSeek Harness 的本地 Web 界面，添加自定义提供方并完成第一次调用；不假设存在原生桌面安装包。
---
# DeepSeek Harness 入门说明

DeepSeek Harness 是 DeepSeek 开源的插件化 Agent 工具，在浏览器里打开一个本地网页来使用。它**不是**桌面安装包，也不是本站的官方客户端；项目处于开发者预览阶段，界面和配置可能随版本变化。

**从哪里开始：** 第一次使用，从 [启动前准备](#prepare)开始。已经能打开本地网页，直接去 [添加本站提供方](#provider)。已经配置好，跳到 [第一次调用](#first-call)。

## 1. 启动前准备 {#prepare}

1. 阅读 [官方 README](https://github.com/deepseek-ai/deepseek-harness) 和 [安全说明 SAFETY.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/SAFETY.md)。官方明确提示：开发者预览版**会有不兼容的变化**。
2. 确认电脑上已有可用的 Node.js 和 `npx` 命令。还没装或不会检查，按 [Node.js 与终端](/clients/nodejs)完成，本篇不重复。
3. 按 [注册与准备](/guide/account)登录本站，在 [%%KEY_WORD%%页面](%%KEYS_URL%%)准备一个%%KEY_WORD%%，在 [模型页面](%%MODELS_URL%%)记下当前分组可用的模型 ID。
4. 新建一个空的练习文件夹，例如 `dsh-practice`。不要在含真实敏感资料的文件夹里练习。

官方安全说明建议：用尽量少的权限运行，最好放在独立的虚拟机、容器或专用环境里，并备份它能访问到的文件。它能执行模型生成的代码、加载第三方插件、访问网络和凭据，审批提示不能保证完全隔离。

**完成标志：** 已读过安全说明，`npx` 可用，本站%%KEY_WORD%%和模型 ID 已准备好，练习文件夹已建好。

## 2. 启动本地界面 {#start}

1. 打开终端（Windows 用普通 PowerShell，macOS 用“终端”），进入练习文件夹。
2. 运行官方 README 给出的启动命令：

```text
npx @deepseek-ai/dsh web
```

3. 第一次运行会下载程序包，按提示确认包名是 `@deepseek-ai/dsh` 再继续。
4. 看终端打印的本地地址。官方说明默认是 `http://127.0.0.1:3080`，并会自动用默认浏览器打开；端口以本次输出为准。
5. 在浏览器里确认看到 DeepSeek Harness 的页面。
6. 保持这个终端窗口打开。关掉它，本地网页也会停止工作。

只想启动服务、不自动打开浏览器时，官方提供 `--no-open` 参数。不要把这个本地地址开放到公网或局域网给他人访问。

**完成标志：** 浏览器打开了本地页面。命令报错时，先确认 `node -v`、`npx -v` 能显示版本，再看 [失败时下一步](#troubleshooting)。不要用 `sudo` 或管理员终端强行运行。

## 3. 选择工作区 {#workspace}

官方用户指南说明：没有选择工作区时，会话输入框不可用。

1. 在页面中点击选择工作区的按钮，按钮名以当前版本界面为准。
2. 添加刚才运行命令的练习文件夹，并启用它。
3. 确认页面显示的工作区就是练习文件夹，不是整个用户目录或系统盘。

**完成标志：** 页面显示练习文件夹为当前工作区，会话输入框可用。

## 4. 添加本站提供方 {#provider}

官方 [提供方配置说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/providers.md)支持添加自定义的 OpenAI 兼容端点。本站暂未验证全部协议和模型组合，按下面步骤先试一个文本模型。

1. 打开 **Settings → Models**。
2. 选择 **Add a custom provider**（添加自定义提供方）。
3. 填写 **Provider ID**（只用小写字母，例如 `mysite`）和 **Display name**（显示名称，随意）。
4. **Base URL** 填本站的 OpenAI 兼容地址，常见形式为 `%%BASE_URL%%/v1`。
5. **API protocol** 选择接口协议。官方列出的选项有 `openai-completions`、`openai-responses` 和 `anthropic-messages`；本站当前分组支持哪种，先在 [控制台](%%CONSOLE_URL%%)或 [模型页面](%%MODELS_URL%%)核对，不确定时问 [客服](/contact)。
6. **API key** 填本站%%KEY_WORD%%。截图时把这一栏遮住。
7. 至少添加一个模型，模型 ID 从 [模型页面](%%MODELS_URL%%)复制，不要照抄其他教程的示例。
8. 保存。官方说明保存后下一次请求就生效，不需要重启服务。

官方说明配置保存在 `$DSH_HOME/settings.yaml`，凭据单独保存在 `$DSH_HOME/.credentials.yaml`。不要把其他客户端的 YAML、环境变量或整份配置直接复制给 Harness，也不要把凭据文件发给别人。

**完成标志：** 新提供方已保存，模型列表里能看到你添加的模型。保存失败或协议报错时，先停止，不用未经确认的字段凑出一份“通用配置”。

## 5. 第一次调用与成功标志 {#first-call}

1. 新建一个会话，在模型选择器里选中刚添加的本站模型。官方说明这个选择也会成为新会话的默认模型。
2. 在会话输入框发送：

```text
这是连接测试。请用一句话回复“连接测试完成”。
不要联网，不读写文件，不执行其他工具。
```

3. 等待出现完整回复。
4. 打开 [本站控制台](%%CONSOLE_URL%%)的调用或用量记录，核对刚才的时间、模型和状态。
5. 文本成功后，再测试你需要的一项工具能力，例如让它总结练习文件夹里的一个文件。页面弹出审批时，看清楚要执行的命令再决定。

客户端能启动、配置能保存、模型能回复、完整 Agent 工作流能跑通，是四个不同的检查结果，应分别记录。首次不安装陌生插件，不开放整台电脑。

**完成标志：** 有完整回复，本站有对应记录，详细判断见 [验证第一次调用](/guide/verify)。

## 6. 失败时下一步 {#troubleshooting}

| 现象 | 下一步 |
| --- | --- |
| 提示找不到 `npx` 或 `node` | 按 [Node.js 与终端](/clients/nodejs)检查安装，重开终端再试 |
| 浏览器没有自动打开 | 手动复制终端打印的本地地址到浏览器 |
| 端口被占用或地址不是 3080 | 以终端实际打印的地址为准 |
| 会话输入框灰色不可用 | 还没选择或启用工作区，回 [第 3 步](#workspace) |
| 认证失败 | 检查%%KEY_WORD%%是否复制完整、是否已停用；不要把完整密钥发给任何人 |
| 路径错误或协议不兼容 | 核对 Base URL 是 `%%BASE_URL%%/v1`，以及所选协议本站是否支持，不尝试随机路径 |
| 模型不存在或无权限 | 回 [模型页面](%%MODELS_URL%%)核对当前分组可用的模型 ID |
| 文本能回复，工具调用失败 | 该模型或协议可能不支持工具调用，换模型前先记录脱敏错误 |

## 7. 更新与恢复 {#update}

1. 更新前备份当前的 `settings.yaml`、插件清单和任务资料。开发者预览版本可能出现不兼容变化。
2. 停止服务：回到运行命令的终端窗口，结束该进程或直接关闭窗口。
3. 更新后先重复 [第一次调用](#first-call)，确认仍然正常。
4. 出现问题时，记录版本、插件、模型和脱敏错误；必要时恢复已确认的旧版本或配置。

需要帮助时按 [排错顺序](/guide/troubleshooting)整理信息，再联系 [客服](/contact)。也可以 [选择其他工具](/guide/choose-tool)。

## 官方参考

核对日期：2026-10-04。

- [DeepSeek Harness 官方仓库与 README](https://github.com/deepseek-ai/deepseek-harness)
- [安全说明 SAFETY.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/SAFETY.md)
- [Web 界面用户指南](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/index.md)
- [模型提供方配置](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/providers.md)

本页不宣称已验证本站所有模型插件，也不编造原生安装包、固定设置面板或测试截图。界面名称以当前版本为准。
