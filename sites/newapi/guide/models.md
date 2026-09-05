# 模型、分组与定价

模型列表和价格会随上游变化，**以站内页面为准**，教程里出现的模型名只是示例。

- 模型与价格：[定价页](https://xm.solov.cc/pricing)
- 每次调用的扣费明细：[控制台 → 日志](https://xm.solov.cc/console/log)

## 令牌、分组、模型的关系

- 每把令牌绑定一个分组，分组决定这把令牌能调用哪些模型、按什么倍率计费。
- 客户端里填的模型名必须在该分组的可用列表里，否则会返回"无可用渠道"或"无权使用该模型"，见[错误码对照](/errors)。
- 同一个账号可以创建多把令牌、绑定不同分组，按需切换。

## 费用怎么算

按每次调用实际消耗的 token 数 × 模型单价 × 分组倍率扣费。输入、输出、缓存命中的单价不同，定价页都有列出。余额不足时请求会被拒绝（403 / `insufficient balance`），充值后即可继续。

## 常用客户端里怎么改模型名

| 客户端 | 改哪里 |
|---|---|
| Codex | `~/.codex/config.toml` 里的 `model` 与 `review_model` |
| Claude Code | `~/.claude/settings.json` 里的 `model` |
| Gemini CLI | `~/.gemini/.env` 里的 `GEMINI_MODEL` |
| OpenCode | `~/.config/opencode/opencode.json` 里 `models` 与 `model` |
| Cline / Continue | 扩展设置里的 Model ID |
