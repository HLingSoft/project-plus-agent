import { BrowserProvider, Contract, Interface, JsonRpcProvider, FetchRequest, keccak256, toUtf8Bytes, type Eip1193Provider } from 'ethers'
import type { Project } from './local-store.js'
export const MONAD = { chainId: 10143, rpc: 'https://testnet-rpc.monad.xyz', explorer: 'https://testnet.monadscan.com', contract: '0x508A23192d1F3e6fDE6E26324d9Ff6d6955cef72' } as const
export const ANCHOR_ABI = [
  'function anchor(bytes32 projectKey, bytes32 root)',
  'function verify(address owner, bytes32 projectKey, bytes32 root) view returns (bool)',
  'event Anchored(address indexed owner, bytes32 indexed projectKey, bytes32 root, uint256 timestamp)',
]
export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  return `{${Object.entries(value).filter(([,v]) => v !== undefined).sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0).map(([k,v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`
}
export type Manifest = { schema: 'project-plus-evidence-v1'; projectId: string; records: unknown }
export type Proof = { chainId: number; contract: string; owner: string; projectKey: string; root: string; transactionHash: string; manifest: Manifest }
export function manifestFor(project: Project): Manifest {
  // Only the resulting 32-byte digests are transmitted to the chain.
  return { schema: 'project-plus-evidence-v1', projectId: project.id, records: JSON.parse(JSON.stringify({
    checklists: project.checklists, items: project.items, tasks: project.tasks, rfis: project.rfis,
    humanInputs: project.human_inputs, evidence: project.evidence, documents: project.documents, facts: project.facts,
  })) }
}
export function digest(manifest: Manifest) {
  if (manifest.schema !== 'project-plus-evidence-v1' || typeof manifest.projectId !== 'string' || !manifest.projectId || !manifest.records) throw Error('记录格式不正确。')
  return { projectKey: keccak256(toUtf8Bytes(`project-plus:${manifest.projectId}`)), root: keccak256(toUtf8Bytes(canonical(manifest))) }
}
export async function verifyProof(proof: Proof) {
  if (proof.chainId !== MONAD.chainId || proof.contract.toLowerCase() !== MONAD.contract.toLowerCase()) throw Error('不是本项目的 Monad 测试网合约。')
  const hash = digest(proof.manifest)
  if (hash.root !== proof.root || hash.projectKey !== proof.projectKey) throw Error('记录已被修改：摘要不一致。')
  const connection = new FetchRequest(MONAD.rpc); connection.timeout = 15000
  const provider = new JsonRpcProvider(connection)
  try {
    if ((await provider.getNetwork()).chainId !== BigInt(MONAD.chainId)) throw Error('网络不匹配。')
    const receipt = await provider.getTransactionReceipt(proof.transactionHash)
    if (!receipt || receipt.status !== 1 || receipt.to?.toLowerCase() !== MONAD.contract.toLowerCase()) throw Error('未找到成功的记录交易。')
    const abi = new Interface(ANCHOR_ABI)
    const matched = receipt.logs.some(log => {
      if (log.address.toLowerCase() !== MONAD.contract.toLowerCase()) return false
      try { const e = abi.parseLog(log); return e?.name === 'Anchored' && e.args.owner.toLowerCase() === proof.owner.toLowerCase() && e.args.projectKey === hash.projectKey && e.args.root === hash.root } catch { return false }
    })
    if (!matched) throw Error('交易事件与记录不一致。')
    const latest: boolean = await new Contract(MONAD.contract, ANCHOR_ABI, provider).verify(proof.owner, hash.projectKey, hash.root)
    return { block: receipt.blockNumber, latest }
  } finally { provider.destroy() }
}
export async function anchorWithWallet(manifest: Manifest): Promise<Proof> {
  const injected = (window as unknown as { ethereum?: Eip1193Provider }).ethereum
  if (!injected) throw Error('请安装浏览器钱包并添加 Monad Testnet；也可以导出记录，使用仓库中的本地签名脚本。')
  const provider = new BrowserProvider(injected)
  await provider.send('eth_requestAccounts', [])
  if ((await provider.getNetwork()).chainId !== BigInt(MONAD.chainId)) throw Error('请在钱包中切换到 Monad Testnet（10143），然后重试。')
  const signer = await provider.getSigner()
  const hash = digest(manifest)
  const tx = await new Contract(MONAD.contract, ANCHOR_ABI, signer).anchor(hash.projectKey, hash.root)
  const receipt = await tx.wait()
  if (receipt?.status !== 1) throw Error('交易未成功。')
  return { chainId: MONAD.chainId, contract: MONAD.contract, owner: await signer.getAddress(), ...hash, transactionHash: tx.hash, manifest }
}
