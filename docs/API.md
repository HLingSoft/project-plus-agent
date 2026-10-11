# 当前运行接口

Express 仅监听 127.0.0.1:3001，经 Vite 转发。本地业务数据在浏览器 IndexedDB，服务器不保存项目或账号。

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/health` | 返回 `mode: model / guided-demo` 与 `storage: browser`。model 表示已配置密钥，不代表模型已验证。 |
| POST | `/api/chat` | 接收 AI SDK UI messages 和当前项目 context，返回 UI message stream。 |

工具：`get_project_state`、`list_templates`、`apply_template`、`list_items`、`search_documents`、`search_history`、`analyze_item`、`draft_rfi`、`ask_human`。工具在浏览器执行，对当前账号项目使用 IndexedDB 事务。`draft_rfi` 和 `ask_human` 生成持久 Human Input；确认或暂缓只能由 UI 人工操作。确认不会发送消息。人工验收没有模型工具入口。

`src/lib/local-store.ts` 是当前数据和业务入口：账号、模板导入、项目事务、资料检索、RFI 状态机和任务接续。旧 `/api/projects/*`、manifest 和 verify-manifest 路由已退出运行服务；早期 SQLite 实现及测试作为历史保留。

请求体限 1MB、服务端消息数限 200；客户端通常只传最近 40 条、模型请求超时 60 秒。本机代理有 Origin 检查，但不是生产鉴权服务。公开部署需要另行实现服务端认证、数据隔离和请求配额。
