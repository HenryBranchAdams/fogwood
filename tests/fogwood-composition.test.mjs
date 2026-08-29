import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  COMPOSITION_FORMAT,
  compositionQualification,
  expandCompositionRecipe,
  validateCompositionRecipe,
} from '../app/fogwood-composition.ts';

const recipePaths = [
  'fogwood.evidence-constellation/v2/recipes/evidence-constellation.json',
  'fogwood.fungi-cities-research-world/v2/recipes/fungi-cities-research-world.json',
  'fogwood.storyworld-mutation-map/v2/recipes/storyworld-mutation-map.json',
];

function readRecipe(relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve('bazaar/packages', relativePath), 'utf8'));
}

const recipes = recipePaths.map(readRecipe);

test('declarative composition packages validate without a runtime recipe registry', () => {
  assert.equal(COMPOSITION_FORMAT, 'composition.v2');
  assert.deepEqual(recipes.map((recipe) => recipe.id), [
    'fogwood.evidence-constellation',
    'fogwood.fungi-cities-research-world',
    'fogwood.storyworld-mutation-map',
  ]);
  for (const source of recipes) {
    const validated = validateCompositionRecipe(source);
    assert.equal(validated.ok, true, JSON.stringify(validated));
    const recipe = validated.recipe;
    assert.equal(recipe.version, 2);
    assert.equal(recipe.format, COMPOSITION_FORMAT);
    assert.equal(recipe.status, 'immutable');
    assert.equal(recipe.expected_count, recipe.items.length + recipe.edges.length);
    assert.equal(recipe.items.every((item) => item.kind !== 'surface-block'), true);
    assert.equal(recipe.items.every((item) => typeof item.semantic_id === 'string'), true);
    assert.equal(recipe.edges.every((edge) => typeof edge.kind === 'string'), true);
    const qualification = compositionQualification(recipe);
    assert.equal(qualification.default_surface_blocks, 0);
    assert.equal(qualification.native_material_ratio >= 0.7, true);
    assert.equal(qualification.typed_edge_ratio >= 0.6, true);
    assert.equal(qualification.deterministic_repeat, true);
    assert.equal(qualification.no_live_provider, true);
    assert.deepEqual(expandCompositionRecipe(recipe), expandCompositionRecipe(recipe));
  }
});

test('composition knowledge expands to declarative native-shape and typed-edge batches', () => {
  const recipe = validateCompositionRecipe(recipes[0]).recipe;
  const operations = expandCompositionRecipe(recipe, { x: 100, y: 80 });
  assert.equal(operations.some((operation) => operation.type === 'add_shapes'), true);
  assert.equal(operations.some((operation) => operation.type === 'add_relationships'), true);
  const shapes = operations.flatMap((operation) => operation.type === 'add_shapes' ? operation.shapes : []);
  assert.equal(shapes.length, recipe.items.length);
  assert.equal(shapes.every((shape) => shape.composition_id === recipe.id), true);
  assert.equal(shapes.every((shape) => typeof shape.semantic_id === 'string'), true);
  assert.equal(shapes[0].x, recipe.items[0].x + 100);
  assert.equal(shapes[0].y, recipe.items[0].y + 80);
  const edgeAction = operations.find((operation) => operation.type === 'add_relationships');
  assert.ok(edgeAction);
  assert.equal(edgeAction.relationships.length, recipe.edges.length);
  assert.equal(edgeAction.relationships.every((edge) => recipe.items.some((item) => item.semantic_id === edge.source_semantic_id)), true);
  assert.equal(edgeAction.relationships.every((edge) => recipe.items.some((item) => item.semantic_id === edge.target_semantic_id)), true);
});

test('signature compositions carry spatial meaning rather than a repeated dashboard grid', () => {
  for (const recipe of recipes) {
    const regionIds = new Set(recipe.items.map((item) => item.region_id));
    const shapeKinds = new Set(recipe.items.map((item) => item.kind));
    const coordinatePairs = new Set(recipe.items.map((item) => `${item.x},${item.y}`));
    const footprints = new Set(recipe.items.map((item) => `${item.w}x${item.h}`));
    assert.equal(regionIds.size >= 3, true, `${recipe.id} needs distinct spatial regions`);
    assert.equal(shapeKinds.size >= 4, true, `${recipe.id} needs varied native shapes`);
    assert.equal(coordinatePairs.size / recipe.items.length >= 0.8, true, `${recipe.id} needs irregular placement`);
    assert.equal(footprints.size / recipe.items.length >= 0.5, true, `${recipe.id} needs varied footprints`);
    assert.equal(recipe.items.every((item) => item.role !== 'card' && item.role !== 'metric'), true);
  }
});

test('composition validation rejects executable, remote, untrusted, and semantically dangling content', () => {
  const source = recipes[0];

  const withCode = structuredClone(source);
  withCode.code = 'fetch("https://example.invalid")';
  const codeResult = validateCompositionRecipe(withCode);
  assert.equal(codeResult.ok, false);
  assert.equal(codeResult.errors.some((error) => error.code === 'UNKNOWN_FIELD'), true);

  const withNetworkText = structuredClone(source);
  withNetworkText.items[0].text = 'https://example.invalid/live';
  const networkResult = validateCompositionRecipe(withNetworkText);
  assert.equal(networkResult.ok, false);
  assert.equal(networkResult.errors.some((error) => error.code === 'REMOTE_REFERENCE'), true);

  const withUntrustedAdapter = structuredClone(source);
  withUntrustedAdapter.adapters[0].capability_id = 'adapter.remote-fetch.v1';
  const capabilityResult = validateCompositionRecipe(withUntrustedAdapter);
  assert.equal(capabilityResult.ok, false);
  assert.equal(capabilityResult.errors.some((error) => error.code === 'UNTRUSTED_CAPABILITY'), true);

  const withFormulaData = structuredClone(source);
  withFormulaData.algorithms[0].data.formula = 'item => item';
  const formulaResult = validateCompositionRecipe(withFormulaData);
  assert.equal(formulaResult.ok, false);
  assert.equal(formulaResult.errors.some((error) => error.code === 'FORBIDDEN_FIELD'), true);

  const withMissingEndpoint = structuredClone(source);
  withMissingEndpoint.edges[0].target_semantic_id = 'missing:item';
  const endpointResult = validateCompositionRecipe(withMissingEndpoint);
  assert.equal(endpointResult.ok, false);
  assert.equal(endpointResult.errors.some((error) => error.code === 'UNKNOWN_ENDPOINT'), true);

  const withWrongCounts = structuredClone(source);
  withWrongCounts.expected_count += 1;
  const countResult = validateCompositionRecipe(withWrongCounts);
  assert.equal(countResult.ok, false);
  assert.equal(countResult.errors.some((error) => error.code === 'EXPECTED_COUNT_MISMATCH'), true);
});
