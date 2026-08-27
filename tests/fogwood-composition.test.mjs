import assert from 'node:assert/strict';
import test from 'node:test';

import {
  COMPOSITION_FORMAT,
  COMPOSITION_REGISTRY,
  compositionQualification,
  expandCompositionRecipe,
  getRecipe,
  validateCompositionRecipe,
  validateProposal,
} from '../app/fogwood-runtime.ts';

const emptyContext = {
  current_revision: 'fogwood-agent-runtime/1-composition-test',
  page_id: 'page:composition-test',
  items: [],
};

test('v2 composition registry exposes three native signature recipes with deterministic qualification', () => {
  assert.equal(COMPOSITION_FORMAT, 'composition.v2');
  assert.deepEqual(
    COMPOSITION_REGISTRY.map((recipe) => recipe.id),
    [
      'fogwood.evidence-constellation',
      'fogwood.fungi-cities-research-world',
      'fogwood.storyworld-mutation-map',
    ],
  );
  for (const recipe of COMPOSITION_REGISTRY) {
    assert.equal(recipe.version, 2);
    assert.equal(recipe.format, COMPOSITION_FORMAT);
    assert.equal(recipe.items.length > 0, true);
    assert.equal(recipe.edges.length > 0, true);
    assert.equal(recipe.items.every((item) => item.kind !== 'surface-block'), true);
    assert.equal(
      recipe.id === 'fogwood.fungi-cities-research-world'
        ? recipe.items.some((item) => item.role === 'portal' || item.role === 'provocation')
        : true,
      true,
    );
    const qualification = compositionQualification(recipe);
    assert.equal(qualification.default_surface_blocks, 0);
    assert.equal(qualification.native_material_ratio >= 0.7, true);
    assert.equal(qualification.typed_edge_ratio >= 0.6, true);
    assert.equal(qualification.deterministic_repeat, true);
    assert.equal(qualification.no_live_provider, true);
    assert.equal(recipe.expected_count, recipe.items.length + recipe.edges.length);
    assert.deepEqual(expandCompositionRecipe(recipe), expandCompositionRecipe(recipe));
  }
});

test('v2 recipes are exact runtime identities and carry stable composition metadata through expansion', () => {
  const recipe = getRecipe('fogwood.evidence-constellation', 2);
  assert.ok(recipe);
  const validated = validateCompositionRecipe(recipe);
  assert.equal(validated.ok, true);
  const operations = expandCompositionRecipe(recipe, { x: 100, y: 80 });
  assert.equal(operations.some((operation) => operation.type === 'add_shapes'), true);
  assert.equal(operations.some((operation) => operation.type === 'add_relationships'), true);
  const shapes = operations.flatMap((operation) => operation.type === 'add_shapes' ? operation.shapes : []);
  assert.equal(shapes.every((shape) => shape.composition_id === recipe.id), true);
  assert.equal(shapes.every((shape) => typeof shape.semantic_id === 'string'), true);
  const edgeAction = operations.find((operation) => operation.type === 'add_relationships');
  assert.ok(edgeAction);
  assert.equal(edgeAction.relationships.every((edge) => recipe.items.some((item) => item.semantic_id === edge.source_semantic_id)), true);
  assert.equal(edgeAction.relationships.every((edge) => recipe.items.some((item) => item.semantic_id === edge.target_semantic_id)), true);
});

test('signature compositions carry spatial meaning instead of a repeated dashboard grid', () => {
  for (const recipe of COMPOSITION_REGISTRY) {
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

test('insert_recipe accepts v2 through the existing proposal seam and rejects an unknown composition', () => {
  const valid = validateProposal({
    base_revision: emptyContext.current_revision,
    summary: 'Stage a composition',
    actions: [{ type: 'insert_recipe', recipe_id: 'fogwood.evidence-constellation', version: 2 }],
  }, emptyContext);
  assert.equal(valid.ok, true);
  assert.equal(valid.diff.recipe_expansions[0].version, 2);
  assert.equal(valid.diff.recipe_expansions[0].format, COMPOSITION_FORMAT);
  assert.equal(valid.diff.semantic_relationships.length > 0, true);
  assert.equal(valid.diff.counts.adds, getRecipe('fogwood.evidence-constellation', 2).expected_count);

  const invalid = validateProposal({
    base_revision: emptyContext.current_revision,
    summary: 'Bad composition',
    actions: [{ type: 'insert_recipe', recipe_id: 'fogwood.missing', version: 2 }],
  }, emptyContext);
  assert.equal(invalid.ok, false);
  assert.equal(invalid.errors.some((error) => error.code === 'UNKNOWN_RECIPE'), true);
});

test('anchored composition preview uses the exact coordinates that Apply will materialize', () => {
  for (const recipe of COMPOSITION_REGISTRY) {
    const firstItem = recipe.items[0];
    assert.ok(firstItem);
    const result = validateProposal({
      base_revision: emptyContext.current_revision,
      summary: `Stage anchored ${recipe.title}`,
      actions: [{
        type: 'insert_recipe',
        recipe_id: recipe.id,
        version: 2,
        anchor: { x: 100, y: 80 },
      }],
    }, emptyContext);
    assert.equal(result.ok, true);
    const preview = result.diff.adds.specs.find((spec) => spec.semantic_id === firstItem.semantic_id);
    assert.ok(preview, `${recipe.id} needs an exact staged shape preview`);
    assert.equal(preview.x, firstItem.x + 100, `${recipe.id} preview x must include the anchor`);
    assert.equal(preview.y, firstItem.y + 80, `${recipe.id} preview y must include the anchor`);
  }
});

test('composition.v2 validation rejects code, network payloads, untrusted host IDs, and mismatched semantics', () => {
  const source = getRecipe('fogwood.evidence-constellation', 2);
  assert.ok(source);

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
