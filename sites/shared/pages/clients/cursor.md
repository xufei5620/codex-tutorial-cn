---
title: Cursor 使用与接入说明
description: 区分编辑器、内置功能、自带 Key 与终端工具的配置。
---
# Cursor 使用与接入说明

Cursor 是代码编辑器。本篇说明自带 API Key 与终端工具两种使用方式，不能把 API Key 支持等同于全部内置能力都能通过中转使用。

## 1. 安装并选择使用方式

从 [Cursor 官网](https://cursor.com/downloads)获取对应版本。只想在编辑器终端使用 Codex 或 Claude Code 时，按各自教程配置即可；这不会把 Cursor 内置模型或补全功能一起改成本站服务。

## 2. 自带 Key 的边界

按当前版本的 Models / API Keys 设置确认支持的提供方和功能。官方厂商 Key 与本站%%KEY_WORD%%不是同一种凭据；只有客户端确实支持对应自定义基址和协议，才尝试填写本站信息。

如果只有官方厂商的 Key 输入框、没有适用的自定义地址选项，不能直接填本站密钥并期待生效。也不要使用破解、修改程序或伪造服务身份来强行接入。

## 3. 配置前核对三项

| 项目 | 核对方式 |
| --- | --- |
| Base URL | 是否允许自定义、需要哪种协议前缀 |
| 模型 ID | 从 [本站模型页](%%MODELS_URL%%)确认当前分组可用名称 |
| 功能范围 | 按 Cursor 当前官方说明确认聊天、Agent、补全等功能分别如何认证和计费 |

配置完成先按 [验证调用](/guide/verify)测试一项明确支持的功能。不要以“设置保存成功”替代真实调用和账单核对。

## 4. 编辑器终端方式

在自己的练习项目中打开集成终端，运行已经安装和配置好的 [Codex](/clients/codex)、[Claude Code](/clients/claude-code)或 [Gemini CLI](/clients/gemini-cli)。终端环境与远程窗口可能不同，配置应跟随实际执行位置。

## 参考与验证状态

[Cursor 官方自带 API Key 说明](https://cursor.com/help/models-and-usage/api-keys)。2026-09-08 文档核对；未将某个版本尚未验证的自定义网关能力标为已支持。
