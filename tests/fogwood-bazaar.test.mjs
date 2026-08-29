import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';

import {
  BAZAAR_CATALOG_SOURCE,
  BAZAAR_CATALOG_REVISION,
  createFogwoodBazaarTool,
  executeFogwoodBazaar,
  searchBazaar,
  readBazaar,
} from '../app/fogwood-bazaar.ts';
import { packageHash } from '../scripts/compile-bazaar.mjs';

const compiler = path.resolve('scripts/compile-bazaar.mjs');

test('local Bazaar exposes pinned legacy and composition packages with deterministic paginated search', () => {
  const first = searchBazaar({ limit: 2 });
  assert.equal(first.ok, true);
  assert.equal(first.catalog_source, BAZAAR_CATALOG_SOURCE);
  assert.equal(first.catalog_revision, BAZAAR_CATALOG_REVISION);
  assert.equal(first.results.length, 2);
  assert.equal(first.has_more, true);
  assert.equal(first.results.every((entry) => entry.content_hash.startsWith('sha256:')), true);
  assert.equal(JSON.stringify(first).includes('module_path'), false);
  const second = searchBazaar({ limit: 2, cursor: first.next_cursor });
  assert.equal(second.ok, true);
  assert.equal(second.results.length, 2);
  assert.deepEqual([...first.results, ...second.results].map((entry) => entry.id), [
    'fogwood.compare-decision',
    'fogwood.evidence-constellation',
    'fogwood.evidence-research-map',
    'fogwood.fungi-cities-research-world',
  ]);
  const all = searchBazaar({ limit: 20 });
  assert.deepEqual(all.results.map((entry) => entry.id), [
    'fogwood.compare-decision',
    'fogwood.evidence-constellation',
    'fogwood.evidence-research-map',
    'fogwood.fungi-cities-research-world',
    'fogwood.meeting-to-plan-wall',
    'fogwood.static-architecture-map',
    'fogwood.storyworld-mutation-map',
  ]);
});

test('Bazaar reads only requested sections and rejects stale or unknown pins', () => {
  const packageRead = readBazaar({
    id: 'fogwood.evidence-research-map',
    version: 1,
    catalog_revision: BAZAAR_CATALOG_REVISION,
    include: ['manifest', 'skill', 'recipes'],
  });
  assert.equal(packageRead.ok, true);
  assert.equal(typeof packageRead.sections.manifest, 'object');
  assert.equal(typeof packageRead.sections.skill, 'string');
  assert.equal(Array.isArray(packageRead.sections.recipes), true);
  assert.equal('examples' in packageRead.sections, false);
  assert.equal('fixtures' in packageRead.sections, false);
  assert.equal('prompts' in packageRead.sections, false);
  assert.equal(packageRead.catalog_source, 'local-snapshot');
  assert.equal(packageRead.content_hash.startsWith('sha256:'), true);

  const stale = readBazaar({
    id: 'fogwood.evidence-research-map',
    version: 1,
    catalog_revision: 'sha256:stale',
    include: ['manifest'],
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.code, 'STALE_CATALOG');
  const unknown = readBazaar({ id: 'fogwood.missing', version: 1, include: ['manifest'] });
  assert.equal(unknown.ok, false);
  assert.equal(unknown.code, 'UNKNOWN_PACKAGE');
});

test('each pinned package carries bounded declarative review material and recipe references', () => {
  const summaries = searchBazaar({ limit: 20 });
  assert.equal(summaries.ok, true);
  for (const summary of summaries.results) {
    const packageRead = readBazaar({
      id: summary.id,
      version: summary.version,
      catalog_revision: summaries.catalog_revision,
      content_hash: summary.content_hash,
      include: ['manifest', 'skill', 'prompts', 'recipes', 'examples', 'fixtures', 'provenance'],
    });
    assert.equal(packageRead.ok, true);
    assert.equal(packageRead.sections.prompts.length >= 2, true);
    assert.equal(packageRead.sections.examples.length >= 2, true);
    assert.equal(packageRead.sections.fixtures.length >= 4, true);
    assert.equal(packageRead.sections.provenance.length >= 4, true);
    assert.equal(packageRead.sections.skill.includes('Workflow'), true);
    assert.notEqual(packageRead.sections.manifest.qualification.status, 'blocked');
  }
  const compare = readBazaar({ id: 'fogwood.compare-decision', version: 1, include: ['recipes'] });
  assert.equal(compare.ok, true);
  assert.equal(compare.sections.recipes[0].content.id, 'compare-and-decide');
  assert.equal(compare.sections.recipes[0].content.capability_refs.includes('instrument.compare-decision.v1'), true);
});

test('active runtime and receipt projection do not import the full Bazaar catalog', () => {
  const runtimeSource = fs.readFileSync(path.resolve('app/fogwood-runtime.ts'), 'utf8');
  const recorderSource = fs.readFileSync(path.resolve('app/fogwood-receipt-recorder.ts'), 'utf8');
  assert.doesNotMatch(runtimeSource, /from\s+['"][^'"]*fogwood-bazaar(?:-catalog\.generated)?/u);
  assert.doesNotMatch(recorderSource, /from\s+['"][^'"]*fogwood-bazaar(?:-catalog\.generated)?/u);
  assert.doesNotMatch(runtimeSource, /BAZAAR_CATALOG|FOGWOOD_BAZAAR_TOOL/u);
  assert.doesNotMatch(recorderSource, /BAZAAR_CATALOG|FOGWOOD_BAZAAR_TOOL/u);
});

test('Bazaar read rejects a changed content hash visibly', () => {
  const result = readBazaar({
    id: 'fogwood.compare-decision',
    version: 1,
    content_hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
    include: ['manifest'],
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'TAMPERED_PACKAGE');
});

test('fogwood-bazaar tool is a separate read-only exact-input seam', () => {
  const tool = createFogwoodBazaarTool();
  assert.equal(tool.name, 'fogwood-bazaar');
  assert.equal(tool.readOnlyHint, true);
  assert.equal(tool.untrustedContentHint, true);
  assert.equal(tool.annotations.readOnlyHint, true);
  assert.equal(tool.annotations.untrustedContentHint, true);
  const search = tool.execute({ operation: 'search', query: 'compare', limit: 5 });
  assert.equal(search.ok, true);
  assert.deepEqual(search.results.map((entry) => entry.id), ['fogwood.compare-decision']);
  const unknownField = executeFogwoodBazaar({ operation: 'search', execute: 'no' });
  assert.equal(unknownField.ok, false);
  assert.equal(unknownField.code, 'UNKNOWN_FIELD');
  const unknownOperation = executeFogwoodBazaar({ operation: 'install', id: 'fogwood.compare-decision' });
  assert.equal(unknownOperation.ok, false);
  assert.equal(unknownOperation.code, 'INVALID_OPERATION');
});

test('compiler output is deterministic and records all legacy and composition package hashes', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fogwood-bazaar-'));
  const indexA = path.join(temp, 'a-index.json');
  const moduleA = path.join(temp, 'a-catalog.ts');
  const indexB = path.join(temp, 'b-index.json');
  const moduleB = path.join(temp, 'b-catalog.ts');
  const first = spawnSync(process.execPath, [compiler, '--index', indexA, '--module', moduleA], { encoding: 'utf8' });
  assert.equal(first.status, 0, first.stderr);
  const second = spawnSync(process.execPath, [compiler, '--index', indexB, '--module', moduleB], { encoding: 'utf8' });
  assert.equal(second.status, 0, second.stderr);
  assert.equal(fs.readFileSync(indexA, 'utf8'), fs.readFileSync(indexB, 'utf8'));
  assert.equal(fs.readFileSync(moduleA, 'utf8'), fs.readFileSync(moduleB, 'utf8'));
  const index = JSON.parse(fs.readFileSync(indexA, 'utf8'));
  assert.equal(index.packages.length, 7);
  assert.equal(new Set(index.packages.map((entry) => entry.content_hash)).size, 7);
  assert.match(index.catalog_revision, /^sha256:[0-9a-f]{64}$/);
});

test('compiler check mode rejects stale generated index or browser module bytes', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fogwood-bazaar-check-'));
  const index = path.join(temp, 'index.json');
  const modulePath = path.join(temp, 'catalog.ts');
  const compile = spawnSync(process.execPath, [compiler, '--index', index, '--module', modulePath], { encoding: 'utf8' });
  assert.equal(compile.status, 0, compile.stderr);
  let check = spawnSync(process.execPath, [compiler, '--check', '--index', index, '--module', modulePath], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  fs.appendFileSync(index, 'stale\n');
  check = spawnSync(process.execPath, [compiler, '--check', '--index', index, '--module', modulePath], { encoding: 'utf8' });
  assert.notEqual(check.status, 0);
  assert.match(check.stderr, /STALE_GENERATED_CATALOG/);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('compiler counts exact stored bytes toward the package limit', () => {
  const source = path.resolve('bazaar/packages');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fogwood-bazaar-size-'));
  const copy = path.join(temp, 'packages');
  fs.cpSync(source, copy, { recursive: true });
  const packageRoot = path.join(copy, 'fogwood.compare-decision', 'v1');
  const jsonPaths = [];
  const collectJson = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) collectJson(entryPath);
      else if (entry.name.endsWith('.json')) jsonPaths.push(entryPath);
    }
  };
  collectJson(packageRoot);
  for (const jsonPath of jsonPaths) {
    const original = fs.readFileSync(jsonPath, 'utf8');
    const targetBytes = 97_000;
    const paddingBytes = targetBytes - Buffer.byteLength(original, 'utf8');
    assert.equal(paddingBytes > 0, true);
    fs.writeFileSync(jsonPath, `${original}${' '.repeat(paddingBytes)}`);
  }
  assert.equal(
    jsonPaths.reduce((sum, jsonPath) => sum + fs.statSync(jsonPath).size, 0) > 512 * 1024,
    true,
  );
  const result = spawnSync(
    process.execPath,
    [compiler, '--packages', copy, '--index', path.join(temp, 'index.json'), '--module', path.join(temp, 'catalog.ts')],
    { encoding: 'utf8' },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /OVERSIZE_PACKAGE/);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('compiler rejects duplicate JSON keys, unknown fields, symlinks, traversal, suspicious payloads, and unsupported host refs', () => {
  const source = path.resolve('bazaar/packages');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fogwood-bazaar-invalid-'));
  const copy = path.join(temp, 'packages');
  fs.cpSync(source, copy, { recursive: true });
  const index = path.join(temp, 'index.json');
  const modulePath = path.join(temp, 'catalog.ts');
  const run = () => spawnSync(process.execPath, [compiler, '--packages', copy, '--index', index, '--module', modulePath], { encoding: 'utf8' });

  const manifestPath = path.join(copy, 'fogwood.compare-decision', 'v1', 'manifest.json');
  const original = fs.readFileSync(manifestPath, 'utf8');
  fs.writeFileSync(manifestPath, original.replace('{', '{"unexpected":true,'));
  let result = run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /UNKNOWN_FIELD|CONTENT_HASH_MISMATCH/);
  fs.writeFileSync(manifestPath, original);

  const promptPath = path.join(copy, 'fogwood.compare-decision', 'v1', 'prompts', 'compare.md');
  const promptOriginal = fs.readFileSync(promptPath, 'utf8');
  fs.writeFileSync(promptPath, `${promptOriginal}\n\n{"execute":"javascript:alert(1)"}`);
  result = run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /SUSPICIOUS|CONTENT_HASH_MISMATCH/);
  fs.writeFileSync(promptPath, promptOriginal);

  const symlink = path.join(copy, 'fogwood.compare-decision', 'v1', 'prompts', 'link.md');
  fs.symlinkSync(promptPath, symlink);
  result = run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /SYMLINK|UNKNOWN_FILE/);
  fs.unlinkSync(symlink);

  const refPath = path.join(copy, 'fogwood.compare-decision', 'v1', 'manifest.json');
  const refOriginal = fs.readFileSync(refPath, 'utf8');
  fs.writeFileSync(refPath, refOriginal.replace('instrument.compare-decision.v1', 'renderer.evil.v1'));
  result = run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /UNTRUSTED_CAPABILITY|CONTENT_HASH_MISMATCH/);
  fs.writeFileSync(refPath, refOriginal);

  const recipePath = path.join(copy, 'fogwood.evidence-research-map', 'v1', 'recipes', 'evidence-research-map.json');
  const recipeOriginal = fs.readFileSync(recipePath, 'utf8');
  fs.writeFileSync(recipePath, recipeOriginal.replace('{', '{"id":"duplicate",'));
  result = run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /DUPLICATE_KEY|CONTENT_HASH_MISMATCH/);
  fs.writeFileSync(recipePath, recipeOriginal);

  fs.rmSync(temp, { recursive: true, force: true });
});

test('compiler rejects case-variant executable and network payloads after a valid hash recomputation', () => {
  const source = path.resolve('bazaar/packages');
  const payloads = ['EVAL(foo)', 'ImPoRt(x)', 'FETCH(http://example.test)'];

  for (const payload of payloads) {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fogwood-bazaar-case-variant-'));
    try {
      const copy = path.join(temp, 'packages');
      fs.cpSync(source, copy, { recursive: true });
      const packageRoot = path.join(copy, 'fogwood.compare-decision', 'v1');
      const promptPath = path.join(packageRoot, 'prompts', 'compare.md');
      fs.appendFileSync(promptPath, `\n\n${payload}\n`);

      const manifestPath = path.join(packageRoot, 'manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const fileMap = {};
      const collectFiles = (directory) => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
          const entryPath = path.join(directory, entry.name);
          if (entry.isDirectory()) {
            collectFiles(entryPath);
            continue;
          }
          const relativePath = path.relative(packageRoot, entryPath).split(path.sep).join('/');
          const text = fs.readFileSync(entryPath, 'utf8');
          fileMap[relativePath] = relativePath.endsWith('.json') ? JSON.parse(text) : text;
        }
      };
      collectFiles(packageRoot);
      manifest.content_hash = packageHash(fileMap, manifest);
      fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

      const result = spawnSync(
        process.execPath,
        [compiler, '--packages', copy, '--index', path.join(temp, 'index.json'), '--module', path.join(temp, 'catalog.ts')],
        { encoding: 'utf8' },
      );
      assert.notEqual(result.status, 0, `${payload} was accepted by the compiler`);
      assert.match(result.stderr, /SUSPICIOUS_CONTENT/);
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
  }
});

test('compiler rejects executable formula fields in composition algorithm data after hash recomputation', () => {
  const source = path.resolve('bazaar/packages');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fogwood-bazaar-composition-invalid-'));
  try {
    const copy = path.join(temp, 'packages');
    fs.cpSync(source, copy, { recursive: true });
    const packageRoot = path.join(copy, 'fogwood.evidence-constellation', 'v2');
    const recipePath = path.join(packageRoot, 'recipes', 'evidence-constellation.json');
    const recipe = JSON.parse(fs.readFileSync(recipePath, 'utf8'));
    recipe.algorithms[0].data.formula = 'item => item';
    fs.writeFileSync(recipePath, `${JSON.stringify(recipe, null, 2)}\n`);
    const manifestPath = path.join(packageRoot, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const fileMap = {};
    const collectFiles = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) collectFiles(entryPath);
        else {
          const relativePath = path.relative(packageRoot, entryPath).split(path.sep).join('/');
          const text = fs.readFileSync(entryPath, 'utf8');
          fileMap[relativePath] = relativePath.endsWith('.json') ? JSON.parse(text) : text;
        }
      }
    };
    collectFiles(packageRoot);
    manifest.content_hash = packageHash(fileMap, manifest);
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const result = spawnSync(
      process.execPath,
      [compiler, '--packages', copy, '--index', path.join(temp, 'index.json'), '--module', path.join(temp, 'catalog.ts')],
      { encoding: 'utf8' },
    );
    assert.notEqual(result.status, 0, 'Executable formula data was accepted by the compiler');
    assert.match(result.stderr, /FORBIDDEN_FIELD/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
