# Monad 上链前检查与演示边界

当前状态：EvidenceAnchor.sol 已有源码与编译产物，但尚无部署地址、测试网交易或产品钱包入口。公开网站部署成功不等于产品已在 Monad 上运行。

官方网络与 faucet：https://docs.monad.xyz/developer-essentials/testnet 。部署时重新从官方页面核对 chain ID、RPC 和区块浏览器；不得混用主网或历史测试网状态。

待用户确定测试钱包后执行：

1. 使用本次比赛专用测试网钱包，获取测试 MON。不要使用生产私钥；私钥/助记词不能写进仓库、视频或提交资料。
2. 用当前编译器重新编译 onchain/EvidenceAnchor.sol，记录 compiler 版本与产物哈希。
3. 连接确认的测试网并估算部署 gas；钱包所有者确认交易。记录部署地址、交易哈希、chain ID 与 receipt status=1，并读回非空合约代码。
4. 在产品中以明确的人工作用触发证据记录摘要提交。稳定序列化项目标识、验收条目、证据引用、RFI 与人类决策后计算摘要；原文不上链。摘要对象须可导出，不能只临时在服务器内生成。
5. anchor(projectKey, root) 成功后，通过 verify(owner, projectKey, root) 读回 true；修改摘要后读回 false，另一个 owner 的记录不应匹配。
6. 记录并展示真实浏览器交易链接与校验结果，更新提交文案与视频镜头。

合约限制：latestRoot 只保存该 owner/projectKey 的最新摘要；旧记录是否存在需通过 Anchored 事件追溯。摘要匹配只证明数据与提交时的记录一致，不证明检查结论真实，也不授予链下应用访问权限。当前合约不是完整的权限系统，不应写成“链上授权治理”。

只有完成产品入口、交易和读回之后，才能在主赛道提交材料中称为实际 Monad 集成。
