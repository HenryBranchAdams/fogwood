/**
 * Pure, data-only composition.v2 vocabulary.
 *
 * A composition is a bounded declarative description of canvas matter. It is
 * intentionally not a renderer, loader, or executor: the page adapter turns
 * the validated description into ordinary Fogwood proposal actions.
 */

import type { CanvasColor, CanvasFill, CanvasShapeKind, JsonRecord } from './fogwood-runtime';
import type { SemanticRelationship } from './fogwood-spatial';

export const COMPOSITION_FORMAT = 'composition.v2' as const;

export const COMPOSITION_LIMITS = Object.freeze({
  max_items: 64,
  max_materials: 96,
  max_edges: 256,
  max_moves: 8,
  max_placements: 96,
  max_regions: 24,
  max_adapters: 8,
  max_aesthetics: 12,
  max_algorithms: 12,
  max_provocations: 16,
  max_variants: 64,
  max_source_notes: 16,
  max_text: 500,
  max_label: 180,
  max_data_entries: 32,
});

const COMPOSITION_SHAPE_KINDS = [
  'rectangle',
  'ellipse',
  'diamond',
  'triangle',
  'cloud',
  'note',
  'text',
  'frame',
] as const satisfies readonly CanvasShapeKind[];

const RELATIONSHIP_KINDS = [
  'supports',
  'contradicts',
  'depends_on',
  'causes',
  'blocks',
  'echoes',
  'mutates_into',
] as const;

/** Host-owned capabilities may be named by data, but never supplied by it. */
export const COMPOSITION_HOST_IDS = Object.freeze(new Set([
  'adapter.materials.v1',
  'adapter.live-image-material.v1',
  'aesthetic.fungi-cities.v1',
  'aesthetic.evidence-constellation.v1',
  'aesthetic.storyworld-mutation.v1',
  'algorithm.scatter.v1',
  'algorithm.cluster.v1',
  'algorithm.branch.v1',
  'algorithm.orbit.v1',
  'algorithm.montage.v1',
  'algorithm.trace.v1',
  'algorithm.place.v1',
]));

const MATERIAL_KINDS = ['native', 'asset'] as const;
const SOURCE_STATUSES = ['observed', 'analogy', 'inference', 'open'] as const;
const MOVE_KINDS = ['scatter', 'cluster', 'branch', 'orbit', 'montage', 'trace', 'annotate', 'mutate'] as const;
const COMPOSITION_DATA_FORBIDDEN_KEYS = new Set([
  'code', 'exec', 'execute', 'eval', 'function', 'script', 'formula', 'expression',
  'html', 'css', 'style', 'url', 'href', 'src', 'fetch', 'remote', 'embed', 'iframe',
]);

export type CompositionRelationshipKind = (typeof RELATIONSHIP_KINDS)[number];
export type CompositionMaterialKind = (typeof MATERIAL_KINDS)[number];
export type CompositionSourceStatus = (typeof SOURCE_STATUSES)[number];
export type CompositionMoveKind = (typeof MOVE_KINDS)[number];

export type CompositionRegion = {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type CompositionItem = {
  id: string;
  semantic_id: string;
  kind: Exclude<CanvasShapeKind, 'arrow'>;
  role: string;
  region_id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  color?: CanvasColor;
  fill?: CanvasFill;
  variant_id?: string;
  parent_variant_id?: string;
  lineage_source_id?: string;
};

export type CompositionMaterial = {
  id: string;
  kind: CompositionMaterialKind;
  item_id: string;
  role: string;
  semantic_id: string;
};

export type CompositionEdge = {
  id: string;
  kind: CompositionRelationshipKind;
  source_semantic_id: string;
  target_semantic_id: string;
  label?: string;
};

export type CompositionPlacement = {
  id: string;
  target_semantic_id: string;
  x: number;
  y: number;
  rotation?: number;
};

export type CompositionMove = {
  id: string;
  kind: CompositionMoveKind;
  target_semantic_ids: string[];
  algorithm_id?: string;
  data?: JsonRecord;
};

export type CompositionAdapter = {
  id: string;
  capability_id: string;
  locality: 'local';
  purpose: string;
  loss: 'none' | 'annotated' | 'bounded';
};

export type CompositionAesthetic = {
  id: string;
  token_id: string;
  purpose: string;
};

export type CompositionAlgorithm = {
  id: string;
  capability_id: string;
  data?: JsonRecord;
};

export type CompositionProvocation = {
  id: string;
  kind: 'question' | 'portal' | 'quotation' | 'instruction';
  text: string;
  target_semantic_id?: string;
};

export type CompositionVariant = {
  id: string;
  variant_id: string;
  lineage_source_id: string;
  parent_variant_id?: string;
  label: string;
};

export type CompositionSourceNote = {
  id: string;
  title: string;
  locator: string;
  status: CompositionSourceStatus;
  summary: string;
};

export type CompositionQualification = {
  default_surface_blocks: 0;
  native_material_ratio: number;
  typed_edge_ratio: number;
  deterministic_repeat: true;
  stable_ids: true;
  variant_preservation: boolean;
  edit_inspect_mutation: boolean;
  no_live_provider: true;
  fixtures: string[];
  examples: string[];
  expected_counts?: {
    items: number;
    edges: number;
    native_materials: number;
    typed_edges: number;
  };
};

export type CompositionRecipe = {
  id: string;
  version: 2;
  format: typeof COMPOSITION_FORMAT;
  title: string;
  purpose: string;
  status: 'immutable';
  bounds: { x: 0; y: 0; w: number; h: number };
  semantic: string;
  provenance: { source: 'fogwood'; recipe_id: string; recipe_version: 2 };
  expected_count: number;
  regions: CompositionRegion[];
  materials: CompositionMaterial[];
  items: CompositionItem[];
  edges: CompositionEdge[];
  placements: CompositionPlacement[];
  moves: CompositionMove[];
  adapters: CompositionAdapter[];
  aesthetics: CompositionAesthetic[];
  algorithms: CompositionAlgorithm[];
  provocations: CompositionProvocation[];
  variants: CompositionVariant[];
  source_notes: CompositionSourceNote[];
  qualification: CompositionQualification;
};

export type CompositionValidationError = {
  code: string;
  message: string;
  path?: string;
};

export type CompositionValidation =
  | { ok: true; recipe: CompositionRecipe }
  | { ok: false; errors: CompositionValidationError[] };

export type CompositionOperation =
  | {
      type: 'add_shapes';
      coordinate_space: 'page';
      shapes: CompositionItem[];
    }
  | {
      type: 'add_relationships';
      relationships: SemanticRelationship[];
    };

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._/-]{0,179}$/u;
const CAPABILITY_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*\.v[1-9][0-9]*$/u;
const HTTP_PATTERN = /(?:https?|ftp|blob|data):/iu;
const DANGEROUS_TEXT_PATTERN = /(?:<\/?[a-z]|javascript\s*:|vbscript\s*:|\b(?:fetch|eval|function|import|require)\s*\()/iu;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function integer(value: unknown): value is number {
  return Number.isSafeInteger(value);
}

function ownKeys(value: Record<string, unknown>, allowed: readonly string[], path: string, errors: CompositionValidationError[]) {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) errors.push({ code: 'UNKNOWN_FIELD', message: `Unknown composition field ${key}.`, path: `${path}.${key}` });
  }
}

function requiredText(value: unknown, path: string, errors: CompositionValidationError[], max: number = COMPOSITION_LIMITS.max_text) {
  if (typeof value !== 'string' || value.length < 1 || value.length > max) {
    errors.push({ code: 'INVALID_TEXT', message: `Text must contain 1-${max} characters.`, path });
    return '';
  }
  if (DANGEROUS_TEXT_PATTERN.test(value)) errors.push({ code: 'UNSAFE_TEXT', message: 'Composition text cannot contain executable or HTML-like content.', path });
  return value;
}

function optionalText(value: unknown, path: string, errors: CompositionValidationError[], max: number = COMPOSITION_LIMITS.max_text) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > max) {
    errors.push({ code: 'INVALID_TEXT', message: `Text must contain at most ${max} characters.`, path });
    return undefined;
  }
  if (DANGEROUS_TEXT_PATTERN.test(value)) errors.push({ code: 'UNSAFE_TEXT', message: 'Composition text cannot contain executable or HTML-like content.', path });
  if (HTTP_PATTERN.test(value)) errors.push({ code: 'REMOTE_REFERENCE', message: 'Remote URLs are allowed only in bounded source notes.', path });
  return value;
}

function idValue(value: unknown, path: string, errors: CompositionValidationError[]) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    errors.push({ code: 'INVALID_ID', message: 'Stable IDs must use the bounded Fogwood lexical form.', path });
    return '';
  }
  return value;
}

function numberValue(value: unknown, path: string, errors: CompositionValidationError[], min = -100_000, max = 100_000) {
  if (!finite(value) || value < min || value > max) errors.push({ code: 'INVALID_NUMBER', message: 'Number is outside the bounded composition range.', path });
  return finite(value) ? value : 0;
}

function listOfIds(value: unknown, path: string, errors: CompositionValidationError[], max = COMPOSITION_LIMITS.max_items) {
  if (!Array.isArray(value) || value.length < 1 || value.length > max) {
    errors.push({ code: 'INVALID_COUNT', message: `Expected 1-${max} semantic IDs.`, path });
    return [];
  }
  const ids: string[] = [];
  const seen = new Set<string>();
  value.forEach((entry, index) => {
    const id = idValue(entry, `${path}[${index}]`, errors);
    if (id && seen.has(id)) errors.push({ code: 'DUPLICATE_SEMANTIC_ID', message: 'IDs must be unique inside a move.', path: `${path}[${index}]` });
    if (id) {
      seen.add(id);
      ids.push(id);
    }
  });
  return ids;
}

function validateData(value: unknown, path: string, errors: CompositionValidationError[], depth = 0, entries = { count: 0 }): JsonRecord | undefined {
  if (!isRecord(value)) {
    errors.push({ code: 'INVALID_DATA', message: 'Algorithm data must be a bounded object.', path });
    return undefined;
  }
  if (depth > 4) {
    errors.push({ code: 'DATA_DEPTH', message: 'Algorithm data exceeds the bounded depth.', path });
    return undefined;
  }
  const result: JsonRecord = {};
  for (const [key, child] of Object.entries(value)) {
    entries.count += 1;
    if (entries.count > COMPOSITION_LIMITS.max_data_entries) {
      errors.push({ code: 'DATA_LIMIT', message: 'Algorithm data exceeds the bounded entry count.', path });
      break;
    }
    if (!/^[a-z][a-z0-9_]{0,63}$/u.test(key)) errors.push({ code: 'INVALID_DATA', message: 'Algorithm data keys are bounded names.', path: `${path}.${key}` });
    if (COMPOSITION_DATA_FORBIDDEN_KEYS.has(key.toLowerCase())) errors.push({ code: 'FORBIDDEN_FIELD', message: 'Algorithm data cannot contain executable, network, markup, or formula fields.', path: `${path}.${key}` });
    if (typeof child === 'string') {
      optionalText(child, `${path}.${key}`, errors, COMPOSITION_LIMITS.max_text);
      result[key] = child.slice(0, COMPOSITION_LIMITS.max_text);
    } else if (typeof child === 'number') {
      numberValue(child, `${path}.${key}`, errors, -1_000_000, 1_000_000);
      result[key] = child;
    } else if (typeof child === 'boolean' || child === null) {
      result[key] = child;
    } else if (Array.isArray(child)) {
      if (child.length > COMPOSITION_LIMITS.max_data_entries) errors.push({ code: 'DATA_LIMIT', message: 'Algorithm arrays are bounded.', path: `${path}.${key}` });
      result[key] = child.slice(0, COMPOSITION_LIMITS.max_data_entries).map((entry, index) => {
        if (typeof entry === 'string') return entry.slice(0, COMPOSITION_LIMITS.max_text);
        if (typeof entry === 'number' && Number.isFinite(entry)) return entry;
        if (typeof entry === 'boolean' || entry === null) return entry;
        errors.push({ code: 'INVALID_DATA', message: 'Algorithm arrays contain only scalar values.', path: `${path}.${key}[${index}]` });
        return null;
      });
    } else if (isRecord(child)) {
      result[key] = validateData(child, `${path}.${key}`, errors, depth + 1, entries) ?? {};
    } else {
      errors.push({ code: 'INVALID_DATA', message: 'Algorithm data contains an unsupported value.', path: `${path}.${key}` });
    }
  }
  return result;
}

function validateCompositionInternal(value: unknown): { recipe?: CompositionRecipe; errors: CompositionValidationError[] } {
  const errors: CompositionValidationError[] = [];
  if (!isRecord(value)) return { errors: [{ code: 'WRONG_TYPE', message: 'Composition recipe must be an object.' }] };
  ownKeys(value, [
    'id', 'version', 'format', 'title', 'purpose', 'status', 'bounds', 'semantic', 'provenance', 'expected_count',
    'regions', 'materials', 'items', 'edges', 'placements', 'moves', 'adapters', 'aesthetics', 'algorithms',
    'provocations', 'variants', 'source_notes', 'qualification',
  ], '$', errors);
  const id = idValue(value.id, '$.id', errors);
  if (value.version !== 2) errors.push({ code: 'INVALID_VERSION', message: 'Composition recipes must use version 2.', path: '$.version' });
  if (value.format !== COMPOSITION_FORMAT) errors.push({ code: 'INVALID_FORMAT', message: `Composition recipes must use ${COMPOSITION_FORMAT}.`, path: '$.format' });
  const title = requiredText(value.title, '$.title', errors, 180);
  const purpose = requiredText(value.purpose, '$.purpose', errors, 500);
  if (value.status !== 'immutable') errors.push({ code: 'INVALID_STATUS', message: 'Composition recipes must be immutable.', path: '$.status' });
  const boundsValue = isRecord(value.bounds) ? value.bounds : {};
  ownKeys(boundsValue, ['x', 'y', 'w', 'h'], '$.bounds', errors);
  if (boundsValue.x !== 0 || boundsValue.y !== 0) errors.push({ code: 'INVALID_BOUNDS', message: 'Composition bounds must start at 0,0.', path: '$.bounds' });
  const bounds = { x: 0 as const, y: 0 as const, w: numberValue(boundsValue.w, '$.bounds.w', errors, 1, 2_000), h: numberValue(boundsValue.h, '$.bounds.h', errors, 1, 2_000) };
  const semantic = requiredText(value.semantic, '$.semantic', errors, 180);
  const provenanceValue = isRecord(value.provenance) ? value.provenance : {};
  ownKeys(provenanceValue, ['source', 'recipe_id', 'recipe_version'], '$.provenance', errors);
  if (provenanceValue.source !== 'fogwood' || provenanceValue.recipe_id !== id || provenanceValue.recipe_version !== 2) errors.push({ code: 'INVALID_PROVENANCE', message: 'Composition provenance must pin its exact identity.', path: '$.provenance' });

  const regionsValue = Array.isArray(value.regions) ? value.regions : [];
  if (regionsValue.length < 1 || regionsValue.length > COMPOSITION_LIMITS.max_regions) errors.push({ code: 'INVALID_COUNT', message: `regions must contain 1-${COMPOSITION_LIMITS.max_regions} entries.`, path: '$.regions' });
  const regions: CompositionRegion[] = [];
  const regionIds = new Set<string>();
  regionsValue.forEach((raw, index) => {
    const path = `$.regions[${index}]`;
    if (!isRecord(raw)) { errors.push({ code: 'WRONG_TYPE', message: 'Region must be an object.', path }); return; }
    ownKeys(raw, ['id', 'label', 'x', 'y', 'w', 'h'], path, errors);
    const regionId = idValue(raw.id, `${path}.id`, errors);
    if (regionIds.has(regionId)) errors.push({ code: 'DUPLICATE_REGION_ID', message: 'Region IDs must be unique.', path });
    regionIds.add(regionId);
    regions.push({ id: regionId, label: requiredText(raw.label, `${path}.label`, errors, COMPOSITION_LIMITS.max_label), x: numberValue(raw.x, `${path}.x`, errors), y: numberValue(raw.y, `${path}.y`, errors), w: numberValue(raw.w, `${path}.w`, errors, 1, 2_000), h: numberValue(raw.h, `${path}.h`, errors, 1, 2_000) });
  });

  const itemsValue = Array.isArray(value.items) ? value.items : [];
  if (itemsValue.length < 1 || itemsValue.length > COMPOSITION_LIMITS.max_items) errors.push({ code: 'INVALID_COUNT', message: `items must contain 1-${COMPOSITION_LIMITS.max_items} entries.`, path: '$.items' });
  const items: CompositionItem[] = [];
  const itemIds = new Set<string>();
  const semanticIds = new Set<string>();
  itemsValue.forEach((raw, index) => {
    const path = `$.items[${index}]`;
    if (!isRecord(raw)) { errors.push({ code: 'WRONG_TYPE', message: 'Composition item must be an object.', path }); return; }
    ownKeys(raw, ['id', 'semantic_id', 'kind', 'role', 'region_id', 'x', 'y', 'w', 'h', 'text', 'color', 'fill', 'variant_id', 'parent_variant_id', 'lineage_source_id'], path, errors);
    const itemId = idValue(raw.id, `${path}.id`, errors);
    const semanticId = idValue(raw.semantic_id, `${path}.semantic_id`, errors);
    if (itemIds.has(itemId)) errors.push({ code: 'DUPLICATE_ITEM_ID', message: 'Composition item IDs must be unique.', path });
    if (semanticIds.has(semanticId)) errors.push({ code: 'DUPLICATE_SEMANTIC_ID', message: 'Semantic IDs must be unique across composition items.', path });
    itemIds.add(itemId); semanticIds.add(semanticId);
    if (!COMPOSITION_SHAPE_KINDS.includes(raw.kind as (typeof COMPOSITION_SHAPE_KINDS)[number])) errors.push({ code: 'INVALID_KIND', message: 'Composition items must be native canvas shape kinds.', path: `${path}.kind` });
    const regionId = idValue(raw.region_id, `${path}.region_id`, errors);
    if (regionIds.size > 0 && !regionIds.has(regionId)) errors.push({ code: 'UNKNOWN_REGION', message: 'Composition item references an unknown region.', path: `${path}.region_id` });
    const variantId = raw.variant_id === undefined ? undefined : idValue(raw.variant_id, `${path}.variant_id`, errors);
    const parentVariantId = raw.parent_variant_id === undefined ? undefined : idValue(raw.parent_variant_id, `${path}.parent_variant_id`, errors);
    const lineageSourceId = raw.lineage_source_id === undefined ? undefined : idValue(raw.lineage_source_id, `${path}.lineage_source_id`, errors);
    const color = raw.color === undefined ? undefined : raw.color;
    const fill = raw.fill === undefined ? undefined : raw.fill;
    if (color !== undefined && !['black', 'grey', 'violet', 'blue', 'light-blue', 'yellow', 'orange', 'green', 'light-green', 'light-red', 'red', 'white'].includes(String(color))) errors.push({ code: 'INVALID_COLOR', message: 'Composition color is not host-owned.', path: `${path}.color` });
    if (fill !== undefined && !['none', 'semi', 'solid', 'pattern'].includes(String(fill))) errors.push({ code: 'INVALID_FILL', message: 'Composition fill is not host-owned.', path: `${path}.fill` });
    items.push({ id: itemId, semantic_id: semanticId, kind: raw.kind as CompositionItem['kind'], role: requiredText(raw.role, `${path}.role`, errors, COMPOSITION_LIMITS.max_label), region_id: regionId, x: numberValue(raw.x, `${path}.x`, errors), y: numberValue(raw.y, `${path}.y`, errors), w: numberValue(raw.w, `${path}.w`, errors, 40, 2_000), h: numberValue(raw.h, `${path}.h`, errors, 40, 1_600), ...(optionalText(raw.text, `${path}.text`, errors, COMPOSITION_LIMITS.max_text) === undefined ? {} : { text: raw.text as string }), ...(color === undefined ? {} : { color: color as CanvasColor }), ...(fill === undefined ? {} : { fill: fill as CanvasFill }), ...(variantId ? { variant_id: variantId } : {}), ...(parentVariantId ? { parent_variant_id: parentVariantId } : {}), ...(lineageSourceId ? { lineage_source_id: lineageSourceId } : {}) });
  });

  const materialsValue = Array.isArray(value.materials) ? value.materials : [];
  if (materialsValue.length < 1 || materialsValue.length > COMPOSITION_LIMITS.max_materials) errors.push({ code: 'INVALID_COUNT', message: `materials must contain 1-${COMPOSITION_LIMITS.max_materials} entries.`, path: '$.materials' });
  const materials: CompositionMaterial[] = [];
  const materialIds = new Set<string>();
  const materialItemIds = new Set<string>();
  const materialSemanticIds = new Set<string>();
  materialsValue.forEach((raw, index) => {
    const path = `$.materials[${index}]`;
    if (!isRecord(raw)) { errors.push({ code: 'WRONG_TYPE', message: 'Composition material must be an object.', path }); return; }
    ownKeys(raw, ['id', 'kind', 'item_id', 'role', 'semantic_id'], path, errors);
    const materialId = idValue(raw.id, `${path}.id`, errors);
    const itemId = idValue(raw.item_id, `${path}.item_id`, errors);
    const materialSemanticId = idValue(raw.semantic_id, `${path}.semantic_id`, errors);
    if (materialIds.has(materialId)) errors.push({ code: 'DUPLICATE_MATERIAL_ID', message: 'Material IDs must be unique.', path });
    if (materialItemIds.has(itemId)) errors.push({ code: 'DUPLICATE_MATERIAL_ITEM', message: 'Each item may have one material record.', path });
    if (materialSemanticIds.has(materialSemanticId)) errors.push({ code: 'DUPLICATE_SEMANTIC_ID', message: 'Material semantic IDs must be unique.', path });
    if (!MATERIAL_KINDS.includes(raw.kind as CompositionMaterialKind)) errors.push({ code: 'INVALID_MATERIAL_KIND', message: 'Material kind is not supported.', path: `${path}.kind` });
    if (!itemIds.has(itemId)) errors.push({ code: 'UNKNOWN_TARGET', message: 'Material references an unknown item.', path: `${path}.item_id` });
    if (!semanticIds.has(materialSemanticId)) errors.push({ code: 'UNKNOWN_TARGET', message: 'Material semantic_id must reference an item semantic ID.', path: `${path}.semantic_id` });
    materialIds.add(materialId); materialItemIds.add(itemId); materialSemanticIds.add(materialSemanticId);
    materials.push({ id: materialId, kind: raw.kind as CompositionMaterialKind, item_id: itemId, role: requiredText(raw.role, `${path}.role`, errors, COMPOSITION_LIMITS.max_label), semantic_id: materialSemanticId });
  });
  if (materialItemIds.size !== itemIds.size) errors.push({ code: 'MATERIAL_COVERAGE', message: 'Every composition item must have exactly one material record.', path: '$.materials' });

  const edgesValue = Array.isArray(value.edges) ? value.edges : [];
  if (edgesValue.length < 1 || edgesValue.length > COMPOSITION_LIMITS.max_edges) errors.push({ code: 'INVALID_COUNT', message: `edges must contain 1-${COMPOSITION_LIMITS.max_edges} entries.`, path: '$.edges' });
  const edges: CompositionEdge[] = [];
  const edgeIds = new Set<string>();
  edgesValue.forEach((raw, index) => {
    const path = `$.edges[${index}]`;
    if (!isRecord(raw)) { errors.push({ code: 'WRONG_TYPE', message: 'Composition edge must be an object.', path }); return; }
    ownKeys(raw, ['id', 'kind', 'source_semantic_id', 'target_semantic_id', 'label'], path, errors);
    const edgeId = idValue(raw.id, `${path}.id`, errors);
    const source = idValue(raw.source_semantic_id, `${path}.source_semantic_id`, errors);
    const target = idValue(raw.target_semantic_id, `${path}.target_semantic_id`, errors);
    if (edgeIds.has(edgeId)) errors.push({ code: 'DUPLICATE_EDGE_ID', message: 'Edge IDs must be unique.', path });
    if (!RELATIONSHIP_KINDS.includes(raw.kind as CompositionRelationshipKind)) errors.push({ code: 'INVALID_EDGE_KIND', message: 'Edge kind is not supported.', path: `${path}.kind` });
    if (!semanticIds.has(source) || !semanticIds.has(target)) errors.push({ code: 'UNKNOWN_ENDPOINT', message: 'Every edge endpoint must reference an item semantic ID.', path });
    if (source === target) errors.push({ code: 'SELF_RELATIONSHIP', message: 'An edge cannot point to itself.', path });
    edgeIds.add(edgeId);
    edges.push({ id: edgeId, kind: raw.kind as CompositionRelationshipKind, source_semantic_id: source, target_semantic_id: target, ...(raw.label === undefined ? {} : { label: requiredText(raw.label, `${path}.label`, errors, COMPOSITION_LIMITS.max_label) }) });
  });

  const placementsValue = Array.isArray(value.placements) ? value.placements : [];
  if (placementsValue.length !== items.length) errors.push({ code: 'PLACEMENT_MISMATCH', message: 'Every item needs exactly one deterministic placement.', path: '$.placements' });
  if (placementsValue.length > COMPOSITION_LIMITS.max_placements) errors.push({ code: 'INVALID_COUNT', message: 'placements exceed the bounded count.', path: '$.placements' });
  const placements: CompositionPlacement[] = [];
  const placementIds = new Set<string>();
  const placementTargets = new Set<string>();
  placementsValue.forEach((raw, index) => {
    const path = `$.placements[${index}]`;
    if (!isRecord(raw)) { errors.push({ code: 'WRONG_TYPE', message: 'Placement must be an object.', path }); return; }
    ownKeys(raw, ['id', 'target_semantic_id', 'x', 'y', 'rotation'], path, errors);
    const placementId = idValue(raw.id, `${path}.id`, errors);
    const target = idValue(raw.target_semantic_id, `${path}.target_semantic_id`, errors);
    if (placementIds.has(placementId)) errors.push({ code: 'DUPLICATE_PLACEMENT_ID', message: 'Placement IDs must be unique.', path });
    if (placementTargets.has(target)) errors.push({ code: 'DUPLICATE_PLACEMENT', message: 'Placement targets must be unique.', path });
    if (!semanticIds.has(target)) errors.push({ code: 'UNKNOWN_TARGET', message: 'Placement target is unknown.', path });
    placementIds.add(placementId); placementTargets.add(target);
    placements.push({ id: placementId, target_semantic_id: target, x: numberValue(raw.x, `${path}.x`, errors), y: numberValue(raw.y, `${path}.y`, errors), ...(raw.rotation === undefined ? {} : { rotation: numberValue(raw.rotation, `${path}.rotation`, errors, -Math.PI * 4, Math.PI * 4) }) });
  });

  const movesValue = Array.isArray(value.moves) ? value.moves : [];
  if (movesValue.length > COMPOSITION_LIMITS.max_moves) errors.push({ code: 'INVALID_COUNT', message: `moves may contain at most ${COMPOSITION_LIMITS.max_moves} entries.`, path: '$.moves' });
  const moves: CompositionMove[] = [];
  const moveIds = new Set<string>();
  movesValue.forEach((raw, index) => {
    const path = `$.moves[${index}]`;
    if (!isRecord(raw)) { errors.push({ code: 'WRONG_TYPE', message: 'Move must be an object.', path }); return; }
    ownKeys(raw, ['id', 'kind', 'target_semantic_ids', 'algorithm_id', 'data'], path, errors);
    const moveId = idValue(raw.id, `${path}.id`, errors);
    const targetIds = listOfIds(raw.target_semantic_ids, `${path}.target_semantic_ids`, errors);
    if (moveIds.has(moveId)) errors.push({ code: 'DUPLICATE_MOVE_ID', message: 'Move IDs must be unique.', path });
    if (!MOVE_KINDS.includes(raw.kind as CompositionMoveKind)) errors.push({ code: 'INVALID_MOVE_KIND', message: 'Move kind is not supported.', path: `${path}.kind` });
    targetIds.forEach((target) => { if (!semanticIds.has(target)) errors.push({ code: 'UNKNOWN_TARGET', message: 'Move target is unknown.', path }); });
    const algorithmId = raw.algorithm_id === undefined ? undefined : idValue(raw.algorithm_id, `${path}.algorithm_id`, errors);
    const data = raw.data === undefined ? undefined : validateData(raw.data, `${path}.data`, errors);
    moveIds.add(moveId); moves.push({ id: moveId, kind: raw.kind as CompositionMoveKind, target_semantic_ids: targetIds, ...(algorithmId ? { algorithm_id: algorithmId } : {}), ...(data ? { data } : {}) });
  });

  const adaptersValue = Array.isArray(value.adapters) ? value.adapters : [];
  if (adaptersValue.length > COMPOSITION_LIMITS.max_adapters) errors.push({ code: 'INVALID_COUNT', message: 'adapters exceed the bounded count.', path: '$.adapters' });
  const adapters: CompositionAdapter[] = [];
  adaptersValue.forEach((raw, index) => {
    const path = `$.adapters[${index}]`;
    if (!isRecord(raw)) { errors.push({ code: 'WRONG_TYPE', message: 'Adapter must be an object.', path }); return; }
    ownKeys(raw, ['id', 'capability_id', 'locality', 'purpose', 'loss'], path, errors);
    const adapterId = idValue(raw.id, `${path}.id`, errors);
    if (typeof raw.capability_id !== 'string' || !CAPABILITY_PATTERN.test(raw.capability_id) || !COMPOSITION_HOST_IDS.has(raw.capability_id)) errors.push({ code: 'UNTRUSTED_CAPABILITY', message: 'Adapter capability_id must be a host-owned allowlisted ID.', path: `${path}.capability_id` });
    if (raw.locality !== 'local') errors.push({ code: 'INVALID_LOCALITY', message: 'Composition adapters are local only.', path: `${path}.locality` });
    if (!['none', 'annotated', 'bounded'].includes(String(raw.loss))) errors.push({ code: 'INVALID_ADAPTER', message: 'Adapter loss is not supported.', path: `${path}.loss` });
    adapters.push({ id: adapterId, capability_id: String(raw.capability_id ?? ''), locality: 'local', purpose: requiredText(raw.purpose, `${path}.purpose`, errors, COMPOSITION_LIMITS.max_text), loss: raw.loss as CompositionAdapter['loss'] });
  });

  const aestheticsValue = Array.isArray(value.aesthetics) ? value.aesthetics : [];
  if (aestheticsValue.length > COMPOSITION_LIMITS.max_aesthetics) errors.push({ code: 'INVALID_COUNT', message: 'aesthetics exceed the bounded count.', path: '$.aesthetics' });
  const aesthetics: CompositionAesthetic[] = [];
  aestheticsValue.forEach((raw, index) => {
    const path = `$.aesthetics[${index}]`;
    if (!isRecord(raw)) { errors.push({ code: 'WRONG_TYPE', message: 'Aesthetic must be an object.', path }); return; }
    ownKeys(raw, ['id', 'token_id', 'purpose'], path, errors);
    const aestheticId = idValue(raw.id, `${path}.id`, errors);
    if (typeof raw.token_id !== 'string' || !CAPABILITY_PATTERN.test(raw.token_id) || !COMPOSITION_HOST_IDS.has(raw.token_id)) errors.push({ code: 'UNTRUSTED_TOKEN', message: 'Aesthetic token_id must be a host-owned allowlisted ID.', path: `${path}.token_id` });
    aesthetics.push({ id: aestheticId, token_id: String(raw.token_id ?? ''), purpose: requiredText(raw.purpose, `${path}.purpose`, errors, COMPOSITION_LIMITS.max_text) });
  });

  const algorithmsValue = Array.isArray(value.algorithms) ? value.algorithms : [];
  if (algorithmsValue.length > COMPOSITION_LIMITS.max_algorithms) errors.push({ code: 'INVALID_COUNT', message: 'algorithms exceed the bounded count.', path: '$.algorithms' });
  const algorithms: CompositionAlgorithm[] = [];
  algorithmsValue.forEach((raw, index) => {
    const path = `$.algorithms[${index}]`;
    if (!isRecord(raw)) { errors.push({ code: 'WRONG_TYPE', message: 'Algorithm must be an object.', path }); return; }
    ownKeys(raw, ['id', 'capability_id', 'data'], path, errors);
    const algorithmId = idValue(raw.id, `${path}.id`, errors);
    if (typeof raw.capability_id !== 'string' || !CAPABILITY_PATTERN.test(raw.capability_id) || !COMPOSITION_HOST_IDS.has(raw.capability_id)) errors.push({ code: 'UNTRUSTED_CAPABILITY', message: 'Algorithm capability_id must be a host-owned allowlisted ID.', path: `${path}.capability_id` });
    algorithms.push({ id: algorithmId, capability_id: String(raw.capability_id ?? ''), ...(raw.data === undefined ? {} : { data: validateData(raw.data, `${path}.data`, errors) ?? {} }) });
  });
  const declaredAlgorithmIds = new Set(algorithms.map((algorithm) => algorithm.id));
  moves.forEach((move, index) => {
    if (move.algorithm_id && !declaredAlgorithmIds.has(move.algorithm_id)) errors.push({ code: 'UNKNOWN_ALGORITHM', message: 'Composition move algorithm_id must reference a declared algorithm.', path: `$.moves[${index}].algorithm_id` });
  });

  const provocationsValue = Array.isArray(value.provocations) ? value.provocations : [];
  if (provocationsValue.length > COMPOSITION_LIMITS.max_provocations) errors.push({ code: 'INVALID_COUNT', message: 'provocations exceed the bounded count.', path: '$.provocations' });
  const provocations: CompositionProvocation[] = [];
  provocationsValue.forEach((raw, index) => {
    const path = `$.provocations[${index}]`;
    if (!isRecord(raw)) { errors.push({ code: 'WRONG_TYPE', message: 'Provocation must be an object.', path }); return; }
    ownKeys(raw, ['id', 'kind', 'text', 'target_semantic_id'], path, errors);
    const provocationId = idValue(raw.id, `${path}.id`, errors);
    if (!['question', 'portal', 'quotation', 'instruction'].includes(String(raw.kind))) errors.push({ code: 'INVALID_PROVOCATION', message: 'Provocation kind is not supported.', path: `${path}.kind` });
    const target = raw.target_semantic_id === undefined ? undefined : idValue(raw.target_semantic_id, `${path}.target_semantic_id`, errors);
    if (target && !semanticIds.has(target)) errors.push({ code: 'UNKNOWN_TARGET', message: 'Provocation target is unknown.', path: `${path}.target_semantic_id` });
    provocations.push({ id: provocationId, kind: raw.kind as CompositionProvocation['kind'], text: requiredText(raw.text, `${path}.text`, errors, COMPOSITION_LIMITS.max_text), ...(target ? { target_semantic_id: target } : {}) });
  });

  const variantsValue = Array.isArray(value.variants) ? value.variants : [];
  if (variantsValue.length > COMPOSITION_LIMITS.max_variants) errors.push({ code: 'INVALID_COUNT', message: 'variants exceed the bounded count.', path: '$.variants' });
  const variants: CompositionVariant[] = [];
  const variantIds = new Set<string>();
  variantsValue.forEach((raw, index) => {
    const path = `$.variants[${index}]`;
    if (!isRecord(raw)) { errors.push({ code: 'WRONG_TYPE', message: 'Variant must be an object.', path }); return; }
    ownKeys(raw, ['id', 'variant_id', 'lineage_source_id', 'parent_variant_id', 'label'], path, errors);
    const variantRecordId = idValue(raw.id, `${path}.id`, errors);
    const variantId = idValue(raw.variant_id, `${path}.variant_id`, errors);
    const lineageSourceId = idValue(raw.lineage_source_id, `${path}.lineage_source_id`, errors);
    const parentVariantId = raw.parent_variant_id === undefined ? undefined : idValue(raw.parent_variant_id, `${path}.parent_variant_id`, errors);
    if (variantIds.has(variantId)) errors.push({ code: 'DUPLICATE_VARIANT_ID', message: 'Variant IDs must be unique.', path });
    if (!semanticIds.has(lineageSourceId) && !variantIds.has(lineageSourceId)) errors.push({ code: 'UNKNOWN_LINEAGE', message: 'Variant lineage source must name an item or earlier variant.', path: `${path}.lineage_source_id` });
    if (parentVariantId && !variantIds.has(parentVariantId) && !semanticIds.has(parentVariantId)) errors.push({ code: 'UNKNOWN_LINEAGE', message: 'Variant parent must name an item or earlier variant.', path: `${path}.parent_variant_id` });
    variantIds.add(variantId);
    variants.push({ id: variantRecordId, variant_id: variantId, lineage_source_id: lineageSourceId, ...(parentVariantId ? { parent_variant_id: parentVariantId } : {}), label: requiredText(raw.label, `${path}.label`, errors, COMPOSITION_LIMITS.max_label) });
  });
  const declaredVariantIds = new Set(variants.map((variant) => variant.variant_id));
  items.forEach((item, index) => {
    if (item.variant_id && !declaredVariantIds.has(item.variant_id)) errors.push({ code: 'UNKNOWN_VARIANT', message: 'Item variant_id must reference a declared variant.', path: `$.items[${index}].variant_id` });
    if (item.parent_variant_id && !declaredVariantIds.has(item.parent_variant_id)) errors.push({ code: 'UNKNOWN_VARIANT', message: 'Item parent_variant_id must reference a declared variant.', path: `$.items[${index}].parent_variant_id` });
    if (item.lineage_source_id && !semanticIds.has(item.lineage_source_id) && !declaredVariantIds.has(item.lineage_source_id)) errors.push({ code: 'UNKNOWN_LINEAGE', message: 'Item lineage_source_id must name an item or declared variant.', path: `$.items[${index}].lineage_source_id` });
  });

  const sourceNotesValue = Array.isArray(value.source_notes) ? value.source_notes : [];
  if (sourceNotesValue.length > COMPOSITION_LIMITS.max_source_notes) errors.push({ code: 'INVALID_COUNT', message: 'source_notes exceed the bounded count.', path: '$.source_notes' });
  const sourceNotes: CompositionSourceNote[] = [];
  const sourceIds = new Set<string>();
  sourceNotesValue.forEach((raw, index) => {
    const path = `$.source_notes[${index}]`;
    if (!isRecord(raw)) { errors.push({ code: 'WRONG_TYPE', message: 'Source note must be an object.', path }); return; }
    ownKeys(raw, ['id', 'title', 'locator', 'status', 'summary'], path, errors);
    const sourceId = idValue(raw.id, `${path}.id`, errors);
    if (sourceIds.has(sourceId)) errors.push({ code: 'DUPLICATE_SOURCE_ID', message: 'Source IDs must be unique.', path });
    if (typeof raw.locator !== 'string' || raw.locator.length < 1 || raw.locator.length > 500 || !/^https:\/\//iu.test(raw.locator)) errors.push({ code: 'INVALID_SOURCE', message: 'Source notes require bounded HTTPS primary locators.', path: `${path}.locator` });
    if (!SOURCE_STATUSES.includes(raw.status as CompositionSourceStatus)) errors.push({ code: 'INVALID_SOURCE_STATUS', message: 'Source note status is not supported.', path: `${path}.status` });
    sourceIds.add(sourceId);
    sourceNotes.push({ id: sourceId, title: requiredText(raw.title, `${path}.title`, errors, 180), locator: String(raw.locator ?? ''), status: raw.status as CompositionSourceStatus, summary: requiredText(raw.summary, `${path}.summary`, errors, COMPOSITION_LIMITS.max_text) });
  });

  const qualificationValue = isRecord(value.qualification) ? value.qualification : {};
  ownKeys(qualificationValue, ['default_surface_blocks', 'native_material_ratio', 'typed_edge_ratio', 'deterministic_repeat', 'stable_ids', 'variant_preservation', 'edit_inspect_mutation', 'no_live_provider', 'fixtures', 'examples', 'expected_counts'], '$.qualification', errors);
  if (qualificationValue.default_surface_blocks !== 0) errors.push({ code: 'QUALIFICATION_MISMATCH', message: 'Default composition must contain zero surface blocks.', path: '$.qualification.default_surface_blocks' });
  if (qualificationValue.deterministic_repeat !== true || qualificationValue.stable_ids !== true || qualificationValue.no_live_provider !== true) errors.push({ code: 'QUALIFICATION_MISMATCH', message: 'Determinism, stable IDs, and no-live-provider qualification must be explicit.', path: '$.qualification' });
  const nativeMaterialRatio = numberValue(qualificationValue.native_material_ratio, '$.qualification.native_material_ratio', errors, 0, 1);
  const typedEdgeRatio = numberValue(qualificationValue.typed_edge_ratio, '$.qualification.typed_edge_ratio', errors, 0, 1);
  const actualNativeMaterialRatio = materials.length === 0 ? 0 : materials.filter((entry) => entry.kind === 'native').length / materials.length;
  const actualTypedEdgeRatio = edges.length === 0 ? 0 : edges.filter((entry) => RELATIONSHIP_KINDS.includes(entry.kind)).length / edges.length;
  if (Math.abs(nativeMaterialRatio - actualNativeMaterialRatio) > 1e-9) errors.push({ code: 'RATIO_MISMATCH', message: 'qualification.native_material_ratio must match the declarative materials.', path: '$.qualification.native_material_ratio' });
  if (Math.abs(typedEdgeRatio - actualTypedEdgeRatio) > 1e-9) errors.push({ code: 'RATIO_MISMATCH', message: 'qualification.typed_edge_ratio must match the declarative edges.', path: '$.qualification.typed_edge_ratio' });
  if (nativeMaterialRatio < 0.7) errors.push({ code: 'RATIO_MISMATCH', message: 'Native material ratio must be at least 0.70.', path: '$.qualification.native_material_ratio' });
  if (typedEdgeRatio < 0.6) errors.push({ code: 'RATIO_MISMATCH', message: 'Typed edge ratio must be at least 0.60.', path: '$.qualification.typed_edge_ratio' });
  const fixtureNames = Array.isArray(qualificationValue.fixtures) ? qualificationValue.fixtures : [];
  const exampleNames = Array.isArray(qualificationValue.examples) ? qualificationValue.examples : [];
  fixtureNames.forEach((entry, index) => requiredText(entry, `$.qualification.fixtures[${index}]`, errors, 180));
  exampleNames.forEach((entry, index) => requiredText(entry, `$.qualification.examples[${index}]`, errors, 180));
  const expectedCountsValue = isRecord(qualificationValue.expected_counts) ? qualificationValue.expected_counts : undefined;
  if (expectedCountsValue) ownKeys(expectedCountsValue, ['items', 'edges', 'native_materials', 'typed_edges'], '$.qualification.expected_counts', errors);
  const expectedCount = value.expected_count;
  if (!integer(expectedCount) || expectedCount !== items.length + edges.length) errors.push({ code: 'EXPECTED_COUNT_MISMATCH', message: 'expected_count must equal native items plus typed edges.', path: '$.expected_count' });
  if (expectedCountsValue && (expectedCountsValue.items !== items.length || expectedCountsValue.edges !== edges.length || expectedCountsValue.native_materials !== materials.filter((entry) => entry.kind === 'native').length || expectedCountsValue.typed_edges !== edges.length)) errors.push({ code: 'EXPECTED_COUNT_MISMATCH', message: 'qualification.expected_counts must match the declarative composition.', path: '$.qualification.expected_counts' });

  const recipe: CompositionRecipe = {
    id, version: 2, format: COMPOSITION_FORMAT, title, purpose, status: 'immutable', bounds, semantic, provenance: { source: 'fogwood', recipe_id: id, recipe_version: 2 }, expected_count: integer(expectedCount) ? expectedCount : items.length + edges.length, regions, materials, items, edges, placements, moves, adapters, aesthetics, algorithms, provocations, variants, source_notes: sourceNotes,
    qualification: {
      default_surface_blocks: 0,
      native_material_ratio: nativeMaterialRatio,
      typed_edge_ratio: typedEdgeRatio,
      deterministic_repeat: true,
      stable_ids: true,
      variant_preservation: qualificationValue.variant_preservation === true,
      edit_inspect_mutation: qualificationValue.edit_inspect_mutation === true,
      no_live_provider: true,
      fixtures: fixtureNames.filter((entry): entry is string => typeof entry === 'string').slice(0, 16),
      examples: exampleNames.filter((entry): entry is string => typeof entry === 'string').slice(0, 16),
      ...(expectedCountsValue ? { expected_counts: { items: items.length, edges: edges.length, native_materials: materials.filter((entry) => entry.kind === 'native').length, typed_edges: edges.length } } : {}),
    },
  };
  return errors.length > 0 ? { errors } : { recipe, errors: [] };
}

export function validateCompositionRecipe(value: unknown): CompositionValidation {
  const result = validateCompositionInternal(value);
  return result.recipe ? { ok: true, recipe: result.recipe } : { ok: false, errors: result.errors };
}

export function isCompositionRecipe(value: unknown): value is CompositionRecipe {
  return validateCompositionRecipe(value).ok;
}

export function compositionQualification(recipe: CompositionRecipe) {
  const native = recipe.materials.filter((material) => material.kind === 'native').length;
  const totalMaterials = recipe.materials.length;
  const typed = recipe.edges.filter((edge) => RELATIONSHIP_KINDS.includes(edge.kind)).length;
  const totalEdges = recipe.edges.length;
  const first = JSON.stringify(expandCompositionRecipe(recipe));
  const second = JSON.stringify(expandCompositionRecipe(recipe));
  return {
    default_surface_blocks: recipe.items.filter((item) => (item.kind as string) === 'surface-block').length,
    native_material_ratio: totalMaterials === 0 ? 0 : native / totalMaterials,
    typed_edge_ratio: totalEdges === 0 ? 0 : typed / totalEdges,
    deterministic_repeat: first === second,
    stable_ids: recipe.items.every((item) => ID_PATTERN.test(item.semantic_id)) && recipe.edges.every((edge) => ID_PATTERN.test(edge.id)),
    variant_preservation: recipe.variants.length === 0 || recipe.variants.every((variant) => Boolean(variant.lineage_source_id)),
    edit_inspect_mutation: recipe.qualification.edit_inspect_mutation === true,
    no_live_provider: recipe.qualification.no_live_provider === true && recipe.adapters.every((adapter) => adapter.locality === 'local'),
  } as const;
}

/** Expand deterministic placements into ordinary proposal actions. */
export function expandCompositionRecipe(recipe: CompositionRecipe, anchor: { x?: number; y?: number } = {}): CompositionOperation[] {
  const offsetX = finite(anchor.x) ? Math.max(-100_000, Math.min(100_000, anchor.x)) : 0;
  const offsetY = finite(anchor.y) ? Math.max(-100_000, Math.min(100_000, anchor.y)) : 0;
  const placements = new Map(recipe.placements.map((placement) => [placement.target_semantic_id, placement]));
  const shapes = recipe.items.map((item) => {
    const placement = placements.get(item.semantic_id);
    return {
      ...item,
      kind: item.kind,
      semantic_id: item.semantic_id,
      composition_id: recipe.id,
      x: (placement?.x ?? item.x) + offsetX,
      y: (placement?.y ?? item.y) + offsetY,
      ...(placement?.rotation === undefined ? {} : { rotation: placement.rotation }),
    };
  });
  const operations: CompositionOperation[] = [];
  for (let index = 0; index < shapes.length; index += 64) operations.push({ type: 'add_shapes', coordinate_space: 'page', shapes: shapes.slice(index, index + 64) });
  const relationships: SemanticRelationship[] = recipe.edges.map((edge) => ({ id: edge.id, kind: edge.kind, source_semantic_id: edge.source_semantic_id, target_semantic_id: edge.target_semantic_id, ...(edge.label ? { label: edge.label } : {}) }));
  for (let index = 0; index < relationships.length; index += 256) operations.push({ type: 'add_relationships', relationships: relationships.slice(index, index + 256) });
  return operations;
}

export const COMPOSITION_RELATIONSHIP_KINDS = RELATIONSHIP_KINDS;
export const COMPOSITION_MOVE_KINDS = MOVE_KINDS;
