# Fogwood Canvas Protocol acceptance

Status: PASS for the bounded local full-surface Route phase. The pinned
213-entry corpus now has one immutable `fogwood.example-route.v1` descriptor per
entry and `fogwood-capabilities` can compose those Routes through a pure
`fogwood.surface-plan.v1` compiler. This is 213/213 addressing and lowering
coverage, not proof that 213 upstream tldraw demonstrations executed locally.
Exact local equivalence, bounded native projection, local read/material,
host-mediated collaboration, and artifact-handoff evidence remain separate.
This is the one authoritative acceptance manifest for the empty-canvas,
capability-ontology, contextual-broker, request-trace, and full-surface phases.

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

The public proposal schema accepts exactly one `canvas_ops` or `add_materials`
action. The Canvas Protocol operation vocabulary is:
`create`, `draw`, `connect`, `variant`, `update`, `resize`, `align`,
`distribute`, `stack`, `pack`, `group`, `ungroup`, `reorder`, and `delete`.
Targets are current shape IDs or
`semantic:<stable-id>` references, including matter created earlier in the same
proposal.

## Full-surface Route compiler

- Route schema: `fogwood.example-route.v1`; plan schema:
  `fogwood.surface-plan.v1`; compiler version: 1; registry version: 6.
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
- The immutable `fogwood.capability.v1` manifest schema now carries ontology
  version 2 and qualifies nine local capabilities: create, draw, edit, delete,
  arrange, native bound connector creation, preserved variant creation,
  group/ungroup, and reorder. A compound fixture deterministically resolves to
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
| Browser / host exposure | Qualified in the Codex in-app Browser for `http://localhost:4197/`; all three registry-v6 tools were surfaced through the Browser WebMCP bridge |
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
