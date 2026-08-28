# Fogwood Capability Planning

Fogwood turns open-ended intent into reviewable canvas changes. Its language
separates what a person wants, what can be done, how it is implemented, and
what the page has authorized.

## Language

**Intent**:
A bounded description of the outcome a person wants from the current canvas.
_Avoid_: Prompt, command, tool request

**Canvas Fact**:
An inspectable truth about the current page that may enable or prevent a capability.
_Avoid_: Hidden state, assumption

**Capability**:
A reusable ability defined by its preconditions, effects, preservation promises, and authority class.
_Avoid_: Example, function, tool

**Host Capability**:
A capability supplied by the live Codex host rather than by Fogwood, whose availability must be observed before use.
_Avoid_: Guaranteed integration, provider

**Adapter**:
A qualified translation from one capability into bounded Fogwood actions.
_Avoid_: Capability, example mapping

**Route**:
An immutable, versioned call record connecting one exact pinned Example to an
Adapter Family, execution lane, lowering seam, fidelity, and authority boundary.
Every pinned Example has a Route; Route selection is not proof that an upstream
demonstration executed.
_Avoid_: Raw Editor method, source import, success claim

**Adapter Family**:
One deep implementation boundary shared by Routes with the same authority and
trust model: native canvas, local material/artifact, editor introspection,
control plane, trusted extension/compound, local persistence,
collaboration/identity, or external artifact handoff.
_Avoid_: One-off Example wrapper, wildcard executor

**Supersession**:
A manifest-level rule saying that one more specific Capability replaces a more general lexical match for the same intent. It is used sparingly; for example, a preserved-variant request selects `matter.variant.create` instead of also selecting generic `matter.native.create`.
_Avoid_: Global priority score, hidden prompt heuristic

**Recipe**:
A reusable ordered graph of compatible capabilities that achieves a higher-level intent.
_Avoid_: Template, dashboard

**Example**:
Pinned source evidence whose exact ID can be routed without importing or
executing the upstream demonstration.
_Avoid_: Raw SDK function, executable source

**Material**:
A bounded local artifact that can become editable or manipulable canvas matter.
_Avoid_: Remote embed, executable content

**Plan**:
An explainable, ordered selection of capabilities whose preconditions and compatibility have been checked against current facts.
_Avoid_: Proposal, unvalidated tool chain

**Availability**:
An advisory statement that a versioned capability's broad preconditions match the currently inspected canvas context. Exact targets are still revalidated when a proposal is staged and applied.
_Avoid_: Permission, proof of execution

**Content Revision**:
An opaque digest of page-authoritative shapes, bindings, and referenced local asset metadata.
_Avoid_: Selection revision, context token

**Context Token**:
An opaque digest of bounded ephemeral state that can change semantic command relevance without changing page content: current page, ordered selection, active tool/path, read-only mode, focused group, and editing shape.
_Avoid_: Content revision, authentication token

**Proposal**:
A revision-pinned plan translated into exact Fogwood actions and staged for page-owned Apply or Reject.
_Avoid_: Plan, automatic mutation

**Qualification**:
The explicit evidence boundary for claiming that a capability, adapter, recipe, or plan works.
_Avoid_: Availability inferred from documentation

**Seeded Composition**:
A reproducible, bounded proposal that preserves exact native sources and creates
editable variants with explicit lineage. The seed influences only compositional
choices after capability, scope, safety, permissions, semantic identity, and
human authority are fixed.
_Avoid_: Random truth, probabilistic permission, template replacement

## Full-surface compiler contract

Fogwood exposes the complete pinned Example vocabulary through one compiler,
while keeping execution small and inspectable:

1. `fogwood-inspect` returns current content revision and semantic context.
2. `fogwood-capabilities` `route` mode accepts bounded intent or exact Example
   IDs and selects up to 24 immutable Routes.
3. Each Route names a concrete lowering seam and allowed operations; no wildcard
   Editor dispatch, generated code, dynamic import, HTML, or remote fetch exists.
4. Local Routes point to Canvas Protocol, materials, inspect, or persistence.
   Collaboration and active-content Routes return typed observed-host or local
   artifact requirements rather than pretending external work happened.
5. Route output separates schema-valid local read calls, bounded proposal
   contracts that still require context-derived arguments, and explicit host
   requirements. The 180 bounded Routes share family adapters and do not claim
   upstream demonstration equivalence.
6. The compiler is pure, deterministic, revision/context keyed, and returns
   `page_mutated: false`.
7. Mutating results still pass through `fogwood-propose`, page-owned Apply or
   Reject, and the existing atomic transaction and Undo boundary.

Real request traces remain acceptance fixtures for exact execution semantics,
not a throttle on Route coverage. `Connect these selected ideas` and `Make a
preserved variant of this selected idea` prove the native transaction seam;
the 213/213 Route matrix proves the full control-surface addressing layer.

## Seed participation contract

Fogwood has one versioned seeded grammar: `remix` with `xorshift32-v1`. The
public request names either the current selection or an explicit list of stable
semantic IDs, a bounded seed, and optional `wildness` from 0 to 1.
Deterministic code validates the exact scope and source state, derives a source
fingerprint, finds bounded open space, and lowers the remix to ordinary Canvas
Protocol `variant`, `resize`, and `update` operations. The normalized action is
replayable and includes its algorithm version, source revision, source
fingerprint, layout decision, and lineage.

The compiler rejects duplicate native or semantic IDs, dimensions outside the
native 16–5,000 range, oversized scopes before traversal, and any candidate
whose final rotated footprint intersects existing matter or another variant.
Receipts retain the exact proposal content hash and an evidence-bound envelope
hash so seed, layout, and lineage cannot be rebound independently.

Seeds do not participate in capability qualification, factual claims, safety,
permissions, semantic identity, target selection, or human authority. In a
future planner they may break a tie only after two approaches have identical
qualification and authority. Version 1 does not use seeds in capability routing
at all. Apply still requires the exact inspected revision and page-owned review;
Reject remains side-effect free.
