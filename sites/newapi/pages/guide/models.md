# 模型、分组与定价

模型列表和价格会随上游变化，**以站内页面为准**，教程里出现的模型名只是示例。

- 模型与价格：[定价页](https://xm.solov.cc/pricing)
- 模型总览：[模型页](https://xm.solov.cc/models)
- 每次调用的扣费明细：[日志](https://xm.solov.cc/usage-logs)

## 令牌、分组、模型的关系

- 每把令牌绑定一个**分组**，分组决定这把令牌能调用哪些模型、按什么倍率计费。
- 客户端里填的模型名必须在该分组的可用列表里，否则会返回"无可用渠道"或"无权使用该模型"，见[错误码对照](/errors)。
- 同一个账号可以创建多把令牌、绑定不同分组，按需切换；换分组就是换一把令牌。
- 令牌上还能单独设「模型限制」，进一步收窄这把令牌可用的模型。

## 费用怎么算

每次调用的扣费 =（输入 token × 输入单价 + 输出 token × 输出单价）× 分组倍率。

- 输入、输出、缓存命中的单价不同，定价页都有列出。
- 命中缓存的部分按缓存价计费，通常比输入价便宜很多，长对话反复带同样上下文时省钱。
- 扣的是**账户余额**；如果这把令牌设了额度上限，会同时扣令牌额度，任意一个用尽都会被拒绝。
- 余额不足时请求返回 403，充值后即可继续。

## 常用客户端里怎么改模型名

| 客户端 | 改哪里 |
|---|---|
| Codex | `~/.codex/config.toml` 里的 `model` 与 `review_model` |
| Claude Code | `~/.claude/settings.json` 里的 `model` |
| Gemini CLI | `~/.gemini/.env` 里的 `GEMINI_MODEL` |
| OpenCode | `~/.config/opencode/opencode.json` 里 `models` 与 `model` |
| Cline / Continue | 扩展设置里的 Model ID |
| Hermes Agent | `~/.hermes/config.yaml` 里的 `model.default` |

::: tip 模型名要写全
写错一个字符就会返回"模型不存在"或"无可用渠道"。到[定价页](https://xm.solov.cc/pricing)复制准确名称，不要凭记忆写别名。
:::
