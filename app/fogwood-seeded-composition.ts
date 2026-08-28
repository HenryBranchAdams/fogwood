/**
 * Pure deterministic seeded composition for Fogwood.
 *
 * Seeds influence only bounded generative geometry and style after the page,
 * targets, locks, and authority have already been resolved. This module has no
 * DOM, tldraw, storage, network, host-tool, or mutation dependency.
 */

// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
import { canonicalSerialize, sha256Hex } from './fogwood-identities.ts';
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
import { CANVAS_OP_COLORS, CANVAS_OP_FILLS, planCanvasOps } from './fogwood-canvas-ops.ts';
import type { CanvasOp, CanvasOpsAction } from './fogwood-canvas-ops.ts';

export const FOGWOOD_SEEDED_COMPOSITION = Object.freeze({
  schema: 'fogwood.seeded-composition.v1',
  grammar: 'remix',
  algorithm_version: 1,
  prng: 'xorshift32-v1',
  max_targets: 8,
  max_seed_length: 96,
  max_context_items: 5_000,
  max_coordinate: 100_000,
  min_dimension: 16,
  max_dimension: 5_000,
  max_variant_offset: 5_000,
  max_input_rotation: Math.PI * 4,
  max_rotation: Math.PI / 12,
  max_scale_delta: 0.2,
} as const);

export type SeedValue = string | number;

export type SeededCompositionScope =
  | { kind: 'selection' }
  | { kind: 'explicit'; semantic_ids: readonly string[] };

export type SeededCompositionRequest = {
  type: 'seeded_composition';
  scope: SeededCompositionScope;
  seed: SeedValue;
  wildness?: number;
};

export type SeededCompositionItem = {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  opacity?: number;
  index?: string;
  kind?: string;
  text?: string;
  binding_count?: number;
  parent_id?: string;
  is_locked?: boolean;
  semantic_id?: string;
  meta?: Record<string, unknown>;
  props?: Record<string, unknown>;
};

export type SeededCompositionContext = {
  current_revision: string;
  page_id?: string;
  items: readonly SeededCompositionItem[];
  selection_semantic_ids?: readonly string[];
  selection_complete?: boolean;
  selection_total?: number;
};

export type SeededLineage = {
  source_semantic_id: string;
  variant_semantic_id: string;
  lineage_source_id: string;
  parent_variant_id?: string;
  branch_index: number;
  depth: number;
};

export type NormalizedSeededCompositionAction = {
  type: 'seeded_composition';
  grammar: typeof FOGWOOD_SEEDED_COMPOSITION.grammar;
  algorithm_version: typeof FOGWOOD_SEEDED_COMPOSITION.algorithm_version;
  prng: typeof FOGWOOD_SEEDED_COMPOSITION.prng;
  source_revision: string;
  source_scope: 'selection' | 'explicit';
  source_fingerprint: string;
  seed: SeedValue;
  wildness: number;
  target_semantic_ids: readonly string[];
  layout: Readonly<{
    kind: 'branch-cluster';
    open_side: 'right' | 'bottom' | 'left' | 'top';
    branch_count: number;
    open_gap: number;
    rhythm: number;
  }>;
  lineage: readonly Readonly<SeededLineage>[];
  ops: readonly CanvasOp[];
};

export type SeededCompositionPlan = Readonly<{
  normalized_action: Readonly<NormalizedSeededCompositionAction>;
  canvas_action: Readonly<CanvasOpsAction>;
}>;

export type SeededCompositionError = Readonly<{
  code: string;
  message: string;
  path?: string;
}>;

export type SeededCompositionResult =
  | { ok: true; plan: SeededCompositionPlan }
  | { ok: false; errors: readonly SeededCompositionError[] };

const SUPPORTED_TYPES = new Set(['geo', 'note', 'text', 'image', 'draw']);
const COLOR_TYPES = new Set(['geo', 'note', 'text', 'draw']);
const FILL_TYPES = new Set(['geo', 'draw']);
const STABLE_SEMANTIC_ID = /^[A-Za-z0-9][A-Za-z0-9:._/-]{0,179}$/u;
const SIDES = ['right', 'bottom', 'left', 'top'] as const;
const TWO_TO_32 = 4_294_967_296;

class SeededCompositionPlanningError extends Error {
  readonly code: string;
  readonly path?: string;

  constructor(code: string, message: string, path?: string) {
    super(message);
    this.name = 'SeededCompositionPlanningError';
    this.code = code;
    this.path = path;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  const keys = new Set(allowed);
  return Object.keys(value).every((key) => keys.has(key));
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function compare(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function quantize(value: number) {
  return Math.round(value * 1_000) / 1_000;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

function normalizeSeed(value: unknown): { value: SeedValue; token: string } {
  if (typeof value === 'string') {
    if (value.trim().length < 1 || value.length > FOGWOOD_SEEDED_COMPOSITION.max_seed_length) {
      throw new SeededCompositionPlanningError('INVALID_SEED', `seed must contain 1-${FOGWOOD_SEEDED_COMPOSITION.max_seed_length} characters.`, 'seed');
    }
    return { value, token: `string:${value}` };
  }
  if (typeof value === 'number' && Number.isSafeInteger(value)) return { value, token: `integer:${value}` };
  throw new SeededCompositionPlanningError('INVALID_SEED', 'seed must be a bounded string or safe integer.', 'seed');
}

function normalizeWildness(value: unknown) {
  const wildness = value === undefined ? 0.5 : value;
  if (!finite(wildness) || wildness < 0 || wildness > 1) {
    throw new SeededCompositionPlanningError('INVALID_WILDNESS', 'wildness must be a finite number from 0 to 1.', 'wildness');
  }
  return quantize(wildness);
}

function hashCanonical(value: unknown) {
  return `sha256:${sha256Hex(canonicalSerialize(value))}`;
}

/** Independent deterministic streams keep output stable when target order changes. */
function unit(seedToken: string, sourceFingerprint: string, channel: string) {
  const digest = sha256Hex(canonicalSerialize([
    FOGWOOD_SEEDED_COMPOSITION.prng,
    FOGWOOD_SEEDED_COMPOSITION.algorithm_version,
    seedToken,
    sourceFingerprint,
    channel,
  ]));
  let state = Number.parseInt(digest.slice(0, 8), 16) >>> 0;
  if (state === 0) state = 0x6d2b79f5;
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return (state >>> 0) / TWO_TO_32;
}

function signedUnit(seedToken: string, sourceFingerprint: string, channel: string) {
  const candidate = unit(seedToken, sourceFingerprint, channel) * 2 - 1;
  if (Math.abs(candidate) >= 0.05) return candidate;
  return candidate < 0 ? -0.05 : 0.05;
}

function assertContextItem(item: SeededCompositionItem, index: number) {
  const path = `items[${index}]`;
  if (!isRecord(item) || typeof item.id !== 'string' || item.id.length < 1 || item.id.length > 220 || typeof item.type !== 'string') {
    throw new SeededCompositionPlanningError('INVALID_INPUT_STATE', `${path} must be a bounded canvas item.`, path);
  }
  for (const key of ['x', 'y', 'w', 'h'] as const) {
    if (!finite(item[key])) throw new SeededCompositionPlanningError('INVALID_INPUT_STATE', `${path}.${key} must be finite.`, `${path}.${key}`);
  }
  if (Math.abs(item.x) > FOGWOOD_SEEDED_COMPOSITION.max_coordinate || Math.abs(item.y) > FOGWOOD_SEEDED_COMPOSITION.max_coordinate) {
    throw new SeededCompositionPlanningError('INVALID_INPUT_STATE', `${path} exceeds the page coordinate bound.`, path);
  }
  if (item.w < FOGWOOD_SEEDED_COMPOSITION.min_dimension || item.h < FOGWOOD_SEEDED_COMPOSITION.min_dimension || item.w > FOGWOOD_SEEDED_COMPOSITION.max_dimension || item.h > FOGWOOD_SEEDED_COMPOSITION.max_dimension) {
    throw new SeededCompositionPlanningError('INVALID_INPUT_STATE', `${path} exceeds the dimension bound.`, path);
  }
  if (item.rotation !== undefined && (!finite(item.rotation) || Math.abs(item.rotation) > FOGWOOD_SEEDED_COMPOSITION.max_input_rotation)) {
    throw new SeededCompositionPlanningError('INVALID_INPUT_STATE', `${path}.rotation must be finite and bounded.`, `${path}.rotation`);
  }
  if (item.x + item.w > FOGWOOD_SEEDED_COMPOSITION.max_coordinate || item.y + item.h > FOGWOOD_SEEDED_COMPOSITION.max_coordinate) {
    throw new SeededCompositionPlanningError('INVALID_INPUT_STATE', `${path} exceeds the page footprint bound.`, path);
  }
}

function boundedScopeIds(value: unknown, path: string) {
  if (!Array.isArray(value)) throw new SeededCompositionPlanningError('INVALID_SCOPE', `${path} must be an array.`, path);
  if (value.length < 1 || value.length > FOGWOOD_SEEDED_COMPOSITION.max_targets) {
    throw new SeededCompositionPlanningError('INVALID_TARGET_COUNT', `seeded composition needs 1-${FOGWOOD_SEEDED_COMPOSITION.max_targets} targets.`, path);
  }
  const ids: unknown[] = [];
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) throw new SeededCompositionPlanningError('INVALID_SCOPE', 'Seeded composition target arrays cannot contain holes.', `${path}[${index}]`);
    ids.push(value[index]);
  }
  return ids;
}

function resolveTargetIds(context: SeededCompositionContext, request: SeededCompositionRequest) {
  if (!isRecord(request.scope) || !hasOnlyKeys(request.scope, ['kind', 'semantic_ids'])) {
    throw new SeededCompositionPlanningError('INVALID_SCOPE', 'scope must be selection or explicit semantic_ids.', 'scope');
  }
  if (request.scope.kind === 'selection') {
    if ('semantic_ids' in request.scope) throw new SeededCompositionPlanningError('INVALID_SCOPE', 'selection scope cannot include semantic_ids.', 'scope.semantic_ids');
    const selection = context.selection_semantic_ids;
    const selectionLength = Array.isArray(selection) ? selection.length : 0;
    if (context.selection_complete !== true || (context.selection_total ?? selectionLength) !== selectionLength) {
      throw new SeededCompositionPlanningError('INCOMPLETE_SELECTION', 'Selection must be completely inspected before seeded composition.', 'scope');
    }
    return { sourceScope: 'selection' as const, ids: boundedScopeIds(selection ?? [], 'scope') };
  }
  if (request.scope.kind === 'explicit' && Array.isArray(request.scope.semantic_ids)) {
    return { sourceScope: 'explicit' as const, ids: boundedScopeIds(request.scope.semantic_ids, 'scope.semantic_ids') };
  }
  throw new SeededCompositionPlanningError('INVALID_SCOPE', 'scope must be selection or explicit semantic_ids.', 'scope');
}

type AxisAlignedBounds = { minX: number; minY: number; maxX: number; maxY: number };

function rotatedBounds(item: Pick<SeededCompositionItem, 'x' | 'y' | 'w' | 'h' | 'rotation'>): AxisAlignedBounds {
  const rotation = item.rotation ?? 0;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const points = [
    { x: 0, y: 0 },
    { x: item.w, y: 0 },
    { x: 0, y: item.h },
    { x: item.w, y: item.h },
  ].map((point) => ({
    x: item.x + point.x * cos - point.y * sin,
    y: item.y + point.x * sin + point.y * cos,
  }));
  return {
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

function pageBounds(items: readonly SeededCompositionItem[]) {
  const footprints = items.map(rotatedBounds);
  const minX = Math.min(...footprints.map((item) => item.minX));
  const minY = Math.min(...footprints.map((item) => item.minY));
  const maxX = Math.max(...footprints.map((item) => item.maxX));
  const maxY = Math.max(...footprints.map((item) => item.maxY));
  return { minX, minY, maxX, maxY, centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2 };
}

function sourceProjection(item: SeededCompositionItem) {
  return {
    id: item.id,
    semantic_id: item.semantic_id,
    type: item.type,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    rotation: item.rotation ?? 0,
    parent_id: item.parent_id ?? null,
    is_locked: item.is_locked === true,
    semantic_id_source: item.meta?.semantic_id_source ?? null,
    variant_id: typeof item.meta?.variant_id === 'string' ? item.meta.variant_id : null,
    opacity: item.opacity ?? null,
    index: item.index ?? null,
    kind: item.kind ?? null,
    text: item.text ?? null,
    binding_count: item.binding_count ?? 0,
    props: item.props ?? null,
    meta: item.meta ?? null,
  };
}

function obstacleProjection(item: SeededCompositionItem) {
  return {
    id: item.id,
    semantic_id: item.semantic_id ?? null,
    type: item.type,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    rotation: item.rotation ?? 0,
    parent_id: item.parent_id ?? null,
    is_locked: item.is_locked === true,
  };
}

type Placement = {
  item: SeededCompositionItem;
  x: number;
  y: number;
  branch: number;
  depth: number;
};

function placementsForSide(
  side: (typeof SIDES)[number],
  targets: readonly SeededCompositionItem[],
  bounds: ReturnType<typeof pageBounds>,
  seedToken: string,
  sourceFingerprint: string,
  wildness: number,
  branchCount: number,
  gap: number,
  rhythm: number,
) {
  const maxW = Math.max(...targets.map((item) => item.w));
  const maxH = Math.max(...targets.map((item) => item.h));
  const jitterLimit = Math.min(36, gap / 3) * wildness;
  const placements: Placement[] = [];
  for (const [index, item] of targets.entries()) {
    const branch = index % branchCount;
    const depth = Math.floor(index / branchCount);
    const crossIndex = branch - (branchCount - 1) / 2;
    const jitter = signedUnit(seedToken, sourceFingerprint, `jitter:${side}:${item.semantic_id}`) * jitterLimit;
    let x: number;
    let y: number;
    if (side === 'right' || side === 'left') {
      const outward = depth * (maxW + gap * rhythm);
      x = side === 'right' ? bounds.maxX + gap + outward : bounds.minX - gap - outward - item.w;
      y = bounds.centerY + crossIndex * (maxH + gap) + jitter - item.h / 2;
    } else {
      const outward = depth * (maxH + gap * rhythm);
      y = side === 'bottom' ? bounds.maxY + gap + outward : bounds.minY - gap - outward - item.h;
      x = bounds.centerX + crossIndex * (maxW + gap) + jitter - item.w / 2;
    }
    placements.push({ item, x: quantize(x), y: quantize(y), branch, depth });
  }
  return placements;
}

function boundsOverlap(left: AxisAlignedBounds, right: AxisAlignedBounds) {
  return left.minX < right.maxX && left.maxX > right.minX && left.minY < right.maxY && left.maxY > right.minY;
}

type VariantGeometry = { w: number; h: number; rotation: number; bounds: AxisAlignedBounds };

function placementIsBounded(placement: Placement, geometry: VariantGeometry) {
  const offsetX = placement.x - placement.item.x;
  const offsetY = placement.y - placement.item.y;
  return Math.abs(offsetX) <= FOGWOOD_SEEDED_COMPOSITION.max_variant_offset
    && Math.abs(offsetY) <= FOGWOOD_SEEDED_COMPOSITION.max_variant_offset
    && geometry.bounds.minX >= -FOGWOOD_SEEDED_COMPOSITION.max_coordinate
    && geometry.bounds.minY >= -FOGWOOD_SEEDED_COMPOSITION.max_coordinate
    && geometry.bounds.maxX <= FOGWOOD_SEEDED_COMPOSITION.max_coordinate
    && geometry.bounds.maxY <= FOGWOOD_SEEDED_COMPOSITION.max_coordinate
    && !(offsetX === 0 && offsetY === 0);
}

function nextPaletteValue(current: unknown, values: readonly string[], randomValue: number) {
  const candidates = values.filter((value) => value !== current);
  return candidates[Math.min(candidates.length - 1, Math.floor(randomValue * candidates.length))];
}

function variantSemanticId(sourceFingerprint: string, sourceSemanticId: string) {
  const digest = sha256Hex(canonicalSerialize([
    FOGWOOD_SEEDED_COMPOSITION.schema,
    FOGWOOD_SEEDED_COMPOSITION.algorithm_version,
    sourceFingerprint,
    sourceSemanticId,
    'preserved-variant',
  ]));
  return `variant:seeded:${digest.slice(0, 24)}`;
}

function scaleFor(item: SeededCompositionItem, seedToken: string, sourceFingerprint: string, wildness: number) {
  if (wildness === 0 || item.type === 'note') return 1;
  const signed = signedUnit(seedToken, sourceFingerprint, `scale:${item.semantic_id}`);
  const desired = 1 + signed * FOGWOOD_SEEDED_COMPOSITION.max_scale_delta * wildness;
  const minimum = 1 - FOGWOOD_SEEDED_COMPOSITION.max_scale_delta * wildness;
  const maximum = Math.min(FOGWOOD_SEEDED_COMPOSITION.max_dimension / item.w, FOGWOOD_SEEDED_COMPOSITION.max_dimension / item.h);
  return Math.max(minimum, Math.min(maximum, desired));
}

function geometryForPlacement(placement: Placement, seedToken: string, sourceFingerprint: string, wildness: number): VariantGeometry {
  const scale = scaleFor(placement.item, seedToken, sourceFingerprint, wildness);
  const w = quantize(placement.item.w * scale);
  const h = quantize(placement.item.h * scale);
  const rotation = wildness === 0
    ? 0
    : quantize(signedUnit(seedToken, sourceFingerprint, `rotation:${placement.item.semantic_id}`) * FOGWOOD_SEEDED_COMPOSITION.max_rotation * wildness);
  const finalRotation = rotation === 0 && wildness > 0 ? 0.001 : rotation;
  return {
    w,
    h,
    rotation: finalRotation,
    bounds: rotatedBounds({ x: placement.x, y: placement.y, w, h, rotation: finalRotation }),
  };
}

function normalizedRequest(value: unknown): SeededCompositionRequest {
  if (!isRecord(value) || !hasOnlyKeys(value, ['type', 'scope', 'seed', 'wildness']) || value.type !== 'seeded_composition') {
    throw new SeededCompositionPlanningError('INVALID_ACTION', 'seeded_composition accepts only scope, seed, and optional wildness.', 'type');
  }
  return value as SeededCompositionRequest;
}

/**
 * Compile one reproducible preserved-variant composition. The result is data
 * only; the existing proposal lifecycle remains the sole mutation authority.
 */
export function planSeededComposition(context: SeededCompositionContext, rawRequest: unknown): SeededCompositionResult {
  try {
    const request = normalizedRequest(rawRequest);
    if (!isRecord(context) || typeof context.current_revision !== 'string' || context.current_revision.length < 1 || context.current_revision.length > 120) {
      throw new SeededCompositionPlanningError('INVALID_INPUT_STATE', 'current_revision must be a bounded non-empty string.', 'current_revision');
    }
    if (!Array.isArray(context.items) || context.items.length < 1 || context.items.length > FOGWOOD_SEEDED_COMPOSITION.max_context_items) {
      throw new SeededCompositionPlanningError('INVALID_INPUT_STATE', `items must contain 1-${FOGWOOD_SEEDED_COMPOSITION.max_context_items} bounded page records.`, 'items');
    }
    for (let index = 0; index < context.items.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(context.items, index)) throw new SeededCompositionPlanningError('INVALID_INPUT_STATE', 'items cannot contain holes.', `items[${index}]`);
      assertContextItem(context.items[index], index);
    }
    const pageId = typeof context.page_id === 'string' && context.page_id.length > 0 ? context.page_id : 'page:main';
    const seed = normalizeSeed(request.seed);
    const wildness = normalizeWildness(request.wildness);
    const scope = resolveTargetIds(context, request);
    if (scope.ids.length < 1 || scope.ids.length > FOGWOOD_SEEDED_COMPOSITION.max_targets) {
      throw new SeededCompositionPlanningError('INVALID_TARGET_COUNT', `seeded composition needs 1-${FOGWOOD_SEEDED_COMPOSITION.max_targets} targets.`, 'scope');
    }
    if (scope.ids.some((id) => typeof id !== 'string' || !STABLE_SEMANTIC_ID.test(id))) {
      throw new SeededCompositionPlanningError('UNSTABLE_TARGET', 'Every target must use a lexical stable semantic id.', 'scope');
    }
    if (new Set(scope.ids).size !== scope.ids.length) throw new SeededCompositionPlanningError('DUPLICATE_TARGET', 'Seeded composition targets must be unique.', 'scope');
    const nativeIds = new Set<string>();
    for (const item of context.items) {
      if (nativeIds.has(item.id)) throw new SeededCompositionPlanningError('DUPLICATE_ITEM_ID', 'The current page contains duplicate native shape ids.', 'items');
      nativeIds.add(item.id);
    }
    const semanticCounts = new Map<string, number>();
    for (const item of context.items) {
      if (typeof item.semantic_id === 'string') semanticCounts.set(item.semantic_id, (semanticCounts.get(item.semantic_id) ?? 0) + 1);
    }
    if ([...semanticCounts.values()].some((count) => count > 1)) throw new SeededCompositionPlanningError('DUPLICATE_SEMANTIC_ID', 'The current page contains duplicate semantic ids.', 'items');
    const bySemantic = new Map(context.items.flatMap((item) => typeof item.semantic_id === 'string' ? [[item.semantic_id, item] as const] : []));
    const byId = new Map(context.items.map((item) => [item.id, item]));
    const targetIds = [...scope.ids] as string[];
    targetIds.sort(compare);
    const targets = targetIds.map((semanticId, index) => {
      const target = bySemantic.get(semanticId);
      if (!target) throw new SeededCompositionPlanningError('UNKNOWN_TARGET', `Unknown semantic target ${semanticId}.`, `scope[${index}]`);
      if (target.meta?.semantic_id_source !== 'stable') throw new SeededCompositionPlanningError('UNSTABLE_TARGET', `Target ${semanticId} does not carry a stable semantic identity.`, `scope[${index}]`);
      if (target.parent_id !== pageId) throw new SeededCompositionPlanningError('NESTED_TARGET', `Target ${semanticId} is not a direct page child.`, `scope[${index}]`);
      const visited = new Set<string>();
      let current: SeededCompositionItem | undefined = target;
      while (current) {
        if (visited.has(current.id)) throw new SeededCompositionPlanningError('INVALID_INPUT_STATE', 'The parent chain contains a cycle.', `scope[${index}]`);
        visited.add(current.id);
        if (current.is_locked === true) throw new SeededCompositionPlanningError('LOCKED_TARGET', `Target ${semanticId} is locked or under a locked ancestor.`, `scope[${index}]`);
        current = current.parent_id && current.parent_id !== pageId ? byId.get(current.parent_id) : undefined;
      }
      if (Math.abs(target.rotation ?? 0) > 1e-9) throw new SeededCompositionPlanningError('ROTATED_TARGET', `Target ${semanticId} must be unrotated before creating an axis-aligned variant.`, `scope[${index}]`);
      if (!SUPPORTED_TYPES.has(target.type)) throw new SeededCompositionPlanningError('UNSUPPORTED_TARGET', `Target ${semanticId} has unsupported native type ${target.type}.`, `scope[${index}]`);
      return target;
    });
    const orderedObstacles = [...context.items].sort((left, right) => compare(`${left.semantic_id ?? ''}|${left.id}`, `${right.semantic_id ?? ''}|${right.id}`));
    const sourceFingerprint = hashCanonical({
      schema: FOGWOOD_SEEDED_COMPOSITION.schema,
      algorithm_version: FOGWOOD_SEEDED_COMPOSITION.algorithm_version,
      source_revision: context.current_revision,
      source_scope: scope.sourceScope,
      page_id: pageId,
      targets: targets.map(sourceProjection),
      obstacles: orderedObstacles.map(obstacleProjection),
    });
    const branchLimit = Math.min(3, targets.length);
    const branchCount = wildness === 0 ? 1 : 1 + Math.floor(unit(seed.token, sourceFingerprint, 'branch-count') * branchLimit);
    const gap = quantize(96 + wildness * (32 + unit(seed.token, sourceFingerprint, 'open-gap') * 144));
    const rhythm = quantize(1 + signedUnit(seed.token, sourceFingerprint, 'rhythm') * 0.35 * wildness);
    const bounds = pageBounds(context.items);
    const obstacleBounds = context.items.map(rotatedBounds);
    const candidates = SIDES.flatMap((side) => {
      const placements = placementsForSide(side, targets, bounds, seed.token, sourceFingerprint, wildness, branchCount, gap, rhythm);
      const geometries = placements.map((placement) => geometryForPlacement(placement, seed.token, sourceFingerprint, wildness));
      const bounded = placements.every((placement, index) => placementIsBounded(placement, geometries[index]));
      const collisionFree = geometries.every((geometry, index) =>
        obstacleBounds.every((obstacle) => !boundsOverlap(geometry.bounds, obstacle))
        && geometries.slice(0, index).every((prior) => !boundsOverlap(geometry.bounds, prior.bounds)));
      return bounded && collisionFree ? [{ side, placements, geometries }] : [];
    });
    if (candidates.length < 1) throw new SeededCompositionPlanningError('OPEN_SPACE_UNAVAILABLE', 'No bounded open-space side can preserve every selected source.', 'scope');
    const candidateIndex = Math.min(candidates.length - 1, Math.floor(unit(seed.token, sourceFingerprint, 'open-side') * candidates.length));
    const chosen = candidates[candidateIndex];
    const ops: CanvasOp[] = [];
    const lineage: SeededLineage[] = [];
    for (const [placementIndex, placement] of chosen.placements.entries()) {
      const geometry = chosen.geometries[placementIndex];
      const sourceSemanticId = placement.item.semantic_id as string;
      const semanticId = variantSemanticId(sourceFingerprint, sourceSemanticId);
      const reference = `semantic:${semanticId}`;
      ops.push({
        op: 'variant',
        id: placement.item.id,
        semantic_id: semanticId,
        offset_x: quantize(placement.x - placement.item.x),
        offset_y: quantize(placement.y - placement.item.y),
      });
      const nextW = geometry.w;
      const nextH = geometry.h;
      if (placement.item.type !== 'note' && (nextW !== placement.item.w || nextH !== placement.item.h)) {
        ops.push({ op: 'resize', id: reference, w: nextW, h: nextH });
      }
      const update: Extract<CanvasOp, { op: 'update' }> = { op: 'update', id: reference };
      if (wildness > 0) {
        update.rotation = geometry.rotation;
      }
      if (wildness >= 0.2 && COLOR_TYPES.has(placement.item.type)) {
        update.color = nextPaletteValue(placement.item.props?.color, CANVAS_OP_COLORS, unit(seed.token, sourceFingerprint, `color:${sourceSemanticId}`)) as (typeof CANVAS_OP_COLORS)[number];
      }
      if (wildness >= 0.5 && FILL_TYPES.has(placement.item.type)) {
        update.fill = nextPaletteValue(placement.item.props?.fill, CANVAS_OP_FILLS, unit(seed.token, sourceFingerprint, `fill:${sourceSemanticId}`)) as (typeof CANVAS_OP_FILLS)[number];
      }
      if (Object.keys(update).length > 2) ops.push(update);
      lineage.push({
        source_semantic_id: sourceSemanticId,
        variant_semantic_id: semanticId,
        lineage_source_id: sourceSemanticId,
        ...(typeof placement.item.meta?.variant_id === 'string' ? { parent_variant_id: placement.item.meta.variant_id } : {}),
        branch_index: placement.branch,
        depth: placement.depth,
      });
    }
    const normalizedAction: NormalizedSeededCompositionAction = {
      type: 'seeded_composition',
      grammar: FOGWOOD_SEEDED_COMPOSITION.grammar,
      algorithm_version: FOGWOOD_SEEDED_COMPOSITION.algorithm_version,
      prng: FOGWOOD_SEEDED_COMPOSITION.prng,
      source_revision: context.current_revision,
      source_scope: scope.sourceScope,
      source_fingerprint: sourceFingerprint,
      seed: seed.value,
      wildness,
      target_semantic_ids: targetIds,
      layout: { kind: 'branch-cluster', open_side: chosen.side, branch_count: branchCount, open_gap: gap, rhythm },
      lineage,
      ops,
    };
    const canvasPlan = planCanvasOps(context.items, ops, pageId);
    if (!canvasPlan.ok) {
      const first = canvasPlan.errors[0];
      throw new SeededCompositionPlanningError(first?.code ?? 'INVALID_CANVAS_PLAN', first?.message ?? 'The seeded composition exceeds the bounded native canvas protocol.', first?.path);
    }
    return {
      ok: true,
      plan: deepFreeze({
        normalized_action: normalizedAction,
        canvas_action: { type: 'canvas_ops', ops },
      }),
    };
  } catch (error) {
    if (error instanceof SeededCompositionPlanningError) {
      return { ok: false, errors: deepFreeze([{ code: error.code, message: error.message, ...(error.path ? { path: error.path } : {}) }]) };
    }
    return { ok: false, errors: deepFreeze([{ code: 'INVALID_INPUT_STATE', message: 'Seeded composition could not inspect a bounded data-only input state.' }]) };
  }
}
