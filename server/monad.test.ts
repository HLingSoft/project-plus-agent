import {test} from 'node:test'
import assert from 'node:assert/strict'
import {canonical,digest,verifyProof,type Manifest,type Proof} from '../src/lib/monad.js'
test('record canonicalization is deterministic and detects decisions and evidence changes',()=>{
 const a:Manifest={schema:'project-plus-evidence-v1',projectId:'project-a',records:{decision:'pending',evidence:['report-a']}}
 const b:Manifest={records:{evidence:['report-a'],decision:'pending'},projectId:'project-a',schema:'project-plus-evidence-v1'}
 assert.equal(canonical(a),canonical(b));assert.deepEqual(digest(a),digest(b))
 assert.notEqual(digest(a).root,digest({...a,records:{decision:'approve',evidence:['report-a']}}).root)
 assert.notEqual(digest(a).projectKey,digest({...a,projectId:'project-b'}).projectKey)
})
test('proof rejects a wrong chain before contacting RPC',async()=>{
 await assert.rejects(verifyProof({chainId:1} as Proof),/Monad/)
})
test('modified proof payload is rejected before RPC', async()=>{
 const {readFileSync}=await import('node:fs')
 const proof=JSON.parse(readFileSync(new URL('../public/monad-demo-proof.json',import.meta.url),'utf8')) as Proof
 proof.manifest.records={decision:'tampered'}
 await assert.rejects(verifyProof(proof),/摘要不一致/)
})
