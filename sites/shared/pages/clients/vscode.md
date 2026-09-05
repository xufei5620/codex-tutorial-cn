# VS Code 里怎么用

VS Code（以及 Cursor、Windsurf、Kiro 这类基于 VS Code 的编辑器）有两类接法：

- **官方扩展**：Codex、Claude Code、Gemini CLI 各自的 VS Code 扩展，它们直接复用命令行工具的配置，按对应教程配好命令行版本，扩展就能用。
- **通用 AI 扩展**：Cline、Continue 这类支持"OpenAI 兼容接口"的扩展，在扩展设置里填接口地址和密钥即可。

三个系统的操作相同，差别只在配置文件路径（见各教程的 Windows / macOS / Linux 标签）。

## Codex 扩展

1. 先按 [Codex 教程](/clients/codex) 配好 `~/.codex/auth.json` 和 `config.toml`。
2. 扩展市场搜索 **Codex**（发布者 OpenAI）安装。

   ![安装 Codex 扩展](/img/shared/image-16.png)

3. 重启 VS Code，侧边栏出现 Codex 图标即可开始对话。扩展和 CLI 共用同一份配置，不需要再填密钥。

## Claude Code 扩展

1. 先按 [Claude Code 教程](/clients/claude-code) 安装 `claude` 命令行并配好 `~/.claude/settings.json`。
2. 扩展市场搜索 **Claude Code**（发布者 Anthropic）安装。
3. 重启 VS Code。扩展会调用本机的 `claude` 命令，接口地址和密钥都从 `settings.json` 读取。

::: tip
在 VS Code 内置终端里直接运行 `claude` 也可以，效果和扩展一致，还能识别当前打开的文件。
:::

## Gemini CLI

Gemini CLI 主要在终端里用。在 VS Code 内置终端运行 `gemini`，配合扩展市场里的 **Gemini CLI Companion** 扩展可以感知当前编辑器上下文（教程里 `settings.json` 的 `"ide": {"enabled": true}` 就是为它准备的）。配置见 [Gemini CLI 教程](/clients/gemini-cli)。

## Cline（OpenAI 兼容接口）

1. 扩展市场安装 **Cline**。
2. 打开 Cline 面板右上角的设置（⚙️），按下面填写：

| 设置项 | 填什么 |
|---|---|
| API Provider | **OpenAI Compatible** |
| Base URL | `%%BASE_URL%%/v1` |
| API Key | 你在%%SITE_NAME%%创建的%%KEY_WORD%% |
| Model ID | 例如 `gpt-5.4`（以 [可用渠道](%%MODELS_URL%%) 为准） |

3. 保存后即可对话。Roo Code 等 Cline 系扩展的填法相同。

::: warning 注意带 /v1
这类扩展的 Base URL 要带 `/v1`，和 Codex / Claude Code 配置里不带 `/v1` 的写法不同。
:::

## Continue（OpenAI 兼容接口）

安装 **Continue** 扩展后，打开它的配置文件（侧边栏 Continue 面板 → 设置 → Open config file，即 `~/.continue/config.yaml`），添加一个模型：

```yaml
models:
  - name: 星芒AI GPT-5.4
    provider: openai
    model: gpt-5.4
    apiBase: %%BASE_URL%%/v1
    apiKey: 换成你在%%SITE_NAME%%创建的%%KEY_WORD%%
```

保存后在 Continue 的模型下拉里选它即可。

## 调不通？

1. 通用扩展的 Base URL 是否带了 `/v1`，官方扩展的配置文件里是否**没有**多余的 `/v1`；
2. 模型名是否在密钥所属分组的可用列表里；
3. 改完配置是否重启了 VS Code。

其他报错对照 [错误码对照](/errors)，或把完整报错发给[客服](/contact)。
