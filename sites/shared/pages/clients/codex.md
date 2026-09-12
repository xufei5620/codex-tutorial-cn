---
title: OpenAI / Codex 接入教程
description: 区分官方账号与本站 API 接入，用最小配置验证 Codex。
---
# OpenAI / Codex 接入教程

本篇先讲 Codex CLI 的本站接入。桌面应用、IDE 扩展与命令行是不同使用入口，具体名称和功能以安装版本的官方说明为准；不能把某一入口配置成功当作所有入口都已适配。

[想先了解怎么使用？阅读 Codex 零基础](/learn/codex/)；不想手动配置可先看 [管理工具说明](/guide/manager)。

::: tip 本站这一页要填的基址
`%%CODEX_BASE_URL%%`

两站地址不同，不要从另一站教程或旧截图照抄。Claude Code、Gemini CLI 的基址也不要套到 Codex 上。
:::

## 1. 安装与准备

使用 [官方 CLI 安装说明](https://developers.openai.com/codex/cli/)。采用 npm 方式时，先完成 [Node.js 准备](/clients/nodejs)：

```text
npm install -g @openai/codex
codex --version
```

准备当前%%KEY_WORD%%、允许的模型 ID，并确认分组支持 Codex 所需的 Responses 协议。官方 ChatGPT 登录与本站 API 密钥是两条不同认证路径，不能把网站密码当作 API Key。

## 2. 备份并改两个文件

先退出正在运行的 Codex。Windows 用 Win+R 打开 `%USERPROFILE%\.codex`；macOS / Linux 对应 `~/.codex`。没有这两个文件就新建；已有文件先备份，只改必要字段。

`auth.json` 只放这一项，不要写别的：

```json
{
  "OPENAI_API_KEY": "REPLACE_WITH_YOUR_SITE_KEY"
}
```

`config.toml` 里提供方和基址按本站填写。模型名从 [本站列表](%%MODELS_URL%%)复制，不要照抄旧截图：

```toml
model_provider = "mycodex"
model = "REPLACE_WITH_MODEL_ID"

[model_providers.mycodex]
name = "mycodex"
base_url = "%%CODEX_BASE_URL%%"
wire_api = "responses"
requires_openai_auth = true
```

::: warning 先确认基址
本站 Codex 填 `%%CODEX_BASE_URL%%`。不要把 `/responses` 写进基址。两个文件都要改，只改其中一个常会认证失败。
:::

## 3. 重启后再验证

改完后重启 Codex App、IDE 扩展或终端里的 CLI，再按 [验证第一次调用](/guide/verify)做一次小文本测试，并到本站记录里核对。

认证失败先看 `auth.json` 是否完整、%%KEY_WORD%%是否启用。路径错误先看 `base_url` 是不是 `%%CODEX_BASE_URL%%`。模型不允许时检查分组和精确 ID。

## 4. 连接之后怎么用

从 [第一次任务](/learn/first-task)开始练习提需求，再学习 [文件夹操作](/learn/working-with-files)和 [结果检查](/learn/review-and-revise)。需要完整学习路线时进入 [Codex 零基础](/learn/codex/)。

## 参考与验证状态

[官方 CLI](https://developers.openai.com/codex/cli/) · [高级配置](https://developers.openai.com/codex/config-advanced/)。2026-09-08 文档核对；本站端点与不同客户端版本仍需实测，未执行真实 API 请求。
