---
status: accepted
extends: 0005
---

# Version semantic lowerers behind three stable tools

## Context

Fogwood can address all 213 pinned tldraw examples, but searchable addressing
is not executable behavior. Adding a WebMCP tool for every example would make
the public surface noisy and race-prone; exposing Editor methods would cross
the code-free trust boundary. The prepared-plan core already provides the
right authority seam: a bounded action is lowered once, reviewed, rechecked,
and then applied by the page.

## Decision

Keep exactly three registered WebMCP tools. Add capability depth as immutable
`fogwood.semantic-lowerer.v1` manifests and closed proposal action schemas.
Every lowerer owns a stable `id@version`, intent and keywords, preconditions,
refusals, authority, exact input contract, preservation promises, tldraw
primitives, limits, source-example evidence, fidelity, and qualification.
Changing a schema publishes another version; it never mutates an existing
tool or manifest contract.

The first two extracted families are:

- `page.lifecycle@1`: prepare one deterministic page identity, enforce the
  document page limit before Stage and again before Apply, then create and
  switch inside the normal one-step transaction; and
- `camera.focus-bounds@1`: prepare one bounded page-space rectangle, show it in
  review, then focus the viewport through a context-only lane that preserves
  document records, content revision, and history.

Both actions still require `fogwood-propose` followed by page-owned Apply or
Reject. No manifest can dispatch an arbitrary method, import source example
code, execute JavaScript, fetch a URL, or grant itself authority.

## Adding a lowerer

1. Add or version one schema-valid manifest and closed action schema.
2. Write a public lifecycle test that begins at the registered WebMCP tool and
   proves Stage is mutation-free, the frozen preview matches Apply, stale and
   limit checks fail closed, Reject is inert, and Undo matches the declared
   transaction lane.
3. Add the prepared lowering to the private page adapter; Apply must consume
   the retained lowering rather than reinterpret the request.
4. Update the 213-example coverage matrix honestly. Searchable and routable do
   not imply local equivalence, host readiness, a staged fixture, or a
   successful Apply.
5. Keep the registered tool inventory at exactly three.

## Consequences

Fogwood gains capability families without becoming a remote SDK. Codex sees a
small stable control surface, can discover exact semantic operations for the
current context, and recovers from stale state through the permanent read
kernel. Page and camera fixtures prove the extension mechanism while the
remaining example routes retain explicit reduced-fidelity or host-mediated
boundaries.
