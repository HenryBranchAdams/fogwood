/**
 * Persisted surface-block and direct instrument-gesture compatibility seam.
 *
 * These exports keep existing device-local pages and direct human controls
 * working. They do not define the public WebMCP grammar.
 */
export {
  addSurfaceBlocks,
  createInstrumentControlGesture,
  updateInstrumentControl,
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
} from '../internal/surface-runtime.ts';

export type {
  InstrumentControlGesture,
  InstrumentControlUpdateOptions,
  SurfaceBlockInput,
} from '../internal/surface-runtime.ts';
