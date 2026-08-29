import type { CanvasOpPlan } from '../fogwood-canvas-ops.ts';
import type { PreparedMaterial } from '../fogwood-materials.ts';
import type { InspectableItem, PreparedCanvasPreview } from '../fogwood-runtime.ts';

const ZERO_BOUNDS = Object.freeze({ x: 0, y: 0, w: 1, h: 1 });

function boundsFor(item: InspectableItem | undefined) {
  if (!item) return ZERO_BOUNDS;
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
  const moves = canvasPlans.flatMap((plan) => plan.moves.flatMap((move) => move.changes.map((change) => {
    const size = boundsFor(current.get(change.id));
    return {
      id: change.id,
      before: { x: change.before.x, y: change.before.y, w: size.w, h: size.h, rotation: change.before.rotation },
      after: { x: change.after.x, y: change.after.y, w: size.w, h: size.h, rotation: change.after.rotation },
    };
  })));
  for (const plan of canvasPlans) for (const step of plan.steps) if (step.kind === 'resize') {
    const rotation = current.get(step.op.id)?.rotation ?? 0;
    moves.push({ id: step.op.id, before: { ...step.before, rotation }, after: { ...step.after, rotation } });
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
