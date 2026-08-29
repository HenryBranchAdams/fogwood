import assert from 'node:assert/strict';
import test from 'node:test';

import { createProposalLifecycleController } from '../app/fogwood-proposal-lifecycle.ts';

const proposal = Object.freeze({
  base_revision: 'revision:before',
  summary: 'Review a bounded change',
  actions: [{ type: 'canvas_ops', ops: [{ op: 'create', semantic_id: 'idea:review', kind: 'note', x: 80, y: 80, w: 220, h: 140, text: 'Review me' }] }],
});
const diff = Object.freeze({ counts: { adds: 1, updates: 0, moves: 0, removes: 0 } });

function baseController() {
  let state = null;
  return {
    getState: () => state,
    stage(nextProposal, nextDiff) {
      if (nextProposal.base_revision === 'stale') return { status: 'STALE_STATE', message: 'stale' };
      state = { status: 'pending', proposal: nextProposal, diff: nextDiff };
      return { status: 'STAGED', proposal: nextProposal, diff: nextDiff };
    },
    apply() {
      if (!state) return { status: 'ERROR', message: 'nothing pending' };
      if (state.status === 'stale') return { status: 'STALE_STATE', message: 'stale' };
      state = null;
      return { status: 'APPLIED' };
    },
    reject() {
      if (!state) return { status: 'ERROR', message: 'nothing pending' };
      state = null;
      return { status: 'REJECTED' };
    },
    forceState(next) {
      state = next;
    },
  };
}

test('accepted stage/apply lifecycle emits exact revisions once and ignores failed/no-pending calls', () => {
  const events = [];
  let revision = 'revision:before';
  const base = baseController();
  const controller = createProposalLifecycleController(base, {
    get_revision: () => revision,
    on_event: (event) => events.push(event),
  });

  assert.equal(controller.stage(proposal, diff).status, 'STAGED');
  assert.deepEqual(events, [{
    type: 'proposal-staged',
    proposal,
    source_revision: 'revision:before',
    base_revision: 'revision:before',
  }]);
  revision = 'revision:after';
  assert.equal(controller.apply().status, 'APPLIED');
  assert.deepEqual(events[1], {
    type: 'proposal-applied',
    proposal,
    source_revision: 'revision:before',
    base_revision: 'revision:before',
    result_revision: 'revision:after',
  });
  assert.equal(controller.apply().status, 'ERROR');
  assert.equal(events.length, 2);
  assert.equal(controller.stage({ ...proposal, base_revision: 'stale' }, diff).status, 'STALE_STATE');
  assert.equal(events.length, 2);
});

test('accepted reject emits no result revision and never mutates through the evidence sink', () => {
  const events = [];
  const base = baseController();
  const controller = createProposalLifecycleController(base, {
    get_revision: () => 'revision:before',
    on_event: (event) => events.push(event),
  });
  assert.equal(controller.stage(proposal, diff).status, 'STAGED');
  assert.equal(controller.reject().status, 'REJECTED');
  assert.deepEqual(events.at(-1), {
    type: 'proposal-rejected',
    proposal,
    source_revision: 'revision:before',
    base_revision: 'revision:before',
  });
  assert.equal(controller.reject().status, 'ERROR');
  assert.equal(events.length, 2);
});

test('receipt sink failure is reported separately and cannot change controller outcomes', () => {
  const errors = [];
  const base = baseController();
  const controller = createProposalLifecycleController(base, {
    get_revision: () => 'revision:before',
    on_event: () => {
      throw new Error('storage full');
    },
    on_event_error: (error, event) => errors.push({ error, event }),
  });
  assert.equal(controller.stage(proposal, diff).status, 'STAGED');
  assert.equal(errors.length, 1);
  assert.match(errors[0].error.message, /storage full/);
  assert.equal(errors[0].event.type, 'proposal-staged');
});
