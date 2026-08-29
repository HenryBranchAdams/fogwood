import type { CanvasOpPlan } from '../fogwood-canvas-ops.ts';
import type { PreparedMaterial } from '../fogwood-materials.ts';
import type { InspectableItem, PreparedCanvasPreview } from '../fogwood-runtime.ts';

const ZERO_BOUNDS = Object.freeze({ x: 0, y: 0, w: 1, h: 1 });

function boundsFor(item: InspectableItem | undefined) {
  if (!item) return ZERO_BOUNDS;
  if (item.transform) return { ...item.transform.page_bounds, rotation: item.transform.page_rotation };
  return { x: item.x, y: item.y, w: Math.max(1, item.w), h: Math.max(1, item.h), ...(typeof item.rotation === 'number' ? { rotation: item.rotation } : {}) };
}

/** Build the data-only review projection from the exact lowerings Apply consumes. */
export function buildPreparedCanvasPreview(input: {
  canvasPlans: readonly CanvasOpPlan[];
  currentItems: readonly InspectableItem[];
  materials: readonly PreparedMaterial[];
}): PreparedCanvasPreview {
  const { canvasPlans, currentItems, materials: preparedMaterials } = input;
  const current = new Map(currentItems.map((item) => [item.id, item]));
  const additions = canvasPlans.flatMap((plan) => plan.adds.filter((addition) => addition.kind !== 'arrow').map((addition) => ({
    semantic_id: addition.semantic_id,
    kind: addition.kind,
    label: addition.label,
    bounds: { x: addition.x, y: addition.y, w: Math.max(1, addition.w), h: Math.max(1, addition.h), ...(typeof addition.rotation === 'number' ? { rotation: addition.rotation } : {}) },
    ...(addition.role ? { role: addition.role } : {}),
  })));
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
  const relationships = canvasPlans.flatMap((plan) => plan.steps.filter((step) => step.kind === 'connect').map((step) => ({
    semantic_id: step.op.semantic_id,
    label: step.op.text ?? step.op.relationship_kind ?? 'relationship',
    bounds: step.bounds,
  })));
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
