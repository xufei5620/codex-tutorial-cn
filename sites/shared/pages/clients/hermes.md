# Hermes Agent 配置教程

Hermes Agent 是 Nous Research 开源的终端智能体，支持接入任意 OpenAI 兼容接口。

## 1. 安装

::: code-group

```powershell [Windows]
# 原生 Windows，在 PowerShell 里执行：
iex (irm https://hermes-agent.nousresearch.com/install.ps1)
# 也可以到官网下载 Hermes Desktop 安装包
```

```bash [macOS]
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
source ~/.zshrc
# 也可以到官网下载 Hermes Desktop 安装包
```

```bash [Linux]
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
source ~/.bashrc
```

:::

安装脚本会自动处理 Python、Node.js 等依赖。装完运行 `hermes --version` 确认。

## 2. 接入星芒AI

### 方式一：向导（推荐）

```bash
hermes model
```

按提示选择 **Custom endpoint（self-hosted / vLLM / etc.）**，依次填写：

| 提示 | 填什么 |
|---|---|
| API base URL | `%%BASE_URL%%/v1` |
| API key | 你在%%SITE_NAME%%创建的%%KEY_WORD%% |
| Model name | 例如 `gpt-5.4`（以 [可用渠道](%%MODELS_URL%%) 为准） |

向导会把配置写进 `~/.hermes/config.yaml` 和 `~/.hermes/.env`。

### 方式二：直接改配置文件

编辑 `~/.hermes/config.yaml`（Windows 建议用方式一，由向导写入），`model` 一节改成：

```yaml
model:
  default: gpt-5.4
  provider: custom
  base_url: %%BASE_URL%%/v1
  api_key: 换成你在%%SITE_NAME%%创建的%%KEY_WORD%%
```

::: warning 注意带 /v1
Hermes 的 `base_url` 要带 `/v1`，和 Codex / Claude Code 配置里不带 `/v1` 的写法不同。
:::

## 3. 运行

```bash
hermes
```

对话中可以用 `/model` 切换模型。其他功能（工具、消息平台网关）用 `hermes setup` 打开完整向导。

调不通时对照 [错误码对照](/errors)，或把完整报错发给[客服](/contact)。官方配置文档：[hermes-agent.nousresearch.com/docs/user-guide/configuration](https://hermes-agent.nousresearch.com/docs/user-guide/configuration)。
