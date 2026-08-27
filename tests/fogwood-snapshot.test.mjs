import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SnapshotExportError,
  createFogwoodSnapshot,
  downloadFogwoodSnapshot,
} from '../app/fogwood-snapshot.ts';

test('snapshot creation exports current-page SVG locally and hashes exact artifact bytes', async () => {
  const calls = [];
  const svg = '<svg>Fogwood</svg>';
  const editor = {
    getCurrentPageShapeIds() {
      return new Set(['shape:one', 'shape:two']);
    },
    getCurrentPageShapes() {
      return [{ id: 'shape:one', type: 'geo', props: {} }, { id: 'shape:two', type: 'geo', props: {} }];
    },
    getAsset() {
      return undefined;
    },
    async getSvgString(ids, options) {
      calls.push({ ids, options });
      return { svg, width: 640, height: 480, trimPadding: { x: 0, y: 0 } };
    },
  };
  const snapshot = await createFogwoodSnapshot(editor, 'fogwood-agent-runtime/1-deadbeef', {
    get_revision: () => 'fogwood-agent-runtime/1-deadbeef',
    now: () => new Date('2026-08-27T15:04:05.000Z'),
    digest: async (algorithm, bytes) => {
      assert.equal(algorithm, 'SHA-256');
      assert.equal(new TextDecoder().decode(bytes), svg);
      return new Uint8Array(32).fill(0xab).buffer;
    },
  });

  assert.deepEqual(calls, [{
    ids: ['shape:one', 'shape:two'],
    options: { background: true, padding: 'auto' },
  }]);
  assert.equal(snapshot.source_revision, 'fogwood-agent-runtime/1-deadbeef');
  assert.equal(snapshot.file_name, 'fogwood-snapshot-2026-08-27T15-04-05-000Z.svg');
  assert.equal(snapshot.artifact.format, 'image/svg+xml');
  assert.equal(snapshot.artifact.hash, `sha256:${'ab'.repeat(32)}`);
  assert.equal(snapshot.size_bytes, new TextEncoder().encode(svg).byteLength);
  assert.equal(snapshot.shape_count, 2);
  assert.equal(snapshot.width, 640);
  assert.equal(snapshot.height, 480);
  assert.equal(await snapshot.blob.text(), svg);
});

test('snapshot creation refuses blank, invalid, external-asset, stale, or unavailable-hash exports visibly', async () => {
  const blankEditor = {
    getCurrentPageShapeIds: () => new Set(),
    getCurrentPageShapes: () => [],
    getAsset: () => undefined,
    getSvgString: async () => assert.fail('blank export must not render'),
  };
  await assert.rejects(
    () => createFogwoodSnapshot(blankEditor, 'revision-1', { get_revision: () => 'revision-1' }),
    (error) => error instanceof SnapshotExportError && error.code === 'EMPTY_PAGE',
  );

  const editor = {
    getCurrentPageShapeIds: () => new Set(['shape:one']),
    getCurrentPageShapes: () => [{ id: 'shape:one', type: 'geo', props: {} }],
    getAsset: () => undefined,
    getSvgString: async () => ({ svg: '<svg/>', width: 1, height: 1 }),
  };
  await assert.rejects(
    () => createFogwoodSnapshot(editor, '', { get_revision: () => '' }),
    (error) => error instanceof SnapshotExportError && error.code === 'INVALID_REVISION',
  );
  await assert.rejects(
    () => createFogwoodSnapshot(editor, 'revision-1', { get_revision: () => 'revision-1', max_bytes: 0 }),
    (error) => error instanceof SnapshotExportError && error.code === 'INVALID_LIMIT',
  );
  await assert.rejects(
    () => createFogwoodSnapshot(editor, 'revision-1', { get_revision: () => 'revision-1', digest: undefined, crypto: undefined }),
    (error) => error instanceof SnapshotExportError && error.code === 'HASH_UNAVAILABLE',
  );

  const external = {
    ...editor,
    getCurrentPageShapes: () => [{ id: 'shape:image', type: 'image', props: { assetId: 'asset:one' } }],
    getAsset: () => ({ id: 'asset:one', type: 'image', props: { src: '/image.png' } }),
    getSvgString: async () => assert.fail('external asset export must not render'),
  };
  await assert.rejects(
    () => createFogwoodSnapshot(external, 'revision-1', { get_revision: () => 'revision-1' }),
    (error) => error instanceof SnapshotExportError && error.code === 'EXTERNAL_ASSET',
  );

  let revision = 'revision-1';
  const stale = {
    ...editor,
    getSvgString: async () => {
      revision = 'revision-2';
      return { svg: '<svg/>', width: 1, height: 1 };
    },
  };
  await assert.rejects(
    () => createFogwoodSnapshot(stale, 'revision-1', {
      get_revision: () => revision,
      digest: async () => assert.fail('stale export must not hash'),
    }),
    (error) => error instanceof SnapshotExportError && error.code === 'STALE_PAGE',
  );
});

test('download is a separate explicit browser action and always revokes its object URL', () => {
  const clicks = [];
  const revoked = [];
  const link = {
    href: '',
    download: '',
    rel: '',
    click() {
      clicks.push({ href: this.href, download: this.download, rel: this.rel });
    },
  };
  const snapshot = {
    blob: new Blob(['svg'], { type: 'image/svg+xml' }),
    file_name: 'fogwood-snapshot.svg',
  };
  downloadFogwoodSnapshot(snapshot, {
    document: { createElement: (tag) => {
      assert.equal(tag, 'a');
      return link;
    } },
    url: {
      createObjectURL: (value) => {
        assert.equal(value, snapshot.blob);
        return 'blob:fogwood';
      },
      revokeObjectURL: (value) => revoked.push(value),
    },
  });
  assert.deepEqual(clicks, [{ href: 'blob:fogwood', download: 'fogwood-snapshot.svg', rel: 'noopener' }]);
  assert.deepEqual(revoked, ['blob:fogwood']);
});
