---
status: accepted
---

# Put a contextual semantic broker behind stable WebMCP tools

Fogwood is a dynamic semantic control surface over tldraw, not a remote Editor
SDK. The page keeps three stable transport tools: inspect, capabilities, and
propose. Context-specific commands are represented as versioned Capability and
Adapter data returned by inspection and planning rather than by rapidly
registering and unregistering page tools. This avoids host discovery races while
letting selection, scope, locks, permissions, and application mode change which
semantic operations are currently valid.

Availability is advisory. Every semantic Adapter must still recheck its exact
preconditions when lowering to a revision-pinned Proposal, and page Apply must
revalidate before one editor transaction. Fogwood does not expose arbitrary
Editor methods and does not let WebMCP writes bypass page-owned review.

## Considered options

Exposing the raw tldraw SDK was rejected because it is too large, unstable, and
unsafe as an agent reasoning surface. Dynamically reconciling many WebMCP tool
registrations was deferred because registration, host exposure, conversation
inventory, and successful invocation are separate asynchronous evidence layers.
Direct semantic write tools were rejected because they bypass Fogwood's human
Apply or Reject authority.

## Consequences

The semantic command is the reusable unit beneath WebMCP, page UI, tests, and a
future in-app agent. The content revision protects page-authoritative records.
A separate `fogwood.context.v1` token binds discovery, planning, and staging to
bounded ephemeral state: current page, ordered selection, active tool/path,
read-only mode, focused group, and editing shape. Camera, viewport, hover, host
tool inventory, and extension payloads are intentionally excluded. Apply stays
selection-independent after the person has reviewed exact target IDs and still
revalidates the current page. A change ledger and origin-tagged attention relay
remain future work rather than prerequisites for this small control surface.
