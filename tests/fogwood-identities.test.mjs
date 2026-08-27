import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CanonicalSerializeError,
  DEFAULT_IDENTITY_LIMITS,
  identityForPackage,
  identityForProposal,
  identityForRecipe,
  canonicalSerialize,
  sha256Hex,
} from '../app/fogwood-identities.ts';

test('canonicalSerialize sorts keys by UTF-16 code units and preserves array order', () => {
  const value = {
    z: 1,
    '\uE000': 'private use',
    '\uD800': 'high surrogate',
    nested: { b: 2, a: 1 },
    array: [{ d: 4, c: 3 }, '😀'],
  };

  assert.equal(
    canonicalSerialize(value),
    '{"array":[{"c":3,"d":4},"😀"],"nested":{"a":1,"b":2},"z":1,"\\ud800":"high surrogate","":"private use"}',
  );
  assert.equal(canonicalSerialize({ b: 1, a: 2 }), '{"a":2,"b":1}');
  assert.equal(canonicalSerialize(['b', { z: 1, a: 2 }]), '["b",{"a":2,"z":1}]');
});

test('canonicalSerialize rejects cycles and visible bound violations', () => {
  const cyclic = {};
  cyclic.self = cyclic;
  assert.throws(
    () => canonicalSerialize(cyclic),
    (error) => error instanceof CanonicalSerializeError && error.code === 'CYCLIC_INPUT' && error.path === '$.self',
  );

  assert.throws(
    () => canonicalSerialize({ child: { value: true } }, { max_depth: 1 }),
    (error) => error instanceof CanonicalSerializeError && error.code === 'INPUT_DEPTH_LIMIT' && error.path === '$.child.value',
  );
  assert.throws(
    () => canonicalSerialize({ a: 1, b: 2 }, { max_entries: 2 }),
    (error) => error instanceof CanonicalSerializeError && error.code === 'INPUT_ENTRY_LIMIT' && error.path === '$.b',
  );
  assert.throws(
    () => canonicalSerialize({ text: 'abcd' }, { max_string_length: 3 }),
    (error) => error instanceof CanonicalSerializeError && error.code === 'INPUT_STRING_LIMIT' && error.path === '$.text',
  );
  assert.equal(DEFAULT_IDENTITY_LIMITS.max_depth > 0, true);
});

test('sha256Hex hashes UTF-8 bytes synchronously using standard vectors', () => {
  assert.equal(sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(sha256Hex('hello world'), 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
  assert.equal(sha256Hex('😀'), 'f0443a342c5ef54783a111b51ba56c938e474c32324d90c3a60c9c8e3a37e2d9');
});

test('proposal and recipe identities hash exact canonical content and fit receipt identity shape', () => {
  const proposal = {
    summary: 'Add note',
    actions: [{ type: 'add_blocks', coordinate_space: 'page', blocks: [{ title: 'Hello', kind: 'text' }] }],
    base_revision: 'rev:1',
  };
  assert.deepEqual(identityForProposal(proposal), {
    id: 'proposal',
    version: 1,
    hash: 'sha256:22fec006427028ee0ab540edf6cb333a18282b6d0e505fd3b0399c5c450aaa56',
  });

  const recipe = {
    version: 1,
    title: 'Recipe One',
    status: 'immutable',
    semantic: 'demo',
    id: 'recipe-1',
    purpose: 'A recipe',
    bounds: { y: 0, x: 0, w: 1, h: 2 },
    provenance: { recipe_version: 1, source: 'fogwood', recipe_id: 'recipe-1' },
    operations: [],
  };
  assert.deepEqual(identityForRecipe(recipe), {
    id: 'recipe-1',
    version: 1,
    hash: 'sha256:b944f9568781d46340b9c74163fa788b6b8f732f80140df82b53282f49da40bb',
  });
});

test('package identity carries the exact pinned content_hash without recomputing or renaming it', () => {
  const summary = {
    id: 'fogwood.evidence-research-map',
    version: 1,
    title: 'Evidence Map',
    summary: 'Organize sources.',
    content_hash: 'sha256:5143c5a4a3e942777f67a131be2e095a12215cad804a3dcf52b3d5123777f6af',
  };
  assert.deepEqual(identityForPackage(summary), {
    id: summary.id,
    version: summary.version,
    content_hash: summary.content_hash,
  });
  assert.throws(() => identityForPackage({ id: 'p', version: 1, content_hash: 'sha256:ABC' }), CanonicalSerializeError);
});
