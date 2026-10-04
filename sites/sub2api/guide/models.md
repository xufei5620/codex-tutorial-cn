# 可用模型与倍率

模型列表和倍率会随上游变化，**以站内页面为准**，教程里出现的模型名只是示例。

- 实时可用模型：[可用渠道](https://api.solov.cc/available-channels)
- 模型广场（按分组查看）：[模型广场](https://api.solov.cc/models)

## 分组与模型的关系

- 每把密钥绑定一个分组，分组决定这把密钥能调用哪些模型。
- 客户端里填的模型名必须在该分组的可用列表里，否则会返回 503 或"模型不支持"，见[错误码对照](/errors)。
- 同一个账号可以创建多把密钥、绑定不同分组，按需切换。

## 倍率怎么理解

倍率是相对于官方价格的计费系数。例如某模型倍率 1.0，表示消耗按官方价格原样计入；订阅套餐则按套餐额度扣减。具体以「可用渠道」页面显示为准，有疑问可[联系客服](/contact)。

## 常用客户端里怎么改模型名

| 客户端 | 改哪里 |
|---|---|
| Codex | `~/.codex/config.toml` 里的 `model` 与 `review_model` |
| Claude Code | `~/.claude/settings.json` 里的 `model` |
| Gemini CLI | `~/.gemini/.env` 里的 `GEMINI_MODEL` |
| OpenClaw | `~/.openclaw/openclaw.json` 里 `models` 与 `agents.defaults.model` |
