# 小龙虾 OpenClaw 配置教程

## 1. 准备

先完成 [Node.js 安装](/clients/nodejs)。OpenClaw 用国内镜像安装更快：

::: code-group

```powershell [Windows]
# 以管理员身份打开 PowerShell 执行
npm config set registry https://registry.npmmirror.com
```

```bash [macOS]
npm config set registry https://registry.npmmirror.com
# 后面的 npm install -g 如果报 permission denied，在命令前加 sudo
```

```bash [Linux]
npm config set registry https://registry.npmmirror.com
# 用 nvm 装的 node 不需要 sudo；系统自带 node 报 EACCES 时在命令前加 sudo
```

:::

::: tip
装完 OpenClaw 之后如果还要装 Claude Code / Gemini CLI，记得把 npm 源改回官方源：`npm config set registry https://registry.npmjs.org/`
:::

## 2. 安装

```powershell
npm install -g opencode-ai
```

![安装 opencode-ai](/img/shared/image-39.png)

```powershell
npm install -g openclaw-cn@latest
```

![安装 openclaw-cn](/img/shared/image-35.png)

## 3. 初始化向导

```powershell
openclaw-cn onboard --install-daemon
```

按向导一步步走，下面是每一步的截图：

![向导 1](/img/shared/image-10.png)

![向导 2](/img/shared/image-17.png)

![向导 3](/img/shared/image-20.png)

![向导 4](/img/shared/image-12.png)

![向导 5](/img/shared/image-3.png)

![向导 6](/img/shared/image-42.png)

![向导 7](/img/shared/image-33.png)

![向导 8](/img/shared/image-34.png)

![向导 9](/img/shared/image-25.png)

![向导 10](/img/shared/image-8.png)

![向导 11](/img/shared/image-30.png)

![向导 12](/img/shared/image-43.png)

![向导 13](/img/shared/image-18.png)

![向导 14](/img/shared/image-15.png)

![向导 15](/img/shared/image-22.png)

![向导 16](/img/shared/image-9.png)

![向导 17](/img/shared/image-36.png)

向导结束后本地浏览器会自动弹出网页，首次启动会慢一点，等界面加载完成。如果没有弹出或访问不成功，运行下面这条命令后刷新网页：

```powershell
openclaw-cn gateway
```

![OpenClaw 网页界面](/img/shared/image-21.png)

## 4. 修改配置文件

打开配置文件（三个系统的文件内容完全一样）：

::: code-group

```powershell [Windows]
# 按 Win + R，输入 %USERPROFILE%\.openclaw\openclaw.json 回车；或在 PowerShell 里执行
notepad $env:USERPROFILE\.openclaw\openclaw.json
```

```bash [macOS]
open -e ~/.openclaw/openclaw.json
```

```bash [Linux]
nano ~/.openclaw/openclaw.json
```

:::

把内容替换成下面这份，**`apiKey`、`workspace`、`token` 三处改成你自己的**：

```json
{
  "meta": {
    "lastTouchedVersion": "0.1.7",
    "lastTouchedAt": "2026-03-16T16:00:00.000Z"
  },
  "wizard": {
    "lastRunAt": "2026-03-04T16:42:05.287Z",
    "lastRunVersion": "0.1.7",
    "lastRunCommand": "doctor",
    "lastRunMode": "local"
  },
  "models": {
    "providers": {
      "gmn": {
        "baseUrl": "%%BASE_URL%%/v1",
        "apiKey": "换成你在%%SITE_NAME%%创建的%%KEY_WORD%%",
        "auth": "api-key",
        "api": "openai-responses",
        "models": [
          {
            "id": "gpt-5.4",
            "name": "GPT-5.4",
            "reasoning": true,
            "input": ["text", "image"],
            "cost": {
              "input": 1.75,
              "output": 14,
              "cacheRead": 0.175,
              "cacheWrite": 0.175
            },
            "contextWindow": 400000,
            "maxTokens": 128000
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "gmn/gpt-5.4"
      },
      "workspace": "换成你的工作目录",
      "compaction": {
        "mode": "safeguard"
      },
      "maxConcurrent": 1,
      "subagents": {
        "maxConcurrent": 1
      }
    }
  },
  "commands": {
    "native": "auto",
    "nativeSkills": "auto"
  },
  "gateway": {
    "port": 18789,
    "mode": "local",
    "bind": "loopback",
    "auth": {
      "mode": "token",
      "token": "换成向导里生成的 token"
    }
  }
}
```

::: warning 注意 baseUrl 带 /v1
OpenClaw 这里的接口地址是 `%%BASE_URL%%/v1`，和 Codex / Claude Code 不带 `/v1` 的写法不一样。模型名以 [可用渠道](%%MODELS_URL%%) 页面为准。
:::

## 5. 重启

```powershell
openclaw-cn gateway
```

![重启后](/img/shared/image-2.png)

常用命令：

```powershell
openclaw-cn dashboard --no-open   # 打印网页地址但不自动打开
openclaw-cn gateway restart       # 重启
openclaw-cn gateway stop          # 停止
```

调不通时对照 [错误码对照](/errors)，或把完整报错文案发给[客服](/contact)。
