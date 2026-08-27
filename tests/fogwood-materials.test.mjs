import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MATERIAL_LIMITS,
  SUPPORTED_MATERIAL_MIME_TYPES,
  prepareMaterial,
  prepareMaterials,
  sha256Bytes,
} from '../app/fogwood-materials.ts';
import { validateProposalAsync } from '../app/fogwood-runtime.ts';
import { identityForProposal } from '../app/fogwood-identities.ts';

const emptyContext = { current_revision: 'fogwood-agent-runtime/1-materials', items: [] };
const onePixelPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function material(overrides = {}) {
  return {
    semantic_id: 'material:one',
    mime_type: 'image/png',
    base64: onePixelPng,
    label: 'One pixel',
    alt: 'A one pixel fixture',
    prompt_summary: 'A tiny local raster fixture.',
    originating_capability: 'test-fixture',
    qualification_boundary: 'test decoder only',
    x: 20,
    y: 30,
    w: 120,
    h: 120,
    ...overrides,
  };
}

const decodeRaster = async ({ width, height }) => ({ width, height });

test('material preparation exposes only the explicit supported MIME set and exact byte hash', () => {
  assert.deepEqual(SUPPORTED_MATERIAL_MIME_TYPES, ['image/png', 'image/jpeg', 'image/svg+xml']);
  assert.deepEqual(MATERIAL_LIMITS, {
    max_materials_per_action: 4,
    max_raster_bytes: 4 * 1024 * 1024,
    max_svg_bytes: 1 * 1024 * 1024,
    max_aggregate_bytes: 12 * 1024 * 1024,
    max_dimension: 8192,
    max_pixels: 16_000_000,
  });
  assert.equal(sha256Bytes(new TextEncoder().encode('hello')), 'sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
});

test('accepted raster material is canonical, content-addressed, and decode-qualified asynchronously', async () => {
  let calls = 0;
  const result = await prepareMaterial(material(), {
    decodeRaster: async (request) => {
      calls += 1;
      assert.equal(request.mime_type, 'image/png');
      assert.equal(request.width, 1);
      assert.equal(request.height, 1);
      return { width: 1, height: 1 };
    },
  });
  assert.equal(result.ok, true);
  assert.equal(calls, 1);
  assert.deepEqual(result.material.dimensions, { width: 1, height: 1 });
  assert.equal(result.material.byte_length, 68);
  assert.match(result.material.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(result.material.source_status, 'original');
  assert.equal(result.material.decode_qualified, true);
  assert.equal(result.material.base64, onePixelPng);
  assert.equal('bytes' in result.material, false);
});

test('raster stage fails closed for missing or mismatched browser decode proof', async () => {
  const missing = await prepareMaterial(material());
  assert.equal(missing.ok, false);
  assert.equal(missing.errors[0].code, 'DECODE_REQUIRED');

  const mismatched = await prepareMaterial(material(), {
    decodeRaster: async () => ({ width: 2, height: 1 }),
  });
  assert.equal(mismatched.ok, false);
  assert.equal(mismatched.errors[0].code, 'DECODE_DIMENSION_MISMATCH');
});

test('material input rejects noncanonical base64 and URL/blob/source-shaped fields', async () => {
  for (const bad of [
    material({ base64: ` ${onePixelPng}` }),
    material({ base64: onePixelPng.replace(/=$/, '') }),
    material({ base64: onePixelPng.replace(/A/g, '-') }),
    material({ url: 'https://example.com/image.png' }),
    material({ src: 'data:image/png;base64,anything' }),
    material({ href: '#remote' }),
    material({ blob: 'not-inline' }),
  ]) {
    const result = await prepareMaterial(bad, { decodeRaster });
    assert.equal(result.ok, false);
    assert.equal(result.errors.some((error) => error.code === 'UNKNOWN_FIELD' || error.code === 'INVALID_BASE64'), true);
  }
});

test('SVG preparation stores deterministic sanitized geometry bytes and rejects active or malformed XML', async () => {
  const first = await prepareMaterial(material({
    semantic_id: 'material:svg',
    mime_type: 'image/svg+xml',
    base64: Buffer.from('<svg height="10" width="20" xmlns="http://www.w3.org/2000/svg"><rect width="20" height="10" fill="red"/></svg>').toString('base64'),
    w: 200,
    h: 100,
  }));
  const second = await prepareMaterial(material({
    semantic_id: 'material:svg',
    mime_type: 'image/svg+xml',
    base64: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect fill="red" height="10" width="20"></rect></svg>').toString('base64'),
    w: 200,
    h: 100,
  }));
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.material.source_status, 'sanitized');
  assert.equal(first.material.decode_qualified, true);
  assert.equal(first.material.canonical_base64, second.material.canonical_base64);
  assert.equal(first.material.content_hash, second.material.content_hash);
  assert.equal(first.material.dimensions.width, 20);
  assert.equal(first.material.dimensions.height, 10);

  for (const svg of [
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill:red"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="5"></svg></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/x"/></svg>',
    '<!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg"/>',
    '<svg xmlns="http://www.w3.org/2000/svg"><rect></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="20" height="10">',
    Buffer.from([0xc3, 0x28]).toString('base64'),
  ]) {
    const result = await prepareMaterial(material({
      semantic_id: `material:bad-${svg.length}`,
      mime_type: 'image/svg+xml',
      base64: Buffer.from(svg).toString('base64'),
    }));
    assert.equal(result.ok, false);
    assert.equal(result.errors.some((error) => error.code.startsWith('SVG_')), true);
  }
});

test('SVG path and transform canonicalization preserves drawing semantics and refuses malformed argument sets', async () => {
  const moved = await prepareMaterial(material({
    semantic_id: 'material:path-semantics',
    mime_type: 'image/svg+xml',
    base64: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="30" height="20"><path d="M 1 1 10 10 20 5" transform="matrix(1 0 0 1 2 3)"/></svg>').toString('base64'),
    w: 300,
    h: 200,
  }));
  assert.equal(moved.ok, true);
  const canonical = Buffer.from(moved.material.canonical_base64, 'base64').toString('utf8');
  assert.match(canonical, /d="M 1 1 L 10 10 L 20 5"/);

  for (const pathOrTransform of [
    '<path d="L 1 1"/>',
    '<path d="M 1 1 A 2 2 0 2 0 10 10"/>',
    '<path d="M 1 1" transform="matrix(1 0 0)"/>',
    '<path d="M 1 1" transform="rotate(45 2)"/>',
  ]) {
    const result = await prepareMaterial(material({
      semantic_id: 'material:bad-geometry',
      mime_type: 'image/svg+xml',
      base64: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="30" height="20">${pathOrTransform}</svg>`).toString('base64'),
    }));
    assert.equal(result.ok, false);
    assert.equal(result.errors.some((entry) => entry.code === 'SVG_PATH_SYNTAX' || entry.code === 'SVG_INVALID_TRANSFORM'), true);
  }
});

test('semantic material ids are lexical and cannot collide with a live page item', async () => {
  const lexical = await prepareMaterial(material({ semantic_id: 'bad semantic id' }), { decodeRaster });
  assert.equal(lexical.ok, false);
  assert.equal(lexical.errors.some((entry) => entry.code === 'INVALID_SEMANTIC_ID'), true);

  const collision = await validateProposalAsync({
    base_revision: emptyContext.current_revision,
    summary: 'Refuse a semantic collision',
    actions: [{ type: 'add_materials', materials: [material()] }],
  }, {
    ...emptyContext,
    items: [{ id: 'shape:existing', type: 'image', semantic_id: 'material:one', x: 0, y: 0, w: 10, h: 10, rotation: 0, props: {} }],
  }, { decodeRaster });
  assert.equal(collision.ok, false);
  assert.equal(collision.errors.some((entry) => entry.code === 'DUPLICATE_SEMANTIC_ID'), true);
});

test('proposal validation is async only for materials and never stages without injected decode proof', async () => {
  const rejected = await validateProposalAsync({
    base_revision: emptyContext.current_revision,
    summary: 'Stage a material',
    actions: [{ type: 'add_materials', materials: [material()] }],
  }, emptyContext);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.errors[0].code, 'DECODE_REQUIRED');

  const accepted = await validateProposalAsync({
    base_revision: emptyContext.current_revision,
    summary: 'Stage a material',
    actions: [{ type: 'add_materials', materials: [material()] }],
  }, emptyContext, { decodeRaster });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.diff.adds.materials, 1);
  assert.equal(accepted.proposal.actions[0].materials[0].decode_qualified, true);
  assert.equal(accepted.proposal.actions[0].materials[0].byte_length, 68);
});

test('material proposal identity projects exact hash and byte length without persisting raw base64', async () => {
  const accepted = await validateProposalAsync({
    base_revision: emptyContext.current_revision,
    summary: 'Receipt projection',
    actions: [{ type: 'add_materials', materials: [material()] }],
  }, emptyContext, { decodeRaster });
  assert.equal(accepted.ok, true);
  const identity = identityForProposal(accepted.proposal);
  assert.equal(JSON.stringify(identity).includes(onePixelPng), false);
  assert.equal(JSON.stringify(identity).includes('base64'), false);
  assert.match(identity.hash, /^sha256:[0-9a-f]{64}$/);
});

test('aggregate and per-action material bounds are enforced before stage', async () => {
  const one = await prepareMaterials([material()], { decodeRaster });
  assert.equal(one.ok, true);
  assert.equal(one.byte_length, 68);
  const tooMany = await validateProposalAsync({
    base_revision: emptyContext.current_revision,
    summary: 'Too many',
    actions: [{ type: 'add_materials', materials: [material(), material({ semantic_id: 'material:two' }), material({ semantic_id: 'material:three' }), material({ semantic_id: 'material:four' }), material({ semantic_id: 'material:five' })] }],
  }, emptyContext, { decodeRaster });
  assert.equal(tooMany.ok, false);
  assert.equal(tooMany.errors.some((error) => error.code === 'MATERIAL_COUNT_LIMIT'), true);
});

test('stale and proposal-wide aggregate refusals happen before any raster decoder work', async () => {
  let decodeCalls = 0;
  const decoder = async ({ width, height }) => {
    decodeCalls += 1;
    return { width, height };
  };
  const stale = await validateProposalAsync({
    base_revision: 'fogwood-agent-runtime/1-stale',
    summary: 'Stale material',
    actions: [{ type: 'add_materials', materials: [material()] }],
  }, emptyContext, { decodeRaster: decoder });
  assert.equal(stale.ok, false);
  assert.equal(stale.errors[0].code, 'STALE_STATE');
  assert.equal(decodeCalls, 0);

  const oneMiB = Buffer.alloc(1024 * 1024).toString('base64');
  const oversized = await validateProposalAsync({
    base_revision: emptyContext.current_revision,
    summary: 'Refuse aggregate before decode',
    actions: Array.from({ length: 13 }, (_, index) => ({
      type: 'add_materials',
      materials: [material({ semantic_id: `material:aggregate-${index}`, base64: oneMiB })],
    })),
  }, emptyContext, { decodeRaster: decoder });
  assert.equal(oversized.ok, false);
  assert.equal(oversized.errors.some((entry) => entry.code === 'MATERIAL_AGGREGATE_LIMIT'), true);
  assert.equal(decodeCalls, 0);
});
