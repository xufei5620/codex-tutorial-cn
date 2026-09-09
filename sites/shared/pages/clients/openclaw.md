---
title: OpenClaw 接入与本地使用
description: 从官方项目开始，保留本地访问和权限边界，区分历史社区分支。
---
# OpenClaw 接入与本地使用

本篇对应 [OpenClaw 官方项目](https://docs.openclaw.ai/start/getting-started)。过去使用过 `openclaw-cn` 等社区分支的用户，应先核对来源、版本和迁移说明，不能认为包名、命令与配置完全相同。

## 1. 安装与初始化

按当前官方安装指南选择系统对应的方法，核对运行环境和依赖版本。不要把管理员权限或 sudo 用作所有安装问题的默认答案，也不需要为了配置 OpenClaw 先安装无关的 OpenCode。

首次使用选择自己的练习目录，保留默认访问保护。按向导确认模型提供方、认证和本地运行方式；不同版本的提示可能变化，不把旧截图里的每一步当作固定界面。

## 2. 选择本站兼容的提供方

准备 [本站密钥](%%KEYS_URL%%)和允许的 [模型 ID](%%MODELS_URL%%)，确认工具提供方支持当前渠道协议。OpenAI Chat Completions、Responses 和 Anthropic 请求方式要分别匹配。

只有向导明确要求 OpenAI 兼容 Base URL 时，才按本站对应协议说明填写，例如 `%%BASE_URL%%/v1`。不要复制其他工具的完整请求端点。

## 3. 不覆盖整份配置

保留向导生成的工作目录、网关认证与当前版本信息。只编辑需要的模型和提供方字段，修改前备份。

不要复制旧配置中的版本号、固定价格、上下文长度或网关 token。配置中的展示费用也不等于本站实际扣费。

## 4. 先在本机验证

使用向导或当前官方帮助给出的本地界面入口，检查实际端口和认证方式。首次练习不公开绑定所有网络接口，不把本地网关直接暴露到公网。

先完成 [文本验证](/guide/verify)，再逐项测试所需工具。连接成功后仍需检查每项操作权限；安装插件或连接外部聊天平台属于额外授权，不是完成本站接入的必要条件。

## 5. 更新、排错和恢复

记录 OpenClaw 版本、提供方配置和所用插件。更新前备份，出现不兼容时按对应版本文档处理，不盲目执行另一分支的命令。

[排错顺序](/guide/troubleshooting) · [备份恢复](/guide/recovery) · [本站客服](/contact)

官方参考：[Getting started](https://docs.openclaw.ai/start/getting-started)、[模型提供方](https://docs.openclaw.ai/concepts/model-providers)。未进行真实模型和外部平台连接测试。
