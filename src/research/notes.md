# 调研要点（2026-09-01，来自两份子代理报告）

## 产品现状
- 2026-02-02 Codex app macOS 发布；2026-03 Windows 版；2026-07-09 Codex app 并入「ChatGPT 桌面应用」（macOS/Windows），左上角菜单切换 Chat / Work / Codex；旧 ChatGPT 桌面版改名 ChatGPT Classic（无 Codex）。
- 官方文档站 developers.openai.com/codex → 重定向 learn.chatgpt.com；有机器翻译简中版 learn.chatgpt.com/zh-Hans/docs/app。
- 所有 ChatGPT 套餐（Free/Go/Plus/Pro/Business/Enterprise/Edu）含 Codex，额度不同；5 小时滚动窗口 + 每周上限；用量页 chatgpt.com/codex/settings/usage；图片生成消耗 3–5 倍。
- 地区：中国大陆、香港不在支持列表；EEA/UK/CH 部分功能（Computer Use、Memories 等）受限。

## 安装
- 下载：chatgpt.com/download（注意别下成 Classic）。macOS 14+，Apple Silicon 或 Intel（Intel 用 ChatGPT-latest-x64.dmg，Codex 视图完整性未明确）。Windows 通过 Microsoft Store（ID 9PLM9XGG6VKS）；最低 Windows 版本官方未明写（Classic 文档：Win10 17763+）。
- 登录："Continue to sign in" → 浏览器完成；"Sign in another way" 可用 API key。退出：头像菜单 → Log out。
- 首次进入 Codex：左上角菜单选 "Codex"。手机端不能用 Codex（只能 Remote 查看）。
- 权限提示：macOS 访问 Desktop/Downloads 等目录需系统授权；Computer Use 需 Screen Recording + Accessibility。

## 界面
- 侧栏：Chats、Projects、Scheduled、Activity；搜索。
- 输入框下方：模型选择器、权限选择器；新对话可选 Local / Worktree / Cloud。
- 主区：review panel、Terminal、Browser（Cmd/Ctrl+Shift+B）、Actions 按钮。
- Settings：General（Permissions 中启用模式；Prevent sleep）、Profile、Keyboard Shortcuts、Notifications、Appearance、Pets、Browser、Computer Use、Personalization（Enable memories；人格）、Suggested Prompts、Memories、Archived Chats。
- 权限模式（输入框下拉）："Ask for approval"（默认：可读写当前工作区、跑常规命令；上网或出圈前先问）、"Approve for me"（越界请求由 AI 审阅员自动审核并显示风险）、"Full access"（无沙盒无审批，风险最高）、"Custom (config.toml)"。审批弹窗可选 once / per session / permanently。
- 项目：ChatGPT projects（带文件）与 Local projects（连接本机文件夹，可多文件夹，Make primary）。默认只能改所选文件夹内文件。审阅面板看 diff、可 revert（Git 项目）；非 Git 文件夹一键撤销未见官方说明。移除项目：悬停 → ••• → Remove。
- 生成文件预览：文档/PPT/表格/PDF/HTML 在聊天旁预览，支持 Annotations。

## 新功能
- Scheduled tasks（定时任务）：侧栏 Scheduled；自然语言创建；每日/每周/自定义；8 月起支持 Gmail/Slack/GitHub 事件触发；本地任务要求应用保持运行。
- Memories：默认关闭；Settings > Personalization → Enable memories；/memories；存于 ~/.codex/memories/。
- Computer Use：Plugins > Computer Use 安装；Settings > Computer Use 管理；macOS 可后台，Windows 需前台。
- 内置浏览器、图片生成（gpt-image-2）、/goal 长任务、Pets、Voice。

## 插件
- 插件 = 可安装的能力包：Skills + Connectors（连接外部账号，OAuth）+ MCP servers + 浏览器扩展 + Hooks（需信任）+ 定时任务模板。帮助中心三分法：Skills / Connected apps / App templates。
- 入口："Plugins" 标签；目录分组 OpenAI / 工作区 / Personal（Created by me、Shared with me）；"Installed" 行。
- 安装：搜索 → 详情 → 加号 / "Install plugin" → 按提示 Connect → 新开聊天再用。
- 调用：直接描述任务；或 `@插件名`；或 Sources → "Use plugins"。
- 审批卡：Deny / Allow once / Allow low-risk actions / Always allow；权限级别 Always ask / Allow read actions / Allow low-risk actions / Allow all actions (elevated risk)。
- 卸载：打开插件 → "Uninstall plugin"；断开授权：Settings > Apps；查看权限：Settings > Apps/Plugins → 该 App → Permissions / Connected accounts。
- "OpenAI Verified" 徽章；声明 MCP 的插件标 "Desktop only"；"Custom apps are not verified by OpenAI"；"These measures do not eliminate third-party or prompt-injection risk."
- 官方目录常见：Slack、Notion、Gmail、Google Drive、Google Calendar、Outlook、Teams、SharePoint、Figma、Canva、Linear、GitHub、Atlassian Rovo、Dropbox、Zoom、Shopify、Stripe、Airtable、Monday 等；角色插件 Data Analytics / Creative Production / Sales / Product Design。

## Skills
- Skill = 文件夹 + SKILL.md（name/description）+ 可选 scripts/references/assets/agents/openai.yaml；遵循 Agent Skills 开放标准。
- 位置：仓库 .agents/skills；用户 ~/.agents/skills（旧文档写 ~/.codex/skills）；管理员 /etc/codex/skills；内置 skill-creator、skill-installer。
- 调用：Codex 里输入 `$` 弹菜单或 `$skill-name`，或 `/skills`；ChatGPT 侧用 `@`。自动匹配靠 description。
- 安装：`$skill-installer <name>` 或 GitHub URL；ChatGPT 侧 Skills → Create → Create with chat / editor / Upload；Shared with me → Install。
- 创建：`$skill-creator`，问用途/触发时机/是否含脚本。
- 停用：~/.codex/config.toml `[[skills.config]] path=... enabled=false`；删除文件夹（推断）。
- 上传技能自动扫描：Available / Needs Review / Blocked。
- 不确定：合并后 Codex 视图是否有独立 Skills 页；个人 Free/Plus 的技能 UI 可用性。

## 排错
- 官方 troubleshooting 页；日志 macOS ~/Library/Logs/com.openai.codex；问题反馈 github.com/openai/codex/issues；帮助中心 help.openai.com；状态页 status.openai.com。
- 常见：unsupported_country_region_territory（地区不支持）；用量到限；目录授权；定时任务要求应用运行。
