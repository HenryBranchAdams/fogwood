'use client';

// Material previews are validated, bounded data URLs produced by the page;
// Next Image cannot optimize this intentionally device-local source.
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Editor, Tldraw } from 'tldraw';
import 'tldraw/tldraw.css';
import BazaarPanel from './bazaar-panel';
import { SurfaceBlockUtil } from './surface-block';
import {
  ProposalControllerState,
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
import {
  buildGuidedDemoModel,
  type InstrumentDiffScope,
} from './fogwood-demo';

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
  for (const spec of diff.adds.specs) entries.push(`Add ${spec.type} · ${spec.kind} · ${spec.label}${spec.semantic_id ? ` · ${spec.semantic_id}` : ''}`);
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
  for (const create of diff.spatial_creates ?? []) {
    entries.push(`${create.kind === 'variant' ? 'Preserve variant' : 'Annotate'} · ${create.semantic_id}${create.source_semantic_id ? ` from ${create.source_semantic_id}` : ''}`);
  }
  for (const relationship of diff.semantic_relationships ?? []) {
    entries.push(`Edge ${relationship.kind} · ${relationship.source_semantic_id} → ${relationship.target_semantic_id}${relationship.label ? ` · ${relationship.label}` : ''}`);
  }
  const collateral = new Set(diff.removes.collateral_ids);
  for (const descriptor of diff.removes.descriptors.slice(0, 32)) {
    entries.push(`Remove ${descriptor.id} · ${descriptor.label}${collateral.has(descriptor.id) ? ' (child)' : ''}`);
  }
  for (const recipe of diff.recipe_expansions) entries.push(`Recipe ${recipe.title} · ${recipe.expected_count} items`);
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

function instrumentDiffLabel(scope: InstrumentDiffScope) {
  return scope.recipeInstanceId === 'Compare & Decide'
    ? 'Compare & Decide'
    : `Compare & Decide · ${scope.recipeInstanceId}`;
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
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [copiedRequest, setCopiedRequest] = useState<string | null>(null);
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
  const chatToggleRef = useRef<HTMLButtonElement | null>(null);

  const hasContent = shapeCount > 0;

  const guidedModel = useMemo(
    () => buildGuidedDemoModel({
      hasContent,
      controllerReady,
      connection,
      activities: activity,
      proposal,
      receipts,
    }),
    [activity, connection, controllerReady, hasContent, proposal, receipts],
  );
  const instrumentControlCount = guidedModel.instrumentChanges.reduce((sum, scope) => sum + scope.controls.length, 0);
  const instrumentDerivedCount = guidedModel.instrumentChanges.reduce((sum, scope) => sum + scope.derived.length, 0);

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
          `Use the latest ChatGPT desktop app with GPT-5.6 Sol or Terra. In Settings → Browser → Permissions, enable Site tools when the switch is available. If another Site works here but Fogwood does not, this origin is not enabled for the current rollout yet.${providerDetail}${controllerReady ? ' Local recipe staging remains available on this page while host tools are unavailable.' : ''}`,
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
        label: `${connection.registered} page-registered · ${connection.failed} failed`,
        title: 'Page tool registration is partial',
        detail: `${connection.registered} canvas tools registered on this page; ${connection.failed} could not register. Host inventory remains a separate check.${failureDetail}`,
      };
    }
    if (connection.registered > 0) {
      return {
        className: 'is-ready',
        label: `${connection.registered} page tools registered`,
        title: 'Verify the tools in your ChatGPT host',
        detail:
          'Fogwood has registered its page tools. Host inventory and a successful call are separate checks; no second API key is required.',
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
  }, [connection, controllerReady]);

  async function copyRequest(request: string) {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(request);
      } else {
        const field = document.createElement('textarea');
        field.value = request;
        field.setAttribute('readonly', '');
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        field.select();
        const copied = document.execCommand('copy');
        field.remove();
        if (!copied) throw new Error('Clipboard access was not granted.');
      }
      setCopiedRequest(request);
      setCopyFeedback(request === guidedModel.prompt ? 'Guided request copied.' : 'Suggested request copied.');
    } catch {
      setCopiedRequest(null);
      setCopyFeedback('Copy is unavailable in this host. Select the request text manually.');
    }
  }

  function makeRecipe(recipe: string) {
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

  function closeChat() {
    setChatOpen(false);
    window.requestAnimationFrame(() => chatToggleRef.current?.focus());
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
          ref={chatToggleRef}
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
          canStage={controllerReady && !proposal}
          onClose={closeBazaar}
          onStage={(recipeId) => stageBazaarRecipe(recipeId)}
        />

        {!hasContent && (
          <section className="empty-invitation" aria-labelledby="empty-title">
            <p className="eyebrow">First run · a small beginning</p>
            <h1 id="empty-title">Start with a ball of clay.</h1>
            <p className="empty-copy">
              Sketch before you know. Fogwood turns a surprising seed into
              editable native matter, then leaves room for your hands, questions,
              and imperfect next moves.
            </p>
            <div className="guided-empty-actions">
              <button
                type="button"
                className="guided-primary-action"
                onClick={() => makeRecipe('fogwood.fungi-cities-research-world')}
                disabled={!controllerReady || Boolean(proposal)}
              >
                <span aria-hidden="true">✦</span>
                Stage fungi + cities seed
              </button>
              <button
                type="button"
                className="guided-copy-action"
                onClick={() => void copyRequest(guidedModel.prompt)}
              >
                {copiedRequest === guidedModel.prompt ? 'Copied guided request' : 'Copy guided request'}
              </button>
            </div>
            <div className="guided-prompt-card">
              <div className="guided-prompt-heading">
                <span>Copyable request for ChatGPT</span>
                <span>stage only</span>
              </div>
              <p>{guidedModel.prompt}</p>
            </div>
            {copyFeedback && !hasContent && <p className="copy-feedback" role="status" aria-live="polite">{copyFeedback}</p>}
            <div className="starter-divider"><span>Two quieter worlds</span></div>
            <div className="prompt-examples" aria-label="Alternative composition worlds">
              <button type="button" onClick={() => makeRecipe('fogwood.evidence-constellation')} disabled={!controllerReady || Boolean(proposal)}>
                Evidence constellation
              </button>
              <button type="button" onClick={() => makeRecipe('fogwood.storyworld-mutation-map')} disabled={!controllerReady || Boolean(proposal)}>
                Storyworld mutation map
              </button>
            </div>
            <details className="legacy-starter">
              <summary>Block regression fixtures</summary>
              <p>Compare remains available for compatibility checks; it is not the first-run path.</p>
              <button type="button" onClick={() => makeRecipe('compare-and-decide')} disabled={!controllerReady || Boolean(proposal)}>
                Stage Compare &amp; Decide (legacy)
              </button>
            </details>
            <p className="empty-footnote">Local staging remains available if the ChatGPT host is not exposed in this tab.</p>
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
          <button type="button" aria-label="Close chat sidebar" onClick={closeChat}>
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
          <section className="workflow-guide" aria-labelledby="workflow-guide-title">
            <div className="workflow-guide-heading">
              <div>
                <span className="proposal-eyebrow">Real page contract</span>
                <h3 id="workflow-guide-title">Inspect → Receipt</h3>
              </div>
              <span className="workflow-guide-boundary">human gate</span>
            </div>
            <ol className="workflow-steps">
              {guidedModel.steps.map((step) => (
                <li
                  key={step.id}
                  className={`workflow-step is-${step.status}`}
                  aria-current={step.status === 'current' ? 'step' : undefined}
                >
                  <span className="workflow-step-marker" aria-hidden="true">
                    {step.status === 'complete' ? '✓' : step.status === 'attention' ? '!' : step.id === 'decision' ? '↳' : '·'}
                  </span>
                  <div>
                    <strong>{step.label}</strong>
                    <p>{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className={`workflow-host ${guidedModel.host.className}`}>
              <strong>{guidedModel.host.label}</strong>
              <span>{guidedModel.host.detail}</span>
            </p>
          </section>

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
            <p className="proposal-revision">
              <span>Based on page revision</span>
              <code>{proposal.proposal.base_revision}</code>
            </p>
            <div className="proposal-counts" aria-label="Proposal changes">
              {guidedModel.instrumentChanges.length > 0 ? (
                <>
                  <span><strong>{instrumentControlCount}</strong> controls</span>
                  <span><strong>{instrumentDerivedCount}</strong> predicted</span>
                  <span><strong>{guidedModel.instrumentChanges.length}</strong> scope</span>
                  <span><strong>0</strong> page items</span>
                </>
              ) : (
                <>
                  <span><strong>{proposal.diff.counts.adds}</strong> adds</span>
                  {(proposal.diff.adds.materials ?? 0) > 0 && <span><strong>{proposal.diff.adds.materials}</strong> materials</span>}
                  <span><strong>{proposal.diff.counts.updates}</strong> updates</span>
                  <span><strong>{proposal.diff.counts.moves}</strong> moves</span>
                  <span><strong>{proposal.diff.counts.removes}</strong> removes</span>
                </>
              )}
            </div>
            {(proposal.diff.adds.material_specs ?? []).length > 0 && (
              <section className="proposal-material-diff" aria-label="Qualified material previews">
                <div className="proposal-material-heading">
                  <div>
                    <span className="proposal-diff-title">Qualified material preview</span>
                    <strong>Local bytes only</strong>
                  </div>
                  <span>{proposal.diff.adds.material_specs.length} material{proposal.diff.adds.material_specs.length === 1 ? '' : 's'}</span>
                </div>
                <div className="proposal-material-list">
                  {proposal.diff.adds.material_specs.slice(0, 4).map((material) => {
                    const preview = materialPreviewBase64(proposal, material.semantic_id);
                    const source = preview ? `data:${material.mime_type};base64,${preview}` : undefined;
                    return (
                      <article className="proposal-material-card" key={`${material.semantic_id}-${material.content_hash}`}>
                        <div className="proposal-material-visual">
                          {source ? <img src={source} alt={material.alt || material.label} loading="lazy" /> : <span aria-hidden="true">No preview</span>}
                        </div>
                        <div className="proposal-material-copy">
                          <strong>{material.label}</strong>
                          <span>{material.mime_type} · {material.dimensions.width} × {material.dimensions.height}px · {material.byte_length.toLocaleString()} bytes</span>
                          <span>Hash <code>{material.content_hash}</code></span>
                          <span>From {material.originating_capability || 'unspecified capability'}</span>
                          <span>{material.source_status === 'sanitized' ? 'Sanitized strict SVG subset' : 'Original accepted bytes'} · {material.decode_qualified ? 'Browser decode qualified' : 'Decode not qualified'}</span>
                          <span>Placement ({material.x}, {material.y}) · display {material.w} × {material.h}</span>
                        </div>
                      </article>
                    );
                  })}
                </div>
                {proposal.diff.adds.material_specs.length > 4 && <span className="proposal-diff-more">Showing the four bounded material previews.</span>}
              </section>
            )}
            {guidedModel.instrumentChanges.length > 0 && (
              <section className="proposal-instrument-diff" aria-label="Predicted instrument changes">
                <div className="proposal-instrument-heading">
                  <div>
                    <span className="proposal-diff-title">Deterministic scenario preview</span>
                    <strong>Compare &amp; Decide forecast</strong>
                  </div>
                  <span>before → after</span>
                </div>
                {guidedModel.instrumentChanges.map((scope) => (
                  <div className="proposal-instrument-scope" key={scope.recipeInstanceId}>
                    <span className="proposal-instrument-scope-label">{instrumentDiffLabel(scope)}</span>
                    {scope.controls.length > 0 && (
                      <div className="proposal-instrument-group">
                        <span>Controls</span>
                        <ul>
                          {scope.controls.map((change) => <li key={`control-${change.id}`}>{change.plain}</li>)}
                        </ul>
                      </div>
                    )}
                    {scope.derived.length > 0 && (
                      <div className="proposal-instrument-group">
                        <span>Predicted results</span>
                        <ul>
                          {scope.derived.map((change) => <li key={`derived-${change.id}`}>{change.plain}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
                <p className="proposal-instrument-note">These values are a bounded local preview. Applying still requires your page-owned choice.</p>
              </section>
            )}
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
          {guidedModel.suggestedRequests.slice(0, 3).map((request, index) => (
            <button
              type="button"
              className="suggested-request"
              key={`suggested-request-${index}`}
              onClick={() => void copyRequest(request)}
              aria-label={`Copy suggested request: ${request}`}
            >
              <span aria-hidden="true">{index === 0 ? '✦' : '↗'}</span>
              <span>{request}</span>
              <small>{copiedRequest === request ? 'Copied' : 'Copy'}</small>
            </button>
          ))}
          {copyFeedback && hasContent && <span className="copy-feedback" role="status" aria-live="polite">{copyFeedback}</span>}
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
