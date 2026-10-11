# 界面与浏览器数据验证 · 2026-10-08

## 实测通过

- Chrome 本地注册、退出、重新登录，项目状态保留。
- 真实 PunchTemplate 的 11 套模板、221 个条目导入，模板原文预览。
- 弱电清单生成 3 项任务，原始标准保留。
- 缺少证据时起草 RFI；页面刷新后 Human Input 恢复，新建对话仍提示相同待办。
- 人工确认草稿、录入测试回复、重新核验、人工确认验收闭环。
- 桌面与 390px 手机布局检查。修正长 JSON 撑出弹窗、Human Input 卡片被压缩的问题。
- `npm test` 13 项通过，包含 IndexedDB 账号分区、原子保存、模板幂等应用、持久人工暂停，以及使用本地模拟模型的 AI SDK UI 流协议测试。
- `npm run build` 通过。构建仍提示主包超过 500KB；lint 无错误，保留官方组件的 Fast Refresh 与 use-mobile 提示。

## 边界

模板为旧 SaaS 的真实快照；浏览器中的“界面验收测试项目”和回复为明确的测试记录。未修改 LeanCloud 数据，未批量导入真实客户任务或 RFI。

未配置真实模型密钥，因此模拟协议通过不能等同真实模型端到端验证。当前交付是本地浏览器版本，未公开部署或最终提交比赛。

## 参考

- https://ui.shadcn.com/blocks
- https://vercel.com/academy/ai-sdk/ui-with-v0
- https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage

# 第二轮：Agent 为主的工作台

本轮基线：`c1c2b9c`，原有 UI 改造尚未提交；在 `fix/agent-first-workspace` 上继续。保留已有本地修改，只调整当前需求涉及的文件。

## 用户的四项标准

| 标准 | 实际检查 | 结论 |
|---|---|---|
| 界面简单、好看 | Agent 成为默认主区域；shadcn 侧栏与组件、橙色主题；桌面与 390×844 手机截图；手机内容宽度与滚动宽度均 390px | 布局与溢出已检查，审美由用户确认 |
| 流式问答顺畅 | 真正经过 useChat → Express → 模拟 OpenAI SSE → UI 的多段输出；Markdown 标题、列表、表格；Enter 发送；停止；503 错误后重试 | 模拟服务端到端通过；真实服务延迟与稳定性未测 |
| Human Input | 连续 5 次工具调用后主动提问；刷新仍保留问题；选项/自由文本；回答自动继续；RFI 确认后读取最新状态 | 浏览器实测通过 |
| Agent 能力 | 查找模板、应用模板、读取任务、检索证据、核验、起草 RFI、询问用户、回查历史；操作日志去重；300 条历史保留与回查 | 工具和状态机通过；真实模型的理解、规划、判断质量待验收 |

## 真实发现与修复

1. **RFI 可以绕过验收阻断**：任务已有候选证据时，起草 RFI 保留 ready_for_review 状态，acceptItem 未检查 pending/open。先复现失败测试，再修复状态与验收守卫，回归通过。
2. 原先只在回复结束保存聊天；现在生成期间每 250ms 最多保存一次快照，停止/结束时立即保存。刷新后显示中断并允许接续。不能保证硬断电时最后 250ms 的文字零丢失。
3. 原先到四次工具调用便停止、没有明确继续入口。现在最多 16 次，达到上限显示已暂停和“继续任务”。不会在停止后自动再发请求。
4. 每次请求都从最新项目状态组装上下文；保留完整本地原文，发送最近 40 条和较早摘录，提供 search_history 回查旧原文。此处是有界上下文加检索，不是语义摘要或无限上下文。
5. 新增通用 Human Input；模型没有批准、发送 RFI 或确认验收的工具。待人工输入时，事务层阻止其他写工具。
6. 恢复未完成工具时，已记录结果直接读回；没有结果的调用标为中断，避免自动重放。
7. Agent 主界面和图表按需加载；手机对话选择栏的溢出已修复，Markdown 表格默认附加控制按钮已隐藏。

## 浏览器证据

独立测试环境 `localhost:5174` 使用 `scripts/qa-model.ts`，账号为测试账号，消息明确含“本地 QA 测试”。正常 `localhost:5173` 未连接该模拟服务。

- 从空项目通过对话应用真实弱电模板，生成 3 个任务。
- 5 次连续工具调用后显示通用问题，刷新后选择“电视信号”，自动进入检索、核验、RFI 草稿。
- 点击确认草稿，自动再读取状态并生成 Markdown 表格说明；未对外发送。
- 长回复在第 13 项附近停止；刷新后文本逐字一致且“继续任务”可见。
- 生成中在第二项文字出现时刷新；部分文字保留，页面完成加载后显示“生成已暂停”。
- 模拟 503 错误，看到可恢复提示，点击“重试并继续”后再次得到回复。
- 新对话可以继续读取同一项目数据；未重复生成清单任务。

截图：`output/agent-home.jpg`、`output/agent-human-input-qa.jpg`、`output/agent-mobile.jpg`。

## 验证层级与剩余事项

`npm test` 17 项通过：8 项覆盖当前浏览器数据/Agent/流协议，9 项是保留的旧 SQLite 原型测试，不能混当当前端到端证据。构建通过，lint 无错误；官方组件提示和大文件分包提示仍保留。

真实模型配置尚未获得。没有进行真实模型质量评测、长时间无人值守运行、云端同步、真实外部 RFI 发送或客户现场验收。当前没有后台任务恢复服务，关闭页面会停止生成；重新打开后从已保存状态接续。

## 针对本轮修改的审查

- 手动检查状态、持久化、工具权限、重试和 UI 改动；已有未提交文件重叠，未对整个分支运行自动简化。
- 模板源和客户实例分开，未改动 LeanCloud。
- 未将模拟运行标为真实模型能力；报告保留这一验收缺口。

## 2026-10-09：侧栏进一步简化

- 侧栏仅显示项目切换、新任务和历史任务；移除六个业务导航入口。
- 输入框旁可添加资料；更多菜单按需查看验收结果、RFI、标准库和项目资料与约定。
- 历史任务复用原持久化会话；打开后可继续，空白当前任务重复点击不新增。
- Chrome 实测：资料弹窗、结果页（原有 3 条验收任务）、历史消息加载、新任务空态均通过。
- 构建通过；17 个测试通过（8 个当前实现测试、9 个旧原型测试）；lint 无错误，有既有警告。
- 截图：output/agent-simplified.jpg。真实模型仍未配置，本轮不宣称真实模型能力通过。

## 比赛提交页实时核对

2026-10-09 读取 https://hackathon.monad.xyz/project?tab=submission ：

- 完成度 1/5，仅主赛道完成：Trust, Identity & AI Infrastructure。
- 截止时间 10 月 13 日 20:59 PDT。
- 缺：项目 Logo、获客策略、GitHub 仓库、Live product、技术演示视频、Pitch 视频。
- Live product 明确要求运行在 Monad Mainnet 或 Testnet。
- 技术演示视频最长 3 分钟；Pitch 最长 2 分钟。
- 项目名/简介仍为 9 月 29 日保存的 Acceptance Evidence pipeline 定位，需要按最终实现更新。
- 本轮只核对，无上传或最终提交。


## 2026-10-09：OpenRouter 真实模型连通验收

按用户授权读取 Torra 本机 OpenRouter 凭据，写入项目家 .env.local（权限 0600，Git 忽略，非 VITE_ 变量）。模型 moonshotai/kimi-k2.5，代理地址 https://openrouter.ai/api/v1/chat/completions。未修改 Torra 配置。

- 重载本机代理后 /api/health 返回 mode=model。
- 真实 API 测试：HTTP 200，返回 get_project_state 工具调用、SSE DONE，无 error 事件。
- Chrome 真实浏览器：合成测试会话调用 get_project_state → ask_human → 出现选择电视/网络/电话的 Human Input，发送按钮停用。
- 人工补充“网络，只读取条目和标准”后继续调用 list_items，并完整回复网络连通性、稳定性、网速的原始检查标准及下一步。未创建/修改验收条目，未发送 RFI。
- 原流程预览文案已由实际模型模式替换。截图 output/openrouter-live.jpg。
- 现有构建产物不含密钥；git diff --check 通过。此次只修改本地配置、配置样例和文档，未改运行时代码。
- 该结果证明这条真实模型链路可用，不代表所有模型/长任务场景或比赛提交已完成。

## 2026-10-10：公开仓库与 Vercel

- GitHub 公共仓库 https://github.com/HLingSoft/project-plus-agent ，默认分支 main。
- 正式网站 https://project-plus-agent.vercel.app 。模型默认 anthropic/claude-opus-5.5，经 OpenRouter 服务端调用。
- 首次部署发现 `.ts` 导入在 Node 编译后找不到模块。改为 NodeNext 可解析的 `.js` 引用并为 api 提供独立 tsconfig；二次部署无该错误。
- 线上健康接口 HTTP 200，mode=model，未认证 accessRequired=true。
- 线上匿名模型请求 401；访问码换取 HttpOnly/Secure/SameSite=Strict cookie 后请求 200。
- 线上真实 Opus 模型返回 get_project_state 工具调用与 SSE DONE；读取到 6 个响应数据块，无 error 事件。
- Chrome：访问码进入、本地账号注册、项目创建、Agent 首页加载通过。
- 本轮整体测试 18 项通过；之后新增部署访问集成测试，针对访问、签名 cookie、流协议 3 项通过；再次修改 Node 模块引用后，部署与流协议 2 项、构建通过。
- 网站可用不等于 Monad 集成完成；比赛页面会话已过期，未回填或最终提交。

- 追加 Chrome 真实线上测试：Opus 读取空项目状态、调用 ask_human，显示电视/网络/电话选项并暂停，发送按钮禁用。截图 output/vercel-human-input.jpg。

## 2026-10-11 pre-submission end-to-end review

Production browser test used only synthetic hotel evidence. The actual model selected and applied the three-entry weak-current template, retrieved initial evidence, analyzed only the network item, drafted one RFI and paused for Human Input. A person confirmed the draft, entered a simulated reply and added the retest report. A new task read that saved state, cited both reports and left the network item ready for human review; television and telephone remained unstarted.

Review found and corrected three issues: template lookup did not search inspection entries/compound Chinese phrases; model citation indices could start at zero; retrieval could omit measurement paragraphs adjacent to requirements. Regression coverage added for all three. 25 tests pass. No video links have been supplied and no final competition submission has been made.

After deployment, the task evidence includes the retest measurement paragraph. An explicit UI acceptance action changed only the synthetic network item to accepted; TV and telephone stayed unstarted. The actual browser-exported record was anchored at transaction `0x1ef9e64874fcdda35b626ad0bf6b81e44859af6f73a38fdb40ffc796defa9827`, block 70049744; changed digest and wrong owner both return false.

Production browser imported this full proof and displayed “验证通过 · 区块 70049744” / “与该地址最新提交一致。” Screenshot: `output/acceptance-proof-verified.png`. Metropolis description now includes both proof scopes; draft remains 4/5 with only video fields incomplete.
