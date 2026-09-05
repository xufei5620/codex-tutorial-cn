# Gemini CLI 配置教程

::: tip 不想手动改文件？
用 [星芒AI管理工具](/guide/download) 一键写入即可，下面的步骤是手动配置方式。
:::

## 1. 安装 Gemini CLI

先完成 [Node.js 安装](/clients/nodejs)，并确认 npm 源是官方源。然后：

```powershell
npm install -g @google/gemini-cli
```

```powershell
gemini --version
```

显示版本号即安装成功。

## 2. 修改配置文件

**先关闭正在运行的 Gemini CLI。**

打开配置目录（三个系统的文件内容完全一样）：

::: code-group

```powershell [Windows]
# 按 Win + R，输入 %USERPROFILE%\.gemini 回车；或在 PowerShell 里执行
explorer $env:USERPROFILE\.gemini
```

```bash [macOS]
open ~/.gemini
```

```bash [Linux]
xdg-open ~/.gemini     # 或直接编辑：nano ~/.gemini/.env
```

:::

![.gemini 目录](/img/shared/image-44.png)

目录里要有两个文件，没有就新建（目录不存在说明还没运行过，先运行一次 `gemini` 再退出）；之前配置过的建议先备份。

### settings.json

原样写入，不要改：

```json
{
  "ide": {
    "enabled": true
  },
  "security": {
    "auth": {
      "selectedType": "gemini-api-key"
    }
  }
}
```

### .env

换成你的密钥，模型名可以按需修改：

```ini
GOOGLE_GEMINI_BASE_URL=%%BASE_URL%%
GEMINI_API_KEY=换成你在%%SITE_NAME%%创建的%%KEY_WORD%%
GEMINI_MODEL=gemini-3.5-flash
```

模型名以 [可用渠道](%%MODELS_URL%%) 页面为准。

## 3. 启动

```powershell
gemini
```

输入一个问题，AI 回复就说明配置成功：

![对话效果](/img/shared/image-28.png)

## 调不通？

1. `.env` 文件名前面有个点，Windows 上新建时注意不要变成 `.env.txt`（在记事本「另存为」时把文件类型选成"所有文件"）；macOS / Linux 上带点的文件默认隐藏，用终端 `ls -a ~/.gemini` 能看到；
2. `GOOGLE_GEMINI_BASE_URL` 是否是 `%%BASE_URL%%`；
3. 密钥是否完整、已启用，分组是否包含 Gemini 模型；
4. 是否已完全重启。

仍然报错，对照 [错误码对照](/errors)，或把完整报错文案发给[客服](/contact)。
