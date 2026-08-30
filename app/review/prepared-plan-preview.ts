import type { CanvasOpPlan, CanvasOpStep } from '../fogwood-canvas-ops.ts';
import type { PreparedMaterial } from '../fogwood-materials.ts';
import type { InspectableItem, PreparedCanvasPreview } from '../fogwood-runtime.ts';

const ZERO_BOUNDS = Object.freeze({ x: 0, y: 0, w: 1, h: 1 });

export type PreparedPreviewPoint = Readonly<{ x: number; y: number }>;

/**
 * Project retained page-space geometry without reconstructing it from an AABB.
 * The overlay owns the viewport mapping; keeping this helper pure makes that
 * projection independently testable and ensures frozen corners are the input.
 */
export function projectPreviewPolygon(
  corners: readonly PreparedPreviewPoint[],
  project: (point: PreparedPreviewPoint) => PreparedPreviewPoint,
) {
  return corners.map((corner) => project(corner));
}

function boundsFor(item: InspectableItem | undefined) {
  if (!item) return ZERO_BOUNDS;
  if (item.transform) return { ...item.transform.page_bounds, rotation: item.transform.page_rotation };
  return { x: item.x, y: item.y, w: Math.max(1, item.w), h: Math.max(1, item.h), ...(typeof item.rotation === 'number' ? { rotation: item.rotation } : {}) };
}

function center(bounds: { x: number; y: number; w: number; h: number }) {
  return { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
}

/** Build the data-only review projection from the exact lowerings Apply consumes. */
export function buildPreparedCanvasPreview(input: {
  canvasPlans: readonly CanvasOpPlan[];
  currentItems: readonly InspectableItem[];
  materials: readonly PreparedMaterial[];
}): PreparedCanvasPreview {
  const { canvasPlans, currentItems, materials: preparedMaterials } = input;
  const current = new Map(currentItems.map((item) => [item.id, item]));
  // This projection intentionally follows the frozen steps, rather than
  // recomputing geometry from the request. That keeps the review ghost
  // congruent with the lowering consumed by Apply.
  const preparedGeometry = new Map<string, { x: number; y: number; w: number; h: number; rotation?: number }>();
  for (const item of currentItems) preparedGeometry.set(item.id, boundsFor(item));
  for (const plan of canvasPlans) for (const step of plan.steps) {
    if (step.kind === 'create' || step.kind === 'draw') preparedGeometry.set(step.pending_id, { ...step.bounds });
    // Older retained fixtures predate exact variant geometry. They remain
    // reviewable as bounds-only; newly prepared variants always carry the
    // immutable PageGeometry consumed by the polygon renderer below.
    if (step.kind === 'variant') preparedGeometry.set(step.pending_id, { ...(step.geometry?.bounds ?? step.bounds) });
  }
  const additions = canvasPlans.flatMap((plan) => plan.adds.filter((addition) => addition.kind !== 'arrow' && addition.kind !== 'connector').map((addition) => {
    const sourceStep = plan.steps.find((step): step is Extract<CanvasOpStep, { kind: 'create' | 'draw' | 'variant' }> =>
      (step.kind === 'create' || step.kind === 'draw' || step.kind === 'variant') && step.op.semantic_id === addition.semantic_id);
    const op = sourceStep?.op;
    const exactGeometry = sourceStep?.kind === 'variant' ? sourceStep.geometry : undefined;
    return {
    semantic_id: addition.semantic_id,
    kind: addition.kind,
    label: addition.label,
    bounds: exactGeometry
      ? { ...exactGeometry.bounds, rotation: exactGeometry.rotation }
      : { x: addition.x, y: addition.y, w: Math.max(1, addition.w), h: Math.max(1, addition.h), ...(typeof addition.rotation === 'number' ? { rotation: addition.rotation } : {}) },
    ...(addition.role ? { role: addition.role } : {}),
    ...(op && 'color' in op && op.color ? { color: op.color } : {}),
    ...(op && 'fill' in op && op.fill ? { fill: op.fill } : {}),
    ...(op?.op === 'draw' ? { points: op.points.map((point) => ({ ...point })) } : {}),
    ...(exactGeometry ? { corners: exactGeometry.corners.map((point) => ({ ...point })) } : {}),
  }; }));
  const moves: Array<PreparedCanvasPreview['moves'][number]> = [];
  for (const plan of canvasPlans) for (const step of plan.steps) {
    if (step.kind === 'update' && (step.op.x !== undefined || step.op.y !== undefined || step.op.rotation !== undefined)) {
      moves.push({ id: step.op.id, before: { ...step.target.page.bounds, rotation: step.target.page.rotation }, after: { ...step.after_page_geometry.bounds, rotation: step.after_page_geometry.rotation }, before_corners: step.target.page.corners.map((point) => ({ ...point })), after_corners: step.after_page_geometry.corners.map((point) => ({ ...point })) });
    }
    if (step.kind === 'resize') moves.push({ id: step.op.id, before: { ...step.before.bounds, rotation: step.before.rotation }, after: { ...step.after.bounds, rotation: step.after.rotation }, before_corners: step.before.corners.map((point) => ({ ...point })), after_corners: step.after.corners.map((point) => ({ ...point })) });
    if (step.kind === 'arrange') for (const placement of step.placements) {
      moves.push({ id: placement.id, before: { ...placement.before.bounds, rotation: placement.before.rotation }, after: { ...placement.after.bounds, rotation: placement.after.rotation }, before_corners: placement.before.corners.map((point) => ({ ...point })), after_corners: placement.after.corners.map((point) => ({ ...point })) });
    }
  }
  // Backward-compatible projection for retained v1 plans and fixtures that do
  // not yet carry exact transform steps.
  for (const plan of canvasPlans) for (const move of plan.moves) for (const change of move.changes) {
    if (moves.some((entry) => entry.id === change.id)) continue;
    const item = current.get(change.id);
    if (!item) continue;
    moves.push({
      id: change.id,
      before: { x: change.before.x, y: change.before.y, w: Math.max(1, item.w), h: Math.max(1, item.h), rotation: change.before.rotation },
      after: { x: change.after.x, y: change.after.y, w: Math.max(1, item.w), h: Math.max(1, item.h), rotation: change.after.rotation },
    });
  }
  const removals = canvasPlans.flatMap((plan) => plan.removes).map((id) => ({
    id,
    label: current.get(id)?.text ?? current.get(id)?.kind ?? current.get(id)?.type ?? id,
    bounds: boundsFor(current.get(id)),
  }));
  const relationships = canvasPlans.flatMap((plan) => plan.steps.filter((step) => step.kind === 'connect').map((step) => {
    const fromBounds = step.from ? preparedGeometry.get(step.from.id) : undefined;
    const toBounds = step.to ? preparedGeometry.get(step.to.id) : undefined;
    const from_center = fromBounds ? center(fromBounds) : undefined;
    const to_center = toBounds ? center(toBounds) : undefined;
    const bounds = from_center && to_center ? {
      x: Math.min(from_center.x, to_center.x),
      y: Math.min(from_center.y, to_center.y),
      w: Math.abs(to_center.x - from_center.x),
      h: Math.abs(to_center.y - from_center.y),
    } : step.bounds;
    return {
      semantic_id: step.op.semantic_id,
      label: step.op.text ?? step.op.relationship_kind ?? 'relationship',
      bounds,
      ...(from_center ? { from_center } : {}),
      ...(to_center ? { to_center } : {}),
      ...(step.op.relationship_kind ? { relationship_kind: step.op.relationship_kind } : {}),
      ...(step.op.color ? { color: step.op.color } : {}),
    };
  }));
  const regions = additions.filter((addition) => addition.kind === 'frame' || addition.role?.includes('region')).map(({ semantic_id, label, bounds }) => ({ semantic_id, label, bounds }));
  const materials = preparedMaterials.map((material) => ({
    semantic_id: material.semantic_id,
    label: material.label,
    mime_type: material.mime_type,
    content_hash: material.content_hash,
    bounds: { x: material.x, y: material.y, w: material.w, h: material.h },
  }));
  return { schema: 'fogwood.prepared-canvas-preview.v1', additions, moves, removals, relationships, regions, materials };
}
