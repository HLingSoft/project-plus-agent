# Project+ AI 视频制作交接

目标：制作 Metropolis 技术演示（≤3 分钟）与 Pitch（≤2 分钟）。先完成实际录屏，再剪辑；不要用动画假扮工具执行、模型输出、人工确认或链上交易。

## 项目与运行

- 公开仓库：https://github.com/HLingSoft/project-plus-agent 。线上：https://project-plus-agent.vercel.app 。
- 线上先输入评审访问码；负责人本机 `.local-secrets/reviewer-access.txt` 保存该码，不要录屏或公开。
- 本地：`npm ci`、复制 `.env.local.example` 到 `.env.local`，由负责人配置服务端密钥，运行 `npm run dev`，打开 http://localhost:5173。
- 默认 OpenRouter / anthropic/claude-opus-5.5。不要录到环境文件、密钥、浏览器密码管理器或其他客户项目。
- 新建本地测试账号和项目“演示酒店 · 弱电验收”。所有演示报告必须标注“合成演示资料”。
- 应用的核心：持续推进工作的 Agent；已有 SaaS 的验收模板作为领域资产，验收与 RFI 是展示场景。
- 页面：项目切换、新任务、历史任务；输入框旁“添加资料”；省略号内验收标准、结果、RFI 与约定；保留官方 shadcn 橙色主题。

## 先准备，后录制

1. 确认顶部不显示“未连接模型”，真实发一条消息确认服务可用。
2. 添加 `DEMO_EVIDENCE.md` 中第一份报告，资料标题为“合成演示：弱电初检记录”。
3. 输入：`请用关键词“弱电”查找验收模板（若无结果则列出全部模板），选择酒店装修项目客房验收检查清单（弱电）并应用到这个项目。本次只检查网络线路：查找项目资料，指出证据不足之处，起草 RFI，并停下来让我确认。`
4. 模型若提出范围确认，如实回答；不要剪成“从不需要用户输入”。
5. 检查真实模板已生成 3 个条目，模型调用记录可见，RFI 卡片出现后等待用户。
6. 点击“确认草稿并继续”。此操作仅确认草稿，**不等于发送给承包商**。
7. 在“查看 RFI”关联条目中录入第二份报告的模拟回复（明确标为模拟承包商回复）；同时添加第二份报告作为可检索项目资料。
8. 新任务输入：`继续这个项目的网络线路验收。请读取此前的 RFI 和最新复测报告，重新核验，引用资料与段落，并告诉我哪些结论仍需项目负责人确认。不要自行标记验收通过。`
9. 打开验收结果查看证据与状态。只有负责人手动确认才能变为已验收。
10. 先完整跑通一遍并保存素材。模型措辞与耗时不固定，录屏不能伪造预期结果。失败则记录问题、修复后重录。

## 技术演示：目标 2 分 45 秒

| 时间 | 画面与操作 | 英文口播 |
|---|---|---|
| 0:00–0:15 | 简洁 Agent 首页；项目名可见 | Project+ AI is an agent workspace for continuing real project work. This demo uses acceptance checks and requests for information, grounded in checklist assets from the Project+ SaaS I previously built. |
| 0:15–0:40 | 已添加的合成报告；输入任务；展示真实工具执行 | I give the agent a goal and supporting material. It selects the requested checklist, creates the inspection items, and retrieves evidence for the scope I specified. Here, we focus on the network connection. |
| 0:40–1:10 | 展示资料引用、缺失证据、RFI 草稿 | A speed reading alone does not establish connection stability. The agent identifies missing evidence and drafts a request for information. The draft remains in the project, with its related inspection item. |
| 1:10–1:30 | Human Input 卡片停住；人工点确认 | At this point, the agent waits for human input. I can approve the draft or defer it. Approval records my decision; it does not automatically send a message or accept the work. |
| 1:30–2:05 | 添加复测记录；新任务继续；显示历史决策和工具读回 | Now I add a simulated follow-up report and continue in a new task. The agent reads the saved project state and earlier decisions, retrieves the new evidence, and continues from that point. I do not need to reconstruct the project background. |
| 2:05–2:25 | 展示网络线路证据、待人工复核 | The output links the inspection item to the supporting material and the clarification. Final acceptance remains a human decision. Project data and conversation history are stored in this browser. |
| 2:25–2:45 | 打开菜单“验证项目记录”，验证真实证明，打开交易链接 | A digest of the evidence record can be verified on Monad, while project documents stay offchain. This proves that a record matches a committed digest; it does not prove that the underlying inspection was correct. |

**Monad 镜头已可录制：** 按 MONAD_READINESS.md 导出这次演示项目并用本地脚本签名，在页面导入证明后录制“验证通过”和真实交易页。也可使用“验证公开演示记录”，但必须明确它是单独的合成 Human Input 样本，不能把它说成当前验收项目。现有真实交易：0x9626957cf117d063ad43c06c0298b913e40f60bd1b594d039e748f9e1a44cffb。不要展示私钥或把私钥导入网页。

若等模型耗时太长，可以加速等待区间，并在画面明确标注“等待过程已加速”。保留真实输入、工具、Human Input 及结果的连续关系。字幕不出现“无限记忆”“完全自主验收”“资料永不离开设备”：项目上下文会经过服务端发送给 OpenRouter。

## Pitch：目标 1 分 40 秒

画面：本人出镜为主，穿插真实 Agent、Human Input、任务接续画面。可用以下口播，不编造客户数、营收或效率指标。

> Hi, I'm the builder of Project+ AI. I previously built Project+, a SaaS product for managing fit-out projects. Working with acceptance checklists and requests for information showed me a recurring problem: project work spans many conversations, documents, and human decisions, but the context is often lost between them.
>
> Project+ AI is a new agent workspace built around that problem. A user gives it a goal. The agent uses domain checklists, retrieves supporting evidence, tracks missing information, and pauses when a person needs to decide. When new information arrives, the work can continue using the saved project state.
>
> Our first demonstration focuses on acceptance checks and RFI. It uses existing checklist assets, with synthetic project records for the demo. We are showing a practical workflow: evidence review, clarification, human input, and re-verification. Final acceptance remains with the responsible person.
>
> Our initial users are project managers and delivery teams already familiar with these workflows. We plan to begin with focused pilots, measure whether teams spend less time reconstructing context and chasing missing evidence, and expand based on the results.
>
> The goal is simple: let people delegate work that continues across sessions, while keeping the evidence and human decisions visible.

结尾加入已实现的 Monad 描述：
> We use Monad to make selected record digests independently verifiable, without putting project documents onchain.

## 输出与验收

- `project-plus-technical-demo.mp4`：1920×1080、≤180 秒，真实产品录屏，英文口播与字幕。
- `project-plus-pitch.mp4`：1920×1080、≤120 秒，英文口播与字幕。
- 同名 `.srt`、封面图、实际录制的项目名和日期。
- 上传后提供无需申请权限即可观看的 HTTPS 地址（YouTube / Loom / Vimeo 等）。用户负责安排 Claude 制作，本交接不代发消息给 Claude。
- 无密钥、真实客户信息、测试账户密码画面；声音可听清，主要字体在 1080p 下可读。
