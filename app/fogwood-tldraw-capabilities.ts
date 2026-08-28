/**
 * Pinned, data-only index of the official tldraw examples sidebar.
 *
 * The sidebar is Fogwood's pinned Example corpus, not its executable
 * capability ontology. Every entry has a callable route through the separate
 * full-surface compiler; exact local execution, native projection, host
 * mediation, and artifact handoff remain distinct route evidence. Example
 * source is never imported or executed.
 */

export const TLDRAW_EXAMPLE_SOURCE = {
  repository: 'https://github.com/tldraw/tldraw',
  commit: 'a30c9c8b9c16555d91625e8137826496326898cf',
  examples_root: 'apps/examples/src/examples',
  observed_on: '2026-08-27',
  installed_tldraw: '5.3.2',
} as const;

const TLDRAW_EXAMPLE_PATHS = [
  'collaboration/comment-anchors',
  'collaboration/comment-clustering',
  'collaboration/comment-drawing-reactions',
  'collaboration/comment-history',
  'collaboration/comment-notifications',
  'collaboration/comment-regions',
  'collaboration/comment-shape-precision',
  'collaboration/commenting-mobile',
  'collaboration/commenting-sidebar',
  'collaboration/commenting',
  'collaboration/sync-custom-people-menu',
  'collaboration/sync-custom-presence',
  'collaboration/sync-custom-shape',
  'collaboration/sync-demo',
  'collaboration/sync-private-content',
  'collaboration/user-presence',
  'configuration/arrows-precise-exact',
  'configuration/asset-props',
  'configuration/camera-options',
  'configuration/configure-shape-util',
  'configuration/custom-embed',
  'configuration/custom-options',
  'configuration/custom-text-outline',
  'configuration/deep-links',
  'configuration/disable-pages',
  'configuration/display-options',
  'configuration/edge-scrolling',
  'configuration/embed-permissions',
  'configuration/environment-detection',
  'configuration/exploded',
  'configuration/frame-colors',
  'configuration/only-editor',
  'configuration/persistence-key',
  'configuration/readonly',
  'configuration/reduced-motion',
  'configuration/resize-note',
  'data/assets/clipboard-events',
  'data/assets/custom-asset-type',
  'data/assets/custom-paste',
  'data/assets/custom-records',
  'data/assets/export-canvas-as-image',
  'data/assets/export-canvas-settings',
  'data/assets/external-content-sources',
  'data/assets/hosted-images',
  'data/assets/local-storage',
  'data/assets/meta-migrations',
  'data/assets/static-assets',
  'editor-api/align-and-distribute-shapes',
  'editor-api/api',
  'editor-api/arrow-labels',
  'editor-api/conditional-culling',
  'editor-api/coordinate-system',
  'editor-api/create-arrow',
  'editor-api/custom-clipping-shape',
  'editor-api/custom-overlay',
  'editor-api/dimensions-hud',
  'editor-api/dynamic-tools',
  'editor-api/easter-egg-styles',
  'editor-api/editor-focus',
  'editor-api/focus-mode',
  'editor-api/hovered-overlay',
  'editor-api/interaction-end-callback',
  'editor-api/lasso-select-tool',
  'editor-api/local-images',
  'editor-api/local-videos',
  'editor-api/lock-camera-zoom',
  'editor-api/locked-shapes',
  'editor-api/performance-hooks',
  'editor-api/reactive-inputs',
  'editor-api/replace-brush-overlay',
  'editor-api/selection-bounds',
  'editor-api/shape-animation',
  'editor-api/snapshots',
  'editor-api/text-search',
  'editor-api/z-order',
  'editor-api/zoom-to-bounds',
  'events/after-create-update-shape',
  'events/after-delete-shape',
  'events/before-create-update-shape',
  'events/before-delete-shape',
  'events/canvas-events',
  'events/custom-double-click-behavior',
  'events/derived-view',
  'events/event-blocker',
  'events/meta-on-change',
  'events/meta-on-create',
  'events/permissions-2',
  'events/permissions',
  'events/prevent-instance-change',
  'events/prevent-multi-shape-selection',
  'events/prevent-shape-change',
  'events/signals',
  'events/store-events',
  'events/ui-events',
  'events/unsaved-changes',
  'getting-started/basic',
  'layout/external-dialog',
  'layout/external-ui-context',
  'layout/external-ui',
  'layout/image-component',
  'layout/inline-behavior',
  'layout/inline',
  'layout/inset-canvas',
  'layout/inset',
  'layout/multiple',
  'layout/scroll',
  'shapes/tools/ag-grid-shape',
  'shapes/tools/arrow-binding-options',
  'shapes/tools/bounds-snapping-shape',
  'shapes/tools/cubic-bezier-shape',
  'shapes/tools/custom-config',
  'shapes/tools/custom-geo-types',
  'shapes/tools/custom-relative-snapping',
  'shapes/tools/custom-shape-wrapper',
  'shapes/tools/custom-shape',
  'shapes/tools/custom-tool',
  'shapes/tools/custom-validators',
  'shapes/tools/drag-and-drop',
  'shapes/tools/drop-zone-shape',
  'shapes/tools/editable-shape',
  'shapes/tools/flex-layout',
  'shapes/tools/frame-layouts',
  'shapes/tools/globs-editor',
  'shapes/tools/interactive-shape',
  'shapes/tools/layout-bindings',
  'shapes/tools/outlined-text',
  'shapes/tools/persistent-iframe-shape',
  'shapes/tools/pin-bindings',
  'shapes/tools/popup-shape',
  'shapes/tools/portal-shapes',
  'shapes/tools/rich-text-custom-extension',
  'shapes/tools/rich-text-font-extensions',
  'shapes/tools/screenshot-tool',
  'shapes/tools/shape-with-custom-styles',
  'shapes/tools/shape-with-geometry',
  'shapes/tools/shape-with-migrations',
  'shapes/tools/shape-with-onClick',
  'shapes/tools/shape-with-onDoubleClickEdge',
  'shapes/tools/shape-with-tldraw-styles',
  'shapes/tools/size-from-dom',
  'shapes/tools/speech-bubble',
  'shapes/tools/stamp-tool',
  'shapes/tools/sticker-bindings',
  'shapes/tools/text-shape-configuration',
  'shapes/tools/toSvg-method-example',
  'shapes/tools/tool-with-child-states',
  'ui/action-overrides',
  'ui/add-connected-shape',
  'ui/add-tool-to-toolbar',
  'ui/changing-default-colors',
  'ui/changing-default-style',
  'ui/color-picker',
  'ui/contextual-toolbar',
  'ui/custom-components',
  'ui/custom-error-capture',
  'ui/custom-grid',
  'ui/custom-language-translations',
  'ui/custom-menus',
  'ui/custom-renderer',
  'ui/custom-theme',
  'ui/custom-ui',
  'ui/dark-mode-toggle',
  'ui/dark-mode',
  'ui/drag-and-drop-tray',
  'ui/error-boundary',
  'ui/escape-shape-focus-trap',
  'ui/floaty-window',
  'ui/force-mobile',
  'ui/hide-ui',
  'ui/indicators-logic',
  'ui/inspector-panel',
  'ui/keyboard-shortcuts',
  'ui/layer-panel',
  'ui/menu-system-hover',
  'ui/multiple-themes',
  'ui/overlay-theme-colors',
  'ui/page-panel',
  'ui/remove-tool',
  'ui/rich-text-on-multiple-shapes',
  'ui/screen-reader-accessibility',
  'ui/selection-color-condition',
  'ui/selection-ui',
  'ui/stroke-size-picker',
  'ui/text-mass-style-updates',
  'ui/things-on-the-canvas',
  'ui/toasts-and-dialogs',
  'ui/toolbar-groups',
  'ui/ui-components-hidden',
  'ui/ui-primitives',
  'ui/vertical-toolbar',
  'ui/zones',
  'use-cases/custom-shape-mermaids',
  'use-cases/d3-map',
  'use-cases/education-canvas',
  'use-cases/exam-marking',
  'use-cases/fog-of-war',
  'use-cases/hundred-mermaids',
  'use-cases/image-annotator',
  'use-cases/many-shapes',
  'use-cases/mask-window',
  'use-cases/mermaid-pasting',
  'use-cases/pdf-editor',
  'use-cases/slides',
  'use-cases/slideshow',
  'use-cases/snowstorm',
  'use-cases/soft-clip',
  'use-cases/timeline-scrubber',
  'use-cases/tower-defense',
  'use-cases/xkcd-dependency',
  'users/attribution-timeline',
  'users/attribution',
  'users/custom-user',
  'users/sync-custom-user',
] as const;

export type TldrawExampleStatus = 'callable';

export type TldrawExampleCapability = {
  id: string;
  category: string;
  slug: string;
  title: string;
  summary: string;
  source_path: string;
  source_url: string;
  example_url: string;
  status: TldrawExampleStatus;
  mapped_capability_ids: readonly string[];
  boundary: string;
};

const AVAILABLE_MAPPINGS: ReadonlyArray<{
  matches: readonly string[];
  capabilities: readonly string[];
}> = [
  {
    matches: ['align-and-distribute-shapes'],
    capabilities: ['canvas_ops.arrange'],
  },
  {
    matches: ['create-arrow'],
    capabilities: ['canvas_ops'],
  },
  {
    matches: ['z-order'],
    capabilities: ['canvas_ops.reorder'],
  },
];

function words(value: string) {
  return value.replace(/[-_/]+/g, ' ').trim();
}

function titleFor(slug: string) {
  const value = words(slug);
  return value ? value[0].toUpperCase() + value.slice(1) : 'Tldraw example';
}

function categoryAndSlug(path: string) {
  const segments = path.split('/');
  const slug = segments.at(-1) ?? path;
  const category = segments.slice(0, -1).join('/') || 'getting-started';
  return { category, slug };
}

function mappedCapabilities(path: string, slug: string) {
  const matches = AVAILABLE_MAPPINGS
    .filter((rule) => rule.matches.some((marker) => slug === marker || path.endsWith(`/${marker}`)))
    .flatMap((rule) => rule.capabilities);
  return [...new Set(matches)].sort();
}

function classify(path: string, category: string, slug: string) {
  const mapped_capability_ids = mappedCapabilities(path, slug);
  return {
    status: 'callable' as const,
    mapped_capability_ids,
    boundary: 'Resolve this exact example through fogwood-capabilities route mode. Route fidelity, execution lane, host requirements, and page authority are reported separately.',
  };
}

export const TLDRAW_EXAMPLE_CATALOG: readonly TldrawExampleCapability[] = Object.freeze(
  TLDRAW_EXAMPLE_PATHS.map((path) => {
    const { category, slug } = categoryAndSlug(path);
    const classification = classify(path, category, slug);
    return Object.freeze({
      id: `tldraw-example.${category.replaceAll('/', '.')}.${slug}`,
      category,
      slug,
      title: titleFor(slug),
      summary: `Official tldraw ${words(category)} example: ${words(slug)}.`,
      source_path: `${TLDRAW_EXAMPLE_SOURCE.examples_root}/${path}/README.md`,
      source_url: `${TLDRAW_EXAMPLE_SOURCE.repository}/blob/${TLDRAW_EXAMPLE_SOURCE.commit}/${TLDRAW_EXAMPLE_SOURCE.examples_root}/${path}/README.md`,
      example_url: `https://examples.tldraw.com/${slug}`,
      ...classification,
    });
  }),
);

export type TldrawExampleSearchInput = {
  query?: string;
  category?: string;
  status?: TldrawExampleStatus;
  limit?: number;
  cursor?: string;
};

export function searchTldrawExamples(input: TldrawExampleSearchInput = {}) {
  const query = typeof input.query === 'string' ? words(input.query).toLowerCase().slice(0, 120) : '';
  const category = typeof input.category === 'string' ? input.category.slice(0, 80) : '';
  const status = input.status;
  const limit = typeof input.limit === 'number' && Number.isInteger(input.limit)
    ? Math.max(1, Math.min(50, input.limit))
    : 20;
  const offset = typeof input.cursor === 'string' && /^\d+$/.test(input.cursor)
    ? Math.max(0, Number(input.cursor))
    : 0;
  const filtered = TLDRAW_EXAMPLE_CATALOG.filter((entry) => {
    if (category && entry.category !== category) return false;
    if (status && entry.status !== status) return false;
    if (!query) return true;
    const haystack = words([
      entry.id,
      entry.category,
      entry.slug,
      entry.title,
      entry.summary,
      ...entry.mapped_capability_ids,
    ].join(' ')).toLowerCase();
    return query.split(/\s+/u).every((token) => haystack.includes(token));
  });
  const results = filtered.slice(offset, offset + limit);
  const nextOffset = offset + results.length;
  return {
    source: TLDRAW_EXAMPLE_SOURCE,
    results,
    total: filtered.length,
    has_more: nextOffset < filtered.length,
    ...(nextOffset < filtered.length ? { next_cursor: String(nextOffset) } : {}),
  };
}
