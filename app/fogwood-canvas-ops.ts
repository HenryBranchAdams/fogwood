/**
 * Fogwood Canvas Protocol v2
 *
 * A pure, deterministic plan for mixing bounded tldraw-style operations inside
 * one staged proposal. This module never imports tldraw, touches the DOM, or
 * mutates a page. The page adapter re-plans against the exact current revision
 * before applying every step in one editor transaction.
 */

// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
import { SEMANTIC_RELATIONSHIP_KINDS, SPATIAL_LIMITS, relationshipSemanticId } from './fogwood-spatial.ts';
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
import { createTransformProjection, pagePointToParentLocal, translateProjectedGeometry, TRANSFORM_EPSILON } from './tldraw-adapter/transform-projection.ts';
import type { FogwoodTransformProjection } from './tldraw-adapter/transform-projection.ts';

export const FOGWOOD_CANVAS_PROTOCOL = {
  name: 'fogwood-canvas-protocol',
  version: 2,
  action: 'canvas_ops',
  authority: 'stage-only-until-page-apply',
  execution: 'device-local-page-owned',
  arbitrary_code: false,
  remote_fetch: false,
  max_ops: 24,
  max_targets_per_op: 64,
  max_ungroup_targets: 32,
  max_draw_points: 256,
  max_draw_delta: 65_504,
  max_context_items: 5_000,
  target_reference: 'current shape id or semantic:<stable-semantic-id> from the live page or an earlier create/draw/variant op',
} as const;

export const CANVAS_OP_KINDS = [
  'create',
  'draw',
  'connect',
  'variant',
  'update',
  'resize',
  'align',
  'distribute',
  'stack',
  'pack',
  'group',
  'ungroup',
  'reorder',
  'delete',
] as const;

export const CANVAS_CREATE_KINDS = [
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

export const CANVAS_OP_COLORS = [
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

export const CANVAS_OP_FILLS = ['none', 'semi', 'solid', 'pattern'] as const;
export const CANVAS_OP_SIZES = ['s', 'm', 'l', 'xl'] as const;
export const ALIGN_AXES = ['left', 'right', 'top', 'bottom', 'center-horizontal', 'center-vertical'] as const;
export const ORIENTATIONS = ['horizontal', 'vertical'] as const;
export const REORDER_POSITIONS = ['front', 'back', 'forward', 'backward'] as const;

export type CanvasOpColor = (typeof CANVAS_OP_COLORS)[number];
export type CanvasOpFill = (typeof CANVAS_OP_FILLS)[number];
export type CanvasOpSize = (typeof CANVAS_OP_SIZES)[number];
export type AlignAxis = (typeof ALIGN_AXES)[number];
export type Orientation = (typeof ORIENTATIONS)[number];
export type ReorderPosition = (typeof REORDER_POSITIONS)[number];
export type CanvasCreateKind = (typeof CANVAS_CREATE_KINDS)[number];

export type CanvasOpItem = {
  id: string;
  type: string;
  kind?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  opacity?: number;
  index?: string;
  parent_id?: string;
  is_locked?: boolean;
  semantic_id?: string;
  semantic_id_source?: string;
  text?: string;
  props?: Record<string, unknown>;
  meta?: Record<string, unknown>;
  binding_count?: number;
  transform?: import('./tldraw-adapter/transform-projection.ts').FogwoodTransformProjection;
};

export type DrawCanvasOp = {
  op: 'draw';
  semantic_id: string;
  points: Array<{ x: number; y: number }>;
  color?: CanvasOpColor;
  fill?: CanvasOpFill;
  size?: CanvasOpSize;
  closed?: boolean;
};

export type CreateCanvasOp = {
  op: 'create';
  semantic_id: string;
  kind: CanvasCreateKind;
  x: number;
  y: number;
  w?: number;
  h?: number;
  end_x?: number;
  end_y?: number;
  text?: string;
  color?: CanvasOpColor;
  fill?: CanvasOpFill;
  role?: string;
  region_id?: string;
  rotation?: number;
  opacity?: number;
};

export type ConnectCanvasOp = {
  op: 'connect';
  semantic_id: string;
  from_id: string;
  to_id: string;
  text?: string;
  color?: CanvasOpColor;
  relationship_id?: string;
  relationship_kind?: (typeof SEMANTIC_RELATIONSHIP_KINDS)[number];
};

export type VariantCanvasOp = {
  op: 'variant';
  id: string;
  semantic_id: string;
  offset_x: number;
  offset_y: number;
};

export type UpdateCanvasOp = {
  op: 'update';
  id: string;
  x?: number;
  y?: number;
  rotation?: number;
  opacity?: number;
  text?: string;
  color?: CanvasOpColor;
  fill?: CanvasOpFill;
};

export type ResizeCanvasOp = {
  op: 'resize';
  id: string;
  w: number;
  h: number;
};

export type AlignCanvasOp = {
  op: 'align';
  ids: string[];
  axis: AlignAxis;
};

export type DistributeCanvasOp = {
  op: 'distribute';
  ids: string[];
  axis: Orientation;
};

export type StackCanvasOp = {
  op: 'stack';
  ids: string[];
  axis: Orientation;
  gap?: number;
};

export type PackCanvasOp = {
  op: 'pack';
  ids: string[];
  gap?: number;
};

export type GroupCanvasOp = {
  op: 'group';
  ids: string[];
  semantic_id: string;
};

export type UngroupCanvasOp = {
  op: 'ungroup';
  ids: string[];
};

export type ReorderCanvasOp = {
  op: 'reorder';
  ids: string[];
  position: ReorderPosition;
};

export type DeleteCanvasOp = {
  op: 'delete';
  ids: string[];
};

export type CanvasOp =
  | CreateCanvasOp
  | DrawCanvasOp
  | ConnectCanvasOp
  | VariantCanvasOp
  | UpdateCanvasOp
  | ResizeCanvasOp
  | AlignCanvasOp
  | DistributeCanvasOp
  | StackCanvasOp
  | PackCanvasOp
  | GroupCanvasOp
  | UngroupCanvasOp
  | ReorderCanvasOp
  | DeleteCanvasOp;

export type CanvasOpsAction = {
  type: 'canvas_ops';
  composition_id?: string;
  ops: CanvasOp[];
};

export type CanvasOpError = {
  code: string;
  message: string;
  path: string;
};

type DiffFields = Record<string, { before: unknown; after: unknown }>;

export type CanvasOpStep =
  | { kind: 'create'; op: CreateCanvasOp; pending_id: string; bounds: { x: number; y: number; w: number; h: number } }
  | { kind: 'draw'; op: DrawCanvasOp; pending_id: string; bounds: { x: number; y: number; w: number; h: number } }
  | { kind: 'connect'; op: ConnectCanvasOp; pending_id: string; from: { id: string; type: string; semantic_id?: string }; to: { id: string; type: string; semantic_id?: string }; bounds: { x: number; y: number; w: number; h: number } }
  | { kind: 'variant'; op: VariantCanvasOp; pending_id: string; source: { id: string; type: string; semantic_id: string; transform_fingerprint: string; parent_id: string }; local_position: { x: number; y: number }; bounds: { x: number; y: number; w: number; h: number }; geometry: PageGeometry; lineage: { variant_id: string; lineage_source_id: string; parent_variant_id?: string } }
  | { kind: 'update'; op: UpdateCanvasOp; fields: DiffFields; target: PreparedTransformTarget; local_position?: { x: number; y: number }; after_page_geometry: PageGeometry }
  | { kind: 'resize'; op: ResizeCanvasOp; target: PreparedTransformTarget; scale: { x: number; y: number }; before: PageGeometry; after: PageGeometry }
  | { kind: 'arrange'; op: AlignCanvasOp | DistributeCanvasOp | StackCanvasOp | PackCanvasOp; placements: Array<{ id: string; type: string; parent_id: string; transform_fingerprint: string; local_x: number; local_y: number; rotation: number; before: PageGeometry; after: PageGeometry }> }
  | { kind: 'group'; op: GroupCanvasOp; bounds: { x: number; y: number; w: number; h: number } }
  | { kind: 'ungroup'; op: UngroupCanvasOp }
  | { kind: 'reorder'; op: ReorderCanvasOp }
  | { kind: 'delete'; op: DeleteCanvasOp };

export type CanvasOpPlan = {
  normalized_action: CanvasOpsAction;
  steps: CanvasOpStep[];
  adds: Array<{
    kind: string;
    semantic_id: string;
    label: string;
    x: number;
    y: number;
    w: number;
    h: number;
    role?: string;
    composition_id?: string;
    region_id?: string;
    rotation?: number;
    opacity?: number;
    variant_id?: string;
    parent_variant_id?: string;
    lineage_source_id?: string;
  }>;
  updates: Array<{ ids: string[]; fields: string[]; changes: Array<{ id: string; fields: DiffFields }> }>;
  moves: Array<{ ids: string[]; changes: Array<{ id: string; before: { x: number; y: number; rotation: number }; after: { x: number; y: number; rotation: number } }> }>;
  removes: string[];
};

export type CanvasOpPlanningResult =
  | { ok: true; plan: CanvasOpPlan }
  | { ok: false; errors: CanvasOpError[] };

const MAX_COORDINATE = 100_000;
const MAX_DIMENSION = 5_000;
const MAX_TEXT = 2_000;
const MAX_CONNECTOR_LABEL = SPATIAL_LIMITS.max_label;
const MAX_ROLE = 120;
const MAX_VARIANT_OFFSET = 5_000;
const MAX_DRAW_DELTA = FOGWOOD_CANVAS_PROTOCOL.max_draw_delta;
const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9:._/-]{0,179}$/u;
const CONNECT_TARGET_TYPES = new Set(['geo', 'note', 'text', 'frame', 'image', 'draw', 'surface-block']);
const VARIANT_TARGET_TYPES = new Set(['geo', 'note', 'text', 'frame', 'image', 'draw']);
const TRANSFORM_TARGET_TYPES = new Set(['geo', 'text', 'frame', 'image', 'draw', 'arrow']);

export type PageGeometry = Readonly<{
  origin: Readonly<{ x: number; y: number }>;
  bounds: Readonly<{ x: number; y: number; w: number; h: number }>;
  corners: readonly Readonly<{ x: number; y: number }>[];
  rotation: number;
}>;

export type PreparedTransformTarget = Readonly<{
  id: string;
  type: string;
  parent_id: string;
  transform_fingerprint: string;
  local_to_page: import('./tldraw-adapter/transform-projection.ts').TransformMatrix;
  local_bounds: Readonly<{ x: number; y: number; w: number; h: number }>;
  local_position: Readonly<{ x: number; y: number }>;
  page: PageGeometry;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function inRange(value: unknown, min: number, max: number): value is number {
  return finite(value) && value >= min && value <= max;
}

function addError(errors: CanvasOpError[], code: string, message: string, path: string) {
  errors.push({ code, message, path });
}

function cloneItem(item: CanvasOpItem): CanvasOpItem {
  return {
    ...item,
    props: { ...(item.props ?? {}) },
    rotation: finite(item.rotation) ? item.rotation : 0,
    opacity: finite(item.opacity) ? item.opacity : 1,
  };
}

function projectionForItem(item: CanvasOpItem, pageId: string): FogwoodTransformProjection | undefined {
  if (item.transform?.schema === 'fogwood.transform.v1') return item.transform;
  if (item.parent_id !== pageId) return undefined;
  const rotation = item.rotation ?? 0;
  // Legacy callers only expose axis-aligned page bounds. Never synthesize an
  // exact transform for rotated geometry from those lossy fields.
  if (Math.abs(rotation) > TRANSFORM_EPSILON) return undefined;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  try {
    return createTransformProjection({
      parent_id: pageId,
      parent_to_page: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
      local_to_page: { a: cos, b: sin, c: -sin, d: cos, e: item.x, f: item.y },
      local_bounds: { x: 0, y: 0, w: item.w, h: item.h },
      locked_ancestor: false,
    });
  } catch {
    return undefined;
  }
}

function pageGeometry(projection: FogwoodTransformProjection): PageGeometry {
  return {
    origin: { ...projection.page_origin },
    bounds: { ...projection.page_bounds },
    corners: projection.page_corners.map((point) => ({ ...point })),
    rotation: projection.page_rotation,
  };
}

function preparedTransformTarget(item: CanvasOpItem, projection: FogwoodTransformProjection): PreparedTransformTarget {
  return {
    id: item.id,
    type: item.type,
    parent_id: projection.parent_id,
    transform_fingerprint: projection.fingerprint,
    local_to_page: { ...projection.local_to_page },
    local_bounds: { ...projection.local_bounds },
    local_position: { x: item.x, y: item.y },
    page: pageGeometry(projection),
  };
}

function requireTransform(item: CanvasOpItem | undefined, pageId: string, path: string, errors: CanvasOpError[]) {
  if (!item) return undefined;
  const projection = projectionForItem(item, pageId);
  if (!projection) addError(errors, 'TRANSFORM_REQUIRED', 'This target does not expose a bounded invertible Fogwood transform projection.', path);
  return projection;
}

function ancestors(item: CanvasOpItem, byId: Map<string, CanvasOpItem>) {
  const result: CanvasOpItem[] = [];
  const visited = new Set<string>();
  let parentId = item.parent_id;
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) break;
    result.push(parent);
    parentId = parent.parent_id;
  }
  return result;
}

function effectivelyLocked(item: CanvasOpItem, byId: Map<string, CanvasOpItem>) {
  return item.is_locked === true || ancestors(item, byId).some((ancestor) => ancestor.is_locked === true);
}

function hasLockedDescendant(item: CanvasOpItem, childrenByParent: ReadonlyMap<string, readonly CanvasOpItem[]>) {
  const visited = new Set<string>([item.id]);
  const queue = [...(childrenByParent.get(item.id) ?? [])];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const candidate = queue[cursor];
    if (visited.has(candidate.id)) continue;
    visited.add(candidate.id);
    if (candidate.is_locked === true) return true;
    for (const child of childrenByParent.get(candidate.id) ?? []) if (!visited.has(child.id)) queue.push(child);
  }
  return false;
}

function footprintWithinBounds(bounds: { x: number; y: number; w: number; h: number; rotation?: number }) {
  if (![bounds.x, bounds.y, bounds.w, bounds.h, bounds.rotation ?? 0].every(finite)) return false;
  if (bounds.w < 0 || bounds.h < 0) return false;
  const rotation = bounds.rotation ?? 0;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const corners = [
    { x: 0, y: 0 },
    { x: bounds.w, y: 0 },
    { x: 0, y: bounds.h },
    { x: bounds.w, y: bounds.h },
  ].map((point) => ({
    x: bounds.x + point.x * cos - point.y * sin,
    y: bounds.y + point.x * sin + point.y * cos,
  }));
  return corners.every((point) =>
    point.x >= -MAX_COORDINATE
    && point.x <= MAX_COORDINATE
    && point.y >= -MAX_COORDINATE
    && point.y <= MAX_COORDINATE);
}

function requireFootprint(
  bounds: { x: number; y: number; w: number; h: number; rotation?: number },
  path: string,
  errors: CanvasOpError[],
) {
  if (!footprintWithinBounds(bounds)) {
    addError(
      errors,
      'FOOTPRINT_LIMIT',
      `The complete shape footprint must stay within ±${MAX_COORDINATE} page coordinates.`,
      path,
    );
  }
}

function pendingId(semanticId: string) {
  return `pending:${semanticId}`;
}

function resolveTargetId(
  value: unknown,
  path: string,
  byId: Map<string, CanvasOpItem>,
  semanticToId: Map<string, string>,
  errors: CanvasOpError[],
) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 220) {
    addError(errors, 'INVALID_TARGET_ID', 'A target must be a bounded current shape id or semantic:<stable-semantic-id> reference.', path);
    return '';
  }
  const id = value.startsWith('semantic:')
    ? semanticToId.get(value.slice('semantic:'.length))
    : value;
  if (!id || !byId.has(id)) {
    addError(errors, 'UNKNOWN_TARGET', 'Canvas operation target does not exist on this page or earlier in this action.', path);
    return '';
  }
  return id;
}

function normalizeIds(
  raw: unknown,
  path: string,
  min: number,
  max: number,
  byId: Map<string, CanvasOpItem>,
  semanticToId: Map<string, string>,
  childrenByParent: ReadonlyMap<string, readonly CanvasOpItem[]>,
  pageId: string,
  errors: CanvasOpError[],
  allowNested = false,
) {
  if (!Array.isArray(raw) || raw.length < min || raw.length > max) {
    addError(errors, 'INVALID_TARGET_COUNT', `ids must contain ${min}-${max} current-page shape IDs.`, path);
    return [];
  }
  const refs = raw.filter((id): id is string => typeof id === 'string');
  if (refs.length !== raw.length || new Set(refs).size !== refs.length) {
    addError(errors, 'INVALID_TARGET_IDS', 'ids must contain unique strings.', path);
  }
  const resolvedIds = refs.flatMap((ref, index) => {
    const id = resolveTargetId(ref, `${path}[${index}]`, byId, semanticToId, errors);
    return id ? [id] : [];
  });
  if (new Set(resolvedIds).size !== resolvedIds.length) {
    addError(errors, 'INVALID_TARGET_IDS', 'Target references must resolve to unique shapes.', path);
  }
  const items = resolvedIds.flatMap((id, index) => {
    const item = byId.get(id)!;
    if (effectivelyLocked(item, byId)) {
      addError(errors, 'LOCKED_TARGET', 'Locked shapes and shapes under locked ancestors cannot be changed.', `${path}[${index}]`);
    }
    if (hasLockedDescendant(item, childrenByParent)) {
      addError(errors, 'LOCKED_DESCENDANT', 'Container operations cannot indirectly change a locked descendant.', `${path}[${index}]`);
    }
    if (!allowNested && item.parent_id !== pageId) {
      addError(errors, 'NESTED_TARGET', 'Canvas Protocol v1 layout and structural operations accept direct page children only.', `${path}[${index}]`);
    }
    return [item];
  });
  return items;
}

function requireSameParent(items: readonly CanvasOpItem[], path: string, errors: CanvasOpError[]) {
  if (new Set(items.map((item) => item.parent_id)).size > 1) {
    addError(errors, 'MIXED_PARENTS', 'Targets must share one parent.', path);
  }
}

function requireUnrotated(items: readonly CanvasOpItem[], path: string, errors: CanvasOpError[]) {
  if (items.some((item) => Math.abs(item.rotation ?? 0) > 1e-9)) {
    addError(errors, 'ROTATED_LAYOUT_TARGET', 'Canvas Protocol v1 layout, resize, and grouping require unrotated targets.', path);
  }
}

function stableSemanticId(value: unknown, path: string, existing: Set<string>, errors: CanvasOpError[]) {
  if (typeof value !== 'string' || !STABLE_ID.test(value)) {
    addError(errors, 'INVALID_SEMANTIC_ID', 'semantic_id must be a bounded lexical stable ID.', path);
    return '';
  }
  if (existing.has(value)) {
    addError(errors, 'DUPLICATE_SEMANTIC_ID', 'semantic_id must be unique on the current page and within this proposal.', path);
  }
  existing.add(value);
  return value;
}

function hasDurableSemanticId(item: CanvasOpItem) {
  const semanticIdSource = item.semantic_id_source ?? item.meta?.semantic_id_source;
  return typeof item.semantic_id === 'string'
    && STABLE_ID.test(item.semantic_id)
    && semanticIdSource !== 'legacy-shape-id';
}

function pointBounds(points: readonly { x: number; y: number }[]) {
  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));
  return {
    x: minX,
    y: minY,
    w: Math.max(1, maxX - minX),
    h: Math.max(1, maxY - minY),
  };
}

function combinedBounds(items: readonly CanvasOpItem[]) {
  const minX = Math.min(...items.map((item) => item.x));
  const minY = Math.min(...items.map((item) => item.y));
  const maxX = Math.max(...items.map((item) => item.x + item.w));
  const maxY = Math.max(...items.map((item) => item.y + item.h));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function layoutPlacements(
  op: AlignCanvasOp | DistributeCanvasOp | StackCanvasOp | PackCanvasOp,
  items: readonly CanvasOpItem[],
) {
  const placements = new Map(items.map((item) => [item.id, {
    id: item.id,
    x: item.x,
    y: item.y,
    rotation: item.rotation ?? 0,
  }]));
  if (op.op === 'align') {
    const bounds = combinedBounds(items);
    for (const item of items) {
      const placement = placements.get(item.id)!;
      if (op.axis === 'left') placement.x = bounds.x;
      if (op.axis === 'right') placement.x = bounds.x + bounds.w - item.w;
      if (op.axis === 'top') placement.y = bounds.y;
      if (op.axis === 'bottom') placement.y = bounds.y + bounds.h - item.h;
      if (op.axis === 'center-horizontal') placement.x = bounds.x + (bounds.w - item.w) / 2;
      if (op.axis === 'center-vertical') placement.y = bounds.y + (bounds.h - item.h) / 2;
    }
  }
  if (op.op === 'distribute') {
    const horizontal = op.axis === 'horizontal';
    const sorted = [...items].sort((a, b) => {
      const aCenter = (horizontal ? a.x + a.w / 2 : a.y + a.h / 2);
      const bCenter = (horizontal ? b.x + b.w / 2 : b.y + b.h / 2);
      return aCenter - bCenter || a.id.localeCompare(b.id);
    });
    const firstCenter = horizontal
      ? sorted[0].x + sorted[0].w / 2
      : sorted[0].y + sorted[0].h / 2;
    const last = sorted.at(-1)!;
    const lastCenter = horizontal ? last.x + last.w / 2 : last.y + last.h / 2;
    sorted.forEach((item, index) => {
      const center = firstCenter + ((lastCenter - firstCenter) * index) / (sorted.length - 1);
      const placement = placements.get(item.id)!;
      if (horizontal) placement.x = center - item.w / 2;
      else placement.y = center - item.h / 2;
    });
  }
  if (op.op === 'stack') {
    const horizontal = op.axis === 'horizontal';
    const sorted = [...items].sort((a, b) =>
      (horizontal ? a.x - b.x : a.y - b.y) || a.id.localeCompare(b.id));
    let cursor = horizontal
      ? Math.min(...items.map((item) => item.x))
      : Math.min(...items.map((item) => item.y));
    const gap = op.gap ?? 16;
    for (const item of sorted) {
      const placement = placements.get(item.id)!;
      if (horizontal) {
        placement.x = cursor;
        cursor += item.w + gap;
      } else {
        placement.y = cursor;
        cursor += item.h + gap;
      }
    }
  }
  if (op.op === 'pack') {
    const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
    const columns = Math.ceil(Math.sqrt(sorted.length));
    const gap = op.gap ?? 16;
    const cellW = Math.max(...items.map((item) => item.w)) + gap;
    const cellH = Math.max(...items.map((item) => item.h)) + gap;
    const startX = Math.min(...items.map((item) => item.x));
    const startY = Math.min(...items.map((item) => item.y));
    sorted.forEach((item, index) => {
      const placement = placements.get(item.id)!;
      placement.x = startX + (index % columns) * cellW;
      placement.y = startY + Math.floor(index / columns) * cellH;
    });
  }
  return [...placements.values()];
}

function targetOrderChanges(items: readonly CanvasOpItem[], allItems: readonly CanvasOpItem[], position: ReorderPosition) {
  if (items.length === 0) return false;
  const parentId = items[0].parent_id;
  const siblings = allItems
    .filter((item) => item.parent_id === parentId)
    .sort((a, b) => String(a.index ?? '').localeCompare(String(b.index ?? '')) || a.id.localeCompare(b.id));
  const targets = new Set(items.map((item) => item.id));
  if (position === 'front') return siblings.slice(-targets.size).some((item) => !targets.has(item.id));
  if (position === 'back') return siblings.slice(0, targets.size).some((item) => !targets.has(item.id));
  const positions = siblings.flatMap((item, index) => targets.has(item.id) ? [index] : []);
  if (position === 'forward') return positions.some((index) => siblings.slice(index + 1).some((item) => !targets.has(item.id)));
  return positions.some((index) => siblings.slice(0, index).some((item) => !targets.has(item.id)));
}

export function planCanvasOps(
  currentItems: readonly CanvasOpItem[],
  rawOps: unknown,
  pageId?: string,
  compositionId?: unknown,
): CanvasOpPlanningResult {
  const errors: CanvasOpError[] = [];
  if (typeof pageId !== 'string' || pageId.length < 1 || pageId.length > 220) {
    return {
      ok: false,
      errors: [{
        code: 'INVALID_PAGE_ID',
        message: 'Canvas Protocol planning requires one bounded current page id.',
        path: 'context.page_id',
      }],
    };
  }
  if (currentItems.length > FOGWOOD_CANVAS_PROTOCOL.max_context_items) {
    return {
      ok: false,
      errors: [{
        code: 'CANVAS_CONTEXT_LIMIT',
        message: `Canvas Protocol v1 accepts at most ${FOGWOOD_CANVAS_PROTOCOL.max_context_items} current-page items.`,
        path: 'context.items',
      }],
    };
  }
  if (!Array.isArray(rawOps) || rawOps.length < 1 || rawOps.length > FOGWOOD_CANVAS_PROTOCOL.max_ops) {
    return {
      ok: false,
      errors: [{
        code: 'INVALID_CANVAS_OP_COUNT',
        message: `canvas_ops must contain 1-${FOGWOOD_CANVAS_PROTOCOL.max_ops} operations.`,
        path: 'ops',
      }],
    };
  }
  let normalizedCompositionId: string | undefined;
  if (compositionId !== undefined) {
    if (typeof compositionId !== 'string' || !STABLE_ID.test(compositionId)) {
      addError(errors, 'INVALID_COMPOSITION_ID', 'composition_id must be a bounded lexical stable ID.', 'composition_id');
    } else {
      normalizedCompositionId = compositionId;
    }
  }
  for (let index = 0; index < rawOps.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(rawOps, index)) {
      addError(errors, 'SPARSE_CANVAS_OPS', 'canvas_ops may not contain sparse array slots.', `ops[${index}]`);
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  const nativeIds = new Set<string>();
  for (const item of currentItems) {
    if (nativeIds.has(item.id)) {
      return { ok: false, errors: [{ code: 'DUPLICATE_NATIVE_ID', message: 'Current page native shape ids must be unique before Canvas Protocol operations can be staged.', path: 'context.items' }] };
    }
    nativeIds.add(item.id);
  }

  const projected = new Map(currentItems.map((item) => [item.id, cloneItem(item)]));
  const childrenByParent = new Map<string, CanvasOpItem[]>();
  for (const item of projected.values()) {
    if (!item.parent_id) continue;
    const children = childrenByParent.get(item.parent_id) ?? [];
    children.push(item);
    childrenByParent.set(item.parent_id, children);
  }
  const semanticEntries = currentItems.flatMap((item) => item.semantic_id ? [[item.semantic_id, item.id] as const] : []);
  const existingSemanticIds = new Set(semanticEntries.map(([semanticId]) => semanticId));
  const semanticToId = new Map(semanticEntries);
  if (semanticToId.size !== semanticEntries.length) {
    return { ok: false, errors: [{ code: 'DUPLICATE_SEMANTIC_ID', message: 'Current page semantic ids must be unique before Canvas Protocol operations can be staged.', path: 'context.items' }] };
  }
  const normalized: CanvasOp[] = [];
  const steps: CanvasOpStep[] = [];
  const adds: CanvasOpPlan['adds'] = [];
  const updates: CanvasOpPlan['updates'] = [];
  const moves: CanvasOpPlan['moves'] = [];
  const removes: string[] = [];

  rawOps.forEach((raw, index) => {
    const path = `ops[${index}]`;
    if (!isRecord(raw) || typeof raw.op !== 'string' || !CANVAS_OP_KINDS.includes(raw.op as (typeof CANVAS_OP_KINDS)[number])) {
      addError(errors, 'UNKNOWN_CANVAS_OP', 'Each operation needs one supported op value.', `${path}.op`);
      return;
    }

    if ((raw.op === 'group' || raw.op === 'ungroup') && index !== rawOps.length - 1) {
      addError(errors, 'STRUCTURAL_OP_MUST_BE_LAST', 'group or ungroup must be the final operation in a canvas_ops action.', path);
    }

    if (raw.op === 'create') {
      if (!hasOnlyKeys(raw, ['op', 'semantic_id', 'kind', 'x', 'y', 'w', 'h', 'end_x', 'end_y', 'text', 'color', 'fill', 'role', 'region_id', 'rotation', 'opacity'])) {
        addError(errors, 'UNKNOWN_FIELD', 'create contains an unknown field.', path);
      }
      const semantic_id = stableSemanticId(raw.semantic_id, `${path}.semantic_id`, existingSemanticIds, errors);
      if (!CANVAS_CREATE_KINDS.includes(raw.kind as CanvasCreateKind)) addError(errors, 'INVALID_CREATE_KIND', 'create kind is not a supported native tldraw primitive.', `${path}.kind`);
      if (!inRange(raw.x, -MAX_COORDINATE, MAX_COORDINATE) || !inRange(raw.y, -MAX_COORDINATE, MAX_COORDINATE)) {
        addError(errors, 'INVALID_NUMBER', 'create requires bounded finite x and y page coordinates.', path);
      }
      const kind = raw.kind as CanvasCreateKind;
      const isArrow = kind === 'arrow';
      if (isArrow && (!inRange(raw.end_x, -MAX_COORDINATE, MAX_COORDINATE) || !inRange(raw.end_y, -MAX_COORDINATE, MAX_COORDINATE))) {
        addError(errors, 'INVALID_ARROW_END', 'arrow creation requires bounded finite end_x and end_y page coordinates.', path);
      }
      if (!isArrow && (raw.end_x !== undefined || raw.end_y !== undefined)) addError(errors, 'UNSUPPORTED_FIELD', 'end_x and end_y are only available for arrows.', path);
      if (isArrow && (raw.w !== undefined || raw.h !== undefined)) addError(errors, 'UNSUPPORTED_FIELD', 'Arrow bounds come from x, y, end_x, and end_y.', path);
      if (raw.w !== undefined && !inRange(raw.w, 16, MAX_DIMENSION)) addError(errors, 'INVALID_DIMENSION', `create w must be from 16 to ${MAX_DIMENSION}.`, `${path}.w`);
      if (raw.h !== undefined && !inRange(raw.h, 16, MAX_DIMENSION)) addError(errors, 'INVALID_DIMENSION', `create h must be from 16 to ${MAX_DIMENSION}.`, `${path}.h`);
      if (raw.text !== undefined && (typeof raw.text !== 'string' || raw.text.length > MAX_TEXT)) addError(errors, 'INVALID_TEXT', `text must be at most ${MAX_TEXT} characters.`, `${path}.text`);
      if (raw.color !== undefined && !CANVAS_OP_COLORS.includes(raw.color as CanvasOpColor)) addError(errors, 'INVALID_COLOR', 'Unknown create color.', `${path}.color`);
      if (raw.fill !== undefined && !CANVAS_OP_FILLS.includes(raw.fill as CanvasOpFill)) addError(errors, 'INVALID_FILL', 'Unknown create fill.', `${path}.fill`);
      if (raw.role !== undefined && (typeof raw.role !== 'string' || raw.role.length < 1 || raw.role.length > MAX_ROLE)) addError(errors, 'INVALID_ROLE', `role must be a bounded string of 1-${MAX_ROLE} characters.`, `${path}.role`);
      if (raw.region_id !== undefined && (typeof raw.region_id !== 'string' || !STABLE_ID.test(raw.region_id))) addError(errors, 'INVALID_REGION_ID', 'region_id must be a bounded lexical stable ID.', `${path}.region_id`);
      if (raw.rotation !== undefined && !inRange(raw.rotation, -Math.PI * 4, Math.PI * 4)) addError(errors, 'INVALID_NUMBER', 'rotation must be a bounded finite number.', `${path}.rotation`);
      if (raw.opacity !== undefined && !inRange(raw.opacity, 0, 1)) addError(errors, 'INVALID_NUMBER', 'opacity must be from 0 to 1.', `${path}.opacity`);
      const geoKind = ['rectangle', 'ellipse', 'diamond', 'triangle', 'cloud'].includes(kind);
      if (raw.fill !== undefined && !geoKind) addError(errors, 'UNSUPPORTED_FILL_TARGET', 'Only created geometry shapes expose bounded fill.', `${path}.fill`);
      if (semantic_id && CANVAS_CREATE_KINDS.includes(kind) && inRange(raw.x, -MAX_COORDINATE, MAX_COORDINATE) && inRange(raw.y, -MAX_COORDINATE, MAX_COORDINATE)) {
        const defaultSize = kind === 'text'
          ? { w: 240, h: 64 }
          : kind === 'frame'
            ? { w: 360, h: 260 }
            : kind === 'note'
              ? { w: 220, h: 180 }
              : { w: 180, h: 120 };
        const w = isArrow && finite(raw.end_x) ? Math.max(1, Math.abs(raw.end_x - raw.x)) : finite(raw.w) ? raw.w : defaultSize.w;
        const h = isArrow && finite(raw.end_y) ? Math.max(1, Math.abs(raw.end_y - raw.y)) : finite(raw.h) ? raw.h : defaultSize.h;
        const rotation = raw.rotation === undefined ? 0 : raw.rotation as number;
        const opacity = raw.opacity === undefined ? 1 : raw.opacity as number;
        if (isArrow && finite(raw.end_x) && finite(raw.end_y)) {
          requireFootprint({
            x: Math.min(raw.x, raw.end_x),
            y: Math.min(raw.y, raw.end_y),
            w: Math.abs(raw.end_x - raw.x),
            h: Math.abs(raw.end_y - raw.y),
            rotation,
          }, path, errors);
        } else {
          requireFootprint({ x: raw.x, y: raw.y, w, h, rotation }, path, errors);
        }
        const op: CreateCanvasOp = {
          op: 'create', semantic_id, kind, x: raw.x, y: raw.y,
          ...(raw.w === undefined ? {} : { w: raw.w as number }),
          ...(raw.h === undefined ? {} : { h: raw.h as number }),
          ...(raw.end_x === undefined ? {} : { end_x: raw.end_x as number }),
          ...(raw.end_y === undefined ? {} : { end_y: raw.end_y as number }),
          ...(raw.text === undefined ? {} : { text: raw.text as string }),
          ...(raw.color === undefined ? {} : { color: raw.color as CanvasOpColor }),
          ...(raw.fill === undefined ? {} : { fill: raw.fill as CanvasOpFill }),
          ...(raw.role === undefined ? {} : { role: raw.role as string }),
          ...(raw.region_id === undefined ? {} : { region_id: raw.region_id as string }),
          ...(raw.rotation === undefined ? {} : { rotation: raw.rotation as number }),
          ...(raw.opacity === undefined ? {} : { opacity: raw.opacity as number }),
        };
        const id = pendingId(semantic_id);
        if (projected.has(id)) addError(errors, 'DUPLICATE_TARGET_ID', 'Generated pending target id collides with current page content.', `${path}.semantic_id`);
        else {
          const type = geoKind ? 'geo' : kind;
          projected.set(id, {
            id,
            type,
            kind,
            x: raw.x,
            y: raw.y,
            w,
            h,
            rotation,
            opacity,
            parent_id: pageId,
            semantic_id,
            text: typeof raw.text === 'string' ? raw.text : '',
            props: { color: raw.color ?? 'black', fill: raw.fill ?? 'none' },
            meta: {
              ...(normalizedCompositionId ? { composition_id: normalizedCompositionId } : {}),
              ...(typeof raw.role === 'string' ? { role: raw.role } : {}),
              ...(typeof raw.region_id === 'string' ? { region_id: raw.region_id } : {}),
            },
          });
          semanticToId.set(semantic_id, id);
          normalized.push(op);
          steps.push({ kind: 'create', op, pending_id: id, bounds: { x: raw.x, y: raw.y, w, h } });
          adds.push({
            kind,
            semantic_id,
            label: typeof raw.text === 'string' && raw.text.trim() ? raw.text.slice(0, 120) : kind,
            x: raw.x,
            y: raw.y,
            w,
            h,
            ...(normalizedCompositionId ? { composition_id: normalizedCompositionId } : {}),
            ...(typeof raw.role === 'string' ? { role: raw.role } : {}),
            ...(typeof raw.region_id === 'string' ? { region_id: raw.region_id } : {}),
            ...(raw.rotation === undefined ? {} : { rotation: raw.rotation as number }),
            ...(raw.opacity === undefined ? {} : { opacity: raw.opacity as number }),
          });
        }
      }
      return;
    }

    if (raw.op === 'draw') {
      if (!hasOnlyKeys(raw, ['op', 'semantic_id', 'points', 'color', 'fill', 'size', 'closed'])) {
        addError(errors, 'UNKNOWN_FIELD', 'draw contains an unknown field.', path);
      }
      const semantic_id = stableSemanticId(raw.semantic_id, `${path}.semantic_id`, existingSemanticIds, errors);
      const rawPoints = Array.isArray(raw.points) ? raw.points : null;
      const pointCountValid = rawPoints !== null
        && rawPoints.length >= 2
        && rawPoints.length <= FOGWOOD_CANVAS_PROTOCOL.max_draw_points;
      if (!pointCountValid) {
        addError(errors, 'INVALID_DRAW_POINTS', `draw requires 2-${FOGWOOD_CANVAS_PROTOCOL.max_draw_points} valid points.`, `${path}.points`);
      }
      const points = pointCountValid ? rawPoints.flatMap((point, pointIndex) => {
        if (!isRecord(point) || !hasOnlyKeys(point, ['x', 'y']) || !inRange(point.x, -MAX_COORDINATE, MAX_COORDINATE) || !inRange(point.y, -MAX_COORDINATE, MAX_COORDINATE)) {
          addError(errors, 'INVALID_DRAW_POINT', 'Every draw point needs bounded finite x and y values.', `${path}.points[${pointIndex}]`);
          return [];
        }
        return [{ x: point.x, y: point.y }];
      }) : [];
      if (rawPoints && pointCountValid && points.length !== rawPoints.length) {
        addError(errors, 'INVALID_DRAW_POINTS', `draw requires 2-${FOGWOOD_CANVAS_PROTOCOL.max_draw_points} valid points.`, `${path}.points`);
      }
      for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
        const dx = points[pointIndex].x - points[pointIndex - 1].x;
        const dy = points[pointIndex].y - points[pointIndex - 1].y;
        if (Math.abs(dx) > MAX_DRAW_DELTA || Math.abs(dy) > MAX_DRAW_DELTA) {
          addError(
            errors,
            'DRAW_DELTA_LIMIT',
            `Consecutive draw-point deltas must be at most ${MAX_DRAW_DELTA} so tldraw's Float16 path encoding stays finite.`,
            `${path}.points[${pointIndex}]`,
          );
        }
      }
      if (raw.color !== undefined && !CANVAS_OP_COLORS.includes(raw.color as CanvasOpColor)) addError(errors, 'INVALID_COLOR', 'Unknown draw color.', `${path}.color`);
      if (raw.fill !== undefined && !CANVAS_OP_FILLS.includes(raw.fill as CanvasOpFill)) addError(errors, 'INVALID_FILL', 'Unknown draw fill.', `${path}.fill`);
      if (raw.size !== undefined && !CANVAS_OP_SIZES.includes(raw.size as CanvasOpSize)) addError(errors, 'INVALID_SIZE', 'Unknown draw size.', `${path}.size`);
      if (raw.closed !== undefined && typeof raw.closed !== 'boolean') addError(errors, 'INVALID_BOOLEAN', 'closed must be boolean.', `${path}.closed`);
      if (points.length >= 2 && semantic_id) {
        const op: DrawCanvasOp = {
          op: 'draw',
          semantic_id,
          points,
          ...(raw.color === undefined ? {} : { color: raw.color as CanvasOpColor }),
          ...(raw.fill === undefined ? {} : { fill: raw.fill as CanvasOpFill }),
          ...(raw.size === undefined ? {} : { size: raw.size as CanvasOpSize }),
          ...(raw.closed === undefined ? {} : { closed: raw.closed as boolean }),
        };
        const bounds = pointBounds(points);
        const id = pendingId(semantic_id);
        if (projected.has(id)) addError(errors, 'DUPLICATE_TARGET_ID', 'Generated pending target id collides with current page content.', `${path}.semantic_id`);
        else {
          projected.set(id, {
            id,
            type: 'draw',
            kind: 'draw',
            ...bounds,
            rotation: 0,
            opacity: 1,
            parent_id: pageId,
            semantic_id,
            props: { color: op.color ?? 'black', fill: op.fill ?? 'none' },
            meta: normalizedCompositionId ? { composition_id: normalizedCompositionId } : {},
          });
          semanticToId.set(semantic_id, id);
        }
        normalized.push(op);
        steps.push({ kind: 'draw', op, pending_id: id, bounds });
        adds.push({
          kind: 'draw',
          semantic_id,
          label: 'Freehand path',
          ...bounds,
          ...(normalizedCompositionId ? { composition_id: normalizedCompositionId } : {}),
        });
      }
      return;
    }

    if (raw.op === 'connect') {
      if (!hasOnlyKeys(raw, ['op', 'semantic_id', 'from_id', 'to_id', 'text', 'color', 'relationship_id', 'relationship_kind'])) {
        addError(errors, 'UNKNOWN_FIELD', 'connect contains an unknown field.', path);
      }
      const semantic_id = stableSemanticId(raw.semantic_id, `${path}.semantic_id`, existingSemanticIds, errors);
      const hasRelationshipId = raw.relationship_id !== undefined;
      const hasRelationshipKind = raw.relationship_kind !== undefined;
      const typedRelationship = hasRelationshipId || hasRelationshipKind;
      if (hasRelationshipId !== hasRelationshipKind) {
        addError(errors, 'RELATIONSHIP_FIELDS_PAIR', 'relationship_id and relationship_kind must be provided together.', path);
      }
      if (typedRelationship && hasRelationshipId && hasRelationshipKind) {
        if (typeof raw.relationship_id !== 'string' || !STABLE_ID.test(raw.relationship_id)) {
          addError(errors, 'INVALID_RELATIONSHIP_ID', 'relationship_id must be a bounded lexical stable ID.', `${path}.relationship_id`);
        }
        if (!SEMANTIC_RELATIONSHIP_KINDS.includes(raw.relationship_kind as (typeof SEMANTIC_RELATIONSHIP_KINDS)[number])) {
          addError(errors, 'INVALID_RELATIONSHIP_KIND', 'relationship_kind must be one of the supported semantic relationship kinds.', `${path}.relationship_kind`);
        }
        if (typeof raw.relationship_id === 'string' && STABLE_ID.test(raw.relationship_id)
          && semantic_id !== relationshipSemanticId(raw.relationship_id)) {
          addError(errors, 'RELATIONSHIP_SEMANTIC_ID_MISMATCH', 'A typed connector semantic_id must equal relationshipSemanticId(relationship_id).', `${path}.semantic_id`);
        }
      }
      const fromId = resolveTargetId(raw.from_id, `${path}.from_id`, projected, semanticToId, errors);
      const toId = resolveTargetId(raw.to_id, `${path}.to_id`, projected, semanticToId, errors);
      const from = fromId ? projected.get(fromId) : undefined;
      const to = toId ? projected.get(toId) : undefined;
      if (from && to && from.id === to.id) addError(errors, 'SELF_CONNECTOR', 'A bound connector needs two distinct endpoints.', path);
      for (const [terminal, item] of [['from_id', from], ['to_id', to]] as const) {
        if (!item) continue;
        if (effectivelyLocked(item, projected)) addError(errors, 'LOCKED_TARGET', 'Locked shapes and shapes under locked ancestors cannot be connected.', `${path}.${terminal}`);
        if (item.parent_id !== pageId) addError(errors, 'NESTED_TARGET', 'Bound connector endpoints must be direct children of the current page.', `${path}.${terminal}`);
        if (!CONNECT_TARGET_TYPES.has(item.type)) addError(errors, 'UNSUPPORTED_CONNECT_TARGET', 'Bound connectors support native matter and surface blocks, not arrows, groups, or unknown shapes.', `${path}.${terminal}`);
        if (Math.abs(item.rotation ?? 0) > 1e-9) addError(errors, 'ROTATED_CONNECT_TARGET', 'Canvas Protocol v2 bound connectors require unrotated inspected endpoints.', `${path}.${terminal}`);
        if (typedRelationship && !hasDurableSemanticId(item)) addError(errors, 'UNSTABLE_RELATIONSHIP_ENDPOINT', 'Typed connectors require endpoints with stable semantic IDs.', `${path}.${terminal}`);
      }
      if (raw.text !== undefined && (typeof raw.text !== 'string' || raw.text.length > MAX_CONNECTOR_LABEL)) addError(errors, 'INVALID_TEXT', `Connector text must be at most ${MAX_CONNECTOR_LABEL} characters so its visible and inspectable labels remain identical.`, `${path}.text`);
      if (raw.color !== undefined && !CANVAS_OP_COLORS.includes(raw.color as CanvasOpColor)) addError(errors, 'INVALID_COLOR', 'Unknown connector color.', `${path}.color`);
      if (semantic_id && from && to && from.id !== to.id) {
        const start = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
        const end = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
        const bounds = {
          x: Math.min(start.x, end.x),
          y: Math.min(start.y, end.y),
          w: Math.abs(end.x - start.x),
          h: Math.abs(end.y - start.y),
        };
        requireFootprint(bounds, path, errors);
        const op: ConnectCanvasOp = {
          op: 'connect',
          semantic_id,
          from_id: from.id,
          to_id: to.id,
          ...(raw.text === undefined ? {} : { text: raw.text as string }),
          ...(raw.color === undefined ? {} : { color: raw.color as CanvasOpColor }),
          ...(typedRelationship && typeof raw.relationship_id === 'string' && SEMANTIC_RELATIONSHIP_KINDS.includes(raw.relationship_kind as (typeof SEMANTIC_RELATIONSHIP_KINDS)[number])
            ? {
                relationship_id: raw.relationship_id,
                relationship_kind: raw.relationship_kind as ConnectCanvasOp['relationship_kind'],
              }
            : {}),
        };
        const id = pendingId(semantic_id);
        if (projected.has(id)) addError(errors, 'DUPLICATE_TARGET_ID', 'Generated pending connector id collides with current page content.', `${path}.semantic_id`);
        else {
          projected.set(id, {
            id,
            type: 'arrow',
            kind: 'arrow',
            x: start.x,
            y: start.y,
            w: Math.max(1, bounds.w),
            h: Math.max(1, bounds.h),
            rotation: 0,
            opacity: 1,
            parent_id: pageId,
            semantic_id,
            text: typeof raw.text === 'string' ? raw.text : '',
            props: { color: raw.color ?? 'black', fill: 'none' },
            meta: {
              ...(normalizedCompositionId ? { composition_id: normalizedCompositionId } : {}),
              role: typedRelationship ? 'semantic-relationship' : 'bound-connector',
              ...(typedRelationship && typeof raw.relationship_id === 'string' ? { relationship_id: raw.relationship_id } : {}),
              ...(typedRelationship && typeof raw.relationship_kind === 'string' ? { relationship_kind: raw.relationship_kind } : {}),
              ...(from.semantic_id ? { source_semantic_id: from.semantic_id } : {}),
              ...(to.semantic_id ? { target_semantic_id: to.semantic_id } : {}),
              ...(typedRelationship && typeof raw.text === 'string' ? { relationship_label: raw.text } : {}),
            },
            binding_count: 2,
          });
          from.binding_count = (from.binding_count ?? 0) + 1;
          to.binding_count = (to.binding_count ?? 0) + 1;
          semanticToId.set(semantic_id, id);
          normalized.push(op);
          steps.push({
            kind: 'connect',
            op,
            pending_id: id,
            from: { id: from.id, type: from.type, ...(from.semantic_id ? { semantic_id: from.semantic_id } : {}) },
            to: { id: to.id, type: to.type, ...(to.semantic_id ? { semantic_id: to.semantic_id } : {}) },
            bounds,
          });
          adds.push({
            kind: 'connector',
            semantic_id,
            label: typeof raw.text === 'string' && raw.text.trim() ? raw.text.slice(0, 120) : 'Bound connector',
            ...bounds,
            role: typedRelationship ? 'semantic-relationship' : 'bound-connector',
            ...(normalizedCompositionId ? { composition_id: normalizedCompositionId } : {}),
          });
        }
      }
      return;
    }

    if (raw.op === 'variant') {
      if (!hasOnlyKeys(raw, ['op', 'id', 'semantic_id', 'offset_x', 'offset_y'])) {
        addError(errors, 'UNKNOWN_FIELD', 'variant contains an unknown field.', path);
      }
      const semantic_id = stableSemanticId(raw.semantic_id, `${path}.semantic_id`, existingSemanticIds, errors);
      const sourceId = resolveTargetId(raw.id, `${path}.id`, projected, semanticToId, errors);
      const source = sourceId ? projected.get(sourceId) : undefined;
      const offsetX = raw.offset_x === undefined ? 48 : raw.offset_x;
      const offsetY = raw.offset_y === undefined ? 48 : raw.offset_y;
      if (!inRange(offsetX, -MAX_VARIANT_OFFSET, MAX_VARIANT_OFFSET) || !inRange(offsetY, -MAX_VARIANT_OFFSET, MAX_VARIANT_OFFSET)) {
        addError(errors, 'INVALID_VARIANT_OFFSET', `variant offsets must be bounded finite numbers within ±${MAX_VARIANT_OFFSET}.`, path);
      }
      if (offsetX === 0 && offsetY === 0) addError(errors, 'INVALID_VARIANT_OFFSET', 'A preserved variant must be visibly offset from its source.', path);
      if (source) {
        if (source.id.startsWith('pending:')) addError(errors, 'PENDING_VARIANT_SOURCE', 'Canvas Protocol v2 variants preserve existing page matter, not matter created earlier in the same action.', `${path}.id`);
        if (effectivelyLocked(source, projected)) addError(errors, 'LOCKED_TARGET', 'Locked shapes and shapes under locked ancestors cannot be used as variant sources.', `${path}.id`);
        if (!VARIANT_TARGET_TYPES.has(source.type)) addError(errors, 'UNSUPPORTED_VARIANT_TARGET', 'Variants support bounded native shapes and local images, not blocks, arrows, groups, or unknown shapes.', `${path}.id`);
        if (!source.semantic_id || !STABLE_ID.test(source.semantic_id) || source.meta?.semantic_id_source !== 'stable') {
          addError(errors, 'UNSTABLE_VARIANT_SOURCE', 'A preserved variant requires one source with a stable semantic id.', `${path}.id`);
        }
      }
      if (semantic_id && source && source.semantic_id && finite(offsetX) && finite(offsetY)) {
        const projection = requireTransform(source, pageId, `${path}.id`, errors);
        if (!projection) return;
        const translated = translateProjectedGeometry(projection, offsetX, offsetY);
        const localPosition = pagePointToParentLocal(projection, translated.page_origin);
        const translatedProjection = createTransformProjection({
          parent_id: projection.parent_id,
          parent_to_page: projection.parent_to_page,
          local_to_page: { ...projection.local_to_page, e: translated.page_origin.x, f: translated.page_origin.y },
          local_bounds: projection.local_bounds,
          locked_ancestor: false,
        });
        const bounds = translated.page_bounds;
        requireFootprint(bounds, path, errors);
        const op: VariantCanvasOp = { op: 'variant', id: source.id, semantic_id, offset_x: offsetX, offset_y: offsetY };
        const id = pendingId(semantic_id);
        if (projected.has(id)) addError(errors, 'DUPLICATE_TARGET_ID', 'Generated pending variant id collides with current page content.', `${path}.semantic_id`);
        else {
          const parentVariantId = typeof source.meta?.variant_id === 'string' ? source.meta.variant_id : undefined;
          const lineage = {
            variant_id: semantic_id,
            lineage_source_id: source.semantic_id,
            ...(parentVariantId ? { parent_variant_id: parentVariantId } : {}),
          };
          projected.set(id, {
            ...cloneItem(source),
            id,
            x: localPosition.x,
            y: localPosition.y,
            parent_id: source.parent_id,
            transform: translatedProjection,
            semantic_id,
            is_locked: false,
            index: undefined,
            binding_count: 0,
            meta: { ...(source.meta ?? {}), role: 'variant', semantic_id, ...lineage },
          });
          semanticToId.set(semantic_id, id);
          normalized.push(op);
          steps.push({
            kind: 'variant',
            op,
            pending_id: id,
            source: { id: source.id, type: source.type, semantic_id: source.semantic_id, transform_fingerprint: projection.fingerprint, parent_id: projection.parent_id },
            local_position: { x: localPosition.x, y: localPosition.y },
            bounds,
            geometry: pageGeometry(translatedProjection),
            lineage,
          });
          adds.push({
            kind: 'variant',
            semantic_id,
            label: `Variant of ${(source.text || source.semantic_id).slice(0, 100)}`,
            ...bounds,
            ...(normalizedCompositionId ? { composition_id: normalizedCompositionId } : {}),
            role: 'variant',
            ...lineage,
          });
        }
      }
      return;
    }

    if (raw.op === 'update') {
      if (!hasOnlyKeys(raw, ['op', 'id', 'x', 'y', 'rotation', 'opacity', 'text', 'color', 'fill'])) {
        addError(errors, 'UNKNOWN_FIELD', 'update contains an unknown field.', path);
      }
      if (raw.text !== undefined && (raw.x !== undefined || raw.y !== undefined || raw.rotation !== undefined)) {
        addError(
          errors,
          'SPLIT_CONTENT_GEOMETRY_UPDATE',
          'Text reflow and exact geometry changes require separate reviewed updates so the transform preview stays truthful.',
          path,
        );
      }
      const resolvedId = resolveTargetId(raw.id, `${path}.id`, projected, semanticToId, errors);
      const item = resolvedId ? projected.get(resolvedId) : undefined;
      if (item && effectivelyLocked(item, projected)) addError(errors, 'LOCKED_TARGET', 'Locked shapes and shapes under locked ancestors cannot be changed.', `${path}.id`);
      if (item && hasLockedDescendant(item, childrenByParent)) addError(errors, 'LOCKED_DESCENDANT', 'A container with locked descendants cannot be changed.', `${path}.id`);
      const projection = requireTransform(item, pageId, `${path}.id`, errors);
      const target = item && projection ? preparedTransformTarget(item, projection) : undefined;
      const fields: DiffFields = {};
      const op: UpdateCanvasOp = { op: 'update', id: resolvedId };
      const nextPageOrigin = projection ? { ...projection.page_origin } : undefined;
      for (const key of ['x', 'y'] as const) {
        if (raw[key] === undefined) continue;
        if (!inRange(raw[key], -MAX_COORDINATE, MAX_COORDINATE)) addError(errors, 'INVALID_NUMBER', `${key} must be a bounded finite number.`, `${path}.${key}`);
        else if (item) {
          op[key] = raw[key];
          fields[key] = { before: projection?.page_origin[key] ?? item[key], after: raw[key] };
          if (nextPageOrigin) nextPageOrigin[key] = raw[key];
        }
      }
      if (raw.rotation !== undefined) {
        if (!inRange(raw.rotation, -Math.PI * 4, Math.PI * 4)) addError(errors, 'INVALID_NUMBER', 'rotation must be a bounded finite number.', `${path}.rotation`);
        else if (item) {
          const beforeRotation = item.rotation ?? 0;
          if (item.parent_id !== pageId && raw.rotation !== beforeRotation) {
            addError(errors, 'NESTED_ROTATION_TARGET', 'Exact rotation changes currently require a direct-page shape; nested style and movement remain supported.', `${path}.rotation`);
          } else {
            op.rotation = raw.rotation;
            fields.rotation = { before: beforeRotation, after: raw.rotation };
            item.rotation = raw.rotation;
          }
        }
      }
      if (raw.opacity !== undefined) {
        if (!inRange(raw.opacity, 0, 1)) addError(errors, 'INVALID_NUMBER', 'opacity must be from 0 to 1.', `${path}.opacity`);
        else if (item) {
          op.opacity = raw.opacity;
          fields.opacity = { before: item.opacity ?? 1, after: raw.opacity };
          item.opacity = raw.opacity;
        }
      }
      if (raw.text !== undefined) {
        if (typeof raw.text !== 'string' || raw.text.length > MAX_CONNECTOR_LABEL) addError(errors, 'INVALID_TEXT', `Updated text must be at most ${MAX_CONNECTOR_LABEL} characters so its visible and inspected forms remain aligned.`, `${path}.text`);
        else if (item) {
          if (!['geo', 'note', 'text', 'arrow', 'frame'].includes(item.type)) addError(errors, 'UNSUPPORTED_TEXT_TARGET', 'This shape type does not expose bounded editable text.', `${path}.text`);
          op.text = raw.text;
          fields.text = { before: item.text ?? '', after: raw.text };
          item.text = raw.text;
        }
      }
      if (raw.color !== undefined) {
        if (!CANVAS_OP_COLORS.includes(raw.color as CanvasOpColor)) addError(errors, 'INVALID_COLOR', 'Unknown update color.', `${path}.color`);
        else if (item) {
          if (!['geo', 'note', 'text', 'arrow', 'frame', 'draw'].includes(item.type)) addError(errors, 'UNSUPPORTED_COLOR_TARGET', 'This shape type does not expose a bounded color.', `${path}.color`);
          op.color = raw.color as CanvasOpColor;
          fields.color = { before: item.props?.color, after: raw.color };
          item.props = { ...(item.props ?? {}), color: raw.color };
        }
      }
      if (raw.fill !== undefined) {
        if (!CANVAS_OP_FILLS.includes(raw.fill as CanvasOpFill)) addError(errors, 'INVALID_FILL', 'Unknown update fill.', `${path}.fill`);
        else if (item) {
          if (!['geo', 'draw'].includes(item.type)) addError(errors, 'UNSUPPORTED_FILL_TARGET', 'Only geometry and draw shapes expose bounded fill.', `${path}.fill`);
          op.fill = raw.fill as CanvasOpFill;
          fields.fill = { before: item.props?.fill, after: raw.fill };
          item.props = { ...(item.props ?? {}), fill: raw.fill };
        }
      }
      if (Object.keys(fields).length === 0) addError(errors, 'NO_OP', 'update must provide at least one changed field.', path);
      if (item && Object.values(fields).every((field) => JSON.stringify(field.before) === JSON.stringify(field.after))) {
        addError(errors, 'NO_OP', 'update does not change the target.', path);
      }
      if (item && Object.keys(fields).length > 0) {
        let afterProjection = projection;
        let localPosition: { x: number; y: number } | undefined;
        if (projection && nextPageOrigin) {
          localPosition = pagePointToParentLocal(projection, nextPageOrigin);
          const rotation = op.rotation ?? item.rotation ?? 0;
          const cos = Math.cos(rotation);
          const sin = Math.sin(rotation);
          afterProjection = createTransformProjection({
            parent_id: projection.parent_id,
            parent_to_page: projection.parent_to_page,
            local_to_page: item.parent_id === pageId
              ? { a: cos, b: sin, c: -sin, d: cos, e: nextPageOrigin.x, f: nextPageOrigin.y }
              : { ...projection.local_to_page, e: nextPageOrigin.x, f: nextPageOrigin.y },
            local_bounds: projection.local_bounds,
            locked_ancestor: projection.locked_ancestor,
          });
          item.x = localPosition.x;
          item.y = localPosition.y;
          item.transform = afterProjection;
        }
        requireFootprint(afterProjection?.page_bounds ?? item, path, errors);
        normalized.push(op);
        if (target && afterProjection) steps.push({ kind: 'update', op, fields, target, ...(localPosition ? { local_position: localPosition } : {}), after_page_geometry: pageGeometry(afterProjection) });
        updates.push({ ids: [item.id], fields: Object.keys(fields), changes: [{ id: item.id, fields }] });
      }
      return;
    }

    if (raw.op === 'resize') {
      if (!hasOnlyKeys(raw, ['op', 'id', 'w', 'h'])) addError(errors, 'UNKNOWN_FIELD', 'resize contains an unknown field.', path);
      const resolvedId = resolveTargetId(raw.id, `${path}.id`, projected, semanticToId, errors);
      const item = resolvedId ? projected.get(resolvedId) : undefined;
      if (item && effectivelyLocked(item, projected)) addError(errors, 'LOCKED_TARGET', 'Locked shapes and shapes under locked ancestors cannot be resized.', `${path}.id`);
      if (item && hasLockedDescendant(item, childrenByParent)) addError(errors, 'LOCKED_DESCENDANT', 'A container with locked descendants cannot be resized.', `${path}.id`);
      if (item && (item.type === 'note' || item.type === 'group')) {
        addError(errors, 'UNSUPPORTED_RESIZE_TARGET', 'Canvas Protocol v1 does not resize note or group shapes.', `${path}.id`);
      }
      if (item && !TRANSFORM_TARGET_TYPES.has(item.type)) {
        addError(errors, 'UNSUPPORTED_RESIZE_TARGET', 'This native shape type does not have an exact bounded Fogwood resize lowering.', `${path}.id`);
      }
      const projection = requireTransform(item, pageId, `${path}.id`, errors);
      const sourceHasArea = Boolean(
        projection
        && projection.local_bounds.w > TRANSFORM_EPSILON
        && projection.local_bounds.h > TRANSFORM_EPSILON,
      );
      if (projection && !sourceHasArea) {
        addError(errors, 'UNSUPPORTED_SOURCE_DIMENSION', 'Resize requires source geometry with non-zero local width and height.', `${path}.id`);
      }
      if (!inRange(raw.w, 16, MAX_DIMENSION) || !inRange(raw.h, 16, MAX_DIMENSION)) {
        addError(errors, 'INVALID_DIMENSION', `resize w and h must be from 16 to ${MAX_DIMENSION}.`, path);
      }
      if (item && projection && sourceHasArea && finite(raw.w) && finite(raw.h)) {
        if (projection.local_bounds.w === raw.w && projection.local_bounds.h === raw.h) addError(errors, 'NO_OP', 'resize does not change the target.', path);
        const op: ResizeCanvasOp = { op: 'resize', id: item.id, w: raw.w, h: raw.h };
        const target = preparedTransformTarget(item, projection);
        const afterProjection = createTransformProjection({
          parent_id: projection.parent_id,
          parent_to_page: projection.parent_to_page,
          local_to_page: projection.local_to_page,
          local_bounds: { ...projection.local_bounds, w: raw.w, h: raw.h },
          locked_ancestor: projection.locked_ancestor,
        });
        const before = pageGeometry(projection);
        const after = pageGeometry(afterProjection);
        requireFootprint(after.bounds, path, errors);
        item.w = after.bounds.w;
        item.h = after.bounds.h;
        item.transform = afterProjection;
        normalized.push(op);
        steps.push({ kind: 'resize', op, target, scale: { x: raw.w / projection.local_bounds.w, y: raw.h / projection.local_bounds.h }, before, after });
        updates.push({
          ids: [item.id],
          fields: ['w', 'h'],
          changes: [{ id: item.id, fields: { w: { before: projection.local_bounds.w, after: raw.w }, h: { before: projection.local_bounds.h, after: raw.h }, page_geometry: { before, after } } }],
        });
      }
      return;
    }

    if (raw.op === 'align' || raw.op === 'distribute' || raw.op === 'stack' || raw.op === 'pack') {
      const keys = raw.op === 'align'
        ? ['op', 'ids', 'axis']
        : raw.op === 'pack'
          ? ['op', 'ids', 'gap']
          : raw.op === 'stack'
            ? ['op', 'ids', 'axis', 'gap']
            : ['op', 'ids', 'axis'];
      if (!hasOnlyKeys(raw, keys)) addError(errors, 'UNKNOWN_FIELD', `${raw.op} contains an unknown field.`, path);
      const min = raw.op === 'distribute' ? 3 : 2;
      const items = normalizeIds(raw.ids, `${path}.ids`, min, FOGWOOD_CANVAS_PROTOCOL.max_targets_per_op, projected, semanticToId, childrenByParent, pageId, errors, true);
      requireSameParent(items, `${path}.ids`, errors);
      const projections = new Map(items.flatMap((item, index) => {
        const projection = requireTransform(item, pageId, `${path}.ids[${index}]`, errors);
        return projection ? [[item.id, projection] as const] : [];
      }));
      let op: AlignCanvasOp | DistributeCanvasOp | StackCanvasOp | PackCanvasOp | undefined;
      if (raw.op === 'align') {
        if (!ALIGN_AXES.includes(raw.axis as AlignAxis)) addError(errors, 'INVALID_AXIS', 'Unknown align axis.', `${path}.axis`);
        else op = { op: 'align', ids: items.map((item) => item.id), axis: raw.axis as AlignAxis };
      }
      if (raw.op === 'distribute') {
        if (!ORIENTATIONS.includes(raw.axis as Orientation)) addError(errors, 'INVALID_AXIS', 'Unknown distribute axis.', `${path}.axis`);
        else op = { op: 'distribute', ids: items.map((item) => item.id), axis: raw.axis as Orientation };
      }
      if (raw.op === 'stack') {
        if (!ORIENTATIONS.includes(raw.axis as Orientation)) addError(errors, 'INVALID_AXIS', 'Unknown stack axis.', `${path}.axis`);
        if (raw.gap !== undefined && !inRange(raw.gap, 0, 10_000)) addError(errors, 'INVALID_GAP', 'stack gap must be from 0 to 10000.', `${path}.gap`);
        if (ORIENTATIONS.includes(raw.axis as Orientation) && (raw.gap === undefined || finite(raw.gap))) {
          op = { op: 'stack', ids: items.map((item) => item.id), axis: raw.axis as Orientation, ...(raw.gap === undefined ? {} : { gap: raw.gap }) };
        }
      }
      if (raw.op === 'pack') {
        if (raw.gap !== undefined && !inRange(raw.gap, 0, 10_000)) addError(errors, 'INVALID_GAP', 'pack gap must be from 0 to 10000.', `${path}.gap`);
        if (raw.gap === undefined || finite(raw.gap)) op = { op: 'pack', ids: items.map((item) => item.id), ...(raw.gap === undefined ? {} : { gap: raw.gap }) };
      }
      if (op && items.length >= min) {
        const layoutItems = items.map((item) => {
          const bounds = projections.get(item.id)?.page_bounds;
          return bounds ? { ...item, x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h } : item;
        });
        const pagePlacements = layoutPlacements(op, layoutItems);
        const placements = pagePlacements.flatMap((placement) => {
          const item = projected.get(placement.id)!;
          const projection = projections.get(placement.id);
          if (!projection) return [];
          const dx = placement.x - projection.page_bounds.x;
          const dy = placement.y - projection.page_bounds.y;
          const translated = translateProjectedGeometry(projection, dx, dy);
          const local = pagePointToParentLocal(projection, translated.page_origin);
          return [{
            id: item.id,
            type: item.type,
            parent_id: projection.parent_id,
            transform_fingerprint: projection.fingerprint,
            local_x: local.x,
            local_y: local.y,
            rotation: item.rotation ?? 0,
            before: pageGeometry(projection),
            after: { origin: translated.page_origin, bounds: translated.page_bounds, corners: translated.page_corners, rotation: projection.page_rotation },
          }];
        });
        const exceedsCoordinateLimit = placements.some((placement) =>
          !inRange(placement.after.bounds.x, -MAX_COORDINATE, MAX_COORDINATE)
          || !inRange(placement.after.bounds.y, -MAX_COORDINATE, MAX_COORDINATE));
        if (exceedsCoordinateLimit) {
          addError(
            errors,
            'LAYOUT_COORDINATE_LIMIT',
            `Computed ${raw.op} positions must stay within ±${MAX_COORDINATE} page coordinates.`,
            path,
          );
        }
        const exceedsFootprintLimit = placements.some((placement) => !footprintWithinBounds(placement.after.bounds));
        if (exceedsFootprintLimit) {
          addError(errors, 'FOOTPRINT_LIMIT', `Computed ${raw.op} shape footprints must stay within ±${MAX_COORDINATE} page coordinates.`, path);
        }
        if (exceedsCoordinateLimit || exceedsFootprintLimit) {
          return;
        }
        const changes = placements.flatMap((placement) => {
          const item = projected.get(placement.id)!;
          const before = { x: placement.before.origin.x, y: placement.before.origin.y, rotation: placement.before.rotation };
          const after = { x: placement.after.origin.x, y: placement.after.origin.y, rotation: placement.after.rotation };
          if (before.x === after.x && before.y === after.y && before.rotation === after.rotation) return [];
          item.x = placement.local_x;
          item.y = placement.local_y;
          const projection = projections.get(item.id)!;
          item.transform = createTransformProjection({
            parent_id: projection.parent_id,
            parent_to_page: projection.parent_to_page,
            local_to_page: { ...projection.local_to_page, e: placement.after.origin.x, f: placement.after.origin.y },
            local_bounds: projection.local_bounds,
            locked_ancestor: projection.locked_ancestor,
          });
          return [{ id: item.id, before, after }];
        });
        if (changes.length === 0) addError(errors, 'NO_OP', `${raw.op} does not move any target.`, path);
        normalized.push(op);
        steps.push({ kind: 'arrange', op, placements });
        moves.push({ ids: changes.map((change) => change.id), changes });
      }
      return;
    }

    if (raw.op === 'group') {
      if (!hasOnlyKeys(raw, ['op', 'ids', 'semantic_id'])) addError(errors, 'UNKNOWN_FIELD', 'group contains an unknown field.', path);
      const items = normalizeIds(raw.ids, `${path}.ids`, 2, FOGWOOD_CANVAS_PROTOCOL.max_targets_per_op, projected, semanticToId, childrenByParent, pageId, errors);
      if (items.some((item) => (item.binding_count ?? 0) > 0)) {
        addError(errors, 'BOUND_STRUCTURE_TARGET', 'Bound connectors and their endpoints cannot be grouped in the same Canvas Protocol action.', `${path}.ids`);
      }
      requireSameParent(items, `${path}.ids`, errors);
      requireUnrotated(items, `${path}.ids`, errors);
      const semantic_id = stableSemanticId(raw.semantic_id, `${path}.semantic_id`, existingSemanticIds, errors);
      if (items.length >= 2 && semantic_id) {
        const op: GroupCanvasOp = { op: 'group', ids: items.map((item) => item.id), semantic_id };
        const bounds = combinedBounds(items);
        requireFootprint(bounds, path, errors);
        normalized.push(op);
        steps.push({ kind: 'group', op, bounds });
        adds.push({
          kind: 'group',
          semantic_id,
          label: 'Logical group',
          ...bounds,
          ...(normalizedCompositionId ? { composition_id: normalizedCompositionId } : {}),
        });
      }
      return;
    }

    if (raw.op === 'ungroup') {
      if (!hasOnlyKeys(raw, ['op', 'ids'])) addError(errors, 'UNKNOWN_FIELD', 'ungroup contains an unknown field.', path);
      const items = normalizeIds(raw.ids, `${path}.ids`, 1, FOGWOOD_CANVAS_PROTOCOL.max_ungroup_targets, projected, semanticToId, childrenByParent, pageId, errors);
      for (const item of items) if (item.type !== 'group') addError(errors, 'INVALID_GROUP_TARGET', 'ungroup accepts group shape IDs only.', `${path}.ids`);
      if (items.length > 0) {
        const op: UngroupCanvasOp = { op: 'ungroup', ids: items.map((item) => item.id) };
        normalized.push(op);
        steps.push({ kind: 'ungroup', op });
        removes.push(...op.ids);
      }
      return;
    }

    if (raw.op === 'reorder') {
      if (!hasOnlyKeys(raw, ['op', 'ids', 'position'])) addError(errors, 'UNKNOWN_FIELD', 'reorder contains an unknown field.', path);
      const items = normalizeIds(raw.ids, `${path}.ids`, 1, FOGWOOD_CANVAS_PROTOCOL.max_targets_per_op, projected, semanticToId, childrenByParent, pageId, errors);
      requireSameParent(items, `${path}.ids`, errors);
      if (!REORDER_POSITIONS.includes(raw.position as ReorderPosition)) addError(errors, 'INVALID_POSITION', 'Unknown reorder position.', `${path}.position`);
      if (items.length > 0 && REORDER_POSITIONS.includes(raw.position as ReorderPosition)) {
        const position = raw.position as ReorderPosition;
        if (!targetOrderChanges(items, [...projected.values()], position)) addError(errors, 'NO_OP', 'reorder would not change target order.', path);
        const op: ReorderCanvasOp = { op: 'reorder', ids: items.map((item) => item.id), position };
        const changes = items.map((item) => ({ id: item.id, fields: { index: { before: item.index ?? null, after: position } } }));
        normalized.push(op);
        steps.push({ kind: 'reorder', op });
        updates.push({ ids: op.ids, fields: ['index'], changes });
      }
      return;
    }

    if (raw.op === 'delete') {
      if (!hasOnlyKeys(raw, ['op', 'ids'])) addError(errors, 'UNKNOWN_FIELD', 'delete contains an unknown field.', path);
      const items = normalizeIds(raw.ids, `${path}.ids`, 1, FOGWOOD_CANVAS_PROTOCOL.max_targets_per_op, projected, semanticToId, childrenByParent, pageId, errors);
      for (const item of items) {
        if ((item.binding_count ?? 0) > 0) addError(errors, 'BOUND_DELETE_TARGET', 'Bound connectors and their endpoints must be disconnected explicitly before deletion.', `${path}.ids`);
        if (item.id.startsWith('pending:')) addError(errors, 'CREATE_DELETE_NO_OP', 'An item created earlier in the same canvas_ops action cannot also be deleted.', `${path}.ids`);
        if ([...projected.values()].some((candidate) => candidate.parent_id === item.id)) {
          addError(errors, 'NON_LEAF_DELETE_TARGET', 'Canvas Protocol v1 delete accepts leaf shapes only so collateral deletion remains explicit.', `${path}.ids`);
        }
      }
      if (items.length > 0) {
        const op: DeleteCanvasOp = { op: 'delete', ids: items.map((item) => item.id) };
        normalized.push(op);
        steps.push({ kind: 'delete', op });
        removes.push(...op.ids);
        for (const item of items) {
          projected.delete(item.id);
          if (item.semantic_id) semanticToId.delete(item.semantic_id);
        }
      }
    }
  });

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    plan: {
      normalized_action: {
        type: 'canvas_ops',
        ...(normalizedCompositionId ? { composition_id: normalizedCompositionId } : {}),
        ops: normalized,
      },
      steps,
      adds,
      updates,
      moves,
      removes,
    },
  };
}

const idArraySchema = (minItems: number, maxItems: number = FOGWOOD_CANVAS_PROTOCOL.max_targets_per_op) => ({
  type: 'array',
  minItems,
  maxItems,
  items: { type: 'string', minLength: 1, maxLength: 220, description: 'Current shape id or semantic:<stable-semantic-id> reference.' },
});

const pointSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    x: { type: 'number', minimum: -MAX_COORDINATE, maximum: MAX_COORDINATE },
    y: { type: 'number', minimum: -MAX_COORDINATE, maximum: MAX_COORDINATE },
  },
  required: ['x', 'y'],
};

export const CANVAS_OPS_ACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    type: { const: 'canvas_ops' },
    composition_id: { type: 'string', minLength: 1, maxLength: 180, pattern: '^[A-Za-z0-9][A-Za-z0-9:._/-]{0,179}$' },
    ops: {
      type: 'array',
      minItems: 1,
      maxItems: FOGWOOD_CANVAS_PROTOCOL.max_ops,
      items: {
        oneOf: [
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              op: { const: 'create' },
              semantic_id: { type: 'string', minLength: 1, maxLength: 180, pattern: '^[A-Za-z0-9][A-Za-z0-9:._/-]{0,179}$' },
              kind: { type: 'string', enum: [...CANVAS_CREATE_KINDS] },
              x: { type: 'number', minimum: -MAX_COORDINATE, maximum: MAX_COORDINATE },
              y: { type: 'number', minimum: -MAX_COORDINATE, maximum: MAX_COORDINATE },
              w: { type: 'number', minimum: 16, maximum: MAX_DIMENSION },
              h: { type: 'number', minimum: 16, maximum: MAX_DIMENSION },
              end_x: { type: 'number', minimum: -MAX_COORDINATE, maximum: MAX_COORDINATE },
              end_y: { type: 'number', minimum: -MAX_COORDINATE, maximum: MAX_COORDINATE },
              text: { type: 'string', maxLength: MAX_TEXT },
              color: { type: 'string', enum: [...CANVAS_OP_COLORS] },
              fill: { type: 'string', enum: [...CANVAS_OP_FILLS] },
              role: { type: 'string', minLength: 1, maxLength: MAX_ROLE },
              region_id: { type: 'string', minLength: 1, maxLength: 180, pattern: '^[A-Za-z0-9][A-Za-z0-9:._/-]{0,179}$' },
              rotation: { type: 'number', minimum: -Math.PI * 4, maximum: Math.PI * 4 },
              opacity: { type: 'number', minimum: 0, maximum: 1 },
            },
            required: ['op', 'semantic_id', 'kind', 'x', 'y'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              op: { const: 'draw' },
              semantic_id: { type: 'string', minLength: 1, maxLength: 180, pattern: '^[A-Za-z0-9][A-Za-z0-9:._/-]{0,179}$' },
              points: { type: 'array', minItems: 2, maxItems: FOGWOOD_CANVAS_PROTOCOL.max_draw_points, items: pointSchema },
              color: { type: 'string', enum: [...CANVAS_OP_COLORS] },
              fill: { type: 'string', enum: [...CANVAS_OP_FILLS] },
              size: { type: 'string', enum: [...CANVAS_OP_SIZES] },
              closed: { type: 'boolean' },
            },
            required: ['op', 'semantic_id', 'points'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              op: { const: 'connect' },
              semantic_id: { type: 'string', minLength: 1, maxLength: 180, pattern: '^[A-Za-z0-9][A-Za-z0-9:._/-]{0,179}$' },
              from_id: { type: 'string', minLength: 1, maxLength: 220, description: 'Current shape id or semantic:<stable-semantic-id> reference.' },
              to_id: { type: 'string', minLength: 1, maxLength: 220, description: 'Current shape id or semantic:<stable-semantic-id> reference.' },
              text: { type: 'string', maxLength: MAX_CONNECTOR_LABEL },
              color: { type: 'string', enum: [...CANVAS_OP_COLORS] },
              relationship_id: { type: 'string', minLength: 1, maxLength: 180, pattern: '^[A-Za-z0-9][A-Za-z0-9:._/-]{0,179}$' },
              relationship_kind: { type: 'string', enum: [...SEMANTIC_RELATIONSHIP_KINDS] },
            },
            required: ['op', 'semantic_id', 'from_id', 'to_id'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              op: { const: 'variant' },
              id: { type: 'string', minLength: 1, maxLength: 220, description: 'Current shape id or semantic:<stable-semantic-id> reference.' },
              semantic_id: { type: 'string', minLength: 1, maxLength: 180, pattern: '^[A-Za-z0-9][A-Za-z0-9:._/-]{0,179}$' },
              offset_x: { type: 'number', minimum: -MAX_VARIANT_OFFSET, maximum: MAX_VARIANT_OFFSET },
              offset_y: { type: 'number', minimum: -MAX_VARIANT_OFFSET, maximum: MAX_VARIANT_OFFSET },
            },
            required: ['op', 'id', 'semantic_id'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              op: { const: 'update' },
              id: { type: 'string', minLength: 1, maxLength: 220, description: 'Current shape id or semantic:<stable-semantic-id> reference.' },
              x: { type: 'number', minimum: -MAX_COORDINATE, maximum: MAX_COORDINATE },
              y: { type: 'number', minimum: -MAX_COORDINATE, maximum: MAX_COORDINATE },
              rotation: { type: 'number', minimum: -Math.PI * 4, maximum: Math.PI * 4 },
              opacity: { type: 'number', minimum: 0, maximum: 1 },
              text: { type: 'string', maxLength: MAX_CONNECTOR_LABEL },
              color: { type: 'string', enum: [...CANVAS_OP_COLORS] },
              fill: { type: 'string', enum: [...CANVAS_OP_FILLS] },
            },
            required: ['op', 'id'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              op: { const: 'resize' },
              id: { type: 'string', minLength: 1, maxLength: 220, description: 'Current shape id or semantic:<stable-semantic-id> reference.' },
              w: { type: 'number', minimum: 16, maximum: MAX_DIMENSION },
              h: { type: 'number', minimum: 16, maximum: MAX_DIMENSION },
            },
            required: ['op', 'id', 'w', 'h'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: { op: { const: 'align' }, ids: idArraySchema(2), axis: { type: 'string', enum: [...ALIGN_AXES] } },
            required: ['op', 'ids', 'axis'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: { op: { const: 'distribute' }, ids: idArraySchema(3), axis: { type: 'string', enum: [...ORIENTATIONS] } },
            required: ['op', 'ids', 'axis'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: { op: { const: 'stack' }, ids: idArraySchema(2), axis: { type: 'string', enum: [...ORIENTATIONS] }, gap: { type: 'number', minimum: 0, maximum: 10000 } },
            required: ['op', 'ids', 'axis'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: { op: { const: 'pack' }, ids: idArraySchema(2), gap: { type: 'number', minimum: 0, maximum: 10000 } },
            required: ['op', 'ids'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              op: { const: 'group' },
              ids: idArraySchema(2),
              semantic_id: { type: 'string', minLength: 1, maxLength: 180, pattern: '^[A-Za-z0-9][A-Za-z0-9:._/-]{0,179}$' },
            },
            required: ['op', 'ids', 'semantic_id'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: { op: { const: 'ungroup' }, ids: idArraySchema(1, FOGWOOD_CANVAS_PROTOCOL.max_ungroup_targets) },
            required: ['op', 'ids'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: { op: { const: 'reorder' }, ids: idArraySchema(1), position: { type: 'string', enum: [...REORDER_POSITIONS] } },
            required: ['op', 'ids', 'position'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: { op: { const: 'delete' }, ids: idArraySchema(1) },
            required: ['op', 'ids'],
          },
        ],
      },
    },
  },
  required: ['type', 'ops'],
} as const;
