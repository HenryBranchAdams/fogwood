import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('surface-tools is a thin compatibility façade over narrow authority seams', async () => {
  const source = await readFile(new URL('../app/surface-tools.ts', import.meta.url), 'utf8');
  assert.ok(source.split('\n').length < 80, 'the compatibility façade must remain orchestration-only');
  for (const seam of ['tldraw-adapter/inspect-projection', 'tldraw-adapter/transaction', 'compat/surface-tools', 'review/proposal-activity', 'webmcp/surface-tools']) {
    assert.match(source, new RegExp(seam.replace('/', '\\/')));
  }
  assert.doesNotMatch(source, /from ['"]tldraw['"]/);
  assert.doesNotMatch(source, /document\.|editor\.run|markHistoryStoppingPoint|registerTool\(/);
});

test('page and compatibility callers bypass the façade and name their authority seam', async () => {
  const app = await readFile(new URL('../app/surface-app.tsx', import.meta.url), 'utf8');
  const block = await readFile(new URL('../app/surface-block.tsx', import.meta.url), 'utf8');
  const webmcpSource = await readFile(new URL('../app/webmcp/surface-tools.ts', import.meta.url), 'utf8');

  assert.match(app, /from '.\/webmcp\/surface-tools'/);
  assert.doesNotMatch(app, /from '.\/surface-tools'/);
  assert.match(block, /from '.\/compat\/surface-tools'/);
  assert.doesNotMatch(block, /from '.\/surface-tools'/);
  assert.match(webmcpSource, /exactly three stable tools/i);
});
