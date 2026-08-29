# Fogwood context

Fogwood is a device-local, code-free tldraw surface. Its job is to turn a
person's intent and the capabilities available to Codex into bounded editable
matter. The blank canvas is the product; blocks, recipes, and examples are
supporting material. A useful result must remain spatially meaningful when the
person moves, annotates, connects, branches, or mutates it.

Fogwood is not a dashboard generator, template gallery, raw tldraw SDK facade,
or autonomous page writer. Fogwood itself never executes generated JavaScript,
HTML, remote embeds, or active SVG. Codex may use its own tools in its bounded
environment, but the page only accepts constrained local artifacts and
human-reviewed proposals.

## Operating loop

```text
intent or sketch
  -> Codex inspects the live canvas and available host capabilities
  -> Codex discovers local Fogwood materials and spatial moves
  -> Codex creates bounded source material when useful
  -> Fogwood prepares one immutable plan
  -> person reviews and chooses Apply or Reject
  -> person manipulates the canvas
  -> Codex inspects again and branches, annotates, or mutates
```

The page registers exactly three stable WebMCP tools:

1. `fogwood-inspect` — bounded live page facts and revision/context evidence;
2. `fogwood-capabilities` — contextual discovery of local moves, materials,
   adapters, and example/qualification vocabulary; and
3. `fogwood-propose` — validation and staging of one public action.

The only public proposal actions are `canvas_ops`, `seeded_composition`, and
`add_materials`. The WebMCP call cannot apply its own proposal. Apply and Reject
are page-owned decisions.

## Canonical terms

**Intent** — a bounded description of an outcome a person wants from the
current canvas. It is not a hidden command or permission.

**Canvas fact** — a bounded, inspectable truth about the current page, including
shape geometry, stable semantic IDs, relationships, selection, content
revision, and context token.

**Capability** — a reusable ability with explicit preconditions, effects,
preservation promises, and authority class. Availability is advisory; stage
and Apply recheck exact preconditions.

**Host capability** — a capability supplied by the live Codex host. It must be
observed in the current host before use. Page registration, host exposure,
conversation inventory, and a successful call are separate evidence layers.

**Material** — bounded local raster, sanitized SVG-derived output, text, data,
or other artifact that can become editable or manipulable canvas matter. It is
not a remote embed or executable content.

**Spatial move** — a deterministic operation over native matter, such as
scatter, cluster, branch, orbit, montage, trace, annotate, or mutate. Moves
preserve manual geometry and locked objects unless the reviewed proposal says
otherwise.

**Relationship** — a typed, inspectable edge or lineage record such as
`supports`, `contradicts`, `depends_on`, `causes`, `blocks`, `echoes`, or
`mutates_into`.

**PreparedCanvasPlan** — the complete, deep-frozen lowering created during
stage. It contains the proposal, exact revision/context evidence, prepared
materials, seeded evidence, preflight result, transaction contract, and digest.
Apply consumes this plan; it does not decode, reinterpret, or regenerate it.

**FogwoodSurface** — the sole pending-review authority. It owns the staged plan,
publishes it to the page UI, and exposes page-owned Apply/Reject. There is no
second pending controller in the browser.

**Proposal** — a revision-pinned request staged for human review. Staging never
mutates the page.

**Receipt** — device-local evidence of a lifecycle transition. New transitions
emit one generic proposal receipt. The `fogwood-receipts-local:v1` parser,
legacy recipe/snapshot event types and constructors, and old receipt storage key
remain compatible.

**Qualification** — the exact evidence boundary for claiming that a capability
or adapter works. A searchable example or route is not proof that upstream
source executed.

## Prepared-plan invariants

- Stage validates the inspected content revision and context where required,
  prepares all material decoders/lowerings once, and deep-freezes plan-owned
  data before review.
- Apply checks the current revision and exact preconditions immediately before
  one `editor.run` / one history boundary. On an execution error or failed
  postcondition it uses the tldraw history mark and `bailToMark` to restore the
  prior page atomically.
- Reject performs no page mutation. Accepted changes remain one-step undoable.
- Exact accepted asset bytes are bounded and SHA-256 identified. Network URLs,
  scripts, event handlers, external SVG references, `foreignObject`, and other
  active content fail closed.
- Seeded composition uses versioned deterministic randomness only for
  presentation and open-space choices. It cannot choose facts, safety,
  permissions, semantic IDs, targets, or authority.
- User geometry, locked objects, semantic relationships, and prior variants are
  preserved unless an explicit reviewed operation targets them.

## Bazaar and tldraw examples

Bazaar packages are local, declarative, bounded, and content-hashed. They are
knowledge descriptors for materials, moves, adapters, aesthetics, algorithms,
provocations, recipes, and qualification fixtures. They are not executable
runtime recipes and the full generated catalog is not eagerly loaded by the
active page.

The 213 pinned tldraw examples are searchable addressing and qualification
vocabulary. They are neither 213 page tools nor a promise that each upstream
example can execute locally. Any concrete behavior must lower through the
closed Fogwood protocol and remain subject to page review.

## Compatibility boundary

The old `open-surface-local` persistence key and `surface-block` renderer/direct
user gestures remain supported while the public direction stays native-shape
first. Existing block, instrument, material, seeded, receipt, and Bazaar tests
are regression coverage, not the first-run product grammar. Dead dashboard-era
modules and gallery CSS were removed in the autophagy phase; their deletion is
recorded in `acceptance.md`.

## Historical decisions

The prior capability graph, contextual broker, full-example addressing, and
seeded-composition decisions remain in:

- [`docs/adr/0001-plan-with-a-capability-graph.md`](docs/adr/0001-plan-with-a-capability-graph.md)
- [`docs/adr/0002-contextual-broker-behind-stable-webmcp-tools.md`](docs/adr/0002-contextual-broker-behind-stable-webmcp-tools.md)
- [`docs/adr/0003-compile-the-full-example-surface.md`](docs/adr/0003-compile-the-full-example-surface.md), superseded for active runtime execution by ADR 0005
- [`docs/adr/0004-seed-composition-after-authority.md`](docs/adr/0004-seed-composition-after-authority.md), still current for seed routing
- [`docs/adr/0005-prepared-plan-autophagy.md`](docs/adr/0005-prepared-plan-autophagy.md)

Historical qualification results and commit provenance remain in the archive
section of [`acceptance.md`](acceptance.md). They must not be read as current
host, deployment, or upstream-example qualification.
