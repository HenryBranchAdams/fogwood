'use client';

// Material previews are validated, bounded data URLs produced by the page.
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Editor, Tldraw } from 'tldraw';
import 'tldraw/tldraw.css';
import type { ProposalLifecycleEvent } from './fogwood-proposal-lifecycle';
import { FOGWOOD_PERSISTENCE_KEY } from './fogwood-persistence';
import { createFogwoodReceiptRecorder } from './fogwood-receipt-recorder';
import { RECEIPT_STORAGE_KEY, createReceiptLedger } from './fogwood-receipts';
import type { ProposalControllerState } from './fogwood-runtime';
import { SurfaceBlockUtil } from './surface-block';
import {
  type SurfaceToolController,
  type ToolConnection,
  registerSurfaceTools,
} from './surface-tools';

const shapeUtils = [SurfaceBlockUtil];

function diffValue(value: unknown) {
  if (value === undefined) return 'none';
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).slice(0, 90);
  }
  if (Array.isArray(value)) return `list (${value.length})`;
  return 'details';
}

function proposalDiffEntries(diff: ProposalControllerState['diff']) {
  const entries: string[] = [];
  for (const spec of diff.adds.specs) {
    entries.push(`Add ${spec.type} · ${spec.kind} · ${spec.label}${spec.semantic_id ? ` · ${spec.semantic_id}` : ''}`);
  }
  for (const update of diff.updates) {
    for (const change of update.changes.slice(0, 20)) {
      for (const [field, values] of Object.entries(change.fields).slice(0, 6)) {
        entries.push(`Update ${change.id} · ${field}: ${diffValue(values.before)} → ${diffValue(values.after)}`);
      }
    }
  }
  for (const move of diff.moves) {
    for (const change of move.changes.slice(0, 24)) {
      entries.push(`Move ${change.id} · (${change.before.x}, ${change.before.y}) → (${change.after.x}, ${change.after.y})`);
    }
  }
  for (const relationship of diff.semantic_relationships ?? []) {
    entries.push(`Connect ${relationship.source_semantic_id} → ${relationship.target_semantic_id} · ${relationship.kind}`);
  }
  for (const descriptor of diff.removes.descriptors.slice(0, 24)) {
    entries.push(`Remove ${descriptor.id} · ${descriptor.label}`);
  }
  return entries;
}

function materialPreviewBase64(state: ProposalControllerState, semanticId: string) {
  for (const action of state.proposal.actions) {
    if (action.type !== 'add_materials') continue;
    const material = action.materials.find((candidate) => candidate.semantic_id === semanticId);
    if (!material) continue;
    return 'canonical_base64' in material ? material.canonical_base64 : material.base64;
  }
  return undefined;
}

function connectionPresentation(connection: ToolConnection) {
  if (!connection.checked) {
    return { className: 'is-checking', label: 'Fogwood is checking WebMCP page registration.' };
  }
  if (!connection.available) {
    return { className: 'is-unavailable', label: 'The canvas is ready; WebMCP is not exposed in this tab.' };
  }
  if (connection.registered > 0 && connection.failed === 0) {
    return {
      className: 'is-ready',
      label: `${connection.registered} Fogwood page tools registered. Host inventory and successful calls remain separate checks.`,
    };
  }
  if (connection.registered > 0) {
    return {
      className: 'is-partial',
      label: `${connection.registered} Fogwood page tools registered and ${connection.failed} failed.`,
    };
  }
  return {
    className: 'is-unavailable',
    label: connection.errors[0] ?? 'Fogwood page tools did not register.',
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message.slice(0, 220)
    : 'An unexpected device-local Fogwood error occurred.';
}

export default function SurfaceApp({ licenseKey }: { licenseKey?: string }) {
  const [connection, setConnection] = useState<ToolConnection>({
    checked: false,
    available: false,
    registered: 0,
    failed: 0,
    errors: [],
  });
  const [proposal, setProposal] = useState<ProposalControllerState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const registrationCleanup = useRef<(() => void) | null>(null);
  const proposalController = useRef<SurfaceToolController | null>(null);

  const receiptRecorder = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      const ledger = createReceiptLedger({
        storage: {
          read: () => window.localStorage.getItem(RECEIPT_STORAGE_KEY),
          write: (serialized) => window.localStorage.setItem(RECEIPT_STORAGE_KEY, serialized),
        },
        idSource: () => {
          const randomUUID = window.crypto?.randomUUID;
          if (typeof randomUUID !== 'function') {
            throw new Error('This browser does not provide collision-resistant local receipt IDs.');
          }
          return randomUUID.call(window.crypto);
        },
      });
      return createFogwoodReceiptRecorder({ ledger });
    } catch {
      return null;
    }
  }, []);

  useEffect(() => () => registrationCleanup.current?.(), []);

  const recordLifecycle = useCallback((event: ProposalLifecycleEvent) => {
    if (!receiptRecorder) {
      setNotice('The proposal changed state, but the device-local receipt ledger is unavailable.');
      return;
    }
    try {
      const result = receiptRecorder.recordProposalLifecycle(event);
      if (!result.ok) setNotice(`Receipt was not recorded: ${result.error.message.slice(0, 180)}`);
    } catch (error) {
      setNotice(`Receipt was not recorded: ${errorMessage(error)}`);
    }
  }, [receiptRecorder]);

  const mountEditor = useCallback((editor: Editor) => {
    registrationCleanup.current?.();
    registrationCleanup.current = registerSurfaceTools(
      editor,
      setConnection,
      (_title, detail) => {
        if (detail) setNotice(detail);
      },
      setProposal,
      (controller) => {
        proposalController.current = controller;
        setProposal(controller.getState());
      },
      recordLifecycle,
    );
  }, [recordLifecycle]);

  const connectionState = connectionPresentation(connection);
  const entries = proposal ? proposalDiffEntries(proposal.diff) : [];
  const seededAction = proposal?.proposal.actions.find((action) => action.type === 'seeded_composition');

  function applyProposal() {
    const result = proposalController.current?.apply();
    if (result?.status === 'APPLIED') {
      setNotice('Applied as one device-local undo step.');
    } else if (result?.status === 'STALE_STATE') {
      setNotice('The canvas changed. Inspect it again and stage a fresh proposal.');
    } else if (result?.status === 'ERROR') {
      setNotice(result.message ?? 'The page rejected the proposal.');
    }
  }

  function rejectProposal() {
    const result = proposalController.current?.reject();
    if (result?.status === 'REJECTED') setNotice('Proposal rejected. The canvas was not changed.');
  }

  return (
    <main className="surface-shell">
      <section className="canvas-pane" aria-label="Fogwood canvas">
        <Tldraw
          shapeUtils={shapeUtils}
          licenseKey={licenseKey}
          persistenceKey={FOGWOOD_PERSISTENCE_KEY}
          onMount={mountEditor}
        />

        <div
          className={`surface-mark ${connectionState.className}`}
          aria-label={`Fogwood. ${connectionState.label}`}
          title={connectionState.label}
        >
          <span className="surface-mark-dot" aria-hidden="true" />
          <span>Fogwood</span>
        </div>

        {proposal && (
          <aside className="proposal-dock" aria-label="Review staged canvas proposal">
            <section className={`proposal-review proposal-${proposal.status}`}>
              <div className="proposal-review-header">
                <div>
                  <span className="proposal-eyebrow">Staged by the agent · page decision</span>
                  <h3>{proposal.proposal.summary}</h3>
                </div>
                <span className="proposal-status">
                  {proposal.status === 'pending' ? 'Review' : proposal.status}
                </span>
              </div>

              {proposal.proposal.rationale && (
                <p className="proposal-rationale">{proposal.proposal.rationale}</p>
              )}

              <div className="proposal-counts" aria-label="Proposal change counts">
                <span><strong>{proposal.diff.counts.adds}</strong>adds</span>
                <span><strong>{proposal.diff.counts.updates}</strong>updates</span>
                <span><strong>{proposal.diff.counts.moves}</strong>moves</span>
                <span><strong>{proposal.diff.counts.removes}</strong>removes</span>
              </div>

              {seededAction && (
                <section className="proposal-seeded-evidence" aria-label="Seeded composition replay evidence">
                  <div className="proposal-seeded-heading">
                    <span className="proposal-diff-title">Seeded remix · originals preserved</span>
                    <span>v{seededAction.algorithm_version}</span>
                  </div>
                  <dl>
                    <div><dt>Seed</dt><dd><code>{String(seededAction.seed)}</code></dd></div>
                    <div><dt>Wildness</dt><dd>{Math.round(seededAction.wildness * 100)}%</dd></div>
                    <div><dt>Composition</dt><dd>{seededAction.layout.branch_count} branches · opens {seededAction.layout.open_side}</dd></div>
                    <div><dt>Source</dt><dd><code>{seededAction.source_revision}</code></dd></div>
                  </dl>
                  <ul>
                    {seededAction.lineage.slice(0, 8).map((entry) => (
                      <li key={entry.variant_semantic_id}>
                        <code>{entry.source_semantic_id}</code>
                        <span aria-hidden="true">→</span>
                        <code>{entry.variant_semantic_id}</code>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {proposal.diff.adds.material_specs.length > 0 && (
                <section className="proposal-material-diff" aria-label="Qualified material previews">
                  <span className="proposal-diff-title">Local material preview</span>
                  <div className="proposal-material-list">
                    {proposal.diff.adds.material_specs.slice(0, 4).map((material) => {
                      const preview = materialPreviewBase64(proposal, material.semantic_id);
                      const source = preview ? `data:${material.mime_type};base64,${preview}` : undefined;
                      return (
                        <article className="proposal-material-card" key={material.semantic_id}>
                          <div className="proposal-material-visual">
                            {source
                              ? <img src={source} alt={material.alt || material.label} />
                              : <span>No preview</span>}
                          </div>
                          <div className="proposal-material-copy">
                            <strong>{material.label}</strong>
                            <span>{material.mime_type} · {material.dimensions.width} × {material.dimensions.height}px</span>
                            <span><code>{material.content_hash}</code></span>
                            <span>{material.originating_capability || 'Origin not supplied'}</span>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              )}

              {entries.length > 0 && (
                <div className="proposal-diff" aria-label="Affected canvas matter">
                  <span className="proposal-diff-title">Affected canvas matter</span>
                  <ul className="proposal-diff-list">
                    {entries.slice(0, 32).map((entry, index) => (
                      <li key={`${entry}-${index}`}>{entry}</li>
                    ))}
                  </ul>
                  {entries.length > 32 && (
                    <span className="proposal-diff-more">Showing the first 32 bounded changes.</span>
                  )}
                </div>
              )}

              {proposal.diff.warnings.length > 0 && (
                <ul className="proposal-warnings">
                  {proposal.diff.warnings.slice(0, 4).map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}

              {proposal.message && <p className="proposal-message">{proposal.message}</p>}

              <div className="proposal-actions">
                <button type="button" onClick={applyProposal} disabled={proposal.status !== 'pending'}>
                  Apply
                </button>
                <button type="button" onClick={rejectProposal}>Reject</button>
              </div>
              <p className="proposal-footnote">
                Apply is one undoable local transaction. Reject leaves the content revision unchanged.
              </p>
            </section>
          </aside>
        )}

        {notice && (
          <button
            type="button"
            className="surface-notice"
            onClick={() => setNotice(null)}
            aria-label={`${notice} Dismiss`}
          >
            {notice}
          </button>
        )}
      </section>
    </main>
  );
}
