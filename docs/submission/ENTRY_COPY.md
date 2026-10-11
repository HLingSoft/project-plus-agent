# Metropolis 提交文案

## Project name
Project+ AI

## One-line description
An agent workspace that continues acceptance and RFI tasks across conversations, with evidence retrieval and human input.

## Description
Project+ AI is a new agent workspace for project work that spans multiple conversations and human decisions. Its first application is fit-out acceptance and Request for Information (RFI).

The product draws on checklist assets from Project+, a project-management SaaS previously built by the founder. The current app includes 11 checklist templates with 221 original inspection entries. Demo project records are synthetic; customer task and RFI records are not bundled.

Users describe a goal in a simple conversation interface. The agent can read project state, find and apply a selected checklist, retrieve source-linked text, inspect evidence gaps, and draft an RFI. Human Input pauses execution for clarification or approval. Once a person responds or adds evidence, the agent can continue from the saved state. Final acceptance remains an explicit human action, and RFI approval does not automatically send external messages.

Conversation history, project records, and tool results are stored in browser IndexedDB. The request context is bounded, with older conversation text available through a history-search tool. This is not unlimited model context or autonomous execution while the browser is closed. Model requests are routed through a server-side OpenRouter proxy, with Claude Opus 5.5 configured as the default. Relevant context and retrieved text are sent to the model provider.

The current retrieval implementation uses text matching and source-linked paragraphs. It does not yet provide embedding-based retrieval or PDF/Excel parsing.

[Before final submission, replace this paragraph with the verified Monad implementation, network, contract address, transaction, and verification flow. A contract source file alone is not a deployed feature.]

## Go-to-market and user acquisition
Our initial users are project managers and delivery teams working on commercial fit-out and handover. We plan to recruit focused pilots through the founder's existing Project+ product relationships and industry contacts, starting with a single checklist and RFI workflow rather than migrating an entire project system.

During pilots, we will measure time spent reconstructing project context, evidence completeness before review, clarification turnaround, and how often users can resume work without repeating earlier decisions. These are proposed measurements, not achieved results.

After validating the workflow, we plan to expand through team referrals, implementation partners, and reusable checklist packages. We will test workspace-based subscriptions and implementation support based on pilot feedback; pricing and conversion assumptions are not yet validated.

## Judge access instructions
Open the deployed HTTPS product URL. Create a local test account in your browser; no email delivery or verification is required for this prototype. Create a project and use the included checklist library. Browser storage is local to that browser and origin; use the same browser to resume work. Use the supplied synthetic evidence records to test the acceptance/RFI workflow.

[Add actual deployment access instructions, if access protection is enabled. Do not put the OpenRouter key in this field.]

## Bounty eligibility
Default model: Claude Opus 5.5 via OpenRouter. Do not claim Kimi, Qwen, or Hunyuan bounty eligibility based on an older test or an unused integration. Only select a sponsor bounty after implementing and demonstrating the sponsor's required use case.
