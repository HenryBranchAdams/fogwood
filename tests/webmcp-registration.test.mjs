import assert from 'node:assert/strict';
import test from 'node:test';
import { registerWebMcpTools } from '../app/webmcp-registration.ts';

const tools = [
  { name: 'one', description: 'One', inputSchema: {}, execute() {} },
  { name: 'two', description: 'Two', inputSchema: {}, execute() {} },
  { name: 'three', description: 'Three', inputSchema: {}, execute() {} },
];

function createScheduler() {
  let now = 0;
  let nextId = 1;
  const timers = new Map();

  const scheduler = {
    now: () => now,
    setTimeout(callback, delayMs) {
      const id = nextId++;
      timers.set(id, { callback, due: now + delayMs });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  };

  function advance(delayMs) {
    const target = now + delayMs;
    while (true) {
      const next = [...timers.entries()]
        .filter(([, timer]) => timer.due <= target)
        .sort((left, right) => left[1].due - right[1].due)[0];
      if (!next) break;
      const [id, timer] = next;
      timers.delete(id);
      now = timer.due;
      timer.callback();
    }
    now = target;
  }

  return { scheduler, advance };
}

async function flushPromises() {
  await new Promise((resolve) => setImmediate(resolve));
}

function setup(overrides = {}) {
  const connections = [];
  const schedulerState = createScheduler();
  const controller = new AbortController();
  const cleanup = registerWebMcpTools({
    tools,
    getModelContext: () => undefined,
    createAbortController: () => controller,
    onConnection: (connection) => connections.push(connection),
    retryIntervalMs: 100,
    timeoutMs: 500,
    scheduler: schedulerState.scheduler,
    ...overrides,
  });
  return { cleanup, connections, controller, ...schedulerState };
}

test('starts registration synchronously and counts fulfillment only after settlement', async () => {
  const calls = [];
  const state = setup({
    getModelContext: () => ({
      registerTool(tool, { signal }) {
        calls.push({ name: tool.name, signal });
      },
    }),
  });

  assert.deepEqual(calls.map((call) => call.name), ['one', 'two', 'three']);
  assert.equal(state.connections.at(-1).registered, 0);

  await flushPromises();

  assert.equal(state.connections.at(-1).registered, 3);
  assert.equal(state.connections.at(-1).failed, 0);
  assert.ok(calls.every((call) => call.signal === state.controller.signal));
  state.cleanup();
});

test('retries a late provider within the bounded discovery window', async () => {
  let provider;
  const calls = [];
  const state = setup({
    getModelContext: () => provider,
  });

  state.advance(99);
  assert.equal(calls.length, 0);
  provider = {
    registerTool(tool) {
      calls.push(tool.name);
      return Promise.resolve();
    },
  };
  state.advance(1);
  await flushPromises();

  assert.deepEqual(calls, ['one', 'two', 'three']);
  assert.equal(state.connections.at(-1).registered, 3);
  state.cleanup();
});

test('reports synchronous throws and rejected promises without unhandled failures', async () => {
  const state = setup({
    getModelContext: () => ({
      registerTool(tool) {
        if (tool.name === 'one') return Promise.resolve();
        if (tool.name === 'two') {
          throw new DOMException('Registration blocked', 'NotAllowedError');
        }
        return Promise.reject(new Error('Duplicate tool name'));
      },
    }),
  });

  await flushPromises();

  assert.equal(state.connections.at(-1).registered, 1);
  assert.equal(state.connections.at(-1).failed, 2);
  assert.deepEqual(state.connections.at(-1).errors, [
    'NotAllowedError: Registration blocked',
    'Error: Duplicate tool name',
  ]);
  state.cleanup();
});

test('reports an unavailable or incomplete provider only after the timeout', () => {
  const incompleteProvider = {};
  const state = setup({
    getModelContext: () => incompleteProvider,
  });

  state.advance(499);
  assert.equal(state.connections.at(-1).checked, false);
  state.advance(1);

  assert.deepEqual(state.connections.at(-1), {
    checked: true,
    available: false,
    registered: 0,
    failed: 0,
    errors: ['TypeError: document.modelContext.registerTool is not a function.'],
  });
  state.cleanup();
});

test('reports a missing provider without inventing a page-side error', () => {
  const state = setup();

  state.advance(500);

  assert.deepEqual(state.connections.at(-1), {
    checked: true,
    available: false,
    registered: 0,
    failed: 0,
    errors: [],
  });
  state.cleanup();
});

test('aborts teardown and ignores a registration that settles afterward', async () => {
  let resolveRegistration;
  const pending = new Promise((resolve) => {
    resolveRegistration = resolve;
  });
  const state = setup({
    getModelContext: () => ({
      registerTool() {
        return pending;
      },
    }),
  });
  const connectionCount = state.connections.length;

  state.cleanup();
  resolveRegistration();
  await flushPromises();

  assert.equal(state.controller.signal.aborted, true);
  assert.equal(state.connections.length, connectionCount);
});
