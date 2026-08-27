# Fogwood

Fogwood is a device-local, WebMCP-enabled tldraw canvas where a person and an
agent shape the same editable artifact. Fogwood turns Codex capabilities into
editable matter: native shapes, semantic arrows, bounded materials, spatial
moves, and lineage remain visible on the page instead of being flattened into
a dashboard or a generated preview.

The default path is the local, declarative `composition.v2` medium. Three
signature recipes lead the Bazaar:

- `fogwood.fungi-cities-research-world@2` — fungal and urban clusters, bridges,
  evidence/analogy separation, questions, a systems diagram, a speculative
  timeline, and an open image provocation.
- `fogwood.evidence-constellation@2` — claims, sources, counterarguments, and
  questions connected by typed `supports`, `contradicts`, and `depends_on`
  relationships.
- `fogwood.storyworld-mutation-map@2` — branching places, rules, factions,
  portals, tensions, scenes, and a preserved variant lineage.

The four original block recipes remain local, hash-pinned regression fixtures
under **Block regression fixtures**. They are retained for compatibility, not
as the first-run product narrative.

## Codex participation contract

The page owns the artifact and the human decision boundary. A Codex session
should:

1. Inspect the live canvas and spatial state first.
2. Discover bounded materials and moves, then inspect the actual host tools and
   skills just in time. Never claim a host capability without observing it.
3. Use relevant research, code, image, SVG, data, document, and visualization
   capabilities outside Fogwood when they are genuinely available.
4. Return only constrained bytes or data through the Fogwood proposal bridge.
   Live image bytes, if actually produced, enter through `add_materials`; no
   generated image is bundled in this repository.
5. Stage a revision-pinned proposal and stop for the page-owned Apply/Reject
   decision. The agent never applies a proposal.
6. Inspect again after human manipulation, then branch, mutate, annotate, or
   remix. Preserve prior matter and lineage instead of overwriting it.

Page registration, host exposure, conversation inventory, and successful tool
call evidence are separate observations. A registered page tool does not prove
that the current host can see or call it.

## WebMCP surface

Fogwood exposes exactly four page tools through
`document.modelContext.registerTool`:

- `fogwood-inspect` — read bounded live page state, semantic regions,
  relationships, assets, and the opaque content revision.
- `fogwood-capabilities` — search the bounded host-facing capability contract.
- `fogwood-propose` — validate and stage a typed proposal; it never mutates.
- `fogwood-bazaar` — exact-pinned, read-only search/read of local data-only
  packages.

All page mutation goes through the existing proposal lifecycle and page-owned
Apply/Reject transaction. A composition insert creates native shapes and typed
relationship arrows in one undo step.

## Bazaar vocabulary

The Bazaar contains data-only materials, moves, adapters, aesthetics,
algorithms, provocations, compositional recipes, qualification fixtures, and
examples. Catalog entries are local, bounded, canonically hashed, and code-
free. Recipe reads require the exact package ID, version, content hash, and
catalog revision. The page CTA is **Stage composition for review**.

## First run

The blank surface is intentionally sparse: start with a ball of clay and a
fungi/cities spatial seed, sketch before knowing, and leave open space for
later material. Two quieter alternatives are the evidence constellation and
storyworld mutation map. Each CTA stages a proposal for review; it never
auto-applies. Compare & Decide is reachable only as a clearly labelled legacy
regression fixture.

## Trust and qualification boundaries

- Canvas content, image bytes, and receipts stay device-local.
- Bazaar packages contain only bounded data, prompts, examples, fixtures, and
  provenance. They cannot provide executable code, HTML, CSS, scripts,
  formulas, embeds, fetches, or remote loaders.
- Composition adapters, aesthetics, and algorithms reference host-owned IDs
  only. Expansion is deterministic and uses native shape and spatial seams.
- Every proposal is revision-pinned. Apply rechecks the page and records one
  undoable transaction; Reject changes nothing.
- Local checks do not certify host exposure, a live image provider, deployment,
  publication, or a human decision. Those require direct evidence at the
  relevant boundary.

The fungi/cities source notes include these primary references in the bounded
recipe content:

- <https://www.nature.com/articles/s41563-021-01123-y>
- <https://www.nature.com/articles/s41563-022-01429-5>
- <https://repository.naturalis.nl/pub/800999/Verbeek-2025-Arbuscular-mycorrhiza-A.pdf>

## Run locally

Requirements: Node.js 22.13 or newer and npm.

```bash
npm install
npm run dev
```

`TLDRAW_LICENSE_KEY` may be supplied through local environment configuration
when required by your tldraw license. Do not commit license keys or other
credentials.

## Verify

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
node scripts/compile-bazaar.mjs --check
git diff --check
```

## License

Fogwood is available under the [MIT License](LICENSE). tldraw's bundled
license notice is preserved separately in `public/tldraw-LICENSE.md`.
