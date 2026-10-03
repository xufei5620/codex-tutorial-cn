---
title: 星芒 AI 管理工具使用教程
description: 下载管理工具，按引导完成运行环境检查、工具安装和本站配置。
---
# 星芒 AI 管理工具

<p class="manager-lead">从下载安装到第一次使用，在这里完成常用 AI 工具的配置。</p>

<DownloadLink />

<section class="manager-overview" aria-label="管理工具介绍">
<div>
<h2>把安装与配置放在一起</h2>
<p>管理工具会检测运行环境，帮助安装并配置 Codex、Claude Code 等工具。已支持的工具与功能，以你安装的版本为准。</p>
<ul class="manager-capabilities">
<li><strong>检查环境</strong><span>按检测结果补齐需要的运行环境。</span></li>
<li><strong>配置接入</strong><span>确认本站账户与服务地址，再应用配置。</span></li>
<li><strong>查看状态</strong><span>集中查看工具、环境和账户信息。</span></li>
</ul>
</div>
<figure class="yichen-figure">
<img src="/img/shared/guide/manager-home.png" alt="星芒 AI 管理工具首页，列出工具、运行环境和账户信息" width="1024" height="640" loading="lazy">
<figcaption>管理工具首页示意，界面以实际安装版本为准。</figcaption>
</figure>
</section>

## 安装后，按这四步开始

<ol class="manager-steps">
<li><h3>打开管理工具</h3><p>选择系统和芯片，下载安装包并按提示安装。首次启动后，按页面提示确认接入方式。</p></li>
<li><h3>检查运行环境</h3><p>按检测结果完成必要准备，再选择要使用的工具。出现报错时，先查看具体提示。</p></li>
<li><h3>备份并应用配置</h3><p>核对本站服务地址、账户与写入位置，已有配置先备份。按应用提示完成配置，保留自己需要的项目规则。</p></li>
<li><h3>验证第一次调用</h3><p>重新打开目标工具，按照<a href="/guide/verify">验证第一次调用</a>完成一个小任务，并核对控制台记录。</p></li>
</ol>

## 离线包怎么选

先用管理工具内的正常安装方式；遇到网络或安装问题时，再使用上方的桌面端备用包。展开对应文件的「安装说明与校验」，可查看命令和 SHA-256。

- **Codex Windows**：安装包和许可文件都要下载，并保持同版本、同架构。在同一文件夹按管理员 PowerShell 命令安装。
- **Codex Mac**：解压 ZIP，将应用放入“应用程序”后打开。
- **Claude Windows**：完整 MSIX 使用 SkipLicense 安装，无需单独许可文件。
- **Claude Mac**：DMG 与 PKG 都是通用版，支持 Apple 芯片和 Intel；日常安装选 DMG，使用系统安装向导时选 PKG。

安装包下载成功后，仍需完成登录、本站配置及调用验证。中转接入可用的功能，以客户端与本站实际支持情况为准。

## 遇到问题

先核对工具版本、系统和报错信息，再按[错误码与排查](/errors)处理。需要恢复配置时，查看[备份与恢复](/guide/recovery)。

系统提示来源或发布者异常时，先核对文件与来源；不要关闭整机安全保护。仅在明确需要时授权安装操作。

联系[本站客服](/contact)时，请提供版本、系统、发生时间与脱敏错误，不要发送完整密钥或整包配置。

需要手工接入某款工具，可以打开[工具接入](/tools)；首次使用 Codex，可继续学习[Codex 零基础](/learn/codex/)。
