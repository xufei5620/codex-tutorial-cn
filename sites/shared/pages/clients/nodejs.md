---
title: Node.js 与终端准备
description: 仅为需要 npm 的安装方式准备运行环境，不放宽整机权限。
---
# Node.js 与终端准备

并非每个 AI 工具都必须先装 Node.js。只有所选安装方式使用 npm，或工具明确要求时才需要。版本要求先看对应工具的当前官方说明。

## 1. 选择系统对应的安装方式

从 [Node.js 官方下载页](https://nodejs.org/en/download)获取符合工具要求的受支持版本。Windows 核对系统架构，macOS 核对 Apple 或 Intel 芯片。已经使用版本管理器时，继续按它自己的安装方式管理，不重复覆盖系统环境。

不要因教程截图的页面位置变化而选择不明来源的安装包。安装完成后重开终端。

## 2. 检查命令

```text
node --version
npm --version
```

显示版本号只说明命令可用；还需对照目标工具的最低版本要求。找不到命令时检查安装路径、当前用户和终端是否重开，WSL 或远程环境应在实际运行的位置分别检查。

## 3. Windows 脚本策略报错

PowerShell 提示 `npm.ps1` 不能运行时，可先尝试 `npm.cmd --version`，再使用 `npm.cmd` 执行对应安装命令。这不需要更改整机执行策略。

不要把管理员运行、全局放宽执行策略或关闭防护作为固定准备步骤。企业管理设备遵循管理员策略。

## 4. 权限与 npm 源

出现 EACCES 等权限问题时，按 [npm 官方建议](https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally)处理用户级安装目录或版本管理器，不直接给所有安装命令加 sudo。

```text
npm config get registry
```

先了解当前源的用途再修改。没有特殊需求时使用官方源；不要为了一个工具强制改变所有项目的全局下载来源。使用镜像需要确认可信性和同步状态。

## 下一步

回到 [工具选择](/guide/choose-tool)，只安装当前需要的工具，完成小请求验证后再继续。

参考：[Node.js 下载](https://nodejs.org/en/download)、[npm 权限排错](https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally)。本页不包含实机安装记录。
