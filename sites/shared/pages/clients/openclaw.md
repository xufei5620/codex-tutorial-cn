---
title: OpenClaw 接入与本地使用
description: 从官方项目开始，保留本地访问和权限边界，区分历史社区分支。
---
# OpenClaw 接入与本地使用

星芒原文安装的是 `openclaw-cn`，配置文件仍在 `~/.openclaw/openclaw.json`。包名、命令和上游 OpenClaw 不一定相同，不要混用两套说明。

## 1. 安装与初始化

已安装可跳过。按你实际使用的安装包核对版本；不要把管理员权限当成所有安装问题的默认答案。

```text
npm install -g openclaw-cn@latest
openclaw-cn onboard --install-daemon
```

首次向导选本机练习目录，保留默认访问保护。界面加载慢或打不开时，再执行 `openclaw-cn gateway` 后刷新本地页面。

::: tip 本站这一页要填的基址
`%%OPENCLAW_BASE_URL%%`

这是 OpenAI 兼容地址。不要抄 Codex、Claude Code 或 Gemini CLI 的基址，两站也不要互相抄。
:::

## 2. 选择本站兼容的提供方

准备 [本站密钥](%%KEYS_URL%%)和允许的 [模型 ID](%%MODELS_URL%%)。向导若要求 OpenAI 兼容 Base URL，填：

```text
%%OPENCLAW_BASE_URL%%
```

Windows 用 Win+R 打开 `%USERPROFILE%\.openclaw\openclaw.json`；macOS / Linux 对应 `~/.openclaw/openclaw.json`。只改提供方基址、%%KEY_WORD%%和模型，不要整份覆盖向导生成的 workspace、gateway token。

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

模型 ID 从 [本站列表](%%MODELS_URL%%)复制。`baseUrl` 必须是 `%%OPENCLAW_BASE_URL%%`，不要抄原文示例里其他域名。

## 3. 不覆盖整份配置

保留向导生成的工作目录、网关认证与当前版本信息。修改前备份。不要复制别人配置里的价格、上下文长度或 gateway token。

## 4. 先在本机验证

使用向导或当前官方帮助给出的本地界面入口，检查实际端口和认证方式。首次练习不公开绑定所有网络接口，不把本地网关直接暴露到公网。

先完成 [文本验证](/guide/verify)，再逐项测试所需工具。连接成功后仍需检查每项操作权限；安装插件或连接外部聊天平台属于额外授权，不是完成本站接入的必要条件。

## 5. 更新、排错和恢复

改完后重启网关再试：

```text
openclaw-cn gateway restart
```

记录版本、提供方和所用插件。更新前备份，不要混用另一分支的命令。

[排错顺序](/guide/troubleshooting) · [备份恢复](/guide/recovery) · [本站客服](/contact)
