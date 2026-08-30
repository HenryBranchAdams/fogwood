---
status: accepted
supersedes: 0003
---

# Collapse active runtime around one prepared canvas plan

## Context

Fogwood's earlier full-surface work proved that all 213 pinned tldraw examples
could be addressed by a local vocabulary. It also left too much runtime
machinery: route-shaped execution branches, recipe expansion paths, duplicate
pending state, and a large generated catalog near the browser bundle. That
made the product feel like a tool catalog instead of an empty spatial medium.

The page needs a smaller invariant. Codex should be able to discover knowledge,
prepare a bounded mixture of native operations and local materials, and hand
one reviewable result to the person. The tldraw Editor must remain behind a
trusted page adapter. No route, recipe, or host capability should be able to
mutate the page directly.

## Decision

Use `FogwoodSurface` as the sole pending-review authority. Keep exactly three
stable page tools:

- `fogwood-inspect`
- `fogwood-capabilities`
- `fogwood-propose`

Keep five closed public proposal actions behind the same prepared-plan
authority:

- `canvas_ops`
- `seeded_composition`
- `add_materials`
- `page_ops`
- `camera_ops`

The page and camera families are versioned semantic lowerers. They do not add
new WebMCP tools or bypass review: both still prepare one frozen plan, and the
person still owns Apply or Reject.

At stage, the page adapter validates the request against the inspected revision,
prepares all material decoders and native lowerings once, computes the exact
accepted-byte/provenance digest, and creates a deep-frozen
`PreparedCanvasPlan`. The plan is the object shown to the person for review.

At Apply, the page rechecks the current revision and all target preconditions,
opens one tldraw history boundary, and consumes only the prepared lowerings in
one `editor.run`. If execution or its postcondition fails, the adapter calls
the captured history mark's `bailToMark` and removes only newly created,
unreferenced assets. Reject performs no page mutation. A successful Apply is
one undo step.

The Bazaar and the pinned tldraw examples are knowledge, not active execution
registries. Bazaar packages remain local, declarative, bounded, and
content-hashed. They can describe materials, moves, adapters, aesthetics,
algorithms, provocations, recipes, and qualification fixtures, but they are not
runtime recipes and the generated full catalog is not eagerly imported by the
active page. The 213 examples are addressing and qualification vocabulary, not
213 WebMCP tools or proof of upstream execution.

## Compatibility

This decision does not rewrite persisted user pages. ADR 0008 amends the
storage-identity clause: new visits use `fogwood-local-v2`, while the untouched
`open-surface-local` document remains an explicit `?legacy=1` archive. Keep the
`surface-block` renderer and direct user gestures, and the
`fogwood-receipts-local:v1` parser. Legacy recipe and snapshot receipt event
types and constructors remain readable for old ledgers. New lifecycle
transitions use one generic proposal receipt per transition. Older internal
blocks, instruments, materials, seeded composition, and receipt modules remain
regression-tested compatibility surfaces.

## Rejected alternatives

- Registering one WebMCP tool per example would recreate discovery races and
  expose a noisy, unstable surface.
- Keeping executable recipe and route branches in the page would duplicate
  lowering logic and make it unclear which object owns review state.
- Letting Apply regenerate from a proposal would permit prepared material bytes
  or model choices to change after human review.
- Deleting, rewriting, or dual-writing the old persistence or receipt formats
  would strand device-local work or make authority ambiguous.
- Exposing `call_editor_method`, generated JavaScript, HTML, remote embeds, or
  a dynamic import escape hatch would cross the trust boundary.

## Consequences

The active product becomes easier to reason about: inspect, discover, prepare,
review, apply/reject, then inspect again after human manipulation. New
capabilities should add a bounded material or lowering to the prepared-plan
core, not another runtime facade. Historical full-surface route coverage stays
valuable as vocabulary and evidence, while current runtime qualification is
measured at the three-tool and prepared-plan boundary.
