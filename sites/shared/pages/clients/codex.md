---
title: OpenAI / Codex 接入教程
description: 区分官方账号与本站 API 接入，用最小配置验证 Codex。
---
# OpenAI / Codex 接入教程

本篇先讲 Codex CLI 的本站接入。桌面应用、IDE 扩展与命令行是不同使用入口，具体名称和功能以安装版本的官方说明为准；不能把某一入口配置成功当作所有入口都已适配。

[想先了解怎么使用？阅读零基础课程](/learn/codex/)；不想手动配置可先看 [管理工具说明](/guide/manager)。

## 1. 安装与准备

使用 [官方 CLI 安装说明](https://developers.openai.com/codex/cli/)。采用 npm 方式时，先完成 [Node.js 准备](/clients/nodejs)：

```text
npm install -g @openai/codex
codex --version
```

准备当前%%KEY_WORD%%、允许的模型 ID，并确认分组支持 Codex 所需的 Responses 协议。官方 ChatGPT 登录与本站 API 密钥是两条不同认证路径，不能把网站密码当作 API Key。

## 2. 备份并编辑配置

用户配置通常位于 `~/.codex/config.toml`；Windows 对应 `%USERPROFILE%\.codex\config.toml`。已有配置先备份，退出正在运行的客户端，只修改必要字段，不覆盖整个目录。

```toml
model_provider = "xingmang"
model = "REPLACE_WITH_MODEL_ID"

[model_providers.xingmang]
name = "星芒 AI"
base_url = "%%CODEX_BASE_URL%%"
wire_api = "responses"
env_key = "XINGMANG_API_KEY"
```

模型 ID 从 [本站列表](%%MODELS_URL%%)选择。本例不写入固定的超大上下文、推理等级或压缩阈值。已存在同名 TOML 表时合并内容，不重复添加。

::: warning 先确认基址
此处基址来自本站教程配置，仍需与实际渠道核对。客户端通常在基址后拼接具体请求路径；不要同时把 `/responses` 写入基址，也不要盲目添加或删除 `/v1`。路径报错时核对最终请求 URL，而不是反复更换 Key。
:::

## 3. 在当前终端提供认证

`env_key` 指定环境变量名称，不是把密钥本身写进这个字段。可以在可信的系统环境变量界面配置 `XINGMANG_API_KEY` 后重开终端；不要把真实密钥写入教程、截图或共享项目。

Windows PowerShell 可用隐藏输入，避免将密钥直接写入命令历史：

```powershell
$secret = Read-Host "请输入本站 API Key" -AsSecureString
$env:XINGMANG_API_KEY = [System.Net.NetworkCredential]::new('', $secret).Password
codex
```

上面仅设置当前终端环境变量。不要输出变量值用于排错。退出测试后关闭该终端即可结束本次临时设置。

macOS / Linux 使用 Bash 时可以在同一终端隐藏输入并启动：

```bash
read -r -s -p "请输入本站 API Key: " XINGMANG_API_KEY
printf '\n'
export XINGMANG_API_KEY
codex
```

该段是 Bash 语法。使用 zsh 等其他终端时，按终端自己的隐藏输入语法或系统环境变量管理方式设置同名变量，不要照抄不兼容选项。

## 4. 验证连接和实际路径

按 [验证第一次调用](/guide/verify)完成文本测试和本站记录核对。出现认证错误时检查变量是否被当前进程读取；出现路径错误时检查基址；模型不允许时检查分组和精确 ID。

终端里的临时环境变量不会自动改变已经打开的图形客户端。桌面端、远程环境或扩展的配置位置与认证方式，需要分别按当前官方说明确认。

## 5. 连接之后怎么用

从 [第一次任务](/learn/first-task)开始练习提需求，再学习 [文件夹操作](/learn/working-with-files)和 [结果检查](/learn/review-and-revise)。需要完整学习路线时进入 [11 章课程](/learn/codex/)。

## 参考与验证状态

[官方 CLI](https://developers.openai.com/codex/cli/) · [高级配置](https://developers.openai.com/codex/config-advanced/)。2026-09-08 文档核对；本站端点与不同客户端版本仍需实测，未执行真实 API 请求。
