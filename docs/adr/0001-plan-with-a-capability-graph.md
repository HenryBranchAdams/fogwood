---
status: accepted
---

# Plan with a capability graph

Fogwood models tldraw demonstrations as pinned Examples rather than callable
functions. Open-ended intent is resolved through a declarative graph of
Capabilities with preconditions, effects, qualification, and execution policy;
deterministic planning selects and orders qualified Adapters before the existing
Proposal lifecycle stages any change. This preserves a small WebMCP interface
while allowing capability combinations to grow without a combinatorial decision
tree.

## Considered options

A flat tool per Example was rejected because many Examples are configuration or
compound demonstrations and the interface would be shallow. A fixed decision
tree was rejected because combinations grow exponentially. Unconstrained model
selection was rejected because it cannot prove adapter qualification, ordering,
resource bounds, or human authority.

## Consequences

Examples remain discovery and provenance evidence. Only an explicitly qualified
Adapter may make a Capability executable. Pure retrieval and shadow planning may
eventually be speculative; host calls, Proposal staging, and page Apply never
are. The execution policy records purity, determinism, idempotency, locality,
and speculation explicitly so later optimization cannot quietly cross that
authority boundary. This follows the useful separation in
[Speculative Programmatic Tool Calling](https://alexzhang13.github.io/blog/2026/spec-ptc/)
without making Fogwood itself a code-execution environment.
