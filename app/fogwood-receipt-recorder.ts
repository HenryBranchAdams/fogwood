/**
 * Page-owned receipt projection for the current Fogwood proposal protocol.
 *
 * This module deliberately knows nothing about the Bazaar or a recipe
 * runtime. The Bazaar is authoring knowledge for Codex; a staged proposal is
 * the only thing the page records. The receipt-v1 parser and constructors stay
 * in fogwood-receipts.ts so old device-local ledgers remain readable.
 */

import {
  canonicalSerialize,
  identityForProposal,
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
} from './fogwood-identities.ts';
import type { ProposalLifecycleEvent } from './fogwood-proposal-lifecycle.ts';
import {
  createProposalAppliedReceipt,
  createProposalRejectedReceipt,
  createProposalStagedReceipt,
  createSnapshotExportedReceipt,
  hashReceiptMaterialEvidence,
  hashReceiptProposalEvidenceIdentity,
  hashReceiptSeededEvidence,
  type Receipt,
  type ReceiptAppendManyResult,
  type ReceiptDraft,
  type ReceiptMaterialEvidence,
  type ReceiptSeededCompositionEvidence,
  type createReceiptLedger,
// @ts-expect-error TS5097: Node's strip-types test loader resolves explicit source extensions.
} from './fogwood-receipts.ts';

type ReceiptLedger = Pick<ReturnType<typeof createReceiptLedger>, 'appendMany'>;

export type ReceiptRecorderResult = ReceiptAppendManyResult | {
  ok: false;
  status: 'IDENTITY_ERROR';
  error: { code: string; message: string };
};

export type FogwoodReceiptRecorderOptions = {
  ledger: ReceiptLedger;
  on_recorded?: (receipts: readonly Receipt[]) => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function materialEvidenceForProposal(actions: readonly unknown[]): ReceiptMaterialEvidence[] {
  return actions.flatMap((candidate) => {
    if (!isRecord(candidate) || candidate.type !== 'add_materials' || !Array.isArray(candidate.materials)) return [];
    return candidate.materials.map((material) => {
      if (
        !isRecord(material)
        || typeof material.semantic_id !== 'string'
        || typeof material.content_hash !== 'string'
        || typeof material.byte_length !== 'number'
        || !isRecord(material.dimensions)
        || typeof material.dimensions.width !== 'number'
        || typeof material.dimensions.height !== 'number'
        || typeof material.mime_type !== 'string'
        || (material.source_status !== 'original' && material.source_status !== 'sanitized')
        || material.decode_qualified !== true
        || typeof material.x !== 'number'
        || typeof material.y !== 'number'
        || typeof material.w !== 'number'
        || typeof material.h !== 'number'
        || typeof material.originating_capability !== 'string'
        || typeof material.qualification_boundary !== 'string'
        || typeof material.prompt_summary !== 'string'
      ) {
        throw new Error('Material receipt evidence requires the exact prepared, decode-qualified proposal object.');
      }
      return {
        semantic_id: material.semantic_id,
        content_hash: material.content_hash,
        byte_length: material.byte_length,
        mime_type: material.mime_type as ReceiptMaterialEvidence['mime_type'],
        width: material.dimensions.width,
        height: material.dimensions.height,
        source_status: material.source_status,
        decode_qualified: true,
        x: material.x,
        y: material.y,
        w: material.w,
        h: material.h,
        originating_capability: material.originating_capability,
        qualification_boundary: material.qualification_boundary,
        prompt_summary: material.prompt_summary,
      };
    });
  });
}

function seededEvidenceForProposal(actions: readonly unknown[]): ReceiptSeededCompositionEvidence[] {
  return actions.flatMap((candidate) => {
    if (!isRecord(candidate) || candidate.type !== 'seeded_composition') return [];
    if (
      candidate.grammar !== 'remix'
      || candidate.algorithm_version !== 1
      || candidate.prng !== 'xorshift32-v1'
      || (typeof candidate.seed !== 'string' && typeof candidate.seed !== 'number')
      || typeof candidate.wildness !== 'number'
      || typeof candidate.source_revision !== 'string'
      || typeof candidate.source_fingerprint !== 'string'
      || !isRecord(candidate.layout)
      || candidate.layout.kind !== 'branch-cluster'
      || !['right', 'bottom', 'left', 'top'].includes(String(candidate.layout.open_side))
      || typeof candidate.layout.branch_count !== 'number'
      || typeof candidate.layout.open_gap !== 'number'
      || typeof candidate.layout.rhythm !== 'number'
      || !Array.isArray(candidate.lineage)
    ) throw new Error('Seeded receipt evidence requires the exact normalized composition proposal.');
    return [{
      grammar: 'remix',
      algorithm_version: 1,
      prng: 'xorshift32-v1',
      seed: candidate.seed,
      wildness: candidate.wildness,
      source_revision: candidate.source_revision,
      source_fingerprint: candidate.source_fingerprint,
      layout: {
        kind: 'branch-cluster',
        open_side: candidate.layout.open_side as ReceiptSeededCompositionEvidence['layout']['open_side'],
        branch_count: candidate.layout.branch_count,
        open_gap: candidate.layout.open_gap,
        rhythm: candidate.layout.rhythm,
      },
      lineage: candidate.lineage as ReceiptSeededCompositionEvidence['lineage'],
    }];
  });
}

function proposalDraft(event: ProposalLifecycleEvent, proposal: ReturnType<typeof identityForProposal>): ReceiptDraft {
  const materialEvidence = materialEvidenceForProposal(event.proposal.actions);
  const seededEvidence = seededEvidenceForProposal(event.proposal.actions);
  const materialEvidenceHash = materialEvidence.length > 0 ? hashReceiptMaterialEvidence(materialEvidence) : undefined;
  const seededEvidenceHash = seededEvidence.length > 0 ? hashReceiptSeededEvidence(seededEvidence) : undefined;
  const evidence = {
    ...(materialEvidence.length > 0 ? { material_evidence: materialEvidence } : {}),
    ...(seededEvidence.length > 0 ? { seeded_evidence: seededEvidence } : {}),
  };
  const evidenceBoundProposal = seededEvidenceHash === undefined && materialEvidenceHash === undefined
    ? proposal
    : seededEvidenceHash === undefined
      ? { ...proposal, material_evidence_hash: materialEvidenceHash }
      : {
          id: proposal.id,
          version: proposal.version,
          content_hash: proposal.hash as string,
          seeded_evidence_hash: seededEvidenceHash,
          ...(materialEvidenceHash === undefined ? {} : { material_evidence_hash: materialEvidenceHash }),
          hash: hashReceiptProposalEvidenceIdentity({
            content_hash: proposal.hash as string,
            ...(materialEvidenceHash === undefined ? {} : { material_evidence_hash: materialEvidenceHash }),
            seeded_evidence_hash: seededEvidenceHash,
          }),
        };
  if (event.type === 'proposal-staged') {
    return createProposalStagedReceipt({
      proposal: evidenceBoundProposal,
      ...evidence,
      source_revision: event.source_revision,
      base_revision: event.base_revision,
      outcome: 'staged',
      qualification_boundary: 'device-local proposal evidence; human Apply or Reject remains required',
    });
  }
  if (event.type === 'proposal-applied') {
    return createProposalAppliedReceipt({
      proposal: evidenceBoundProposal,
      ...evidence,
      source_revision: event.source_revision,
      base_revision: event.base_revision,
      result_revision: event.result_revision,
      outcome: 'applied',
      qualification_boundary: 'device-local page-owned Apply evidence; one local undo transaction; no deployment or external publication',
    });
  }
  return createProposalRejectedReceipt({
    proposal: evidenceBoundProposal,
    ...evidence,
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
      const identity = identityForProposal(event.proposal);
      const draft = proposalDraft(event, identity);
      // One lifecycle transition produces one generic proposal receipt. Recipe
      // and snapshot event constructors remain in the v1 module solely for
      // reading/append compatibility with pre-autophagy ledgers.
      return append([draft]);
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

// Kept as a tiny, testable projection seam for callers that need to compare
// the exact proposal identity without importing the receipt ledger.
export function proposalReceiptIdentity(proposal: unknown) {
  return canonicalSerialize(identityForProposal(proposal));
}
