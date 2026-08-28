/**
 * Pure presentation seams for the first-run Fogwood scenario review loop.
 *
 * This module intentionally knows nothing about React, tldraw, the DOM, or
 * WebMCP.  The page supplies the state it already owns and renders the
 * bounded model returned here.
 */

export const GUIDED_COMPOSITION_PROMPT = [
  'Use fogwood-inspect to read the live canvas and spatial state first; do not assume that a host tool is available.',
  'Use fogwood-bazaar search/read to find the exact locally pinned fogwood.fungi-cities-research-world@2 composition.v2 and inspect its bounded materials, moves, source notes, and image provocation.',
  'Inspect the actual host capability inventory just in time. Keep page registration, host exposure, conversation inventory, and successful call evidence separate; only use a live image capability if the host actually exposes and successfully calls one.',
  'Use fogwood-propose to stage the entire composition through the existing review bridge. If an image capability is genuinely available, bring only its bounded bytes through add_materials; otherwise keep the visible portal as an open provocation. Stop for the page-owned Apply or Reject decision; do not apply on your own.',
  'After I move or edit the canvas, inspect again and stage a bounded branch, mutation, annotation, or remix that preserves the existing matter and shows a different diff; do not overwrite it.',
].join(' ');

/** Compatibility export retained for callers that named the former guided copy. */
export const GUIDED_COMPARE_PROMPT = GUIDED_COMPOSITION_PROMPT;

export const SUGGESTED_REQUESTS = [
  'Inspect this page, then find and read the pinned fungi-and-cities research world. Stage the composition for review and wait for my Apply or Reject decision.',
  'Find the pinned evidence constellation, inspect its claims, sources, and typed edges, and stage it without applying it.',
  'Find the pinned storyworld mutation map, preserve its existing branch lineage, and stage the composition for review without overwriting anything.',
] as const;

export type DemoConnection = {
  checked: boolean;
  available: boolean;
  registered: number;
  failed: number;
  errors?: readonly string[];
};

export type DemoActivity = {
  title: string;
};

export type DemoProposal = {
  status: 'pending' | 'stale' | 'error';
  diff?: {
    instrument_changes?: readonly unknown[];
  };
};

export type DemoReceipt = {
  event: string;
};

export type InstrumentDiffEntry = {
  id: string;
  label: string;
  before: unknown;
  after: unknown;
  plain: string;
};

export type InstrumentDiffScope = {
  recipeInstanceId: string;
  controls: InstrumentDiffEntry[];
  derived: InstrumentDiffEntry[];
};

export type WorkflowStepStatus = 'complete' | 'current' | 'upcoming' | 'attention';

export type WorkflowStep = {
  id: 'inspect' | 'propose' | 'review' | 'decision' | 'receipt';
  label: 'Inspect' | 'Propose' | 'Human review' | 'Apply/Reject' | 'Receipt';
  status: WorkflowStepStatus;
  description: string;
};

export type GuidedDemoModel = {
  prompt: string;
  suggestedRequests: readonly string[];
  host: {
    className: 'is-checking' | 'is-connecting' | 'is-unavailable' | 'is-partial' | 'is-ready' | 'is-error';
    label: string;
    detail: string;
    canStageLocally: boolean;
  };
  steps: WorkflowStep[];
  instrumentChanges: InstrumentDiffScope[];
};

export type GuidedDemoInput = {
  hasContent: boolean;
  controllerReady: boolean;
  connection: DemoConnection;
  activities: readonly DemoActivity[];
  proposal: DemoProposal | null;
  receipts: readonly DemoReceipt[];
};

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function boundedText(value: unknown, fallback: string, limit: number) {
  return typeof value === 'string' && value.length > 0 ? value.slice(0, limit) : fallback;
}

function displayValue(value: unknown, depth = 0): string {
  if (value === undefined || value === null || value === '') return '—';
  if (depth > 2) return 'details';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '—';
    return String(Number.isInteger(value) ? value : Number(value.toFixed(4)));
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string') return value.slice(0, 100);
  if (isRecord(value) && value.kind === 'chart' && Array.isArray(value.series)) {
    const series: string[] = value.series.flatMap((item): string[] => {
      if (!isRecord(item) || typeof item.label !== 'string') return [];
      return [`${item.label}: ${displayValue(item.value, depth + 1)}`];
    });
    if (series.length > 0) return series.join(' · ').slice(0, 100);
  }
  if (isRecord(value) && 'value' in value) return displayValue(value.value, depth + 1);
  try {
    const serialized = JSON.stringify(value);
    return typeof serialized === 'string' ? serialized.slice(0, 100) : 'details';
  } catch {
    return 'details';
  }
}

function normalizeInstrumentEntry(value: unknown): InstrumentDiffEntry | null {
  if (!isRecord(value)) return null;
  const id = boundedText(value.id, 'unknown control', 120);
  const label = boundedText(value.label, id, 120);
  const before = value.before;
  const after = value.after;
  return {
    id,
    label,
    before,
    after,
    plain: `${label}: ${displayValue(before)} → ${displayValue(after)}`,
  };
}

function normalizeInstrumentChanges(value: readonly unknown[] | undefined): InstrumentDiffScope[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).flatMap((rawScope) => {
    if (!isRecord(rawScope)) return [];
    const controls = Array.isArray(rawScope.controls)
      ? rawScope.controls.slice(0, 12).flatMap((entry) => {
        const normalized = normalizeInstrumentEntry(entry);
        return normalized ? [normalized] : [];
      })
      : [];
    const derived = Array.isArray(rawScope.derived)
      ? rawScope.derived.slice(0, 24).flatMap((entry) => {
        const normalized = normalizeInstrumentEntry(entry);
        return normalized ? [normalized] : [];
      })
      : [];
    if (controls.length === 0 && derived.length === 0) return [];
    return [{
      recipeInstanceId: boundedText(rawScope.recipe_instance_id, 'Compare & Decide', 120),
      controls,
      derived,
    }];
  });
}

function hasActivity(activities: readonly DemoActivity[], phrase: string) {
  return activities.some((activity) => activity.title.toLowerCase().includes(phrase));
}

function hasReceipt(receipts: readonly DemoReceipt[], ...events: string[]) {
  return receipts.some((receipt) => events.includes(receipt.event));
}

function hostModel(connection: DemoConnection, controllerReady: boolean): GuidedDemoModel['host'] {
  const errors = connection.errors ?? [];
  if (!connection.checked) {
    return {
      className: 'is-checking',
      label: 'Checking the ChatGPT host',
      detail: controllerReady
        ? 'Local page staging is ready while Fogwood checks whether WebMCP is exposed in this tab.'
        : 'The canvas is loading; local staging becomes available when the page controller is ready.',
      canStageLocally: controllerReady,
    };
  }
  if (!connection.available) {
    return {
      className: 'is-unavailable',
      label: 'ChatGPT host tools unavailable',
      detail: controllerReady
        ? 'WebMCP is not exposed in this tab. You can still use the local canvas; a host must separately expose and successfully call the three page tools.'
        : 'WebMCP is not exposed in this tab yet. Wait for the page controller, then local composition staging remains available even without host tools.',
      canStageLocally: controllerReady,
    };
  }
  if (connection.registered === 0 && connection.failed === 0) {
    return {
      className: 'is-connecting',
      label: 'Registering Fogwood tools',
      detail: 'The WebMCP interface is available. Fogwood is registering its three bounded inspect, capability, and proposal tools.',
      canStageLocally: controllerReady,
    };
  }
  if (connection.registered > 0 && connection.failed > 0) {
    return {
      className: 'is-partial',
      label: `${connection.registered} page-registered · ${connection.failed} failed`,
      detail: `Page registration is partial; host exposure, conversation inventory, and successful calls remain separate checks. Local staging stays page-owned.${errors[0] ? ` First rejection: ${errors[0].slice(0, 180)}` : ''}`,
      canStageLocally: controllerReady,
    };
  }
  if (connection.registered > 0) {
    return {
      className: 'is-ready',
      label: `${connection.registered} page tools registered`,
      detail: 'Page registration succeeded. Host exposure, conversation inventory, and a successful tool call are separate checks; the page still owns Apply and Reject.',
      canStageLocally: controllerReady,
    };
  }
  return {
    className: 'is-error',
    label: 'Site tool registration failed',
    detail: errors[0]
        ? `WebMCP is available, but no Fogwood tool registered. First rejection: ${errors[0].slice(0, 180)}`
        : 'WebMCP is available, but no Fogwood tool registered. Reload the page before trying again.',
    canStageLocally: controllerReady,
  };
}

function workflowSteps(input: GuidedDemoInput): WorkflowStep[] {
  const inspected = hasActivity(input.activities, 'inspected the page');
  const hasProposal = Boolean(input.proposal) || hasReceipt(input.receipts, 'proposal-staged', 'recipe-staged');
  const decided = !input.proposal && hasReceipt(input.receipts, 'proposal-applied', 'proposal-rejected');
  const attention = input.proposal?.status === 'stale' || input.proposal?.status === 'error';
  return [
    {
      id: 'inspect',
      label: 'Inspect',
      status: inspected ? 'complete' : 'current',
      description: inspected
        ? 'Current page state and revision were read.'
        : input.hasContent
          ? 'Read the current page before proposing anything.'
          : 'The blank page is ready for a first bounded inspection.',
    },
    {
      id: 'propose',
      label: 'Propose',
      status: hasProposal ? 'complete' : inspected ? 'current' : 'upcoming',
      description: hasProposal ? 'A typed proposal is staged against the inspected revision.' : 'Stage one bounded recipe or scenario proposal.',
    },
    {
      id: 'review',
      label: 'Human review',
      status: attention ? 'attention' : input.proposal?.status === 'pending' ? 'current' : decided ? 'complete' : 'upcoming',
      description: attention
        ? 'The proposal needs a fresh inspection before review can continue.'
        : input.proposal?.status === 'pending'
          ? 'Read controls, predicted outputs, warnings, and the source revision.'
          : 'The page holds the proposal here until a person reviews it.',
    },
    {
      id: 'decision',
      label: 'Apply/Reject',
      status: decided ? 'complete' : input.proposal?.status === 'pending' ? 'upcoming' : attention ? 'attention' : 'upcoming',
      description: decided ? 'A person chose the page-owned outcome.' : 'Choose Apply or Reject; the agent cannot do this step.',
    },
    {
      id: 'receipt',
      label: 'Receipt',
      status: decided ? 'complete' : 'upcoming',
      description: decided ? 'The device-local evidence ledger records the lifecycle.' : 'The local ledger records accepted stage and Apply/Reject events.',
    },
  ];
}

export function buildGuidedDemoModel(input: GuidedDemoInput): GuidedDemoModel {
  return {
    prompt: GUIDED_COMPARE_PROMPT,
    suggestedRequests: SUGGESTED_REQUESTS,
    host: hostModel(input.connection, input.controllerReady),
    steps: workflowSteps(input),
    instrumentChanges: normalizeInstrumentChanges(input.proposal?.diff?.instrument_changes),
  };
}
