# Fogwood

Fogwood is a device-local, WebMCP-enabled tldraw canvas where a person and an
agent compose the same editable artifact. The agent can inspect the current
page, discover trusted local capabilities and recipes, and stage bounded
changes. The page shows the diff; only the person can Apply or Reject it.

The result is more than a generated dashboard: spatial relationships,
interactive controls, deterministic derived values, and human-reviewed agent
changes remain part of one editable canvas.

Live Site: [fogwood.madebyhenry.chatgpt.site](https://fogwood.madebyhenry.chatgpt.site)

## Why WebMCP

Fogwood exposes four focused page tools through
`document.modelContext.registerTool`:

- `fogwood-inspect` reads the bounded page contract, semantic canvas state,
  relationships, and an opaque content revision.
- `fogwood-capabilities` searches the immutable local registry of actions,
  primitives, and recipes.
- `fogwood-bazaar` searches and reads hash-pinned, data-only local packages.
- `fogwood-propose` validates and stages a typed change against the inspected
  revision. It can compose bounded blocks and native shapes, insert a pinned
  recipe, or preview declared instrument inputs such as a decision scenario.
  It never applies the change itself.

This small tool surface lets the agent progressively discover richer canvas
behavior without flooding its context with one tool per block, recipe, or
workflow.

## The trust model

- Canvas content and receipts stay on the device.
- Bazaar packages contain data, prompts, examples, fixtures, and provenance;
  they contain no executable modules or network loaders.
- Formulas use a resource-bounded allowlisted AST. There is no `eval`, dynamic
  import, or expression-string execution.
- Typed one-way bindings are validated for declared ports, compatibility,
  unique writers, bounded size, and acyclic topology.
- Every proposal is revision-pinned. Apply rechecks the page and runs as one
  undoable tldraw transaction; Reject changes nothing.
- An append-only local receipt ledger records accepted lifecycle transitions
  and exact hashes/revisions as evidence, never as mutation authority.

## Quick demo

1. Open Fogwood in ChatGPT's in-app browser or a WebMCP-enabled Chrome build.
2. Ask ChatGPT to inspect the blank page and find the pinned Compare & Decide
   package.
3. Let it stage the recipe, inspect the visible diff, and press **Apply** on the
   page.
4. Ask ChatGPT to inspect again and stage the typed scenario “Cost weight 0.8,
   Impact weight 0.2” using the exact live control IDs. The review shows the
   deterministic forecast before the canvas changes: Alpha `74 → 88`, Beta
   `78 → 76`, recommendation `Beta → Alpha`.
5. Choose **Apply** or **Reject** yourself. One Undo restores the applied
   scenario, and the device-local receipt ledger records each accepted stage
   and decision transition.

Fogwood also includes Evidence Research Map, Meeting to Plan Wall, and Static
Architecture Map recipes, plus local SVG export with an exact artifact hash.

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
```

## Challenge-period history

Fogwood's working WebMCP implementation and subsequent agent-runtime work are
recorded in dated commits created during the 2026 WebMCP Challenge submission
period. The history separates the initial canvas/tool registration, hardened
registration, governed proposal runtime, local Bazaar, deterministic
instruments, receipt evidence, and later competition-phase interaction work.

## License

Fogwood is available under the [MIT License](LICENSE). tldraw's bundled license
notice is preserved separately in `public/tldraw-LICENSE.md`.
