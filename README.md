# Fogwood

Fogwood is an empty, device-local tldraw surface where Codex turns intent and
available capabilities into bounded, editable matter. It is a place to sketch,
juxtapose, connect, annotate, branch, and revise—not a dashboard, template
gallery, raw tldraw SDK facade, or automatic mutation system. The person always
sees a staged change and chooses Apply or Reject.

The current implementation is intentionally small. One page-owned
`FogwoodSurface` holds the only pending review. During staging it prepares and
deep-freezes one `PreparedCanvasPlan`; Apply performs its final revision and
precondition check, then commits the frozen lowering in one `editor.run`
history boundary. If execution fails, tldraw's history mark is rolled back with
`bailToMark`. Reject is side-effect free.

## WebMCP Canvas Protocol

Fogwood registers exactly three stable page tools:

- `fogwood-inspect` reads bounded live canvas facts, selection, semantic IDs,
  relationships, assets, content revision, context token, and the advisory
  medium-participation contract.
- `fogwood-capabilities` discovers the bounded local moves, materials, and
  capability vocabulary relevant to the inspected page. The pinned tldraw
  examples are searchable knowledge and qualification vocabulary, not runtime
  tools.
- `fogwood-propose` validates and stages exactly one public action. It never
  applies a change; page-owned Apply or Reject is required.

The public proposal actions are exactly:

- `canvas_ops` for native tldraw creation, drawing, connection, variants,
  arrangement, grouping, ordering, edits, and deletion. A composition can
  retain stable composition, region, role, rotation, and opacity metadata;
  bound arrows can carry one of the allowlisted typed semantic relationships;
- `seeded_composition` for deterministic, bounded, preserved remixes; and
- `add_materials` for qualified local raster or sanitized SVG material;
- `page_ops` for one deterministic create-and-switch page lifecycle; and
- `camera_ops` for exact reviewed viewport focus without document mutation.

These five action families are versioned semantic lowerers, not Editor method
dispatch. Each owns a closed schema, availability and precondition rules,
frozen lowering, preservation promises, refusal conditions, and qualification
fixtures. New capability families extend this manifest boundary while the
browser still registers only the same three WebMCP tools.

Every staged action is revision-bound, inspected before review, and rechecked
before Apply. Accepted matter remains movable, annotatable, connectable,
branchable, and editable on the canvas.

Geometry-sensitive inspection includes a deterministic
`fogwood.transform.v1` projection with exact local, parent, and page transforms,
page corners, bounds, rotation, lock ancestry, focus, and fingerprint. The
frozen plan uses that projection for nested movement, same-parent rotated
arrangement, preserved variants, and rotated resize. Apply refuses changed
type, parent, lock, or geometry before opening the transaction. Cross-parent
reparenting and changing a nested shape's rotation are intentionally outside
this first exact-transform slice.

The opaque content revision is memoized per current-page document generation.
Repeated inspect, capability, and stage reads reuse the exact canonical bytes;
relevant shape, binding, referenced-asset, page, Undo, Redo, and restore events
invalidate the cache. Camera, viewport, selection, hover, and editing state do
not. This cache is advisory performance infrastructure only: it is neither
persisted evidence nor an authority decision, and stale Apply checks still
compare the independently recomputed current generation.

## Medium participation contract

The inspect response in registry version 8 states the intended operating loop
without turning aesthetic advice into a safety or truth gate. A standalone
generated asset is incomplete: Codex should stage bounded material, wait for
page Apply, re-inspect its stable semantic identity, and then compose editable
native matter around it. Prefer irregular geometry, open space, native shapes,
bound typed relations, questions, annotations, and preserved variants. Avoid
card grids, three-column dashboards, and an isolated pasted asset unless the
person explicitly asks for one.

## Seeded composition

The `remix@1` grammar uses `xorshift32-v1` to vary layout, rhythm, palette,
scale, rotation, and open space while preserving source geometry and lineage.
The same seed, algorithm version, and inspected input reproduce the same plan;
different seeds only change composition. `wildness` is bounded from 0 to 1.
Seeds never choose facts, safety outcomes, permissions, semantic IDs, targets,
or human authority. They may break a future tie only after approaches are
otherwise equally qualified.

## Bazaar and examples

The local Bazaar is a hashed, bounded, code-free collection of knowledge:
materials, moves, adapters, aesthetics, algorithms, provocations, recipes, and
qualification fixtures. Packages describe what a capability can do and what it
does not qualify. They are not executable runtime recipes and the full catalog
is not eagerly imported into the active canvas bundle.

The 213 pinned tldraw example routes remain useful addressing and qualification
vocabulary. They are not 213 registered WebMCP tools and do not claim that
upstream example code executes locally. The browser-facing surface remains the
three tools above.

## Trust boundary

Fogwood accepts device-local, bounded data only. It does not execute generated
JavaScript or HTML, fetch remote URLs, embed untrusted content, or accept active
SVG behavior. Asset bytes are validated, sanitized where needed, hashed over
the exact accepted bytes, and recorded with minimal provenance before Apply.
The existing `fogwood-receipts-local:v1` parser and legacy recipe/snapshot
constructors remain readable. New lifecycle transitions emit one generic
proposal receipt each. New visits use the blank-first `fogwood-local-v2`
device-local canvas. Earlier `open-surface-local` matter is preserved without
deletion or dual writes and remains available through `?legacy=1`; the
surface-block renderer and direct user gestures remain compatible there.

## Run locally

Requirements: Node.js 22.13 or newer and npm.

```bash
npm install
npm run dev
```

`TLDRAW_LICENSE_KEY` may be supplied through local environment configuration
when required by your tldraw license. Do not commit license keys or credentials.

## Verify

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
node scripts/compile-bazaar.mjs --check
git diff --check
```

The current acceptance evidence and explicit qualification boundaries live in
[`acceptance.md`](acceptance.md). Earlier full-surface, request-trace, and
seeded-composition results are retained there as historical provenance.

## License

Fogwood is available under the [MIT License](LICENSE). tldraw's bundled license
notice is preserved separately in `public/tldraw-LICENSE.md`.
