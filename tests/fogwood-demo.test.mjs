import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GUIDED_COMPARE_PROMPT,
  buildGuidedDemoModel,
} from '../app/fogwood-demo.ts';

const readyConnection = {
  checked: true,
  available: true,
  registered: 4,
  failed: 0,
  errors: [],
};

test('first-run Compare request preserves the stage-only human gate', () => {
  assert.match(GUIDED_COMPARE_PROMPT, /inspect/i);
  assert.match(GUIDED_COMPARE_PROMPT, /pinned.*Compare/i);
  assert.match(GUIDED_COMPARE_PROMPT, /read/i);
  assert.match(GUIDED_COMPARE_PROMPT, /stage.*without applying/i);
  assert.match(GUIDED_COMPARE_PROMPT, /set_instrument_inputs/);
  assert.match(GUIDED_COMPARE_PROMPT, /0\.8/);
  assert.match(GUIDED_COMPARE_PROMPT, /0\.2/);
  assert.match(GUIDED_COMPARE_PROMPT, /Apply|Reject/);
});

test('guided model exposes the real review sequence and local fallback', () => {
  const blank = buildGuidedDemoModel({
    hasContent: false,
    controllerReady: true,
    connection: { ...readyConnection, available: false, registered: 0 },
    activities: [],
    proposal: null,
    receipts: [],
  });

  assert.deepEqual(
    blank.steps.map((step) => step.label),
    ['Inspect', 'Propose', 'Human review', 'Apply/Reject', 'Receipt'],
  );
  assert.equal(blank.steps[0].status, 'current');
  assert.equal(blank.host.canStageLocally, true);
  assert.match(blank.host.detail, /local/i);
  assert.match(blank.host.detail, /host|WebMCP/i);

  const pending = buildGuidedDemoModel({
    hasContent: true,
    controllerReady: true,
    connection: readyConnection,
    activities: [{ title: 'Fogwood inspected the page' }],
    proposal: {
      status: 'pending',
      diff: {
        instrument_changes: [],
      },
    },
    receipts: [{ event: 'proposal-staged' }],
  });

  assert.deepEqual(
    pending.steps.map((step) => step.status),
    ['complete', 'complete', 'current', 'upcoming', 'upcoming'],
  );
  assert.match(pending.host.label, /page tools registered/i);
  assert.match(pending.host.detail, /host.*separate|separate.*host/i);
  assert.doesNotMatch(pending.host.detail, /ChatGPT can inspect and stage/i);
});

test('guided model keeps instrument controls and derived outputs bounded and readable', () => {
  const model = buildGuidedDemoModel({
    hasContent: true,
    controllerReady: true,
    connection: readyConnection,
    activities: [],
    proposal: {
      status: 'pending',
      diff: {
        instrument_changes: [{
          recipe_instance_id: 'compare-and-decide:1',
          controls: [
            { id: 'shape:cost', label: 'Cost weight', before: 0.4, after: 0.8 },
            { id: 'shape:impact', label: 'Impact weight', before: 0.6, after: 0.2 },
          ],
          derived: [
            { id: 'compare:chart', label: 'Weighted scores', before: { kind: 'chart', series: [{ label: 'Alpha', value: 74 }, { label: 'Beta', value: 78 }] }, after: { kind: 'chart', series: [{ label: 'Alpha', value: 88 }, { label: 'Beta', value: 76 }] } },
            { id: 'compare:alpha', label: 'Alpha score', before: 74, after: 88 },
            { id: 'compare:beta', label: 'Beta score', before: 78, after: 76 },
            { id: 'compare:recommendation', label: 'Recommendation', before: 'Beta', after: 'Alpha' },
          ],
        }],
      },
    },
    receipts: [],
  });

  assert.equal(model.instrumentChanges.length, 1);
  assert.deepEqual(model.instrumentChanges[0].controls.map((change) => change.label), ['Cost weight', 'Impact weight']);
  assert.equal(model.instrumentChanges[0].derived[3].after, 'Alpha');
  assert.match(model.instrumentChanges[0].controls[0].plain, /Cost weight.*0\.4.*0\.8/);
  assert.match(model.instrumentChanges[0].derived[0].plain, /Weighted scores.*Alpha: 74.*Beta: 78.*Alpha: 88.*Beta: 76/);
  assert.match(model.instrumentChanges[0].derived[3].plain, /Recommendation.*Beta.*Alpha/);
});
