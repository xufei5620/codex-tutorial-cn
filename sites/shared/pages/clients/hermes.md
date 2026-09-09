---
title: Hermes Agent 接入教程
description: 优先使用当前版本配置向导，区分模型认证、本地工作区和外部连接。
---
# Hermes Agent 接入教程

Hermes Agent 是 Nous Research 的智能体工具。终端、桌面或其他入口按当前版本分别使用，不把“支持自定义模型”描述成本站所有功能都已经测试通过。

## 1. 安装并确认版本

从 [Hermes 官方项目](https://github.com/NousResearch/hermes-agent)选择适合系统的安装方式。阅读安装脚本或安装包说明，使用普通用户权限开始，不从未经确认的第三方页面下载同名工具。

安装后按照官方帮助检查版本。先不要开启消息平台网关、定时任务或陌生插件，完成模型连接后再逐项增加功能。

## 2. 使用模型配置向导

```text
hermes model
```

在当前版本支持的自定义提供方选项中配置：

| 内容 | 填写原则 |
| --- | --- |
| API base URL | 采用本站支持的协议地址；常见 OpenAI 兼容形式为 `%%BASE_URL%%/v1` |
| API key | [本站](%%KEYS_URL%%)创建的%%KEY_WORD%% |
| Model | [本站模型页](%%MODELS_URL%%)允许的精确模型 ID |

向导选项随版本变化，以当前提示和官方提供方文档为准。没有适用的自定义入口时先核对版本，不自行编造 YAML 字段。

## 3. 保留配置和权限边界

使用实际配置目录，改动前备份。不要将密钥复制到公共项目，也不要在没有理解作用时同时改动模型、网关、外部账户和任务调度。

桌面端的配置作用域可能与启动它的终端不同；分别查看实际提供方和认证来源，不假定自动共享。

## 4. 验证后再执行任务

按 [验证第一次调用](/guide/verify)确认文本与本站记录，再对独立练习目录做只读任务。外部消息发送、文件修改与插件执行都需要单独理解和授权。

遇到问题提供版本、模型和脱敏错误，先看 [排错顺序](/guide/troubleshooting)。

官方参考：[配置说明](https://hermes-agent.nousresearch.com/docs/user-guide/configuration)、[提供方](https://hermes-agent.nousresearch.com/docs/integrations/providers)。2026-09-08 文档核对，未实测本站请求。
