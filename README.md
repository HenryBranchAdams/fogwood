# Fogwood

Fogwood is an empty, device-local tldraw canvas that Codex can shape through a
small WebMCP protocol. It does not begin with a dashboard, template gallery, or
generated composition. The person starts with the ordinary tldraw surface;
Codex inspects it, discovers relevant canvas capabilities, and stages editable
native matter for the person to apply or reject.

The first version deliberately has one job: turn the broad tldraw SDK Example
corpus into one dynamic semantic control surface without registering hundreds
of unrelated page tools or exposing the raw Editor API.

## WebMCP Canvas Protocol

Fogwood registers exactly three page tools:

- `fogwood-inspect` reads the current page, stable semantic IDs, relationships,
  asset metadata, selection, an opaque content revision, and a separate opaque
  context token for ephemeral selection/tool/mode state.
- `fogwood-capabilities` searches the pinned official tldraw Example corpus,
  reports contextual native commands, or uses `route` mode to resolve and
  compose any of the 213 pinned examples through a bounded Adapter Family.
- `fogwood-propose` stages one proposal bound to both inspected values. It never
  mutates the page; the person must choose Apply or Reject in Fogwood.

`fogwood-propose` accepts a composable `canvas_ops` action. One call may mix:

- `create` and `draw`
- `connect` two exact targets with a native bound arrow
- `variant` one exact source while preserving the source and recording lineage
- `update` and `resize`
- `align`, `distribute`, `stack`, and `pack`
- `group` and `ungroup`
- `reorder`
- `delete`

Created or branched matter receives a stable semantic ID. Later operations in
the same proposal can target it with `semantic:<id>`, so Codex can create,
branch, connect, arrange, style, group, and order a composition in one reviewed transaction. The page replans
against the live revision immediately before Apply, commits the accepted batch
inside one editor transaction and one undo step, and leaves Reject side-effect
free.

This dispatcher is intentionally smaller than 213 individually registered
tools. Every pinned Example has an immutable callable Route, while eight deep
Adapter Families own the actual seams: native canvas, local material/artifact,
editor introspection, control plane, trusted extension/compound, local
persistence, collaboration/identity, and external artifact handoff. The model
interprets intent; deterministic code selects, orders, limits, and explains the
Routes. Routing never stages or mutates the page.

The compiler separates three continuations instead of inventing complete
calls: schema-valid local read calls, bounded proposal contracts that Codex must
fill from inspected canvas facts, and explicit host requirements. The 180
bounded Routes share deep family adapters; they are not 180 wrappers around
upstream source or claims of demonstration-equivalent behavior.

## Capability ontology and Example corpus

The local Example corpus covers all 213 entries observed in the official
tldraw examples source at commit
`a30c9c8b9c16555d91625e8137826496326898cf`. Each record has one
`fogwood.example-route.v1` descriptor with its family, adapter, execution lane,
fidelity, concrete lowering seam, allowed operations, source evidence, and
qualification boundary. The compiler fails closed if the pinned 213-path
fingerprint, source commit, or path-to-family matrix fingerprint changes.

All 213 Routes are callable through `fogwood-capabilities`; source-path intent
can select every exact Route and compound intent can mix Routes from multiple
families. Only three Routes currently claim exact Example-to-local-primitive
equivalence: align/distribute, native arrow creation, and z-order. Other Routes
state whether they use a bounded native equivalent, a local read/material seam,
or an observed host/artifact handoff. The corpus is data only; Fogwood never
downloads or executes Example source.
The raw arrow Example does not certify bound-arrow behavior; the connector
Adapter is separately qualified against the installed tldraw binding APIs.

The `fogwood.capability.v1` manifest schema currently carries ontology version
2 and qualifies nine local Capabilities: create, draw, edit, delete, arrange,
create a native bound connector, create a preserved variant, group/ungroup, and
reorder. Connector and variant adapters were promoted from real request traces:
"Connect these selected ideas" and "Make a preserved variant of this selected
idea." A specific variant match supersedes generic creation rather than
producing two competing steps. `available`, `plan`, and `route` modes require the inspected
`base_revision` and `context_token`. Planning also accepts bounded intent,
scope, optional desired effects, an explicit planned-item count when new matter
must satisfy target preconditions, and a step limit. It returns an ordered Plan,
supporting Examples, explicit execution policy, and the next `fogwood-propose`
call. Pure shadow planning may be speculative; host calls, proposal staging,
and page Apply never are.

Fogwood is a dynamic semantic control surface over tldraw, not a remote Editor
SDK. Context changes which Capabilities are valid, while the three WebMCP
transport tools stay stable. The content revision covers page-authoritative
records; the context token independently covers bounded selection, tool,
read-only, focus, and editing state. Availability and Route selection are advisory and never replace
execution-time precondition checks. A later change ledger or attention relay can
build on this pair without expanding the v0.1 mutation surface.

## Trust boundary

- Canvas content and accepted assets stay device-local.
- WebMCP staging cannot apply its own proposal.
- Every mutation is bounded, revision- and context-pinned before stage, and
  revalidated against page content before Apply.
- Locked shapes, locked ancestors, and locked descendants of indirectly changed
  containers fail before the editor transaction.
- Final shape footprints—not only their anchor coordinates—must remain inside
  the bounded page envelope.
- Rotation changes on already rotated shapes fail closed until the inspected
  model carries exact shape-local geometry instead of only page-axis-aligned
  bounds.
- Generated JavaScript, HTML, remote embeds, implicit fetches, and active SVG
  content are not accepted.
- Page registration, host exposure, conversation inventory, and a successful
  call are separate evidence layers.
- `callable` means the Route compiler accepts and explains that exact Example;
  it does not mean Fogwood executed upstream source or that a required
  host/provider is currently present.

The existing blocks, instruments, receipts, materials, compositions, and
Bazaar packages remain regression-tested internal modules. They are no longer
the public first-run experience.

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
[`acceptance.md`](acceptance.md).

## License

Fogwood is available under the [MIT License](LICENSE). tldraw's bundled license
notice is preserved separately in `public/tldraw-LICENSE.md`.
