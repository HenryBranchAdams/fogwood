import {
  BAZAAR_CATALOG_REVISION,
  readBazaar,
  searchBazaar,
  type BazaarSearchSummary,
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
} from './fogwood-bazaar.ts';
import {
  canonicalSerialize,
  identityForPackage,
  identityForProposal,
  identityForRecipe,
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
} from './fogwood-identities.ts';
import type { ProposalLifecycleEvent } from './fogwood-proposal-lifecycle.ts';
import {
  createProposalAppliedReceipt,
  createProposalRejectedReceipt,
  createProposalStagedReceipt,
  createRecipeInsertedReceipt,
  createRecipeStagedReceipt,
  createSnapshotExportedReceipt,
  type Receipt,
  type ReceiptAppendManyResult,
  type ReceiptDraft,
  type createReceiptLedger,
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
} from './fogwood-receipts.ts';
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
import { COMPARE_DECIDE_FIXTURE, recomputeCompareDecide } from './fogwood-instruments.ts';
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
import { getRecipe, type ProposalAction, type RecipeDefinition } from './fogwood-runtime.ts';

type ReceiptLedger = Pick<ReturnType<typeof createReceiptLedger>, 'appendMany'>;

export type ReceiptRecorderFailure = {
  ok: false;
  status: 'RECIPE_EVIDENCE_ERROR' | 'IDENTITY_ERROR';
  error: { code: string; message: string };
};

export type ReceiptRecorderResult = ReceiptAppendManyResult | ReceiptRecorderFailure;

export type FogwoodReceiptRecorderOptions = {
  ledger: ReceiptLedger;
  on_recorded?: (receipts: readonly Receipt[]) => void;
};

const RUNTIME_RECIPE_FIELDS = [
  'id',
  'version',
  'title',
  'purpose',
  'status',
  'bounds',
  'semantic',
  'provenance',
  'expected_count',
  'operations',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function recipeProjection(value: unknown) {
  if (!isRecord(value)) return undefined;
  const projected: Record<string, unknown> = {};
  for (const key of RUNTIME_RECIPE_FIELDS) {
    if (!(key in value)) return undefined;
    projected[key] = value[key];
  }
  return projected;
}

export function validateRecipePackageAlignment(runtime: RecipeDefinition, packaged: unknown) {
  const packagedProjection = recipeProjection(packaged);
  const runtimeProjection = recipeProjection(runtime);
  if (!packagedProjection || !runtimeProjection || canonicalSerialize(packagedProjection) !== canonicalSerialize(runtimeProjection)) return false;
  if (!isRecord(packaged)) return false;
  const packagedInstrument = packaged.instrument;
  if (canonicalSerialize(packagedInstrument ?? null) !== canonicalSerialize(runtime.instrument ?? null)) return false;
  if (!runtime.instrument) return packaged.instrument_projection === undefined;
  if (runtime.instrument.kind !== 'compare-and-decide' || !isRecord(packaged.instrument_projection)) return false;
  const projection = packaged.instrument_projection;
  const graph = { instances: projection.instances, bindings: projection.bindings };
  if (canonicalSerialize(graph) !== canonicalSerialize(COMPARE_DECIDE_FIXTURE)) return false;
  if (!isRecord(projection.expected)) return false;
  const evaluation = recomputeCompareDecide();
  const alpha = evaluation.results['compare:score:alpha']?.outputs.weighted_score?.value;
  const beta = evaluation.results['compare:score:beta']?.outputs.weighted_score?.value;
  const recommendation = evaluation.results['compare:recommendation']?.outputs.recommended?.value;
  const chartValue = evaluation.results['compare:chart']?.outputs.scores?.value;
  const chart = isRecord(chartValue) && chartValue.kind === 'chart' ? chartValue.series : undefined;
  const expected = {
    status: evaluation.status,
    alpha_score: alpha,
    beta_score: beta,
    recommendation,
    chart,
  };
  return canonicalSerialize(projection.expected) === canonicalSerialize(expected);
}

function insertRecipeActions(actions: readonly ProposalAction[]) {
  return actions.filter((action): action is Extract<ProposalAction, { type: 'insert_recipe' }> => action.type === 'insert_recipe');
}

function evidenceFailure(code: string, message: string): ReceiptRecorderFailure {
  return { ok: false, status: 'RECIPE_EVIDENCE_ERROR', error: { code, message } };
}

function exactPackageForRecipe(recipe: RecipeDefinition): { package: BazaarSearchSummary; runtime: RecipeDefinition } | ReceiptRecorderFailure {
  const search = searchBazaar({
    query: recipe.id,
    kind: 'recipe',
    locality: 'local',
    catalog_revision: BAZAAR_CATALOG_REVISION,
    limit: 20,
  });
  if (!search.ok) return evidenceFailure(search.code, search.message);
  const candidates = search.results.filter((entry) => entry.version === recipe.version && entry.recipe_ids.includes(recipe.id));
  if (candidates.length !== 1) return evidenceFailure('AMBIGUOUS_RECIPE_PACKAGE', 'The exact runtime recipe does not map to one pinned local Bazaar package.');
  const packageSummary = candidates[0];
  if (!packageSummary) return evidenceFailure('MISSING_RECIPE_PACKAGE', 'The exact runtime recipe package is unavailable.');
  const read = readBazaar({
    id: packageSummary.id,
    version: packageSummary.version,
    content_hash: packageSummary.content_hash,
    catalog_revision: BAZAAR_CATALOG_REVISION,
    include: ['recipes'],
  });
  if (!read.ok) return evidenceFailure(read.code, read.message);
  const packagedRecipes = Array.isArray(read.sections.recipes) ? read.sections.recipes : [];
  const exact = packagedRecipes.filter((entry) => {
    if (!isRecord(entry) || !isRecord(entry.content)) return false;
    return entry.content.id === recipe.id && entry.content.version === recipe.version;
  });
  if (exact.length !== 1) return evidenceFailure('MISSING_RECIPE_CONTENT', 'The pinned package does not contain one exact runtime recipe identity.');
  if (!validateRecipePackageAlignment(recipe, (exact[0] as { content: unknown }).content)) {
    return evidenceFailure('UNALIGNED_RECIPE_PACKAGE', 'The pinned package preview does not match the immutable runtime recipe that would be staged.');
  }
  return { package: packageSummary, runtime: recipe };
}

function recipeDrafts(
  event: ProposalLifecycleEvent,
  proposalIdentity: ReturnType<typeof identityForProposal>,
): ReceiptDraft[] | ReceiptRecorderFailure {
  const drafts: ReceiptDraft[] = [];
  for (const action of insertRecipeActions(event.proposal.actions)) {
    const runtime = getRecipe(action.recipe_id, action.version);
    if (!runtime) return evidenceFailure('UNKNOWN_RUNTIME_RECIPE', `Runtime recipe ${action.recipe_id}@${action.version} is unavailable.`);
    const evidence = exactPackageForRecipe(runtime);
    if ('status' in evidence) return evidence;
    const common = {
      proposal: proposalIdentity,
      recipe: identityForRecipe(evidence.runtime),
      package: identityForPackage(evidence.package),
      source_revision: event.source_revision,
      base_revision: event.base_revision,
    };
    if (event.type === 'proposal-staged') {
      drafts.push(createRecipeStagedReceipt({
        ...common,
        outcome: 'staged',
        qualification_boundary: 'device-local immutable recipe staging evidence; human Apply or Reject remains required',
      }));
    } else if (event.type === 'proposal-applied') {
      drafts.push(createRecipeInsertedReceipt({
        ...common,
        result_revision: event.result_revision,
        outcome: 'inserted',
        qualification_boundary: 'device-local immutable recipe insertion evidence after page-owned Apply; no deployment or external publication',
      }));
    }
  }
  return drafts;
}

function proposalDraft(event: ProposalLifecycleEvent, proposal: ReturnType<typeof identityForProposal>) {
  if (event.type === 'proposal-staged') {
    return createProposalStagedReceipt({
      proposal,
      source_revision: event.source_revision,
      base_revision: event.base_revision,
      outcome: 'staged',
      qualification_boundary: 'device-local proposal evidence; human Apply or Reject remains required',
    });
  }
  if (event.type === 'proposal-applied') {
    return createProposalAppliedReceipt({
      proposal,
      source_revision: event.source_revision,
      base_revision: event.base_revision,
      result_revision: event.result_revision,
      outcome: 'applied',
      qualification_boundary: 'device-local page-owned Apply evidence; one local undo transaction; no deployment or external publication',
    });
  }
  return createProposalRejectedReceipt({
    proposal,
    source_revision: event.source_revision,
    base_revision: event.base_revision,
    outcome: 'rejected',
    qualification_boundary: 'device-local rejection evidence; the canvas was not changed by Reject',
    reason: 'The person chose Reject on the page.',
  });
}

export function createFogwoodReceiptRecorder(options: FogwoodReceiptRecorderOptions) {
  const append = (drafts: readonly ReceiptDraft[]): ReceiptRecorderResult => {
    const result = options.ledger.appendMany(drafts);
    if (result.ok) options.on_recorded?.(result.receipts);
    return result;
  };

  const recordProposalLifecycle = (event: ProposalLifecycleEvent): ReceiptRecorderResult => {
    try {
      const proposal = identityForProposal(event.proposal);
      const related = recipeDrafts(event, proposal);
      if (!Array.isArray(related)) return related;
      return append([proposalDraft(event, proposal), ...related]);
    } catch (error) {
      return {
        ok: false,
        status: 'IDENTITY_ERROR',
        error: {
          code: 'IDENTITY_ERROR',
          message: error instanceof Error ? error.message.slice(0, 300) : 'Receipt identity creation failed.',
        },
      };
    }
  };

  const recordSnapshot = (snapshot: {
    source_revision: string;
    artifact: { format: string; hash: string };
  }): ReceiptRecorderResult => append([createSnapshotExportedReceipt({
    source_revision: snapshot.source_revision,
    artifact: snapshot.artifact,
    outcome: 'exported',
    qualification_boundary: 'device-local SVG bytes were created and pinned; a separate page-owned download attempt may follow; this receipt does not prove a download request or file persistence',
  })]);

  return Object.freeze({ recordProposalLifecycle, recordSnapshot });
}
