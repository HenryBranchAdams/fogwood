---
status: accepted
extends: 0005
amends: 0005
---

# Start new visits blank while preserving the earlier canvas as an archive

## Context

Fogwood's public product is an empty spatial medium, but the retained
`open-surface-local` storage identity opens whatever an earlier Open Surface or
Fogwood release left on the device. That protects data while making a returning
browser look like a prebuilt gallery. The person explicitly chose to move that
legacy matter out of the default product path without deleting it.

## Decision

Use `fogwood-local-v2` as the default tldraw persistence identity. A new visit
therefore begins as an ordinary blank page. Preserve `open-surface-local`
exactly as-is and reopen it only when the URL contains `?legacy=1`.

The boundary is a storage-identity switch, not a document-schema migration:

- never delete or rewrite the earlier IndexedDB document;
- never copy or dual-write between the two identities;
- use a normal full-page link when switching identities so tldraw remounts
  against the selected store; and
- keep both identities device-local and page-authoritative.

The empty default canvas may render a sparse, non-persistent invitation. The
invitation is not a canvas record and disappears whenever the page contains
matter or a proposal is awaiting review.

## Consequences

New and returning visits reach the same blank-first product surface. Earlier
work is still available on the same device through an explicit archive link,
without silent migration or deletion. The archive is compatibility evidence,
not the public first-run grammar. A future cross-device or user-selected import
would require a separate reviewed design rather than widening this switch.
