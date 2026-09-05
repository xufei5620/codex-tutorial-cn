---
aside: false
pageClass: wide
---

# 错误码对照

下面的报错文案全部来自 api.solov.cc 真实返回，按**文案**查最准（同一句话有时会带不同的状态码）。先在客户端的报错里找到引号内的那句英文，再对照下表。

::: warning 这几种错误重试没有用
`API key 额度已用完`、`API Key 所属分组已删除`、`Insufficient account balance`、`this group only allows Claude Code clients`、`Model "…" is not supported … in this group`。它们都需要你改配置或到控制台处理，脚本自动重试只会一直失败。
:::

## 密钥与余额

| 报错文案 | 状态码 | 原因 | 怎么办 |
|---|---|---|---|
| `Invalid API key` | 401 | 密钥错误：复制不完整、多了空格、用了别的站的密钥，或密钥已删除 | 到 [API 密钥](https://api.solov.cc/keys) 重新复制完整密钥 |
| `API key is required in Authorization header (Bearer scheme), x-api-key header, or x-goog-api-key header` | 401 | 请求里根本没带密钥 | 检查客户端的密钥字段是否为空、环境变量是否生效 |
| `API key 额度已用完` | 429 | 这把密钥**自己设置的额度**用完了（不是账户余额） | 到 API 密钥页调高这把密钥的额度，或新建一把 |
| `Insufficient account balance` / `insufficient balance` | 403 | 账户余额不足。余额卡分组走账户余额，订阅卡分组走订阅额度 | 确认密钥分组是否选对；[充值](https://api.solov.cc/purchase)或续订后重试 |
| `API Key 所属分组已删除` | 403 | 这把密钥所属的分组已下线，密钥失效 | 新建一把密钥（选现有分组），更新到客户端；旧密钥不要再用 |

## 分组与模型

| 报错文案 | 状态码 | 原因 | 怎么办 |
|---|---|---|---|
| `No available accounts: this group only allows Claude Code clients` | 503 | 密钥所在分组**只允许 Claude Code 官方客户端**调用，你用的是其他程序、脚本或中转 | 用 Claude Code 本体调用；一定要用别的客户端，就换一把通用分组的密钥 |
| `This group does not allow /v1/messages dispatch` / `This group is restricted to Claude Code clients (/v1/messages only)` | 403 | 分组和接口格式不匹配 | 换对应分组的密钥，或改用分组允许的接口格式 |
| `Model "xxx" is not supported by any configured account in this group` | 404 | 请求的模型名不在这把密钥所属分组里。最常见的是 Claude Code 用别名 `sonnet` / `haiku` 时自动发出的 `claude-sonnet-4-5-20250929` 这类带日期的名称 | 到 [可用渠道](https://api.solov.cc/available-channels) 核对**准确的模型名**填进配置；Claude Code 用户在 `settings.json` 的 `model` 里写准确名称，不要用别名 |
| `No available accounts: no available accounts supporting model: xxx (channel pricing restriction)` | 503 | 这个分组的账号不支持该模型 | 换一个模型，或换包含该模型的分组密钥 |
| `The 'gpt-5.4' model is not supported when using Codex with a ChatGPT account.` | 400 | 上游账号类型不支持这个模型名 | 改用可用渠道页里标注可用的 GPT 模型 |

## 频率与并发

| 报错文案 | 状态码 | 原因 | 怎么办 |
|---|---|---|---|
| `Concurrency limit exceeded for user, please retry later` / `Concurrency limit exceeded for account, please retry later` | 429 | 同时进行的请求数超过了账户或密钥的并发上限 | 关掉多余的会话或线程，等几秒再试；需要更高并发请联系客服 |
| `Too many pending requests, please retry later` | 429 | 排队中的请求太多，服务端暂时拒绝新请求 | 稍等再试，不要高频重试 |
| `Upstream rate limit exceeded, please retry later` | 429 | 上游对本站限流 | 稍后重试 |

## 上游故障（等一会再试）

| 报错文案 | 状态码 | 原因 | 怎么办 |
|---|---|---|---|
| `Upstream service temporarily unavailable` / `Upstream request failed after retries` / `Upstream request failed` | 502 | 上游模型服务暂时故障，本站已自动重试仍失败 | 等 1–5 分钟再试；持续半小时以上看公告或联系客服 |
| `Service temporarily unavailable` | 503 | 本站或上游暂时不可用，多见于 GPT 通道波动 | 稍后重试 |
| `No available accounts: no available accounts` / `All available accounts exhausted` | 503 / 403 / 500 | 账号池暂时没有可用账号 | 稍后重试；持续出现请联系客服 |
| `Upstream access forbidden, please contact administrator` | 502 | 上游拒绝了本站账号的访问，需要站方处理 | 你自己解决不了，把时间和模型名发给[客服](/contact) |
| `Upstream error: 404` | 404 | 上游临时故障 | 稍后重试 |
| `Our servers are currently overloaded. Please try again later.` / `The model is currently at capacity due to high demand…` | 502 / 503 | 上游过载 | 稍后重试 |

## 请求内容问题

| 报错文案 | 状态码 | 原因 | 怎么办 |
|---|---|---|---|
| `Unsupported parameter: xxx` / `Missing required parameter: xxx` / `Failed to parse request body` / `function_call_output requires call_id …` | 400 | 客户端发出的请求参数上游不接受，多为客户端版本或配置问题 | 升级客户端到最新版；自己写的程序请对照官方接口文档去掉不支持的参数 |
| `Invalid schema for response_format '…': … must have a 'type' key` / `'uniqueItems' is not permitted` | 400 | 结构化输出的 JSON Schema 不符合上游要求 | 每个属性都要有 `type`，不要用 `uniqueItems` 等不支持的关键字 |
| `The image data you provided does not represent a valid image.` | 400 | 传的图片数据损坏或格式不对 | 确认 base64 或 URL 有效，格式为 png / jpg / webp |
| `Validation error for field 'prompt': String should have at most 32000 characters` | 422 | 生图提示词超过 32,000 字符 | 缩短提示词 |
| 空白错误，只有 `"type":"upstream_error"` | 422 | 上游（多见于 grok 系列）拒绝了请求内容但没给说明 | 检查工具定义、附件、超长输入；换个模型验证是不是该模型特有 |

## 地址填错

| 报错文案 | 状态码 | 原因 | 怎么办 |
|---|---|---|---|
| `404 page not found` | 404 | 接口地址不存在：常见是多写了一层 `/v1`（变成 `/v1/v1/messages`），或用了旧的 `/v1/completions` | Codex / Claude Code / Gemini CLI 填 `https://api.solov.cc`；Cline、OpenCode、Hermes 这类通用客户端填 `https://api.solov.cc/v1`；不要用 `/v1/completions` |
| `Upstream request failed`（路径是 `/v1/messages/count_tokens`） | 404 | Claude Code 的 token 计数接口本站暂不支持 | 可忽略，不影响对话 |

## 客户端里还可能看到的

这几种发生在请求到达本站之前（网络层或 Cloudflare），日志里看不到，但用户会遇到：

| 报错文案 | 状态码 | 原因 | 怎么办 |
|---|---|---|---|
| `504 Gateway Time-out` | 504 | 上下文压缩返回超时 | 重试几次；还不行就另起新对话，或把 Codex 的上下文调小（见下） |
| `413 Request Entity Too Large` | 413 | 请求体超过接收上限 | 另起一个新对话 |
| `Your request was blocked` / 报错里带 `cf-ray:` | 403 / 503 | 被 Cloudflare 拦截，常见于代理或 IPv6 出口 | 关闭代理用国内环境直连；关闭 IPv6 |

## 504 超时：把 Codex 的上下文调小

`~/.codex/config.toml` 里把这两个值改小，保存后重启：

```toml
model_context_window = 400000
model_auto_compact_token_limit = 300000
```

## 还是解决不了

把**完整报错文案**、使用的模型和大致时间发给[客服](/contact)（每日 9:00–23:00），我们会在日志里定位这次请求。
