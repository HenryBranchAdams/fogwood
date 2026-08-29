# Fogwood acceptance manifest

Status: IN PROGRESS — canonicalization and issues #1–#7 are locally qualified;
exact nested/rotated transforms (#8), independent
integrated verification, and a final exact-commit deployment remain. Sites
version 13 is the last deployed baseline and does not include this issue phase.

This is the one authoritative acceptance manifest. The current phase simplifies
Fogwood into an empty, device-local tldraw surface where Codex turns intent and
observed capabilities into bounded editable matter. It is not a dashboard,
template gallery, raw SDK facade, or automatic mutation system. The person must
review every staged change and choose page-owned Apply or Reject.

The active public boundary remains exactly three stable WebMCP tools:
`fogwood-inspect`, `fogwood-capabilities`, and `fogwood-propose`. The public
proposal action union is the five closed families `canvas_ops`,
`seeded_composition`, `add_materials`, `page_ops`, and `camera_ops`. The 213 pinned tldraw routes remain searchable addressing and
qualification vocabulary; they are not 213 runtime tools and do not prove that
upstream examples execute locally.

## Current autophagy contract

`FogwoodSurface` is the sole pending-review authority. During stage, the page
adapter prepares one immutable `PreparedCanvasPlan` containing the validated
proposal, exact source revision/context evidence, prepared materials, seeded
evidence, preflight, transaction contract, and digest. The plan is deeply
frozen before the person sees it; Apply consumes its prepared lowerings without
decoding or regenerating them.

Apply performs a final revision and precondition check, then opens one tldraw
history boundary and one `editor.run`. If execution or its postcondition fails,
the captured history mark is restored with `bailToMark`; only newly created,
unreferenced assets may be cleaned up. Reject leaves the page unchanged. A
successful Apply is one undo step.

The authority-sensitive page adapter now exposes named module seams:
`app/webmcp/surface-tools.ts` owns the exact three-tool transport assembly;
`app/tldraw-adapter/inspect-projection.ts` owns read-only live projection;
`app/tldraw-adapter/transaction.ts` owns prepared-plan execution and rollback;
`app/review/proposal-activity.ts` owns review copy; and
`app/compat/surface-tools.ts` owns persisted block and direct-instrument
compatibility. `app/surface-tools.ts` is a 53-line compatibility façade with no
Editor, DOM, registration, policy, or transaction implementation. The existing
qualified editor kernel lives privately in `app/internal/surface-runtime.ts` so
this behavior-preserving split does not duplicate schemas, pending authority,
material decode, or transaction logic.

The Bazaar remains a local, declarative, bounded, content-hashed knowledge
collection for materials, moves, adapters, aesthetics, algorithms,
provocations, recipes, and qualification fixtures. Packages are not executable
runtime recipes and the full generated catalog is not eagerly imported into the
active page. New lifecycle transitions emit one generic proposal receipt per
transition. The `fogwood-receipts-local:v1` parser, legacy recipe/snapshot
events and constructors, `open-surface-local`, the `surface-block` renderer,
and direct user gestures remain compatible.

Dead dashboard-era product code removed in this phase:

- `app/bazaar-panel.tsx`
- `app/fogwood-demo.ts`
- `app/fogwood-snapshot.ts`
- `tests/fogwood-demo.test.mjs`
- `tests/fogwood-snapshot.test.mjs`
- their retired gallery, starter, chat, and snapshot CSS selector families

The current registry-8 runtime is authoritative on GitHub `main` and in Sites
version 13. It passed the frozen local check matrix, rendered local and hosted
Browser proof, a harmless hosted WebMCP inspect call, and the independent
anti-dashboard verifier recorded below. One live Codex image-generation
artifact passed the constrained material bridge. Other external providers and
direct conversation inventory remain separate, explicitly unqualified
boundaries.

## Acceptance matrix — current phase

| Boundary | Required evidence | State |
| --- | --- | --- |
| Doctrine and architecture | README, CONTEXT, ADR 0005, and this manifest describe the empty spatial medium, `FogwoodSurface`, and `PreparedCanvasPlan`. | PASS |
| Public WebMCP boundary | Exactly `fogwood-inspect`, `fogwood-capabilities`, `fogwood-propose`; no page-owned apply tool. | PASS |
| Public proposal union | Five closed semantic families: native, seeded, materials, page lifecycle, and camera focus; schemas share the versioned lowerer manifests. | PASS — local #6 |
| Semantic lowerer extension | `fogwood.semantic-lowerer.v1`, ADR 0006, and the 213-route coverage matrix distinguish addressing from local/host/stage/success evidence. | PASS — page and camera fixtures plus Browser proof |
| Revision memoization | Canonical content revision computes at most once per relevant current-page generation; document changes invalidate while camera/selection state does not; cache remains advisory and non-authoritative. | PASS — issue #7 fixtures, 5,000-shape benchmark, rendered Apply/Undo proof |
| Prepared-plan staging | All lowerings/material decoders prepared once; plan frozen before review; exact digest retained. | PASS |
| Authority seam split | Public WebMCP, read projection, transaction, review, and compatibility callers use narrow named modules; the old import remains a thin façade. | PASS — boundary tests and unchanged public behavior |
| Human authority | Page-owned Apply/Reject only; stale revision/precondition refusal; no automatic mutation. | PASS |
| Atomic transaction | One history boundary and `editor.run`; `bailToMark` rollback on partial failure; one-step Undo. | PASS |
| Material safety | Bounded raster and sanitized SVG; exact-byte SHA-256; no network, scripts, active SVG, or malformed assets. | PASS |
| Compatibility | `open-surface-local`, surface-block/direct gestures, receipt-v1 parser, and legacy receipt constructors/events still read. | PASS |
| Bazaar | Local declarative hashed knowledge; no executable recipe import in the active runtime. | PASS |
| 213-example vocabulary | 213/213 local addressing/knowledge records; no claim of 213 runtime tools or upstream execution. | PASS |
| Native medium contract | Registry 8 exposes advisory material-to-native guidance; `canvas_ops` preserves composition/region/role/rotation/opacity metadata and typed relationship identity. | PASS — focused tests and rendered WebMCP proof |
| Browser rendering | Fresh blank canvas, spatial composition, proposal review, Apply/Reject, one-step Undo, reload persistence, no dashboard furniture. | PASS — current local origin |
| Page registration | Current origin and exact registered page tools. | PASS — `http://localhost:4207/`, three tools |
| Browser / host exposure | Current host inventory of page tools. | PASS — in-app Browser WebMCP inventory |
| Conversation inventory | Direct top-level conversation tool inventory, separate from Browser. | NOT EXPOSED DIRECTLY — Browser-mediated tools only |
| Harmless WebMCP call | Successful inspect/capabilities/propose call with no unauthorized mutation. | PASS |
| Deployment provenance | Commit, build artifact, Sites/deployment URL and version. | PASS — GitHub/Sites source `main` and Sites version 13 use runtime commit `df3373a0ed036a4e3421729ec3f7e0579d571d09`; deployment succeeded at the canonical URL |
| Live Codex artifact bridge | Real externally generated material stages with exact provenance, applies once, undoes once, and persists after reload. | PASS — Codex PNG `sha256:cd5e0ea067c4ec5c954443b9184b7d1de2a705000a295ce4047bb5ea770093d4` |
| Independent acceptance | Read-only verifier rechecks current candidate and rejects dashboard-like output. | PASS — no remaining P1/P2; supplied desktop and mobile evidence pass the anti-dashboard bar |

## Evidence ledger — current phase

Record exact command output, origin, screenshot paths, and commit/version here;
do not promote an unrun check to PASS.

| Check | Result / evidence |
| --- | --- |
| Issue #6 local matrix | PASS — 234/234 tests; typecheck, lint, build, compiler check, and diff check all exit 0; build retains only known chunk-size and route-classification warnings |
| Issue #6 Browser/WebMCP | PASS — `http://localhost:4211/`; exactly three tools; inspect reports two semantic lowerers; page proposal staged/rejected without revision change, then applied and one-step undone to the exact revision; camera proposal reviewed/applied with unchanged content revision and no history; no browser warnings/errors; `/private/tmp/fogwood-issue6-semantic-lowerers.png` |
| Issue #7 local cache matrix | PASS — exact canonical equality; one computation per generation across repeated inspect/capabilities/stage; same-turn shape, binding, referenced asset, page switch, Undo/Redo, persistence restore, and history-reset invalidation; camera/viewport/selection/hover/editing non-invalidation; listener cleanup; 5,000-shape fixture and 100 repeated reads. Threshold is computation count, not wall time. |
| Issue #7 Browser/WebMCP | PASS — `http://localhost:4211/`; repeated inspect and capabilities held generation/computations at `0/1`; from a settled baseline camera Apply held `1/2` and the exact content revision; native Apply changed the revision and invalidated; one Undo restored the exact prior revision; no browser warnings/errors; `/private/tmp/fogwood-issue7-revision-cache.jpg` |
| `npm test` | PASS — 238/238; pretest compiler check PASS |
| `npx tsc --noEmit` | PASS |
| `npm run lint` | PASS — no warnings |
| `npm run build` | PASS — only the known >500 kB chunk and vinext route-classification warnings |
| `node scripts/compile-bazaar.mjs --check` | PASS — 7 packages, `sha256:3dcaddef57608136e331a49975f9b176f5c4261180163eadbe6ef471646a596a` |
| `git diff --check` | PASS |
| Registry-8 focused tests | PASS — 68/68 runtime, Canvas Protocol, and public surface tests; exact typed-binding and 500-character visible/inspectable-label invariants included |
| Authority seam boundary tests | PASS — `surface-tools.ts` remains under 80 lines, page and compatibility callers use named seams directly, and the public behavior suite remains green |
| Bundle seam analysis | PASS — production build contains the full-surface Example corpus only in the active surface chunk because current `fogwood-capabilities` route mode requires it; no Bazaar package/catalog marker or retired gallery copy is present in built JavaScript |
| Proud-medium blank origin | PASS — fresh `http://localhost:4207/` began with zero shapes, blocks, bindings, assets, regions, and relationships |
| Proud-medium material review | PASS — real Codex PNG staged with exact provenance before Apply; `/private/tmp/fogwood-proud-material-staged.png` |
| Proud-medium native composition | PASS — 20 native shapes, 0 blocks, 1 local asset, 16 bindings, 8 typed relationships, and 4 regions; `/private/tmp/fogwood-proud-final-accepted.png` |
| Proud-medium human response loop | PASS — a real drag moved `question:living-wall-ownership` from `(350, 790)` to approximately `(136.566, 773.476)`; the fresh inspect selected that semantic ID and the next seeded proposal used the changed revision and geometry |
| Proud-medium preserved branch | PASS — `rain-after-concrete`, remix v1, `xorshift32-v1`, wildness 0.72; source retained, seeded variant and visible lineage added |
| Proud-medium Reject / Undo / Redo | PASS — Reject retained exact revision `fogwood-agent-runtime/2-ec7d16682f03bd86`; one Undo removed only the seeded variant (19 to 18 shapes) and Redo restored it |
| Proud-medium reload persistence | PASS — final post-fix reload retained exact revision `fogwood-agent-runtime/2-a6d8298ce2f3907a`, 20 native shapes, 0 blocks, 1 local asset, 16 bindings, 8 typed relationships, 4 regions, seeded lineage, and matching visible/semantic label `questions` |
| Proud-medium responsive render | PASS — full composition and native mobile tldraw chrome at a 390x844 emulated viewport; `/private/tmp/fogwood-proud-mobile-clean.png`; device metrics override cleared afterward |
| Proud-medium browser health | PASS — no warning or error logs on the current local origin |
| Browser blank-canvas render | PASS — `/private/tmp/fogwood-autophagy-blank.png` |
| Browser stage / Apply / Reject | PASS — native review `/private/tmp/fogwood-autophagy-staged.png`; applied `/private/tmp/fogwood-autophagy-applied.png`; Reject retained the exact empty revision |
| Browser material bridge | PASS — sanitized SVG review `/private/tmp/fogwood-autophagy-material-staged.png`; applied `/private/tmp/fogwood-autophagy-material-applied.png`; active/remote SVG returned `SVG_ACTIVE_CONTENT` before review |
| Browser user-context loop | PASS — clicking `idea:spark` changed only `context_token`; selection-scoped seeded review `/private/tmp/fogwood-autophagy-seeded-staged.png`; Reject retained all three existing shapes |
| Browser Undo / reload persistence | PASS — one Undo removed the three-item native transaction; reload retained the empty state; a second Apply survived reload with the same content revision; one later Undo removed only the SVG shape and asset |
| Browser responsive render | PASS — 390x844 screenshot `/private/tmp/fogwood-autophagy-mobile.png`; viewport reset after the check |
| WebMCP page registration | PASS — exactly three tools at `http://[::1]:4193/` |
| WebMCP host exposure | PASS — in-app Browser returned the same three page tools and their current schemas |
| Harmless successful WebMCP call | PASS — `fogwood-inspect`, `fogwood-capabilities` available/plan, and stage-only `fogwood-propose`; page Apply remained a separate human action |
| Direct conversation inventory | NOT EXPOSED DIRECTLY — this session reached Fogwood only through the in-app Browser WebMCP bridge |
| Current hosted page registration | PASS — exactly `fogwood-inspect`, `fogwood-capabilities`, and `fogwood-propose` at `https://fogwood.madebyhenry.chatgpt.site/` after Sites version 13 deployment |
| Current hosted harmless call | PASS — Browser-mediated `fogwood-inspect` returned registry 8, the current content revision/context token, bounded live page state, and no page mutation |
| Current hosted responsive render | PASS — desktop `/private/tmp/fogwood-v13-desktop.png` and 390x844 `/private/tmp/fogwood-v13-mobile.png`; viewport override reset afterward |
| Current deployment provenance | PASS — GitHub `main` and Sites source `main` both verified at `df3373a0ed036a4e3421729ec3f7e0579d571d09`; Sites version 13 (`appgprj_6a8eed68a0f88191b7467ac94efcc8dc~appgver_51f68df5865081918a35f77f39488848`); uploaded artifact `sha256:5329f82dcdf40803377b8991cc52dae951feaccccc16f994de0850f370324968`; deployment `appgdep_6a92f5427ad48191bb3f3558ffed4ddc`; terminal status `succeeded`; URL `https://fogwood.madebyhenry.chatgpt.site` |
| Deployment provenance | PASS — source commit `56fa61b6c40c8ff996c471636d5670f5c6ad5990`; Sites version 12 (`appgprj_6a8eed68a0f88191b7467ac94efcc8dc~appgver_8d9949ce2e7c819188e0b3401d09223f`); archive `sha256:fac58d84b6f932250908451aee1293a0deb275b56b0ad60adfb959dda35771f3`; deployment `appgdep_6a922498d64081919bd171ce90000793`; terminal status `succeeded`; URL `https://fogwood.madebyhenry.chatgpt.site` |
| Hosted real Codex material | PASS — generated PNG, 2,017,411 bytes, 1214x1295, exact hash `sha256:cd5e0ea067c4ec5c954443b9184b7d1de2a705000a295ce4047bb5ea770093d4`; staged preview `/private/tmp/fogwood-hosted-real-material-staged.png`; selected editable result `/private/tmp/fogwood-hosted-real-material-selected.png` |
| Hosted Apply / Undo / persistence | PASS — Apply changed revision and produced one image plus one referenced local asset; one Undo returned the exact prior revision and removed both; re-Apply survived reload with the same revision and material identity |
| Hosted context concurrency | PASS — selecting the generated material changed only `context_token`; a proposal using the prior token returned `STALE_CONTEXT`, left the content revision unchanged, and created no review state |
| Independent verifier | PASS — rejected two label/binding contract gaps, rechecked their red-first repairs, then found no remaining P1/P2; supplied desktop and mobile evidence are native-tldraw and anti-dashboard |

## Current risks and explicit boundaries

- Live Codex image generation is qualified for one PNG artifact through the
  Browser-mediated bridge. Research, other external providers, other MIME
  paths, and broader host capabilities are not implied by that result.
- Page registration, Browser exposure, conversation inventory, and successful
  invocation are separate evidence layers.
- Browser or hosted qualification does not follow from local tests/builds.
- The full example corpus remains vocabulary and provenance; it is not a claim
  that every upstream demonstration or SDK feature runs in Fogwood.
- Persisted pages and old ledgers may contain historical block, recipe, or
  snapshot records; compatibility means reading them safely, not reviving old
  dashboard UI or executable runtime paths.
- The production Browser profile already contained legacy device-local canvas
  matter under `open-surface-local`, which version 13 correctly preserved.
  Fresh-profile blank-first-run behavior remains qualified on the isolated
  local origin; the current hosted screenshots and inspect call qualify exact
  deployment, migration compatibility, rendering, and WebMCP exposure rather
  than a pristine first visit.

## Historical qualification archive

The sections below preserve evidence and provenance from earlier phases. Their
old PASS statements describe the candidate and boundary named in each section,
not the current autophagy candidate. Current status is governed by the matrix
above.

## Product decision

Fogwood opens as an ordinary blank tldraw canvas. Codex participates through a
bounded WebMCP protocol; it does not receive a dashboard, public template
gallery, signature composition, or first-run demo as the default artifact. The
official tldraw examples library is a pinned Example corpus, not executable
source. Every exact Example ID is callable through one versioned Route; eight
Adapter Families translate Routes into bounded local seams or explicit
observed-host requirements without exposing arbitrary Editor methods.

Existing blocks, materials, compositions, instruments, receipts, and Bazaar
packages remain internal regression coverage. New exact execution adapters may
deepen a Route without changing the public protocol shape.

## Public architecture

| Layer | Contract |
| --- | --- |
| Inspect | `fogwood-inspect` returns bounded live page state, an opaque `content_revision`, and a separate opaque `context_token`. |
| Discover | `fogwood-capabilities` searches the pinned 213-entry Example corpus, reports contextual semantic availability, plans exact native commands, or uses `route` mode to compose any exact Example Routes. |
| Stage | `fogwood-propose` validates a proposal against the inspected revision/token pair and stages it without mutation. |
| Decide | Page-owned Apply revalidates and commits one editor transaction / one undo step; Reject does not change the page revision. |

The public proposal schema accepts exactly one `canvas_ops`,
`seeded_composition`, or `add_materials` action. The Canvas Protocol operation vocabulary is:
`create`, `draw`, `connect`, `variant`, `update`, `resize`, `align`,
`distribute`, `stack`, `pack`, `group`, `ungroup`, `reorder`, and `delete`.
Targets are current shape IDs or
`semantic:<stable-id>` references, including matter created earlier in the same
proposal.

## Full-surface Route compiler

- Route schema: `fogwood.example-route.v1`; plan schema:
  `fogwood.surface-plan.v1`; compiler version: 1; registry version: 7.
- The compiler asserts the exact source commit, a pinned ordered-path
  fingerprint `667bfdca`, and a pinned path-to-family matrix fingerprint
  `ffacafa3`; preserving-count corpus or family drift fails module
  initialization instead of silently inheriting a wildcard adapter.
- Every Route is immutable, callable, and names its Adapter Family, execution
  lane, fidelity, lowering seam, allowed operations, authority, source commit,
  and boundary.
- Eight families partition the corpus exactly: native canvas 13; local
  material/artifact 9; editor introspection 4; control plane 70; trusted
  extension/compound 81; local persistence 6; collaboration/identity 20;
  external active content 10.
- `callable` means `fogwood-capabilities` can select and compile the exact Route.
  It does not mean upstream Example code ran or that a required live host exists.
- Native/control/extension Routes lower only to the closed Canvas Protocol;
  material Routes lower to bounded local material or export seams; read and
  persistence Routes remain non-mutating; collaboration Routes require an
  observed host; active content must return through the sanitized local
  artifact bridge.
- A Route plan is bounded to 24 exact Example IDs, revision/context keyed,
  deterministic, deep-frozen, and always reports `page_mutated: false`.
- Example source is never imported, evaluated, fetched, embedded, or executed.
- Three Examples retain exact local Example-to-primitive fixtures:
  align/distribute, create-arrow, and z-order. The other Routes qualify their
  family/lowering contract and explicitly report reduced fidelity or host
  mediation where applicable.
- Fidelity counts are exact local 3, bounded family route 180, and host-mediated
  30. Read continuations emit only schema-valid empty `fogwood-inspect` input;
  route-specific projection names remain explanatory metadata, not undeclared
  public tool arguments.
- Proposal continuations are deliberately reported as `proposal_contracts`,
  not executable calls: they name the exact `fogwood-propose` action type and
  route-allowed operations, and require Codex to compile bounded arguments from
  the inspected canvas before staging. Host work remains separate in
  `host_requirements`.
- The 180 bounded Routes intentionally share deep family adapters instead of
  duplicating 180 thin handlers. Their exact IDs, source evidence, adapter,
  operation vocabulary, and authority boundary are callable and testable; they
  do not claim route-specific upstream behavior. This family-projection seam is
  accepted for the full-surface addressing phase. Future request traces deepen
  individual adapters without making the rest of the corpus undiscoverable.

## Capability-planning tracer bullet

- Canonical language is recorded in `CONTEXT.md`: Intent, Canvas Fact,
  Capability, Host Capability, Route, Adapter Family, Adapter, Recipe, Example,
  Material, Plan, Proposal, and Qualification.
- `fogwood-capabilities` retains one public tool and has `search`, `available`,
  `plan`, and `route` modes. Availability, planning, and routing take the inspected
  `base_revision` / `context_token` pair; planning also takes bounded intent, scope,
  optional desired effects, a planned-item count when new matter must satisfy
  target preconditions, and a step limit.
- The immutable `fogwood.capability.v1` planning ontology carries version 2 and
  qualifies nine local capabilities: create, draw, edit, delete, arrange,
  native bound connector creation, preserved variant creation, group/ungroup,
  and reorder. Seeded remix is a separately discoverable compositional action
  and does not enter the v1 planner. A compound fixture deterministically resolves to
  `matter.native.create -> layout.arrange -> connector-arrow.create -> layer.reorder`.
- Two ordinary-language traces are frozen as adapter acceptance cases.
  `Connect these selected ideas` selects only `connector-arrow.create@2` and
  lowers to one `connect` operation. `Make a preserved variant of this selected
  idea` selects only `matter.variant.create` and lowers to one `variant`
  operation; manifest supersession prevents the generic create capability from
  being added as a competing step.
- Planning is pure, deterministic, and shadow-speculatable. Every selected
  canvas mutation is device-local, revision-keyed, and `speculation: never`.
- A Plan never stages or mutates. Its next call remains `fogwood-propose`, and
  the existing page-owned Apply/Reject lifecycle is unchanged.
- ADR `docs/adr/0001-plan-with-a-capability-graph.md` records why a graph was
  chosen over 213 flat tools, a combinatorial decision tree, or unconstrained
  model selection.
- ADR `docs/adr/0002-contextual-broker-behind-stable-webmcp-tools.md` records
  why context-specific semantic commands remain behind three stable transport
  tools instead of dynamic registration or direct Editor writes.

Responsibility graph actually used: independent `luna_max_fast` read-only
scouts for ontology semantics, integration seams, context-token design, Canvas
Protocol safety, native binding behavior, preserved-variant behavior, and real
request traces; scoped builders for the earlier broker; coordinator-owned
sequential red-green repair and browser integration; and an independent final
verifier after each candidate was frozen.

## Seeded composition grammar

### Product and routing decision

- A seed is a compositional input, not an epistemic or authority input. It is
  admitted only after capability, exact scope, locks, safety, permissions, and
  page authority are fixed.
- Version 1 never uses a seed for capability routing. A future router may use it
  only to break a tie between approaches with the same qualification,
  permissions, and preservation contract. It may never select factual claims,
  safety outcomes, permissions, semantic IDs, targets, or Apply authority.
- The smallest public vertical is one `seeded_composition` action behind the
  existing `fogwood-propose` tool. No new WebMCP transport tool, runtime code
  loader, template registry, or arbitrary random escape hatch was added.

### Exact request and normalized evidence

The raw request is bounded to:

```json
{
  "type": "seeded_composition",
  "scope": { "kind": "selection" },
  "seed": "bounded inert text or a safe integer",
  "wildness": 0.5
}
```

An explicit scope may instead contain one to eight unique stable semantic IDs.
The normalized action records schema `fogwood.seeded-composition.v1`, grammar
`remix`, algorithm version `1`, PRNG `xorshift32-v1`, source revision, a SHA-256
source fingerprint, normalized seed and wildness, ordered target IDs, the
branch-cluster/open-space decision, exact lineage, and the fully lowered Canvas
Protocol operation list. Proposal receipts bind the same evidence with a
separate SHA-256 digest.

### Determinism, preservation, and limits

- Identical algorithm version, seed, wildness, and inspected input produce a
  canonical-equal plan independent of source enumeration order. Different
  seeds vary geometry and style while preserving the same semantic identities.
- Variant semantic IDs derive from the source fingerprint, source semantic ID,
  and algorithm version—not from seed or wildness. The seed cannot affect
  identity or authority.
- The grammar preserves exact source shapes and creates separately editable
  descendants. Manual source geometry is never moved. Locked shapes, locked
  ancestors, nested targets, rotated sources, unsupported types, legacy or
  duplicate identities, stale state, and sealed open space fail before stage or
  before Apply with no page mutation.
- Source scope plus every bounded clone-relevant target field are covered by
  the source fingerprint. Duplicate native IDs fail before map construction.
  Final rotated footprints are checked against every current-page obstacle and
  sibling variant before a candidate side is accepted.
- `wildness` is finite and bounded to 0..1. At zero, the grammar only offsets
  preserved variants; it does not change their scale, rotation, color, or fill.
- Input is capped at eight targets, 5,000 inspected shapes, a 96-character seed,
  24 lowered operations, a 100,000-coordinate envelope, 5,000-pixel variant
  offset, 16–5,000-pixel dimensions, 15-degree output rotation, and 20% scale
  departure. Oversized scope arrays are refused before element traversal.
- Independent SHA-256-derived PRNG streams prevent one compositional dimension
  from perturbing the others. Production seeded planning contains no
  `Math.random()` call.
- Replanning and canonical comparison occur at stage and again immediately
  before Apply. Accepted variants are committed by the existing single editor
  transaction and history boundary. Reject leaves the revision unchanged; Undo
  restores the exact original page.

### Qualification evidence

- Focused public tests: 77/77 pass across seeded compilation, runtime schema and
  revalidation, surface lifecycle, receipt recorder, and receipt ledger.
- Full `npm test`: 234/234 pass, including the Bazaar compiler precheck.
  `npx tsc --noEmit`, `npm run lint`, and `npm run build` all exit 0. Build has
  only the existing chunk-size and vinext route-classification warnings.
- Fresh local Browser origin: `http://localhost:4197/`. The page reported exactly
  three registered Fogwood page tools; Browser host exposure separately listed
  exactly those three tools, and harmless `fogwood-inspect` and
  `fogwood-propose` calls succeeded. Direct conversation inventory remains a
  separate unqualified layer.
- A fresh post-repair request (`final-forest-13`, wildness `0.83`) staged three
  variants from an explicit stable three-source scope without mutation. The
  review dock showed algorithm version, seed, wildness, three branches, bottom
  open side, source revision, and every source-to-variant lineage pair.
- Apply moved the page from six to nine native shapes while all three sources
  retained their exact text. One toolbar Undo returned to the exact six-shape
  revision with zero final-seed variants; Redo restored nine; reload preserved
  the nine-shape revision and all three provenance records. A second proposal
  was rejected with revision and count unchanged. A pre-Apply revision returned
  `STALE_STATE`. Browser warning/error log: none.
- Screenshots: `/private/tmp/fogwood-seeded-final-staged-4197.png`,
  `/private/tmp/fogwood-seeded-final-applied-4197.png`, and
  `/private/tmp/fogwood-seeded-final-reloaded-4197.png`.
- Independent final verification: PASS after reproducing and repairing seven
  P2 candidates. The verifier separately exercised both valid source-scope
  mutation directions, exact text/meta fingerprinting, duplicate native IDs,
  100 rotated/inter-variant collision cases, 422 accepted scale cases, receipt
  sidecar rebinding, and guarded oversized explicit/selection arrays. No P1/P2
  remains in the bounded local vertical. Browser evidence above was coordinator
  replayed and was not independently browser-certified.
- Preservation checkpoint before this slice: commit `5c09409` (`feat: add
  Fogwood dynamic semantic control surface`). Seeded changes remain a distinct
  working-tree candidate during qualification.
- ADR `docs/adr/0004-seed-composition-after-authority.md` records the routing
  boundary and rejected alternatives.

## Limits and refusals

- At most 24 operations per proposal.
- At most 64 targets per operation.
- At most 256 points per drawing.
- Consecutive drawing-point deltas are bounded to the largest finite Float16
  value (65,504) used by tldraw's encoded draw segments.
- At most 5,000 current-page context items and 5,000 ordered selection IDs in
  the context digest; inspect returns at most a 128-ID selection preview with
  explicit completeness.
- Coordinates are bounded to ±100,000; dimensions are 16–5,000; final rotated
  shape footprints must also remain inside the page envelope; text is at most
  2,000 characters.
- Because the inspected v0.1 model intentionally exposes page-axis-aligned
  bounds rather than arbitrary local geometry, changing the rotation of an
  already rotated existing shape is refused. Unrotated shapes may be rotated;
  a later local-geometry projection can expand this safely.
- Sparse operation arrays, duplicate semantic IDs, unknown targets, missing
  page scope, locked shapes/ancestors/descendants, unsupported note/group
  resize, unsafe structural edits, non-leaf deletion, collateral deletion,
  arbitrary code, and remote fetches are refused before Apply.
- Existing generated-material limits and SVG/raster sanitization remain in
  force for the internal `add_materials` proposal action.
- A connector accepts exactly two distinct, direct-page, unlocked, unrotated,
  bindable native targets. The page preflights `canBindShapes` before stage and
  Apply, then creates one native arrow and verifies exactly two native arrow
  bindings with the reviewed endpoints and terminals in the transaction. A
  silent partial binding result removes the connector and fails Apply. Grouping
  or deleting bound matter is refused rather than hiding binding collateral.
- A variant accepts exactly one direct-page, unlocked, unrotated native geo,
  note, text, frame, image, or draw shape; image variants require the referenced
  local asset as a supported, canonical, byte/dimension-bounded inline data
  source. SVG variants additionally require Fogwood's sanitized material proof.
  Variant lineage requires an explicitly stable semantic-ID source and refuses
  legacy shape-ID fallbacks. It preserves the source, creates one separately
  addressable clone, strips relationship metadata and bindings, records stable
  lineage, and bounds each offset component to ±5,000.

## Examples source

- Source: <https://github.com/tldraw/tldraw/tree/a30c9c8b9c16555d91625e8137826496326898cf/apps/examples/src/examples>
- Installed SDK: `tldraw@5.3.2`
- Indexed entries: 213
- Callable Route descriptors: 213
- Exact qualified adapters: 3 (`align-and-distribute-shapes`, `create-arrow`,
  and `z-order`)
- Family-qualified bounded-native/read/material Routes: 180
- Host-mediated collaboration or active-artifact Routes: 30
- Runtime behavior: local data-only search/Route compilation; no source download
  or code execution
- Execution claim: all exact IDs are callable through the Route compiler. Exact
  local equivalence, family lowering, observed host readiness, page staging, and
  successful Apply remain distinct evidence.

## Host envelope

| Evidence layer | State |
| --- | --- |
| Page registration | Qualified locally: exactly 3 tools registered at the current fresh origin `http://localhost:4197/` |
| Browser / host exposure | Qualified in the Codex in-app Browser for `http://localhost:4197/`; all three historical registry-v6 tools were surfaced through the Browser WebMCP bridge |
| Conversation tool inventory | Not qualified as direct top-level conversation tools; the calls were mediated by the Browser plugin |
| Harmless successful WebMCP call | Qualified for registry v6: current `fogwood-inspect` and `fogwood-capabilities({mode:"route"})` calls returned valid live results without changing the page; earlier plan/propose/Apply/Reject evidence remains separately recorded |
| Image generation or other external capability ingestion | Out of scope for this reduced phase |
| Push / deployment | Not authorized by the current correction request |

Current-phase host-envelope/v1 qualification:

- Page registration and Browser exposure are current-origin qualified at
  `http://localhost:4197/`. `route` is a mode of `fogwood-capabilities`, not a
  fourth tool.
- Full Example Route compilation is local-qualified at 213/213 exact ID
  equality, eight family counts, source fingerprint, immutable lowerings, and
  stale/resource refusal.
- Registry-v6 Route mode was successfully called through the Browser bridge.
  It mixed one exact native route, one bounded local-artifact route, and one
  host-required collaboration route in source order while leaving revision,
  context token, and zero-shape page state unchanged.
- Conversation inventory remains unqualified; page registration and Browser
  exposure are separate layers.
- No collaboration/identity provider or active-content provider is currently
  observed. Those Routes return typed host or local-artifact requirements.

## Current full-surface compiler qualification

- Full test suite: 218 passed, 0 failed.
- New full-surface suite: 7 passed, 0 failed, including exact 213-ID equality,
  exact source-path selection for every Route, eight-family counts, lowering
  seams, deterministic compound routing, host requirements, and adversarial
  stale/unknown/sparse/oversized refusal.
- Frozen candidate: combined full-surface/catalog/page-tool tests passed 52/52;
  full `npm test` passed 218/218; `npx tsc --noEmit`, `npm run lint`, production
  build, Bazaar compiler check, and `git diff --check` all passed after the
  Browser replay. The build emitted only the known chunk-size and static route
  classification warnings.
- Independent final acceptance: PASS after one repair cycle. The first
  read-only audit rejected 29 overclaimed fidelity labels, invalid inspect
  continuations, and incomplete drift identity. TDD repairs reduced exact
  fidelity to the three exact fixtures, separated valid read calls from
  proposal contracts, and pinned source/path/family identity. The same
  independent verifier then reran the full 218-test and focused 52-test gates,
  typecheck, lint, build, Bazaar compiler, and diff check; probed 213/213 set
  equality, 3/180/30 fidelity, 14 read continuations, 169 proposal contracts,
  30 host requirements, deep freezing, and three-tool registration; and
  reported no P1/P2.
- The responsibility graph uses only `luna_max_fast` children: four independent
  read-only Interface designs/audits, three read-only schema/compiler/acceptance
  scouts, coordinator-owned sequential TDD and shared-tree changes, and an
  independent final verifier after the candidate freezes.

## Qualification record

Current request-trace adapter slice:

- Full test suite: 210 passed, 0 failed, including planner specificity,
  connector/variant pure planning, unsafe endpoint/source matrices, stage/Apply
  parity, native binding creation, inspectability, one-step Undo, lineage,
  asset refusal, bound-structure collateral, and all prior regressions.
- Focused planner/Canvas Protocol/page-adapter suite: 60 passed, 0 failed.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed.
- `npm run build`: passed; the existing chunk-size and vinext
  route-classification warnings remain non-fatal.
- `node scripts/compile-bazaar.mjs --check`: passed, 7 packages at
  `sha256:3dcaddef57608136e331a49975f9b176f5c4261180163eadbe6ef471646a596a`.
- `git diff --check`: passed.
- Browser at fresh local origin `http://localhost:4195/`: passed exactly three
  registered page tools, harmless inspect/available/plan/propose calls, exact
  request-trace routing, page-owned proposal review and Apply, two native binding
  records, one-endpoint movement with the other endpoint stationary, independent
  variant movement with the source unchanged, and reload persistence of all four
  semantic IDs, lineage, and bindings. Current-origin warnings/errors: none.
- Browser Undo was not invoked against the local persisted document; one-step
  connector and variant Undo remains covered by focused editor-history tests.
- The first independent adapter verifier returned NOT PASS with three P2s:
  remote image URLs could masquerade as local variant assets, `createBindings`
  could silently retain only one connector terminal while Apply reported
  success, and legacy fallback IDs could seed stable lineage. Three failing
  regression tests reproduced those exact paths; the candidate now refuses all
  three. The full 210-test and focused 60-test gates plus typecheck, lint, build,
  catalog compiler, and diff check pass after repair.
- Independent final acceptance: PASS for this request-trace slice. A fresh
  read-only verifier reran all 210 tests, the focused 60-test suite, typecheck,
  lint, production build, catalog compiler, and diff check. Direct probes
  confirmed valid bounded inline PNG variants, refusal of remote assets and
  legacy lineage roots, and cleanup/refusal when binding adapters produced
  fewer, mismatched, or more than the exact two reviewed connector bindings.
  It reported no P1/P2 and changed no files.

Previously qualified contextual-broker phase:

- Combined planner/runtime/Canvas Protocol/page-adapter qualification: 60 passed,
  0 failed.
- Full test suite: 193 passed, 0 failed.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed.
- `npm run build`: passed; the existing chunk-size and vinext
  route-classification warnings remain non-fatal.
- `node scripts/compile-bazaar.mjs --check`: passed, 7 packages at
  `sha256:3dcaddef57608136e331a49975f9b176f5c4261180163eadbe6ef471646a596a`.
- `git diff --check`: passed.
- Browser: passed live three-tool registration, inspect, contextual availability,
  compound planning, stale-context refusal, proposal preview, Apply, Reject,
  one real human spatial edit, a follow-up proposal derived from that edit, and
  reload persistence. The applied page contained three native editable shapes
  and no current-origin console warnings or errors. One-step Undo remains proven
  by the focused transaction test and was not invoked against browser-local data.
- Safety red tests first reproduced final-footprint overflow, locked-descendant
  mutation, mode-dependent structural no-op, unsupported resize, missing
  page-scope, and rotated-AABB update failures. The candidate now fails each
  closed before staging or Apply. The independent safety re-audit confirmed the
  first repair set, found the rotated-AABB defect and an over-broad edit
  operation claim, and those two findings are now covered by focused tests.
- Independent final acceptance: PASS. The read-only verifier reran the full
  193-test suite, typecheck, lint, production build, Bazaar compiler check, and
  diff check; audited the three-tool surface, schemas, revision/context
  separation, planner, lifecycle, safety bounds, and blank first-run shell; and
  reported no P1/P2. It did not replay browser mutations or qualify deployment.

Previously qualified empty-canvas phase:

- Focused protocol/runtime/transaction tests: 27 passed, 0 failed.
- Full test suite: 160 passed, 0 failed.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed.
- `npm run build`: passed; the known chunk-size and vinext route-classification
  warnings remain non-fatal.
- `node scripts/compile-bazaar.mjs --check`: passed, 7 internal packages at
  `sha256:3dcaddef57608136e331a49975f9b176f5c4261180163eadbe6ef471646a596a`.
- `git diff --check`: passed.
- Independent read-only verification: passed after direct worst-case probes of
  64-target layouts and tldraw drawing-delta encoding. Computed layout overflow
  is refused as `LAYOUT_COORDINATE_LIMIT`; draw deltas above 65,504 are refused
  as `DRAW_DELTA_LIMIT`; oversized point arrays are rejected before traversal.
  No P1/P2 remained in the assigned boundary.

## Browser evidence

Fresh-origin desktop rendering at `http://localhost:4191/` showed a blank white
tldraw canvas, native editor chrome, and one small top-center Fogwood status
mark. No gallery, cards, columns, seeded shapes, narrative sidebar, Bazaar, or
dashboard controls were present.

- Blank canvas screenshot: `/private/tmp/fogwood-blank-canvas.png`
- Applied native matter screenshot: `/private/tmp/fogwood-proposal-applied.png`
- Reload persistence screenshot: `/private/tmp/fogwood-reload-persistence.png`
- Browser DOM exposed exactly `fogwood-inspect`, `fogwood-capabilities`, and
  `fogwood-propose`.
- A prior Browser run paginated all 213 unique Example IDs. Its historical 4194
  status counts predate the full-surface Route compiler and are superseded by
  the current local 213/213 Route tests.
- Reject preserved the exact revision and zero-shape page.
- Apply created three native records (two editable geometry children and one
  group); one tldraw Undo restored the exact zero-shape revision.
- A second accepted two-shape proposal survived page reload with both semantic
  IDs intact.
- A note with an unsupported `fill` was refused as `INVALID_PROPOSAL` before a
  review panel or canvas mutation appeared.

Earlier capability-planning Browser run at fresh origin
`http://localhost:4193/` (superseded by the 4194 qualification below):

- Exactly three page tools were registered: inspect, capabilities, and propose.
- Live inspect reported ontology v1 with seven qualified Capabilities and the
  historical pre-Route Example status counts. That evidence is retained only as
  phase provenance and does not describe the current registry.
- A compound intent planned exactly
  `matter.native.create -> layout.arrange -> relation.connect -> layer.reorder`
  with pure deterministic shadow planning and `speculation: never` on every
  mutating step. The revised public schema exposed `planned_item_count` with a
  0-64 bound; omitting it from a new create-and-arrange request returned
  `PLANNED_TARGET_COUNT_REQUIRED` rather than an overconfident Plan.
- `fogwood-propose` staged the exact five-operation `canvas_ops` proposal; the
  page preview named all three additions, the z-order update, and the alignment
  move before Apply.
- Page Apply changed the revision and produced three native shapes with stable
  semantic IDs. The tldraw Undo control became enabled; one-step Undo remains
  covered by the focused transaction test.
- Browser console warnings/errors: none.
- Screenshot: `/private/tmp/fogwood-contextual-broker-applied.png`.

Current full-surface Route Browser run at fresh origin
`http://localhost:4197/`:

- Browser discovery surfaced exactly `fogwood-inspect`,
  `fogwood-capabilities`, and `fogwood-propose`; the capability schema exposed
  `search`, `available`, `plan`, and `route` without registering a fourth tool.
- Inspect reported catalog count 213, `{callable: 213}`, Route schema
  `fogwood.example-route.v1`, Route count 213, and eight adapter families.
- A live `route` call composed exact IDs for align/distribute,
  export-canvas-as-image, and collaboration/commenting. It returned
  `fogwood.surface-plan.v1` with status `ready-with-host-requirements`.
- Fidelity was reported separately as `exact`, `bounded-native-equivalent`, and
  `host-mediated`. The native route returned a `fogwood-propose` contract for
  `canvas_ops` / `align, distribute`; the local image-export route returned one
  schema-valid `fogwood-inspect({})` call; collaboration remained
  `host-required` with an explicit host-inventory recovery path.
- The returned local inspect continuation was called successfully and returned
  the same current revision and zero-shape page state.
- The call reported `page_mutated: false`. Before and after content revision
  remained `fogwood-agent-runtime/2-e13d8f267fc2064c`, context token remained
  `7c034a962de64e70`, and shape count remained zero.
- Browser console warnings/errors: none (only Vite debug and React DevTools
  informational messages).
- Screenshot:
  `/var/folders/br/v6yyf61s62s7z0v7yhkvfx6r0000gn/T/fogwood-full-surface-webmcp-repaired.png`.

Current dynamic semantic-control Browser run at fresh origin
`http://localhost:4194/`:

- Browser discovery surfaced exactly `fogwood-inspect`,
  `fogwood-capabilities`, and `fogwood-propose`.
- Blank context made only create/draw available; one selected shape made
  edit/reorder/delete available; two selected shapes made all eight semantic
  capabilities available.
- Changing selection preserved the content revision but changed the context
  token. Reusing the old token returned `STALE_CONTEXT` with an inspect-and-retry
  recovery instruction.
- A compound request planned create, arrange, visual connector, and reorder.
  The first exact proposal was correctly refused for two no-op operations; the
  corrected proposal staged a three-add / one-move / one-update preview and page
  Apply produced three native shapes with stable semantic IDs.
- A real keyboard nudge moved `idea:seed` from x=220 to x=221. The next staged
  mutation exposed the exact human-edited before-state `{before:221, after:301}`.
  A later selection-only change did not invalidate Apply of those reviewed IDs.
- Reject preserved the exact revision and x=301. Reload preserved the same
  revision, all three semantic IDs, and geometry.
- Current-origin browser console warnings/errors: none.
- Review screenshot: `/private/tmp/fogwood-semantic-review-4194.png`.
- Applied/reloaded screenshot:
  `/private/tmp/fogwood-dynamic-semantic-surface-4194.png`.

Request-trace adapter Browser run at fresh origin
`http://localhost:4195/`:

- Browser discovery surfaced exactly `fogwood-inspect`,
  `fogwood-capabilities`, and `fogwood-propose`; inspect reported Canvas Protocol
  v2, ontology v2, registry v5, and nine qualified Capabilities.
- With exactly two selected shapes, `Connect these selected ideas` planned only
  `connector-arrow.create@2 -> canvas-ops.v2/connect`. The staged diff previewed
  one bound connector before page Apply.
- Apply created one native arrow and exactly two native tldraw bindings. Moving
  only the Fungi endpoint by 120 page units left City stationary, changed the
  arrow's inspected bounds, and retained both start/end bindings.
- With exactly one selected source, `Make a preserved variant of this selected
  idea` planned only `matter.variant.create -> canvas-ops.v2/variant`; generic
  creation was superseded. The staged diff previewed preserved lineage and an
  in-plan text/style mutation.
- Apply retained the original `trace:fungi`, created separately editable
  `trace:fungi-transit` with `lineage_source_id: trace:fungi`, and left the clone
  unbound. A real drag moved only the variant while the source and connector
  remained unchanged.
- Reload preserved four stable semantic IDs, two native bindings, the variant's
  position and lineage, and the source/connector state. Browser warnings/errors:
  none.
- Bound-connector screenshot:
  `/private/tmp/fogwood-bound-connector-follow-4195.png`.
- Variant and source screenshot:
  `/private/tmp/fogwood-request-traces-4195.png`.
- Reloaded persistence screenshot:
  `/private/tmp/fogwood-request-traces-reloaded-4195.png`.

## Browser rejection test

The first rendered page must be a blank tldraw canvas with native editor chrome
and at most minimal Fogwood status / proposal review UI. It fails if it opens
with cards, columns, a gallery, a seeded composition, a sidebar narrative, or
dashboard-like explanatory furniture.

## Remaining boundaries

## Origin-tagged changes-since inspection — issue #5

`fogwood-inspect` now owns an optional bounded delta lane without adding a
fourth tool. The page-local `fogwood.change-ledger.v1` retains at most 256
entries and 512 KiB across at most eight device-local pages. Entries cap native,
semantic, and relationship identities at 64 each and say when that projection
is incomplete. `since_sequence`, `change_page_size`, and `change_cursor` return
recent changes or `CHANGE_CURSOR_EXPIRED` with an explicit full-inspect recovery.
The canvas remains authoritative; the ledger cannot mutate it or authorize
Apply.

The public tldraw `Store.listen({scope:'document'})` adapter ignores ephemeral
instance records, filters active-page document records, and assigns `human`,
`fogwood:<plan_id>`, `system:undo`, `system:redo`, or `system:migration` origins.
Exact revision history distinguishes Undo and Redo without treating the ledger
as history authority. Inspect also returns auto-acknowledged Fogwood sequences
separately from wake-worthy human/system sequences, so a relay can carry only
binding ID, latest sequence, and revision while canvas facts remain in WebMCP.

Focused tests cover storage retention, byte and identity bounds, pagination,
cursor expiry, reload, page filtering, plan correlation, human changes,
Undo/Redo classification, cleanup, and public inspect compatibility. Local
Browser at `http://localhost:4211/` observed sequence 3 tagged to exact plan
`sha256:394d4196a0463aed53fc0485d27e505ed2da473c5a8ee1f895eaa9a480afb78c`.
A real tldraw selection plus keyboard geometry nudge moved semantic ID
`ledger:claimed-origin` from x=620 to x=621 and `changes-since` returned sequence
4, origin `human`, kind `update`, the native ID, semantic ID, and current
geometry on the same inspect. The in-app Browser surface did not provide a
low-level pointer-drag primitive; the equivalent real user geometry edit is
qualified, while literal drag automation remains a browser-harness boundary.

## Prepared-plan identity and spatial review — issues #2 and #4

Fogwood now assigns every completely prepared plan a page-computed SHA-256
`plan_id` over the bounded canonical plan identity: exact proposal, normalized
actions, frozen Canvas Protocol lowerings, accepted material bytes, seeded
evidence, page/base revisions, preflight, and transaction contract version.
Exact retries while that plan is pending return `ALREADY_STAGED` without a
second pending state or lifecycle event. Divergent retries remain refused.
Stage, Apply, Reject, review UI, and device-local receipts carry the same ID;
knowledge of the ID grants no Apply authority.

The pending plan also contains `fogwood.prepared-canvas-preview.v1`, derived
only from the retained Canvas Protocol plans and prepared material objects that
Apply consumes. The `InFrontOfTheCanvas` overlay renders pointer-transparent
ghost additions, before/after geometry, deletion masks, typed connectors,
regions, and bounded local material thumbnails. It never writes tldraw records,
selection, history, receipts, or revisions and disappears with the sole pending
plan. Rendering tolerance is the browser's sub-pixel CSS/tldraw projection;
page-space bounds and rotations come from the frozen lowering without replanning.

Local qualification on 2026-08-29:

- `npm test`: 226/226 passed.
- `npx tsc --noEmit`, `npm run lint`, `npm run build`, Bazaar compiler check,
  and `git diff --check`: passed; build retained only the known chunk-size and
  route-classification warnings.
- Browser at `http://localhost:4211/` registered exactly the three stable page
  tools. A successful WebMCP proposal staged plan
  `sha256:c7bd7d045a4af1bc89d8cb67fcb78c027eb95233d2f00801789e53bff39d13bf`.
  The rendered canvas contained one overlay with four distinct ghost elements
  for two additions, the connector, and its region/shape treatment. Reject
  removed both overlay and dock; the revision stayed exactly
  `fogwood-agent-runtime/2-e13d8f267fc2064c` and shape count stayed zero.
  A second stage followed by page Apply removed the overlay, created three
  native shapes plus two arrow bindings, and changed the revision to
  `fogwood-agent-runtime/2-fee30fd2cdb91a50`; one `Command-Z` restored the
  exact zero-shape revision.
- Desktop screenshot: `/private/tmp/fogwood-plan-preview-desktop.png`.
- 390x844 screenshot: `/private/tmp/fogwood-plan-preview-mobile.png`; body
  client and scroll widths were both 390 pixels.

This is local rendered and WebMCP evidence, not hosted deployment evidence.

The complete Route corpus is not a claim that all 213 upstream demonstrations
execute locally. It is a complete dynamic addressing and lowering surface over
eight safe adapter families. Host Capability observation, measured cost/latency,
deeper exact adapters, a bounded change ledger, and origin-tagged relay
acknowledgement remain later slices. They are not prerequisites for the current
inspect -> route/plan -> local or observed-host work -> propose -> page-review
loop.

The installed `create-arrow` Example remains evidence for bounded arrow creation,
not proof of bound-connector equivalence; the connector adapter is separately
qualified against installed tldraw binding APIs and real request traces. Future
exact adapters deepen already-callable Routes rather than controlling whether
an Example can participate in planning.

The independent verifier also noted one internal hygiene residual: the
unregistered `PROPOSAL_INPUT_SCHEMA` export is mutable, while every public
registered transport schema is frozen. It has no registered-schema impact and
is not a P1/P2. A pre-existing inline raster asset is bounded and required to
use a canonical supported data URL, but the variant adapter does not re-decode
those raster bytes; malformed-but-canonical persisted raster bytes are a P3
qualification boundary rather than a request-trace blocker. Browser Undo, direct top-level conversation inventory,
deployment, and live external-capability ingestion remain explicitly
unqualified.
