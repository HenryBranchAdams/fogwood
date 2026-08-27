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
import { FOGWOOD_BAZAAR_CAPABILITY } from './fogwood-bazaar.ts';

export const FOGWOOD_PROTOCOL = 'fogwood-agent-runtime';
export const FOGWOOD_PROTOCOL_VERSION = '1';
export const FOGWOOD_REGISTRY_VERSION = '1';
export const FOGWOOD_PROPOSAL_VERSION = '1';
export const CLEAR_SURFACE_PHRASE = 'clear the surface';

export const MAX_ACTIONS = 32;
export const MAX_BLOCKS_PER_ACTION = 48;
export const MAX_SHAPES_PER_ACTION = 64;
export const MAX_ITEMS_PER_ACTION = 100;
export const MAX_AGGREGATE_ADDS = 96;
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
  role?: string;
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
  meta?: FogwoodMeta;
  props?: JsonRecord;
  text?: string;
};

export type ProposalContext = {
  current_revision: string;
  items: readonly InspectableItem[];
  /** Page adapters may supply exact raw shape props so stage and Apply validate identical instrument bytes. */
  instrument_shapes?: readonly InstrumentShapeLike[];
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

export const RECIPE_REGISTRY: readonly RecipeDefinition[] = deepFreeze([
  researchRecipe,
  meetingRecipe,
  architectureRecipe,
  compareRecipe,
]);

export type RecipeId = (typeof RECIPE_REGISTRY)[number]['id'];

export function getRecipe(recipeId: string, version: number) {
  return RECIPE_REGISTRY.find((recipe) => recipe.id === recipeId && recipe.version === version);
}

export function expandRecipe(recipe: RecipeDefinition, anchor?: { x?: number; y?: number }) {
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
  kind: 'tool' | 'action' | 'primitive' | 'recipe';
  version: 1;
  title: string;
  summary: string;
  use_when: string;
  keywords: readonly string[];
  effect: 'read-only' | 'stage-only' | 'page-apply';
  input_schema?: CapabilitySchema;
  recipe?: RecipeDefinition;
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
  },
  required: ['kind'],
};

const actionSchema = (field: string, maxItems: number, itemSchema: CapabilitySchema): CapabilitySchema => ({
  type: 'object',
  additionalProperties: false,
  properties: {
    type: { const: field },
    ...(field === 'add_blocks' || field === 'add_shapes' ? { coordinate_space: { const: 'page' } } : {}),
    [field === 'add_blocks' ? 'blocks' : field === 'add_shapes' ? 'shapes' : field === 'update_blocks' ? 'updates' : 'placements']:
      { type: 'array', minItems: 1, maxItems, items: itemSchema },
  },
  required: ['type', field === 'add_blocks' ? 'blocks' : field === 'add_shapes' ? 'shapes' : field === 'update_blocks' ? 'updates' : 'placements'],
});

const exactActionSchemas: Record<string, CapabilitySchema> = {
  add_blocks: actionSchema('add_blocks', MAX_BLOCKS_PER_ACTION, blockItemSchema),
  add_shapes: actionSchema('add_shapes', MAX_SHAPES_PER_ACTION, shapeItemSchema),
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
      version: { const: 1 },
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
    actions: { type: 'array', minItems: 1, maxItems: MAX_ACTIONS, items: { oneOf: Object.values(exactActionSchemas) } },
  },
  required: ['base_revision', 'summary', 'actions'],
};

export const CAPABILITY_REGISTRY: readonly Capability[] = deepFreeze([
  {
    id: 'fogwood-inspect',
    kind: 'tool',
    version: 1,
    title: 'Inspect Fogwood',
    summary: 'Read the bounded current-page operating contract and editable state.',
    use_when: 'Bootstrap context before searching capabilities or proposing a change.',
    keywords: ['inspect', 'state', 'page', 'revision', 'viewport'],
    effect: 'read-only',
    input_schema: INSPECT_INPUT_SCHEMA,
  },
  {
    id: 'fogwood-capabilities',
    kind: 'tool',
    version: 1,
    title: 'Search Fogwood capabilities',
    summary: 'Search deterministic local tools, actions, primitives, and recipes.',
    use_when: 'Find an allowlisted operation or immutable recipe before proposing.',
    keywords: ['search', 'capability', 'action', 'recipe', 'primitive'],
    effect: 'read-only',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: { type: 'string', maxLength: 120 },
        kind: { type: 'string', enum: ['tool', 'action', 'primitive', 'recipe'] },
        page_size: { type: 'integer', minimum: 1, maximum: 20 },
        cursor: { type: 'string', maxLength: 16 },
      },
    },
  },
  FOGWOOD_BAZAAR_CAPABILITY,
  {
    id: 'fogwood-propose',
    kind: 'tool',
    version: 1,
    title: 'Propose a Fogwood change',
    summary: 'Stage one typed, bounded proposal for page-owned human review.',
    use_when: 'The desired canvas change is understood and should be reviewed before Apply.',
    keywords: ['proposal', 'stage', 'review', 'apply', 'reject'],
    effect: 'stage-only',
    input_schema: PROPOSAL_INPUT_SCHEMA,
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
    summary: 'Expand one local recipe into bounded add-blocks and add-shapes operations.',
    use_when: 'A known starting surface will help the person review a coherent proposal.',
    keywords: ['recipe', 'starter', 'compose', 'expand'],
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
]);

export type CapabilitySearchInput = {
  query?: string;
  kind?: Capability['kind'];
  page_size?: number;
  cursor?: string;
};

export type CapabilitySearchResult = {
  registry_version: string;
  results: Capability[];
  next_cursor?: string;
  has_more: boolean;
};

export function searchCapabilities(input: CapabilitySearchInput = {}): CapabilitySearchResult {
  const query = boundedString(input.query, 120).trim().toLowerCase();
  const pageSize = isFiniteNumber(input.page_size)
    ? clamp(Math.trunc(input.page_size), 1, 20)
    : 12;
  const offset = input.cursor && /^\d+$/.test(input.cursor) ? Number(input.cursor) : 0;
  const filtered = CAPABILITY_REGISTRY.filter((capability) => {
    if (input.kind && capability.kind !== input.kind) return false;
    if (!query) return true;
    const haystack = [
      capability.id,
      capability.title,
      capability.summary,
      capability.use_when,
      ...capability.keywords,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
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
  version: 1;
  anchor?: { x?: number; y?: number };
};
export type SetInstrumentInputsAction = {
  type: 'set_instrument_inputs';
  changes: InstrumentInputChange[];
};

export type ProposalAction =
  | AddBlocksAction
  | AddShapesAction
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
    total: number;
    specs: Array<{ type: 'block' | 'shape'; kind: string; label: string; x?: number; y?: number; end_x?: number; end_y?: number; w?: number; h?: number }>;
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
  removes: { ids: string[]; total: number; collateral_ids: string[]; descriptors: ProposalItemDescriptor[] };
  recipe_expansions: Array<{ id: string; version: 1; title: string; expected_count: number; operations: number }>;
  instrument_changes: ProposalInstrumentChangeScope[];
  counts: { before: number; after: number; adds: number; updates: number; moves: number; removes: number };
  warnings: string[];
};

export type ProposalValidation =
  | { ok: true; proposal: ProposalV1; diff: ProposalDiff }
  | { ok: false; errors: ProposalError[] };

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
  const allowed = ['kind', 'x', 'y', 'end_x', 'end_y', 'w', 'h', 'text', 'color', 'fill'];
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
  const adds: ProposalDiff['adds'] = { blocks: 0, shapes: 0, total: 0, specs: [] };
  const updates: ProposalDiff['updates'] = [];
  const moves: ProposalDiff['moves'] = [];
  const removes: ProposalDiff['removes'] = { ids: [], total: 0, collateral_ids: [], descriptors: [] };
  const recipe_expansions: ProposalDiff['recipe_expansions'] = [];
  const instrument_changes: ProposalDiff['instrument_changes'] = [];
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
  for (const action of actions) {
    if (action.type === 'add_blocks') {
      adds.blocks += action.blocks.length;
      adds.specs.push(...action.blocks.map((input) => addSpec('block', input)));
    }
    if (action.type === 'add_shapes') {
      adds.shapes += action.shapes.length;
      adds.specs.push(...action.shapes.map((input) => addSpec('shape', input)));
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
      if (recipe) recipe_expansions.push({ id: recipe.id, version: recipe.version, title: recipe.title, expected_count: recipe.expected_count, operations: recipe.operations.length });
    }
    if (action.type === 'set_instrument_inputs') {
      const result = applyInstrumentInputChanges(instrumentShapes, action.changes);
      if (result.status === 'ok') instrument_changes.push(...result.instrument_changes);
    }
  }
  adds.total = adds.blocks + adds.shapes + recipe_expansions.reduce((sum, recipe) => sum + recipe.expected_count, 0);
  removes.total = removes.ids.length;
  const requestedRemoveIds = new Set(actions.flatMap((action) => {
    if (action.type === 'remove_items') return action.ids;
    if (action.type === 'clear_surface') return context.items.map((item) => item.id);
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
    removes,
    recipe_expansions,
    instrument_changes,
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

export function validateProposal(input: unknown, context: ProposalContext): ProposalValidation {
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
  const items = itemMap(context.items);
  const actionList = input.actions as unknown[];
  for (let index = 0; index < actionList.length; index += 1) {
    const raw = actionList[index];
    const path = `actions[${index}]`;
    if (!isRecord(raw) || typeof raw.type !== 'string') {
      addError(errors, 'INVALID_ACTION', 'Each action needs a known type.', path);
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
        return result.value ? [result.value] : [];
      }) as CanvasShapeInput[];
      aggregateAdds += normalized.length;
      normalizedActions.push({ type: 'add_shapes', coordinate_space: 'page', shapes: normalized });
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
          targetKinds.set(affected.id, 'remove');
        }
        return true;
      });
      if (new Set(normalized).size !== normalized.length) addError(errors, 'CONFLICTING_TARGET', 'An item id may appear only once.', path);
      normalizedActions.push({ type: 'remove_items', ids: normalized });
      continue;
    }
    if (raw.type === 'insert_recipe') {
      if (!hasOnlyKeys(raw, ['type', 'recipe_id', 'version', 'anchor']) || typeof raw.recipe_id !== 'string' || raw.version !== 1) addError(errors, 'INVALID_RECIPE', 'insert_recipe needs a stable recipe_id and version 1.', path);
      const recipe = typeof raw.recipe_id === 'string' && raw.version === 1 ? getRecipe(raw.recipe_id, 1) : undefined;
      if (!recipe) addError(errors, 'UNKNOWN_RECIPE', 'Recipe id/version is not in the immutable local registry.', `${path}.recipe_id`);
      let anchor: { x?: number; y?: number } | undefined;
      if (raw.anchor !== undefined) {
        if (!isRecord(raw.anchor) || !hasOnlyKeys(raw.anchor, ['x', 'y']) || (raw.anchor.x !== undefined && !isFiniteNumber(raw.anchor.x)) || (raw.anchor.y !== undefined && !isFiniteNumber(raw.anchor.y))) addError(errors, 'INVALID_ANCHOR', 'anchor only accepts numeric x and y.', `${path}.anchor`);
        if (isRecord(raw.anchor)) anchor = { ...(raw.anchor.x === undefined ? {} : { x: clamp(raw.anchor.x as number, -100_000, 100_000) }), ...(raw.anchor.y === undefined ? {} : { y: clamp(raw.anchor.y as number, -100_000, 100_000) }) };
      }
      if (recipe) aggregateAdds += recipe.expected_count;
      normalizedActions.push({ type: 'insert_recipe', recipe_id: typeof raw.recipe_id === 'string' ? raw.recipe_id : '', version: 1, ...(anchor ? { anchor } : {}) });
      continue;
    }
    addError(errors, 'UNKNOWN_ACTION', `Unsupported action type: ${raw.type}.`, `${path}.type`);
  }
  if (aggregateAdds > MAX_AGGREGATE_ADDS) addError(errors, 'AGGREGATE_LIMIT', `Proposal adds at most ${MAX_AGGREGATE_ADDS} items.`, 'actions');
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
