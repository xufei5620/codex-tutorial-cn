---
title: Gemini CLI 接入教程
description: 使用 Gemini API Key 模式和对应基址，不把不同协议混用。
---
# Gemini CLI 接入教程

本篇对应终端中的 Gemini CLI。Gemini 网页、Google 官方账号登录与本站 API Key 并不是同一条认证路径。

::: tip 本站这一页要填的基址
`%%BASE_URL%%`

不要加 `/v1`。Gemini CLI 会自己拼 Gemini 原生路径。也不要把 Codex 或 OpenClaw 的地址抄过来。
:::

## 1. 安装并确认

按 [官方快速开始](https://geminicli.com/docs/get-started/)检查所需 Node.js 版本；使用 npm 安装时：

```text
npm install -g @google/gemini-cli
gemini --version
```

版本命令失败先处理环境问题，见 [Node.js 与终端](/clients/nodejs)。

## 2. 备份配置目录

先退出 Gemini。Windows 用 Win+R 打开 `%USERPROFILE%\.gemini`；macOS / Linux 对应 `~/.gemini`。已经设置 `GEMINI_CLI_HOME` 时以实际位置为准。没有文件就新建；已有文件先备份。

`settings.json` 只保留认证方式：

```json
{
  "security": {
    "auth": {
      "selectedType": "gemini-api-key"
    }
  }
}
```

这份配置不强制启用 IDE 集成，也不改变执行权限。

## 3. 设置基址、密钥和模型

在用户级 `.gemini/.env` 中填写：

```ini
GOOGLE_GEMINI_BASE_URL=%%BASE_URL%%
GEMINI_API_KEY=REPLACE_WITH_YOUR_SITE_KEY
GEMINI_MODEL=REPLACE_WITH_MODEL_ID
```

模型名按 [本站可用列表](%%MODELS_URL%%)填写。此基址用于 Gemini API Key 模式，填 `%%BASE_URL%%`；普通 OpenAI 兼容地址（带 `/v1` 的那种）不能拿来冒充 Gemini。

不要把文件存成 `.env.txt`。用户环境和项目环境可能覆盖设置，修改后重启工具。密钥文件不要提交到公开仓库或发送给别人。

## 4. 启动并验证

```text
gemini
```

先做 [小请求验证](/guide/verify)，核对模型与本站调用记录，再测试实际需要的图片或工具功能。一个文本回复不证明其他功能都可用。

## 5. 常见问题

重新出现官方登录页面时检查是否选择了正确认证模式。读取到旧模型时检查系统环境变量与项目配置。路径错误检查基址和协议，配置文件格式错误先修正 JSON。

[排错顺序](/guide/troubleshooting) · [备份恢复](/guide/recovery) · [本站客服](/contact)

## 参考与验证状态

[官方配置说明](https://geminicli.com/docs/reference/configuration/)。2026-09-08 文档核对；未进行本站真实请求或用户设备测试。
