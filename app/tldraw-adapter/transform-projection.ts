export const FOGWOOD_TRANSFORM_SCHEMA = 'fogwood.transform.v1' as const;
export const TRANSFORM_EPSILON = 1e-7;
const MAX_TRANSFORM_MAGNITUDE = 1_000_000;

export type TransformMatrix = Readonly<{ a: number; b: number; c: number; d: number; e: number; f: number }>;
export type TransformPoint = Readonly<{ x: number; y: number }>;
export type TransformBounds = Readonly<{ x: number; y: number; w: number; h: number }>;
export type FogwoodTransformProjection = Readonly<{
  schema: typeof FOGWOOD_TRANSFORM_SCHEMA;
  parent_id: string;
  parent_to_page: TransformMatrix;
  local_transform: TransformMatrix;
  local_to_page: TransformMatrix;
  local_bounds: TransformBounds;
  page_origin: TransformPoint;
  page_corners: readonly TransformPoint[];
  page_bounds: TransformBounds;
  page_rotation: number;
  locked_ancestor: boolean;
  focused_group_id?: string;
  fingerprint: string;
}>;

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= MAX_TRANSFORM_MAGNITUDE;
}

function assertMatrix(matrix: TransformMatrix) {
  if (![matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f].every(finite)) throw new Error('INVALID_TRANSFORM_MATRIX');
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
  if (!Number.isFinite(determinant) || Math.abs(determinant) <= 1e-12) throw new Error('SINGULAR_TRANSFORM_MATRIX');
}

function assertRigidMatrix(matrix: TransformMatrix) {
  assertMatrix(matrix);
  const firstAxisLength = Math.hypot(matrix.a, matrix.b);
  const secondAxisLength = Math.hypot(matrix.c, matrix.d);
  const axisDotProduct = matrix.a * matrix.c + matrix.b * matrix.d;
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
  const tolerance = TRANSFORM_EPSILON * 10;
  if (
    Math.abs(firstAxisLength - 1) > tolerance
    || Math.abs(secondAxisLength - 1) > tolerance
    || Math.abs(axisDotProduct) > tolerance
    || Math.abs(determinant - 1) > tolerance
  ) {
    throw new Error('UNSUPPORTED_NON_RIGID_TRANSFORM');
  }
}

function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

export function multiplyTransforms(left: TransformMatrix, right: TransformMatrix): TransformMatrix {
  assertMatrix(left);
  assertMatrix(right);
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f,
  };
}

export function invertTransform(matrix: TransformMatrix): TransformMatrix {
  assertMatrix(matrix);
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
  return {
    a: matrix.d / determinant,
    b: -matrix.b / determinant,
    c: -matrix.c / determinant,
    d: matrix.a / determinant,
    e: (matrix.c * matrix.f - matrix.d * matrix.e) / determinant,
    f: (matrix.b * matrix.e - matrix.a * matrix.f) / determinant,
  };
}

export function applyTransform(matrix: TransformMatrix, point: TransformPoint): TransformPoint {
  assertMatrix(matrix);
  if (!finite(point.x) || !finite(point.y)) throw new Error('INVALID_TRANSFORM_POINT');
  const result = { x: matrix.a * point.x + matrix.c * point.y + matrix.e, y: matrix.b * point.x + matrix.d * point.y + matrix.f };
  if (!finite(result.x) || !finite(result.y)) throw new Error('UNBOUNDED_TRANSFORM_POINT');
  return result;
}

function boundsFor(points: readonly TransformPoint[]): TransformBounds {
  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function fingerprint(input: unknown) {
  const text = JSON.stringify(input, (_key, value) => typeof value === 'number' ? Number(value.toFixed(9)) : value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function createTransformProjection(input: Readonly<{
  parent_id: string;
  parent_to_page: TransformMatrix;
  local_to_page: TransformMatrix;
  local_bounds: TransformBounds;
  locked_ancestor: boolean;
  focused_group_id?: string;
}>): FogwoodTransformProjection {
  if (typeof input.parent_id !== 'string' || input.parent_id.length < 1 || input.parent_id.length > 220) throw new Error('INVALID_TRANSFORM_PARENT');
  // Installed tldraw page transforms are translation + rotation. Refuse
  // synthetic scale, reflection, and shear instead of pretending the exact
  // move/resize lowering can preserve transforms it does not support.
  assertRigidMatrix(input.parent_to_page);
  assertRigidMatrix(input.local_to_page);
  if (input.focused_group_id !== undefined && (typeof input.focused_group_id !== 'string' || input.focused_group_id.length < 1 || input.focused_group_id.length > 220)) throw new Error('INVALID_FOCUSED_GROUP');
  if (![input.local_bounds.x, input.local_bounds.y, input.local_bounds.w, input.local_bounds.h].every(finite) || input.local_bounds.w < 0 || input.local_bounds.h < 0) throw new Error('INVALID_TRANSFORM_BOUNDS');
  const { x, y, w, h } = input.local_bounds;
  const pageCorners = [
    applyTransform(input.local_to_page, { x, y }),
    applyTransform(input.local_to_page, { x: x + w, y }),
    applyTransform(input.local_to_page, { x: x + w, y: y + h }),
    applyTransform(input.local_to_page, { x, y: y + h }),
  ];
  const localTransform = multiplyTransforms(invertTransform(input.parent_to_page), input.local_to_page);
  const identity = {
    schema: FOGWOOD_TRANSFORM_SCHEMA,
    parent_id: input.parent_id,
    parent_to_page: { ...input.parent_to_page },
    local_transform: { ...localTransform },
    local_to_page: { ...input.local_to_page },
    local_bounds: { ...input.local_bounds },
    page_origin: applyTransform(input.local_to_page, { x: 0, y: 0 }),
    page_corners: pageCorners,
    page_bounds: boundsFor(pageCorners),
    page_rotation: Math.atan2(input.local_to_page.b, input.local_to_page.a),
    locked_ancestor: input.locked_ancestor,
  };
  return freeze({
    ...identity,
    ...(input.focused_group_id === undefined ? {} : { focused_group_id: input.focused_group_id }),
    // Focus affects routing, not the shape's geometric identity.
    fingerprint: fingerprint(identity),
  });
}

export function pagePointToParentLocal(projection: FogwoodTransformProjection, point: TransformPoint) {
  return applyTransform(invertTransform(projection.parent_to_page), point);
}

export function translateProjectedGeometry(projection: FogwoodTransformProjection, dx: number, dy: number) {
  if (!finite(dx) || !finite(dy)) throw new Error('INVALID_TRANSFORM_TRANSLATION');
  return freeze({
    page_origin: { x: projection.page_origin.x + dx, y: projection.page_origin.y + dy },
    page_corners: projection.page_corners.map((point) => ({ x: point.x + dx, y: point.y + dy })),
    page_bounds: { x: projection.page_bounds.x + dx, y: projection.page_bounds.y + dy, w: projection.page_bounds.w, h: projection.page_bounds.h },
  });
}
