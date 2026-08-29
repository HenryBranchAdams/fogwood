import type {
  PreparedCanvasPlanId,
  ProposalControllerResult,
  ProposalControllerState,
  ProposalDiff,
  ProposalV1,
} from './fogwood-runtime';

export type ProposalLifecycleEvent =
  | Readonly<{
      type: 'proposal-staged';
      plan_id: PreparedCanvasPlanId;
      proposal: ProposalV1;
      source_revision: string;
      base_revision: string;
    }>
  | Readonly<{
      type: 'proposal-applied';
      plan_id: PreparedCanvasPlanId;
      proposal: ProposalV1;
      source_revision: string;
      base_revision: string;
      result_revision: string;
    }>
  | Readonly<{
      type: 'proposal-rejected';
      plan_id: PreparedCanvasPlanId;
      proposal: ProposalV1;
      source_revision: string;
      base_revision: string;
    }>;

export type ProposalLifecycleBaseController = {
  getState: () => ProposalControllerState | null;
  stage: (proposal: ProposalV1, diff: ProposalDiff) => ProposalControllerResult;
  apply: () => ProposalControllerResult;
  reject: () => ProposalControllerResult;
};

export type ProposalLifecycleOptions = {
  get_revision: () => string;
  on_event?: (event: ProposalLifecycleEvent) => void;
  on_event_error?: (error: Error, event: ProposalLifecycleEvent) => void;
};

function asError(value: unknown) {
  return value instanceof Error ? value : new Error('Proposal lifecycle evidence sink failed.');
}

/**
 * Observe accepted controller transitions without granting the observer any
 * mutation authority. Sink failure is evidence loss, never an Apply rollback.
 */
export function createProposalLifecycleController<T extends ProposalLifecycleBaseController>(
  base: T,
  options: ProposalLifecycleOptions,
): T {
  const emit = (event: ProposalLifecycleEvent) => {
    if (!options.on_event) return;
    try {
      options.on_event(event);
    } catch (error) {
      options.on_event_error?.(asError(error), event);
    }
  };

  return {
    ...base,
    stage(proposal: ProposalV1, diff: ProposalDiff) {
      const result = base.stage(proposal, diff);
      if (result.status === 'STAGED') {
        emit(Object.freeze({
          type: 'proposal-staged',
          plan_id: result.state!.plan.plan_id,
          proposal,
          source_revision: proposal.base_revision,
          base_revision: proposal.base_revision,
        }));
      }
      return result;
    },
    apply() {
      const pending = base.getState();
      const result = base.apply();
      if (result.status === 'APPLIED' && pending) {
        emit(Object.freeze({
          type: 'proposal-applied',
          plan_id: pending.plan.plan_id,
          proposal: pending.proposal,
          source_revision: pending.proposal.base_revision,
          base_revision: pending.proposal.base_revision,
          result_revision: options.get_revision(),
        }));
      }
      return result;
    },
    reject() {
      const pending = base.getState();
      const result = base.reject();
      if (result.status === 'REJECTED' && pending) {
        emit(Object.freeze({
          type: 'proposal-rejected',
          plan_id: pending.plan.plan_id,
          proposal: pending.proposal,
          source_revision: pending.proposal.base_revision,
          base_revision: pending.proposal.base_revision,
        }));
      }
      return result;
    },
  } as T;
}
