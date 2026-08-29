'use client';

// Prepared previews are bounded device-local data URLs, not network images.
/* eslint-disable @next/next/no-img-element */

import { useEditor, useValue } from 'tldraw';
import type { PreparedCanvasPlan, PreparedCanvasPreviewBounds } from '../fogwood-runtime';

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
          <span className="plan-ghost plan-ghost-before" style={viewportBox(editor, move.before)} />
          <span className="plan-ghost plan-ghost-move" style={viewportBox(editor, move.after)} title={`Move ${move.id}`} />
        </div>
      ))}
      {plan.preview.additions.map((addition) => (
        <span
          key={`add:${addition.semantic_id}`}
          className={`plan-ghost plan-ghost-add plan-ghost-${addition.kind}`}
          style={viewportBox(editor, addition.bounds)}
          title={`Add ${addition.label}`}
        >
          <small>{addition.label}</small>
        </span>
      ))}
      {plan.preview.regions.map((region) => (
        <span key={`region:${region.semantic_id}`} className="plan-ghost plan-ghost-region" style={viewportBox(editor, region.bounds)}>
          <small>{region.label}</small>
        </span>
      ))}
      {plan.preview.relationships.map((relationship) => (
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
