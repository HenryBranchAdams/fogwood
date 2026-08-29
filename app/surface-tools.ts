/**
 * Compatibility façade for existing imports.
 *
 * New code should import the narrow `webmcp`, `tldraw-adapter`, `review`, or
 * `compat` seam directly. This barrel intentionally contains no policy,
 * projection, lowering, or transaction implementation.
 */
export {
  availableCapabilitiesForEditor,
  canvasContextForEditor,
  contextTokenForEditor,
  currentContextToken,
  currentRevision,
  inspectAvailableCapabilities,
  inspectSurface,
  planCapabilityRequestForEditor,
  projectCanvasContext,
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
} from './tldraw-adapter/inspect-projection.ts';

export {
  applyCanvasOpPlan,
  applyProposalToEditor,
  prepareProposalPlan,
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
} from './tldraw-adapter/transaction.ts';

export {
  addSurfaceBlocks,
  createInstrumentControlGesture,
  updateInstrumentControl,
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
} from './compat/surface-tools.ts';

// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
export { proposalActivityDetail } from './review/proposal-activity.ts';
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
export { registerSurfaceTools } from './webmcp/surface-tools.ts';

export type {
  InstrumentControlGesture,
  InstrumentControlUpdateOptions,
  SurfaceBlockInput,
} from './compat/surface-tools.ts';
export type {
  SurfaceMaterialOptions,
  SurfaceToolController,
  ToolConnection,
} from './webmcp/surface-tools.ts';
export type { BlockKind, BlockTone, CanvasShapeKind } from './fogwood-runtime.ts';
