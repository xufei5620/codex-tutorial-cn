# 注册、订阅与密钥

官网地址：<https://api.solov.cc>。下面三步做完，就可以去配置客户端了。

## 第一步：注册账号

打开 [注册页面](https://api.solov.cc/register?aff=4S8SJZSEBD4F)，用邮箱注册并登录。

![注册页面](/img/image-32.png)

::: tip 只允许 QQ 邮箱注册
目前只允许 QQ 邮箱注册。用其他邮箱会提示"该邮箱域名无法注册新账户"，如需使用企业邮箱，请[联系客服](/contact)加入白名单。
:::

## 第二步：兑换或购买订阅

拿到发货的兑换码后，进入左侧「兑换」页面输入兑换码；也可以直接在「充值/订阅」页面购买。

![兑换页面](/img/image-11.png)

![充值 / 订阅页面](/img/image-26.png)

::: tip 到账时间
支付成功后一般 1 分钟内自动到账。超过 10 分钟仍未到账，请把订单号和注册邮箱发给[客服](/contact)。
:::

## 第三步：创建密钥

进入左侧「API 密钥」页面，点击创建。

![API 密钥页面](/img/image-7.png)

![创建密钥](/img/image-5.png)

::: warning 分组一定要选对
**分组（Group）决定了这把密钥能调用哪一批模型。** 不同分组对应不同的套餐和额度，创建密钥时请按你购买的套餐选择分组。

一个账号可以创建多个密钥，每把密钥绑定一个分组，互不影响。
:::

创建完成后把密钥保存好，后面配置客户端都要用到。

::: danger 请保管好密钥
不要把密钥发给别人或提交到公开仓库。如果怀疑泄露，立即在「API 密钥」页面停用旧密钥，再重新创建一把。
:::

## 下一步

- 想省事：[下载星芒AI管理工具](/guide/download)，一键写入 Codex / Claude / Gemini / Grok 的配置。
- 想手动配：按客户端选择教程 —— [Codex](/clients/codex) · [Claude Code](/clients/claude-code) · [Gemini CLI](/clients/gemini-cli) · [OpenClaw](/clients/openclaw)。
- 想先看能用哪些模型：[可用模型与倍率](/guide/models)。
