# Project+ AI · 项目家

- Live app: https://project-plus-agent.vercel.app
- Reviewer access: obtain the private review code from the project owner, then create a browser-local account.
- [Video handoff and scripts](docs/submission/CLAUDE_VIDEO_HANDOFF.md)
- [Submission status and remaining work](docs/submission/STATUS.md)


以 Agent 对话为主的独立工作台：从已有清单生成项目任务，检索资料、起草 RFI，并在需要决策时等待 Human Input。新对话继续读取项目约定、任务进展和 RFI 状态。Agent 能主动提出问题，人工回答后自动继续。

## 启动

Node.js 22+，执行 `npm install`、`npm run dev`，打开 http://localhost:5173/。`npm test` 检查业务流程，`npm run build` 检查类型和构建。

## 界面与本地账号

采用官方 shadcn `dashboard-01` 和 `login-03`，保留布局与组件样式，主题为橙色。注册后从空项目开始，清单、任务、RFI、资料、对话和账号保存在当前浏览器 IndexedDB。密码采用带随机盐的 PBKDF2 散列；登录状态保存在当前标签页的 sessionStorage。

这是本机原型的账号切换与数据分区，不能作为公开 SaaS 的服务端鉴权。不同浏览器的数据独立，清除站点数据会移除本地资料。清单库为同一浏览器的共享模板资产，项目按本地账号分开。旧 SQLite 原型数据未迁移、未删除，当前服务不再读写它。

## 使用流程

1. 注册本地账号，创建项目。
2. 清单库支持粘贴 `{ id, name, description, tasks: [{ name, description, order }] }` 数组。预览后添加到项目，原始检查标准保留；重复添加同一模板不会重复生成任务。
3. 在“资料与约定”添加文本资料和明确的项目规则。
4. 打开验收任务，核验证据。候选片段显示原文、文件名和段落。
5. 起草 RFI，确认或暂缓 Human Input。确认仅改变本地草稿状态，发送需人工完成。
6. 记录实际收到的回复，再核验；最终由人确认验收通过。
7. 打开项目 Agent，新建接续对话。刷新后仍可读取项目任务 checkpoint 和待确认事项。

2026-10-08 已通过 LeanCloud 控制台读取并在本机 Chrome 导入 11 套 PunchTemplate、221 个条目。这是模板快照，不是与旧 SaaS 实时同步，也未导入其客户任务/RFI 全量数据。模板快照随本地程序提供，新浏览器首次打开时写入自己的 IndexedDB 清单库。

## AI 回复

参考 Vercel AI SDK 的 UI 架构，实际使用 `@ai-sdk/react` 的 `useChat` 和服务端 `streamText`，支持流式 Markdown、停止生成、错误重试和客户端工具调用；资料入口保留在侧栏。界面使用现有 shadcn Card/Input 与主区域对话，避免引入第二套视觉风格。

默认模型为 OpenRouter 的 `anthropic/claude-opus-5.5`，由服务端统一配置，用户无需选择模型。

复制 `.env.local.example` 为 `.env.local`，填写兼容 OpenAI Chat Completions 的 `MODEL_API_KEY`、`MODEL_API_URL` 和 `MODEL_NAME`。密钥只留在本机代理，启用后当前项目上下文、聊天和检索片段会发给配置的模型服务。

未配置时明确显示“流程预览”，使用本地状态和检索结果回答，不伪装成真实模型。每轮最多 16 次工具调用，达到上限可手动继续；原文保留在浏览器，请求使用最近 40 条消息与较早摘录，旧原文可用历史检索工具回查。当前资料检索为中文二元词项匹配；尚未实现 embedding RAG、自动上下文压缩、PDF/Excel 解析或云端多用户协作。本机已通过 OpenRouter / Kimi K2.5 的真实流式调用、读取状态、Human Input 暂停和人工回答后续接测试；这不代表全部业务场景已验收。工具只能检索、核验、起草 RFI，不能执行人工验收或对外发送。

## 历史原型与比赛边界

`server/core.ts`、`server/agent.ts` 及原有测试保留早期 SQLite/摘要逻辑，未接入当前网页；当前 API 仅提供健康状态和流式模型代理，详见 `docs/API.md`。`onchain/EvidenceAnchor.sol` 仍是未部署的合约源码。网站已部署到 Vercel；Monad 产品集成与交易读回、演示视频和比赛最终提交仍未完成。

各轮验收与 OpenRouter 实测记录见 `docs/UI-VALIDATION.md`。测试服务可用 `node --import tsx scripts/qa-model.ts` 启动在 5174，使用确定性的模拟模型，不代表真实模型质量。
