# ADR 0003: Compile the full Example surface behind one semantic broker

Status: accepted for the local full-surface phase

## Context

Fogwood pins 213 official tldraw Example entries. Treating only a few entries as
callable made the product safe but too conservative: an open-ended request could
not draw on the breadth of the surface. Registering 213 WebMCP tools or exposing
the raw `Editor` would create a noisy, race-prone, unsafe interface.

## Decision

Keep exactly three stable page tools and add `route` mode to
`fogwood-capabilities`. One deep compiler owns one immutable
`fogwood.example-route.v1` record for every pinned Example and composes up to 24
Routes into a pure `fogwood.surface-plan.v1` result.

Eight Adapter Families preserve different authority boundaries:

1. native canvas
2. local material/artifact
3. editor introspection
4. control plane
5. trusted extension/compound
6. local persistence
7. collaboration/identity
8. external artifact handoff

Every Route names a concrete lowering seam, allowed operations, execution lane,
fidelity, source evidence, and boundary. The compiler validates the exact
source commit, 213-path fingerprint, and path-to-family matrix fingerprint; it
has no arbitrary Editor dispatch, source import, generated code, HTML, or
remote-fetch escape hatch.

`callable` means the exact Route can be selected and compiled. Exact local
equivalence, bounded native projection, host readiness, proposal staging, and
successful page Apply are separate evidence.

Route results separate schema-valid read calls, proposal contracts, and host
requirements. A proposal contract names allowed closed operations but is not
presented as a complete `fogwood-propose` invocation until Codex supplies
revision-bound, context-derived arguments. The 180 bounded Routes intentionally
share family adapters rather than adding thin route-specific handlers.

## Consequences

- Codex can mix the full pinned capability vocabulary without receiving 213
  simultaneous tool registrations.
- New exact adapters deepen an existing Route instead of controlling whether the
  Example can participate at all.
- Collaboration and active-content Routes remain useful and addressable, but
  they return typed host or local-artifact requirements rather than fake local
  success.
- Page mutation remains behind `fogwood-propose` and page-owned Apply or Reject.
- The compiler is an addressing and lowering layer, not proof that upstream
  Example source executed.
