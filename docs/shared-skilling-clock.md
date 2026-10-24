# Shared skilling clock: evidence and bounded design

Research checkpoint: 24 October 2026. This branch is isolated from the live
installation and the boss feature branches. Ownership is the generic clock,
Player processing/API exposure, Fletching scheduling and focused regressions.
Duke adoption is a separate later change. No Farming, clue or client changes.

## Established behavior

The primary [tick manipulation description](https://oldschool.runescape.wiki/w/Tick_manipulation)
describes a shared countdown whose expiry can complete a substituted skill
action. Celastrus bark delays it by four ticks. It also describes additional
resource rolls when moving up to mining rocks or planted trees. This establishes
that an action task and the outstanding skilling phase cannot be identical.

The primary [Duke strategies](https://oldschool.runescape.wiki/w/Duke_Sucellus/Strategies)
describes bark followed by a resource click while approaching marked tiles,
producing two mushrooms or two salt sets. Existing original Wiki media were
re-inspected as decoded frames:

- [Salt](https://oldschool.runescape.wiki/images/Duke_Sucellus_-_tick_manip_%28salt%29.mp4?2237c),
  uploaded 14 February 2024 01:38:27 UTC, 30 fps, 6.037188 seconds. The existing
  tight inventory samples change from no salt at 2.8 seconds to 12 at 2.9 seconds,
  without a visible intermediate six. First decoded PTS is zero. SHA256
  `df88a1965f84f0d1ff052a699a7f4194938ea0cb5e0c9cbe3e10173024b1377f`.
- [Mushrooms](https://oldschool.runescape.wiki/images/Duke_Sucellus_-_tick_manip_%28mushroom%29.mp4?dda52),
  uploaded 14 February 2024 01:38:31 UTC, 30 fps, 10.031020 seconds. The inventory
  shows two mushrooms before grinding. SHA256
  `87efba562a0cf63f2e49013681e9e0660fae88e1298c8fe6e0185b381d147a82`.

These are historical preparation clips still referenced by the normal guide.
Their crop does not distinguish quest from postquest. They establish the paired
outcome and approach method, but supply no server-side action timer, input tick
or ordering of the two checks. Video inventory refresh is not a recovered server
tick boundary.

## Current implementation mismatch

`skills/fletching/Shared.Fletching.js` owns a task-local `ticks/nextTick` pair.
`startFletching` creates a new task and the old task's cancellation loses its
phase. The canonical authored recipe already has battlestaff `ticks: 4` and
`firstTick: 1`, with the ordinary knife bonus inherited from its group.

`bosses/dukesucellus/Preparation.DukeSucellus.js` separately starts immediate
mushroom picking followed by a local three-tick wait. Salt creates a fresh
`session.tick + pickaxe interval` deadline. None reads Fletching state. Merely
retaining the Fletching task would produce the old recipe instead of substituting
the gathering action and would break cancellation ownership.

World TaskManager processing occurs before player input/movement. Player then
processes input, timers, movement, WALK_TO callbacks and area logic in that order.
An ordinary decrementing TimerKey would discard the distinction between an
expiry before movement and a newly reached interaction in the same turn.

## Proposed foundation contract

Use transient per-player state keyed by the player object, with an absolute
World cycle and an independently replaceable action epoch. Never persist a
world-cycle deadline in a save or key it by a reusable player index.

Suggested generic operations are `delayIfIdle(period)`, `remaining()`,
`replaceActive(epoch, completion)`, `processAfterMovement()` and `clear()`.
Replacing/cancelling the action suppresses its old output but does not by itself
erase the outstanding clock. Disconnect/death clear both. Failed level, tool,
material and menu-only interactions do not start a clock. Process no more than
once per player/world cycle, after the existing WALK_TO reach check; a callback
must revalidate its current owner, inventory, location and action epoch.

This is a proposed server contract, not a claim to have recovered original
implementation details. The API names and processing location can change after
the evidence boundary below is resolved. TaskManager cancellation stays intact.

## Runtime evidence boundary

There is not yet evidence for the proposed pair of generic causes: an arrival
attempt using the inherited ready phase and a separately due clock-completion
attempt in the same turn. Dispatching both would reproduce the clip, but the
clips do not identify those two causes. Other models could produce the same
inventory update. Adding an extra completion token or two callbacks solely
because the preceding item was bark would manufacture the missing mechanic.

Likewise, the current Fletching first-output boundary is one tick while the
published bark timer is four ticks. The sources inspected here do not resolve
whether the four-tick shared period begins at the click, first completion,
trailing delay or another engine phase. The existing first-output and knife
cadence cannot be replaced based only on the recipe's repeat interval.

Consequently no production runtime behavior or passing test will be written
around either unverified rule. A test that asserts our selected two-cause model
would verify our assumption rather than OSRS. The next useful evidence is a
tick-labelled ordinary capture containing the valid bark initiation, movement,
resource arrival and complete inventory updates, or a primary engine/script
description of those phases. This is a source blocker, not an RNG uncertainty.

## Implementation and verification when the boundary is resolved

Minimal candidate files:

- New generic `SkillActionClock.ts` under the existing skills foundation.
- `Player.ts`: one explicitly ordered post-WALK_TO processing point and lifecycle
  cleanup; plugin API/core exposure in `PluginManager.ts` and `PluginCoreApi`.
- `Shared.Fletching.js`: publish validated shared readiness separately from the
  cancellable recipe; preserve recipe first/repeat cadence and knife behavior.
- New lightweight clock tests plus the existing Fletching and WALK_TO tests.
  Duke adoption and its fidelity tests follow in their own branch.

Tests must distinguish cold start from inherited phase; cancellation must retain
phase without old recipe output; multiple process calls in one tick must not
duplicate completion. Cover player isolation, logout/death, invalid/menu-only
Fletching, normal first/repeat/knife timings and actual movement/arrival order.
Subsequent adoption tests must show two ordinary gathering yields only for the
evidenced phase, single yields otherwise, independent inventory/depletion checks
for each yield, and preserved mining timeout/normal repeat cadence. No full-suite
or live-install claim is made in this research checkpoint.

## Bounded additional primary-source search

### Decode the two indexed bark candidates, 24 October 2026

Both previously identified public candidates were downloaded and decoded with
the existing official RSProx runtime, rather than treating archive indexing as
proof of an item action. The HTTP downloads use gzip transport encoding; the
transport and decompressed capture hashes are both recorded in
`docs/evidence/shared-skilling-clock-capture-screening.json`. The initial header
errors disappeared after honoring that encoding; neither file was a broken
recording.

- Recording2276: revision228, world flags1, activity `-`,153 tick records.
  Bark22935 appears only in an `IfSetObject` display at tick69, group179/child289.
  Selected knife/battlestaff entries occur in bank container95; there is no
  selected inventory93 transition or selected item click/pair.
- Recording1583: revision225, world flags1, activity `-`,4,956 tick records.
  Bark is present in bank container95, then displayed on group179/child289 at
  ticks77/413/510/1011/1514. No selected inventory93 transition, selected item
  click/pair or relevant skill-XP change occurs.

Both streams transmit inventory93. Neither contains any `IfButtonT`/`IfButtonD`
item-pair packet at all, any click on the selected knife/bark/staff IDs, or an
XP change for Fletching, Mining or Woodcutting. The allowlist retains only those
three item IDs, selected UI coordinates and numeric skill deltas; the published
summary omits bank contents, slots, quantities and player identities.

These captures therefore do not show bark cutting or the bark-to-resource
handoff. They cannot establish timer arming, first output or paired-yield
ordering. This is a verified rejection of the two indexed candidates, not
evidence that the manipulation is absent or unsupported in ordinary OSRS.
No production timing rule, passing implementation-shaped test, boss change or
local restart is justified by these recordings. A controlled action trace or
an independently supported engine-order explanation is still required.

The follow-up on 24 October 2026 searched the public RSProx archive through its
own documented web form's `/api/search` request, using exact `ALL` conditions.
Awake Duke12191 plus bark22935, asleep Duke12167 plus bark22935, and salt loc47522
plus bark22935 each returned zero indexed recordings. Bark22935 alone returned
only2276 (46.73KB, revision228) and1583 (405.55KB, revision225), with no advertised
event-world activity. Neither appears in those Duke/resource intersections.
These are archive-index results, not a proof of packet absence or verified world
classification. No broad recording download or speculative numeric sequence
matches are used. In particular, the existing ordinary quest1703 filtered extract
contains salt/Mining changes but not bark/knife input, so it cannot be used as
negative evidence for manipulation.

Two further original public videos were acquired and inspected as frames:

- [Keen, Double Resource Harvesting Tech](https://www.youtube.com/watch?v=19b3UbKi7js),
  23 August 2023,43 seconds. The1920x1080/30fps version starts atPTS0. At4s and29s
  the200-point preparation meter and grind/pick inventory/chat sequence are visible.
  The creator's original description explains red-clicking the resource beforehand,
  then crushing a mushroom and clicking harvest on the arrival tick. This is an
  ordinary preparation demonstration of a different action, rather than a bark
  timer capture. Editing/slow motion prevents converting absolutePTS into server
  ticks. It constrains observable input order without revealing internal causes.
  HD file SHA256 `abc8d9c0a44bdcc7d9e288c799628c98ceb12a53ae511d7ec9a8354c042b1859`.
- [surf, Zero Time Salt](https://www.youtube.com/watch?v=b0DpRhw971o),27 June2025,
  101 seconds. The inspected frames have a visible metronome and demonstrate
  ordinary preparation, but use the soulflame horn. The creator explicitly amended
  the description after the2July2025 patch to say the horn method was removed and
  to return to bark/knife. This is not evidence for current bark clock arming or
  callback order. File SHA256
  `a6ffac8281fde69dd44d3b86bcb0b67dc88530070e9c52977d9f36256a1c55fd`.

Targeted searches for JagexAsh skilling-timer/two-mining-roll explanations did not
locate a primary engine-order explanation. The Tick manipulation article's sole
Mod Ash reference (20 October2017) addresses the acceptance/balance of the method,
not how its timer is processed. Repeating that citation would not close the gap.

Independent Duke-worker source review agrees that the original clips establish
paired outcomes but not the proposed two callback causes or timer arming reference.
No runtime code, invented phase tests, push or PR was made. The required
`scripts/wt new fix/shared-skilling-clock origin/main` helper completed at base
`106b6f1411a911c4873e0ac23285a1597ae9ad9d`; this evidence-only file is retained
in a local research commit for a future source-backed implementation. No server
was started. The paired-yield functional gap remains open pending a controlled
bark-to-arrival trace or an equivalent primary engine-order explanation.
