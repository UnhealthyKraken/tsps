# Local boss integration and normal-mode follow-up

**Goal:** Install Vardorvis perfect loot, corrected God Wars drops, Duke, Leviathan and Whisperer plus prior verified death-storage/Belladonna fixes into the user's existing local game without discarding Claude's plugins, client or saved progress. Then address remaining normal-mode fidelity gaps in individual tested follow-ups.

**Authorization:** The user requested installation and follow-up implementation, explicitly waived the repeated Plan Mode gate earlier, and instructed preservation of Claude's work. Use the existing runtime's graceful save/stop and backup interface. Do not ask again for routine integration, restart or publication already authorized.

**Architecture:** Prepare in `tsps-offline-preplay` on `local/forgotten-four-integration`, based on installed Claude revision382198c10. Preserve original feature branches. Port reviewed source commits and generic prerequisites without replacing the advanced local drop consumer. Reconcile canonical source separately and import two identical full exports. Test before touching main. Immediately before deployment recheck main HEAD, tracked/untracked state and client hashes; incorporate any concurrent main advances instead of overwriting them. User saves stay outside Git and are backed up at safe shutdown.

## Constraints and review focus

- No hand edits or conflict merges of generated JSON. Preserve local roll-count/category semantics and source corrections.
- No resets, stashes or checkouts over Claude's work. Preserve Object Markers, XP plugins, NPC Indicators, Inventory Tags, Quest Helper, pending minimap and clue checkouts.
- Client source and served build must remain byte-identical through this server-only deployment.
- Keep server and data coherent while running; stop gracefully before switching main to the verified candidate or importing live data. On shutdown failure, leave the running server alone.
- Validate exact dead-boss contexts, grave relocation/fees, source-data mappings, repeated encounters and offline-compatible local startup.

## Tasks

- [ ] Record current installed revision, runtime, metadata and client hashes; prepare a reversible source backup and isolated integration branch.
- [ ] Integrate Vardorvis/applied-hit observers, quest-owned reward context, required generic object hook and stat/grave/Slayer foundations; retain local advanced drop execution.
- [ ] Integrate the three reviewed boss modules/tests plus death-reclaim and Belladonna fixes. Compare client tree to the current installed baseline.
- [ ] Reconcile canonical local source with PR14/15, test source, export all drop files twice and verify byte identity. Import exact output; update structural tests from source evidence when retained quest mappings differ.
- [ ] Build and run focused boss/drop/death/Farming checks and a bounded full server suite; independently review integration differences.
- [ ] Recheck Claude's main head and metadata, safe-stop/save/backup, fast-forward main to candidate without touching untracked saves/client, build server, update installation metadata additively, restart through existing control and verify HTTP/client/regions/game startup. Preserve rollback branch and snapshots. Report the real served URL.
- [ ] After local game is test-ready, reproduce normal-mode gaps from primary source/cache/capture evidence. Implement Duke Cold Feet/Mirror Image and proven timing/grade fixes in isolated branches, test/review and publish individual ready PRs. Unverified visual/timing facts remain explicit; awakened mode remains unavailable.

Parallel ownership: root owns TSPS integration/deployment and Duke; canonical worker owns source-only reconciliation/exports; Leviathan/Whisperer workers research read-only until the first installation is verified. They may then implement their own modules only. No changes to Claude-owned active checkouts.
