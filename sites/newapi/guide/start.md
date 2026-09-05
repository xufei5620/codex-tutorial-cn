# 注册、充值与令牌

官网地址：<https://xm.solov.cc>。这是按量计费的 API 站：充值到余额，按每次调用实际消耗扣费，不需要订阅。

## 第一步：注册账号

打开 [注册页面](https://xm.solov.cc/register)，用邮箱注册并登录。

## 第二步：充值

进入 [控制台 → 钱包](https://xm.solov.cc/console/topup) 选择金额支付。

::: tip 到账时间
支付成功后一般 1 分钟内自动到账。超过 10 分钟仍未到账，请把订单号和注册邮箱发给[客服](/contact)。
:::

## 第三步：创建令牌

进入 [控制台 → 令牌](https://xm.solov.cc/console/token)，点击「添加令牌」：

- **名称**：随便起，便于区分用途；
- **分组**：决定这把令牌能用哪些模型、按什么倍率计费，见 [模型、分组与定价](/guide/models)；
- **额度 / 有效期**：可以给单把令牌设上限，泄露时损失可控；不设就跟随账户余额。

创建后复制令牌（`sk-` 开头），后面配置客户端都要用到。

::: danger 请保管好令牌
不要把令牌发给别人或提交到公开仓库。如果怀疑泄露，立即在令牌页停用，再重新创建一把。
:::

## 接口地址

客户端里的接口地址统一填 `https://xm.solov.cc`，按客户端支持的协议走对应路径：

| 协议 | 路径 | 常见客户端 |
|---|---|---|
| OpenAI 兼容 | `/v1/chat/completions`、`/v1/responses`、`/v1/embeddings` | Codex、OpenCode、Cline、Hermes、各类 SDK |
| Anthropic 兼容 | `/v1/messages` | Claude Code |
| Google Gemini 兼容 | `/v1beta/models/{model}:generateContent` | Gemini CLI |

::: warning 带不带 /v1
Codex、Claude Code、Gemini CLI 的配置里填 `https://xm.solov.cc`（不带 `/v1`）；Cline、OpenCode、Hermes 这类通用客户端填 `https://xm.solov.cc/v1`。各教程里都写明了。
:::

## 下一步

- 想省事：[下载星芒AI管理工具](/guide/download)，一键写入 Codex / Claude / Gemini / Grok 的配置。
- 想手动配：[Codex](/clients/codex) · [Claude Code](/clients/claude-code) · [Gemini CLI](/clients/gemini-cli) · [VS Code](/clients/vscode) · [OpenCode](/clients/opencode)。
- 想先看价格：[模型、分组与定价](/guide/models)。
