# Codex 配置教程

适用于 Codex CLI、Codex 桌面端，以及 VS Code / Cursor / Windsurf / Kiro 里的 Codex 扩展。三者共用同一份配置文件，配一次全部生效。

::: tip 不想手动改文件？
用 [星芒AI管理工具](/guide/download) 一键写入即可，下面的步骤是手动配置方式。
:::

## 1. 安装 Codex CLI

先完成 [Node.js 安装](/clients/nodejs)，然后：

```powershell
npm install -g @openai/codex
```

```powershell
codex --version
```

显示版本号即安装成功。已经装过的跳过。

## 2. IDE 扩展（可选）

只用命令行的可以跳过这一步。在 VS Code / Cursor / Windsurf / Kiro 的扩展市场里搜索 **Codex** 安装：

![在 IDE 扩展市场安装 Codex](/img/shared/image-16.png)

其他 IDE 同理。扩展和 CLI 共用下面第 3 步的配置文件，配一次都生效；VS Code 里的更多用法见 [VS Code 里怎么用](/clients/vscode)。

## 3. 修改配置文件

**先关闭正在运行的 Codex**（CLI、桌面端、IDE 扩展都关掉）。

打开配置目录：

::: code-group

```powershell [Windows]
# 按 Win + R，输入 %USERPROFILE%\.codex 回车；或在 PowerShell 里执行
explorer $env:USERPROFILE\.codex
```

```bash [macOS]
open ~/.codex
```

```bash [Linux]
xdg-open ~/.codex      # 或直接编辑：nano ~/.codex/config.toml
```

:::

![.codex 目录](/img/shared/image.png)

目录里有两个文件要改：`auth.json` 和 `config.toml`，**没有就新建**（目录不存在说明 Codex 还没运行过，先运行一次 `codex` 再退出）。之前配置过的建议先备份一份。三个系统的文件内容完全一样。

### auth.json

只能是下面这个格式，只有 `OPENAI_API_KEY` 一项：

```json
{
  "OPENAI_API_KEY": "换成你在%%SITE_NAME%%创建的%%KEY_WORD%%"
}
```

### config.toml

把接口配置改成下面这样，**放在文件开头**：

```toml
model_provider = "mycodex"
model = "gpt-5.4"
review_model = "gpt-5.4"
model_reasoning_effort = "xhigh"
disable_response_storage = true
network_access = "enabled"
windows_wsl_setup_acknowledged = true
model_context_window = 1000000
model_auto_compact_token_limit = 900000

[model_providers.mycodex]
name = "mycodex"
base_url = "%%BASE_URL%%"
wire_api = "responses"
requires_openai_auth = true
```

::: warning 只改这四项，其他别动
可以按需修改的只有 `model`、`model_reasoning_effort`、`model_context_window`、`model_auto_compact_token_limit`。模型名请以 [可用渠道](%%MODELS_URL%%) 页面为准。
:::

## 4. 重启

- 用 Codex 桌面端：完全退出后重新打开（Windows 在托盘图标右键退出，macOS 按 ⌘Q）。

  ![重启 Codex 桌面端](/img/shared/image-6.png)

- 用 CLI 或 IDE 扩展：重启终端 / IDE。

配置成功后的效果：

![Codex CLI](/img/shared/image-14.png)

![Codex 桌面端](/img/shared/image-4.png)

![IDE 扩展](/img/shared/image-41.png)

![对话效果](/img/shared/image-37.png)

![对话效果](/img/shared/image-31.png)

## 调不通？

按顺序检查：

1. `base_url` 是否是 `%%BASE_URL%%`（没有多余的 `/v1`）；
2. 密钥是否复制完整、是否已启用；
3. 密钥的分组是否包含你填的模型；
4. `config.toml` 是否保存成功、是否放在文件开头；
5. Codex 是否已经完全重启。

仍然报错，对照 [错误码对照](/errors) 处理，或把完整报错文案发给[客服](/contact)。
