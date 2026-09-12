---
title: Claude Code 接入教程
description: 使用最小配置接入本站，保留默认权限确认，并验证实际调用。
---
# Claude Code 接入教程

Claude Code 是编程工具，Claude 桌面应用是另一种使用入口。本篇先完成命令行接入，不把桌面功能、扩展和 CLI 拆成重复产品，也不承诺它们自动共享所有配置。

::: tip 本站这一页要填的基址
`%%BASE_URL%%`

不要加 `/v1`。Claude Code 会自己拼 `/v1/messages`。也不要把 Codex 或 OpenClaw 的地址抄过来。
:::

::: tip 使用管理工具
可以先看 [星芒管理工具使用教程](/guide/manager)。只有当前发行版本明确支持本站和目标工具时，才使用自动配置。
:::

## 1. 安装并确认版本

按 [官方安装说明](https://code.claude.com/docs/en/setup)选择原生安装、WinGet 或 Homebrew 等受支持的方式。安装途径并非都需要 Node.js；不要将 npm 当成唯一方法。

```powershell
# Windows 已安装 WinGet 时
winget install Anthropic.ClaudeCode
```

```bash
# macOS 已安装 Homebrew 时
brew install --cask claude-code
```

安装完成重新打开终端，执行 `claude --version`。没有显示版本号时先处理安装问题，不反复替换密钥。

## 2. 备份用户配置

先退出 Claude Code。Windows 用 Win+R 打开 `%USERPROFILE%\.claude\settings.json`；macOS / Linux 对应 `~/.claude/settings.json`。没有文件就新建；已有文件先备份。

只合并需要的字段，不覆盖原有权限、插件或项目设置。公司托管设置可能有更高优先级，遇到组织限制时联系管理员。

## 3. 添加本站接入信息

以下是独立的最小示例。把占位文字替换为 [本站](%%SITE_URL%%)创建的%%KEY_WORD%%，不要把示例内容提交到公开仓库：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "%%BASE_URL%%",
    "ANTHROPIC_AUTH_TOKEN": "REPLACE_WITH_YOUR_SITE_KEY"
  }
}
```

`ANTHROPIC_AUTH_TOKEN` 与 `ANTHROPIC_API_KEY` 的使用应跟随本站网关要求，不要无目的地同时设置两套认证。Base URL 填 `%%BASE_URL%%`，不是文档站、控制台，也不是带 `/v1` 的 OpenAI 兼容地址。

本例不设置绕过权限确认，不关闭危险操作提示。先保持客户端默认确认机制，再讨论进阶自动执行需求。

## 4. 选择模型并启动

从 [本站模型页面](%%MODELS_URL%%)确认精确模型 ID 和分组。使用当前版本提供的模型选择功能；必要时按官方设置说明添加 `model`，不照抄旧截图的别名和上下文参数。

```text
claude
```

先用虚构内容做小文本测试，再按 [首次调用验证](/guide/verify)核对控制台记录。只有文本成功，不能据此声称所有工具调用和上下文长度都通过。

## 5. 常见问题

认证失败先检查实际读取的配置、旧环境变量与密钥状态。路径错误检查基址是否重复追加 `/v1/messages`。收到分组或客户端限制时，使用本站允许的工具与渠道，不伪造客户端身份。

桌面或 IDE 中的功能，请对照它们自己的认证说明；CLI 成功不等于其他环境自动成功。日志先脱敏再交给 [客服](/contact)。

[排错顺序](/guide/troubleshooting) · [备份与恢复](/guide/recovery)

## 参考与验证状态

配置字段依据 [Claude Code settings](https://code.claude.com/docs/en/settings)和 [LLM gateway](https://code.claude.com/docs/en/llm-gateway)。2026-09-08 文档核对；未在用户设备或本站真实 API 上实测。
