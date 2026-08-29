/**
 * Read-only tldraw projection seam.
 *
 * This module is the only public entrypoint for turning live Editor state into
 * bounded Fogwood revisions, context tokens, capability facts, and inspect
 * responses. It does not expose mutation helpers.
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
} from '../internal/surface-runtime.ts';
