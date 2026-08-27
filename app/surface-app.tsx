'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Editor, Tldraw } from 'tldraw';
import 'tldraw/tldraw.css';
import BazaarPanel from './bazaar-panel';
import { SurfaceBlockUtil } from './surface-block';
import {
  ProposalControllerState,
  RecipeId,
} from './fogwood-runtime';
import { FOGWOOD_PERSISTENCE_KEY } from './fogwood-persistence';
import { createFogwoodReceiptRecorder } from './fogwood-receipt-recorder';
import {
  RECEIPT_STORAGE_KEY,
  createReceiptLedger,
  type Receipt,
} from './fogwood-receipts';
import {
  SnapshotExportError,
  createFogwoodSnapshot,
  downloadFogwoodSnapshot,
} from './fogwood-snapshot';
import {
  currentRevision,
  SurfaceToolController,
  ToolConnection,
  registerSurfaceTools,
} from './surface-tools';
import type { ProposalLifecycleEvent } from './fogwood-proposal-lifecycle';

type Activity = {
  id: string;
  kind: 'agent' | 'action' | 'user' | 'system';
  title: string;
  detail?: string;
};

const shapeUtils = [SurfaceBlockUtil];

function diffValue(value: unknown) {
  if (value === undefined) return 'none';
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value).slice(0, 80);
  if (Array.isArray(value)) return `list (${value.length})`;
  return 'details';
}

function proposalDiffEntries(diff: ProposalControllerState['diff']) {
  const entries: string[] = [];
  for (const spec of diff.adds.specs.slice(0, 16)) entries.push(`Add ${spec.type} · ${spec.kind} · ${spec.label}`);
  for (const update of diff.updates) {
    for (const change of update.changes.slice(0, 16)) {
      for (const [field, values] of Object.entries(change.fields).slice(0, 4)) {
        entries.push(`Update ${change.id} · ${field}: ${diffValue(values.before)} → ${diffValue(values.after)}`);
      }
    }
  }
  for (const move of diff.moves) {
    for (const change of move.changes.slice(0, 16)) {
      entries.push(`Move ${change.id} · (${change.before.x}, ${change.before.y}, ${change.before.rotation.toFixed(2)}) → (${change.after.x}, ${change.after.y}, ${change.after.rotation.toFixed(2)})`);
    }
  }
  const collateral = new Set(diff.removes.collateral_ids);
  for (const descriptor of diff.removes.descriptors.slice(0, 32)) {
    entries.push(`Remove ${descriptor.id} · ${descriptor.label}${collateral.has(descriptor.id) ? ' (child)' : ''}`);
  }
  for (const recipe of diff.recipe_expansions) entries.push(`Recipe ${recipe.title} · ${recipe.expected_count} items`);
  return entries;
}

const INTRO_ACTIVITY: Activity = {
  id: 'intro',
  kind: 'agent',
  title: 'What should we make together?',
  detail:
    'You shape the canvas directly. Ask ChatGPT to inspect, propose, or revise the same live artifact.',
};

function activityId() {
  return `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 240) : 'An unexpected Fogwood page error occurred.';
}

function receiptListError(result: { ok: false; error: { message: string } }) {
  return result.error.message.slice(0, 220);
}

function receiptLabel(event: Receipt['event']) {
  const labels: Record<Receipt['event'], string> = {
    'proposal-staged': 'Proposal staged',
    'proposal-applied': 'Proposal applied',
    'proposal-rejected': 'Proposal rejected',
    'recipe-staged': 'Recipe staged',
    'recipe-inserted': 'Recipe inserted',
    'snapshot-exported': 'Snapshot exported',
  };
  return labels[event];
}

export default function SurfaceApp({ licenseKey }: { licenseKey?: string }) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [shapeCount, setShapeCount] = useState(0);
  const [chatOpen, setChatOpen] = useState(true);
  const [bazaarOpen, setBazaarOpen] = useState(false);
  const [connection, setConnection] = useState<ToolConnection>({
    checked: false,
    available: false,
    registered: 0,
    failed: 0,
    errors: [],
  });
  const [activity, setActivity] = useState<Activity[]>([INTRO_ACTIVITY]);
  const [proposal, setProposal] = useState<ProposalControllerState | null>(null);
  const [controllerReady, setControllerReady] = useState(false);
  const [snapshotBusy, setSnapshotBusy] = useState(false);
  const [snapshotMessage, setSnapshotMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [receiptLedger, receiptInitError, initialReceipts] = useMemo(() => {
    if (typeof window === 'undefined') {
      return [null, 'The local receipt ledger is only available in the browser.', []] as const;
    }
    try {
      const ledger = createReceiptLedger({
        storage: {
          read: () => window.localStorage.getItem(RECEIPT_STORAGE_KEY),
          write: (serialized) => window.localStorage.setItem(RECEIPT_STORAGE_KEY, serialized),
        },
        idSource: () => {
          const randomUUID = window.crypto?.randomUUID;
          if (typeof randomUUID !== 'function') throw new Error('This browser does not provide crypto.randomUUID for receipt IDs.');
          return randomUUID.call(window.crypto);
        },
      });
      const listed = ledger.list({ limit: 8, newest_first: true });
      return [ledger, listed.ok ? null : receiptListError(listed), listed.ok ? listed.receipts : []] as const;
    } catch (error) {
      return [null, `Receipt ledger unavailable: ${errorMessage(error)}`, []] as const;
    }
  }, []);
  const [receipts, setReceipts] = useState<readonly Receipt[]>(initialReceipts);
  const [receiptError, setReceiptError] = useState<string | null>(receiptInitError);
  const [receiptRecorder] = useState(() => {
    if (!receiptLedger) return null;
    return createFogwoodReceiptRecorder({
      ledger: receiptLedger,
      on_recorded: () => {
        const listed = receiptLedger.list({ limit: 8, newest_first: true });
        if (listed.ok) {
          setReceipts(listed.receipts);
          setReceiptError(null);
        } else {
          setReceiptError(`Receipt ledger could not refresh: ${receiptListError(listed)}`);
        }
      },
    });
  });
  const registrationCleanup = useRef<(() => void) | null>(null);
  const proposalController = useRef<SurfaceToolController | null>(null);
  const bazaarToggleRef = useRef<HTMLButtonElement | null>(null);

  const hasContent = shapeCount > 0;

  function addActivity(next: Omit<Activity, 'id'>) {
    setActivity((current) => [...current.slice(-24), { ...next, id: activityId() }]);
  }

  useEffect(() => {
    if (!editor) return;
    const updateCount = () => setShapeCount(editor.getCurrentPageShapes().length);
    updateCount();
    return editor.store.listen(updateCount);
  }, [editor]);

  useEffect(() => () => registrationCleanup.current?.(), []);

  const mountEditor = useCallback((nextEditor: Editor) => {
    registrationCleanup.current?.();
    setEditor(nextEditor);
    registrationCleanup.current = registerSurfaceTools(
      nextEditor,
      setConnection,
      (title, detail) => {
        setActivity((current) => [
          ...current.slice(-24),
          { kind: 'action', title, detail, id: activityId() },
        ]);
      },
      setProposal,
      (controller) => {
        proposalController.current = controller;
        setControllerReady(true);
        setProposal(controller.getState());
      },
      (event: ProposalLifecycleEvent) => {
        if (!receiptRecorder) {
          const detail = receiptInitError ?? 'The local receipt ledger is not available.';
          setReceiptError(detail);
          setActivity((current) => [
            ...current.slice(-24),
            { kind: 'system', title: 'Receipt was not recorded', detail, id: activityId() },
          ]);
          return;
        }
        try {
          const recorded = receiptRecorder.recordProposalLifecycle(event);
          if (!recorded.ok) {
            const detail = `${recorded.status}: ${recorded.error.message.slice(0, 200)}`;
            setReceiptError(detail);
            setActivity((current) => [
              ...current.slice(-24),
              { kind: 'system', title: 'Receipt was not recorded', detail, id: activityId() },
            ]);
          }
        } catch (error) {
          const detail = `Receipt recording failed: ${errorMessage(error)}`;
          setReceiptError(detail);
          setActivity((current) => [
            ...current.slice(-24),
            { kind: 'system', title: 'Receipt was not recorded', detail, id: activityId() },
          ]);
        }
      },
    );
  }, [receiptInitError, receiptRecorder]);

  const connectionStatus = useMemo(() => {
    if (!connection.checked) {
      return {
        className: 'is-checking',
        label: 'Checking for Fogwood tools',
        title: 'Checking this tab for Fogwood tools',
        detail:
          'The canvas is ready. WebMCP availability is checked separately from whether ChatGPT is open.',
      };
    }
    if (!connection.available) {
      const providerDetail = connection.errors[0]
        ? ` The host reported: ${connection.errors[0]}`
        : '';
      return {
        className: 'is-unavailable',
        label: 'Fogwood tools not active in this tab',
        title: 'Check browser and rollout availability',
        detail:
          `Use the latest ChatGPT desktop app with GPT-5.6 Sol or Terra. In Settings → Browser → Permissions, enable Site tools when the switch is available. If another Site works here but Fogwood does not, this origin is not enabled for the current rollout yet.${providerDetail}`,
      };
    }
    if (connection.registered === 0 && connection.failed === 0) {
      return {
        className: 'is-connecting',
        label: 'Registering Fogwood tools',
        title: 'Connecting Fogwood tools',
        detail:
          'The WebMCP interface is available and Fogwood is registering its bounded canvas tools.',
      };
    }
    if (connection.registered > 0 && connection.failed > 0) {
      const failureDetail = connection.errors[0]
        ? ` First rejection: ${connection.errors[0]}`
        : '';
      return {
        className: 'is-partial',
        label: `${connection.registered} ready · ${connection.failed} failed`,
        title: 'Some Site tools are ready',
        detail: `${connection.registered} canvas tools registered; ${connection.failed} could not register.${failureDetail}`,
      };
    }
    if (connection.registered > 0) {
      return {
        className: 'is-ready',
        label: `${connection.registered} Fogwood tools ready`,
        title: 'Continue in your ChatGPT conversation',
        detail:
          'Your subscription is the model connection. This Site only exposes the canvas tools ChatGPT can use—no second API key.',
      };
    }
    return {
      className: 'is-error',
      label: 'Site tool registration failed',
      title: 'Site tools could not connect',
        detail: connection.errors[0]
        ? `WebMCP is available, but none of the Fogwood tools registered. First rejection: ${connection.errors[0]}`
        : 'WebMCP is available, but none of the Fogwood tools registered. Reload the page before trying again.',
    };
  }, [connection]);

  function makeRecipe(recipe: RecipeId) {
    if (!proposalController.current) return;
    const result = proposalController.current.stageRecipe(recipe);
    if (result.status === 'ERROR') {
      addActivity({ kind: 'system', title: 'Recipe could not be staged', detail: result.message });
    }
  }

  function stageBazaarRecipe(recipeId: string) {
    if (!recipeId) {
      addActivity({ kind: 'system', title: 'Package has no recipe identity', detail: 'The exact local package could not be staged.' });
      return;
    }
    if (!proposalController.current) {
      addActivity({ kind: 'system', title: 'Recipe is not ready to stage', detail: 'The page controller is still connecting.' });
      return;
    }
    const result = proposalController.current.stageRecipe(recipeId);
    if (result.status === 'ERROR') {
      addActivity({ kind: 'system', title: 'Recipe could not be staged', detail: result.message });
      return;
    }
    setBazaarOpen(false);
    window.requestAnimationFrame(() => bazaarToggleRef.current?.focus());
  }

  function closeBazaar() {
    setBazaarOpen(false);
    window.requestAnimationFrame(() => bazaarToggleRef.current?.focus());
  }

  async function exportSnapshot() {
    if (!editor || !hasContent || snapshotBusy) return;
    setSnapshotBusy(true);
    setSnapshotMessage(null);
    try {
      const sourceRevision = currentRevision(editor);
      const snapshot = await createFogwoodSnapshot(editor, sourceRevision, {
        get_revision: () => currentRevision(editor),
      });
      if (!receiptRecorder) {
        const detail = receiptInitError ?? 'The local receipt ledger is not available.';
        setReceiptError(detail);
        setSnapshotMessage({ kind: 'error', text: `Snapshot was not exported: ${detail}` });
        addActivity({ kind: 'system', title: 'Snapshot was not exported', detail });
        return;
      }
      const recorded = receiptRecorder.recordSnapshot({
        source_revision: snapshot.source_revision,
        artifact: snapshot.artifact,
      });
      if (!recorded.ok) {
        const detail = `${recorded.status}: ${recorded.error.message.slice(0, 200)}`;
        setReceiptError(detail);
        setSnapshotMessage({ kind: 'error', text: `Snapshot receipt was not recorded; no download started. ${detail}` });
        addActivity({ kind: 'system', title: 'Snapshot receipt was not recorded', detail });
        return;
      }
      const latestRevision = currentRevision(editor);
      if (latestRevision !== snapshot.source_revision) {
        const detail = `The page changed after the snapshot receipt was recorded (source ${snapshot.source_revision}; current ${latestRevision}). The receipt was retained locally; no download started.`;
        setSnapshotMessage({ kind: 'error', text: `Snapshot became stale; receipt retained and no download started. ${detail}` });
        addActivity({ kind: 'system', title: 'Snapshot became stale before download', detail: 'The export receipt was retained locally; no file was downloaded.' });
        return;
      }
      try {
        downloadFogwoodSnapshot(snapshot);
        setSnapshotMessage({ kind: 'success', text: `Local SVG exported · ${snapshot.file_name}` });
        addActivity({ kind: 'action', title: 'Exported a local SVG snapshot', detail: `${snapshot.shape_count} items · ${snapshot.artifact.hash}` });
      } catch (error) {
        const detail = errorMessage(error);
        setSnapshotMessage({ kind: 'error', text: `Snapshot receipt retained, but download failed: ${detail}` });
        addActivity({ kind: 'system', title: 'Snapshot download failed', detail: 'The export receipt was retained locally.' });
      }
    } catch (error) {
      const code = error instanceof SnapshotExportError ? ` [${error.code}]` : '';
      const detail = `${errorMessage(error)}${code}`;
      setSnapshotMessage({ kind: 'error', text: `Snapshot was not exported: ${detail}` });
      addActivity({ kind: 'system', title: 'Snapshot was not exported', detail });
    } finally {
      setSnapshotBusy(false);
    }
  }

  function applyProposal() {
    const result = proposalController.current?.apply();
    if (result?.status === 'APPLIED') {
      addActivity({ kind: 'action', title: 'Applied the reviewed proposal', detail: 'All changes are in one undoable transaction.' });
    } else if (result?.status === 'STALE_STATE') {
      addActivity({ kind: 'system', title: 'Proposal is stale', detail: 'Inspect the current page and ask Fogwood to propose again.' });
    } else if (result?.status === 'ERROR') {
      addActivity({ kind: 'system', title: 'Proposal was not applied', detail: result.message });
    }
  }

  function rejectProposal() {
    const result = proposalController.current?.reject();
    if (result?.status === 'REJECTED') {
      addActivity({ kind: 'action', title: 'Rejected the proposal', detail: 'The canvas was not changed.' });
    }
  }

  function clearFromUi() {
    if (!editor || !hasContent) return;
    const confirmed = window.confirm(
      'Clear every item on this page? You can still undo immediately afterward.',
    );
    if (!confirmed) return;
    const ids = editor.getCurrentPageShapes().map((shape) => shape.id);
    editor.markHistoryStoppingPoint('Clear surface');
    editor.deleteShapes(ids);
    addActivity({
      kind: 'action',
      title: 'Cleared the surface',
      detail: `${ids.length} items removed. Undo remains available.`,
    });
  }

  return (
    <main className={`surface-shell ${chatOpen ? 'chat-is-open' : ''}`}>
      <section className="canvas-pane" aria-label="Fogwood canvas">
        <Tldraw
          shapeUtils={shapeUtils}
          licenseKey={licenseKey}
          persistenceKey={FOGWOOD_PERSISTENCE_KEY}
          onMount={mountEditor}
        />

        <div className="surface-mark" aria-label="Fogwood">
          <span className="surface-mark-dot" />
          <span>Fogwood</span>
          <span className="surface-mark-state">
            {shapeCount === 0 ? 'blank' : `${shapeCount} items`}
          </span>
        </div>

        <button
          type="button"
          className="chat-toggle"
          aria-expanded={chatOpen}
          aria-controls="agent-sidebar"
          onClick={() => setChatOpen((open) => !open)}
        >
          <span aria-hidden="true">✦</span>
          {chatOpen ? 'Hide chat' : 'ChatGPT'}
        </button>

        <div className="canvas-actions" aria-label="Fogwood page actions">
          <button
            type="button"
            className="bazaar-toggle"
            ref={bazaarToggleRef}
            aria-expanded={bazaarOpen}
            aria-controls="fogwood-bazaar-panel"
            onClick={() => setBazaarOpen((open) => !open)}
          >
            <span aria-hidden="true">✦</span>
            {bazaarOpen ? 'Hide Bazaar' : 'Bazaar'}
          </button>
          <button
            type="button"
            className="snapshot-toggle"
            disabled={!editor || !hasContent || snapshotBusy}
            onClick={() => void exportSnapshot()}
            title={hasContent ? 'Create, receipt, and download a local SVG snapshot' : 'Add content before exporting a snapshot'}
          >
            <span aria-hidden="true">↧</span>
            {snapshotBusy ? 'Preparing…' : 'Export SVG'}
          </button>
        </div>

        {snapshotMessage && (
          <p className={`surface-export-status is-${snapshotMessage.kind}`} role={snapshotMessage.kind === 'error' ? 'alert' : 'status'} aria-live="polite">
            {snapshotMessage.text}
          </p>
        )}

        <BazaarPanel
          open={bazaarOpen}
          canStage={controllerReady}
          onClose={closeBazaar}
          onStage={(recipeId) => stageBazaarRecipe(recipeId)}
        />

        {!hasContent && (
          <section className="empty-invitation" aria-labelledby="empty-title">
            <p className="eyebrow">One canvas for people + agents</p>
            <h1 id="empty-title">Start with nothing. Make anything.</h1>
            <p className="empty-copy">
              Draw directly, or ask ChatGPT to compose the workspace, interface,
              or diagram you need right now. Both of you work on the same artifact.
            </p>
            <div className="prompt-examples" aria-label="Starter surfaces">
              <button type="button" onClick={() => makeRecipe('evidence-research-map')} disabled={!editor}>
                Evidence map
              </button>
              <button type="button" onClick={() => makeRecipe('meeting-to-plan-wall')} disabled={!editor}>
                Meeting wall
              </button>
              <button type="button" onClick={() => makeRecipe('static-architecture-map')} disabled={!editor}>
                Architecture map
              </button>
              <button type="button" onClick={() => makeRecipe('compare-and-decide')} disabled={!editor}>
                Compare &amp; Decide
              </button>
            </div>
            <p className="empty-footnote">Or leave it completely blank. That is the point.</p>
          </section>
        )}
      </section>

      <aside id="agent-sidebar" className="agent-sidebar" aria-label="ChatGPT surface chat">
        <header className="agent-header">
          <div>
            <span className="agent-avatar" aria-hidden="true">✦</span>
            <div>
              <h2>ChatGPT</h2>
              <p className={connectionStatus.className} aria-live="polite">
                <span />
                {connectionStatus.label}
              </p>
            </div>
          </div>
          <button type="button" aria-label="Close chat sidebar" onClick={() => setChatOpen(false)}>
            ×
          </button>
        </header>

        <div className="agent-context-strip">
          <span>Shared artifact</span>
          <strong>{shapeCount === 0 ? 'Blank surface' : `${shapeCount} canvas items`}</strong>
        </div>

        <section className="receipt-summary" aria-label="Recent local Fogwood receipts">
          <div className="receipt-summary-header">
            <div>
              <span>Evidence ledger</span>
              <strong>Recent receipts</strong>
            </div>
            <span>{receiptLedger ? `${receipts.length} shown` : 'Unavailable'}</span>
          </div>
          {receiptError && <p className="receipt-error" role="alert">{receiptError}</p>}
          {receipts.length > 0 ? (
            <ol className="receipt-list">
              {receipts.slice(0, 4).map((receipt) => (
                <li key={receipt.receipt_id}>
                  <span><strong>#{receipt.sequence}</strong> {receiptLabel(receipt.event)}</span>
                  <code>{receipt.receipt_id}</code>
                </li>
              ))}
            </ol>
          ) : (
            <p className="receipt-empty">Staging, Apply, Reject, and SVG export leave device-local evidence here.</p>
          )}
        </section>

        <div className="proposal-slot">
          {proposal && (
            <section className={`proposal-review proposal-${proposal.status}`} aria-label="Fogwood proposal review">
            <div className="proposal-review-header">
              <div>
                <span className="proposal-eyebrow">Page review</span>
                <h3>{proposal.proposal.summary}</h3>
              </div>
              <span className="proposal-status">{proposal.status === 'pending' ? 'Ready' : proposal.status === 'stale' ? 'Stale' : 'Error'}</span>
            </div>
            {proposal.proposal.rationale && <p className="proposal-rationale">{proposal.proposal.rationale}</p>}
            <div className="proposal-counts" aria-label="Proposal changes">
              <span><strong>{proposal.diff.counts.adds}</strong> adds</span>
              <span><strong>{proposal.diff.counts.updates}</strong> updates</span>
              <span><strong>{proposal.diff.counts.moves}</strong> moves</span>
              <span><strong>{proposal.diff.counts.removes}</strong> removes</span>
            </div>
            {proposalDiffEntries(proposal.diff).length > 0 && (
              <div className="proposal-diff" aria-label="Proposal details">
                <span className="proposal-diff-title">Affected objects</span>
                <ul className="proposal-diff-list">
                  {proposalDiffEntries(proposal.diff).slice(0, 28).map((entry, index) => <li key={`${entry}-${index}`}>{entry}</li>)}
                </ul>
                {proposalDiffEntries(proposal.diff).length > 28 && <span className="proposal-diff-more">Showing the first 28 bounded changes.</span>}
              </div>
            )}
            {proposal.diff.warnings.length > 0 && (
              <ul className="proposal-warnings">
                {proposal.diff.warnings.slice(0, 4).map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            )}
            {proposal.message && <p className="proposal-message">{proposal.message}</p>}
            <div className="proposal-actions">
              <button type="button" onClick={applyProposal} disabled={proposal.status !== 'pending'}>Apply</button>
              <button type="button" onClick={rejectProposal}>Reject</button>
            </div>
            <p className="proposal-footnote">Applying is page-owned and creates one undo step. Reject never changes the canvas.</p>
            </section>
          )}
        </div>

        <div className="agent-messages" aria-live="polite">
          {activity.map((item) => (
            <article key={item.id} className={`agent-message message-${item.kind}`}>
              {item.kind === 'action' && <span className="message-icon" aria-hidden="true">↳</span>}
              {item.kind === 'agent' && <span className="message-icon" aria-hidden="true">✦</span>}
              <div>
                <p>{item.title}</p>
                {item.detail && <span>{item.detail}</span>}
              </div>
            </article>
          ))}
        </div>

        <div className="agent-suggestions" aria-label="Suggested requests">
          <p>Try asking ChatGPT</p>
          <span>“Build me a lightweight CRM for five active relationships.”</span>
          <span>“Turn this into a research board with sources, claims, and open questions.”</span>
          <span>“Improve the hierarchy here without deleting my content.”</span>
        </div>

        <section
          className={`native-chat-handoff ${connectionStatus.className}`}
          aria-label="ChatGPT connection"
        >
          <span aria-hidden="true">{connection.registered > 0 ? '↗' : 'i'}</span>
          <div>
            <strong>{connectionStatus.title}</strong>
            <p>{connectionStatus.detail}</p>
            {connection.checked && !connection.available && (
              <div className="site-tools-recovery">
                <a
                  href="https://learn.chatgpt.com/docs/webmcp"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open setup guide
                </a>
                <button type="button" onClick={() => window.location.reload()}>
                  Reload check
                </button>
              </div>
            )}
          </div>
        </section>

        <footer className="agent-footer">
          <button type="button" onClick={() => editor?.undo()} disabled={!editor}>Undo</button>
          <button type="button" onClick={() => editor?.zoomToFit({ animation: { duration: 280 } })} disabled={!hasContent}>Fit all</button>
          <button type="button" onClick={clearFromUi} disabled={!hasContent}>Start blank</button>
        </footer>
      </aside>
    </main>
  );
}
