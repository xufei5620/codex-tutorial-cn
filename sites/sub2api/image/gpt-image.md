# GPT-Image 生图

GPT-Image 生图已经做成网页端，不需要写代码：

<div class="dl-grid">
  <div class="dl-card">
    <div class="os">GPT-Image 网页端</div>
    <div class="meta">支持文生图，模型 gpt-image-2；API 对接文档也在里面</div>
    <a class="btn" href="https://gpt2.solov.cc" target="_blank" rel="noopener noreferrer">打开 gpt2.solov.cc</a>
  </div>
</div>

登录 api.solov.cc 后，左侧菜单「图片生成-gpt2」也能直接进入。

## 效果示例

![GPT-Image 生成效果](/img/gpt-image-sample-1.png)

![GPT-Image 生成效果](/img/image-24.png)

## 常见问题

- **生成失败 / 报错 403**：先确认密钥的分组是否包含 `gpt-image-2`，以及余额或订阅额度是否充足，见[错误码对照](/errors)。
- **需要 API 方式调用**：网页端内附对接文档，按文档里的地址和参数调用即可。
