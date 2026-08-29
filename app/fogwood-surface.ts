/**
 * The small page-independent seam between Fogwood's proposal protocol and a
 * page adapter.
 *
 * WebMCP is intentionally not an Editor façade.  A page adapter prepares a
 * complete, immutable plan before the proposal becomes reviewable; this
 * coordinator only owns the pending-review state and the page decision.
 */

import type {
  PreparedCanvasPlan,
  ProposalControllerResult,
  ProposalControllerState,
  ProposalDiff,
  ProposalV1,
} from './fogwood-runtime.ts';
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
import { canonicalSerialize } from './fogwood-runtime.ts';

export type SurfaceRevisionRead = Readonly<{
  content_revision: string;
  context_token?: string;
}>;

export type SurfaceReadRequest = Readonly<{
  kind: 'inspect' | 'capabilities' | 'revision';
  input?: unknown;
}>;

export type SurfaceDecision = 'apply' | 'reject' | Readonly<{
  kind: 'apply' | 'reject';
}> | Readonly<{
  type: 'apply' | 'reject';
}>;

export type SurfaceStageRequest = Readonly<{
  proposal: ProposalV1;
  diff: ProposalDiff;
}>;

export type SurfacePlanResult =
  | Readonly<{ ok: true; plan: PreparedCanvasPlan }>
  | Readonly<{ ok: false; status: 'STALE_STATE' | 'ERROR'; message: string }>;

export type FogwoodSurfaceAdapter = Readonly<{
  getRevision: () => string;
  getContextToken?: () => string;
  read?: (request: SurfaceReadRequest) => unknown;
  prepare: (proposal: ProposalV1, diff: ProposalDiff) => PreparedCanvasPlan | SurfacePlanResult;
  apply: (plan: PreparedCanvasPlan) =>
    | { ok: true }
    | { ok: false; status: 'STALE_STATE' | 'ERROR'; message: string };
}>;

export type FogwoodSurface = Readonly<{
  /** Stable page reads (inspect/capabilities) plus the small revision seam. */
  read: (request?: SurfaceReadRequest) => unknown;
  getState: () => ProposalControllerState | null;
  stage: (proposalOrRequest: ProposalV1 | SurfaceStageRequest, diff?: ProposalDiff) => ProposalControllerResult;
  decide: (decision: SurfaceDecision) => ProposalControllerResult;
  apply: () => ProposalControllerResult;
  reject: () => ProposalControllerResult;
}>;

function isPlanResult(value: PreparedCanvasPlan | SurfacePlanResult): value is SurfacePlanResult {
  return typeof value === 'object' && value !== null && 'ok' in value;
}

function isStageRequest(value: ProposalV1 | SurfaceStageRequest): value is SurfaceStageRequest {
  return typeof value === 'object' && value !== null && 'proposal' in value && 'diff' in value;
}

function sameStageRequest(pending: ProposalControllerState, proposal: ProposalV1, diff: ProposalDiff) {
  try {
    return canonicalSerialize({ proposal: pending.proposal, diff: pending.diff })
      === canonicalSerialize({ proposal, diff });
  } catch {
    return false;
  }
}

/**
 * Create the one deep surface seam. `prepare` is called during stage, never
 * during Apply. Pending review state lives here rather than in a second page
 * adapter, so lifecycle observers and the page UI all observe the same plan.
 */
export function createFogwoodSurface(
  adapter: FogwoodSurfaceAdapter,
  onChange?: (state: ProposalControllerState | null) => void,
): FogwoodSurface {
  let pending: ProposalControllerState | null = null;
  const publish = () => onChange?.(pending);
  const stage = (proposalOrRequest: ProposalV1 | SurfaceStageRequest, diff?: ProposalDiff): ProposalControllerResult => {
    const proposal = isStageRequest(proposalOrRequest) ? proposalOrRequest.proposal : proposalOrRequest;
    const resolvedDiff = isStageRequest(proposalOrRequest) ? proposalOrRequest.diff : diff;
    if (!resolvedDiff) return { status: 'ERROR', message: 'A proposal diff is required before staging.' };
    if (pending) {
      if (sameStageRequest(pending, proposal, resolvedDiff)) {
        return {
          status: 'ALREADY_STAGED',
          state: pending,
          message: 'This exact prepared plan is already awaiting page review.',
        };
      }
      return {
        status: 'ERROR',
        state: pending,
        message: 'A proposal is already awaiting review. Apply or Reject it before staging another.',
      };
    }
    if (adapter.getRevision() !== proposal.base_revision) {
      return { status: 'STALE_STATE', message: 'The page changed before this proposal was staged.' };
    }
    let plan: PreparedCanvasPlan;
    try {
      const prepared = adapter.prepare(proposal, resolvedDiff);
      if (isPlanResult(prepared)) {
        if (!prepared.ok) return { status: prepared.status, message: prepared.message };
        plan = prepared.plan;
      } else {
        plan = prepared;
      }
    } catch (error) {
      return { status: 'ERROR', message: error instanceof Error ? error.message.slice(0, 180) : 'The proposal could not be prepared before review.' };
    }
    pending = { proposal, diff: resolvedDiff, plan, status: 'pending' };
    publish();
    return { status: 'STAGED', state: pending };
  };
  const apply = (): ProposalControllerResult => {
    if (!pending) return { status: 'NO_PENDING' };
    if (adapter.getRevision() !== pending.proposal.base_revision) {
      pending = { ...pending, status: 'stale', message: 'The page changed; inspect again and re-propose before applying.' };
      publish();
      return { status: 'STALE_STATE', state: pending, message: pending.message };
    }
    if (!pending.plan) return { status: 'ERROR', state: pending, message: 'The reviewed proposal is missing its prepared canvas plan.' };
    const result = adapter.apply(pending.plan);
    if (!result.ok) {
      pending = { ...pending, status: result.status === 'STALE_STATE' ? 'stale' : 'error', message: result.message };
      publish();
      return { status: result.status, state: pending, message: result.message };
    }
    pending = null;
    publish();
    return { status: 'APPLIED' };
  };
  const reject = (): ProposalControllerResult => {
    if (!pending) return { status: 'NO_PENDING' };
    pending = null;
    publish();
    return { status: 'REJECTED' };
  };

  return {
    read: (request = { kind: 'revision' as const }) => adapter.read?.(request) ?? ({
      content_revision: adapter.getRevision(),
      ...(adapter.getContextToken ? { context_token: adapter.getContextToken() } : {}),
    }),
    getState: () => pending,
    stage,
    decide: (decision) => {
      const kind = typeof decision === 'string'
        ? decision
        : 'kind' in decision
          ? decision.kind
          : decision.type;
      if (kind !== 'apply' && kind !== 'reject') {
        return { status: 'ERROR', ...(pending ? { state: pending } : {}), message: 'The page decision must be Apply or Reject.' };
      }
      return kind === 'apply' ? apply() : reject();
    },
    apply,
    reject,
  };
}

export type { PreparedCanvasPlan } from './fogwood-runtime.ts';

// Keep the type guard exported for tiny adapter tests without exposing any
// editor or DOM implementation details.
export function isSurfacePlanResult(value: unknown): value is SurfacePlanResult {
  return isPlanResult(value as PreparedCanvasPlan | SurfacePlanResult);
}
