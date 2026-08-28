/**
 * Pure, browser-safe seams for Fogwood Agent Runtime v0.1.
 *
 * This module deliberately has no tldraw or DOM dependency. It is the contract
 * shared by the page adapter, WebMCP tools, and node-testable verification.
 */

// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
import { applyInstrumentInputChanges } from './fogwood-instrument-adapter.ts';
import type { InstrumentInputChange, InstrumentShapeLike } from './fogwood-instrument-adapter.ts';
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
import { BAZAAR_CATALOG } from './fogwood-bazaar.ts';
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
import { isPreparedMaterial, prepareMaterials, MATERIAL_LIMITS, MATERIAL_TEXT_LIMITS } from './fogwood-materials.ts';
import type { MaterialInput, MaterialDecoder, PreparedMaterial } from './fogwood-materials.ts';
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
import { isStableSemanticId, planRelationships, planSpatialMoves, relationshipSemanticId, SPATIAL_LIMITS, SPATIAL_MOVE_KINDS, SEMANTIC_RELATIONSHIP_KINDS } from './fogwood-spatial.ts';
import type { AddRelationshipsAction, SemanticRelationship, SpatialMoveAction, SpatialMoveInput, SpatialPlan } from './fogwood-spatial.ts';
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
import { COMPOSITION_FORMAT, compositionQualification, expandCompositionRecipe, isCompositionRecipe, validateCompositionRecipe } from './fogwood-composition.ts';
import type { CompositionRecipe } from './fogwood-composition.ts';

export const FOGWOOD_PROTOCOL = 'fogwood-agent-runtime';
export const FOGWOOD_PROTOCOL_VERSION = '2';
export const FOGWOOD_REGISTRY_VERSION = '7';
export const FOGWOOD_PROPOSAL_VERSION = '1';
export const FOGWOOD_CONTEXT_VERSION = 'fogwood.context.v1' as const;
export const FOGWOOD_CONTEXT_SELECTION_LIMIT = 5_000 as const;
export const FOGWOOD_CONTEXT_SELECTION_PREVIEW_LIMIT = 128 as const;
export { COMPOSITION_FORMAT, compositionQualification, expandCompositionRecipe, isCompositionRecipe, validateCompositionRecipe };
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

export const MAX_ACTIONS = 32;
export const MAX_BLOCKS_PER_ACTION = 48;
export const MAX_SHAPES_PER_ACTION = 64;
export const MAX_ITEMS_PER_ACTION = 100;
export const MAX_AGGREGATE_ADDS = 96;
export const MAX_MATERIALS_PER_ACTION = MATERIAL_LIMITS.max_materials_per_action;
export const MAX_MATERIALS_AGGREGATE_BYTES = MATERIAL_LIMITS.max_aggregate_bytes;
export const MAX_SUMMARY_LENGTH = 180;
export const MAX_RATIONALE_LENGTH = 500;

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
  /** Page adapters may supply exact raw shape props so stage and Apply validate identical instrument bytes. */
  instrument_shapes?: readonly InstrumentShapeLike[];
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

function numberWithWarning(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
  path: string,
  warnings: string[],
) {
  if (!isFiniteNumber(value)) return fallback;
  const normalized = clamp(value, min, max);
  if (normalized !== value) warnings.push(`${path} normalized to ${normalized}.`);
  return normalized;
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
  /** Optional stable semantic composition metadata. */
  semantic_id?: string;
  role?: string;
  composition_id?: string;
  region_id?: string;
  variant_id?: string;
  parent_variant_id?: string;
  lineage_source_id?: string;
};

type RecipeOperation =
  | { type: 'add_blocks'; coordinate_space: 'page'; blocks: readonly BlockInput[] }
  | { type: 'add_shapes'; coordinate_space: 'page'; shapes: readonly CanvasShapeInput[] };

export type RecipeDefinition = {
  id: string;
  version: 1;
  title: string;
  purpose: string;
  status: 'immutable';
  bounds: { x: 0; y: 0; w: number; h: number };
  semantic: string;
  provenance: { source: 'fogwood'; recipe_id: string; recipe_version: 1 };
  expected_count: number;
  /** Host-owned behavior selected by recipe id; never supplied by proposals. */
  instrument?: { kind: 'compare-and-decide'; version: 1 };
  operations: readonly RecipeOperation[];
};

const researchRecipe: RecipeDefinition = {
  id: 'evidence-research-map',
  version: 1,
  title: 'Evidence research map',
  purpose: 'Organize sources, claims, open questions, and a compact evidence ledger.',
  status: 'immutable',
  bounds: { x: 0, y: 0, w: 1240, h: 760 },
  semantic: 'sources-claims-open-questions-evidence-ledger',
  provenance: { source: 'fogwood', recipe_id: 'evidence-research-map', recipe_version: 1 },
  expected_count: 9,
  operations: [
    {
      type: 'add_blocks',
      coordinate_space: 'page',
      blocks: [
        {
          kind: 'heading',
          tone: 'paper',
          x: 0,
          y: 0,
          w: 1160,
          h: 120,
          value: 'Research workspace',
          title: 'Evidence research map',
          body: 'Keep sources, claims, and uncertainty visible together.',
        },
        {
          kind: 'panel',
          tone: 'blue',
          x: 0,
          y: 150,
          w: 360,
          h: 190,
          value: 'Sources',
          title: 'What are we reading?',
          body: 'Capture source names, dates, and the exact passage that matters.',
        },
        {
          kind: 'panel',
          tone: 'green',
          x: 390,
          y: 150,
          w: 360,
          h: 190,
          value: 'Claims',
          title: 'What do we believe?',
          body: 'Write claims narrowly enough that a source can support or weaken them.',
        },
        {
          kind: 'panel',
          tone: 'yellow',
          x: 780,
          y: 150,
          w: 360,
          h: 190,
          value: 'Open questions',
          title: 'What remains unresolved?',
          body: 'Name the missing evidence and the next question worth asking.',
        },
        {
          kind: 'checklist',
          tone: 'paper',
          x: 0,
          y: 375,
          w: 410,
          h: 300,
          title: 'Evidence ledger',
          body: 'Review each claim before treating it as decision-ready.',
          items: [
            { label: 'Source provenance captured', checked: true },
            { label: 'Claim wording is specific' },
            { label: 'Counterevidence recorded' },
            { label: 'Open question has an owner' },
          ],
        },
        {
          kind: 'table',
          tone: 'paper',
          x: 445,
          y: 375,
          w: 695,
          h: 300,
          title: 'Claim ledger',
          columns: ['Claim', 'Source', 'Confidence'],
          rows: [
            ['Write the smallest defensible claim', 'Source A', 'Open'],
            ['Record what would change our mind', 'Source B', 'Review'],
            ['Separate observation from inference', 'Source C', 'Open'],
          ],
        },
      ],
    },
    {
      type: 'add_shapes',
      coordinate_space: 'page',
      shapes: [
        { kind: 'arrow', x: 360, y: 245, end_x: 390, end_y: 245, text: 'sources -> claims' },
        { kind: 'arrow', x: 570, y: 340, end_x: 570, end_y: 375, text: 'claims -> ledger' },
        { kind: 'arrow', x: 410, y: 525, end_x: 780, end_y: 245, text: 'ledger -> open questions' },
      ],
    },
  ],
};

const meetingRecipe: RecipeDefinition = {
  id: 'meeting-to-plan-wall',
  version: 1,
  title: 'Meeting to plan wall',
  purpose: 'Turn meeting notes into decisions, risks, actions, and clear owners.',
  status: 'immutable',
  bounds: { x: 0, y: 0, w: 1240, h: 790 },
  semantic: 'meeting-notes-decisions-risks-actions-owners',
  provenance: { source: 'fogwood', recipe_id: 'meeting-to-plan-wall', recipe_version: 1 },
  expected_count: 9,
  operations: [
    {
      type: 'add_blocks',
      coordinate_space: 'page',
      blocks: [
        {
          kind: 'heading',
          tone: 'paper',
          x: 0,
          y: 0,
          w: 1160,
          h: 120,
          value: 'Meeting workspace',
          title: 'Meeting to plan wall',
          body: 'Move from what was said to what happens next.',
        },
        {
          kind: 'text',
          tone: 'blue',
          x: 0,
          y: 150,
          w: 360,
          h: 230,
          title: 'Notes',
          body: 'Capture the useful context, the disagreement, and the decision boundary.',
        },
        {
          kind: 'panel',
          tone: 'green',
          x: 390,
          y: 150,
          w: 360,
          h: 230,
          value: 'Decision',
          title: 'What did we decide?',
          body: 'State the decision and what remains deliberately undecided.',
        },
        {
          kind: 'panel',
          tone: 'yellow',
          x: 780,
          y: 150,
          w: 360,
          h: 230,
          value: 'Risks',
          title: 'What could derail it?',
          body: 'Name risks early enough that someone can respond to them.',
        },
        {
          kind: 'checklist',
          tone: 'paper',
          x: 0,
          y: 415,
          w: 500,
          h: 300,
          title: 'Actions and owners',
          body: 'Every action has one clear next move.',
          items: [
            { label: 'Draft the decision brief — owner to assign' },
            { label: 'Confirm the next review date — owner to assign' },
            { label: 'Write the risk response — owner to assign' },
          ],
        },
        {
          kind: 'table',
          tone: 'paper',
          x: 535,
          y: 415,
          w: 605,
          h: 300,
          title: 'Plan ledger',
          columns: ['Action', 'Owner', 'Due'],
          rows: [
            ['Decision brief', 'Unassigned', 'Next review'],
            ['Risk response', 'Unassigned', 'Before launch'],
            ['Stakeholder note', 'Unassigned', 'This week'],
          ],
        },
      ],
    },
    {
      type: 'add_shapes',
      coordinate_space: 'page',
      shapes: [
        { kind: 'arrow', x: 180, y: 380, end_x: 180, end_y: 415, text: 'notes -> actions' },
        { kind: 'arrow', x: 570, y: 380, end_x: 570, end_y: 415, text: 'decisions -> plan' },
        { kind: 'arrow', x: 960, y: 380, end_x: 960, end_y: 415, text: 'risks -> plan' },
      ],
    },
  ],
};

const architectureRecipe: RecipeDefinition = {
  id: 'static-architecture-map',
  version: 1,
  title: 'Static architecture map',
  purpose: 'Explain the Fogwood people-agent-page-local-store boundary without external effects.',
  status: 'immutable',
  bounds: { x: 0, y: 0, w: 1320, h: 760 },
  semantic: 'people-agent-page-local-store-apply-reject-boundary',
  provenance: { source: 'fogwood', recipe_id: 'static-architecture-map', recipe_version: 1 },
  expected_count: 11,
  operations: [
    {
      type: 'add_blocks',
      coordinate_space: 'page',
      blocks: [
        {
          kind: 'heading',
          tone: 'paper',
          x: 0,
          y: 0,
          w: 1240,
          h: 120,
          value: 'Fogwood architecture',
          title: 'People + agent, one page-local store',
          body: 'The page owns state and the person owns the Apply or Reject decision.',
        },
        {
          kind: 'panel',
          tone: 'blue',
          x: 0,
          y: 175,
          w: 300,
          h: 210,
          value: 'Person',
          title: 'Human authority',
          body: 'Inspect the proposal, then choose Apply or Reject.',
        },
        {
          kind: 'panel',
          tone: 'green',
          x: 360,
          y: 175,
          w: 300,
          h: 210,
          value: 'Agent',
          title: 'Bounded proposer',
          body: 'Search capabilities and stage a typed proposal with a base revision.',
        },
        {
          kind: 'panel',
          tone: 'yellow',
          x: 720,
          y: 175,
          w: 300,
          h: 210,
          value: 'Page',
          title: 'Fogwood page',
          body: 'Checks the revision, shows the diff, and applies one transaction.',
        },
        {
          kind: 'panel',
          tone: 'paper',
          x: 1080,
          y: 175,
          w: 240,
          h: 210,
          value: 'Store',
          title: 'Local only',
          body: 'The device-local tldraw store persists the editable artifact.',
        },
      ],
    },
    {
      type: 'add_shapes',
      coordinate_space: 'page',
      shapes: [
        { kind: 'arrow', x: 300, y: 280, end_x: 360, end_y: 280, text: 'request' },
        { kind: 'arrow', x: 660, y: 280, end_x: 720, end_y: 280, text: 'proposal' },
        { kind: 'arrow', x: 1020, y: 280, end_x: 1080, end_y: 280, text: 'persist / load' },
        { kind: 'note', x: 0, y: 480, w: 360, h: 180, text: 'No code execution, network fetch, raw store writes, or automatic Apply.' },
        { kind: 'note', x: 400, y: 480, w: 400, h: 180, text: 'Apply agent proposal is a single undoable transaction labelled Apply agent proposal.' },
        { kind: 'note', x: 840, y: 480, w: 480, h: 180, text: 'Page-owned Apply and Reject keep the human in control. Reject changes no canvas content.' },
      ],
    },
  ],
};

const compareRecipe: RecipeDefinition = {
  id: 'compare-and-decide',
  version: 1,
  title: 'Compare & Decide',
  purpose: 'Compare Alpha and Beta with visible criteria, bounded weights, and a reviewable scorecard.',
  status: 'immutable',
  bounds: { x: 0, y: 0, w: 1240, h: 820 },
  semantic: 'alternatives-criteria-tradeoffs-scorecard-review',
  provenance: { source: 'fogwood', recipe_id: 'compare-and-decide', recipe_version: 1 },
  expected_count: 12,
  instrument: { kind: 'compare-and-decide', version: 1 },
  operations: [
    {
      type: 'add_blocks',
      coordinate_space: 'page',
      blocks: [
        {
          kind: 'heading',
          tone: 'paper',
          x: 0,
          y: 0,
          w: 1160,
          h: 120,
          value: 'Decision workspace',
          title: 'Compare & Decide',
          body: 'Compare Alpha and Beta across cost and impact. Scores are bounded aids, not conclusions.',
        },
        {
          kind: 'panel',
          tone: 'blue',
          x: 0,
          y: 150,
          w: 350,
          h: 190,
          value: 'Criteria',
          title: 'Make the tradeoffs explicit',
          body: 'Cost and impact weights share one bounded scale. Record what would change your mind before deciding.',
        },
        {
          kind: 'slider',
          tone: 'green',
          x: 390,
          y: 150,
          w: 260,
          h: 150,
          title: 'Cost weight',
          body: 'Bounded weight used for both options.',
          value: 0.4,
          min: 0,
          max: 1,
          step: 0.1,
        },
        {
          kind: 'slider',
          tone: 'green',
          x: 680,
          y: 150,
          w: 260,
          h: 150,
          title: 'Impact weight',
          body: 'Bounded weight used for both options.',
          value: 0.6,
          min: 0,
          max: 1,
          step: 0.1,
        },
        {
          kind: 'slider',
          tone: 'paper',
          x: 0,
          y: 380,
          w: 280,
          h: 150,
          title: 'Alpha cost score',
          body: 'Local bounded input from 0 to 100.',
          value: 95,
          min: 0,
          max: 100,
          step: 1,
        },
        {
          kind: 'slider',
          tone: 'paper',
          x: 300,
          y: 380,
          w: 280,
          h: 150,
          title: 'Alpha impact score',
          body: 'Local bounded input from 0 to 100.',
          value: 60,
          min: 0,
          max: 100,
          step: 1,
        },
        {
          kind: 'slider',
          tone: 'paper',
          x: 600,
          y: 380,
          w: 280,
          h: 150,
          title: 'Beta cost score',
          body: 'Local bounded input from 0 to 100.',
          value: 75,
          min: 0,
          max: 100,
          step: 1,
        },
        {
          kind: 'slider',
          tone: 'paper',
          x: 900,
          y: 380,
          w: 280,
          h: 150,
          title: 'Beta impact score',
          body: 'Local bounded input from 0 to 100.',
          value: 80,
          min: 0,
          max: 100,
          step: 1,
        },
        {
          kind: 'metric',
          tone: 'accent',
          x: 0,
          y: 600,
          w: 280,
          h: 160,
          title: 'Alpha weighted score',
          body: 'Deterministic derived aid.',
          value: '74.00',
        },
        {
          kind: 'metric',
          tone: 'accent',
          x: 300,
          y: 600,
          w: 280,
          h: 160,
          title: 'Beta weighted score',
          body: 'Deterministic derived aid.',
          value: '78.00',
        },
        {
          kind: 'metric',
          tone: 'yellow',
          x: 600,
          y: 600,
          w: 280,
          h: 160,
          title: 'Recommendation',
          body: 'Review the inputs before deciding.',
          value: 'Beta',
        },
        {
          kind: 'chart',
          tone: 'paper',
          x: 900,
          y: 600,
          w: 280,
          h: 180,
          title: 'Weighted scores',
          body: 'Alpha vs Beta, recomputed locally.',
          series: [{ label: 'Alpha', value: 74 }, { label: 'Beta', value: 78 }],
        },
      ],
    },
  ],
};

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object') return value;
  Object.freeze(value);
  for (const child of Object.values(value as object)) deepFreeze(child);
  return value;
}

/**
 * v2 recipes are immutable catalog data. Runtime availability is derived from
 * the generated local catalog and then narrowed through the same pure schema
 * validator used by proposal insertion; package data never contributes code.
 */
function compositionRecipesFromCatalog(): CompositionRecipe[] {
  const packages = (BAZAAR_CATALOG as unknown as { packages?: readonly { sections?: { recipes?: readonly { content?: unknown }[] } }[] }).packages ?? [];
  const recipes: CompositionRecipe[] = [];
  for (const entry of packages) {
    for (const candidate of entry.sections?.recipes ?? []) {
      const value = candidate.content;
      if (isCompositionRecipe(value)) recipes.push(value);
    }
  }
  return recipes.sort((left, right) => left.id.localeCompare(right.id));
}

export const COMPOSITION_REGISTRY: readonly CompositionRecipe[] = deepFreeze(compositionRecipesFromCatalog());

export const RECIPE_REGISTRY: readonly RecipeDefinition[] = deepFreeze([
  researchRecipe,
  meetingRecipe,
  architectureRecipe,
  compareRecipe,
]);

export type RecipeId = (typeof RECIPE_REGISTRY)[number]['id'];

export type AnyRecipeDefinition = RecipeDefinition | CompositionRecipe;
export type CompositionRecipeId = CompositionRecipe['id'];

export function getRecipe(recipeId: string, version: number): AnyRecipeDefinition | undefined {
  if (version === 2) return COMPOSITION_REGISTRY.find((recipe) => recipe.id === recipeId && recipe.version === version);
  return RECIPE_REGISTRY.find((recipe) => recipe.id === recipeId && recipe.version === version);
}

export function expandRecipe(recipe: AnyRecipeDefinition, anchor?: { x?: number; y?: number }) {
  if (recipe.version === 2) return expandCompositionRecipe(recipe, anchor);
  const offsetX = isFiniteNumber(anchor?.x) ? clamp(anchor.x, -100_000, 100_000) : 0;
  const offsetY = isFiniteNumber(anchor?.y) ? clamp(anchor.y, -100_000, 100_000) : 0;
  return recipe.operations.map((operation) => {
    if (operation.type === 'add_blocks') {
      return {
        ...operation,
        blocks: operation.blocks.map((block) => ({
          ...block,
          ...(isFiniteNumber(block.x) ? { x: block.x + offsetX } : {}),
          ...(isFiniteNumber(block.y) ? { y: block.y + offsetY } : {}),
        })),
      };
    }
    return {
      ...operation,
      shapes: operation.shapes.map((shape) => ({
        ...shape,
        ...(isFiniteNumber(shape.x) ? { x: shape.x + offsetX } : {}),
        ...(isFiniteNumber(shape.y) ? { y: shape.y + offsetY } : {}),
        ...(isFiniteNumber(shape.end_x) ? { end_x: shape.end_x + offsetX } : {}),
        ...(isFiniteNumber(shape.end_y) ? { end_y: shape.end_y + offsetY } : {}),
      })),
    };
  });
}

type CapabilitySchema = JsonRecord;

export type Capability = {
  id: string;
  kind: 'tool' | 'action' | 'primitive' | 'capability' | 'recipe' | 'example';
  version: number;
  title: string;
  summary: string;
  use_when: string;
  keywords: readonly string[];
  effect: 'read-only' | 'stage-only' | 'page-apply';
  input_schema?: CapabilitySchema;
  recipe?: AnyRecipeDefinition;
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

const blockItemSchema: CapabilitySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    kind: { type: 'string', enum: [...BLOCK_KINDS] },
    tone: { type: 'string', enum: [...BLOCK_TONES] },
    x: { type: 'number', minimum: -100000, maximum: 100000 },
    y: { type: 'number', minimum: -100000, maximum: 100000 },
    w: { type: 'number', minimum: 120, maximum: 1400 },
    h: { type: 'number', minimum: 56, maximum: 1000 },
    title: { type: 'string', maxLength: 180 },
    body: { type: 'string', maxLength: 2000 },
    value: { oneOf: [{ type: 'string', maxLength: 500 }, { type: 'number', minimum: -1000000000, maximum: 1000000000 }] },
    items: {
      type: 'array',
      maxItems: 20,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          label: { type: 'string', minLength: 1, maxLength: 240 },
          checked: { type: 'boolean' },
        },
        required: ['label'],
      },
    },
    columns: { type: 'array', maxItems: 8, items: { type: 'string', maxLength: 160 } },
    rows: {
      type: 'array',
      maxItems: 12,
      items: { type: 'array', maxItems: 8, items: { type: 'string', maxLength: 160 } },
    },
    options: { type: 'array', maxItems: 20, items: { type: 'string', maxLength: 160 } },
    series: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          label: { type: 'string', minLength: 1, maxLength: 80 },
          value: { type: 'number', minimum: -1000000000, maximum: 1000000000 },
        },
        required: ['label', 'value'],
      },
    },
    min: { type: 'number', minimum: -1000000, maximum: 1000000 },
    max: { type: 'number', minimum: -1000000, maximum: 1000000 },
    step: { type: 'number', exclusiveMinimum: 0, maximum: 100000 },
  },
  required: ['kind'],
};

const shapeItemSchema: CapabilitySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    kind: { type: 'string', enum: [...CANVAS_SHAPE_KINDS] },
    x: { type: 'number', minimum: -100000, maximum: 100000 },
    y: { type: 'number', minimum: -100000, maximum: 100000 },
    end_x: { type: 'number', minimum: -100000, maximum: 100000 },
    end_y: { type: 'number', minimum: -100000, maximum: 100000 },
    w: { type: 'number', minimum: 40, maximum: 2000 },
    h: { type: 'number', minimum: 40, maximum: 1600 },
    text: { type: 'string', maxLength: 2000 },
    color: { type: 'string', enum: [...CANVAS_COLORS] },
    fill: { type: 'string', enum: [...CANVAS_FILLS] },
    semantic_id: { type: 'string', minLength: 1, maxLength: 180, pattern: '^[A-Za-z0-9][A-Za-z0-9:._/-]{0,179}$' },
    role: { type: 'string', maxLength: 120 },
    composition_id: { type: 'string', maxLength: 180 },
    region_id: { type: 'string', maxLength: 180 },
    variant_id: { type: 'string', maxLength: 180 },
    parent_variant_id: { type: 'string', maxLength: 180 },
    lineage_source_id: { type: 'string', maxLength: 180 },
  },
  required: ['kind'],
};

const materialItemSchema: CapabilitySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    semantic_id: { type: 'string', minLength: 1, maxLength: MATERIAL_TEXT_LIMITS.semantic_id },
    mime_type: { type: 'string', enum: ['image/png', 'image/jpeg', 'image/svg+xml'] },
    base64: { type: 'string', minLength: 4, maxLength: Math.ceil(MATERIAL_LIMITS.max_raster_bytes / 3) * 4 },
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
};

const semanticScopeSchema: CapabilitySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    kind: { type: 'string', enum: ['selection', 'explicit', 'region'] },
    semantic_ids: { type: 'array', minItems: 1, maxItems: SPATIAL_LIMITS.max_targets_per_move, items: { type: 'string', minLength: 1, maxLength: 180 } },
    region_id: { type: 'string', minLength: 1, maxLength: 180 },
  },
  required: ['kind'],
};

const spatialMoveSchema: CapabilitySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    kind: { type: 'string', enum: [...SPATIAL_MOVE_KINDS] },
    move: { type: 'string', enum: [...SPATIAL_MOVE_KINDS] },
    scope: semanticScopeSchema,
    target: { oneOf: [semanticScopeSchema, { type: 'array', minItems: 1, maxItems: SPATIAL_LIMITS.max_targets_per_move, items: { type: 'string', minLength: 1, maxLength: 180 } }, { type: 'object', additionalProperties: false, properties: { kind: { type: 'string', enum: ['selection', 'explicit', 'region'] }, scope: { type: 'string', enum: ['selection', 'explicit', 'region'] }, semantic_ids: { type: 'array', minItems: 1, maxItems: SPATIAL_LIMITS.max_targets_per_move, items: { type: 'string', minLength: 1, maxLength: 180 } }, ids: { type: 'array', minItems: 1, maxItems: SPATIAL_LIMITS.max_targets_per_move, items: { type: 'string', minLength: 1, maxLength: 180 } }, region_id: { type: 'string', minLength: 1, maxLength: 180 } } }] },
    targets: { oneOf: [{ type: 'array', minItems: 1, maxItems: SPATIAL_LIMITS.max_targets_per_move, items: { type: 'string', minLength: 1, maxLength: 180 } }, { type: 'object', additionalProperties: false, properties: { kind: { type: 'string', enum: ['selection', 'explicit', 'region'] }, scope: { type: 'string', enum: ['selection', 'explicit', 'region'] }, semantic_ids: { type: 'array', minItems: 1, maxItems: SPATIAL_LIMITS.max_targets_per_move, items: { type: 'string', minLength: 1, maxLength: 180 } }, ids: { type: 'array', minItems: 1, maxItems: SPATIAL_LIMITS.max_targets_per_move, items: { type: 'string', minLength: 1, maxLength: 180 } }, region_id: { type: 'string', minLength: 1, maxLength: 180 } } }] },
    target_semantic_ids: { type: 'array', minItems: 1, maxItems: SPATIAL_LIMITS.max_targets_per_move, items: { type: 'string', minLength: 1, maxLength: 180 } },
    region: {
      type: 'object', additionalProperties: false,
      properties: { x: { type: 'number', minimum: -100000, maximum: 100000 }, y: { type: 'number', minimum: -100000, maximum: 100000 }, w: { type: 'number', exclusiveMinimum: 0, maximum: 100000 }, h: { type: 'number', exclusiveMinimum: 0, maximum: 100000 } },
      required: ['x', 'y', 'w', 'h'],
    },
    seed: { oneOf: [{ type: 'string', maxLength: 180 }, { type: 'number' }] },
    spacing: { type: 'number', minimum: 0, maximum: 10000 },
    anchor: { oneOf: [{ type: 'string', minLength: 1, maxLength: 180 }, { type: 'object', additionalProperties: false, properties: { x: { type: 'number', minimum: -100000, maximum: 100000 }, y: { type: 'number', minimum: -100000, maximum: 100000 } }, required: ['x', 'y'] }] },
    center: { oneOf: [{ type: 'string', minLength: 1, maxLength: 180 }, { type: 'object', additionalProperties: false, properties: { x: { type: 'number', minimum: -100000, maximum: 100000 }, y: { type: 'number', minimum: -100000, maximum: 100000 } }, required: ['x', 'y'] }] },
    radius: { type: 'number', exclusiveMinimum: 0, maximum: 100000 },
    links: { type: 'array', minItems: 1, maxItems: 256, items: { type: 'object', additionalProperties: false, properties: { parent_semantic_id: { type: 'string', minLength: 1, maxLength: 180 }, child_semantic_id: { type: 'string', minLength: 1, maxLength: 180 } }, required: ['parent_semantic_id', 'child_semantic_id'] } },
    parent_child_links: { type: 'array', minItems: 1, maxItems: 256, items: { type: 'object', additionalProperties: false, properties: { parent_semantic_id: { type: 'string', minLength: 1, maxLength: 180 }, child_semantic_id: { type: 'string', minLength: 1, maxLength: 180 } }, required: ['parent_semantic_id', 'child_semantic_id'] } },
    columns: { type: 'integer', minimum: 1, maximum: 32 },
    gap_x: { type: 'number', minimum: 0, maximum: 10000 },
    gap_y: { type: 'number', minimum: 0, maximum: 10000 },
    path: { type: 'array', minItems: 2, maxItems: SPATIAL_LIMITS.max_path_points, items: { type: 'object', additionalProperties: false, properties: { x: { type: 'number', minimum: -100000, maximum: 100000 }, y: { type: 'number', minimum: -100000, maximum: 100000 } }, required: ['x', 'y'] } },
    text: { type: 'string', minLength: 1, maxLength: SPATIAL_LIMITS.max_text },
    offset: { type: 'object', additionalProperties: false, properties: { x: { type: 'number', minimum: -100000, maximum: 100000 }, y: { type: 'number', minimum: -100000, maximum: 100000 } }, required: ['x', 'y'] },
    patches: { type: 'object', additionalProperties: false, properties: { text: { type: 'string', maxLength: SPATIAL_LIMITS.max_text }, color: { type: 'string', maxLength: 40 }, fill: { type: 'string', maxLength: 40 } } },
  },
  required: ['kind'],
};

const relationshipItemSchema: CapabilitySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string', minLength: 1, maxLength: 180, pattern: '^[A-Za-z0-9][A-Za-z0-9:._/-]{0,179}$' },
    kind: { type: 'string', enum: [...SEMANTIC_RELATIONSHIP_KINDS] },
    source_semantic_id: { type: 'string', minLength: 1, maxLength: 180 },
    target_semantic_id: { type: 'string', minLength: 1, maxLength: 180 },
    label: { type: 'string', maxLength: SPATIAL_LIMITS.max_label },
  },
  required: ['id', 'kind', 'source_semantic_id', 'target_semantic_id'],
};

const actionArrayField = (field: string) => field === 'add_blocks'
  ? 'blocks'
  : field === 'add_shapes'
    ? 'shapes'
    : field === 'add_materials'
      ? 'materials'
      : field === 'update_blocks'
        ? 'updates'
        : field === 'place_items'
          ? 'placements'
          : field === 'apply_spatial_moves'
            ? 'moves'
            : field === 'add_relationships'
              ? 'relationships'
              : 'placements';

const actionSchema = (field: string, maxItems: number, itemSchema: CapabilitySchema): CapabilitySchema => ({
  type: 'object',
  additionalProperties: false,
  properties: {
    type: { const: field },
    ...(field === 'add_blocks' || field === 'add_shapes' || field === 'add_materials' ? { coordinate_space: { const: 'page' } } : {}),
    [actionArrayField(field)]:
      { type: 'array', minItems: 1, maxItems, items: itemSchema },
  },
  required: ['type', actionArrayField(field)],
});

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
  add_blocks: actionSchema('add_blocks', MAX_BLOCKS_PER_ACTION, blockItemSchema),
  add_shapes: actionSchema('add_shapes', MAX_SHAPES_PER_ACTION, shapeItemSchema),
  apply_spatial_moves: actionSchema('apply_spatial_moves', SPATIAL_LIMITS.max_moves_per_action, spatialMoveSchema),
  add_relationships: actionSchema('add_relationships', SPATIAL_LIMITS.max_relationships, relationshipItemSchema),
  add_materials: actionSchema('add_materials', MAX_MATERIALS_PER_ACTION, materialItemSchema),
  update_blocks: actionSchema('update_blocks', MAX_BLOCKS_PER_ACTION, {
    ...blockItemSchema,
    properties: { ...(blockItemSchema.properties as JsonRecord), id: { type: 'string', minLength: 1, maxLength: 180 } },
    required: ['id'],
  }),
  place_items: actionSchema('place_items', MAX_ITEMS_PER_ACTION, {
    type: 'object',
    additionalProperties: false,
    properties: {
      id: { type: 'string', minLength: 1, maxLength: 180 },
      x: { type: 'number', minimum: -100000, maximum: 100000 },
      y: { type: 'number', minimum: -100000, maximum: 100000 },
      rotation: { type: 'number', minimum: -Math.PI * 4, maximum: Math.PI * 4 },
    },
    required: ['id', 'x', 'y'],
  }),
  remove_items: {
    type: 'object',
    additionalProperties: false,
    properties: {
      type: { const: 'remove_items' },
      ids: { type: 'array', minItems: 1, maxItems: MAX_ITEMS_PER_ACTION, items: { type: 'string', minLength: 1, maxLength: 180 } },
    },
    required: ['type', 'ids'],
  },
  clear_surface: {
    type: 'object',
    additionalProperties: false,
    properties: { type: { const: 'clear_surface' }, confirmation: { const: CLEAR_SURFACE_PHRASE } },
    required: ['type', 'confirmation'],
  },
  insert_recipe: {
    type: 'object',
    additionalProperties: false,
    properties: {
      type: { const: 'insert_recipe' },
      recipe_id: { type: 'string', minLength: 1, maxLength: 120 },
      version: { oneOf: [{ const: 1 }, { const: 2 }] },
      anchor: {
        type: 'object',
        additionalProperties: false,
        properties: {
          x: { type: 'number', minimum: -100000, maximum: 100000 },
          y: { type: 'number', minimum: -100000, maximum: 100000 },
        },
      },
    },
    required: ['type', 'recipe_id', 'version'],
  },
  set_instrument_inputs: {
    type: 'object',
    additionalProperties: false,
    properties: {
      type: { const: 'set_instrument_inputs' },
      changes: {
        type: 'array',
        minItems: 1,
        maxItems: 12,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string', minLength: 1, maxLength: 180 },
            value: { type: 'number' },
          },
          required: ['id', 'value'],
        },
      },
    },
    required: ['type', 'changes'],
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
      description: 'One public action per staged proposal. canvas_ops composes up to 24 native editor operations; seeded_composition creates bounded reproducible preserved variants.',
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
    summary: 'Mix bounded native-shape creation, drawing, bound connectors, preserved variants, updates, arrangement, structure, z-order changes, and leaf deletion in one reviewed proposal.',
    use_when: 'Codex needs to turn a request into native editable canvas matter or reshape exact existing tldraw objects without replacing the page.',
    keywords: ['canvas protocol', 'create', 'draw', 'connect', 'binding', 'variant', 'lineage', 'update', 'resize', 'align', 'distribute', 'stack', 'pack', 'group', 'ungroup', 'reorder', 'z-order', 'delete', 'mix', 'compose'],
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
    summary: 'Create one editable arrow with native tldraw start and end bindings so it follows either endpoint.',
    use_when: 'Exactly two current or earlier-created targets should stay visually connected after movement.',
    keywords: ['connect', 'bound connector', 'arrow binding', 'endpoint', 'follow'],
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
    id: 'add_blocks',
    kind: 'action',
    version: 1,
    title: 'Add interface blocks',
    summary: 'Add bounded Fogwood interface blocks.',
    use_when: 'The proposal needs editable controls, metrics, tables, or text panels.',
    keywords: ['block', 'interface', 'panel', 'table', 'control'],
    effect: 'page-apply',
    input_schema: exactActionSchemas.add_blocks,
  },
  {
    id: 'add_shapes',
    kind: 'action',
    version: 1,
    title: 'Add native shapes',
    summary: 'Add bounded native tldraw geometry, text, notes, frames, or arrows.',
    use_when: 'The proposal needs a spatial diagram or native canvas mark.',
    keywords: ['shape', 'diagram', 'arrow', 'note', 'frame'],
    effect: 'page-apply',
    input_schema: exactActionSchemas.add_shapes,
  },
  {
    id: 'apply_spatial_moves',
    kind: 'action',
    version: 1,
    title: 'Apply spatial moves',
    summary: 'Arrange existing semantic canvas items with bounded deterministic spatial grammar.',
    use_when: 'The proposal should scatter, cluster, branch, orbit, montage, trace, annotate, or preserve a mutated variant.',
    keywords: [...SPATIAL_MOVE_KINDS, 'spatial', 'layout', 'variant'],
    effect: 'page-apply',
    input_schema: exactActionSchemas.apply_spatial_moves,
  },
  {
    id: 'add_relationships',
    kind: 'action',
    version: 1,
    title: 'Add semantic relationships',
    summary: 'Add bounded typed relationships as visible native arrows.',
    use_when: 'The proposal needs visible meaning-bearing edges between stable semantic items.',
    keywords: [...SEMANTIC_RELATIONSHIP_KINDS, 'relationship', 'edge', 'arrow'],
    effect: 'page-apply',
    input_schema: exactActionSchemas.add_relationships,
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
    id: 'update_blocks',
    kind: 'action',
    version: 1,
    title: 'Update existing blocks',
    summary: 'Change allowlisted content or dimensions on exact existing block IDs.',
    use_when: 'The proposal revises known Fogwood block content without replacing it.',
    keywords: ['update', 'edit', 'block', 'content'],
    effect: 'page-apply',
    input_schema: exactActionSchemas.update_blocks,
  },
  {
    id: 'place_items',
    kind: 'action',
    version: 1,
    title: 'Place existing items',
    summary: 'Move or rotate exact existing IDs using page coordinates.',
    use_when: 'The proposal improves spatial hierarchy while preserving content.',
    keywords: ['place', 'move', 'layout', 'position', 'rotate'],
    effect: 'page-apply',
    input_schema: exactActionSchemas.place_items,
  },
  {
    id: 'remove_items',
    kind: 'action',
    version: 1,
    title: 'Remove existing items',
    summary: 'Delete exact unlocked IDs after human review.',
    use_when: 'The user explicitly wants named items removed.',
    keywords: ['remove', 'delete', 'item'],
    effect: 'page-apply',
    input_schema: exactActionSchemas.remove_items,
  },
  {
    id: 'clear_surface',
    kind: 'action',
    version: 1,
    title: 'Clear the surface',
    summary: 'Delete every current-page item only with the exact confirmation phrase.',
    use_when: 'The user explicitly asks to clear the entire page.',
    keywords: ['clear', 'blank', 'reset'],
    effect: 'page-apply',
    input_schema: exactActionSchemas.clear_surface,
  },
  {
    id: 'insert_recipe',
    kind: 'action',
    version: 1,
    title: 'Insert an immutable recipe',
    summary: 'Expand one exact local v1 fixture or composition.v2 recipe into bounded native matter and typed edges.',
    use_when: 'A known composition seed will help the person review and reshape a coherent proposal.',
    keywords: ['recipe', 'composition', 'starter', 'native', 'spatial', 'expand'],
    effect: 'page-apply',
    input_schema: exactActionSchemas.insert_recipe,
  },
  {
    id: 'set_instrument_inputs',
    kind: 'action',
    version: 1,
    title: 'Set instrument inputs',
    summary: 'Stage bounded numeric changes to existing validated instrument slider controls.',
    use_when: 'The proposal changes a known instrument scenario and the derived result should be reviewed before Apply.',
    keywords: ['instrument', 'scenario', 'slider', 'input', 'preview'],
    effect: 'page-apply',
    input_schema: exactActionSchemas.set_instrument_inputs,
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
  ...RECIPE_REGISTRY.map((recipe): Capability => ({
    id: recipe.id,
    kind: 'recipe',
    version: 1,
    title: recipe.title,
    summary: recipe.purpose,
    use_when: 'Stage this bounded starter for human review before applying it.',
    keywords: recipe.semantic.split('-'),
    effect: 'page-apply',
    recipe,
  })),
  ...COMPOSITION_REGISTRY.map((recipe): Capability => ({
    id: recipe.id,
    kind: 'recipe',
    version: 2,
    title: recipe.title,
    summary: recipe.purpose,
    use_when: 'Stage this native composition for human review before applying it to the canvas.',
    keywords: [
      ...recipe.semantic.split('-'),
      'composition',
      'native',
      'provocation',
      'spatial',
    ],
    effect: 'page-apply',
    recipe,
  })),
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

export type AddBlocksAction = {
  type: 'add_blocks';
  coordinate_space?: 'page';
  blocks: BlockInput[];
};
export type AddShapesAction = {
  type: 'add_shapes';
  coordinate_space?: 'page';
  shapes: CanvasShapeInput[];
};
export type ApplySpatialMovesAction = SpatialMoveAction;
export type AddRelationshipsProposalAction = AddRelationshipsAction;
export type AddMaterialsAction = {
  type: 'add_materials';
  coordinate_space?: 'page';
  materials: Array<MaterialInput | PreparedMaterial>;
};
export type UpdateBlocksAction = {
  type: 'update_blocks';
  updates: Array<BlockInput & { id: string }>;
};
export type PlaceItemsAction = {
  type: 'place_items';
  placements: Array<{ id: string; x: number; y: number; rotation?: number }>;
};
export type RemoveItemsAction = { type: 'remove_items'; ids: string[] };
export type ClearSurfaceAction = { type: 'clear_surface'; confirmation: typeof CLEAR_SURFACE_PHRASE };
export type InsertRecipeAction = {
  type: 'insert_recipe';
  recipe_id: string;
  version: 1 | 2;
  anchor?: { x?: number; y?: number };
};
export type SetInstrumentInputsAction = {
  type: 'set_instrument_inputs';
  changes: InstrumentInputChange[];
};

export type ProposalAction =
  | CanvasOpsAction
  | NormalizedSeededCompositionAction
  | AddBlocksAction
  | AddShapesAction
  | ApplySpatialMovesAction
  | AddRelationshipsProposalAction
  | AddMaterialsAction
  | UpdateBlocksAction
  | PlaceItemsAction
  | RemoveItemsAction
  | ClearSurfaceAction
  | InsertRecipeAction
  | SetInstrumentInputsAction;

export type ProposalV1 = {
  base_revision: string;
  summary: string;
  rationale?: string;
  actions: ProposalAction[];
};

export type ProposalError = { code: string; message: string; path?: string };

export type ProposalDiffValue = unknown;

export type ProposalInstrumentChange = {
  id: string;
  label: string;
  before: ProposalDiffValue;
  after: ProposalDiffValue;
};

export type ProposalInstrumentChangeScope = {
  recipe_instance_id: string;
  controls: readonly ProposalInstrumentChange[];
  derived: readonly ProposalInstrumentChange[];
};

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
  recipe_expansions: Array<{ id: string; version: 1 | 2; title: string; expected_count: number; operations: number; format?: string; composition_metrics?: ReturnType<typeof compositionQualification> }>;
  instrument_changes: ProposalInstrumentChangeScope[];
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

const BLOCK_KEYS = [
  'kind',
  'tone',
  'x',
  'y',
  'w',
  'h',
  'title',
  'body',
  'value',
  'items',
  'columns',
  'rows',
  'options',
  'series',
  'min',
  'max',
  'step',
] as const;

const UPDATE_KEYS = ['id', ...BLOCK_KEYS] as const;

function normalizeBlock(
  raw: unknown,
  path: string,
  warnings: string[],
  update = false,
): { value?: BlockInput & { id?: string }; errors: ProposalError[] } {
  if (!isRecord(raw)) return { errors: [{ code: 'WRONG_TYPE', message: 'Expected an object.', path }] };
  if (!hasOnlyKeys(raw, update ? UPDATE_KEYS : BLOCK_KEYS)) {
    return { errors: [{ code: 'UNKNOWN_FIELD', message: 'Unknown block field.', path }] };
  }
  const errors: ProposalError[] = [];
  if (update && typeof raw.id !== 'string') {
    errors.push({ code: 'MISSING_ID', message: 'A block update needs an exact id.', path: `${path}.id` });
  }
  if (typeof raw.kind !== 'string' || !BLOCK_KINDS.includes(raw.kind as BlockKind)) {
    if (!update || 'kind' in raw) {
      errors.push({ code: 'INVALID_KIND', message: 'Unknown or missing block kind.', path: `${path}.kind` });
    }
  }
  if (raw.tone !== undefined && !BLOCK_TONES.includes(raw.tone as BlockTone)) {
    errors.push({ code: 'INVALID_TONE', message: 'Unknown block tone.', path: `${path}.tone` });
  }
  for (const key of ['x', 'y', 'w', 'h', 'min', 'max', 'step']) {
    if (raw[key] !== undefined && !isFiniteNumber(raw[key])) {
      errors.push({ code: 'INVALID_NUMBER', message: `${key} must be a finite number.`, path: `${path}.${key}` });
    }
  }
  for (const key of ['title', 'body']) {
    if (raw[key] !== undefined && typeof raw[key] !== 'string') {
      errors.push({ code: 'INVALID_TEXT', message: `${key} must be a string.`, path: `${path}.${key}` });
    }
  }
  if (raw.value !== undefined && typeof raw.value !== 'string' && !isFiniteNumber(raw.value)) {
    errors.push({ code: 'INVALID_VALUE', message: 'value must be a string or finite number.', path: `${path}.value` });
  }
  if (raw.items !== undefined) {
    if (!Array.isArray(raw.items) || raw.items.length > 20) {
      errors.push({ code: 'INVALID_ITEMS', message: 'items must contain at most 20 entries.', path: `${path}.items` });
    } else {
      raw.items.forEach((item, itemIndex) => {
        if (!isRecord(item) || !hasOnlyKeys(item, ['label', 'checked']) || typeof item.label !== 'string' || (item.checked !== undefined && typeof item.checked !== 'boolean')) {
          errors.push({ code: 'INVALID_ITEMS', message: 'Each item needs a string label and optional boolean checked.', path: `${path}.items[${itemIndex}]` });
        }
      });
    }
  }
  for (const [key, limit] of [['columns', 8], ['options', 20] ] as const) {
    if (raw[key] !== undefined) {
      if (!Array.isArray(raw[key]) || raw[key].length > limit || raw[key].some((item) => typeof item !== 'string')) {
        errors.push({ code: 'INVALID_LIST', message: `${key} must be a bounded string array.`, path: `${path}.${key}` });
      }
    }
  }
  if (raw.rows !== undefined) {
    if (!Array.isArray(raw.rows) || raw.rows.length > 12 || raw.rows.some((row) => !Array.isArray(row) || row.length > 8 || row.some((item) => typeof item !== 'string'))) {
      errors.push({ code: 'INVALID_ROWS', message: 'rows must be at most 12 arrays of at most 8 strings.', path: `${path}.rows` });
    }
  }
  if (raw.series !== undefined) {
    if (!Array.isArray(raw.series) || raw.series.length > 10 || raw.series.some((item) => !isRecord(item) || !hasOnlyKeys(item, ['label', 'value']) || typeof item.label !== 'string' || !isFiniteNumber(item.value))) {
      errors.push({ code: 'INVALID_SERIES', message: 'series must be at most 10 label/value pairs.', path: `${path}.series` });
    }
  }
  const value = {
    ...(update && typeof raw.id === 'string' ? { id: raw.id } : {}),
    ...(typeof raw.kind === 'string' && BLOCK_KINDS.includes(raw.kind as BlockKind)
      ? { kind: raw.kind as BlockKind }
      : {}),
    ...(typeof raw.tone === 'string' && BLOCK_TONES.includes(raw.tone as BlockTone)
      ? { tone: raw.tone as BlockTone }
      : {}),
    ...(raw.x !== undefined
      ? { x: numberWithWarning(raw.x, 0, -100_000, 100_000, `${path}.x`, warnings) }
      : {}),
    ...(raw.y !== undefined
      ? { y: numberWithWarning(raw.y, 0, -100_000, 100_000, `${path}.y`, warnings) }
      : {}),
    ...(raw.w !== undefined
      ? { w: numberWithWarning(raw.w, 320, 120, 1_400, `${path}.w`, warnings) }
      : {}),
    ...(raw.h !== undefined
      ? { h: numberWithWarning(raw.h, 180, 56, 1_000, `${path}.h`, warnings) }
      : {}),
    ...(raw.title !== undefined ? { title: boundedString(raw.title, 180) } : {}),
    ...(raw.body !== undefined ? { body: boundedString(raw.body, 2_000) } : {}),
    ...(raw.value !== undefined
      ? { value: isFiniteNumber(raw.value) ? String(raw.value).slice(0, 500) : boundedString(raw.value, 500) }
      : {}),
    ...(raw.items !== undefined && Array.isArray(raw.items)
      ? {
          items: raw.items.slice(0, 20).flatMap((item) => {
            if (!isRecord(item) || typeof item.label !== 'string') return [];
            return [{ label: item.label.slice(0, 240), checked: item.checked === true }];
          }),
        }
      : {}),
    ...(raw.columns !== undefined && Array.isArray(raw.columns)
      ? { columns: raw.columns.slice(0, 8).filter((item): item is string => typeof item === 'string').map((item) => item.slice(0, 160)) }
      : {}),
    ...(raw.rows !== undefined && Array.isArray(raw.rows)
      ? {
          rows: raw.rows.slice(0, 12).map((row) =>
            Array.isArray(row)
              ? row.slice(0, 8).filter((item): item is string => typeof item === 'string').map((item) => item.slice(0, 160))
              : [],
          ),
        }
      : {}),
    ...(raw.options !== undefined && Array.isArray(raw.options)
      ? { options: raw.options.slice(0, 20).filter((item): item is string => typeof item === 'string').map((item) => item.slice(0, 160)) }
      : {}),
    ...(raw.series !== undefined && Array.isArray(raw.series)
      ? {
          series: raw.series.slice(0, 10).flatMap((item) => {
            if (!isRecord(item) || typeof item.label !== 'string' || !isFiniteNumber(item.value)) return [];
            return [{ label: item.label.slice(0, 80), value: clamp(item.value, -1_000_000_000, 1_000_000_000) }];
          }),
        }
      : {}),
    ...(raw.min !== undefined ? { min: numberWithWarning(raw.min, 0, -1_000_000, 1_000_000, `${path}.min`, warnings) } : {}),
    ...(raw.max !== undefined ? { max: numberWithWarning(raw.max, 100, -1_000_000, 1_000_000, `${path}.max`, warnings) } : {}),
    ...(raw.step !== undefined ? { step: numberWithWarning(raw.step, 1, 0.001, 100_000, `${path}.step`, warnings) } : {}),
  } as BlockInput & { id?: string };
  if (!update && !('kind' in value)) errors.push({ code: 'INVALID_KIND', message: 'Unknown or missing block kind.', path: `${path}.kind` });
  return { value, errors };
}

function normalizeShape(raw: unknown, path: string, warnings: string[]) {
  if (!isRecord(raw)) return { errors: [{ code: 'WRONG_TYPE', message: 'Expected an object.', path }] };
  const allowed = ['kind', 'x', 'y', 'end_x', 'end_y', 'w', 'h', 'text', 'color', 'fill', 'semantic_id', 'role', 'composition_id', 'region_id', 'variant_id', 'parent_variant_id', 'lineage_source_id'];
  if (!hasOnlyKeys(raw, allowed)) return { errors: [{ code: 'UNKNOWN_FIELD', message: 'Unknown native-shape field.', path }] };
  const errors: ProposalError[] = [];
  if (typeof raw.kind !== 'string' || !CANVAS_SHAPE_KINDS.includes(raw.kind as CanvasShapeKind)) {
    errors.push({ code: 'INVALID_KIND', message: 'Unknown or missing native shape kind.', path: `${path}.kind` });
  }
  if (raw.color !== undefined && !CANVAS_COLORS.includes(raw.color as CanvasColor)) errors.push({ code: 'INVALID_COLOR', message: 'Unknown native shape color.', path: `${path}.color` });
  if (raw.fill !== undefined && !CANVAS_FILLS.includes(raw.fill as CanvasFill)) errors.push({ code: 'INVALID_FILL', message: 'Unknown native shape fill.', path: `${path}.fill` });
  for (const key of ['x', 'y', 'end_x', 'end_y', 'w', 'h']) {
    if (raw[key] !== undefined && !isFiniteNumber(raw[key])) {
      errors.push({ code: 'INVALID_NUMBER', message: `${key} must be a finite number.`, path: `${path}.${key}` });
    }
  }
  if (raw.text !== undefined && typeof raw.text !== 'string') {
    errors.push({ code: 'INVALID_TEXT', message: 'text must be a string.', path: `${path}.text` });
  }
  if (raw.semantic_id !== undefined && !isStableSemanticId(raw.semantic_id)) errors.push({ code: 'INVALID_SEMANTIC_ID', message: 'semantic_id must be a lexical stable semantic id.', path: `${path}.semantic_id` });
  for (const key of ['role', 'composition_id', 'region_id', 'variant_id', 'parent_variant_id', 'lineage_source_id']) {
    if (raw[key] !== undefined && (typeof raw[key] !== 'string' || raw[key].length > 180)) errors.push({ code: 'INVALID_METADATA', message: `${key} must be a bounded string.`, path: `${path}.${key}` });
  }
  const value = {
    ...(typeof raw.kind === 'string' && CANVAS_SHAPE_KINDS.includes(raw.kind as CanvasShapeKind) ? { kind: raw.kind as CanvasShapeKind } : {}),
    ...(raw.x !== undefined ? { x: numberWithWarning(raw.x, 0, -100_000, 100_000, `${path}.x`, warnings) } : {}),
    ...(raw.y !== undefined ? { y: numberWithWarning(raw.y, 0, -100_000, 100_000, `${path}.y`, warnings) } : {}),
    ...(raw.end_x !== undefined ? { end_x: numberWithWarning(raw.end_x, 240, -100_000, 100_000, `${path}.end_x`, warnings) } : {}),
    ...(raw.end_y !== undefined ? { end_y: numberWithWarning(raw.end_y, 100, -100_000, 100_000, `${path}.end_y`, warnings) } : {}),
    ...(raw.w !== undefined ? { w: numberWithWarning(raw.w, 260, 40, 2_000, `${path}.w`, warnings) } : {}),
    ...(raw.h !== undefined ? { h: numberWithWarning(raw.h, 160, 40, 1_600, `${path}.h`, warnings) } : {}),
    ...(raw.text !== undefined ? { text: boundedString(raw.text, 2_000) } : {}),
    ...(raw.color !== undefined && typeof raw.color === 'string' && CANVAS_COLORS.includes(raw.color as CanvasColor) ? { color: raw.color as CanvasColor } : {}),
    ...(raw.fill !== undefined && typeof raw.fill === 'string' && CANVAS_FILLS.includes(raw.fill as CanvasFill) ? { fill: raw.fill as CanvasFill } : {}),
    ...(typeof raw.semantic_id === 'string' && isStableSemanticId(raw.semantic_id) ? { semantic_id: raw.semantic_id } : {}),
    ...(typeof raw.role === 'string' ? { role: raw.role.slice(0, 120) } : {}),
    ...(typeof raw.composition_id === 'string' ? { composition_id: raw.composition_id.slice(0, 180) } : {}),
    ...(typeof raw.region_id === 'string' ? { region_id: raw.region_id.slice(0, 180) } : {}),
    ...(typeof raw.variant_id === 'string' ? { variant_id: raw.variant_id.slice(0, 180) } : {}),
    ...(typeof raw.parent_variant_id === 'string' ? { parent_variant_id: raw.parent_variant_id.slice(0, 180) } : {}),
    ...(typeof raw.lineage_source_id === 'string' ? { lineage_source_id: raw.lineage_source_id.slice(0, 180) } : {}),
  } as CanvasShapeInput;
  return { value, errors };
}

function itemMap(items: readonly InspectableItem[]) {
  return new Map(items.map((item) => [item.id, item]));
}

/** Return existing shape ancestors in nearest-first order, excluding the page. */
export function getAncestorIds(itemId: string, items: readonly InspectableItem[]) {
  const byId = itemMap(items);
  const ancestors: string[] = [];
  const visited = new Set<string>();
  let parentId = byId.get(itemId)?.parent_id;
  while (typeof parentId === 'string' && !visited.has(parentId)) {
    visited.add(parentId);
    if (!byId.has(parentId)) break;
    ancestors.push(parentId);
    parentId = byId.get(parentId)?.parent_id;
  }
  return ancestors;
}

export function isEffectivelyLocked(itemId: string, items: readonly InspectableItem[]) {
  const byId = itemMap(items);
  const item = byId.get(itemId);
  if (!item) return false;
  if (item.is_locked === true) return true;
  return getAncestorIds(itemId, items).some((ancestorId) => byId.get(ancestorId)?.is_locked === true);
}

/**
 * Compute the complete current-page descendant closure that tldraw deletion
 * will affect. The input order is preserved and cycles are safely ignored.
 */
export function descendantClosure(rootIds: readonly string[], items: readonly InspectableItem[]) {
  const byParent = new Map<string, InspectableItem[]>();
  for (const item of items) {
    if (!item.parent_id) continue;
    const children = byParent.get(item.parent_id) ?? [];
    children.push(item);
    byParent.set(item.parent_id, children);
  }
  const byId = itemMap(items);
  const seen = new Set<string>();
  const closure: InspectableItem[] = [];
  const visit = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const item = byId.get(id);
    if (!item) return;
    closure.push(item);
    for (const child of byParent.get(id) ?? []) visit(child.id);
  };
  for (const rootId of rootIds) visit(rootId);
  return closure;
}

function addError(errors: ProposalError[], code: string, message: string, path?: string) {
  errors.push({ code, message, ...(path ? { path } : {}) });
}

function instrumentShapesForContext(items: readonly InspectableItem[]): InstrumentShapeLike[] {
  return items.map((item) => ({
    id: item.id,
    type: item.type,
    ...(item.parent_id ? { parent_id: item.parent_id } : {}),
    ...(item.is_locked !== undefined ? { is_locked: item.is_locked } : {}),
    props: {
      ...(item.props ?? {}),
      ...(item.kind ? { kind: item.kind } : {}),
    },
  }));
}

function instrumentShapesForProposalContext(context: ProposalContext) {
  return context.instrument_shapes ?? instrumentShapesForContext(context.items);
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
  const recipe_expansions: ProposalDiff['recipe_expansions'] = [];
  const instrument_changes: ProposalDiff['instrument_changes'] = [];
  const seeded_compositions: ProposalDiff['seeded_compositions'] = [];
  const spatial_moves: ProposalDiff['spatial_moves'] = [];
  const spatial_creates: ProposalDiff['spatial_creates'] = [];
  const semantic_relationships: ProposalDiff['semantic_relationships'] = [];
  const items = itemMap(context.items);
  const instrumentShapes = instrumentShapesForProposalContext(context);
  const addLabel = (input: BlockInput | CanvasShapeInput) => {
    if ('title' in input && typeof input.title === 'string' && input.title.trim()) return input.title.trim().slice(0, 120);
    if ('text' in input && typeof input.text === 'string' && input.text.trim()) return input.text.trim().slice(0, 120);
    if ('value' in input && (typeof input.value === 'string' || typeof input.value === 'number')) return String(input.value).slice(0, 120);
    return input.kind;
  };
  const addSpec = (type: 'block' | 'shape', input: BlockInput | CanvasShapeInput) => ({
    type,
    kind: input.kind,
    label: addLabel(input),
    ...(isFiniteNumber(input.x) ? { x: clamp(input.x, -100_000, 100_000) } : {}),
    ...(isFiniteNumber(input.y) ? { y: clamp(input.y, -100_000, 100_000) } : {}),
    ...('end_x' in input && isFiniteNumber(input.end_x) ? { end_x: clamp(input.end_x, -100_000, 100_000) } : {}),
    ...('end_y' in input && isFiniteNumber(input.end_y) ? { end_y: clamp(input.end_y, -100_000, 100_000) } : {}),
    ...(isFiniteNumber(input.w) ? { w: clamp(input.w, type === 'block' ? 120 : 40, type === 'block' ? 1_400 : 2_000) } : {}),
    ...(isFiniteNumber(input.h) ? { h: clamp(input.h, type === 'block' ? 56 : 40, type === 'block' ? 1_000 : 1_600) } : {}),
    ...('semantic_id' in input && typeof input.semantic_id === 'string' ? { semantic_id: input.semantic_id } : {}),
    ...('role' in input && typeof input.role === 'string' ? { role: input.role.slice(0, 120) } : {}),
    ...('composition_id' in input && typeof input.composition_id === 'string' ? { composition_id: input.composition_id.slice(0, 180) } : {}),
    ...('region_id' in input && typeof input.region_id === 'string' ? { region_id: input.region_id.slice(0, 180) } : {}),
    ...('variant_id' in input && typeof input.variant_id === 'string' ? { variant_id: input.variant_id.slice(0, 180) } : {}),
    ...('parent_variant_id' in input && typeof input.parent_variant_id === 'string' ? { parent_variant_id: input.parent_variant_id.slice(0, 180) } : {}),
    ...('lineage_source_id' in input && typeof input.lineage_source_id === 'string' ? { lineage_source_id: input.lineage_source_id.slice(0, 180) } : {}),
  });
  const boundedDiffValue = (value: unknown, depth = 2): ProposalDiffValue => {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return typeof value === 'string' ? value.slice(0, 240) : value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (depth <= 0) return '[bounded]';
    if (Array.isArray(value)) return value.slice(0, 12).map((child) => boundedDiffValue(child, depth - 1));
    if (isRecord(value)) {
      return Object.fromEntries(Object.keys(value).sort().slice(0, 16).map((key) => [key, boundedDiffValue(value[key], depth - 1)]));
    }
    return null;
  };
  const readField = (item: InspectableItem | undefined, field: string) => {
    if (!item) return undefined;
    if (field === 'x' || field === 'y' || field === 'w' || field === 'h' || field === 'rotation') return item[field];
    if (field === 'kind') return item.kind;
    const props = item.props ?? {};
    if (['items', 'columns', 'rows', 'options', 'series', 'min', 'max', 'step'].includes(field)) {
      const data = isRecord(props.data) ? props.data : {};
      return data[field];
    }
    return props[field];
  };
  const descriptor = (item: InspectableItem): ProposalItemDescriptor => {
    const candidate = item.text || (isRecord(item.props) && (typeof item.props.title === 'string' ? item.props.title : typeof item.props.name === 'string' ? item.props.name : '')) || item.kind || item.type;
    return {
      id: item.id,
      type: item.type,
      ...(item.kind ? { kind: item.kind } : {}),
      ...(item.semantic_id ? { semantic_id: item.semantic_id.slice(0, 180) } : {}),
      ...(item.parent_id ? { parent_id: item.parent_id } : {}),
      label: String(candidate).slice(0, 120),
    };
  };
  const removeClosure = (roots: readonly string[]) => descendantClosure(roots, context.items);
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
      ...(addition.variant_id ? { variant_id: addition.variant_id } : {}),
      ...(addition.parent_variant_id ? { parent_variant_id: addition.parent_variant_id } : {}),
      ...(addition.lineage_source_id ? { lineage_source_id: addition.lineage_source_id } : {}),
    })));
    updates.push(...plan.updates);
    moves.push(...plan.moves);
    for (const id of plan.removes) if (!removes.ids.includes(id)) removes.ids.push(id);
  };
  for (const action of actions) {
    if (action.type === 'canvas_ops') {
      const result = planCanvasOps(context.items, action.ops, context.page_id);
      if (result.ok) projectCanvasPlan(result.plan);
    }
    if (action.type === 'seeded_composition') {
      const result = planCanvasOps(context.items, action.ops, context.page_id);
      if (result.ok) projectCanvasPlan(result.plan);
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
    if (action.type === 'add_blocks') {
      adds.blocks += action.blocks.length;
      adds.specs.push(...action.blocks.map((input) => addSpec('block', input)));
    }
    if (action.type === 'add_shapes') {
      adds.shapes += action.shapes.length;
      adds.specs.push(...action.shapes.map((input) => addSpec('shape', input)));
    }
    if (action.type === 'apply_spatial_moves') {
      const plan = planSpatialMoves({
        page_id: context.page_id,
        items: context.items,
        selection_semantic_ids: context.selection_semantic_ids,
        selection_complete: context.selection_complete,
        selection_total: context.selection_total,
        regions: context.regions,
        semantic_relationships: context.semantic_relationships,
      }, action);
      spatial_moves.push(...plan.moves.map((move) => ({ ...move })));
      if (plan.moves.length > 0) {
        moves.push({
          ids: plan.moves.map((move) => move.shape_id),
          changes: plan.moves.map((move) => ({ id: move.shape_id, before: move.before, after: move.after })),
        });
      }
      spatial_creates.push(...plan.creates.map((create) => ({
        move_index: create.move_index,
        kind: create.kind,
        semantic_id: create.semantic_id,
        ...(create.source_semantic_id ? { source_semantic_id: create.source_semantic_id } : {}),
        ...(create.source_shape_id ? { source_shape_id: create.source_shape_id } : {}),
        type: create.type,
        x: create.x,
        y: create.y,
        w: create.w,
        h: create.h,
        ...(create.text ? { text: create.text } : {}),
        ...(create.lineage_source_id ? { lineage_source_id: create.lineage_source_id } : {}),
        ...(create.parent_variant_id ? { parent_variant_id: create.parent_variant_id } : {}),
        ...(create.variant_id ? { variant_id: create.variant_id } : {}),
      })));
      adds.shapes += plan.creates.length;
      for (const create of plan.creates) adds.specs.push({ type: 'shape', kind: create.type, label: create.text ?? create.semantic_id, x: create.x, y: create.y, w: create.w, h: create.h, semantic_id: create.semantic_id });
    }
    if (action.type === 'add_relationships') {
      const plan = planRelationships({ page_id: context.page_id, items: context.items, semantic_relationships: context.semantic_relationships }, action.relationships);
      for (const relationship of plan.relationships) {
        const edge = { ...relationship, shape_id: `pending:relationship:${relationship.id}` };
        semantic_relationships.push(edge);
        adds.shapes += 1;
        adds.specs.push({ type: 'shape', kind: 'arrow', label: relationship.label || relationship.kind, semantic_id: relationshipSemanticId(relationship.id) });
      }
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
    if (action.type === 'update_blocks') {
      const changes = action.updates.map((update) => {
        const fields = Object.keys(update).filter((key) => key !== 'id');
        return {
          id: update.id,
          fields: Object.fromEntries(fields.map((field) => [field, {
            before: boundedDiffValue(readField(items.get(update.id), field)),
            after: boundedDiffValue((update as Record<string, unknown>)[field]),
          }])),
        };
      });
      updates.push({ ids: action.updates.map((item) => item.id), fields: [...new Set(action.updates.flatMap((item) => Object.keys(item).filter((key) => key !== 'id')))], changes });
    }
    if (action.type === 'place_items') {
      moves.push({
        ids: action.placements.map((item) => item.id),
        changes: action.placements.map((placement) => {
          const item = items.get(placement.id);
          return {
            id: placement.id,
            before: { x: item?.x ?? 0, y: item?.y ?? 0, rotation: item?.rotation ?? 0 },
            after: { x: placement.x, y: placement.y, rotation: placement.rotation ?? item?.rotation ?? 0 },
          };
        }),
      });
    }
    if (action.type === 'remove_items' || action.type === 'clear_surface') {
      const roots = action.type === 'remove_items' ? action.ids : context.items.map((item) => item.id);
      const closure = removeClosure(roots);
      for (const item of closure) {
        if (!removes.ids.includes(item.id)) removes.ids.push(item.id);
      }
    }
    if (action.type === 'insert_recipe') {
      const recipe = getRecipe(action.recipe_id, action.version);
      if (recipe) {
        if (recipe.version === 2) {
          const metrics = compositionQualification(recipe);
          const expanded = expandCompositionRecipe(recipe, action.anchor);
          const expandedShapes = expanded.flatMap((operation) => operation.type === 'add_shapes' ? operation.shapes : []);
          const expandedRelationships = expanded.flatMap((operation) => operation.type === 'add_relationships' ? operation.relationships : []);
          recipe_expansions.push({
            id: recipe.id,
            version: recipe.version,
            format: COMPOSITION_FORMAT,
            title: recipe.title,
            expected_count: recipe.expected_count,
            operations: expanded.length,
            composition_metrics: metrics,
          });
          adds.shapes += expandedShapes.length + expandedRelationships.length;
          for (const item of expandedShapes) {
            adds.specs.push({ type: 'shape', kind: item.kind, label: item.text ?? item.role, x: item.x, y: item.y, w: item.w, h: item.h, semantic_id: item.semantic_id, role: item.role, composition_id: recipe.id, region_id: item.region_id, variant_id: item.variant_id, parent_variant_id: item.parent_variant_id, lineage_source_id: item.lineage_source_id });
          }
          for (const edge of expandedRelationships) {
            semantic_relationships.push({ id: edge.id, kind: edge.kind, source_semantic_id: edge.source_semantic_id, target_semantic_id: edge.target_semantic_id, ...(edge.label ? { label: edge.label } : {}), shape_id: `pending:relationship:${edge.id}` });
            adds.specs.push({ type: 'shape', kind: 'arrow', label: edge.label ?? edge.kind, semantic_id: relationshipSemanticId(edge.id), role: 'semantic-relationship', composition_id: recipe.id });
          }
        } else {
          recipe_expansions.push({ id: recipe.id, version: recipe.version, title: recipe.title, expected_count: recipe.expected_count, operations: recipe.operations.length });
        }
      }
    }
    if (action.type === 'set_instrument_inputs') {
      const result = applyInstrumentInputChanges(instrumentShapes, action.changes);
      if (result.status === 'ok') instrument_changes.push(...result.instrument_changes);
    }
  }
  adds.total = adds.blocks + adds.shapes + adds.materials + recipe_expansions.filter((recipe) => recipe.version === 1).reduce((sum, recipe) => sum + recipe.expected_count, 0);
  removes.total = removes.ids.length;
  const requestedRemoveIds = new Set(actions.flatMap((action) => {
    if (action.type === 'remove_items') return action.ids;
    if (action.type === 'clear_surface') return context.items.map((item) => item.id);
    if (action.type === 'canvas_ops') {
      const result = planCanvasOps(context.items, action.ops, context.page_id);
      return result.ok ? result.plan.removes : [];
    }
    return [];
  }));
  removes.collateral_ids = removes.ids.filter((id) => !requestedRemoveIds.has(id));
  removes.descriptors = removes.ids.flatMap((id) => {
    const item = items.get(id);
    return item ? [descriptor(item)] : [];
  });
  const updateCount = updates.reduce((sum, update) => sum + update.ids.length, 0);
  const moveCount = moves.reduce((sum, move) => sum + move.ids.length, 0);
  return {
    adds,
    updates,
    moves,
    spatial_moves,
    spatial_creates,
    semantic_relationships,
    removes,
    recipe_expansions,
    instrument_changes,
    seeded_compositions,
    counts: {
      before: context.items.length,
      after: context.items.length + adds.total - removes.total,
      adds: adds.total,
      updates: updateCount,
      moves: moveCount,
      removes: removes.total,
    },
    warnings: [...warnings],
  };
}

export function validateProposal(input: unknown, context: ProposalContext, options: ProposalValidationOptions = {}): ProposalValidation {
  const errors: ProposalError[] = [];
  const warnings: string[] = [];
  if (!isRecord(input)) return { ok: false, errors: [{ code: 'WRONG_TYPE', message: 'Proposal must be an object.' }] };
  if (!hasOnlyKeys(input, ['base_revision', 'summary', 'rationale', 'actions'])) addError(errors, 'UNKNOWN_FIELD', 'Proposal contains an unknown field.');
  if (typeof input.base_revision !== 'string' || input.base_revision.length === 0 || input.base_revision.length > 120) addError(errors, 'INVALID_BASE_REVISION', 'base_revision must be a bounded non-empty string.', 'base_revision');
  if (typeof input.summary !== 'string' || input.summary.length === 0 || input.summary.length > MAX_SUMMARY_LENGTH) addError(errors, 'INVALID_SUMMARY', `summary must be 1-${MAX_SUMMARY_LENGTH} characters.`, 'summary');
  if (input.rationale !== undefined && (typeof input.rationale !== 'string' || input.rationale.length > MAX_RATIONALE_LENGTH)) addError(errors, 'INVALID_RATIONALE', `rationale must be at most ${MAX_RATIONALE_LENGTH} characters.`, 'rationale');
  if (!Array.isArray(input.actions) || input.actions.length < 1 || input.actions.length > MAX_ACTIONS) addError(errors, 'INVALID_ACTION_COUNT', `actions must contain 1-${MAX_ACTIONS} actions.`, 'actions');
  if (errors.length > 0) return { ok: false, errors };
  if (input.base_revision !== context.current_revision) return { ok: false, errors: [{ code: 'STALE_STATE', message: 'Proposal base_revision does not match the current content revision.', path: 'base_revision' }] };

  const normalizedActions: ProposalAction[] = [];
  const targetKinds = new Map<string, string>();
  let aggregateAdds = 0;
  let aggregateRelationshipCount = 0;
  let aggregateSpatialMoveCount = 0;
  let aggregateMaterialBytes = 0;
  const semanticMaterialIdentity = new Map<string, string>();
  const items = itemMap(context.items);
  const existingSemanticIds = new Set(context.items.flatMap((item) => typeof item.semantic_id === 'string' && item.semantic_id.length > 0 ? [item.semantic_id] : []));
  const proposalSemanticIds = new Set(existingSemanticIds);
  const proposalRelationshipIds = new Set((context.semantic_relationships ?? []).map((relationship) => relationship.id));
  const relationshipEndpointIds = new Set<string>();
  const liveSemanticIdCounts = new Map<string, number>();
  for (const semanticId of context.items.flatMap((item) => typeof item.semantic_id === 'string' && item.semantic_id.length > 0 ? [item.semantic_id] : [])) liveSemanticIdCounts.set(semanticId, (liveSemanticIdCounts.get(semanticId) ?? 0) + 1);
  for (const [semanticId, count] of liveSemanticIdCounts) if (count > 1) addError(errors, 'DUPLICATE_SEMANTIC_ID', `Current page contains duplicate semantic id ${semanticId}.`, 'items');
  const actionList = input.actions as unknown[];
  for (let index = 0; index < actionList.length; index += 1) {
    const raw = actionList[index];
    const path = `actions[${index}]`;
    if (!isRecord(raw) || typeof raw.type !== 'string') {
      addError(errors, 'INVALID_ACTION', 'Each action needs a known type.', path);
      continue;
    }
    if (raw.type === 'canvas_ops') {
      if (actionList.length !== 1) addError(errors, 'CANVAS_OPS_MUST_BE_ALONE', 'canvas_ops must be the only action so every composed editor operation is reviewed and applied atomically.', path);
      if (!hasOnlyKeys(raw, ['type', 'ops'])) addError(errors, 'UNKNOWN_FIELD', 'canvas_ops accepts only ops.', path);
      const result = planCanvasOps(context.items, raw.ops, context.page_id);
      if (!result.ok) {
        for (const error of result.errors) {
          addError(errors, error.code, error.message, `${path}.${error.path}`);
        }
        continue;
      }
      aggregateAdds += result.plan.adds.length;
      normalizedActions.push(result.plan.normalized_action);
      continue;
    }
    if (raw.type === 'seeded_composition') {
      if (actionList.length !== 1) addError(errors, 'SEEDED_COMPOSITION_MUST_BE_ALONE', 'seeded_composition must be the only action so every preserved variant remains one reviewed transaction.', path);
      const isNormalized = 'algorithm_version' in raw
        || 'source_revision' in raw
        || 'target_semantic_ids' in raw
        || 'lineage' in raw
        || 'ops' in raw;
      if (isNormalized && raw.source_scope !== 'selection' && raw.source_scope !== 'explicit') {
        addError(errors, 'INVALID_SEEDED_PLAN', 'The normalized seeded composition has an invalid source scope.', `${path}.source_scope`);
        continue;
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
        for (const error of seeded.errors) addError(errors, error.code, error.message, error.path ? `${path}.${error.path}` : path);
        continue;
      }
      const normalized = seeded.plan.normalized_action;
      if (isNormalized) {
        const normalizedKeys = [
          'type', 'grammar', 'algorithm_version', 'prng', 'source_revision', 'source_scope', 'source_fingerprint',
          'seed', 'wildness', 'target_semantic_ids', 'layout', 'lineage', 'ops',
        ];
        if (!hasOnlyKeys(raw, normalizedKeys) || canonicalSerialize(raw) !== canonicalSerialize(normalized)) {
          addError(errors, 'INVALID_SEEDED_PLAN', 'The normalized seeded composition no longer matches the exact current source state and algorithm version.', path);
          continue;
        }
      }
      const canvas = planCanvasOps(context.items, normalized.ops, context.page_id);
      if (!canvas.ok) {
        for (const error of canvas.errors) addError(errors, error.code, error.message, `${path}.${error.path}`);
        continue;
      }
      aggregateAdds += canvas.plan.adds.length;
      normalizedActions.push(normalized);
      continue;
    }
    if (raw.type === 'clear_surface') {
      if (actionList.length !== 1) addError(errors, 'CLEAR_MUST_BE_ALONE', 'clear_surface must be the only action.', path);
      if (!hasOnlyKeys(raw, ['type', 'confirmation']) || raw.confirmation !== CLEAR_SURFACE_PHRASE) addError(errors, 'CONFIRMATION_REQUIRED', `Use the exact phrase "${CLEAR_SURFACE_PHRASE}".`, `${path}.confirmation`);
      if (context.items.length === 0) addError(errors, 'NO_OP', 'The current page is already empty.', path);
      for (const item of context.items) {
        if (isEffectivelyLocked(item.id, context.items)) {
          addError(errors, 'LOCKED_TARGET', 'clear_surface cannot remove locked content or content under a locked ancestor.', `${path}.confirmation`);
        }
      }
      normalizedActions.push({ type: 'clear_surface', confirmation: CLEAR_SURFACE_PHRASE });
      continue;
    }
    if (raw.type === 'set_instrument_inputs') {
      if (actionList.length !== 1) addError(errors, 'SET_INSTRUMENT_INPUTS_MUST_BE_ALONE', 'set_instrument_inputs must be the only action.', path);
      if (!hasOnlyKeys(raw, ['type', 'changes'])) addError(errors, 'UNKNOWN_FIELD', 'set_instrument_inputs accepts only changes.', path);
      const rawChanges = raw.changes;
      if (!Array.isArray(rawChanges) || rawChanges.length < 1 || rawChanges.length > 12) addError(errors, 'INVALID_CHANGE_COUNT', 'changes must contain 1-12 entries.', `${path}.changes`);
      const normalizedChanges = Array.isArray(rawChanges)
        ? rawChanges.flatMap((change) => isRecord(change) && typeof change.id === 'string' && isFiniteNumber(change.value) ? [{ id: change.id, value: change.value }] : [])
        : [];
      const scenario = applyInstrumentInputChanges(instrumentShapesForProposalContext(context), rawChanges);
      errors.push(...scenario.errors.map((entry) => ({ code: entry.code, message: entry.message, ...(entry.path ? { path: `${path}.${entry.path}` } : { path }) })));
      normalizedActions.push({ type: 'set_instrument_inputs', changes: normalizedChanges });
      continue;
    }
    if (raw.type === 'add_blocks') {
      if (!hasOnlyKeys(raw, ['type', 'coordinate_space', 'blocks']) || (raw.coordinate_space !== undefined && raw.coordinate_space !== 'page')) addError(errors, 'UNKNOWN_FIELD', 'add_blocks accepts only page coordinates and blocks.', path);
      if (!Array.isArray(raw.blocks) || raw.blocks.length < 1 || raw.blocks.length > MAX_BLOCKS_PER_ACTION) addError(errors, 'INVALID_COUNT', `blocks must contain 1-${MAX_BLOCKS_PER_ACTION} items.`, `${path}.blocks`);
      const blocks = Array.isArray(raw.blocks) ? raw.blocks : [];
      const normalized = blocks.flatMap((block, blockIndex) => {
        const result = normalizeBlock(block, `${path}.blocks[${blockIndex}]`, warnings);
        errors.push(...result.errors);
        return result.value ? [result.value] : [];
      }) as BlockInput[];
      aggregateAdds += normalized.length;
      normalizedActions.push({ type: 'add_blocks', coordinate_space: 'page', blocks: normalized });
      continue;
    }
    if (raw.type === 'add_shapes') {
      if (!hasOnlyKeys(raw, ['type', 'coordinate_space', 'shapes']) || (raw.coordinate_space !== undefined && raw.coordinate_space !== 'page')) addError(errors, 'UNKNOWN_FIELD', 'add_shapes accepts only page coordinates and shapes.', path);
      if (!Array.isArray(raw.shapes) || raw.shapes.length < 1 || raw.shapes.length > MAX_SHAPES_PER_ACTION) addError(errors, 'INVALID_COUNT', `shapes must contain 1-${MAX_SHAPES_PER_ACTION} items.`, `${path}.shapes`);
      const shapes = Array.isArray(raw.shapes) ? raw.shapes : [];
      const normalized = shapes.flatMap((shape, shapeIndex) => {
        const result = normalizeShape(shape, `${path}.shapes[${shapeIndex}]`, warnings);
        errors.push(...result.errors);
        if (result.value?.semantic_id) {
          if (proposalSemanticIds.has(result.value.semantic_id)) addError(errors, 'DUPLICATE_SEMANTIC_ID', 'A native shape semantic id must be unique across the live page and this proposal.', `${path}.shapes[${shapeIndex}].semantic_id`);
          proposalSemanticIds.add(result.value.semantic_id);
        }
        return result.value ? [result.value] : [];
      }) as CanvasShapeInput[];
      aggregateAdds += normalized.length;
      normalizedActions.push({ type: 'add_shapes', coordinate_space: 'page', shapes: normalized });
      continue;
    }
    if (raw.type === 'apply_spatial_moves') {
      if (!hasOnlyKeys(raw, ['type', 'moves']) || !Array.isArray(raw.moves) || raw.moves.length < 1 || raw.moves.length > SPATIAL_LIMITS.max_moves_per_action) addError(errors, 'INVALID_MOVE_COUNT', `moves must contain 1-${SPATIAL_LIMITS.max_moves_per_action} entries and no unknown fields.`, path);
      const rawMoves = Array.isArray(raw.moves) ? raw.moves : [];
      aggregateSpatialMoveCount += rawMoves.length;
      let spatialPlan: SpatialPlan | undefined;
      try {
        spatialPlan = planSpatialMoves({
          page_id: context.page_id,
          items: context.items,
          selection_semantic_ids: context.selection_semantic_ids,
          selection_complete: context.selection_complete,
          selection_total: context.selection_total,
          regions: context.regions,
          semantic_relationships: context.semantic_relationships,
        }, raw as unknown as SpatialMoveAction);
      } catch (error) {
        const candidate = error as { code?: string; message?: string; path?: string };
        addError(errors, candidate.code ?? 'INVALID_ACTION', candidate.message ?? 'Spatial move planning failed.', candidate.path ? `${path}.${candidate.path}` : path);
      }
      const normalizedMoves = rawMoves.flatMap((move, moveIndex) => {
        if (!isRecord(move)) return [];
        const resolved = spatialPlan?.resolved_scopes[moveIndex]?.semantic_ids;
        const normalizedMove = { ...move } as Record<string, unknown>;
        if (normalizedMove.kind === undefined && typeof normalizedMove.move === 'string') normalizedMove.kind = normalizedMove.move;
        delete normalizedMove.move;
        delete normalizedMove.scope;
        delete normalizedMove.target;
        delete normalizedMove.targets;
        delete normalizedMove.semantic_ids;
        delete normalizedMove.target_semantic_ids;
        if (resolved) normalizedMove.target_semantic_ids = [...resolved];
        return [normalizedMove as unknown as SpatialMoveInput];
      });
      if (spatialPlan) {
        for (const scope of spatialPlan.resolved_scopes) for (const semanticId of scope.semantic_ids) {
          const item = context.items.find((candidate) => candidate.semantic_id === semanticId);
          if (!item) continue;
          if (targetKinds.has(item.id)) addError(errors, 'CONFLICTING_TARGET', 'An item cannot be targeted by multiple mutation actions.', path);
          targetKinds.set(item.id, 'spatial-move');
        }
        for (const create of spatialPlan.creates) {
          if (proposalSemanticIds.has(create.semantic_id)) addError(errors, 'DUPLICATE_SEMANTIC_ID', 'A generated semantic id must be unique across the live page and this proposal.', path);
          proposalSemanticIds.add(create.semantic_id);
        }
        aggregateAdds += spatialPlan.creates.length;
      }
      normalizedActions.push({ type: 'apply_spatial_moves', moves: normalizedMoves });
      continue;
    }
    if (raw.type === 'add_relationships') {
      if (!hasOnlyKeys(raw, ['type', 'relationships']) || !Array.isArray(raw.relationships) || raw.relationships.length < 1 || raw.relationships.length > SPATIAL_LIMITS.max_relationships) addError(errors, 'INVALID_RELATIONSHIP_COUNT', `relationships must contain 1-${SPATIAL_LIMITS.max_relationships} entries and no unknown fields.`, path);
      const relationships = Array.isArray(raw.relationships) ? raw.relationships : [];
      let relationshipPlan;
      try {
        relationshipPlan = planRelationships({ page_id: context.page_id, items: context.items, semantic_relationships: context.semantic_relationships }, relationships as SemanticRelationship[]);
      } catch (error) {
        const candidate = error as { code?: string; message?: string; path?: string };
        addError(errors, candidate.code ?? 'INVALID_RELATIONSHIP', candidate.message ?? 'Relationship planning failed.', candidate.path ? `${path}.${candidate.path}` : path);
      }
      const normalizedRelationships = relationshipPlan?.relationships ?? relationships.flatMap((relationship) => isRecord(relationship) ? [relationship as unknown as SemanticRelationship] : []);
      if (relationshipPlan) {
        for (const relationship of relationshipPlan.relationships) {
          if (proposalRelationshipIds.has(relationship.id)) addError(errors, 'DUPLICATE_RELATIONSHIP_ID', 'A relationship id must be unique across the live page and this proposal.', `${path}.relationships`);
          proposalRelationshipIds.add(relationship.id);
          for (const semanticId of [relationship.source_semantic_id, relationship.target_semantic_id]) {
            const item = context.items.find((candidate) => candidate.semantic_id === semanticId);
            if (item && targetKinds.get(item.id) === 'remove') addError(errors, 'CONFLICTING_TARGET', 'A relationship endpoint cannot be removed in the same proposal.', `${path}.relationships`);
            if (item) relationshipEndpointIds.add(item.id);
          }
        const edgeSemanticId = relationshipSemanticId(relationship.id);
          if (proposalSemanticIds.has(edgeSemanticId)) addError(errors, 'DUPLICATE_SEMANTIC_ID', 'A relationship arrow semantic id must be unique across the live page and this proposal.', `${path}.relationships`);
          proposalSemanticIds.add(edgeSemanticId);
        }
        aggregateRelationshipCount += relationshipPlan.relationships.length;
      }
      normalizedActions.push({ type: 'add_relationships', relationships: normalizedRelationships });
      continue;
    }
    if (raw.type === 'add_materials') {
      if (!hasOnlyKeys(raw, ['type', 'coordinate_space', 'materials']) || (raw.coordinate_space !== undefined && raw.coordinate_space !== 'page')) addError(errors, 'UNKNOWN_FIELD', 'add_materials accepts only page coordinates and materials.', path);
      const rawMaterials = raw.materials;
      if (!Array.isArray(rawMaterials) || rawMaterials.length < 1 || rawMaterials.length > MAX_MATERIALS_PER_ACTION) addError(errors, 'MATERIAL_COUNT_LIMIT', `materials must contain 1-${MAX_MATERIALS_PER_ACTION} items.`, `${path}.materials`);
      const preparedFromOptions = options.preparedMaterials?.get(index);
      const candidateMaterials = preparedFromOptions ?? (Array.isArray(rawMaterials) && rawMaterials.every((material) => isPreparedMaterial(material)) ? rawMaterials as PreparedMaterial[] : undefined);
      if (!candidateMaterials || !Array.isArray(rawMaterials) || candidateMaterials.length !== rawMaterials.length) {
        addError(errors, 'DECODE_REQUIRED', 'Every material must be prepared and browser decode-qualified before staging.', `${path}.materials`);
        normalizedActions.push({ type: 'add_materials', coordinate_space: 'page', materials: [] });
        continue;
      }
      const normalizedMaterials: PreparedMaterial[] = [];
      for (let materialIndex = 0; materialIndex < candidateMaterials.length; materialIndex += 1) {
        const material = candidateMaterials[materialIndex];
        if (!isPreparedMaterial(material) || !material.decode_qualified) {
          addError(errors, 'DECODE_REQUIRED', 'Every material must be prepared and browser decode-qualified before staging.', `${path}.materials[${materialIndex}]`);
          continue;
        }
        const identityKey = canonicalSerialize({
          content_hash: material.content_hash,
          byte_length: material.byte_length,
          mime_type: material.mime_type,
          x: material.x,
          y: material.y,
          w: material.w,
          h: material.h,
        });
        const previous = semanticMaterialIdentity.get(material.semantic_id);
        if (proposalSemanticIds.has(material.semantic_id) || previous !== undefined) addError(errors, 'DUPLICATE_SEMANTIC_ID', 'A semantic material id must be unique across the live page and this proposal.', `${path}.materials[${materialIndex}].semantic_id`);
        proposalSemanticIds.add(material.semantic_id);
        semanticMaterialIdentity.set(material.semantic_id, identityKey);
        aggregateMaterialBytes += material.byte_length;
        normalizedMaterials.push(material);
      }
      aggregateAdds += normalizedMaterials.length;
      normalizedActions.push({ type: 'add_materials', coordinate_space: 'page', materials: normalizedMaterials });
      continue;
    }
    if (raw.type === 'update_blocks') {
      if (!hasOnlyKeys(raw, ['type', 'updates']) || !Array.isArray(raw.updates) || raw.updates.length < 1 || raw.updates.length > MAX_BLOCKS_PER_ACTION) addError(errors, 'INVALID_UPDATES', `updates must contain 1-${MAX_BLOCKS_PER_ACTION} items and no unknown fields.`, path);
      const updates = Array.isArray(raw.updates) ? raw.updates : [];
      const normalized = updates.flatMap((update, updateIndex) => {
        const result = normalizeBlock(update, `${path}.updates[${updateIndex}]`, warnings, true);
        errors.push(...result.errors);
        if (!result.value) return [];
        const id = result.value.id;
        if (!id) return [];
        const item = items.get(id);
        if (!item || item.type !== 'surface-block') addError(errors, 'UNKNOWN_TARGET', 'update_blocks only accepts existing interface block IDs.', `${path}.updates[${updateIndex}].id`);
        if (item && isEffectivelyLocked(id, context.items)) addError(errors, 'LOCKED_TARGET', 'Locked items or items under a locked ancestor cannot be changed.', `${path}.updates[${updateIndex}].id`);
        if (targetKinds.has(id)) addError(errors, 'CONFLICTING_TARGET', 'An item cannot be targeted by multiple mutation actions.', `${path}.updates[${updateIndex}].id`);
        targetKinds.set(id, 'update');
        const fields = Object.keys(result.value).filter((key) => key !== 'id');
        if (fields.length === 0) addError(errors, 'NO_OP', 'An update must provide at least one field.', `${path}.updates[${updateIndex}]`);
        if (item && fields.length > 0) {
          const currentProps = item.props ?? {};
          const currentData = isRecord(currentProps.data) ? currentProps.data : {};
          const unchanged = fields.every((field) => {
            const proposed = (result.value as Record<string, unknown>)[field];
            const current = ['x', 'y'].includes(field)
              ? item[field as 'x' | 'y']
              : ['items', 'columns', 'rows', 'options', 'series', 'min', 'max', 'step'].includes(field)
                ? currentData[field]
                : currentProps[field];
            return canonicalSerialize(proposed) === canonicalSerialize(current);
          });
          if (unchanged) addError(errors, 'NO_OP', 'The update does not change the block.', `${path}.updates[${updateIndex}]`);
        }
        return [result.value];
      }) as Array<BlockInput & { id: string }>;
      normalizedActions.push({ type: 'update_blocks', updates: normalized });
      continue;
    }
    if (raw.type === 'place_items') {
      if (!hasOnlyKeys(raw, ['type', 'placements']) || !Array.isArray(raw.placements) || raw.placements.length < 1 || raw.placements.length > MAX_ITEMS_PER_ACTION) addError(errors, 'INVALID_PLACEMENTS', `placements must contain 1-${MAX_ITEMS_PER_ACTION} items and no unknown fields.`, path);
      const placements = Array.isArray(raw.placements) ? raw.placements : [];
      const normalized = placements.flatMap((placement, placementIndex) => {
        if (!isRecord(placement) || !hasOnlyKeys(placement, ['id', 'x', 'y', 'rotation']) || typeof placement.id !== 'string' || !isFiniteNumber(placement.x) || !isFiniteNumber(placement.y)) {
          addError(errors, 'INVALID_PLACEMENT', 'Each placement needs id, numeric x, and numeric y.', `${path}.placements[${placementIndex}]`);
          return [];
        }
        const item = items.get(placement.id);
        if (!item) addError(errors, 'UNKNOWN_TARGET', 'Placement target does not exist on the current page.', `${path}.placements[${placementIndex}].id`);
        if (item && isEffectivelyLocked(placement.id, context.items)) addError(errors, 'LOCKED_TARGET', 'Locked items or items under a locked ancestor cannot be moved.', `${path}.placements[${placementIndex}].id`);
        if (targetKinds.has(placement.id)) addError(errors, 'CONFLICTING_TARGET', 'An item cannot be targeted by multiple mutation actions.', `${path}.placements[${placementIndex}].id`);
        targetKinds.set(placement.id, 'place');
        if ('rotation' in placement && !isFiniteNumber(placement.rotation)) {
          addError(errors, 'INVALID_NUMBER', 'rotation must be a finite number when supplied.', `${path}.placements[${placementIndex}].rotation`);
          return [];
        }
        const x = clamp(placement.x, -100_000, 100_000);
        const y = clamp(placement.y, -100_000, 100_000);
        if (x !== placement.x) warnings.push(`${path}.placements[${placementIndex}].x normalized to ${x}.`);
        if (y !== placement.y) warnings.push(`${path}.placements[${placementIndex}].y normalized to ${y}.`);
        const rotation = placement.rotation === undefined ? undefined : clamp(placement.rotation as number, -Math.PI * 4, Math.PI * 4);
        if (rotation !== undefined && rotation !== placement.rotation) warnings.push(`${path}.placements[${placementIndex}].rotation normalized to ${rotation}.`);
        if (item && item.x === x && item.y === y && (rotation === undefined || item.rotation === rotation)) addError(errors, 'NO_OP', 'Placement does not change the item.', `${path}.placements[${placementIndex}]`);
        return [{ id: placement.id, x, y, ...(rotation === undefined ? {} : { rotation }) }];
      });
      normalizedActions.push({ type: 'place_items', placements: normalized });
      continue;
    }
    if (raw.type === 'remove_items') {
      if (!hasOnlyKeys(raw, ['type', 'ids']) || !Array.isArray(raw.ids) || raw.ids.length < 1 || raw.ids.length > MAX_ITEMS_PER_ACTION) addError(errors, 'INVALID_IDS', `ids must contain 1-${MAX_ITEMS_PER_ACTION} items and no unknown fields.`, path);
      const ids = Array.isArray(raw.ids) ? raw.ids : [];
      const normalized = ids.filter((id): id is string => {
        if (typeof id !== 'string') {
          addError(errors, 'INVALID_ID', 'Each item id must be a string.', path);
          return false;
        }
        const item = items.get(id);
        if (!item) {
          addError(errors, 'UNKNOWN_TARGET', 'Removal target does not exist on the current page.', path);
          return true;
        }
        const closure = descendantClosure([id], context.items);
        for (const affected of closure) {
          if (isEffectivelyLocked(affected.id, context.items)) addError(errors, 'LOCKED_TARGET', 'Removal would affect locked content or content under a locked ancestor.', path);
          if (targetKinds.has(affected.id)) addError(errors, 'CONFLICTING_TARGET', 'An item cannot be targeted by multiple mutation actions.', path);
          if (relationshipEndpointIds.has(affected.id)) addError(errors, 'CONFLICTING_TARGET', 'A relationship endpoint cannot be removed in the same proposal.', path);
          targetKinds.set(affected.id, 'remove');
        }
        return true;
      });
      if (new Set(normalized).size !== normalized.length) addError(errors, 'CONFLICTING_TARGET', 'An item id may appear only once.', path);
      normalizedActions.push({ type: 'remove_items', ids: normalized });
      continue;
    }
    if (raw.type === 'insert_recipe') {
      const validVersion = raw.version === 1 || raw.version === 2;
      if (!hasOnlyKeys(raw, ['type', 'recipe_id', 'version', 'anchor']) || typeof raw.recipe_id !== 'string' || !validVersion) addError(errors, 'INVALID_RECIPE', 'insert_recipe needs a stable recipe_id and supported recipe version 1 or 2.', path);
      const recipe = typeof raw.recipe_id === 'string' && validVersion ? getRecipe(raw.recipe_id, raw.version as 1 | 2) : undefined;
      if (!recipe) addError(errors, 'UNKNOWN_RECIPE', 'Recipe id/version is not in the immutable local registry.', `${path}.recipe_id`);
      if (recipe?.version === 2) {
        const composition = validateCompositionRecipe(recipe);
        if (!composition.ok) {
          for (const error of composition.errors) addError(errors, error.code, error.message, `${path}.${error.path?.replace(/^\$\.?/u, '') || 'recipe'}`);
        } else {
          for (const item of composition.recipe.items) {
            if (proposalSemanticIds.has(item.semantic_id)) addError(errors, 'DUPLICATE_SEMANTIC_ID', 'A composition semantic id must be unique across the live page and this proposal.', `${path}.recipe_id`);
            proposalSemanticIds.add(item.semantic_id);
          }
          for (const edge of composition.recipe.edges) {
            const edgeSemanticId = relationshipSemanticId(edge.id);
            if (proposalSemanticIds.has(edgeSemanticId)) addError(errors, 'DUPLICATE_SEMANTIC_ID', 'A composition relationship semantic id must be unique across the live page and this proposal.', `${path}.recipe_id`);
            proposalSemanticIds.add(edgeSemanticId);
          }
        }
      }
      let anchor: { x?: number; y?: number } | undefined;
      if (raw.anchor !== undefined) {
        if (!isRecord(raw.anchor) || !hasOnlyKeys(raw.anchor, ['x', 'y']) || (raw.anchor.x !== undefined && !isFiniteNumber(raw.anchor.x)) || (raw.anchor.y !== undefined && !isFiniteNumber(raw.anchor.y))) addError(errors, 'INVALID_ANCHOR', 'anchor only accepts numeric x and y.', `${path}.anchor`);
        if (isRecord(raw.anchor)) anchor = { ...(raw.anchor.x === undefined ? {} : { x: clamp(raw.anchor.x as number, -100_000, 100_000) }), ...(raw.anchor.y === undefined ? {} : { y: clamp(raw.anchor.y as number, -100_000, 100_000) }) };
      }
      if (recipe) aggregateAdds += recipe.expected_count;
      normalizedActions.push({ type: 'insert_recipe', recipe_id: typeof raw.recipe_id === 'string' ? raw.recipe_id : '', version: validVersion ? raw.version as 1 | 2 : 1, ...(anchor ? { anchor } : {}) });
      continue;
    }
    addError(errors, 'UNKNOWN_ACTION', `Unsupported action type: ${raw.type}.`, `${path}.type`);
  }
  if (aggregateAdds > MAX_AGGREGATE_ADDS) addError(errors, 'AGGREGATE_LIMIT', `Proposal adds at most ${MAX_AGGREGATE_ADDS} items.`, 'actions');
  if (aggregateSpatialMoveCount > SPATIAL_LIMITS.max_moves_per_action) addError(errors, 'INVALID_MOVE_COUNT', `A proposal may contain at most ${SPATIAL_LIMITS.max_moves_per_action} spatial moves across all actions.`, 'actions');
  if (aggregateRelationshipCount > SPATIAL_LIMITS.max_relationships) addError(errors, 'INVALID_RELATIONSHIP_COUNT', `Proposal relationships must contain at most ${SPATIAL_LIMITS.max_relationships} entries.`, 'actions');
  if (aggregateMaterialBytes > MAX_MATERIALS_AGGREGATE_BYTES) addError(errors, 'MATERIAL_AGGREGATE_LIMIT', `Aggregate material bytes must be at most ${MAX_MATERIALS_AGGREGATE_BYTES}.`, 'actions');
  if (normalizedActions.some((action) => action.type === 'clear_surface') && normalizedActions.length !== 1) addError(errors, 'CLEAR_MUST_BE_ALONE', 'clear_surface must be the only action.', 'actions');
  if (errors.length > 0) return { ok: false, errors };
  const proposal: ProposalV1 = {
    base_revision: input.base_revision as string,
    summary: input.summary as string,
    ...(input.rationale === undefined ? {} : { rationale: input.rationale as string }),
    actions: normalizedActions,
  };
  return { ok: true, proposal, diff: buildProposalDiff(normalizedActions, context, warnings) };
}

/**
 * Validate a proposal, asynchronously preparing only add_materials actions.
 * Non-material proposals stay on the synchronous validator path so existing
 * callers retain their return shape and timing.
 */
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
  status: 'pending' | 'stale' | 'error';
  message?: string;
};

export type ProposalControllerResult = {
  status: 'STAGED' | 'APPLIED' | 'REJECTED' | 'STALE_STATE' | 'NO_PENDING' | 'ERROR';
  state?: ProposalControllerState;
  message?: string;
};

export type ProposalControllerAdapter = {
  getRevision: () => string;
  apply: (proposal: ProposalV1) => { ok: true } | { ok: false; status: 'STALE_STATE' | 'ERROR'; message: string };
};

export function createProposalController(
  adapter: ProposalControllerAdapter,
  onChange?: (state: ProposalControllerState | null) => void,
) {
  let pending: ProposalControllerState | null = null;
  const publish = () => onChange?.(pending);
  return {
    getState: () => pending,
    stage(proposal: ProposalV1, diff: ProposalDiff): ProposalControllerResult {
      if (pending) {
        return {
          status: 'ERROR',
          state: pending,
          message: 'A proposal is already awaiting review. Apply or Reject it before staging another.',
        };
      }
      if (adapter.getRevision() !== proposal.base_revision) {
        pending = { proposal, diff, status: 'stale', message: 'The page changed before this proposal was staged.' };
        publish();
        return { status: 'STALE_STATE', state: pending, message: pending.message };
      }
      pending = { proposal, diff, status: 'pending' };
      publish();
      return { status: 'STAGED', state: pending };
    },
    apply(): ProposalControllerResult {
      if (!pending) return { status: 'NO_PENDING' };
      if (adapter.getRevision() !== pending.proposal.base_revision) {
        pending = { ...pending, status: 'stale', message: 'The page changed; inspect again and re-propose before applying.' };
        publish();
        return { status: 'STALE_STATE', state: pending, message: pending.message };
      }
      const result = adapter.apply(pending.proposal);
      if (!result.ok) {
        pending = { ...pending, status: result.status === 'STALE_STATE' ? 'stale' : 'error', message: result.message };
        publish();
        return { status: result.status, state: pending, message: result.message };
      }
      pending = null;
      publish();
      return { status: 'APPLIED' };
    },
    reject(): ProposalControllerResult {
      if (!pending) return { status: 'NO_PENDING' };
      pending = null;
      publish();
      return { status: 'REJECTED' };
    },
  };
}
