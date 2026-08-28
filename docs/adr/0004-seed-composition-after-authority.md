---
status: accepted
---

# Seed composition only after authority is fixed

Fogwood uses deterministic randomness as a compositional parameter, not as a
router, truth source, permission system, or authority mechanism. Version 1 adds
one high-level `seeded_composition` action behind the existing proposal tool. A
pure compiler validates an exact selected or explicit scope, fingerprints the
bounded source state, chooses open space, and lowers a preserved remix to the
closed Canvas Protocol. The existing page-owned proposal controller performs
the final stale-state check and applies the accepted operations in one history
transaction.

The grammar is `remix@1` with `xorshift32-v1`. The seed varies branch-cluster
placement, rhythm, palette, scale, rotation, and spacing. `wildness` bounds
departure from zero to one. Source shapes never move, every result is a variant
with inspectable lineage, and semantic identities derive from source state and
algorithm version rather than the seed. This keeps repeated seeds replayable
without allowing randomness to control identity.

## Routing boundary

Version 1 does not use seeds during capability routing. Capability
qualification, scope, target identities, safety, locks, permissions, and human
authority must already be equal before a future planner may use a seed to break
a compositional tie. Seeds can never decide a fact, safety gate, permission,
semantic ID, or whether Apply is allowed.

## Rejected alternatives

A separate seeded-command registry would duplicate the contextual broker and
proposal lifecycle. Randomness hidden inside the Canvas Protocol lowerer would
make replay and receipts opaque. Seeding the main capability router would let
presentation entropy affect safety and authority. A collection of rigid seeded
templates would recreate the dashboard/template problem. The chosen compiler
is the smallest seam that keeps variability explicit, reviewable, and reusable.
