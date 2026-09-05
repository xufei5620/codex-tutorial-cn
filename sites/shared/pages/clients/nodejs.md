# 准备工作：安装 Node.js

Codex CLI、Claude Code、Gemini CLI、OpenCode、OpenClaw 都通过 npm 安装，所以先装 Node.js（LTS 长期支持版）。已经装过的可以跳过本页。

## 1. 安装

::: code-group

```text [Windows]
1. 打开 https://nodejs.org/ ，下载 LTS 版（页面左边那个）的 Windows 安装包（.msi）
2. 双击安装，一路「下一步」，默认选项不用改
3. 安装完成后重新打开 PowerShell
```

```bash [macOS]
# 方式一：到 https://nodejs.org/ 下载 LTS 版的 macOS 安装包（.pkg），双击安装
# 方式二：已装 Homebrew 的直接执行
brew install node
```

```bash [Linux]
# 推荐用 nvm 安装，不需要 sudo，也不会和系统自带的老版本冲突
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc      # zsh 用 source ~/.zshrc
nvm install --lts
```

:::

## 2. 验证

打开命令行（Windows：PowerShell；macOS / Linux：终端），输入：

```bash
node -v   # 查看 Node.js 版本
npm -v    # 查看 npm 版本
```

两条都显示版本号就说明安装成功。

## 3. 各系统常见问题

::: code-group

```powershell [Windows]
# 报错「无法加载文件 … 因为在此系统上禁止运行脚本」时，
# 以管理员身份打开 PowerShell 执行下面一条，然后重开终端：
Set-ExecutionPolicy RemoteSigned

# 还不行就换成只对当前用户生效：
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

```bash [macOS]
# npm install -g 时报 EACCES / permission denied：
# 用 Homebrew 装的 node 一般不会遇到；用 .pkg 装的可以在命令前加 sudo，例如
sudo npm install -g @openai/codex
```

```bash [Linux]
# npm install -g 时报 EACCES：说明用的是系统自带 node，改用上面的 nvm 方式即可，
# 或者在命令前加 sudo。
# 新开终端找不到 node 命令：执行 source ~/.bashrc（或重新登录）让 nvm 生效。
```

:::

![Windows PowerShell 禁止运行脚本的报错](/img/shared/image-1.png)

## 4. npm 源

安装 Claude Code、Gemini CLI 前，先确认 npm 源是官方源：

```bash
npm config get registry
```

返回的不是 `https://registry.npmjs.org/` 时，改回来：

```bash
npm config set registry https://registry.npmjs.org/
```

::: tip OpenClaw 是例外
OpenClaw 的教程里用的是国内镜像 `https://registry.npmmirror.com`，装完 OpenClaw 后如果要再装其他工具，记得按上面的命令改回官方源。
:::

准备好了，去配置客户端：[Codex](/clients/codex) · [Claude Code](/clients/claude-code) · [Gemini CLI](/clients/gemini-cli) · [VS Code](/clients/vscode) · [OpenCode](/clients/opencode) · [Hermes Agent](/clients/hermes) · [OpenClaw](/clients/openclaw)
