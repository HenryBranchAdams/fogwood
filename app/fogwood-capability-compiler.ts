// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
import { TLDRAW_EXAMPLE_CATALOG, TLDRAW_EXAMPLE_SOURCE } from './fogwood-tldraw-capabilities.ts';

export const FOGWOOD_FULL_SURFACE_VERSION = 1 as const;

export const FULL_SURFACE_FAMILIES = [
  'native_canvas',
  'local_material_artifact',
  'editor_introspection',
  'control_plane',
  'extension_compound',
  'local_persistence',
  'collaboration_identity',
  'external_active',
] as const;

export type FullSurfaceFamily = (typeof FULL_SURFACE_FAMILIES)[number];
export type FullSurfaceExecutionLane =
  | 'page-proposal'
  | 'read-only'
  | 'host-capability'
  | 'artifact-bridge';
export type FullSurfaceFidelity =
  | 'exact'
  | 'bounded-native-equivalent'
  | 'host-mediated';

export type FullSurfaceAdapter = Readonly<{
  id: string;
  family: FullSurfaceFamily;
  authority: 'read-only' | 'page-apply' | 'host-observed';
  execution_lane: FullSurfaceExecutionLane;
  arbitrary_code: false;
  network: 'none';
  purpose: string;
}>;

export const FULL_SURFACE_ADAPTERS: readonly FullSurfaceAdapter[] = deepFreeze([
  {
    id: 'surface.native-canvas.v1',
    family: 'native_canvas',
    authority: 'page-apply',
    execution_lane: 'page-proposal',
    arbitrary_code: false,
    network: 'none',
    purpose: 'Compile bounded native matter, geometry, bindings, grouping, ordering, and edits into Canvas Protocol operations.',
  },
  {
    id: 'surface.local-material.v1',
    family: 'local_material_artifact',
    authority: 'page-apply',
    execution_lane: 'artifact-bridge',
    arbitrary_code: false,
    network: 'none',
    purpose: 'Accept or produce bounded device-local PNG, JPEG, and sanitized SVG material without implicit fetching.',
  },
  {
    id: 'surface.editor-read.v1',
    family: 'editor_introspection',
    authority: 'read-only',
    execution_lane: 'read-only',
    arbitrary_code: false,
    network: 'none',
    purpose: 'Project bounded editor state through Fogwood inspect without exposing the raw tldraw store.',
  },
  {
    id: 'surface.control-plane.v1',
    family: 'control_plane',
    authority: 'page-apply',
    execution_lane: 'page-proposal',
    arbitrary_code: false,
    network: 'none',
    purpose: 'Translate view, tool, configuration, and interface intent into closed page-owned policy or native projection steps.',
  },
  {
    id: 'surface.trusted-extension.v1',
    family: 'extension_compound',
    authority: 'page-apply',
    execution_lane: 'page-proposal',
    arbitrary_code: false,
    network: 'none',
    purpose: 'Route custom-shape, custom-tool, event, and use-case intent through trusted built-time extensions or native editable projections.',
  },
  {
    id: 'surface.local-persistence.v1',
    family: 'local_persistence',
    authority: 'read-only',
    execution_lane: 'read-only',
    arbitrary_code: false,
    network: 'none',
    purpose: 'Inspect and request bounded device-local snapshot, migration, and reload operations without remote storage.',
  },
  {
    id: 'surface.host-collaboration.v1',
    family: 'collaboration_identity',
    authority: 'host-observed',
    execution_lane: 'host-capability',
    arbitrary_code: false,
    network: 'none',
    purpose: 'Emit a typed host requirement for collaboration, comments, presence, attribution, or identity; never simulate shared state as real.',
  },
  {
    id: 'surface.artifact-handoff.v1',
    family: 'external_active',
    authority: 'host-observed',
    execution_lane: 'artifact-bridge',
    arbitrary_code: false,
    network: 'none',
    purpose: 'Ask a live host capability to convert active or external content into bounded local bytes before Fogwood ingestion.',
  },
]);

const NATIVE_CANVAS_PATHS = new Set([
  'getting-started/basic',
  'editor-api/align-and-distribute-shapes',
  'editor-api/arrow-labels',
  'editor-api/create-arrow',
  'editor-api/z-order',
  'shapes/tools/arrow-binding-options',
  'shapes/tools/frame-layouts',
  'shapes/tools/layout-bindings',
  'shapes/tools/pin-bindings',
  'shapes/tools/shape-with-tldraw-styles',
  'shapes/tools/sticker-bindings',
  'ui/rich-text-on-multiple-shapes',
  'ui/text-mass-style-updates',
]);

const LOCAL_MATERIAL_PATHS = new Set([
  'data/assets/clipboard-events',
  'data/assets/custom-paste',
  'data/assets/export-canvas-as-image',
  'data/assets/export-canvas-settings',
  'data/assets/static-assets',
  'editor-api/local-images',
  'shapes/tools/screenshot-tool',
  'shapes/tools/toSvg-method-example',
  'use-cases/image-annotator',
]);

const EDITOR_INTROSPECTION_PATHS = new Set([
  'editor-api/api',
  'editor-api/coordinate-system',
  'editor-api/selection-bounds',
  'editor-api/text-search',
]);

const LOCAL_PERSISTENCE_PATHS = new Set([
  'configuration/persistence-key',
  'data/assets/local-storage',
  'data/assets/meta-migrations',
  'editor-api/snapshots',
  'events/unsaved-changes',
  'shapes/tools/shape-with-migrations',
]);

const EXTERNAL_ACTIVE_PATHS = new Set([
  'configuration/custom-embed',
  'configuration/embed-permissions',
  'data/assets/external-content-sources',
  'data/assets/hosted-images',
  'editor-api/local-videos',
  'shapes/tools/persistent-iframe-shape',
  'use-cases/custom-shape-mermaids',
  'use-cases/hundred-mermaids',
  'use-cases/mermaid-pasting',
  'use-cases/pdf-editor',
]);

const CONTROL_PLANE_CATEGORIES = new Set(['configuration', 'layout', 'ui']);
const COLLABORATION_CATEGORIES = new Set(['collaboration', 'users']);
const CATEGORY_DEFAULT_FAMILY: Readonly<Record<string, FullSurfaceFamily>> = Object.freeze({
  collaboration: 'collaboration_identity',
  configuration: 'control_plane',
  'data/assets': 'extension_compound',
  'editor-api': 'extension_compound',
  events: 'extension_compound',
  'getting-started': 'extension_compound',
  layout: 'control_plane',
  'shapes/tools': 'extension_compound',
  ui: 'control_plane',
  'use-cases': 'extension_compound',
  users: 'collaboration_identity',
});
const READ_ONLY_MATERIAL_SLUGS = new Set([
  'export-canvas-as-image',
  'export-canvas-settings',
  'screenshot-tool',
  'toSvg-method-example',
]);
const EXACT_LOCAL_PATHS = new Set([
  'editor-api/align-and-distribute-shapes',
  'editor-api/create-arrow',
  'editor-api/z-order',
  'configuration/disable-pages',
  'configuration/camera-options',
]);

const ROUTE_HINTS: ReadonlyArray<Readonly<{ phrase: string; example_id: string }>> = deepFreeze([
  { phrase: 'align', example_id: 'tldraw-example.editor-api.align-and-distribute-shapes' },
  { phrase: 'distribute', example_id: 'tldraw-example.editor-api.align-and-distribute-shapes' },
  { phrase: 'export the canvas as an image', example_id: 'tldraw-example.data.assets.export-canvas-as-image' },
  { phrase: 'export canvas as image', example_id: 'tldraw-example.data.assets.export-canvas-as-image' },
  { phrase: 'export image', example_id: 'tldraw-example.data.assets.export-canvas-as-image' },
  { phrase: 'selection bounds', example_id: 'tldraw-example.editor-api.selection-bounds' },
  { phrase: 'save a snapshot', example_id: 'tldraw-example.editor-api.snapshots' },
  { phrase: 'snapshot', example_id: 'tldraw-example.editor-api.snapshots' },
  { phrase: 'comment', example_id: 'tldraw-example.collaboration.commenting' },
  { phrase: 'presence', example_id: 'tldraw-example.collaboration.user-presence' },
  { phrase: 'image annotator', example_id: 'tldraw-example.use-cases.image-annotator' },
  { phrase: 'annotate image', example_id: 'tldraw-example.use-cases.image-annotator' },
  { phrase: 'arrow', example_id: 'tldraw-example.editor-api.create-arrow' },
  { phrase: 'connect', example_id: 'tldraw-example.editor-api.create-arrow' },
  { phrase: 'bring to front', example_id: 'tldraw-example.editor-api.z-order' },
  { phrase: 'send to back', example_id: 'tldraw-example.editor-api.z-order' },
  { phrase: 'slides', example_id: 'tldraw-example.use-cases.slides' },
  { phrase: 'storyboard', example_id: 'tldraw-example.use-cases.slides' },
  { phrase: 'pdf', example_id: 'tldraw-example.use-cases.pdf-editor' },
  { phrase: 'mermaid', example_id: 'tldraw-example.use-cases.mermaid-pasting' },
]);

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function pathFor(category: string, slug: string) {
  return `${category}/${slug}`;
}

function familyFor(path: string, category: string): FullSurfaceFamily {
  if (NATIVE_CANVAS_PATHS.has(path)) return 'native_canvas';
  if (LOCAL_MATERIAL_PATHS.has(path)) return 'local_material_artifact';
  if (EDITOR_INTROSPECTION_PATHS.has(path)) return 'editor_introspection';
  if (LOCAL_PERSISTENCE_PATHS.has(path)) return 'local_persistence';
  if (COLLABORATION_CATEGORIES.has(category)) return 'collaboration_identity';
  if (EXTERNAL_ACTIVE_PATHS.has(path)) return 'external_active';
  if (CONTROL_PLANE_CATEGORIES.has(category)) return 'control_plane';
  const family = CATEGORY_DEFAULT_FAMILY[category];
  if (family) return family;
  throw new Error(`UNMAPPED_TLDRAW_EXAMPLE:${path}`);
}

function adapterFor(family: FullSurfaceFamily) {
  const adapter = FULL_SURFACE_ADAPTERS.find((candidate) => candidate.family === family);
  if (!adapter) throw new Error(`MISSING_FULL_SURFACE_ADAPTER:${family}`);
  return adapter;
}

function routeSemantics(family: FullSurfaceFamily, slug: string, path: string) {
  const localFidelity = EXACT_LOCAL_PATHS.has(path)
    ? 'exact' as const
    : 'bounded-native-equivalent' as const;
  if (path === 'configuration/disable-pages') {
    return {
      execution_lane: 'page-proposal' as const,
      fidelity: 'exact' as const,
      next_step: { kind: 'propose' as const, tool: 'fogwood-propose' as const, action_type: 'page_ops' as const },
      boundary: 'Create and switch to one deterministic named page only after page-owned Apply.',
    };
  }
  if (path === 'configuration/camera-options') {
    return {
      execution_lane: 'page-proposal' as const,
      fidelity: 'exact' as const,
      next_step: { kind: 'propose' as const, tool: 'fogwood-propose' as const, action_type: 'camera_ops' as const },
      boundary: 'Focus one exact reviewed page-space region without changing document content.',
    };
  }
  if (family === 'native_canvas') {
    return {
      execution_lane: 'page-proposal' as const,
      fidelity: localFidelity,
      next_step: { kind: 'propose' as const, tool: 'fogwood-propose' as const, action_type: 'canvas_ops' as const },
      boundary: 'Stage bounded native Canvas Protocol operations and stop for page-owned Apply or Reject.',
    };
  }
  if (family === 'local_material_artifact') {
    if (READ_ONLY_MATERIAL_SLUGS.has(slug)) {
      return {
        execution_lane: 'read-only' as const,
        fidelity: localFidelity,
        next_step: { kind: 'inspect' as const, tool: 'fogwood-inspect' as const, projection: 'local-artifact-export' as const },
        boundary: 'Produce bounded device-local output only; no implicit remote fetch or upload is allowed.',
      };
    }
    return {
      execution_lane: 'artifact-bridge' as const,
      fidelity: localFidelity,
      next_step: { kind: 'propose' as const, tool: 'fogwood-propose' as const, action_type: 'add_materials' as const },
      boundary: 'Only bounded local PNG, JPEG, or sanitized SVG bytes may be staged as material.',
    };
  }
  if (family === 'editor_introspection' || family === 'local_persistence') {
    return {
      execution_lane: 'read-only' as const,
      fidelity: localFidelity,
      next_step: { kind: 'inspect' as const, tool: 'fogwood-inspect' as const, projection: family },
      boundary: family === 'local_persistence'
        ? 'Device-local state only; import, destructive restore, and remote synchronization require separate authority.'
        : 'Return a bounded simplified canvas projection rather than the raw Editor store.',
    };
  }
  if (family === 'control_plane' || family === 'extension_compound') {
    return {
      execution_lane: 'page-proposal' as const,
      fidelity: 'bounded-native-equivalent' as const,
      next_step: { kind: 'propose' as const, tool: 'fogwood-propose' as const, action_type: 'canvas_ops' as const },
      boundary: family === 'control_plane'
        ? 'Use a closed page policy when implemented or an editable native projection; never inject generated UI or handlers.'
        : 'Use trusted built-time extensions or editable native projections; the example source is never imported or executed.',
    };
  }
  if (family === 'collaboration_identity') {
    return {
      execution_lane: 'host-capability' as const,
      fidelity: 'host-mediated' as const,
      next_step: { kind: 'host' as const, capability_id: `tldraw.${slug}` },
      boundary: 'A live observed collaboration or identity host is required; Fogwood never presents local simulation as shared state.',
    };
  }
  return {
    execution_lane: 'artifact-bridge' as const,
    fidelity: 'host-mediated' as const,
    next_step: { kind: 'host' as const, capability_id: `artifact.${slug}` },
    boundary: 'Active content is never executed. A live host must return sanitized bounded local artifact bytes for Fogwood review.',
  };
}

export type FullSurfaceRoute = Readonly<{
  schema: 'fogwood.example-route.v1';
  route_id: string;
  example_id: string;
  category: string;
  slug: string;
  title: string;
  family: FullSurfaceFamily;
  adapter_id: string;
  callable: true;
  execution_lane: FullSurfaceExecutionLane;
  fidelity: FullSurfaceFidelity;
  lowering: Readonly<{
    seam: 'canvas_ops' | 'page_ops' | 'camera_ops' | 'materials' | 'inspect' | 'persistence' | 'host';
    authority: 'page-apply' | 'read-only' | 'host-observed' | 'artifact-bridge';
    capability_ids: readonly string[];
    operations: readonly string[];
    qualified: true;
    qualification: 'exact-local-fixture' | 'family-route-fixture' | 'host-contract-fixture';
  }>;
  next_step:
    | Readonly<{ kind: 'propose'; tool: 'fogwood-propose'; action_type: 'canvas_ops' | 'add_materials' | 'page_ops' | 'camera_ops' }>
    | Readonly<{ kind: 'inspect'; tool: 'fogwood-inspect'; projection: string }>
    | Readonly<{ kind: 'host'; capability_id: string }>;
  boundary: string;
  source: Readonly<{ commit: string; path: string; url: string }>;
}>;

const EXACT_LOCAL_LOWERINGS = Object.freeze({
  'editor-api/align-and-distribute-shapes': {
    seam: 'canvas_ops' as const,
    authority: 'page-apply' as const,
    capability_ids: ['layout.arrange'],
    operations: ['align', 'distribute'],
    qualified: true as const,
    qualification: 'exact-local-fixture' as const,
  },
  'editor-api/create-arrow': {
    seam: 'canvas_ops' as const,
    authority: 'page-apply' as const,
    capability_ids: ['connector-arrow.create'],
    operations: ['connect'],
    qualified: true as const,
    qualification: 'exact-local-fixture' as const,
  },
  'editor-api/z-order': {
    seam: 'canvas_ops' as const,
    authority: 'page-apply' as const,
    capability_ids: ['layer.reorder'],
    operations: ['reorder'],
    qualified: true as const,
    qualification: 'exact-local-fixture' as const,
  },
  'configuration/disable-pages': {
    seam: 'page_ops' as const,
    authority: 'page-apply' as const,
    capability_ids: ['page.lifecycle@1'],
    operations: ['create_and_switch'],
    qualified: true as const,
    qualification: 'exact-local-fixture' as const,
  },
  'configuration/camera-options': {
    seam: 'camera_ops' as const,
    authority: 'page-apply' as const,
    capability_ids: ['camera.focus-bounds@1'],
    operations: ['focus_bounds'],
    qualified: true as const,
    qualification: 'exact-local-fixture' as const,
  },
});

function nativeOperations(slug: string) {
  if (/arrow|binding/u.test(slug)) return ['connect'];
  if (/frame-layout/u.test(slug)) return ['create', 'group'];
  if (/style|rich-text|text-mass/u.test(slug)) return ['update'];
  return ['create', 'draw', 'connect', 'update'];
}

function loweringFor(path: string, family: FullSurfaceFamily, slug: string): FullSurfaceRoute['lowering'] {
  const exact = EXACT_LOCAL_LOWERINGS[path as keyof typeof EXACT_LOCAL_LOWERINGS];
  if (exact) return exact;
  if (family === 'native_canvas') {
    return {
      seam: 'canvas_ops',
      authority: 'page-apply',
      capability_ids: [],
      operations: nativeOperations(slug),
      qualified: true,
      qualification: 'family-route-fixture',
    };
  }
  if (family === 'local_material_artifact') {
    return READ_ONLY_MATERIAL_SLUGS.has(slug)
      ? {
          seam: 'inspect', authority: 'read-only', capability_ids: [], operations: [slug],
          qualified: true, qualification: 'family-route-fixture',
        }
      : {
          seam: 'materials', authority: 'artifact-bridge', capability_ids: ['add_materials'], operations: ['add_materials'],
          qualified: true, qualification: 'family-route-fixture',
        };
  }
  if (family === 'editor_introspection') {
    return {
      seam: 'inspect', authority: 'read-only', capability_ids: ['fogwood-inspect'], operations: [slug],
      qualified: true, qualification: 'family-route-fixture',
    };
  }
  if (family === 'local_persistence') {
    return {
      seam: 'persistence', authority: 'read-only', capability_ids: ['persistence.device-local'], operations: [slug],
      qualified: true, qualification: 'family-route-fixture',
    };
  }
  if (family === 'control_plane') {
    return {
      seam: 'canvas_ops', authority: 'page-apply', capability_ids: [], operations: ['create', 'update', 'group', 'reorder'],
      qualified: true, qualification: 'family-route-fixture',
    };
  }
  if (family === 'extension_compound') {
    return {
      seam: 'canvas_ops', authority: 'page-apply', capability_ids: [],
      operations: ['create', 'draw', 'connect', 'variant', 'update', 'resize', 'align', 'distribute', 'stack', 'pack', 'group', 'ungroup', 'reorder', 'delete'],
      qualified: true, qualification: 'family-route-fixture',
    };
  }
  return {
    seam: 'host', authority: 'host-observed', capability_ids: [], operations: [slug],
    qualified: true, qualification: 'host-contract-fixture',
  };
}

function fingerprint(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

const PINNED_PATH_FINGERPRINT = '667bfdca';
const PINNED_SOURCE_COMMIT = 'a30c9c8b9c16555d91625e8137826496326898cf';
const PINNED_ROUTE_MATRIX_FINGERPRINT = 'ffacafa3';
const observedPathFingerprint = fingerprint(TLDRAW_EXAMPLE_CATALOG.map((entry) => pathFor(entry.category, entry.slug)).join('\n'));
const observedRouteMatrixFingerprint = fingerprint(`${TLDRAW_EXAMPLE_SOURCE.commit}\n${TLDRAW_EXAMPLE_CATALOG
  .map((entry) => {
    const path = pathFor(entry.category, entry.slug);
    return `${path}:${familyFor(path, entry.category)}`;
  })
  .join('\n')}`);
if (
  TLDRAW_EXAMPLE_CATALOG.length !== 213
  || TLDRAW_EXAMPLE_SOURCE.commit !== PINNED_SOURCE_COMMIT
  || observedPathFingerprint !== PINNED_PATH_FINGERPRINT
  || observedRouteMatrixFingerprint !== PINNED_ROUTE_MATRIX_FINGERPRINT
) {
  throw new Error(
    `TLDRAW_EXAMPLE_CATALOG_DRIFT:${TLDRAW_EXAMPLE_CATALOG.length}:${TLDRAW_EXAMPLE_SOURCE.commit}:${observedPathFingerprint}:${observedRouteMatrixFingerprint}`,
  );
}

export const FOGWOOD_FULL_SURFACE_ROUTE_IDENTITY = deepFreeze({
  source_commit: PINNED_SOURCE_COMMIT,
  path_fingerprint: PINNED_PATH_FINGERPRINT,
  route_matrix_fingerprint: PINNED_ROUTE_MATRIX_FINGERPRINT,
});

export const FULL_SURFACE_ROUTES: readonly FullSurfaceRoute[] = deepFreeze(
  TLDRAW_EXAMPLE_CATALOG.map((entry) => {
    const path = pathFor(entry.category, entry.slug);
    const family = familyFor(path, entry.category);
    const adapter = adapterFor(family);
    return {
      schema: 'fogwood.example-route.v1' as const,
      route_id: `surface.route.${entry.category.replaceAll('/', '.')}.${entry.slug}`,
      example_id: entry.id,
      category: entry.category,
      slug: entry.slug,
      title: entry.title,
      family,
      adapter_id: adapter.id,
      callable: true as const,
      ...routeSemantics(family, entry.slug, path),
      lowering: loweringFor(path, family, entry.slug),
      source: {
        commit: entry.source_url.match(/blob\/([0-9a-f]{40})\//u)?.[1] ?? '',
        path: entry.source_path,
        url: entry.source_url,
      },
    };
  }),
);

export const FULL_SURFACE_COVERAGE = deepFreeze(FULL_SURFACE_ROUTES.map((route) => ({
  schema: 'fogwood.example-coverage.v1' as const,
  example_id: route.example_id,
  adapter_family: route.family,
  primitives: route.lowering.operations,
  searchable: true as const,
  routable: true as const,
  locally_equivalent: route.fidelity === 'exact',
  host_ready: route.execution_lane !== 'host-capability' && route.fidelity !== 'host-mediated',
  staged: route.lowering.qualification === 'exact-local-fixture',
  successful: route.lowering.qualification === 'exact-local-fixture',
  qualification: route.lowering.qualification,
  boundary: route.boundary,
})));

const ROUTE_BY_EXAMPLE_ID = new Map(FULL_SURFACE_ROUTES.map((route) => [route.example_id, route]));

export function getFullSurfaceRoute(exampleId: string): FullSurfaceRoute {
  const route = ROUTE_BY_EXAMPLE_ID.get(exampleId);
  if (!route) throw new Error(`UNKNOWN_EXAMPLE_ROUTE:${exampleId}`);
  return route;
}

function normalizeIntent(value: string) {
  return value.toLowerCase().replace(/[-_/]+/gu, ' ').replace(/\s+/gu, ' ').trim();
}

export function routeFullSurfaceIntent(
  intent: string,
  options: Readonly<{ max_routes?: number }> = {},
): readonly FullSurfaceRoute[] {
  const normalized = normalizeIntent(typeof intent === 'string' ? intent.slice(0, 500) : '');
  if (!normalized) return Object.freeze([]);
  const maxRoutes = Number.isInteger(options.max_routes)
    ? Math.max(1, Math.min(24, Number(options.max_routes)))
    : 12;
  const selected: FullSurfaceRoute[] = [];
  const seen = new Set<string>();
  const exactPathMatches = FULL_SURFACE_ROUTES.filter((route) => {
    const sourcePhrase = normalizeIntent(`${route.category} ${route.slug}`);
    return normalized === sourcePhrase || ` ${normalized} `.includes(` ${sourcePhrase} `);
  });
  for (const route of exactPathMatches) {
    selected.push(route);
    seen.add(route.example_id);
    if (selected.length >= maxRoutes) return Object.freeze(selected);
  }
  for (const hint of ROUTE_HINTS) {
    if (!normalized.includes(hint.phrase) || seen.has(hint.example_id)) continue;
    const route = ROUTE_BY_EXAMPLE_ID.get(hint.example_id);
    if (!route) continue;
    selected.push(route);
    seen.add(route.example_id);
    if (selected.length >= maxRoutes) break;
  }
  if (selected.length === 0) {
    const intentTokens = new Set(normalized.split(/[^a-z0-9]+/gu).filter((token) => token.length > 2));
    const scored = FULL_SURFACE_ROUTES.map((route, index) => {
      const routeTokens = new Set(normalizeIntent(`${route.slug} ${route.title} ${route.category}`).split(/[^a-z0-9]+/gu));
      const score = [...intentTokens].filter((token) => routeTokens.has(token)).length;
      return { route, index, score };
    }).filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score || left.index - right.index);
    for (const candidate of scored.slice(0, maxRoutes)) selected.push(candidate.route);
  }
  return Object.freeze(selected);
}

export type FullSurfaceCompileRequest = Readonly<{
  intent: string;
  example_ids?: readonly string[];
  base_revision: string;
  context_token: string;
  scope: 'new' | 'selection' | 'page';
  max_steps?: number;
}>;

export type FullSurfaceCompileFacts = Readonly<{
  current_revision: string;
  current_context_token: string;
  page_item_count: number;
  selection_count: number;
  locked_selection_count: number;
  locked_page_item_count: number;
  readonly?: boolean;
}>;

type FullSurfacePlanError = Readonly<{ code: string; message: string }>;

function validExampleIds(value: unknown): value is readonly string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 24) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (!(index in value) || typeof value[index] !== 'string' || value[index].length < 1 || value[index].length > 160) return false;
  }
  return true;
}

function refusedPlan(
  request: Partial<FullSurfaceCompileRequest>,
  errors: readonly FullSurfacePlanError[],
) {
  return deepFreeze({
    schema: 'fogwood.surface-plan.v1' as const,
    status: 'refused' as const,
    version: FOGWOOD_FULL_SURFACE_VERSION,
    intent: typeof request.intent === 'string' ? request.intent : '',
    base_revision: typeof request.base_revision === 'string' ? request.base_revision : '',
    context_token: typeof request.context_token === 'string' ? request.context_token : '',
    steps: [],
    local_next_calls: [],
    proposal_contracts: [],
    host_requirements: [],
    errors,
    page_mutated: false as const,
  });
}

export function compileFullSurfaceRequest(
  request: FullSurfaceCompileRequest,
  facts: FullSurfaceCompileFacts,
  hostEnvelope: Readonly<{ observed_capability_ids?: readonly string[] }> = {},
) {
  if (!request || typeof request !== 'object' || !facts || typeof facts !== 'object') {
    return refusedPlan(request ?? {}, [{ code: 'INVALID_REQUEST', message: 'Request and canvas facts must be objects.' }]);
  }
  if (typeof request.intent !== 'string' || request.intent.trim().length < 1 || request.intent.length > 500) {
    return refusedPlan(request, [{ code: 'INVALID_INTENT', message: 'intent must contain 1-500 characters.' }]);
  }
  if (request.base_revision !== facts.current_revision) {
    return refusedPlan(request, [{ code: 'STALE_STATE', message: 'The inspected canvas revision is no longer current.' }]);
  }
  if (request.context_token !== facts.current_context_token) {
    return refusedPlan(request, [{ code: 'STALE_CONTEXT', message: 'The inspected semantic context is no longer current.' }]);
  }
  if (!['new', 'selection', 'page'].includes(request.scope)) {
    return refusedPlan(request, [{ code: 'INVALID_SCOPE', message: 'scope must be new, selection, or page.' }]);
  }
  const maxSteps = request.max_steps === undefined ? 12 : request.max_steps;
  if (!Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 24) {
    return refusedPlan(request, [{ code: 'INVALID_STEP_LIMIT', message: 'max_steps must be an integer from 1 to 24.' }]);
  }
  if (request.example_ids !== undefined && !validExampleIds(request.example_ids)) {
    return refusedPlan(request, [{ code: 'INVALID_EXAMPLE_IDS', message: 'example_ids must be a dense array of 1-24 bounded IDs.' }]);
  }
  const routes: FullSurfaceRoute[] = [];
  for (const exampleId of request.example_ids ?? routeFullSurfaceIntent(request.intent, { max_routes: maxSteps }).map((route) => route.example_id)) {
    const route = ROUTE_BY_EXAMPLE_ID.get(exampleId);
    if (!route) return refusedPlan(request, [{ code: 'UNKNOWN_EXAMPLE_ROUTE', message: `No route exists for ${exampleId}.` }]);
    routes.push(route);
  }
  if (routes.length === 0) {
    return refusedPlan(request, [{ code: 'NO_MATCHING_ROUTE', message: 'No callable route matched the bounded intent.' }]);
  }
  if (routes.length > maxSteps) {
    return refusedPlan(request, [{ code: 'PLAN_STEP_LIMIT', message: `The plan requires ${routes.length} routes, above max_steps ${maxSteps}.` }]);
  }
  const observed = new Set(hostEnvelope.observed_capability_ids ?? []);
  const steps = routes.map((route) => {
    const hostCapabilityId = route.next_step.kind === 'host' ? route.next_step.capability_id : undefined;
    const hostReady = hostCapabilityId ? observed.has(hostCapabilityId) : false;
    return deepFreeze({
      example_id: route.example_id,
      route_id: route.route_id,
      family: route.family,
      adapter_id: route.adapter_id,
      execution_lane: route.execution_lane,
      fidelity: route.fidelity,
      lowering: route.lowering,
      status: hostCapabilityId && !hostReady ? 'host-required' as const : 'ready' as const,
      next_step: route.next_step,
      boundary: route.boundary,
    });
  });
  const hostRequirements = steps.filter((step) => step.status === 'host-required').map((step) => ({
    example_id: step.example_id,
    capability_id: step.next_step.kind === 'host' ? step.next_step.capability_id : '',
    recovery: 'Inspect the live host capability inventory, obtain the result outside Fogwood, then return bounded local material or state through the declared route.',
  }));
  const proposalContracts = steps.flatMap((step) => {
    if (step.status !== 'ready' || step.next_step.kind !== 'propose') return [];
    return [{
      example_id: step.example_id,
      tool: step.next_step.tool,
      action_type: step.next_step.action_type,
      allowed_operations: step.lowering.operations,
      requires_compilation: true as const,
    }];
  });
  const localNextCalls = steps.flatMap((step) => {
    if (step.status !== 'ready' || step.next_step.kind !== 'inspect') return [];
    return [{
      example_id: step.example_id,
      tool: step.next_step.tool,
      input: {},
    }];
  });
  return deepFreeze({
    schema: 'fogwood.surface-plan.v1' as const,
    status: hostRequirements.length > 0 ? 'ready-with-host-requirements' as const : 'ready' as const,
    version: FOGWOOD_FULL_SURFACE_VERSION,
    intent: request.intent,
    base_revision: request.base_revision,
    context_token: request.context_token,
    steps,
    local_next_calls: localNextCalls,
    proposal_contracts: proposalContracts,
    host_requirements: hostRequirements,
    errors: [],
    page_mutated: false as const,
  });
}
