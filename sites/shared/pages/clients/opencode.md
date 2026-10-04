---
title: OpenCode 接入教程
description: 安装 OpenCode，添加本站为自定义提供方，在练习目录完成第一次调用。
---
# OpenCode 接入教程

OpenCode 是在终端里运行的开源 AI 编程助手。本篇把本站添加为它的“自定义提供方”，调用走本站%%KEY_WORD%%与额度，本篇不需要在 OpenCode 里登录其他服务商账号。终端、桌面和远程环境的配置位置可能不同，不要假定一份设置会自动作用于所有入口。

从哪里开始：第一次使用，从 [安装前准备](#prepare) 开始；已经装好，直接去 [配置本站地址与%%KEY_WORD%%](#site-config)；已经配置过，去 [第一次调用](#first-call) 验证。

## 1. 安装前准备 {#prepare}

1. 按 [注册与账号准备](/guide/account) 登录本站，确认账号有可用额度。
2. 打开 [本站密钥页](%%KEYS_URL%%)，准备一个%%KEY_WORD%%。只在自己电脑上使用，不发到聊天、截图或客服对话中。
3. 打开 [本站模型页](%%MODELS_URL%%)，复制当前分组允许的精确模型 ID。
4. 本篇用 npm 安装，需要先准备 Node.js。还没装时按 [Node.js 与终端](/clients/nodejs) 完成安装，再回到这里。
5. 打开终端：Windows 用普通 PowerShell，macOS 用“终端”。逐行输入下面两条命令，确认都显示版本号。

```bash
node -v
npm -v
```

不想用 npm 的读者，可按 [官方安装说明](https://opencode.ai/docs/) 选择其他方式，例如 macOS 的 Homebrew、Windows 的 Chocolatey 或 Scoop。只选一种，不要重复安装。

**完成标志：** 已有%%KEY_WORD%%和模型 ID，`node -v`、`npm -v` 都显示版本号。命令找不到时回 [Node.js 与终端](/clients/nodejs) 排查。

## 2. 安装与确认版本 {#install}

Windows 和 macOS 的命令相同，在各自的终端中执行即可。已经安装可以跳到第 2 步检查版本。

1. 运行安装命令，等待结束。

```bash
npm install -g opencode-ai
```

2. 检查版本。

```bash
opencode --version
```

Windows 若提示 `npm.ps1` 无法运行，改用 `npm.cmd` 代替 `npm`，不需要管理员终端，也不要修改执行策略。macOS 遇到 `EACCES` 权限错误时，按 [Node.js 与终端](/clients/nodejs) 或 [连接排错](/guide/troubleshooting) 处理，不要在安装命令前加 `sudo`。

**完成标志：** `opencode --version` 显示版本号。显示版本只说明程序能启动，还需要完成下面的配置和调用。

## 3. 配置本站地址与%%KEY_WORD%% {#site-config}

需要的三项信息：

| 内容 | 填写什么 |
| --- | --- |
| 基址（baseURL） | `%%BASE_URL%%/v1` |
| %%KEY_WORD%% | 通过环境变量 `XINGMANG_API_KEY` 提供，不直接写进文件 |
| 模型 | [本站模型页](%%MODELS_URL%%) 中允许的精确模型 ID |

### 打开配置文件 {#open-config}

1. 打开全局配置文件所在目录：Windows 按 Win+R，输入 `%USERPROFILE%\.config\opencode` 后回车；macOS / Linux 的目录是 `~/.config/opencode`。目录不存在时先新建。
2. 找到 `opencode.json`（有的版本是 `opencode.jsonc`）。已有文件先复制一份备份；没有时新建 `opencode.json`，保存为 UTF-8，确认没有被存成 `.txt`。

### 填入本站提供方 {#config-values}

3. 把下面的内容合并进配置文件。已有其他设置时只添加 `provider` 中的本站部分和 `model` 字段，不覆盖其他设置。

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "xingmang": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "星芒 AI",
      "options": {
        "baseURL": "%%BASE_URL%%/v1",
        "apiKey": "{env:XINGMANG_API_KEY}"
      },
      "models": {
        "REPLACE_WITH_MODEL_ID": {"name": "本站允许的模型"}
      }
    }
  },
  "model": "xingmang/REPLACE_WITH_MODEL_ID"
}
```

4. 把两处 `REPLACE_WITH_MODEL_ID` 都换成从本站复制的模型 ID，然后保存。不要照抄旧示例里的上下文上限和价格。
5. 在自己电脑的可信环境中设置环境变量 `XINGMANG_API_KEY`，值为你的%%KEY_WORD%%。不要把真实密钥写进项目文件或公开配置。
6. 关闭并重新打开终端，让环境变量生效。

这个示例使用 `@ai-sdk/openai-compatible`，对应 OpenAI Chat Completions 接口。本站渠道只支持 Responses 或 Anthropic 时，按当前官方提供方文档选择相应适配器与字段；只换包名不等于全部功能可用。

配置会互相覆盖：项目目录里的 `opencode.json`、环境变量 `OPENCODE_CONFIG` 指定的文件，优先级都高于全局配置。改了没生效时先检查这些位置。

**完成标志：** 配置已保存，模型占位文字已替换，新终端中已有 `XINGMANG_API_KEY`。JSON 格式报错时用备份恢复后重改。

## 4. 第一次调用与成功标志 {#first-call}

1. 新建一个空的练习目录，在终端进入该目录。
2. 输入 `opencode` 启动。
3. 在 OpenCode 中输入 `/models`，从列表里选择本站提供方下刚配置的模型。
4. 在输入区发送下面的文字。

```text
这是连接测试。请用一句话回复“连接测试完成”。
不要联网，不读写文件，不执行其他工具。
```

5. 等收到完整回复后，打开 [本站控制台](%%CONSOLE_URL%%) 的调用或用量记录，核对刚才的时间、模型和状态。

首次文件任务先只让它读取，确认结果后再明确批准写入。

**完成标志：** OpenCode 收到完整回复，本站有对应调用记录。更详细的判断见 [验证第一次调用](/guide/verify)；失败时看下一节。

## 5. 失败时下一步 {#troubleshooting}

| 现象 | 下一步 |
| --- | --- |
| `opencode` 命令找不到 | 重新打开终端，回 [第 1 节](#prepare) 检查 `node -v`、`npm -v`，再检查 `opencode --version` |
| `/models` 里没有本站提供方 | 确认改的是实际生效的配置文件，检查项目配置和 `OPENCODE_CONFIG` 是否覆盖了它 |
| 配置格式错误 | 检查 JSON 逗号和括号；不行就用备份恢复后重改 |
| 认证失败或密钥无效 | 确认新终端中已有 `XINGMANG_API_KEY`，到 [本站密钥页](%%KEYS_URL%%) 核对%%KEY_WORD%%状态 |
| 路径错误 | 核对 `baseURL` 是 `%%BASE_URL%%/v1`，以及渠道是否支持该接口协议 |
| 模型不存在或不允许 | 回 [本站模型页](%%MODELS_URL%%) 核对模型 ID 和分组 |
| 有回复但本站没有记录 | 用 `/models` 确认当前选中的是本站提供方，而不是其他提供方 |

恢复时只改动明确的文件和字段，见 [备份恢复](/guide/recovery)。仍未解决时按 [连接排错](/guide/troubleshooting) 准备版本、时间和脱敏错误，再联系 [客服](/contact)；截图前遮住%%KEY_WORD%%。

## 官方参考 {#references}

核对日期：2026-10-04。

- [OpenCode 安装与快速开始](https://opencode.ai/docs/)：`npm install -g opencode-ai` 及其他安装方式、`opencode` 启动命令。
- [提供方说明](https://opencode.ai/docs/providers/)：`@ai-sdk/openai-compatible`、`baseURL`、`{env:变量名}` 写法和 `/models` 选择模型。
- [配置说明](https://opencode.ai/docs/config/)：全局配置位置、项目配置与 `OPENCODE_CONFIG` 的优先级。
- [故障排查](https://opencode.ai/docs/troubleshooting/)：Windows 下的配置目录 `%USERPROFILE%\.config\opencode`。

本页未进行本站真实模型调用测试；界面和命令以当前版本为准，并按上方小任务验证。
