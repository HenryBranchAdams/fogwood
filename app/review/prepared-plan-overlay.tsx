'use client';

// Prepared previews are bounded device-local data URLs, not network images.
/* eslint-disable @next/next/no-img-element */

import { useEditor, useValue } from 'tldraw';
import type { PreparedCanvasPlan, PreparedCanvasPreviewBounds } from '../fogwood-runtime';
import { projectPreviewPolygon } from './prepared-plan-preview';

function viewportBox(editor: ReturnType<typeof useEditor>, bounds: PreparedCanvasPreviewBounds) {
  const topLeft = editor.pageToViewport({ x: bounds.x, y: bounds.y });
  const bottomRight = editor.pageToViewport({ x: bounds.x + bounds.w, y: bounds.y + bounds.h });
  return {
    left: topLeft.x,
    top: topLeft.y,
    width: Math.max(1, bottomRight.x - topLeft.x),
    height: Math.max(1, bottomRight.y - topLeft.y),
    transform: bounds.rotation ? `rotate(${bounds.rotation}rad)` : undefined,
  };
}

function viewportPoint(editor: ReturnType<typeof useEditor>, point: { x: number; y: number }) {
  return editor.pageToViewport(point);
}

function polygonPoints(editor: ReturnType<typeof useEditor>, corners: readonly { x: number; y: number }[]) {
  return projectPreviewPolygon(corners, (point) => viewportPoint(editor, point))
    .map((point) => `${point.x},${point.y}`)
    .join(' ');
}

function polygonLabelPoint(editor: ReturnType<typeof useEditor>, corners: readonly { x: number; y: number }[]) {
  const points = projectPreviewPolygon(corners, (point) => viewportPoint(editor, point));
  const total = points.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
  return { x: total.x / points.length, y: total.y / points.length };
}

function safeToken(value: string | undefined, fallback: string) {
  return value && /^[a-z-]+$/u.test(value) ? value : fallback;
}

/** A pointer-transparent visual proof of the exact frozen plan awaiting review. */
export function PreparedPlanOverlay({ plan }: { plan?: PreparedCanvasPlan }) {
  const editor = useEditor();
  useValue('Fogwood prepared plan camera', () => editor.getCamera(), [editor]);
  if (!plan) return null;

  const materialBySemanticId = new Map(plan.prepared_materials.map((material) => [material.semantic_id, material]));
  return (
    <div className="prepared-plan-overlay" aria-label="Staged Fogwood proposal preview">
      {plan.preview.moves.map((move) => (
        <div key={`move:${move.id}`}>
          {!move.before_corners?.length && <span className="plan-ghost plan-ghost-before" style={viewportBox(editor, move.before)} />}
          {!move.after_corners?.length && <span className="plan-ghost plan-ghost-move" style={viewportBox(editor, move.after)} title={`Move ${move.id}`} />}
        </div>
      ))}
      {plan.preview.additions.filter((addition) => addition.kind !== 'frame' && addition.kind !== 'draw' && !addition.role?.includes('region') && !addition.corners?.length).map((addition, index) => (
        <span
          key={`add:${addition.semantic_id}`}
          className={`plan-ghost plan-ghost-add plan-ghost-kind-${safeToken(addition.kind, 'rectangle')} plan-ghost-color-${safeToken(addition.color, 'green')} plan-ghost-fill-${safeToken(addition.fill, 'none')}`}
          style={{ ...viewportBox(editor, addition.bounds), animationDelay: `${Math.min(index, 18) * 34}ms` }}
          title={`Add ${addition.label}`}
        >
          <strong>{addition.label}</strong>
        </span>
      ))}
      {plan.preview.regions.map((region) => (
        <span key={`region:${region.semantic_id}`} className="plan-ghost plan-ghost-region" style={viewportBox(editor, region.bounds)}>
          <small>{region.label}</small>
        </span>
      ))}
      <svg className="prepared-plan-links" aria-hidden="true">
        <defs>
          <marker id="fogwood-plan-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 1 L 9 5 L 0 9 z" />
          </marker>
        </defs>
        {plan.preview.moves.flatMap((move) => [
          ...(move.before_corners?.length ? [
            <g
              key={`move-before:${move.id}`}
              className="plan-polygon plan-polygon-before"
            >
              <polygon points={polygonPoints(editor, move.before_corners)} />
            </g>,
          ] : []),
          ...(move.after_corners?.length ? [
            <g
              key={`move-after:${move.id}`}
              className="plan-polygon plan-polygon-move"
            >
              <title>{`Move ${move.id}`}</title>
              <polygon points={polygonPoints(editor, move.after_corners)} />
            </g>,
          ] : []),
        ])}
        {plan.preview.additions.filter((addition) => addition.corners?.length).map((addition, index) => {
          const corners = addition.corners!;
          const label = polygonLabelPoint(editor, corners);
          return (
            <g
              key={`add-polygon:${addition.semantic_id}`}
              className={`plan-polygon plan-polygon-add plan-ghost-color-${safeToken(addition.color, 'green')} plan-ghost-fill-${safeToken(addition.fill, 'none')}`}
              style={{ animationDelay: `${Math.min(index, 18) * 34}ms` }}
            >
              <title>{`Add ${addition.label}`}</title>
              <polygon points={polygonPoints(editor, corners)} />
              <text x={label.x} y={label.y} textAnchor="middle">{addition.label}</text>
            </g>
          );
        })}
        {plan.preview.relationships.map((relationship) => {
          if (!relationship.from_center || !relationship.to_center) return null;
          const from = viewportPoint(editor, relationship.from_center);
          const to = viewportPoint(editor, relationship.to_center);
          return (
            <g key={`relation-line:${relationship.semantic_id}`} className={`plan-link plan-link-${safeToken(relationship.color, 'blue')}`}>
              <path d={`M ${from.x} ${from.y} L ${to.x} ${to.y}`} markerEnd="url(#fogwood-plan-arrow)" />
              <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 8} textAnchor="middle">
                {relationship.label}
              </text>
            </g>
          );
        })}
        {plan.preview.additions.filter((addition) => addition.kind === 'draw' && addition.points).map((addition) => {
          const points = addition.points?.map((point) => viewportPoint(editor, point));
          if (!points || points.length < 2) return null;
          return (
            <polyline
              key={`trace:${addition.semantic_id}`}
              className={`plan-trace plan-trace-${safeToken(addition.color, 'violet')}`}
              points={points.map((point) => `${point.x},${point.y}`).join(' ')}
            />
          );
        })}
      </svg>
      {plan.preview.relationships.filter((relationship) => !relationship.from_center || !relationship.to_center).map((relationship) => (
        <span key={`relation:${relationship.semantic_id}`} className="plan-ghost plan-ghost-relationship" style={viewportBox(editor, relationship.bounds)}>
          <small>{relationship.label}</small>
        </span>
      ))}
      {plan.preview.materials.map((material) => {
        const prepared = materialBySemanticId.get(material.semantic_id);
        if (!prepared) return null;
        return (
          <span key={`material:${material.semantic_id}`} className="plan-ghost plan-ghost-material" style={viewportBox(editor, material.bounds)}>
            <img src={`data:${prepared.mime_type};base64,${prepared.canonical_base64}`} alt="" />
            <small>{material.label}</small>
          </span>
        );
      })}
      {plan.preview.removals.map((removal) => (
        <span key={`remove:${removal.id}`} className="plan-ghost plan-ghost-remove" style={viewportBox(editor, removal.bounds)} title={`Remove ${removal.label}`}>
          <small>Remove</small>
        </span>
      ))}
    </div>
  );
}
