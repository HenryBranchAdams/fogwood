/**
 * Fogwood's public WebMCP assembly seam.
 *
 * Registration remains exactly three stable tools. This module owns transport
 * assembly only; page mutation authority remains in FogwoodSurface and the
 * page-owned transaction adapter.
 */
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
export { registerSurfaceTools } from '../internal/surface-runtime.ts';
export type {
  SurfaceMaterialOptions,
  SurfaceToolController,
  ToolConnection,
} from '../internal/surface-runtime.ts';
