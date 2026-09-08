---
title: OpenCode 接入教程
description: 匹配提供方与协议，保留配置并验证实际调用。
---
# OpenCode 接入教程

本篇讲自定义模型提供方。终端、桌面和远程环境应分别核对配置位置，不假定同一份设置会自动作用于所有进程。

## 1. 安装与确认

按 [官方文档](https://opencode.ai/docs/)选择适合系统的安装方式。使用 npm 时，先确认运行环境符合当前版本要求：

```text
npm install -g opencode-ai
opencode --version
```

## 2. 备份用户配置

用户配置通常位于 `~/.config/opencode/opencode.json`；环境变量和项目配置可能覆盖默认位置。已有文件先备份，只合并需要的提供方字段，不覆盖其他设置。

## 3. 配置自定义提供方

下面是支持 OpenAI Chat Completions 渠道的示例；模型 ID 从 [本站列表](%%MODELS_URL%%)选择：

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

在可信环境中设置 `XINGMANG_API_KEY` 后重启工具，不把真实密钥写入项目或公开配置。不要照抄旧示例的上下文上限和价格。

渠道只支持 Responses 或 Anthropic 时，应按当前官方提供方文档选择相应适配器与字段，并验证本站兼容性。仅更换包名，不等于全部功能通过。

## 4. 启动并验证

在独立练习目录启动，通过当前版本的模型选择功能确认提供方和模型，再完成 [首次调用验证](/guide/verify)。首次文件任务先只读，明确批准后再写入。

不生效时检查配置覆盖关系；路径错误检查协议和基址；模型不允许时检查分组。恢复只作用于明确的文件和字段。

[排错顺序](/guide/troubleshooting) · [备份恢复](/guide/recovery) · [本站客服](/contact)

## 来源与验证状态

[官方提供方说明](https://opencode.ai/docs/providers/) · [配置说明](https://opencode.ai/docs/config/)。未进行本站真实模型调用测试。
