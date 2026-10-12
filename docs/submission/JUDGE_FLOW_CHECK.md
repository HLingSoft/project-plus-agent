# Judge experience check — 2026-10-11

Tested the production URLs in a separate in-app browser that initially displayed the review access gate, using a new browser-local account and exclusively synthetic project data.

- Before authentication, both submitted video pages played native H.264/AAC video. Technical duration 136.5 seconds, pitch 110 seconds; playback time advanced and readyState was 4, with no media error.
- The access code in Metropolis private judge instructions exactly matched the code used successfully in the browser. No model key was provided.
- Registered a new local account, created an empty project, and saved initial synthetic evidence. No email verification or external account was required.
- Actual agent execution read project state, found the weak-current checklist, and paused with TV/network/telephone Human Input choices. Selecting network resumed execution, applied the 3-item checklist, retrieved evidence, and paused for RFI approval.
- Approved the draft, added a synthetic retest report, and entered a simulated RFI reply through the RFI UI. No external message was sent.
- Reloaded the product and started a new task. The agent read the persisted RFI and report, cited paragraphs 1/2/3 and values 30 minutes, 0% loss, 91/94/93 Mbps. Network remained ready for human review, TV/telephone remained unstarted.
- Logged out and back into the same local account; the project and history remained.
- Public Monad proof verification succeeded at block 70047697 without a wallet, labeled as a separate synthetic sample.
- Browser error log was empty. Metropolis still displayed Ready for judging after its instructions were updated with a copyable evidence link and suggested prompts.

Found and fixed during this run: long checklist wording could prevent concise reports being associated with task evidence. Inspection now falls back to the item title if the full query finds no candidates. Multiple reports could also crowd neighboring measurements out of the five-result limit; adjacent measurement paragraphs now inherit ranking from their matching context. Regression test uses both initial and retest documents. 26 tests and production build pass.

Data is local to the browser/account/origin. Closing the browser does not run background work. Review access may need renewal after 24 hours with the same private code.

Final production deployment dpl_AJmeG6a3F1xcjEc3WokLrLKx72wu reached READY and updated the production alias. Reloaded the same independent browser, reanalyzed network via the task UI, and verified five associated evidence paragraphs including retest paragraph 3 with 30 minutes, 0% and 91/94/93 Mbps. Task still ready for human review. Screenshot: output/judge-flow-final-evidence.png . Source commit 06ca7d4.
