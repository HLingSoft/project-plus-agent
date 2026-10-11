import { readFileSync, writeFileSync } from 'node:fs'
import { JsonRpcProvider, Wallet, Contract, keccak256, toUtf8Bytes } from 'ethers'
import { MONAD, ANCHOR_ABI, digest, verifyProof, type Manifest, type Proof } from '../src/lib/monad.js'
const [input, output] = process.argv.slice(2)
if (!input || !output) throw Error('Usage: node --import tsx scripts/anchor-record.ts record.json proof.json')
const manifest = JSON.parse(readFileSync(input, 'utf8')) as Manifest
const provider = new JsonRpcProvider(MONAD.rpc)
if ((await provider.getNetwork()).chainId !== BigInt(MONAD.chainId)) throw Error('Wrong network')
const wallet = new Wallet(JSON.parse(readFileSync('.local-secrets/monad-testnet-wallet.json', 'utf8')).privateKey, provider)
const contract = new Contract(MONAD.contract, ANCHOR_ABI, wallet)
const hash = digest(manifest)
const tx = await contract.anchor(hash.projectKey, hash.root)
console.log('Anchor transaction:', tx.hash)
const receipt = await tx.wait()
if (receipt.status !== 1) throw Error('Anchor failed')
const proof: Proof = { chainId: MONAD.chainId, contract: MONAD.contract, owner: wallet.address, ...hash, transactionHash: tx.hash, manifest }
writeFileSync(output, JSON.stringify(proof,null,2)+'\n',{mode:0o600})
const checked = await verifyProof(proof)
const changed = await contract.verify(wallet.address, hash.projectKey, keccak256(toUtf8Bytes('tampered')))
const otherOwner = await contract.verify('0x0000000000000000000000000000000000000001', hash.projectKey, hash.root)
if(!checked.latest || changed || otherOwner) throw Error('Verification failed')
console.log(JSON.stringify({ ...checked, tamperedDigest: changed, otherOwner, proofFile: output }))
provider.destroy()
