/**
 * Page-owned preparation and transaction seam.
 *
 * Stage prepares and freezes lowerings. Apply revalidates the prepared plan,
 * opens one tldraw history boundary and one editor transaction, and rolls back
 * through the captured mark on failure.
 */
export {
  applyCanvasOpPlan,
  applyProposalToEditor,
  prepareProposalPlan,
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
} from '../internal/surface-runtime.ts';
