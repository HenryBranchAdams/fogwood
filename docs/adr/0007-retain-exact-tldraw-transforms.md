---
status: accepted
---

# Retain exact tldraw transforms in prepared plans

Fogwood treats inspected affine geometry as an authority-sensitive input, not
as presentation data. `fogwood.transform.v1` records the shape's local bounds,
local-to-parent, parent-to-page and local-to-page matrices, exact page corners,
page AABB, page rotation, parent identity, lock ancestry, optional focused
group, and deterministic fingerprint. Coordinates are page-space unless a
field is explicitly named `local`; comparisons use `1e-7` epsilon while the
fingerprint rounds finite numbers to nine decimal places.

The Canvas Protocol retains the exact projection in its frozen lowering.
Nested movement and same-parent arrangement convert reviewed page origins back
through the inspected parent inverse. Rotated resize calls tldraw's public
`resizeShape` with the retained local bounds, page transform, page-space scale
origin, and axis rotation. Preserved variants keep their parent and local
rotation. The visual review projects retained before/after corners directly
into the viewport as SVG polygons. It must not reconstruct a rotated or nested
footprint by rotating its page AABB from the AABB's top-left.

Native text reflow can change intrinsic geometry inside tldraw. A single
`update` therefore cannot mix `text` with `x`, `y`, or `rotation`: content and
exact geometry remain supported as separate reviewed changes, so the preview
never claims corners that native text layout may invalidate.

Immediately before Apply, the page rechecks type, parent, lock ancestry, and
transform fingerprint. Stale or incompatible targets fail before the single
history transaction. Legacy callers may synthesize a projection only for an
unrotated direct-page shape; lossy rotated reconstruction fails closed.

The installed tldraw page-transform contract is rigid translation plus
rotation. Projection rejects scale, reflection, shear, singular, non-finite,
and unbounded matrices rather than treating a synthetic affine matrix as an
exact supported transform. Zero-width or zero-height geometry remains
inspectable and movable, but resize refuses it before planning because it
cannot produce a finite scale factor.

Cross-parent reparenting, arbitrary scale or skew, nested rotation changes, and inferred
geometry from screenshots or legacy AABBs are non-goals. They require a new
versioned lowering rather than widening this contract silently.
