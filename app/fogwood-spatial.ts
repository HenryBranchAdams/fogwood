/**
 * Pure spatial grammar for Fogwood.
 *
 * This module intentionally has no DOM, tldraw, storage, or network imports.
 * It resolves semantic targets at proposal stage and emits deterministic,
 * bounded plans. The page adapter is responsible for projecting the plan onto
 * native tldraw shapes in one human-authorized transaction.
 */

export const SPATIAL_LIMITS = Object.freeze({
  max_moves_per_action: 8,
  max_targets_per_move: 128,
  max_relationships: 256,
  max_iterations: 2_048,
  max_coordinate: 100_000,
  max_text: 500,
  max_label: 500,
  max_path_points: 128,
  max_columns: 32,
  max_gap: 10_000,
});

export const SPATIAL_MOVE_KINDS = [
  'scatter',
  'cluster',
  'branch',
  'orbit',
  'montage',
  'trace',
  'annotate',
  'mutate',
] as const;

export const SEMANTIC_RELATIONSHIP_KINDS = [
  'supports',
  'contradicts',
  'depends_on',
  'causes',
  'blocks',
  'echoes',
  'mutates_into',
] as const;

export const SPATIAL_PATCH_COLORS = ['black', 'grey', 'violet', 'blue', 'light-blue', 'yellow', 'orange', 'green', 'light-green', 'light-red', 'red', 'white'] as const;
export const SPATIAL_PATCH_FILLS = ['none', 'semi', 'solid', 'pattern'] as const;

export type SpatialMoveKind = (typeof SPATIAL_MOVE_KINDS)[number];
export type SemanticRelationshipKind = (typeof SEMANTIC_RELATIONSHIP_KINDS)[number];

export type SpatialBounds = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type SpatialItem = {
  id: string;
  semantic_id?: string;
  type: string;
  kind?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  parent_id?: string;
  is_locked?: boolean;
  semantic_id_source?: string;
  meta?: Record<string, unknown>;
  props?: Record<string, unknown>;
};

export type SpatialRegion = SpatialBounds & {
  id: string;
  semantic_id?: string;
  label?: string;
};

export type SemanticRelationship = {
  id: string;
  kind: SemanticRelationshipKind;
  source_semantic_id: string;
  target_semantic_id: string;
  label?: string;
  shape_id?: string;
};

export type SpatialContext = {
  page_id?: string;
  items: readonly SpatialItem[];
  selection_semantic_ids?: readonly string[];
  selection_complete?: boolean;
  selection_total?: number;
  regions?: readonly SpatialRegion[];
  semantic_relationships?: readonly SemanticRelationship[];
};

export type SpatialScope =
  | { kind: 'selection' }
  | { kind: 'explicit'; semantic_ids: readonly string[] }
  | { kind: 'region'; region_id: string };

export type SpatialMoveInput = {
  kind: SpatialMoveKind;
  move?: SpatialMoveKind;
  scope?: SpatialScope;
  target?: SpatialScope | readonly string[] | Record<string, unknown>;
  targets?: readonly string[] | Record<string, unknown>;
  semantic_ids?: readonly string[];
  target_semantic_ids?: readonly string[];
  region?: SpatialBounds;
  seed?: string | number;
  spacing?: number;
  anchor?: { x: number; y: number } | string;
  center?: { x: number; y: number } | string;
  radius?: number;
  links?: readonly { parent_semantic_id: string; child_semantic_id: string }[];
  parent_child_links?: readonly { parent_semantic_id: string; child_semantic_id: string }[];
  columns?: number;
  gap_x?: number;
  gap_y?: number;
  path?: readonly { x: number; y: number }[];
  text?: string;
  offset?: { x: number; y: number };
  patches?: { text?: string; color?: string; fill?: string };
};

const SPATIAL_MOVE_KEYS = [
  'kind', 'move', 'scope', 'target', 'targets', 'semantic_ids', 'target_semantic_ids', 'region', 'seed', 'spacing',
  'anchor', 'center', 'radius', 'links', 'parent_child_links', 'columns', 'gap_x', 'gap_y', 'path', 'text',
  'offset', 'patches',
] as const;

export type SpatialMoveAction = {
  type: 'apply_spatial_moves';
  moves: readonly SpatialMoveInput[];
};

export type AddRelationshipsAction = {
  type: 'add_relationships';
  relationships: readonly SemanticRelationship[];
};

export type SpatialPosition = {
  x: number;
  y: number;
  rotation: number;
};

export type SpatialMovePlan = {
  move_index: number;
  kind: SpatialMoveKind;
  semantic_id: string;
  shape_id: string;
  before: SpatialPosition;
  after: SpatialPosition;
};

export type SpatialCreatePlan = {
  move_index: number;
  kind: 'annotation' | 'variant';
  semantic_id: string;
  shape_id?: string;
  source_semantic_id?: string;
  source_shape_id?: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  offset?: { x: number; y: number };
  patches?: { text?: string; color?: string; fill?: string };
  lineage_source_id?: string;
  parent_variant_id?: string;
  variant_id?: string;
};

export type SpatialPlan = {
  moves: readonly SpatialMovePlan[];
  creates: readonly SpatialCreatePlan[];
  resolved_scopes: readonly { move_index: number; scope: 'selection' | 'explicit' | 'region'; semantic_ids: readonly string[] }[];
};

export type RelationshipPlan = {
  relationships: readonly SemanticRelationship[];
};

export type SpatialErrorCode =
  | 'INVALID_ACTION'
  | 'INVALID_MOVE_COUNT'
  | 'INVALID_TARGET_COUNT'
  | 'INVALID_SCOPE'
  | 'UNKNOWN_TARGET'
  | 'DUPLICATE_TARGET'
  | 'LOCKED_TARGET'
  | 'NESTED_TARGET'
  | 'INVALID_BOUNDS'
  | 'INVALID_NUMBER'
  | 'NO_OP'
  | 'UNKNOWN_REGION'
  | 'INVALID_BRANCH'
  | 'BRANCH_CYCLE'
  | 'BRANCH_MULTIPLE_PARENTS'
  | 'INVALID_PATH'
  | 'SPACING_UNSATISFIABLE'
  | 'INVALID_TEXT'
  | 'INVALID_PATCH'
  | 'UNSUPPORTED_VARIANT'
  | 'DUPLICATE_SEMANTIC_ID'
  | 'INVALID_RELATIONSHIP_COUNT'
  | 'INVALID_RELATIONSHIP'
  | 'DUPLICATE_RELATIONSHIP_ID'
  | 'SELF_RELATIONSHIP';

export class SpatialPlanningError extends Error {
  readonly code: SpatialErrorCode;
  readonly path?: string;

  constructor(code: SpatialErrorCode, message: string, path?: string) {
    super(message);
    this.name = 'SpatialPlanningError';
    this.code = code;
    this.path = path;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function boundedCoordinate(value: unknown, path: string) {
  if (!finite(value) || Math.abs(value) > SPATIAL_LIMITS.max_coordinate) {
    throw new SpatialPlanningError('INVALID_NUMBER', `Coordinate ${path} must be finite and within ±${SPATIAL_LIMITS.max_coordinate}.`, path);
  }
  return value;
}

function boundedPositive(value: unknown, path: string, fallback?: number) {
  if (value === undefined && fallback !== undefined) return fallback;
  if (!finite(value) || value <= 0 || value > SPATIAL_LIMITS.max_coordinate) {
    throw new SpatialPlanningError('INVALID_NUMBER', `${path} must be a positive finite bounded number.`, path);
  }
  return value;
}

function boundedGap(value: unknown, path: string, fallback: number) {
  if (value === undefined) return fallback;
  if (!finite(value) || value < 0 || value > SPATIAL_LIMITS.max_gap) {
    throw new SpatialPlanningError('INVALID_NUMBER', `${path} must be a finite gap from 0 to ${SPATIAL_LIMITS.max_gap}.`, path);
  }
  return value;
}

function boundedString(value: unknown, path: string, limit: number = SPATIAL_LIMITS.max_text, required = false) {
  if (typeof value !== 'string' || (required && value.length === 0) || value.length > limit) {
    throw new SpatialPlanningError('INVALID_TEXT', `${path} must be a bounded string of at most ${limit} characters.`, path);
  }
  return value;
}

/** Stable semantic IDs are lexical, portable, and never tldraw record IDs. */
export function isStableSemanticId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9:._/-]{0,179}$/u.test(value);
}

export function assertStableSemanticId(value: unknown, path = 'semantic_id') {
  if (!isStableSemanticId(value)) {
    throw new SpatialPlanningError('INVALID_RELATIONSHIP', `${path} must be a lexical stable semantic id.`, path);
  }
  return value;
}

function fnv1a(value: string, seed: number) {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function hash(value: string) {
  return `${fnv1a(value, 0x811c9dc5).toString(16).padStart(8, '0')}${fnv1a(`fogwood|${value}`, 0x9e3779b9).toString(16).padStart(8, '0')}`;
}

export function stableSemanticId(prefix: string, ...parts: readonly unknown[]) {
  const safePrefix = String(prefix).replace(/[^A-Za-z0-9:._/-]/gu, '-').replace(/^[^A-Za-z0-9]+/u, '').slice(0, 80) || 'semantic';
  return `${safePrefix}:${hash(parts.map((part) => String(part)).join('|'))}`.slice(0, 180);
}

export const semanticIdFor = stableSemanticId;

/** Stable semantic ID for a visible relationship arrow. */
export function relationshipSemanticId(relationshipId: string) {
  const readable = `relationship:${relationshipId}`;
  return readable.length <= 180 ? readable : stableSemanticId('relationship', relationshipId);
}

function compare(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function itemSemanticId(item: SpatialItem) {
  return typeof item.semantic_id === 'string' && item.semantic_id.length > 0 ? item.semantic_id : undefined;
}

function assertDurableSemanticTarget(item: SpatialItem, path: string) {
  const source = item.semantic_id_source ?? item.meta?.semantic_id_source;
  if (source === 'legacy-shape-id') {
    throw new SpatialPlanningError('INVALID_SCOPE', `Target ${item.semantic_id} has a legacy compatibility identity; spatial targets require a stable semantic id.`, path);
  }
}

function itemMap(context: SpatialContext) {
  const bySemantic = new Map<string, SpatialItem>();
  for (const item of context.items) {
    const semanticId = itemSemanticId(item);
    if (!semanticId) continue;
    if (bySemantic.has(semanticId)) throw new SpatialPlanningError('DUPLICATE_SEMANTIC_ID', `Live page contains duplicate semantic id ${semanticId}.`);
    bySemantic.set(semanticId, item);
  }
  return bySemantic;
}

function allAncestors(itemId: string, context: SpatialContext) {
  const byId = new Map(context.items.map((item) => [item.id, item]));
  const result: SpatialItem[] = [];
  const seen = new Set<string>();
  let parentId = byId.get(itemId)?.parent_id;
  while (typeof parentId === 'string' && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) break;
    result.push(parent);
    parentId = parent.parent_id;
  }
  return result;
}

function assertTarget(item: SpatialItem, context: SpatialContext, path: string) {
  if (item.is_locked === true || allAncestors(item.id, context).some((ancestor) => ancestor.is_locked === true)) {
    throw new SpatialPlanningError('LOCKED_TARGET', `Target ${item.semantic_id} is locked or under a locked ancestor.`, path);
  }
  const pageId = context.page_id ?? 'page:main';
  if (item.parent_id && item.parent_id !== pageId) {
    throw new SpatialPlanningError('NESTED_TARGET', `Target ${item.semantic_id} is nested under ${item.parent_id}; spatial plans require page coordinates.`, path);
  }
}

function scopeFromMove(move: SpatialMoveInput): { scope: SpatialScope; declared: 'selection' | 'explicit' | 'region' } {
  const candidate = move.scope ?? (isRecord(move.targets) ? move.targets : move.target);
  const candidateRecord = isRecord(candidate) ? candidate as Record<string, unknown> : undefined;
  if (candidateRecord && (typeof candidateRecord.kind === 'string' || typeof candidateRecord.scope === 'string')) {
    if (Object.keys(candidateRecord).some((key) => !['kind', 'scope', 'semantic_ids', 'ids', 'region_id'].includes(key))) {
      throw new SpatialPlanningError('INVALID_SCOPE', 'Spatial scope contains an unknown field.');
    }
    const scopeKind = (candidateRecord.kind ?? candidateRecord.scope) as string;
    if (scopeKind === 'selection') return { scope: { kind: 'selection' }, declared: 'selection' };
    if (scopeKind === 'region' && typeof candidateRecord.region_id === 'string') return { scope: { kind: 'region', region_id: candidateRecord.region_id }, declared: 'region' };
    const candidateIds = candidateRecord.semantic_ids ?? candidateRecord.ids;
    if (scopeKind === 'explicit' && Array.isArray(candidateIds) && candidateIds.every((value) => typeof value === 'string')) return { scope: { kind: 'explicit', semantic_ids: candidateIds }, declared: 'explicit' };
    throw new SpatialPlanningError('INVALID_SCOPE', 'Spatial scope must be selection, explicit semantic_ids, or region region_id.');
  }
  const ids = Array.isArray(move.target_semantic_ids)
    ? move.target_semantic_ids
    : Array.isArray(move.semantic_ids)
      ? move.semantic_ids
      : Array.isArray(move.targets)
        ? move.targets
        : Array.isArray(candidate)
          ? candidate
          : undefined;
  if (!ids) throw new SpatialPlanningError('INVALID_SCOPE', 'Each spatial move needs an explicit, selection, or region scope.');
  return { scope: { kind: 'explicit', semantic_ids: ids }, declared: 'explicit' };
}

/** Resolve selection/region scopes once, producing immutable semantic IDs. */
export function resolveSpatialScope(context: SpatialContext, scope: SpatialScope) {
  const bySemantic = itemMap(context);
  let ids: readonly string[];
  if (scope.kind === 'selection') {
    if (context.selection_complete === false) {
      throw new SpatialPlanningError('INVALID_TARGET_COUNT', `Selection contains ${context.selection_total ?? 'more than the inspect limit'} items; use an explicit bounded scope instead.`);
    }
    ids = context.selection_semantic_ids ?? [];
  } else if (scope.kind === 'explicit') {
    ids = scope.semantic_ids;
  } else {
    const region = context.regions?.find((candidate) => candidate.id === scope.region_id || candidate.semantic_id === scope.region_id);
    if (!region) {
      // Region metadata on page items is itself sufficient for a bounded page
      // context, so callers need not duplicate region records.
      ids = context.items.flatMap((item) => item.meta?.region_id === scope.region_id && itemSemanticId(item) ? [itemSemanticId(item) as string] : []);
      if (ids.length === 0) throw new SpatialPlanningError('UNKNOWN_REGION', `Region ${scope.region_id} is not present on the current page.`);
    } else {
      ids = context.items.flatMap((item) => {
        const semanticId = itemSemanticId(item);
        if (!semanticId) return [];
        if (item.meta?.region_id === scope.region_id || item.meta?.region_id === region.id || (region.semantic_id !== undefined && item.meta?.region_id === region.semantic_id)) return [semanticId];
        const intersects = item.x < region.x + region.w && item.x + item.w > region.x && item.y < region.y + region.h && item.y + item.h > region.y;
        return intersects ? [semanticId] : [];
      });
    }
  }
  const normalized: string[] = [];
  const seen = new Set<string>();
  if (ids.length < 1 || ids.length > SPATIAL_LIMITS.max_targets_per_move) throw new SpatialPlanningError('INVALID_TARGET_COUNT', `A spatial move needs 1-${SPATIAL_LIMITS.max_targets_per_move} targets.`);
  for (const [index, value] of ids.entries()) {
    const id = assertStableSemanticId(value, `scope.semantic_ids[${index}]`);
    if (seen.has(id)) throw new SpatialPlanningError('DUPLICATE_TARGET', `Spatial target ${id} appears more than once.`);
    if (!bySemantic.has(id)) throw new SpatialPlanningError('UNKNOWN_TARGET', `Spatial target ${id} is not on the current page.`);
    seen.add(id);
    normalized.push(id);
  }
  return normalized;
}

function bounds(value: unknown, path: string): SpatialBounds {
  if (!isRecord(value)) throw new SpatialPlanningError('INVALID_BOUNDS', `${path} needs x, y, w, and h.`);
  const x = boundedCoordinate(value.x, `${path}.x`);
  const y = boundedCoordinate(value.y, `${path}.y`);
  const w = boundedPositive(value.w, `${path}.w`);
  const h = boundedPositive(value.h, `${path}.h`);
  if (x + w > SPATIAL_LIMITS.max_coordinate || x - w < -SPATIAL_LIMITS.max_coordinate || y + h > SPATIAL_LIMITS.max_coordinate || y - h < -SPATIAL_LIMITS.max_coordinate) {
    throw new SpatialPlanningError('INVALID_BOUNDS', `${path} exceeds bounded page coordinates.`);
  }
  return { x, y, w, h };
}

function point(value: unknown, path: string) {
  if (!isRecord(value)) throw new SpatialPlanningError('INVALID_NUMBER', `${path} needs finite x and y.`);
  return { x: boundedCoordinate(value.x, `${path}.x`), y: boundedCoordinate(value.y, `${path}.y`) };
}

function position(item: SpatialItem): SpatialPosition {
  return { x: item.x, y: item.y, rotation: finite(item.rotation) ? item.rotation : 0 };
}

function ensurePosition(x: number, y: number, item: SpatialItem, path: string) {
  boundedCoordinate(x, `${path}.x`);
  boundedCoordinate(y, `${path}.y`);
  if (x + item.w > SPATIAL_LIMITS.max_coordinate || x - item.w < -SPATIAL_LIMITS.max_coordinate || y + item.h > SPATIAL_LIMITS.max_coordinate || y - item.h < -SPATIAL_LIMITS.max_coordinate) {
    throw new SpatialPlanningError('INVALID_BOUNDS', `Planned target ${item.semantic_id} exceeds bounded page coordinates.`, path);
  }
  return { x, y, rotation: finite(item.rotation) ? item.rotation : 0 };
}

function seedNumber(seed: unknown) {
  const source = String(seed ?? 'fogwood-spatial');
  return fnv1a(source, 0x811c9dc5) || 1;
}

function random(seed: { value: number }) {
  seed.value = (Math.imul(seed.value, 1664525) + 1013904223) >>> 0;
  return seed.value / 0x1_0000_0000;
}

function overlaps(left: { x: number; y: number; w: number; h: number }, right: { x: number; y: number; w: number; h: number }, spacing: number) {
  return !(left.x + left.w + spacing <= right.x || right.x + right.w + spacing <= left.x || left.y + left.h + spacing <= right.y || right.y + right.h + spacing <= left.y);
}

function anchorPoint(value: unknown, bySemantic: Map<string, SpatialItem>, fallback?: { x: number; y: number }) {
  if (typeof value === 'string') {
    const target = bySemantic.get(value);
    if (!target) throw new SpatialPlanningError('UNKNOWN_TARGET', `Anchor semantic id ${value} is not on the current page.`);
    return { x: target.x + target.w / 2, y: target.y + target.h / 2 };
  }
  if (value !== undefined) return point(value, 'anchor');
  if (fallback) return fallback;
  throw new SpatialPlanningError('INVALID_NUMBER', 'This spatial move needs an explicit anchor or center.');
}

function branchLayout(targets: readonly SpatialItem[], move: SpatialMoveInput, bySemantic: Map<string, SpatialItem>, moveIndex: number) {
  const links = move.links ?? move.parent_child_links;
  if (!Array.isArray(links) || links.length < 1 || links.length > SPATIAL_LIMITS.max_targets_per_move * 2) throw new SpatialPlanningError('INVALID_BRANCH', 'branch needs bounded explicit parent-child links.');
  const targetIds = new Set(targets.map((item) => item.semantic_id as string));
  const parents = new Map<string, string>();
  const children = new Map<string, string[]>();
  for (const [index, link] of links.entries()) {
    if (!isRecord(link) || typeof link.parent_semantic_id !== 'string' || typeof link.child_semantic_id !== 'string') throw new SpatialPlanningError('INVALID_BRANCH', `branch link ${index} needs parent_semantic_id and child_semantic_id.`);
    const parent = assertStableSemanticId(link.parent_semantic_id, `links[${index}].parent_semantic_id`);
    const child = assertStableSemanticId(link.child_semantic_id, `links[${index}].child_semantic_id`);
    if (!targetIds.has(parent) || !targetIds.has(child)) throw new SpatialPlanningError('UNKNOWN_TARGET', 'branch links must target the move scope.');
    if (parent === child) throw new SpatialPlanningError('BRANCH_CYCLE', 'branch cannot link a node to itself.');
    if (parents.has(child)) throw new SpatialPlanningError('BRANCH_MULTIPLE_PARENTS', `branch child ${child} has multiple parents.`);
    parents.set(child, parent);
    children.set(parent, [...(children.get(parent) ?? []), child]);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const walk = (id: string) => {
    if (visiting.has(id)) throw new SpatialPlanningError('BRANCH_CYCLE', 'branch links contain a cycle.');
    if (visited.has(id)) return;
    visiting.add(id);
    for (const child of children.get(id) ?? []) walk(child);
    visiting.delete(id);
    visited.add(id);
  };
  for (const target of targets) walk(target.semantic_id as string);
  const roots = targets.map((item) => item.semantic_id as string).filter((id) => !parents.has(id));
  if (roots.length === 0) throw new SpatialPlanningError('BRANCH_CYCLE', 'branch links do not contain a root.');
  const origin = anchorPoint(move.anchor, bySemantic, { x: targets[0].x, y: targets[0].y });
  const gapX = boundedGap(move.gap_x, 'gap_x', 80);
  const gapY = boundedGap(move.gap_y, 'gap_y', 100);
  const levels = new Map<string, number>();
  const assign = (id: string, level: number) => {
    levels.set(id, Math.max(levels.get(id) ?? 0, level));
    for (const child of children.get(id) ?? []) assign(child, level + 1);
  };
  roots.forEach((root) => assign(root, 0));
  const levelItems = new Map<number, string[]>();
  for (const target of targets) {
    const id = target.semantic_id as string;
    const level = levels.get(id) ?? 0;
    levelItems.set(level, [...(levelItems.get(level) ?? []), id]);
  }
  const planned = new Map<string, SpatialPosition>();
  for (const [level, ids] of [...levelItems.entries()].sort((left, right) => left[0] - right[0])) {
    ids.sort(compare);
    ids.forEach((id, index) => {
      const item = bySemantic.get(id) as SpatialItem;
      planned.set(id, ensurePosition(origin.x + index * gapX, origin.y + level * gapY, item, `moves[${moveIndex}]`));
    });
  }
  return planned;
}

function tracePoint(path: readonly { x: number; y: number }[], ratio: number) {
  if (path.length === 1) return path[0];
  const lengths: number[] = [];
  let total = 0;
  for (let index = 1; index < path.length; index += 1) {
    const dx = path[index].x - path[index - 1].x;
    const dy = path[index].y - path[index - 1].y;
    const length = Math.sqrt(dx * dx + dy * dy);
    lengths.push(length);
    total += length;
  }
  if (total === 0) return path[0];
  let remaining = total * ratio;
  for (let index = 0; index < lengths.length; index += 1) {
    if (remaining <= lengths[index] || index === lengths.length - 1) {
      const segment = lengths[index] || 1;
      const local = Math.max(0, Math.min(1, remaining / segment));
      return { x: path[index].x + (path[index + 1].x - path[index].x) * local, y: path[index].y + (path[index + 1].y - path[index].y) * local };
    }
    remaining -= lengths[index];
  }
  return path[path.length - 1];
}

function normalizeMoveKind(move: SpatialMoveInput, path: string): SpatialMoveKind {
  const kind = move.kind ?? move.move;
  if (!SPATIAL_MOVE_KINDS.includes(kind as SpatialMoveKind)) throw new SpatialPlanningError('INVALID_MOVE_COUNT', `Unknown spatial move kind at ${path}.kind.`, path);
  return kind as SpatialMoveKind;
}

function resolveMoveTargets(context: SpatialContext, move: SpatialMoveInput, moveIndex: number, bySemantic: Map<string, SpatialItem>) {
  const { scope, declared } = scopeFromMove(move);
  const semanticIds = resolveSpatialScope(context, scope);
  const targets = semanticIds.map((id) => bySemantic.get(id) as SpatialItem);
  for (const [index, target] of targets.entries()) {
    assertDurableSemanticTarget(target, `moves[${moveIndex}].scope[${index}]`);
    assertTarget(target, context, `moves[${moveIndex}].scope[${index}]`);
  }
  return { scope, declared, semanticIds, targets };
}

function validatePatch(move: SpatialMoveInput, path: string) {
  if (move.patches === undefined) return undefined;
  if (!isRecord(move.patches)) throw new SpatialPlanningError('INVALID_PATCH', `${path}.patches must be an allowlisted object.`, path);
  const keys = Object.keys(move.patches);
  if (keys.some((key) => !['text', 'color', 'fill'].includes(key))) throw new SpatialPlanningError('INVALID_PATCH', `${path}.patches contains an unsupported field.`, path);
  const patch = {
    ...(move.patches.text === undefined ? {} : { text: boundedString(move.patches.text, `${path}.patches.text`) }),
    ...(move.patches.color === undefined ? {} : { color: boundedString(move.patches.color, `${path}.patches.color`, 40) }),
    ...(move.patches.fill === undefined ? {} : { fill: boundedString(move.patches.fill, `${path}.patches.fill`, 40) }),
  };
  if (patch.color !== undefined && !SPATIAL_PATCH_COLORS.includes(patch.color as (typeof SPATIAL_PATCH_COLORS)[number])) throw new SpatialPlanningError('INVALID_PATCH', `${path}.patches.color is not an allowlisted canvas color.`, path);
  if (patch.fill !== undefined && !SPATIAL_PATCH_FILLS.includes(patch.fill as (typeof SPATIAL_PATCH_FILLS)[number])) throw new SpatialPlanningError('INVALID_PATCH', `${path}.patches.fill is not an allowlisted canvas fill.`, path);
  if (Object.keys(patch).length === 0) throw new SpatialPlanningError('INVALID_PATCH', `${path}.patches must contain at least one allowlisted value.`, path);
  return patch;
}

/** Build deterministic native moves and explicit annotation/variant creations. */
export function planSpatialMoves(context: SpatialContext, action: SpatialMoveAction): SpatialPlan {
  if (!isRecord(action) || action.type !== 'apply_spatial_moves' || !Array.isArray(action.moves) || action.moves.length < 1 || action.moves.length > SPATIAL_LIMITS.max_moves_per_action) {
    throw new SpatialPlanningError('INVALID_MOVE_COUNT', `apply_spatial_moves needs 1-${SPATIAL_LIMITS.max_moves_per_action} moves.`);
  }
  for (let index = 0; index < action.moves.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(action.moves, index) || !isRecord(action.moves[index])) {
      throw new SpatialPlanningError('INVALID_MOVE_COUNT', `moves[${index}] must be a present object.`, `moves[${index}]`);
    }
  }
  const bySemantic = itemMap(context);
  const plans: SpatialMovePlan[] = [];
  const creates: SpatialCreatePlan[] = [];
  const resolvedScopes: Array<{ move_index: number; scope: 'selection' | 'explicit' | 'region'; semantic_ids: readonly string[] }> = [];
  const usedTargets = new Set<string>();
  const usedCreatedIds = new Set<string>(bySemantic.keys());
  let iterations = 0;
  action.moves.forEach((move, moveIndex) => {
    if (!isRecord(move)) throw new SpatialPlanningError('INVALID_MOVE_COUNT', `moves[${moveIndex}] must be an object.`, `moves[${moveIndex}]`);
    if (Object.keys(move).some((key) => !(SPATIAL_MOVE_KEYS as readonly string[]).includes(key))) throw new SpatialPlanningError('INVALID_ACTION', `moves[${moveIndex}] contains an unknown field.`, `moves[${moveIndex}]`);
    const spatialMove = move as unknown as SpatialMoveInput;
    const kind = normalizeMoveKind(spatialMove, `moves[${moveIndex}]`);
    const resolved = resolveMoveTargets(context, spatialMove, moveIndex, bySemantic);
    resolvedScopes.push({ move_index: moveIndex, scope: resolved.declared, semantic_ids: [...resolved.semanticIds] });
    const mutatingKind = kind !== 'annotate' && kind !== 'mutate';
    for (const semanticId of resolved.semanticIds) {
      if (usedTargets.has(semanticId)) throw new SpatialPlanningError('DUPLICATE_TARGET', `Target ${semanticId} is affected by more than one spatial move.`, `moves[${moveIndex}]`);
      if (mutatingKind || kind === 'annotate' || kind === 'mutate') usedTargets.add(semanticId);
    }
    const planned = new Map<string, SpatialPosition>();
    const targetCount = resolved.targets.length;
    if (kind === 'scatter') {
      const region = bounds(spatialMove.region, `moves[${moveIndex}].region`);
      const spacing = boundedGap(spatialMove.spacing, `moves[${moveIndex}].spacing`, 24);
      const randomState = { value: seedNumber(spatialMove.seed ?? `${moveIndex}|${resolved.semanticIds.join('|')}`) };
      const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
      for (const [targetIndex, target] of resolved.targets.entries()) {
        if (target.w > region.w || target.h > region.h) throw new SpatialPlanningError('SPACING_UNSATISFIABLE', `scatter region cannot contain target ${target.semantic_id}.`, `moves[${moveIndex}].region`);
        let found: { x: number; y: number } | undefined;
        const maxX = region.x + Math.max(0, region.w - target.w);
        const maxY = region.y + Math.max(0, region.h - target.h);
        for (let attempt = 0; attempt < SPATIAL_LIMITS.max_iterations; attempt += 1) {
          iterations += 1;
          if (iterations > SPATIAL_LIMITS.max_iterations) throw new SpatialPlanningError('SPACING_UNSATISFIABLE', 'Spatial planning exceeded its bounded iteration budget.');
          const candidate = { x: region.x + random(randomState) * Math.max(0, maxX - region.x), y: region.y + random(randomState) * Math.max(0, maxY - region.y) };
          const rect = { ...candidate, w: target.w, h: target.h };
          if (placed.every((other) => !overlaps(rect, other, spacing))) {
            found = candidate;
            placed.push(rect);
            break;
          }
        }
        if (!found) throw new SpatialPlanningError('SPACING_UNSATISFIABLE', `scatter could not place target ${target.semantic_id} within its bounded region.`);
        planned.set(target.semantic_id as string, ensurePosition(found.x, found.y, target, `moves[${moveIndex}].targets[${targetIndex}]`));
      }
    } else if (kind === 'cluster') {
      const anchor = anchorPoint(spatialMove.anchor, bySemantic);
      const gapX = boundedGap(spatialMove.gap_x, `moves[${moveIndex}].gap_x`, 24);
      const gapY = boundedGap(spatialMove.gap_y, `moves[${moveIndex}].gap_y`, 24);
      for (const [targetIndex, target] of resolved.targets.entries()) {
        const column = targetIndex % Math.max(1, Math.ceil(Math.sqrt(targetCount)));
        const row = Math.floor(targetIndex / Math.max(1, Math.ceil(Math.sqrt(targetCount))));
        planned.set(target.semantic_id as string, ensurePosition(anchor.x + column * (target.w + gapX), anchor.y + row * (target.h + gapY), target, `moves[${moveIndex}].targets[${targetIndex}]`));
      }
    } else if (kind === 'branch') {
      const result = branchLayout(resolved.targets, spatialMove, bySemantic, moveIndex);
      for (const [id, next] of result) planned.set(id, next);
    } else if (kind === 'orbit') {
      const center = anchorPoint(spatialMove.center, bySemantic);
      const radius = boundedPositive(spatialMove.radius, `moves[${moveIndex}].radius`);
      const orbitTargets = [...resolved.targets].sort((left, right) => compare(left.semantic_id as string, right.semantic_id as string));
      for (const [targetIndex, target] of orbitTargets.entries()) {
        const angle = (Math.PI * 2 * targetIndex) / targetCount - Math.PI / 2;
        planned.set(target.semantic_id as string, ensurePosition(center.x + Math.cos(angle) * radius - target.w / 2, center.y + Math.sin(angle) * radius - target.h / 2, target, `moves[${moveIndex}].targets[${targetIndex}]`));
      }
    } else if (kind === 'montage') {
      const origin = anchorPoint(spatialMove.anchor, bySemantic);
      const columns = spatialMove.columns === undefined ? Math.max(1, Math.ceil(Math.sqrt(targetCount))) : Math.trunc(spatialMove.columns);
      if (!Number.isSafeInteger(columns) || columns < 1 || columns > SPATIAL_LIMITS.max_columns) throw new SpatialPlanningError('INVALID_NUMBER', `moves[${moveIndex}].columns must be 1-${SPATIAL_LIMITS.max_columns}.`);
      const gapX = boundedGap(spatialMove.gap_x, `moves[${moveIndex}].gap_x`, 24);
      const gapY = boundedGap(spatialMove.gap_y, `moves[${moveIndex}].gap_y`, 24);
      const rowHeights: number[] = [];
      for (let index = 0; index < targetCount; index += 1) rowHeights[Math.floor(index / columns)] = Math.max(rowHeights[Math.floor(index / columns)] ?? 0, resolved.targets[index].h);
      for (const [targetIndex, target] of resolved.targets.entries()) {
        const column = targetIndex % columns;
        const row = Math.floor(targetIndex / columns);
        const y = origin.y + rowHeights.slice(0, row).reduce((sum, height) => sum + height + gapY, 0);
        planned.set(target.semantic_id as string, ensurePosition(origin.x + column * (target.w + gapX), y, target, `moves[${moveIndex}].targets[${targetIndex}]`));
      }
    } else if (kind === 'trace') {
      if (!Array.isArray(spatialMove.path) || spatialMove.path.length < 2 || spatialMove.path.length > SPATIAL_LIMITS.max_path_points) throw new SpatialPlanningError('INVALID_PATH', `moves[${moveIndex}].path must contain 2-${SPATIAL_LIMITS.max_path_points} points.`);
      const path = spatialMove.path.map((candidate, pointIndex) => point(candidate, `moves[${moveIndex}].path[${pointIndex}]`));
      for (const [targetIndex, target] of resolved.targets.entries()) {
        const next = tracePoint(path, targetCount === 1 ? 0 : targetIndex / (targetCount - 1));
        planned.set(target.semantic_id as string, ensurePosition(next.x - target.w / 2, next.y - target.h / 2, target, `moves[${moveIndex}].targets[${targetIndex}]`));
      }
    } else if (kind === 'annotate') {
      if (targetCount !== 1) throw new SpatialPlanningError('INVALID_TARGET_COUNT', 'annotate targets exactly one semantic item.');
      const target = resolved.targets[0];
      const text = boundedString(spatialMove.text, `moves[${moveIndex}].text`, SPATIAL_LIMITS.max_text, true);
      const offset = spatialMove.offset === undefined ? { x: target.w + 24, y: 0 } : point(spatialMove.offset, `moves[${moveIndex}].offset`);
      // Native notes measure text in the browser and may grow below their
      // 200px base. Bound against a deliberately conservative maximum of one
      // 48px visual line per UTF-16 code unit so decoding/font differences can
      // never move the rendered note beyond Fogwood's page envelope.
      const safetyHeight = 200 + text.length * 48;
      ensurePosition(target.x + offset.x, target.y + offset.y, { ...target, w: 200, h: safetyHeight }, `moves[${moveIndex}].annotation`);
      const semanticId = stableSemanticId('annotation', target.semantic_id, moveIndex, text);
      if (usedCreatedIds.has(semanticId)) throw new SpatialPlanningError('DUPLICATE_SEMANTIC_ID', `Generated annotation semantic id ${semanticId} is already in use.`);
      usedCreatedIds.add(semanticId);
      creates.push({ move_index: moveIndex, kind: 'annotation', semantic_id: semanticId, source_semantic_id: target.semantic_id, source_shape_id: target.id, type: 'note', x: target.x + offset.x, y: target.y + offset.y, w: 200, h: 200, text });
    } else if (kind === 'mutate') {
      const patches = validatePatch(spatialMove, `moves[${moveIndex}]`);
      const offset = spatialMove.offset === undefined ? { x: 40, y: 40 } : point(spatialMove.offset, `moves[${moveIndex}].offset`);
      for (const target of resolved.targets) {
        if (!['geo', 'note', 'text', 'arrow', 'frame', 'image', 'draw', 'line'].includes(target.type)) throw new SpatialPlanningError('UNSUPPORTED_VARIANT', `Cannot mutate unsupported native shape type ${target.type}.`);
        const sourceId = target.semantic_id as string;
        const semanticId = stableSemanticId('variant', sourceId, moveIndex, JSON.stringify(patches ?? {}));
        ensurePosition(target.x + offset.x, target.y + offset.y, target, `moves[${moveIndex}].variant`);
        if (usedCreatedIds.has(semanticId)) throw new SpatialPlanningError('DUPLICATE_SEMANTIC_ID', `Generated variant semantic id ${semanticId} is already in use.`);
        usedCreatedIds.add(semanticId);
        creates.push({ move_index: moveIndex, kind: 'variant', semantic_id: semanticId, source_semantic_id: sourceId, source_shape_id: target.id, type: target.type, x: target.x + offset.x, y: target.y + offset.y, w: target.w, h: target.h, patches, lineage_source_id: sourceId, parent_variant_id: typeof target.meta?.variant_id === 'string' ? target.meta.variant_id : undefined, variant_id: semanticId });
      }
    }
    for (const target of resolved.targets) {
      if (!planned.has(target.semantic_id as string)) continue;
      const after = planned.get(target.semantic_id as string) as SpatialPosition;
      if (after.x === target.x && after.y === target.y && after.rotation === (finite(target.rotation) ? target.rotation : 0)) throw new SpatialPlanningError('NO_OP', `Spatial move leaves ${target.semantic_id} unchanged.`, `moves[${moveIndex}]`);
      plans.push({ move_index: moveIndex, kind, semantic_id: target.semantic_id as string, shape_id: target.id, before: position(target), after });
    }
  });
  return { moves: plans, creates, resolved_scopes: resolvedScopes };
}

export function validateSpatialAction(context: SpatialContext, action: SpatialMoveAction) {
  try {
    const plan = planSpatialMoves(context, action);
    return { ok: true as const, plan };
  } catch (error) {
    if (error instanceof SpatialPlanningError) return { ok: false as const, errors: [{ code: error.code, message: error.message, ...(error.path ? { path: error.path } : {}) }] };
    return { ok: false as const, errors: [{ code: 'INVALID_ACTION' as const, message: 'Spatial planning failed before page mutation.' }] };
  }
}

export function planRelationships(context: SpatialContext, relationships: readonly SemanticRelationship[]): RelationshipPlan {
  if (!Array.isArray(relationships) || relationships.length < 1 || relationships.length > SPATIAL_LIMITS.max_relationships) throw new SpatialPlanningError('INVALID_RELATIONSHIP_COUNT', `add_relationships needs 1-${SPATIAL_LIMITS.max_relationships}.`);
  if ((context.semantic_relationships?.length ?? 0) + relationships.length > SPATIAL_LIMITS.max_relationships) throw new SpatialPlanningError('INVALID_RELATIONSHIP_COUNT', `A page may contain at most ${SPATIAL_LIMITS.max_relationships} semantic relationships.`);
  const bySemantic = itemMap(context);
  const used = new Set((context.semantic_relationships ?? []).map((relationship) => relationship.id));
  const result: SemanticRelationship[] = [];
  for (const [index, raw] of relationships.entries()) {
    if (!isRecord(raw)) throw new SpatialPlanningError('INVALID_RELATIONSHIP', `relationships[${index}] must be an object.`);
    if (Object.keys(raw).some((key) => !['id', 'kind', 'source_semantic_id', 'target_semantic_id', 'label'].includes(key))) throw new SpatialPlanningError('INVALID_RELATIONSHIP', `relationships[${index}] contains an unknown field.`);
    const id = assertStableSemanticId(raw.id, `relationships[${index}].id`);
    if (used.has(id)) throw new SpatialPlanningError('DUPLICATE_RELATIONSHIP_ID', `Relationship id ${id} already exists.`);
    used.add(id);
    if (!SEMANTIC_RELATIONSHIP_KINDS.includes(raw.kind as SemanticRelationshipKind)) throw new SpatialPlanningError('INVALID_RELATIONSHIP', `Relationship ${id} has an unsupported kind.`);
    const source = assertStableSemanticId(raw.source_semantic_id, `relationships[${index}].source_semantic_id`);
    const target = assertStableSemanticId(raw.target_semantic_id, `relationships[${index}].target_semantic_id`);
    if (source === target) throw new SpatialPlanningError('SELF_RELATIONSHIP', `Relationship ${id} cannot point from an item to itself.`);
    if (!bySemantic.has(source) || !bySemantic.has(target)) throw new SpatialPlanningError('UNKNOWN_TARGET', `Relationship ${id} references an unknown semantic target.`);
    assertDurableSemanticTarget(bySemantic.get(source) as SpatialItem, `relationships[${index}].source_semantic_id`);
    assertDurableSemanticTarget(bySemantic.get(target) as SpatialItem, `relationships[${index}].target_semantic_id`);
    assertTarget(bySemantic.get(source) as SpatialItem, context, `relationships[${index}].source_semantic_id`);
    assertTarget(bySemantic.get(target) as SpatialItem, context, `relationships[${index}].target_semantic_id`);
    const label = raw.label === undefined ? undefined : boundedString(raw.label, `relationships[${index}].label`, SPATIAL_LIMITS.max_label);
    result.push({ id, kind: raw.kind as SemanticRelationshipKind, source_semantic_id: source, target_semantic_id: target, ...(label === undefined ? {} : { label }) });
  }
  return { relationships: result };
}

export function validateRelationships(context: SpatialContext, action: AddRelationshipsAction) {
  try {
    return { ok: true as const, plan: planRelationships(context, action.relationships) };
  } catch (error) {
    if (error instanceof SpatialPlanningError) return { ok: false as const, errors: [{ code: error.code, message: error.message, ...(error.path ? { path: error.path } : {}) }] };
    return { ok: false as const, errors: [{ code: 'INVALID_RELATIONSHIP' as const, message: 'Relationship planning failed before page mutation.' }] };
  }
}

export function semanticRelationshipMeta(relationship: SemanticRelationship) {
  return {
    relationship_id: relationship.id,
    relationship_kind: relationship.kind,
    source_semantic_id: relationship.source_semantic_id,
    target_semantic_id: relationship.target_semantic_id,
    ...(relationship.label === undefined ? {} : { relationship_label: relationship.label }),
  };
}

/** The canonical move vocabulary is itself a bounded golden fixture surface. */
export const SPATIAL_GOLDEN_FIXTURES = Object.freeze(SPATIAL_MOVE_KINDS.map((kind) => Object.freeze({ kind })));
