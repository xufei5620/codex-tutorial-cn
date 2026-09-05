# OpenCode 配置教程

OpenCode 是开源的终端 AI 编程工具，支持自定义 OpenAI 兼容接口，三个系统都能用。

## 1. 安装

先完成 [Node.js 安装](/clients/nodejs)，然后：

::: code-group

```powershell [Windows]
npm install -g opencode-ai
```

```bash [macOS]
npm install -g opencode-ai
# 或：brew install sst/tap/opencode
```

```bash [Linux]
npm install -g opencode-ai
# 或：curl -fsSL https://opencode.ai/install | bash
```

:::

```bash
opencode --version
```

显示版本号即安装成功。

## 2. 写配置文件

配置文件是 `opencode.json`，放在全局目录（对所有项目生效）：

::: code-group

```powershell [Windows]
# 文件路径：%USERPROFILE%\.config\opencode\opencode.json
mkdir -Force $env:USERPROFILE\.config\opencode | Out-Null
notepad $env:USERPROFILE\.config\opencode\opencode.json
```

```bash [macOS]
mkdir -p ~/.config/opencode
open -e ~/.config/opencode/opencode.json
```

```bash [Linux]
mkdir -p ~/.config/opencode
nano ~/.config/opencode/opencode.json
```

:::

文件内容（三个系统一样）：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "xingmang": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "星芒AI",
      "options": {
        "baseURL": "%%BASE_URL%%/v1",
        "apiKey": "换成你在%%SITE_NAME%%创建的%%KEY_WORD%%"
      },
      "models": {
        "gpt-5.4": {
          "name": "GPT-5.4",
          "limit": { "context": 400000, "output": 128000 }
        }
      }
    }
  },
  "model": "xingmang/gpt-5.4"
}
```

- `models` 里可以按需多加几个，键名就是模型名，以 [可用渠道](%%MODELS_URL%%) 为准。
- `model` 是默认模型，格式是 `提供商ID/模型名`。

::: details 用 Claude 模型
如果密钥所在分组是 Claude 模型，再加一个提供商：

```json
"claude-xm": {
  "npm": "@ai-sdk/anthropic",
  "name": "星芒AI Claude",
  "options": {
    "baseURL": "%%BASE_URL%%/v1",
    "apiKey": "换成你在%%SITE_NAME%%创建的%%KEY_WORD%%"
  },
  "models": { "claude-opus-4-1": { "name": "Claude Opus" } }
}
```

模型名同样以可用渠道页为准。部分分组只允许 Claude Code 客户端调用（报错 `this group only allows Claude Code`），那类分组请用 [Claude Code](/clients/claude-code)。
:::

::: details 提示接口不支持 chat/completions？
少数分组只提供 Responses 接口。把 `"npm": "@ai-sdk/openai-compatible"` 改成 `"npm": "@ai-sdk/openai"` 再试。
:::

## 3. 运行

在项目目录里执行：

```bash
opencode
```

输入 `/models` 可以切换模型。项目目录下也可以放一份 `opencode.json` 覆盖全局配置。

调不通时对照 [错误码对照](/errors)，或把完整报错发给[客服](/contact)。官方配置说明：[opencode.ai/docs/providers](https://opencode.ai/docs/providers/)。
