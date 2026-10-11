# Monad 测试网部署与复验

- Chain ID：10143
- RPC：https://testnet-rpc.monad.xyz
- 比赛专用钱包：0xfa6a1383825de404c86e067284509756A9339E06
- 合约：0x508A23192d1F3e6fDE6E26324d9Ff6d6955cef72
- 部署交易：https://testnet.monadscan.com/tx/0xdd07d13ea235da8f52e3c999aa34a37999ab8ae6d7e34d1f06195963969b3657
- 实际记录交易：https://testnet.monadscan.com/tx/0x9626957cf117d063ad43c06c0298b913e40f60bd1b594d039e748f9e1a44cffb
- 部署回执 status=1，非空代码已读回。
- 记录回执 status=1，事件校验通过，verify= true。
- 修改摘要：false；另一个 owner：false。

## 已验证产品路径

在本地浏览器的合成项目中，Agent 请求 Human Input，人工选择“网络”后继续。通过“任务资料与结果 → 验证项目记录 → 导出当前记录”导出真实浏览器状态，用比赛钱包本地签名后，网页可读取证明并向公开 RPC 独立校验。公开样本只有这次人工决定，不能当成已经完成的验收报告。

公用样本：public/monad-demo-proof.json。只含合成测试信息，无客户数据。

## 录制自己项目的上链流程

1. 完成合成验收/RFI演示后，菜单 → 验证项目记录 → 导出当前记录。
2. 在仓库根目录运行：

```sh
node --import tsx scripts/anchor-record.ts ~/Downloads/project-plus-record.json ~/Downloads/project-plus-proof.json
```

3. 在网页“验证已有记录”选择新生成的 proof.json。记录验证通过及交易页。
4. 需要验证篡改检测时，复制证明文件，修改 manifest.records 中的内容，保留原 root，再选择该文件；应显示“摘要不一致”。

私钥保存在本机 .local-secrets/monad-testnet-wallet.json（0600，已忽略），不要上传到 Vercel、GitHub或视频。浏览器钱包按钮需要用户自有钱包且选择 Monad Testnet；该按钮未在当前浏览器签名实测。无需钱包即可验证已存在的公开证明。

latestRoot 只保存最新摘要；历史证明通过成功交易的 Anchored 事件验证，并明确显示是否已被新摘要替代。匹配不证明验收真实、不授予业务权限。
