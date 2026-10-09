# Project+ AI Continuity API v1

All endpoints are local to this prototype and return JSON. The current server is single-user and has no authentication; do not expose it publicly.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/projects/:projectId/continuity` | Read unresolved project tasks and checkpoints across conversations. |
| GET | `/api/projects/:projectId` | Read checklist items, documents, RFI, explicit project facts, Human Input and event history. |
| POST | `/api/projects/:projectId/items/:itemId/analyze` | Generate source-linked candidate evidence and update task state. |
| POST | `/api/projects/:projectId/items/:itemId/rfi` | Create an RFI draft and a persistent Human Input decision. |
| POST | `/api/projects/:projectId/human-inputs/:inputId/resolve` | Resolve with `{ "decision": "approve" }` or `{ "decision": "defer" }`. Approval never sends externally. |
| POST | `/api/projects/:projectId/rfis/:rfiId/answer` | Record a human-provided answer. |
| POST | `/api/projects/:projectId/items/:itemId/accept` | Human-only confirmation after review. Never exposed as a model tool. |
| GET | `/api/projects/:projectId/manifest` | Export a content-free continuity commitment. |
| POST | `/api/verify-manifest` | Check a manifest's local SHA-256 root against its payload. |

`manifest.payload.schema` is `project-plus.continuity.v1`. The root is SHA-256 over UTF-8 `JSON.stringify(payload)` in the fixed output order. It contains random project/item IDs, item states, source chunk hashes and answered RFI hashes. The response also includes `project_key = SHA-256(project_id)` for the Solidity `bytes32` key. Local verification only proves the payload was not altered relative to the supplied root. To prove historical existence and signer identity, anchor the root in `EvidenceAnchor.sol` and check the transaction and caller on Monad. This final chain step is not implemented or deployed in the current prototype.

The local document search uses token overlap with Chinese bigrams and a document-level relevance threshold. It returns candidate passages with a document title and paragraph position. It is an extractive retrieval baseline, not semantic embedding retrieval or proof that an acceptance criterion is satisfied.
