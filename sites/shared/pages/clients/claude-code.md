# Claude Code 配置教程

::: tip 不想手动改文件？
用 [星芒AI管理工具](/guide/download) 一键写入即可，下面的步骤是手动配置方式。
:::

## 1. 安装 Claude Code

先完成 [Node.js 安装](/clients/nodejs)，并确认 npm 源是官方源（方法见该页第 4 节）。然后：

```powershell
npm install -g @anthropic-ai/claude-code
```

```powershell
claude --version
```

显示版本号即安装成功。

## 2. 修改配置文件

**先关闭正在运行的 Claude Code。**

打开配置文件（三个系统的文件内容完全一样）：

::: code-group

```powershell [Windows]
# 按 Win + R，输入 %USERPROFILE%\.claude\settings.json 回车；或在 PowerShell 里执行
notepad $env:USERPROFILE\.claude\settings.json
```

```bash [macOS]
open -e ~/.claude/settings.json      # 用「文本编辑」打开
```

```bash [Linux]
nano ~/.claude/settings.json
```

:::

![.claude 目录](/img/shared/image-23.png)

文件不存在就新建（`.claude` 目录不存在说明还没运行过，先运行一次 `claude` 再退出）；之前配置过的建议先备份。把内容替换成：

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "换成你在%%SITE_NAME%%创建的%%KEY_WORD%%",
    "ANTHROPIC_BASE_URL": "%%BASE_URL%%"
  },
  "permissions": {
    "defaultMode": "bypassPermissions"
  },
  "model": "opus[1m]",
  "effortLevel": "medium",
  "skipDangerousModePermissionPrompt": true
}
```

::: warning
`ANTHROPIC_BASE_URL` 不要动；`model`、`effortLevel`、`permissions` 可以按需修改，不想折腾就用上面这份。模型名以 [可用渠道](%%MODELS_URL%%) 页面为准。
:::

::: tip 分组提示
部分分组只允许 Claude Code 这个客户端调用（报错 `this group only allows Claude Code`），用别的工具调这类分组的密钥会被拒绝，见[错误码对照](/errors)。
:::

## 3. 启动

```powershell
claude
```

![启动 Claude Code](/img/shared/image-19.png)

输入一个问题，AI 回复就说明配置成功：

![对话效果](/img/shared/image-29.png)

## 调不通？

1. `ANTHROPIC_BASE_URL` 是否是 `%%BASE_URL%%`；
2. 密钥是否完整、已启用，分组是否包含 Claude 模型；
3. `settings.json` 是否是合法 JSON（多一个逗号都会失败）；
4. 是否已完全重启。

仍然报错，对照 [错误码对照](/errors)，或把完整报错文案发给[客服](/contact)。
