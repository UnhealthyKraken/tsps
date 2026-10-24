# Local reconciliation of merged DT2 corrections

The local release8167d3e08 contained the original boss implementation/follow-up
branches but missed changes in merged [PR973](https://github.com/RSPSApp/tsps/pull/973),
tree8795bc4c2. This local release selectively adopts the already-reviewed Duke and
Whisperer runtime modules, their authored configurations and matching boss tests.
Leviathan runtime already matches that merged tree and is not replaced.

No unrelated upstream merge is performed. Shared core, generated definitions,
the client, later poison/tome/binding fixes and Claude's parallel work are preserved.
The older upstream Duke reward test fixture is deliberately not adopted: the local
canonical table has ordered reward stages, so its existing state provider and five
preliminary rolls remain necessary. Every behavioral assertion is retained.

## Reproduced missed corrections

- A Whisperer projectile launched before melee interruption disappeared locally.
  The merged recovery keeps launched shots/binds and cancels only future shots;
  encounter exit still cancels every queued impact. The stronger upstream regression
  failed on the local implementation with zero impacts instead of one at tick4.
- Duke's magic impact graphic was sent when damage arrived rather than scheduled
  at launch in its native slot. The merged cast sends the delayed slot2 effect once.
  The native-graphics regression failed on the old local code with zero launch effects.
- Duke's failed-gaze feedback and damage separation, hazard freeze feedback and
  named object interactions are restored with the matching authored data/helper.
  The old local implementation failed the existing failed-gaze message regression.
- Whisperer messages, visited-shadow state, generated Ketla handout routing and
  native named interactions are retained from the merged reconciliation as well.

The selected source files are compared using Git-normalized object hashes, allowing
normal checkout line-ending conversion. New capture/preparation tests and the named
Duke test helper are included; generated dialogue is read unchanged.

## Remaining normal-mode evidence gaps

Fresh primary Wiki/Talk audits did not establish Duke protected-magic24 or covered
gas4 bounds, icefall selection probabilities, vent lifetime distributions or the
remaining gathering-clock variants. Whisperer8-versus9 landed freeze ticks, optional
bind selection and melee distribution/recovery remain unresolved. Leviathan's late
volley counts/clock, special damage bounds and59-versus60 smoke maximum remain open.
First-hand normal smoke samples all in the50s challenge the current uniform0..59
roll but do not establish an exact minimum or distribution.

This reconciliation fixes concrete missed local changes. It does not establish
complete OSRS parity or justify replacing unknown values with guessed constants.
