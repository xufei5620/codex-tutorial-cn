---
title: VS Code 里怎么使用 AI 工具
description: 区分编辑器终端、具体扩展与远程环境，不假定配置自动通用。
---
# VS Code 里怎么使用 AI 工具

VS Code 是编辑器。可以在它的集成终端运行 CLI，也可以使用具体产品的扩展；这两种方式的配置和权限要分别确认。

## 1. 最直接的方式：集成终端

打开一个不含敏感资料的练习文件夹，在集成终端运行已经配置好的 [Codex](/clients/codex)、[Claude Code](/clients/claude-code)或 [Gemini CLI](/clients/gemini-cli)。

确认终端的工作目录和执行环境。连接 WSL、容器或远程服务器时，真正运行命令的地方可能不是本机，安装与配置也需要在对应环境中核对。

## 2. 使用扩展

从编辑器的扩展市场检查发布者、安装量不能代替来源核验。对具体扩展，阅读其当前认证与配置说明，不承诺所有扩展都复用同一份 CLI 设置。

模型提供方、API 基址、Key 输入位置和配置优先级，以该扩展的实际版本为准。只有扩展明确支持本站对应协议时才填写本站信息。

## 3. 先验证，再使用项目功能

完成 [小请求验证](/guide/verify)，核对实际调用服务。然后按照 [文件夹练习](/learn/working-with-files)先只读理解，再限定一次写入。

补全、聊天、Agent、代码审阅可能采用不同认证或额度，不把一项成功等同于全部功能都可用。

## 4. 排错

检查当前窗口是本机还是远程；配置属于用户还是工作区；图形进程是否读取新的环境变量。保存设置后可能需要重启窗口或对应进程。

不需要为每个 IDE 品牌重复制作一个虚构工具。Cursor 另有 [专门说明](/clients/cursor)，它的内置能力不能简单当作 VS Code 加一个插件。

参考：[VS Code 集成终端](https://code.visualstudio.com/docs/terminal/basics)、[远程开发](https://code.visualstudio.com/docs/remote/remote-overview)。未声称所有第三方扩展均已通过本站接入测试。
