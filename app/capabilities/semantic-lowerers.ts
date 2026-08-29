export const FOGWOOD_SEMANTIC_LOWERER_SCHEMA = 'fogwood.semantic-lowerer.v1' as const;

export type SemanticLowererManifest = Readonly<{
  schema: typeof FOGWOOD_SEMANTIC_LOWERER_SCHEMA;
  id: string;
  version: 1;
  family: 'page_ops' | 'camera_ops';
  intent: string;
  effects: readonly string[];
  keywords: readonly string[];
  preconditions: readonly string[];
  refusals: readonly string[];
  authority: 'page-apply';
  input_schema: Readonly<Record<string, unknown>>;
  preservation: readonly string[];
  lowering: 'deterministic-frozen-before-review';
  tldraw_primitives: readonly string[];
  installed_tldraw: '5.3.2';
  limits: Readonly<Record<string, number>>;
  fidelity: 'exact';
  qualification: 'adapter-fixture-tested';
  fixture_ids: readonly string[];
  example_ids: readonly string[];
  speculation: 'retrieval-only';
}>;

export const PAGE_OPS_ACTION_SCHEMA = deepFreeze({
  type: 'object',
  additionalProperties: false,
  properties: {
    type: { const: 'page_ops' },
    operation: {
      type: 'object',
      additionalProperties: false,
      properties: {
        op: { const: 'create_and_switch' },
        semantic_id: { type: 'string', minLength: 1, maxLength: 180, pattern: '^[A-Za-z0-9][A-Za-z0-9:._/-]{0,179}$' },
        name: { type: 'string', minLength: 1, maxLength: 80 },
      },
      required: ['op', 'semantic_id', 'name'],
    },
  },
  required: ['type', 'operation'],
});

export const CAMERA_OPS_ACTION_SCHEMA = deepFreeze({
  type: 'object',
  additionalProperties: false,
  properties: {
    type: { const: 'camera_ops' },
    operation: {
      type: 'object',
      additionalProperties: false,
      properties: {
        op: { const: 'focus_bounds' },
        x: { type: 'number', minimum: -100000, maximum: 100000 },
        y: { type: 'number', minimum: -100000, maximum: 100000 },
        w: { type: 'number', minimum: 16, maximum: 100000 },
        h: { type: 'number', minimum: 16, maximum: 100000 },
        inset: { type: 'number', minimum: 0, maximum: 512 },
      },
      required: ['op', 'x', 'y', 'w', 'h'],
    },
  },
  required: ['type', 'operation'],
});

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export function validateSemanticLowererManifest(value: unknown): value is SemanticLowererManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const manifest = value as Record<string, unknown>;
  const keys = ['schema', 'id', 'version', 'family', 'intent', 'effects', 'keywords', 'preconditions', 'refusals', 'authority', 'input_schema', 'preservation', 'lowering', 'tldraw_primitives', 'installed_tldraw', 'limits', 'fidelity', 'qualification', 'fixture_ids', 'example_ids', 'speculation'];
  if (Object.keys(manifest).some((key) => !keys.includes(key)) || keys.some((key) => !(key in manifest))) return false;
  const strings = (candidate: unknown) => Array.isArray(candidate) && candidate.length >= 1 && candidate.length <= 24 && candidate.every((item) => typeof item === 'string' && item.length > 0 && item.length <= 240);
  const expectedSchema = manifest.family === 'page_ops' ? PAGE_OPS_ACTION_SCHEMA : CAMERA_OPS_ACTION_SCHEMA;
  return manifest.schema === FOGWOOD_SEMANTIC_LOWERER_SCHEMA
    && typeof manifest.id === 'string' && /^[a-z][a-z0-9._-]{2,79}@1$/u.test(manifest.id)
    && manifest.version === 1
    && (manifest.family === 'page_ops' || manifest.family === 'camera_ops')
    && typeof manifest.intent === 'string' && manifest.intent.length > 0 && manifest.intent.length <= 240
    && strings(manifest.effects) && strings(manifest.keywords) && strings(manifest.preconditions) && strings(manifest.refusals)
    && manifest.authority === 'page-apply'
    && Boolean(manifest.input_schema) && typeof manifest.input_schema === 'object' && !Array.isArray(manifest.input_schema)
    && JSON.stringify(manifest.input_schema) === JSON.stringify(expectedSchema)
    && strings(manifest.preservation)
    && manifest.lowering === 'deterministic-frozen-before-review'
    && strings(manifest.tldraw_primitives)
    && manifest.installed_tldraw === '5.3.2'
    && Boolean(manifest.limits) && typeof manifest.limits === 'object' && !Array.isArray(manifest.limits) && Object.values(manifest.limits as Record<string, unknown>).every((limit) => typeof limit === 'number' && Number.isFinite(limit) && limit >= 0)
    && manifest.fidelity === 'exact'
    && manifest.qualification === 'adapter-fixture-tested' && strings(manifest.fixture_ids)
    && strings(manifest.example_ids)
    && manifest.speculation === 'retrieval-only';
}

const manifests: SemanticLowererManifest[] = [
  {
    schema: FOGWOOD_SEMANTIC_LOWERER_SCHEMA, id: 'page.lifecycle@1', version: 1, family: 'page_ops',
    intent: 'Create one named page and switch to it after page-owned review.', keywords: ['page', 'create page', 'new page', 'switch page'],
    effects: ['page.created', 'page.current.changed'],
    preconditions: ['editable document', 'page target does not exist', 'current content revision'], refusals: ['page limit reached', 'read-only document', 'stale revision'], authority: 'page-apply',
    input_schema: PAGE_OPS_ACTION_SCHEMA, preservation: ['existing pages', 'existing page content', 'current page until Apply'],
    lowering: 'deterministic-frozen-before-review', tldraw_primitives: ['PageRecordType.createId', 'Editor.createPage', 'Editor.setCurrentPage'], installed_tldraw: '5.3.2',
    limits: { operations: 1, name_characters: 80 }, fidelity: 'exact', qualification: 'adapter-fixture-tested', fixture_ids: ['surface-tools:page-lifecycle'], example_ids: ['tldraw-example.configuration.disable-pages'], speculation: 'retrieval-only',
  },
  {
    schema: FOGWOOD_SEMANTIC_LOWERER_SCHEMA, id: 'camera.focus-bounds@1', version: 1, family: 'camera_ops',
    intent: 'Focus the viewport on exact reviewed page bounds without changing document content.', keywords: ['camera', 'viewport', 'focus', 'zoom', 'frame'],
    effects: ['viewport.focused'],
    preconditions: ['interactive editable page', 'finite bounded page rectangle'], refusals: ['read-only page', 'invalid or unbounded rectangle'], authority: 'page-apply',
    input_schema: CAMERA_OPS_ACTION_SCHEMA, preservation: ['all document records', 'content revision', 'history'],
    lowering: 'deterministic-frozen-before-review', tldraw_primitives: ['Editor.zoomToBounds'], installed_tldraw: '5.3.2',
    limits: { operations: 1, coordinate_magnitude: 100000, maximum_inset: 512 }, fidelity: 'exact', qualification: 'adapter-fixture-tested', fixture_ids: ['surface-tools:camera-focus'], example_ids: ['tldraw-example.configuration.camera-options'], speculation: 'retrieval-only',
  },
];

if (!manifests.every(validateSemanticLowererManifest)) throw new Error('INVALID_BUILTIN_SEMANTIC_LOWERER_MANIFEST');
export const FOGWOOD_SEMANTIC_LOWERERS: readonly SemanticLowererManifest[] = deepFreeze(manifests);

export function searchSemanticLowerers(query = '') {
  const terms = query.toLowerCase().trim().split(/\s+/u).filter(Boolean);
  return FOGWOOD_SEMANTIC_LOWERERS.filter((manifest) => terms.length === 0 || terms.every((term) => `${manifest.id} ${manifest.family} ${manifest.intent} ${manifest.keywords.join(' ')}`.toLowerCase().includes(term)));
}

export type SemanticLowererAvailabilityFacts = Readonly<{
  readonly: boolean;
  page_count: number;
  max_pages: number;
  camera_locked: boolean;
}>;

export function availableSemanticLowerers(facts: SemanticLowererAvailabilityFacts) {
  return FOGWOOD_SEMANTIC_LOWERERS.map((manifest) => {
    const reasons: string[] = [];
    if (facts.readonly) reasons.push('document is read-only');
    if (manifest.family === 'page_ops' && facts.page_count >= facts.max_pages) reasons.push('page limit reached');
    if (manifest.family === 'camera_ops' && facts.camera_locked) reasons.push('camera is locked');
    return deepFreeze({
      ...manifest,
      availability: reasons.length === 0 ? 'available' as const : 'blocked' as const,
      availability_reasons: reasons,
      qualification_status: manifest.qualification,
    });
  });
}
