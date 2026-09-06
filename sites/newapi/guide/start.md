# 注册、充值与令牌

官网地址：<https://xm.solov.cc>。这是**按量计费**的 API 站：先充值到账户余额，之后每次调用按实际消耗的 token 扣费，不需要订阅，用多少扣多少。

## 第一步：注册账号

打开 [注册页面](https://xm.solov.cc/register)，用邮箱注册并登录。

## 第二步：充值

登录后进入 [钱包](https://xm.solov.cc/wallet)，选择金额支付。余额是账户级的，所有令牌共用。

::: tip 到账时间
支付成功后一般 1 分钟内自动到账。超过 10 分钟仍未到账，请把 **订单号** 和 **注册邮箱** 发给[客服](/contact)。
:::

有兑换码的话，在 [兑换码页面](https://xm.solov.cc/redemption-codes) 输入即可充入余额。

## 第三步：创建令牌

进入 [令牌页面](https://xm.solov.cc/keys)，点击「添加令牌」，几个字段的含义：

| 字段 | 怎么填 |
|---|---|
| 名称 | 随便起，用来区分用途，比如"我的电脑 Codex" |
| 分组 | **决定这把令牌能用哪些模型、按什么倍率计费**，见 [模型、分组与定价](/guide/models) |
| 额度 | 这把令牌最多能花多少。设了上限，泄露时损失可控；不设就跟随账户余额 |
| 过期时间 | 可以不设 |
| 模型限制 | 可选。限定这把令牌只能调用某几个模型 |

创建后复制令牌（`sk-` 开头），后面配置客户端都要用它。

::: danger 请保管好令牌
不要把令牌发给别人或提交到公开仓库。如果怀疑泄露，立即在[令牌页面](https://xm.solov.cc/keys)停用，再重新创建一把。建议给每把令牌设额度上限。
:::

## 接口地址

客户端里的接口地址统一填 `https://xm.solov.cc`，按客户端支持的协议走对应路径：

| 协议 | 路径 | 常见客户端 |
|---|---|---|
| OpenAI 兼容 | `/v1/chat/completions`、`/v1/embeddings`、`/v1/images/generations` | Codex、OpenCode、Cline、Hermes、各类 SDK |
| Anthropic 兼容 | `/v1/messages` | Claude Code |
| Google Gemini 兼容 | `/v1beta/models/{model}:generateContent` | Gemini CLI |

::: warning 带不带 /v1
Codex、Claude Code、Gemini CLI 的配置里填 `https://xm.solov.cc`（**不带** `/v1`，客户端会自己拼路径）；Cline、OpenCode、Hermes 这类通用客户端填 `https://xm.solov.cc/v1`。每篇教程里都写明了，照抄即可。
:::

## 查用量和扣费

- [日志](https://xm.solov.cc/usage-logs)：每次调用的模型、token 数、扣费金额、耗时都能查到。
- [控制台首页](https://xm.solov.cc/dashboard)：余额与近期用量趋势。

## 下一步

- 想省事：[下载星芒AI管理工具](/guide/download)，一键写入 Codex / Claude / Gemini / Grok 的配置。
- 想手动配：[Codex](/clients/codex) · [Claude Code](/clients/claude-code) · [Gemini CLI](/clients/gemini-cli) · [VS Code](/clients/vscode) · [OpenCode](/clients/opencode) · [Hermes Agent](/clients/hermes)。
- 想先看价格：[模型、分组与定价](/guide/models)。
