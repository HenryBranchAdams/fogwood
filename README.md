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
  relationships, assets, content revision, and context token.
- `fogwood-capabilities` discovers the bounded local moves, materials, and
  capability vocabulary relevant to the inspected page. The pinned tldraw
  examples are searchable knowledge and qualification vocabulary, not runtime
  tools.
- `fogwood-propose` validates and stages exactly one public action. It never
  applies a change; page-owned Apply or Reject is required.

The public proposal actions are exactly:

- `canvas_ops` for native tldraw creation, drawing, connection, variants,
  arrangement, grouping, ordering, edits, and deletion;
- `seeded_composition` for deterministic, bounded, preserved remixes; and
- `add_materials` for qualified local raster or sanitized SVG material.

Every staged action is revision-bound, inspected before review, and rechecked
before Apply. Accepted matter remains movable, annotatable, connectable,
branchable, and editable on the canvas.

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
proposal receipt each. `open-surface-local`, the surface-block renderer, and
direct user gestures remain compatible with persisted pages.

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
