'use client';

import { useEffect, useMemo, useState } from 'react';
import { Editor, Tldraw } from 'tldraw';
import 'tldraw/tldraw.css';
import { SurfaceBlockUtil } from './surface-block';
import {
  RecipeName,
  ToolConnection,
  buildRecipe,
  registerSurfaceTools,
} from './surface-tools';

type Activity = {
  id: string;
  kind: 'agent' | 'action' | 'user' | 'system';
  title: string;
  detail?: string;
};

const shapeUtils = [SurfaceBlockUtil];

const INTRO_ACTIVITY: Activity = {
  id: 'intro',
  kind: 'agent',
  title: 'What should we make together?',
  detail:
    'You shape the canvas directly. Ask ChatGPT to inspect, compose, or revise the same live artifact.',
};

function activityId() {
  return `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function SurfaceApp() {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [shapeCount, setShapeCount] = useState(0);
  const [chatOpen, setChatOpen] = useState(true);
  const [connection, setConnection] = useState<ToolConnection>({
    available: false,
    registered: 0,
    failed: 0,
  });
  const [activity, setActivity] = useState<Activity[]>([INTRO_ACTIVITY]);

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

  useEffect(() => {
    if (!editor) return;
    return registerSurfaceTools(editor, setConnection, (title, detail) => {
      addActivity({ kind: 'action', title, detail });
    });
  }, [editor]);

  const connectionLabel = useMemo(() => {
    if (!connection.available) return 'Open in ChatGPT to connect';
    if (connection.registered === 0 && connection.failed === 0) return 'Connecting tools';
    if (connection.registered > 0) return `${connection.registered} Site tools ready`;
    return 'Site tools unavailable';
  }, [connection]);

  function makeRecipe(recipe: RecipeName) {
    if (!editor) return;
    const labels: Record<RecipeName, string> = {
      cockpit: 'Built a project cockpit',
      week: 'Built a weekly planning surface',
      decision: 'Built a decision surface',
    };
    const ids = buildRecipe(editor, recipe);
    addActivity({
      kind: 'action',
      title: labels[recipe],
      detail: `${ids.length} editable blocks added in one undoable step.`,
    });
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
      <section className="canvas-pane" aria-label="Open Surface canvas">
        <Tldraw
          shapeUtils={shapeUtils}
          persistenceKey="open-surface-local"
          onMount={setEditor}
        />

        <div className="surface-mark" aria-label="Open Surface">
          <span className="surface-mark-dot" />
          <span>Open Surface</span>
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

        {!hasContent && (
          <section className="empty-invitation" aria-labelledby="empty-title">
            <p className="eyebrow">One canvas for people + agents</p>
            <h1 id="empty-title">Start with nothing. Make anything.</h1>
            <p className="empty-copy">
              Draw directly, or ask ChatGPT to compose the workspace, interface,
              or diagram you need right now. Both of you work on the same artifact.
            </p>
            <div className="prompt-examples" aria-label="Starter surfaces">
              <button type="button" onClick={() => makeRecipe('cockpit')} disabled={!editor}>
                Project cockpit
              </button>
              <button type="button" onClick={() => makeRecipe('week')} disabled={!editor}>
                Plan my week
              </button>
              <button type="button" onClick={() => makeRecipe('decision')} disabled={!editor}>
                Compare options
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
              <p className={connection.registered > 0 ? 'is-ready' : ''}>
                <span />
                {connectionLabel}
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

        <section className="native-chat-handoff" aria-label="ChatGPT connection">
          <span aria-hidden="true">↗</span>
          <div>
            <strong>Continue in your ChatGPT conversation</strong>
            <p>
              Your subscription is the model connection. This Site only exposes
              the canvas tools ChatGPT can use—no second API key.
            </p>
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
