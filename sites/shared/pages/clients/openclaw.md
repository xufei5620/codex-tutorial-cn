---
title: OpenClaw 接入与本地使用
description: 安装 openclaw-cn、填写本站地址与密钥，在本机完成第一次调用，并保留访问保护。
---
# OpenClaw 接入与本地使用

OpenClaw 是在本机运行的智能体工具，带一个浏览器中打开的本地控制界面。本篇按本站使用的 `openclaw-cn` 安装包讲解，配置文件在 `~/.openclaw/openclaw.json`。它不是官方 OpenClaw 账号或订阅；本篇的调用走本站%%KEY_WORD%%与额度。`openclaw-cn` 的包名和命令与上游官方 OpenClaw 不一定相同，两套说明不要混用。

从哪里开始：第一次安装，从 [安装前准备](#prepare) 开始；已经装好，直接去 [配置本站地址与%%KEY_WORD%%](#site-config)；已经配置过，去 [第一次调用](#first-call) 验证。

## 1. 安装前准备 {#prepare}

1. 按 [注册与账号准备](/guide/account) 登录本站，确认账号有可用额度。
2. 打开 [本站密钥页](%%KEYS_URL%%)，准备一个%%KEY_WORD%%。只在自己电脑的配置文件里粘贴，不发到聊天、截图或客服对话中。
3. 打开 [本站模型页](%%MODELS_URL%%)，复制当前分组允许的精确模型 ID，后面要用。
4. `openclaw-cn` 通过 npm 安装，需要先准备 Node.js。还没装时按 [Node.js 与终端](/clients/nodejs) 完成安装，再回到这里。
5. 打开终端：Windows 用普通 PowerShell，macOS 用“终端”。逐行输入下面两条命令，确认都显示版本号。

```bash
node -v
npm -v
```

**完成标志：** 已有%%KEY_WORD%%和模型 ID，`node -v`、`npm -v` 都显示版本号。命令找不到时回 [Node.js 与终端](/clients/nodejs) 排查。

## 2. 安装与初始化 {#install}

已经安装可以跳过本节，直接去 [配置本站](#site-config)。Windows 和 macOS 的命令相同，在各自的终端中执行即可。

1. 在终端运行安装命令，等待结束。

```bash
npm install -g openclaw-cn@latest
```

2. 运行初始化向导，并安装后台服务。

```bash
openclaw-cn onboard --install-daemon
```

3. 向导询问工作目录时，选择一个本机的空练习目录，不要选系统目录或存放重要资料的文件夹。
4. 向导中的访问保护保持默认开启，不要为了省事关闭。
5. 向导要求选择模型提供方时，可以先按 [第 3 节](#site-config) 填写本站信息；也可以先跳过，之后再改配置文件。
6. 本地控制界面加载很慢或打不开时，在终端运行下面的命令，再刷新本地页面。

```bash
openclaw-cn gateway
```

Windows 若提示 `npm.ps1` 无法运行，改用 `npm.cmd` 代替 `npm`，不需要管理员终端，也不要修改执行策略。macOS 遇到 `EACCES` 权限错误时，按 [Node.js 与终端](/clients/nodejs) 或 [连接排错](/guide/troubleshooting) 处理，不要在安装命令前加 `sudo`。

**完成标志：** 向导完成，能在浏览器打开本地控制界面。安装报错时记下完整错误文字，先看 [连接排错](/guide/troubleshooting)。

## 3. 配置本站地址与%%KEY_WORD%% {#site-config}

需要的三项信息：

| 内容 | 填写什么 |
| --- | --- |
| 基址（Base URL） | `%%OPENCLAW_BASE_URL%%` |
| %%KEY_WORD%% | [本站密钥页](%%KEYS_URL%%) 创建的密钥 |
| 模型 | [本站模型页](%%MODELS_URL%%) 中允许的精确模型 ID |

向导里若有“OpenAI 兼容”的 Base URL 输入框，直接填：

```text
%%OPENCLAW_BASE_URL%%
```

要手动修改配置文件时，按下面操作。

1. 打开配置文件：Windows 按 Win+R，输入 `%USERPROFILE%\.openclaw\openclaw.json` 后回车；macOS / Linux 用文本编辑器打开 `~/.openclaw/openclaw.json`。
2. 修改前先复制一份备份，例如另存为 `openclaw.json.bak`。
3. 只合并下面示例中的提供方、%%KEY_WORD%%和模型字段。向导生成的 workspace、gateway token 等内容保留不动，不要整份覆盖。

```json
{
  "models": {
    "providers": {
      "xingmang": {
        "baseUrl": "%%OPENCLAW_BASE_URL%%",
        "apiKey": "REPLACE_WITH_YOUR_SITE_KEY",
        "auth": "api-key",
        "api": "openai-responses"
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "xingmang/REPLACE_WITH_MODEL_ID"
      }
    }
  }
}
```

4. 把 `REPLACE_WITH_YOUR_SITE_KEY` 换成你的%%KEY_WORD%%，把 `REPLACE_WITH_MODEL_ID` 换成从本站复制的模型 ID。
5. 核对 `baseUrl` 是 `%%OPENCLAW_BASE_URL%%`，不要抄其他教程示例里的域名。
6. 保存文件。JSON 不支持注释，也不要在最后一项后面留逗号。
7. 重启网关，让新配置生效。

```bash
openclaw-cn gateway restart
```

不要复制别人配置里的价格、上下文长度或 gateway token。

**完成标志：** 配置已保存，占位文字都已替换，网关重启没有报错。重启失败或提示配置格式错误时，用备份恢复后再改一次。

## 4. 第一次调用与成功标志 {#first-call}

1. 使用向导或当前版本帮助给出的本地界面入口，在浏览器中打开控制界面。核对实际端口和认证方式，以当前版本界面为准。
2. 确认界面中选中的提供方和模型是刚才配置的本站模型。
3. 在对话输入区发送下面的文字。

```text
这是连接测试。请用一句话回复“连接测试完成”。
不要联网，不读写文件，不执行其他工具。
```

4. 等收到完整回复后，打开 [本站控制台](%%CONSOLE_URL%%) 的调用或用量记录，核对刚才的时间、模型和状态。

首次练习不要把网关绑定到所有网络接口，也不要把本地网关直接暴露到公网。安装插件、连接外部聊天平台属于额外授权，不是完成本站接入的必要条件；需要时逐项理解权限后再开。

**完成标志：** 控制界面收到完整回复，本站有对应调用记录。更详细的判断见 [验证第一次调用](/guide/verify)；失败时看下一节。

## 5. 失败时下一步 {#troubleshooting}

| 现象 | 下一步 |
| --- | --- |
| `openclaw-cn` 命令找不到 | 重新打开终端，回 [第 1 节](#prepare) 检查 `node -v`、`npm -v`，再重装 |
| 本地界面打不开或一直加载 | 运行 `openclaw-cn gateway` 后刷新；仍不行时记录端口和错误文字 |
| 改完配置没有变化 | 确认改的是 `~/.openclaw/openclaw.json`，并执行 `openclaw-cn gateway restart` |
| 配置格式错误 | 检查 JSON 逗号和括号；不行就用备份恢复后重改 |
| 认证失败或密钥无效 | 到 [本站密钥页](%%KEYS_URL%%) 核对%%KEY_WORD%%状态，重新粘贴，注意前后不要带空格 |
| 模型不存在或不允许 | 回 [本站模型页](%%MODELS_URL%%) 核对模型 ID 和分组 |
| 有回复但本站没有记录 | 检查界面实际选用的提供方，确认不是其他提供方或旧配置 |

更新前先备份配置，并记录版本、提供方和所用插件。不要混用另一分支（如上游官方 `openclaw`）的命令。仍未解决时按 [连接排错](/guide/troubleshooting) 准备版本、时间和脱敏错误，再联系 [客服](/contact)；截图前遮住%%KEY_WORD%%和 gateway token。需要回退时看 [备份恢复](/guide/recovery)。

## 官方参考 {#references}

核对日期：2026-10-04。

- [OpenClaw 官方文档](https://docs.openclaw.ai/)：上游官方版本使用 `openclaw onboard` 等命令，与本篇的 `openclaw-cn` 不同，仅供对照。
- [自定义提供方说明](https://docs.openclaw.ai/concepts/model-providers/custom-providers)：`models.providers`、`baseUrl`、`apiKey`、`api` 与 `agents.defaults.model.primary` 字段，以及修改后用 `gateway restart` 重启网关。

界面和命令可能随版本变化，以你当前安装版本的提示为准，并按上方小任务验证。
