/**
 * Pure, browser-safe seams for Fogwood Agent Runtime v0.1.
 *
 * This module deliberately has no tldraw or DOM dependency. It is the contract
 * shared by the page adapter, WebMCP tools, and node-testable verification.
 */

// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
import { CANVAS_OPS_ACTION_SCHEMA, FOGWOOD_CANVAS_PROTOCOL, planCanvasOps } from './fogwood-canvas-ops.ts';
import type { CanvasOpPlan, CanvasOpsAction } from './fogwood-canvas-ops.ts';
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
import { FOGWOOD_SEEDED_COMPOSITION, planSeededComposition } from './fogwood-seeded-composition.ts';
import type { NormalizedSeededCompositionAction } from './fogwood-seeded-composition.ts';
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
import { TLDRAW_EXAMPLE_CATALOG } from './fogwood-tldraw-capabilities.ts';
import type { TldrawExampleStatus } from './fogwood-tldraw-capabilities.ts';
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
import { FOGWOOD_FULL_SURFACE_VERSION, getFullSurfaceRoute } from './fogwood-capability-compiler.ts';
import type { FullSurfaceRoute } from './fogwood-capability-compiler.ts';
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
import { FOGWOOD_CAPABILITY_EFFECTS, FOGWOOD_CAPABILITY_ONTOLOGY, FOGWOOD_CAPABILITY_ONTOLOGY_VERSION, FOGWOOD_CAPABILITY_PLANNED_ITEM_LIMIT } from './fogwood-capability-planner.ts';
import type { FogwoodCapabilityManifest } from './fogwood-capability-planner.ts';
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
import { isPreparedMaterial, prepareMaterials, MATERIAL_LIMITS, MATERIAL_TEXT_LIMITS, SUPPORTED_MATERIAL_MIME_TYPES } from './fogwood-materials.ts';
import type { MaterialInput, MaterialDecoder, PreparedMaterial } from './fogwood-materials.ts';
import type { SemanticRelationship } from './fogwood-spatial.ts';

export const FOGWOOD_PROTOCOL = 'fogwood-agent-runtime';
export const FOGWOOD_PROTOCOL_VERSION = '2';
export const FOGWOOD_REGISTRY_VERSION = '8';
export const FOGWOOD_PROPOSAL_VERSION = '1';
export const FOGWOOD_CONTEXT_VERSION = 'fogwood.context.v1' as const;
export const FOGWOOD_CONTEXT_SELECTION_LIMIT = 5_000 as const;
export const FOGWOOD_CONTEXT_SELECTION_PREVIEW_LIMIT = 128 as const;
export const CLEAR_SURFACE_PHRASE = 'clear the surface';

/** Agent-facing doctrine returned by inspect so the live page can be treated as a medium. */
export const FOGWOOD_PARTICIPATION_CONTRACT = {
  inspect_live_canvas_first: true,
  discover_bounded_materials_and_moves: true,
  inspect_actual_host_capabilities_just_in_time: true,
  use_fogwood_canvas_protocol_to_mix_bounded_editor_operations: true,
  all_official_tldraw_examples_have_callable_routes: true,
  route_fidelity_and_live_authority_are_reported_separately: true,
  plan_qualified_capabilities_against_the_inspected_revision: true,
  example_source_is_indexed_as_data_not_executed_as_code: true,
  separate_page_registration_host_exposure_conversation_inventory_successful_call: true,
  use_external_capabilities_only_when_observed: true,
  return_only_constrained_bytes_or_data_through_proposal_bridge: true,
  stage_and_stop_for_page_apply_or_reject: true,
  inspect_after_human_manipulation: true,
  branch_mutate_annotate_or_remix_instead_of_overwrite: true,
  seed_only_after_capability_scope_safety_permissions_and_authority_are_fixed: true,
  seed_may_break_ties_only_between_equally_qualified_compositions: true,
  seed_never_controls_facts_safety_permissions_semantic_identity_or_human_authority: true,
  no_implicit_live_provider: true,
} as const;

/**
 * The medium contract keeps the page's compositional intent machine-readable
 * without turning artistic guidance into a hidden validator or truth source.
 */
export const FOGWOOD_MEDIUM_CONTRACT = Object.freeze({
  schema: 'fogwood.medium-composition.v1',
  medium_statement: 'Fogwood turns capabilities into editable matter.',
  material_only_incomplete: true,
  standalone_added_material: 'incomplete',
  material_only_statement: 'A standalone added material is incomplete.',
  external_material_workflow: 'When external material is needed, use the existing material proposal, wait for page Apply, re-inspect its semantic ID, then compose native matter around it.',
  external_material_steps: Object.freeze([
    'use the existing material proposal',
    'wait for page Apply',
    're-inspect its semantic ID',
    'compose native matter around it',
  ]),
  composition_guidance: Object.freeze({
    prefer_majority_native_meaningful_objects: true,
    prefer_irregular_geometry: true,
    prefer_open_space: true,
    prefer_bound_typed_relations: true,
    prefer_questions_annotations: true,
    prefer_preserved_variants: true,
    preferred: Object.freeze([
      'majority native meaningful objects',
      'irregular geometry',
      'open space',
      'bound typed relations',
      'questions/annotations',
      'preserved variants',
    ]),
    avoid: Object.freeze([
      'card grids',
      'three-column dashboards',
      'standalone pasted assets unless explicitly requested',
    ]),
  }),
  inspect_after_user_geometry_or_selection_changes: true,
  artistic_constraints: Object.freeze({
    counts_and_ranges: 'advisory',
    advisory: true,
    safety_gate: false,
    truth_gate: false,
  }),
});

/** Alias for callers that name the contract by its composition concern. */
export const FOGWOOD_COMPOSITION_CONTRACT = FOGWOOD_MEDIUM_CONTRACT;

export const MAX_ACTIONS = 32;
export const MAX_BLOCKS_PER_ACTION = 48;
export const MAX_SHAPES_PER_ACTION = 64;
export const MAX_ITEMS_PER_ACTION = 100;
export const MAX_AGGREGATE_ADDS = 96;
export const MAX_MATERIALS_PER_ACTION = MATERIAL_LIMITS.max_materials_per_action;
export const MAX_MATERIALS_AGGREGATE_BYTES = MATERIAL_LIMITS.max_aggregate_bytes;
export const MAX_SUMMARY_LENGTH = 180;
export const MAX_RATIONALE_LENGTH = 500;

/**
 * Actions from the first block/recipe protocol are intentionally no longer
 * part of the agent surface. They remain named here so persisted callers and
 * migration tooling receive one explicit, recoverable validation error rather
 * than falling through to a partially supported lowering.
 */
export const FOGWOOD_RETIRED_ACTION_TYPES = Object.freeze([
  'insert_recipe',
  'add_blocks',
  'add_shapes',
  'apply_spatial_moves',
  'add_relationships',
  'update_blocks',
  'place_items',
  'remove_items',
  'clear_surface',
  'set_instrument_inputs',
] as const);
const RETIRED_ACTION_TYPES = new Set<string>(FOGWOOD_RETIRED_ACTION_TYPES);

export function isRetiredActionType(value: unknown): value is (typeof FOGWOOD_RETIRED_ACTION_TYPES)[number] {
  return typeof value === 'string' && RETIRED_ACTION_TYPES.has(value);
}

export const BLOCK_KINDS = [
  'panel',
  'heading',
  'text',
  'metric',
  'checklist',
  'table',
  'input',
  'select',
  'slider',
  'button',
  'progress',
  'chart',
] as const;

export const BLOCK_TONES = [
  'paper',
  'ink',
  'accent',
  'blue',
  'green',
  'yellow',
] as const;

export const CANVAS_SHAPE_KINDS = [
  'rectangle',
  'ellipse',
  'diamond',
  'triangle',
  'cloud',
  'note',
  'text',
  'arrow',
  'frame',
] as const;

export const CANVAS_COLORS = [
  'black',
  'grey',
  'violet',
  'blue',
  'light-blue',
  'yellow',
  'orange',
  'green',
  'light-green',
  'light-red',
  'red',
  'white',
] as const;

export const CANVAS_FILLS = ['none', 'semi', 'solid', 'pattern'] as const;

export type BlockKind = (typeof BLOCK_KINDS)[number];
export type BlockTone = (typeof BLOCK_TONES)[number];
export type CanvasShapeKind = (typeof CANVAS_SHAPE_KINDS)[number];
export type CanvasColor = (typeof CANVAS_COLORS)[number];
export type CanvasFill = (typeof CANVAS_FILLS)[number];

export type JsonRecord = Record<string, unknown>;

export type FogwoodMeta = {
  semantic_id?: string;
  semantic_id_source?: 'stable' | 'legacy-shape-id' | string;
  role?: string;
  composition_id?: string;
  region_id?: string;
  variant_id?: string;
  parent_variant_id?: string;
  lineage_source_id?: string;
  seeded_grammar?: string;
  seeded_algorithm_version?: number;
  seeded_prng?: string;
  seeded_seed?: string | number;
  seeded_wildness?: number;
  seeded_source_revision?: string;
  seeded_source_fingerprint?: string;
  seeded_branch_index?: number;
  seeded_depth?: number;
  relationship_id?: string;
  relationship_kind?: string;
  source_semantic_id?: string;
  target_semantic_id?: string;
  relationship_label?: string;
  recipe_id?: string;
  recipe_version?: number;
  recipe_instance_id?: string;
};

export type InspectableItem = {
  id: string;
  type_name?: string;
  type: string;
  kind?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  parent_id?: string;
  is_locked?: boolean;
  opacity?: number;
  index?: string;
  semantic_id?: string;
  binding_count?: number;
  meta?: FogwoodMeta;
  props?: JsonRecord;
  text?: string;
};

export type ProposalContext = {
  current_revision: string;
  items: readonly InspectableItem[];
  page_id?: string;
  selection_semantic_ids?: readonly string[];
  selection_complete?: boolean;
  selection_total?: number;
  regions?: readonly { id: string; semantic_id?: string; x: number; y: number; w: number; h: number; label?: string }[];
  semantic_relationships?: readonly SemanticRelationship[];
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value: JsonRecord, allowed: readonly string[]) {
  const keys = new Set(allowed);
  return Object.keys(value).every((key) => keys.has(key));
}

function boundedString(value: unknown, max: number) {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

/** Recursively sort object keys while preserving array order. */
export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])]),
  );
}

export function canonicalSerialize(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

/**
 * Browser-compatible FNV-1a over UTF-16 code units. Two independent 32-bit
 * lanes are concatenated instead of using BigInt so the controller remains
 * synchronous on the project's ES2017 target while revisions have 64 bits of
 * deterministic collision resistance.
 */
function fnv1a32(value: string, seed: number) {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function deterministicHash(value: string) {
  const primary = fnv1a32(value, 0x811c9dc5);
  const secondary = fnv1a32(`fogwood-secondary|${value}`, 0x9e3779b9);
  return `${primary.toString(16).padStart(8, '0')}${secondary.toString(16).padStart(8, '0')}`;
}

export type FogwoodContextProjectionInput = Readonly<{
  page_id: string;
  selected_ids?: readonly unknown[];
  current_tool_id?: unknown;
  current_tool_path?: unknown;
  readonly?: unknown;
  focused_group_id?: unknown;
  editing_shape_id?: unknown;
  ontology_version?: unknown;
  registry_version?: unknown;
}>;

export type FogwoodContextCompleteness = Readonly<{
  complete: boolean;
  truncated: boolean;
  total: number;
  returned: number;
  limit: number;
}>;

export type FogwoodContextProjection = Readonly<{
  schema: typeof FOGWOOD_CONTEXT_VERSION;
  page_id: string;
  selected_ids: readonly string[];
  selected_ids_preview: readonly string[];
  selection_completeness: FogwoodContextCompleteness;
  selected_ids_digest_completeness: FogwoodContextCompleteness;
  current_tool_id: string | null;
  current_tool_path: string | null;
  readonly: boolean;
  focused_group_id: string | null;
  editing_shape_id: string | null;
  ontology_version: number;
  registry_version: string;
}>;

function contextId(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value.slice(0, 180) : null;
}

function boundedContextIds(value: unknown): { ids: string[]; total: number } {
  if (!Array.isArray(value)) return { ids: [], total: 0 };
  const total = value.length;
  const ids: string[] = [];
  const limit = Math.min(total, FOGWOOD_CONTEXT_SELECTION_LIMIT);
  for (let index = 0; index < limit; index += 1) {
    if (!(index in value)) {
      ids.push('');
      continue;
    }
    const candidate = value[index];
    ids.push(typeof candidate === 'string' ? candidate.slice(0, 180) : '');
  }
  return { ids, total };
}

/**
 * Build the bounded ephemeral context projection used by semantic planning.
 * Content records, camera, viewport, hover state, and extension payloads are
 * intentionally absent so this token cannot replace the authoritative content
 * revision or become an unbounded host-state digest.
 */
export function buildContextProjection(input: FogwoodContextProjectionInput): FogwoodContextProjection {
  const selected = boundedContextIds(input?.selected_ids);
  const preview = selected.ids.slice(0, FOGWOOD_CONTEXT_SELECTION_PREVIEW_LIMIT);
  const previewComplete = selected.total <= FOGWOOD_CONTEXT_SELECTION_PREVIEW_LIMIT;
  const digestComplete = selected.total <= FOGWOOD_CONTEXT_SELECTION_LIMIT;
  return Object.freeze({
    schema: FOGWOOD_CONTEXT_VERSION,
    page_id: typeof input?.page_id === 'string' ? input.page_id.slice(0, 180) : '',
    selected_ids: Object.freeze(selected.ids),
    selected_ids_preview: Object.freeze(preview),
    selection_completeness: Object.freeze({
      complete: previewComplete,
      truncated: !previewComplete,
      total: selected.total,
      returned: preview.length,
      limit: FOGWOOD_CONTEXT_SELECTION_PREVIEW_LIMIT,
    }),
    selected_ids_digest_completeness: Object.freeze({
      complete: digestComplete,
      truncated: !digestComplete,
      total: selected.total,
      returned: selected.ids.length,
      limit: FOGWOOD_CONTEXT_SELECTION_LIMIT,
    }),
    current_tool_id: contextId(input?.current_tool_id),
    current_tool_path: contextId(input?.current_tool_path),
    readonly: input?.readonly === true,
    focused_group_id: contextId(input?.focused_group_id),
    editing_shape_id: contextId(input?.editing_shape_id),
    ontology_version: typeof input?.ontology_version === 'number' && Number.isInteger(input.ontology_version)
      ? input.ontology_version
      : FOGWOOD_CAPABILITY_ONTOLOGY_VERSION,
    registry_version: typeof input?.registry_version === 'string' && input.registry_version.length > 0
      ? input.registry_version.slice(0, 64)
      : FOGWOOD_REGISTRY_VERSION,
  });
}

export const projectFogwoodContext = buildContextProjection;

export function computeContextToken(
  value: FogwoodContextProjection | FogwoodContextProjectionInput,
) {
  // Re-project even when callers pass a projection-shaped object so future or
  // accidental camera/viewport/extension fields can never enter this digest.
  const projection = buildContextProjection(value as FogwoodContextProjectionInput);
  return deterministicHash(canonicalSerialize(projection));
}

export const fogwoodContextToken = computeContextToken;

export function computeRevision(content: unknown) {
  const serialized = canonicalSerialize(content);
  return `${FOGWOOD_PROTOCOL}/${FOGWOOD_PROTOCOL_VERSION}-${deterministicHash(
    `${FOGWOOD_PROTOCOL}/${FOGWOOD_PROTOCOL_VERSION}|${serialized}`,
  )}`;
}

/**
 * Shape and binding records are the only inputs here by construction. Camera,
 * selection, focus, and other ephemeral instance records never reach this seam.
 */
export function computePageRevision(
  pageId: string,
  shapes: readonly unknown[],
  bindings: readonly unknown[],
  assets?: readonly unknown[],
) {
  const sortById = (left: unknown, right: unknown) => {
    const leftId = isRecord(left) && typeof left.id === 'string' ? left.id : '';
    const rightId = isRecord(right) && typeof right.id === 'string' ? right.id : '';
    return leftId.localeCompare(rightId);
  };
  return computeRevision({
    content: 'current-page-shapes-and-bindings',
    page_id: pageId,
    shapes: [...shapes].sort(sortById),
    bindings: [...bindings].sort(sortById),
    ...(assets === undefined ? {} : { assets: [...assets].sort(sortById) }),
  });
}

export type BlockInput = {
  kind: BlockKind;
  tone?: BlockTone;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  title?: string;
  body?: string;
  value?: string | number;
  items?: Array<{ label: string; checked?: boolean }>;
  columns?: string[];
  rows?: string[][];
  options?: string[];
  series?: Array<{ label: string; value: number }>;
  min?: number;
  max?: number;
  step?: number;
};

export type CanvasShapeInput = {
  kind: CanvasShapeKind;
  x?: number;
  y?: number;
  end_x?: number;
  end_y?: number;
  w?: number;
  h?: number;
  text?: string;
  color?: CanvasColor;
  fill?: CanvasFill;
  rotation?: number;
  opacity?: number;
  /** Optional stable semantic composition metadata. */
  semantic_id?: string;
  role?: string;
  composition_id?: string;
  region_id?: string;
  variant_id?: string;
  parent_variant_id?: string;
  lineage_source_id?: string;
};


function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object') return value;
  Object.freeze(value);
  for (const child of Object.values(value as object)) deepFreeze(child);
  return value;
}

type CapabilitySchema = JsonRecord;

export type Capability = {
  id: string;
  kind: 'tool' | 'action' | 'primitive' | 'capability' | 'example';
  version: number;
  title: string;
  summary: string;
  use_when: string;
  keywords: readonly string[];
  effect: 'read-only' | 'stage-only' | 'page-apply';
  input_schema?: CapabilitySchema;
  status?: TldrawExampleStatus;
  mapped_capability_ids?: readonly string[];
  boundary?: string;
  category?: string;
  source_url?: string;
  manifest?: FogwoodCapabilityManifest;
  route?: FullSurfaceRoute;
};

export const INSPECT_INPUT_SCHEMA: CapabilitySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    page_size: { type: 'integer', minimum: 1, maximum: 128 },
    cursor: { type: 'string', pattern: '^\\d+$', maxLength: 12 },
    binding_page_size: { type: 'integer', minimum: 1, maximum: 256 },
    binding_cursor: { type: 'string', pattern: '^\\d+$', maxLength: 12 },
  },
};


const materialItemSchemaFor = (
  mimeType: (typeof SUPPORTED_MATERIAL_MIME_TYPES)[number],
  maxBytes: number,
): CapabilitySchema => ({
  type: 'object',
  additionalProperties: false,
  properties: {
    semantic_id: {
      type: 'string',
      minLength: 1,
      maxLength: MATERIAL_TEXT_LIMITS.semantic_id,
      pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$',
    },
    mime_type: { const: mimeType },
    base64: {
      type: 'string',
      minLength: 4,
      maxLength: Math.ceil(maxBytes / 3) * 4,
      pattern: '^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$',
    },
    label: { type: 'string', maxLength: MATERIAL_TEXT_LIMITS.label },
    alt: { type: 'string', maxLength: MATERIAL_TEXT_LIMITS.alt },
    prompt_summary: { type: 'string', maxLength: MATERIAL_TEXT_LIMITS.prompt_summary },
    originating_capability: { type: 'string', maxLength: MATERIAL_TEXT_LIMITS.originating_capability },
    qualification_boundary: { type: 'string', maxLength: MATERIAL_TEXT_LIMITS.qualification_boundary },
    x: { type: 'number', minimum: -100000, maximum: 100000 },
    y: { type: 'number', minimum: -100000, maximum: 100000 },
    w: { type: 'number', minimum: 16, maximum: MATERIAL_LIMITS.max_dimension },
    h: { type: 'number', minimum: 16, maximum: MATERIAL_LIMITS.max_dimension },
  },
  required: ['semantic_id', 'mime_type', 'base64', 'x', 'y', 'w', 'h'],
});

const materialItemSchema: CapabilitySchema = {
  oneOf: SUPPORTED_MATERIAL_MIME_TYPES.map((mimeType) => materialItemSchemaFor(
    mimeType,
    mimeType === 'image/svg+xml' ? MATERIAL_LIMITS.max_svg_bytes : MATERIAL_LIMITS.max_raster_bytes,
  )),
};

/** The active proposal family is deliberately small and composable. */
const exactActionSchemas: Record<string, CapabilitySchema> = {
  canvas_ops: CANVAS_OPS_ACTION_SCHEMA as unknown as CapabilitySchema,
  seeded_composition: {
    type: 'object',
    additionalProperties: false,
    properties: {
      type: { const: 'seeded_composition' },
      scope: {
        oneOf: [
          {
            type: 'object',
            additionalProperties: false,
            properties: { kind: { const: 'selection' } },
            required: ['kind'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              kind: { const: 'explicit' },
              semantic_ids: {
                type: 'array',
                minItems: 1,
                maxItems: FOGWOOD_SEEDED_COMPOSITION.max_targets,
                items: { type: 'string', minLength: 1, maxLength: 180, pattern: '^[A-Za-z0-9][A-Za-z0-9:._/-]{0,179}$' },
              },
            },
            required: ['kind', 'semantic_ids'],
          },
        ],
      },
      seed: {
        oneOf: [
          { type: 'string', minLength: 1, maxLength: FOGWOOD_SEEDED_COMPOSITION.max_seed_length },
          { type: 'integer', minimum: Number.MIN_SAFE_INTEGER, maximum: Number.MAX_SAFE_INTEGER },
        ],
      },
      wildness: { type: 'number', minimum: 0, maximum: 1 },
    },
    required: ['type', 'scope', 'seed'],
  },
  add_materials: {
    type: 'object',
    additionalProperties: false,
    properties: {
      type: { const: 'add_materials' },
      coordinate_space: { const: 'page' },
      materials: {
        type: 'array',
        minItems: 1,
        maxItems: MAX_MATERIALS_PER_ACTION,
        items: materialItemSchema,
      },
    },
    required: ['type', 'materials'],
  },
};



/** The exact same schema is exposed by the registry and page WebMCP tool. */
export const PROPOSAL_INPUT_SCHEMA: CapabilitySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    base_revision: { type: 'string', minLength: 1, maxLength: 120 },
    summary: { type: 'string', minLength: 1, maxLength: MAX_SUMMARY_LENGTH },
    rationale: { type: 'string', maxLength: MAX_RATIONALE_LENGTH },
    actions: {
      type: 'array',
      minItems: 1,
      maxItems: 1,
      description: 'One public action per staged proposal. canvas_ops composes up to 24 native editor operations; seeded_composition creates bounded reproducible preserved variants; add_materials stages one bounded local material batch.',
      items: { oneOf: [exactActionSchemas.canvas_ops, exactActionSchemas.seeded_composition, exactActionSchemas.add_materials] },
    },
  },
  required: ['base_revision', 'summary', 'actions'],
};

/**
 * Public transport schema for fogwood-propose. context_token is a sidecar for
 * ephemeral selection/tool/permission state and is stripped before the
 * ProposalV1 validator sees the request, so it never enters proposal identity.
 */
export const PROPOSAL_TOOL_INPUT_SCHEMA: CapabilitySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ...(PROPOSAL_INPUT_SCHEMA.properties as JsonRecord),
    context_token: { type: 'string', minLength: 1, maxLength: 64 },
  },
  required: ['base_revision', 'context_token', 'summary', 'actions'],
};
export const FOGWOOD_PROPOSAL_INPUT_SCHEMA = PROPOSAL_TOOL_INPUT_SCHEMA;

/** Shared by the registry and the registered page tool to prevent contract drift. */
export const CAPABILITY_INPUT_SCHEMA: CapabilitySchema = {
  oneOf: [
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        mode: { const: 'search' },
        query: { type: 'string', maxLength: 120 },
        kind: { type: 'string', enum: ['tool', 'action', 'primitive', 'capability', 'example'] },
        status: { type: 'string', enum: ['callable'] },
        category: { type: 'string', maxLength: 80 },
        page_size: { type: 'integer', minimum: 1, maximum: 20 },
        cursor: { type: 'string', pattern: '^\\d+$', maxLength: 16 },
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        mode: { const: 'available' },
        base_revision: { type: 'string', minLength: 1, maxLength: 120 },
        context_token: { type: 'string', minLength: 1, maxLength: 64 },
      },
      required: ['mode', 'base_revision', 'context_token'],
    },
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        mode: { const: 'plan' },
        intent: { type: 'string', minLength: 1, maxLength: 500 },
        base_revision: { type: 'string', minLength: 1, maxLength: 120 },
        context_token: { type: 'string', minLength: 1, maxLength: 64 },
        scope: { type: 'string', enum: ['new', 'selection', 'page'] },
        desired_effects: {
          type: 'array',
          maxItems: 12,
          items: { type: 'string', enum: [...FOGWOOD_CAPABILITY_EFFECTS] },
        },
        planned_item_count: { type: 'integer', minimum: 0, maximum: FOGWOOD_CAPABILITY_PLANNED_ITEM_LIMIT },
        max_steps: { type: 'integer', minimum: 1, maximum: 12 },
      },
      required: ['mode', 'intent', 'base_revision', 'context_token', 'scope'],
    },
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        mode: { const: 'route' },
        intent: { type: 'string', minLength: 1, maxLength: 500 },
        example_ids: {
          type: 'array',
          minItems: 1,
          maxItems: 24,
          items: { type: 'string', minLength: 1, maxLength: 160 },
        },
        base_revision: { type: 'string', minLength: 1, maxLength: 120 },
        context_token: { type: 'string', minLength: 1, maxLength: 64 },
        scope: { type: 'string', enum: ['new', 'selection', 'page'] },
        max_steps: { type: 'integer', minimum: 1, maximum: 24 },
      },
      required: ['mode', 'intent', 'base_revision', 'context_token', 'scope'],
    },
  ],
};

export const CAPABILITY_REGISTRY: readonly Capability[] = deepFreeze([
  {
    id: 'fogwood-inspect',
    kind: 'tool',
    version: 2,
    title: 'Inspect Fogwood',
    summary: 'Read the bounded live canvas, spatial grammar, semantic relationships, and editable state.',
    use_when: 'Always inspect the live page first, before searching capabilities or proposing a change.',
    keywords: ['inspect', 'live', 'canvas', 'spatial', 'semantic', 'state', 'page', 'revision', 'viewport'],
    effect: 'read-only',
    input_schema: INSPECT_INPUT_SCHEMA,
  },
  {
    id: 'fogwood-capabilities',
    kind: 'tool',
    version: 2,
    title: 'Discover or plan Fogwood capabilities',
    summary: 'Search, resolve, and compose all 213 pinned tldraw example routes or the smaller native semantic ontology against live canvas context.',
    use_when: 'After inspecting the page, use route mode for the full examples surface or plan mode for exact native semantic operations; never assume a host capability or live provider.',
    keywords: ['search', 'route', 'compose', 'plan', 'ontology', 'capability', 'effect', 'example', 'adapter', 'recipe', 'qualified'],
    effect: 'read-only',
    input_schema: CAPABILITY_INPUT_SCHEMA,
  },
  {
    id: 'fogwood-propose',
    kind: 'tool',
    version: 2,
    title: 'Propose a Fogwood change',
    summary: 'Stage one typed, bounded composition or page proposal for page-owned human review.',
    use_when: 'A bounded composition, material, spatial move, semantic edge, or legacy block change is ready after inspecting current page state.',
    keywords: ['proposal', 'composition', 'material', 'spatial', 'semantic', 'stage', 'review', 'apply', 'reject'],
    effect: 'stage-only',
    input_schema: PROPOSAL_TOOL_INPUT_SCHEMA,
  },
  {
    id: 'canvas_ops',
    kind: 'action',
    version: FOGWOOD_CANVAS_PROTOCOL.version,
    title: 'Compose native canvas operations',
    summary: 'Mix bounded native-shape creation, drawing, bound connectors, typed semantic relationships, preserved variants, updates, arrangement, structure, z-order changes, and leaf deletion in one reviewed proposal.',
    use_when: 'Codex needs to turn a request into native editable canvas matter or reshape exact existing tldraw objects without replacing the page.',
    keywords: ['canvas protocol', 'create', 'draw', 'connect', 'binding', 'relationship', 'semantic', 'composition', 'region', 'variant', 'lineage', 'update', 'resize', 'align', 'distribute', 'stack', 'pack', 'group', 'ungroup', 'reorder', 'z-order', 'delete', 'mix', 'compose'],
    effect: 'page-apply',
    input_schema: exactActionSchemas.canvas_ops,
  },
  {
    id: 'canvas_ops.draw',
    kind: 'primitive',
    version: 1,
    title: 'Draw a native path',
    summary: 'Create a bounded editable tldraw draw shape from page-space points.',
    use_when: 'A sketch, trace, gesture, connector, or irregular mark should stay native and editable.',
    keywords: ['draw', 'freehand', 'path', 'trace', 'sketch', 'native'],
    effect: 'page-apply',
  },
  {
    id: 'canvas_ops.connect',
    kind: 'primitive',
    version: 2,
    title: 'Connect two native targets',
    summary: 'Create one editable arrow with native tldraw start and end bindings, optionally carrying a typed semantic relationship.',
    use_when: 'Exactly two current or earlier-created targets should stay visually connected after movement.',
    keywords: ['connect', 'bound connector', 'typed relationship', 'arrow binding', 'endpoint', 'follow'],
    effect: 'page-apply',
  },
  {
    id: 'canvas_ops.variant',
    kind: 'primitive',
    version: 2,
    title: 'Create a preserved variant',
    summary: 'Clone one bounded native source into separately editable matter while preserving source and lineage.',
    use_when: 'A user wants a branch, remix, or mutation without replacing the existing source.',
    keywords: ['variant', 'preserve', 'clone', 'branch', 'remix', 'lineage'],
    effect: 'page-apply',
  },
  {
    id: 'seeded_composition',
    kind: 'action',
    version: FOGWOOD_SEEDED_COMPOSITION.algorithm_version,
    title: 'Remix selected canvas matter reproducibly',
    summary: 'Preserve exact stable native sources and create a bounded branch-cluster of seeded, separately editable variants in qualified open space.',
    use_when: 'The user wants surprise, alternatives, remixing, mutation, or reproducible visual variation without overwriting the selected originals.',
    keywords: ['seed', 'seeded', 'remix', 'mutate', 'variation', 'wildness', 'branch', 'cluster', 'palette', 'rhythm', 'rotation', 'open space', 'lineage'],
    effect: 'page-apply',
    input_schema: exactActionSchemas.seeded_composition,
  },
  {
    id: 'canvas_ops.edit',
    kind: 'primitive',
    version: 1,
    title: 'Edit and resize native matter',
    summary: 'Change allowlisted geometry, text, style, opacity, and bounds on exact unlocked direct-page shapes.',
    use_when: 'Existing native canvas matter should be refined rather than replaced.',
    keywords: ['update', 'edit', 'resize', 'text', 'color', 'fill', 'opacity'],
    effect: 'page-apply',
  },
  {
    id: 'canvas_ops.arrange',
    kind: 'primitive',
    version: 1,
    title: 'Arrange native matter',
    summary: 'Align, distribute, stack, or pack exact unlocked shapes with deterministic page-space geometry.',
    use_when: 'A composition needs intentional spatial rhythm without normalizing it into a dashboard grid.',
    keywords: ['align', 'distribute', 'stack', 'pack', 'layout', 'arrange'],
    effect: 'page-apply',
  },
  {
    id: 'canvas_ops.group',
    kind: 'primitive',
    version: 1,
    title: 'Group or ungroup native matter',
    summary: 'Create or dissolve a bounded tldraw group while preserving its editable children.',
    use_when: 'Several marks should become one movable unit or an existing unit should become separately editable.',
    keywords: ['group', 'ungroup', 'containment', 'children'],
    effect: 'page-apply',
  },
  {
    id: 'canvas_ops.reorder',
    kind: 'primitive',
    version: 1,
    title: 'Change canvas z-order',
    summary: 'Move exact unlocked shapes forward, backward, to front, or to back.',
    use_when: 'Overlap and visual layering carry meaning in the composition.',
    keywords: ['reorder', 'z-order', 'front', 'back', 'layer'],
    effect: 'page-apply',
  },
  {
    id: 'canvas_ops.lock-safety',
    kind: 'primitive',
    version: 1,
    title: 'Respect locked canvas matter',
    summary: 'Refuse operations that would directly or indirectly change a locked shape or locked ancestor.',
    use_when: 'The agent must preserve human-locked matter and fail before staging.',
    keywords: ['locked', 'readonly', 'permission', 'safety', 'ancestor'],
    effect: 'read-only',
  },
  {
    id: 'persistence.device-local',
    kind: 'primitive',
    version: 1,
    title: 'Device-local persistence',
    summary: 'Persist accepted tldraw records in the browser using the existing page-owned local store.',
    use_when: 'The agent needs to understand that accepted matter survives reload locally without a collaboration service.',
    keywords: ['persistence', 'local storage', 'snapshot', 'device-local', 'reload'],
    effect: 'read-only',
  },
  {
    id: 'add_materials',
    kind: 'action',
    version: 1,
    title: 'Add qualified materials',
    summary: 'Add bounded, content-addressed images or strict-subset SVG materials after local decode or sanitization qualification.',
    use_when: 'The proposal needs a reviewed local image or sanitized geometry asset on the page.',
    keywords: ['material', 'image', 'svg', 'asset', 'qualified'],
    effect: 'page-apply',
    input_schema: exactActionSchemas.add_materials,
  },
  {
    id: 'primitive.surface-block',
    kind: 'primitive',
    version: 1,
    title: 'Fogwood interface block',
    summary: 'Editable bounded block with typed data arrays and ranges.',
    use_when: 'An interface primitive is easier to review than a free-form shape.',
    keywords: [...BLOCK_KINDS],
    effect: 'page-apply',
    input_schema: { type: 'string', enum: [...BLOCK_KINDS] },
  },
  {
    id: 'primitive.native-shapes',
    kind: 'primitive',
    version: 1,
    title: 'Native tldraw shapes',
    summary: 'Bounded native shapes for diagrams and spatial annotations.',
    use_when: 'A diagram needs arrows, notes, text, frames, or simple geometry.',
    keywords: [...CANVAS_SHAPE_KINDS],
    effect: 'page-apply',
    input_schema: { type: 'string', enum: [...CANVAS_SHAPE_KINDS] },
  },
  ...FOGWOOD_CAPABILITY_ONTOLOGY.map((manifest): Capability => ({
    id: manifest.id,
    kind: 'capability',
    version: manifest.version,
    title: manifest.title,
    summary: manifest.intent.use_when,
    use_when: manifest.intent.use_when,
    keywords: [...manifest.intent.keywords, ...manifest.effects],
    effect: 'page-apply',
    manifest,
  })),
  ...TLDRAW_EXAMPLE_CATALOG.map((entry): Capability => ({
    ...(() => {
      const route = getFullSurfaceRoute(entry.id);
      return {
        route,
        keywords: [
          entry.category,
          entry.slug,
          entry.status,
          route.family,
          route.execution_lane,
          route.fidelity,
          route.adapter_id,
          ...entry.mapped_capability_ids,
        ],
        use_when: `Resolve this exact official example through ${route.route_id}; its ${route.fidelity} ${route.execution_lane} path reports any host requirement before execution.`,
        boundary: route.boundary,
      };
    })(),
    id: entry.id,
    kind: 'example',
    version: FOGWOOD_FULL_SURFACE_VERSION,
    title: entry.title,
    summary: entry.summary,
    effect: 'read-only',
    status: entry.status,
    mapped_capability_ids: entry.mapped_capability_ids,
    category: entry.category,
    source_url: entry.source_url,
  })),
]);

export type CapabilitySearchInput = {
  query?: string;
  kind?: Capability['kind'];
  status?: TldrawExampleStatus;
  category?: string;
  page_size?: number;
  cursor?: string;
};

export type CapabilitySearchResult = {
  registry_version: string;
  results: Capability[];
  next_cursor?: string;
  has_more: boolean;
};

const PUBLIC_CAPABILITY_IDS = new Set([
  'fogwood-inspect',
  'fogwood-capabilities',
  'fogwood-propose',
  'canvas_ops',
  'canvas_ops.draw',
  'canvas_ops.connect',
  'canvas_ops.variant',
  'seeded_composition',
  'canvas_ops.edit',
  'canvas_ops.arrange',
  'canvas_ops.group',
  'canvas_ops.reorder',
  'canvas_ops.lock-safety',
  'persistence.device-local',
  'add_materials',
  ...FOGWOOD_CAPABILITY_ONTOLOGY.map((manifest) => manifest.id),
]);

export function searchCapabilities(input: CapabilitySearchInput = {}): CapabilitySearchResult {
  const query = boundedString(input.query, 120).trim().toLowerCase();
  const pageSize = isFiniteNumber(input.page_size)
    ? clamp(Math.trunc(input.page_size), 1, 20)
    : 12;
  const offset = input.cursor && /^\d+$/.test(input.cursor) ? Number(input.cursor) : 0;
  const filtered = CAPABILITY_REGISTRY.filter((capability) => {
    if (capability.kind !== 'example' && !PUBLIC_CAPABILITY_IDS.has(capability.id)) return false;
    if (input.kind && capability.kind !== input.kind) return false;
    if (input.status && capability.status !== input.status) return false;
    if (input.category && capability.category !== input.category) return false;
    if (!query) return true;
    const haystack = [
      capability.id,
      capability.title,
      capability.summary,
      capability.use_when,
      capability.status ?? '',
      capability.category ?? '',
      capability.boundary ?? '',
      ...(capability.mapped_capability_ids ?? []),
      ...capability.keywords,
    ]
      .join(' ')
      .toLowerCase();
    return query.split(/\s+/u).every((token) => haystack.includes(token));
  });
  const results = filtered.slice(offset, offset + pageSize).map((capability) => ({
    ...capability,
    keywords: [...capability.keywords],
  }));
  const nextOffset = offset + results.length;
  return {
    registry_version: FOGWOOD_REGISTRY_VERSION,
    results,
    has_more: nextOffset < filtered.length,
    ...(nextOffset < filtered.length ? { next_cursor: String(nextOffset) } : {}),
  };
}

export type AddMaterialsAction = {
  type: 'add_materials';
  coordinate_space?: 'page';
  materials: Array<MaterialInput | PreparedMaterial>;
};

export type ProposalAction =
  | CanvasOpsAction
  | NormalizedSeededCompositionAction
  | AddMaterialsAction;

export type ProposalV1 = {
  base_revision: string;
  summary: string;
  rationale?: string;
  actions: ProposalAction[];
};

export const FOGWOOD_PREPARED_CANVAS_PLAN_SCHEMA = 'fogwood.prepared-canvas-plan.v1' as const;

export type PreparedMaterialEvidence = Readonly<{
  semantic_id: string;
  content_hash: string;
  mime_type: PreparedMaterial['mime_type'];
  byte_length: number;
  dimensions: Readonly<{ width: number; height: number }>;
  source_status: PreparedMaterial['source_status'];
  decode_qualified: true;
  originating_capability: string;
  qualification_boundary: string;
}>;

export type PreparedCanvasPlanPreflight = Readonly<{
  status: 'passed';
  page_id: string;
  content_revision: string;
  target_count: number;
  material_decode: 'complete';
  plan_lowering: 'complete';
}>;

export type PreparedCanvasPlanTransaction = Readonly<{
  authority: 'page-owned';
  atomic: true;
  editor_run: 'one';
  history: 'one-stopping-point';
  undo: 'one-step';
  apply: 'frozen-lowerings-only';
  reject: 'no-mutation';
}>;

/**
 * A completely prepared proposal. Page adapters may attach private lowering
 * details through `lowerings`, but the public shape remains a bounded,
 * inspectable description of exactly what will be decided. Prepared material
 * objects are deliberately retained by identity; the material module's
 * WeakSet proof must not be defeated by cloning a plan.
 */
export type PreparedCanvasPlan = Readonly<{
  schema: typeof FOGWOOD_PREPARED_CANVAS_PLAN_SCHEMA;
  page_id: string;
  proposal: ProposalV1;
  diff: ProposalDiff;
  base_revision: string;
  content_revision: string;
  context_token?: string;
  actions: readonly ProposalAction[];
  operations: readonly unknown[];
  lowerings: readonly unknown[];
  prepared_materials: readonly PreparedMaterial[];
  seeded_evidence: Readonly<ProposalDiff['seeded_compositions']>;
  material_evidence: readonly PreparedMaterialEvidence[];
  preflight: PreparedCanvasPlanPreflight;
  transaction: PreparedCanvasPlanTransaction;
  digest: string;
}>;

export type ProposalError = { code: string; message: string; path?: string };

export type ProposalDiffValue = unknown;

export type ProposalItemDescriptor = {
  id: string;
  type: string;
  kind?: string;
  semantic_id?: string;
  parent_id?: string;
  label: string;
};

export type ProposalDiff = {
  adds: {
    blocks: number;
    shapes: number;
    materials: number;
    total: number;
    specs: Array<{
      type: 'block' | 'shape' | 'material';
      kind: string;
      label: string;
      x?: number;
      y?: number;
      end_x?: number;
      end_y?: number;
      w?: number;
      h?: number;
      semantic_id?: string;
      role?: string;
      composition_id?: string;
      region_id?: string;
      rotation?: number;
      opacity?: number;
      variant_id?: string;
      parent_variant_id?: string;
      lineage_source_id?: string;
      mime_type?: string;
      content_hash?: string;
      byte_length?: number;
      dimensions?: { width: number; height: number };
      source_status?: 'original' | 'sanitized';
      decode_qualified?: boolean;
      alt?: string;
      prompt_summary?: string;
      originating_capability?: string;
      qualification_boundary?: string;
    }>;
    material_specs: Array<{
      type: 'material';
      kind: string;
      label: string;
      semantic_id: string;
      mime_type: string;
      content_hash: string;
      byte_length: number;
      dimensions: { width: number; height: number };
      source_status: 'original' | 'sanitized';
      decode_qualified: boolean;
      x: number;
      y: number;
      w: number;
      h: number;
      alt: string;
      prompt_summary: string;
      originating_capability: string;
      qualification_boundary: string;
    }>;
  };
  updates: Array<{
    ids: string[];
    fields: string[];
    changes: Array<{ id: string; fields: Record<string, { before: ProposalDiffValue; after: ProposalDiffValue }> }>;
  }>;
  moves: Array<{
    ids: string[];
    changes: Array<{ id: string; before: { x: number; y: number; rotation: number }; after: { x: number; y: number; rotation: number } }>;
  }>;
  spatial_moves: Array<{
    move_index: number;
    kind: string;
    semantic_id: string;
    shape_id: string;
    before: { x: number; y: number; rotation: number };
    after: { x: number; y: number; rotation: number };
  }>;
  spatial_creates: Array<{
    move_index: number;
    kind: 'annotation' | 'variant';
    semantic_id: string;
    source_semantic_id?: string;
    source_shape_id?: string;
    type: string;
    x: number;
    y: number;
    w: number;
    h: number;
    text?: string;
    lineage_source_id?: string;
    parent_variant_id?: string;
    variant_id?: string;
  }>;
  semantic_relationships: Array<{
    id: string;
    kind: string;
    source_semantic_id: string;
    target_semantic_id: string;
    label?: string;
    shape_id?: string;
  }>;
  removes: { ids: string[]; total: number; collateral_ids: string[]; descriptors: ProposalItemDescriptor[] };
  seeded_compositions: Array<{
    grammar: 'remix';
    algorithm_version: 1;
    prng: 'xorshift32-v1';
    seed: string | number;
    wildness: number;
    source_revision: string;
    source_fingerprint: string;
    layout: NormalizedSeededCompositionAction['layout'];
    lineage: NormalizedSeededCompositionAction['lineage'];
  }>;
  counts: { before: number; after: number; adds: number; updates: number; moves: number; removes: number };
  warnings: string[];
};

export type ProposalValidation =
  | { ok: true; proposal: ProposalV1; diff: ProposalDiff }
  | { ok: false; errors: ProposalError[] };

export type ProposalValidationOptions = {
  /** Prepared objects are branded by fogwood-materials and carry decode proof. */
  preparedMaterials?: ReadonlyMap<number, readonly PreparedMaterial[]>;
};

function addError(errors: ProposalError[], code: string, message: string, path?: string) {
  errors.push({ code, message, ...(path ? { path } : {}) });
}


export function buildProposalDiff(
  actions: readonly ProposalAction[],
  context: ProposalContext,
  warnings: string[] = [],
): ProposalDiff {
  const adds: ProposalDiff['adds'] = { blocks: 0, shapes: 0, materials: 0, total: 0, specs: [], material_specs: [] };
  const updates: ProposalDiff['updates'] = [];
  const moves: ProposalDiff['moves'] = [];
  const removes: ProposalDiff['removes'] = { ids: [], total: 0, collateral_ids: [], descriptors: [] };
  const seeded_compositions: ProposalDiff['seeded_compositions'] = [];
  const items = new Map(context.items.map((item) => [item.id, item]));

  const descriptor = (item: InspectableItem): ProposalItemDescriptor => {
    const props = item.props ?? {};
    const label = item.text
      || (typeof props.title === 'string' ? props.title : typeof props.name === 'string' ? props.name : '')
      || item.kind
      || item.type;
    return {
      id: item.id,
      type: item.type,
      ...(item.kind ? { kind: item.kind } : {}),
      ...(item.semantic_id ? { semantic_id: item.semantic_id.slice(0, 180) } : {}),
      ...(item.parent_id ? { parent_id: item.parent_id } : {}),
      label: String(label).slice(0, 120),
    };
  };

  const projectCanvasPlan = (plan: CanvasOpPlan) => {
    adds.shapes += plan.adds.length;
    adds.specs.push(...plan.adds.map((addition) => ({
      type: 'shape' as const,
      kind: addition.kind,
      label: addition.label,
      x: addition.x,
      y: addition.y,
      w: addition.w,
      h: addition.h,
      semantic_id: addition.semantic_id,
      ...(addition.role ? { role: addition.role } : {}),
      ...(addition.composition_id ? { composition_id: addition.composition_id } : {}),
      ...(addition.region_id ? { region_id: addition.region_id } : {}),
      ...(addition.rotation === undefined ? {} : { rotation: addition.rotation }),
      ...(addition.opacity === undefined ? {} : { opacity: addition.opacity }),
      ...(addition.variant_id ? { variant_id: addition.variant_id } : {}),
      ...(addition.parent_variant_id ? { parent_variant_id: addition.parent_variant_id } : {}),
      ...(addition.lineage_source_id ? { lineage_source_id: addition.lineage_source_id } : {}),
    })));
    updates.push(...plan.updates);
    moves.push(...plan.moves);
    for (const id of plan.removes) if (!removes.ids.includes(id)) removes.ids.push(id);
  };

  for (const action of actions) {
    if (action.type === 'canvas_ops' || action.type === 'seeded_composition') {
      const result = planCanvasOps(context.items, action.ops, context.page_id, action.type === 'canvas_ops' ? action.composition_id : undefined);
      if (result.ok) projectCanvasPlan(result.plan);
      if (action.type === 'seeded_composition') {
        seeded_compositions.push({
          grammar: action.grammar,
          algorithm_version: action.algorithm_version,
          prng: action.prng,
          seed: action.seed,
          wildness: action.wildness,
          source_revision: action.source_revision,
          source_fingerprint: action.source_fingerprint,
          layout: action.layout,
          lineage: action.lineage,
        });
      }
      continue;
    }
    if (action.type === 'add_materials') {
      adds.materials += action.materials.length;
      for (const material of action.materials) {
        if (!isPreparedMaterial(material)) continue;
        const spec = {
          type: 'material' as const,
          kind: material.mime_type,
          label: material.label || material.semantic_id,
          semantic_id: material.semantic_id,
          mime_type: material.mime_type,
          content_hash: material.content_hash,
          byte_length: material.byte_length,
          dimensions: { ...material.dimensions },
          source_status: material.source_status,
          decode_qualified: material.decode_qualified,
          x: material.x,
          y: material.y,
          w: material.w,
          h: material.h,
          alt: material.alt,
          prompt_summary: material.prompt_summary,
          originating_capability: material.originating_capability,
          qualification_boundary: material.qualification_boundary,
        };
        adds.material_specs.push(spec);
        adds.specs.push(spec);
      }
    }
  }
  adds.total = adds.blocks + adds.shapes + adds.materials;
  removes.total = removes.ids.length;
  removes.descriptors = removes.ids.flatMap((id) => {
    const item = items.get(id);
    return item ? [descriptor(item)] : [];
  });
  return {
    adds,
    updates,
    moves,
    spatial_moves: [],
    spatial_creates: [],
    semantic_relationships: [],
    removes,
    seeded_compositions,
    counts: {
      before: context.items.length,
      after: context.items.length + adds.total - removes.total,
      adds: adds.total,
      updates: updates.reduce((sum, update) => sum + update.ids.length, 0),
      moves: moves.reduce((sum, move) => sum + move.ids.length, 0),
      removes: removes.total,
    },
    warnings: [...warnings],
  };
}
export function validateProposal(input: unknown, context: ProposalContext, options: ProposalValidationOptions = {}): ProposalValidation {
  const errors: ProposalError[] = [];
  if (!isRecord(input)) return { ok: false, errors: [{ code: 'WRONG_TYPE', message: 'Proposal must be an object.' }] };
  if (!hasOnlyKeys(input, ['base_revision', 'summary', 'rationale', 'actions'])) addError(errors, 'UNKNOWN_FIELD', 'Proposal contains an unknown field.');
  if (typeof input.base_revision !== 'string' || input.base_revision.length === 0 || input.base_revision.length > 120) {
    addError(errors, 'INVALID_BASE_REVISION', 'base_revision must be a bounded non-empty string.', 'base_revision');
  }
  if (typeof input.summary !== 'string' || input.summary.length === 0 || input.summary.length > MAX_SUMMARY_LENGTH) {
    addError(errors, 'INVALID_SUMMARY', 'summary must be 1-' + MAX_SUMMARY_LENGTH + ' characters.', 'summary');
  }
  if (input.rationale !== undefined && (typeof input.rationale !== 'string' || input.rationale.length > MAX_RATIONALE_LENGTH)) {
    addError(errors, 'INVALID_RATIONALE', 'rationale must be at most ' + MAX_RATIONALE_LENGTH + ' characters.', 'rationale');
  }
  if (!Array.isArray(input.actions) || input.actions.length !== 1) {
    addError(errors, 'INVALID_ACTION_COUNT', 'actions must contain exactly one public action.', 'actions');
  }
  if (errors.length > 0) return { ok: false, errors };
  if (input.base_revision !== context.current_revision) {
    return { ok: false, errors: [{ code: 'STALE_STATE', message: 'Proposal base_revision does not match the current content revision.', path: 'base_revision' }] };
  }

  const raw = (input.actions as unknown[])[0];
  if (!isRecord(raw) || typeof raw.type !== 'string') {
    return { ok: false, errors: [{ code: 'INVALID_ACTION', message: 'The public action needs a known type.', path: 'actions[0]' }] };
  }
  if (isRetiredActionType(raw.type)) {
    return {
      ok: false,
      errors: [{
        code: 'RETIRED_ACTION',
        message: 'The ' + raw.type + ' action is retired. Use canvas_ops, seeded_composition, or add_materials through the current Fogwood protocol.',
        path: 'actions[0].type',
      }],
    };
  }

  const normalizedActions: ProposalAction[] = [];
  if (raw.type === 'canvas_ops') {
    if (!hasOnlyKeys(raw, ['type', 'composition_id', 'ops'])) {
      addError(errors, 'UNKNOWN_FIELD', 'canvas_ops accepts only an optional composition_id and ops.', 'actions[0]');
    }
    const result = planCanvasOps(context.items, raw.ops, context.page_id, raw.composition_id);
    if (!result.ok) {
      return { ok: false, errors: result.errors.map((error) => ({ code: error.code, message: error.message, path: 'actions[0].' + error.path })) };
    }
    normalizedActions.push(result.plan.normalized_action);
  } else if (raw.type === 'seeded_composition') {
    const isNormalized = 'algorithm_version' in raw
      || 'source_revision' in raw
      || 'target_semantic_ids' in raw
      || 'lineage' in raw
      || 'ops' in raw;
    if (isNormalized && raw.source_scope !== 'selection' && raw.source_scope !== 'explicit') {
      return { ok: false, errors: [{ code: 'INVALID_SEEDED_PLAN', message: 'The normalized seeded composition has an invalid source scope.', path: 'actions[0].source_scope' }] };
    }
    const replaySelection = isNormalized && raw.source_scope === 'selection';
    const request = isNormalized
      ? {
          type: 'seeded_composition',
          scope: replaySelection
            ? { kind: 'selection' as const }
            : { kind: 'explicit' as const, semantic_ids: raw.target_semantic_ids },
          seed: raw.seed,
          wildness: raw.wildness,
        }
      : raw;
    const replayContext = replaySelection
      ? {
          ...context,
          selection_semantic_ids: raw.target_semantic_ids as readonly string[],
          selection_complete: true,
          selection_total: Array.isArray(raw.target_semantic_ids) ? raw.target_semantic_ids.length : 0,
        }
      : context;
    const seeded = planSeededComposition(replayContext, request);
    if (!seeded.ok) {
      return { ok: false, errors: seeded.errors.map((error) => ({ ...error, path: error.path ? 'actions[0].' + error.path : 'actions[0]' })) };
    }
    const normalized = seeded.plan.normalized_action;
    if (isNormalized) {
      const normalizedKeys = [
        'type', 'grammar', 'algorithm_version', 'prng', 'source_revision', 'source_scope', 'source_fingerprint',
        'seed', 'wildness', 'target_semantic_ids', 'layout', 'lineage', 'ops',
      ];
      if (!hasOnlyKeys(raw, normalizedKeys) || canonicalSerialize(raw) !== canonicalSerialize(normalized)) {
        return { ok: false, errors: [{ code: 'INVALID_SEEDED_PLAN', message: 'The normalized seeded composition no longer matches the exact current source state and algorithm version.', path: 'actions[0]' }] };
      }
    }
    const canvas = planCanvasOps(context.items, normalized.ops, context.page_id);
    if (!canvas.ok) {
      return { ok: false, errors: canvas.errors.map((error) => ({ code: error.code, message: error.message, path: 'actions[0].' + error.path })) };
    }
    normalizedActions.push(normalized);
  } else if (raw.type === 'add_materials') {
    if (!hasOnlyKeys(raw, ['type', 'coordinate_space', 'materials']) || (raw.coordinate_space !== undefined && raw.coordinate_space !== 'page')) {
      addError(errors, 'UNKNOWN_FIELD', 'add_materials accepts only page coordinates and materials.', 'actions[0]');
    }
    const rawMaterials = raw.materials;
    if (!Array.isArray(rawMaterials) || rawMaterials.length < 1 || rawMaterials.length > MAX_MATERIALS_PER_ACTION) {
      addError(errors, 'MATERIAL_COUNT_LIMIT', 'materials must contain 1-' + MAX_MATERIALS_PER_ACTION + ' items.', 'actions[0].materials');
    }
    const preparedFromOptions = options.preparedMaterials?.get(0);
    const candidateMaterials = preparedFromOptions
      ?? (Array.isArray(rawMaterials) && rawMaterials.every((material) => isPreparedMaterial(material)) ? rawMaterials as PreparedMaterial[] : undefined);
    if (!candidateMaterials || !Array.isArray(rawMaterials) || candidateMaterials.length !== rawMaterials.length) {
      addError(errors, 'DECODE_REQUIRED', 'Every material must be prepared and browser decode-qualified before staging.', 'actions[0].materials');
    } else {
      const semanticIds = new Set(context.items.flatMap((item) => item.semantic_id ? [item.semantic_id] : []));
      const normalizedMaterials: PreparedMaterial[] = [];
      for (const [materialIndex, material] of candidateMaterials.entries()) {
        if (!isPreparedMaterial(material) || !material.decode_qualified) {
          addError(errors, 'DECODE_REQUIRED', 'Every material must be prepared and browser decode-qualified before staging.', 'actions[0].materials[' + materialIndex + ']');
          continue;
        }
        if (semanticIds.has(material.semantic_id)) {
          addError(errors, 'DUPLICATE_SEMANTIC_ID', 'A semantic material id must be unique across the live page and this proposal.', 'actions[0].materials[' + materialIndex + '].semantic_id');
        }
        semanticIds.add(material.semantic_id);
        normalizedMaterials.push(material);
      }
      if (errors.length === 0) normalizedActions.push({ type: 'add_materials', coordinate_space: 'page', materials: normalizedMaterials });
    }
  } else {
    return { ok: false, errors: [{ code: 'UNKNOWN_ACTION', message: 'Unsupported action type: ' + raw.type + '.', path: 'actions[0].type' }] };
  }

  if (errors.length > 0) return { ok: false, errors };
  const proposal: ProposalV1 = {
    base_revision: input.base_revision as string,
    summary: input.summary as string,
    ...(input.rationale === undefined ? {} : { rationale: input.rationale as string }),
    actions: normalizedActions,
  };
  return { ok: true, proposal, diff: buildProposalDiff(normalizedActions, context) };
}

export function validateProposalAsync(
  input: unknown,
  context: ProposalContext,
  options: { decodeRaster?: MaterialDecoder } = {},
): Promise<ProposalValidation> {
  if (!isRecord(input) || !Array.isArray(input.actions) || !input.actions.some((action) => isRecord(action) && action.type === 'add_materials')) {
    return Promise.resolve(validateProposal(input, context));
  }
  // Reject stale and structurally over-broad proposals before touching any
  // potentially multi-megabyte transfer string or invoking a decoder.
  if (input.base_revision !== context.current_revision || input.actions.length < 1 || input.actions.length > MAX_ACTIONS) {
    return Promise.resolve(validateProposal(input, context));
  }
  let encodedAggregateBytes = 0;
  for (const action of input.actions) {
    if (!isRecord(action) || action.type !== 'add_materials' || !Array.isArray(action.materials)) continue;
    for (const candidate of action.materials.slice(0, MAX_MATERIALS_PER_ACTION + 1)) {
      if (!isRecord(candidate) || typeof candidate.base64 !== 'string') continue;
      const padding = candidate.base64.endsWith('==') ? 2 : candidate.base64.endsWith('=') ? 1 : 0;
      const estimated = candidate.base64.length % 4 === 0
        ? candidate.base64.length / 4 * 3 - padding
        : Math.ceil(candidate.base64.length / 4) * 3;
      encodedAggregateBytes += Math.max(0, estimated);
      if (encodedAggregateBytes > MAX_MATERIALS_AGGREGATE_BYTES) {
        return Promise.resolve({
          ok: false,
          errors: [{ code: 'MATERIAL_AGGREGATE_LIMIT', message: `Aggregate material bytes must be at most ${MAX_MATERIALS_AGGREGATE_BYTES}.`, path: 'actions' }],
        });
      }
    }
  }
  return (async () => {
    const preparedActions: unknown[] = [];
    const preparationErrors: ProposalError[] = [];
    for (const [index, action] of (input.actions as unknown[]).entries()) {
      if (!isRecord(action) || action.type !== 'add_materials') {
        preparedActions.push(action);
        continue;
      }
      const batch = await prepareMaterials(action.materials, { decodeRaster: options.decodeRaster });
      if (!batch.ok) {
        preparationErrors.push(...batch.errors.map((entry) => ({ code: entry.code, message: entry.message, ...(entry.path ? { path: `actions[${index}].${entry.path}` } : { path: `actions[${index}].materials` }) })));
        preparedActions.push(action);
      } else {
        preparedActions.push({ ...action, coordinate_space: 'page', materials: batch.materials });
      }
    }
    if (preparationErrors.length > 0) return { ok: false, errors: preparationErrors };
    return validateProposal({ ...input, actions: preparedActions }, context);
  })();
}

export type ProposalControllerState = {
  proposal: ProposalV1;
  diff: ProposalDiff;
  plan: PreparedCanvasPlan;
  status: 'pending' | 'stale' | 'error';
  message?: string;
};

export type ProposalControllerResult = {
  status: 'STAGED' | 'APPLIED' | 'REJECTED' | 'STALE_STATE' | 'NO_PENDING' | 'ERROR';
  state?: ProposalControllerState;
  message?: string;
};
