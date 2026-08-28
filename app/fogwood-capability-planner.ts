export const FOGWOOD_CAPABILITY_ONTOLOGY_VERSION = 2 as const;

export const FOGWOOD_CAPABILITY_EFFECTS = [
  'matter.created',
  'matter.variant.created',
  'mark.drawn',
  'matter.edited',
  'matter.deleted',
  'geometry.arranged',
  'connector-arrow.created',
  'structure.grouped',
  'layer.order.changed',
] as const;

export type FogwoodCapabilityEffect = (typeof FOGWOOD_CAPABILITY_EFFECTS)[number];

type CapabilityAuthority = 'page-apply';
type CapabilitySpeculation = 'never';

export type FogwoodCapabilityManifest = Readonly<{
  schema: 'fogwood.capability.v1';
  id: string;
  version: 1 | 2;
  kind: 'Capability';
  title: string;
  intent: Readonly<{
    use_when: string;
    not_for: string;
    trigger_terms: readonly string[];
    keywords: readonly string[];
  }>;
  preconditions: Readonly<{
    minimum_targets: number;
    planned_matter_satisfies_target_minimum: boolean;
  }>;
  effects: readonly FogwoodCapabilityEffect[];
  composition: Readonly<{
    order: number;
    requires: readonly string[];
    supersedes?: readonly string[];
  }>;
  adapter: Readonly<{
    id: string;
    action_type: 'canvas_ops';
    operations: readonly string[];
  }>;
  execution_policy: Readonly<{
    authority: CapabilityAuthority;
    locality: 'device-local';
    network: 'none';
    arbitrary_code: false;
    purity: 'mutation';
    determinism: 'deterministic';
    idempotency: 'revision-keyed';
    speculation: CapabilitySpeculation;
  }>;
  limits: Readonly<{
    max_targets: number;
    bounded: true;
  }>;
  evidence: Readonly<{
    qualification: 'adapter-fixture-tested';
    example_ids: readonly string[];
  }>;
}>;

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function capability(
  definition: Omit<FogwoodCapabilityManifest, 'schema' | 'version' | 'kind' | 'execution_policy' | 'limits'> & Readonly<{
    version?: 1 | 2;
    limits?: FogwoodCapabilityManifest['limits'];
  }>,
): FogwoodCapabilityManifest {
  const { version = 1, limits = { max_targets: 64, bounded: true }, ...value } = definition;
  return deepFreeze({
    schema: 'fogwood.capability.v1',
    version,
    kind: 'Capability',
    ...value,
    execution_policy: {
      authority: 'page-apply',
      locality: 'device-local',
      network: 'none',
      arbitrary_code: false,
      purity: 'mutation',
      determinism: 'deterministic',
      idempotency: 'revision-keyed',
      speculation: 'never',
    },
    limits,
  });
}

export const FOGWOOD_CAPABILITY_ONTOLOGY: readonly FogwoodCapabilityManifest[] = Object.freeze([
  capability({
    id: 'matter.native.create',
    title: 'Create native matter',
    intent: {
      use_when: 'New editable shapes, text, notes, frames, or arrows should exist on the canvas.',
      not_for: 'Remote embeds, executable custom shapes, or host UI configuration.',
      trigger_terms: ['create', 'make', 'add'],
      keywords: ['create', 'make', 'add', 'idea', 'ideas', 'node', 'nodes', 'shape', 'shapes', 'label', 'labeled', 'labelled'],
    },
    preconditions: { minimum_targets: 0, planned_matter_satisfies_target_minimum: true },
    effects: ['matter.created'],
    composition: { order: 10, requires: [] },
    adapter: { id: 'canvas-ops.v1', action_type: 'canvas_ops', operations: ['create'] },
    evidence: { qualification: 'adapter-fixture-tested', example_ids: [] },
  }),
  capability({
    id: 'matter.variant.create',
    title: 'Create a preserved native variant',
    intent: {
      use_when: 'Existing native matter should remain in place while an editable variant branches from it.',
      not_for: 'Replacing the source, duplicating groups or bindings, or copying executable/custom matter.',
      trigger_terms: ['variant', 'preserve', 'preserved', 'duplicate', 'clone', 'copy', 'remix', 'fork', 'branch'],
      keywords: ['variant', 'preserve', 'preserved', 'duplicate', 'clone', 'copy', 'remix', 'fork', 'branch', 'lineage'],
    },
    preconditions: { minimum_targets: 1, planned_matter_satisfies_target_minimum: false },
    effects: ['matter.variant.created'],
    composition: { order: 15, requires: [], supersedes: ['matter.native.create'] },
    adapter: { id: 'canvas-ops.v2', action_type: 'canvas_ops', operations: ['variant'] },
    limits: { max_targets: 1, bounded: true },
    evidence: { qualification: 'adapter-fixture-tested', example_ids: [] },
  }),
  capability({
    id: 'matter.native.draw',
    title: 'Draw a native path',
    intent: {
      use_when: 'A freehand, traced, or irregular native mark should be created.',
      not_for: 'Arrow relationships, screenshots, or custom interactive tools.',
      trigger_terms: ['draw', 'sketch', 'trace', 'freehand', 'scribble'],
      keywords: ['sketch', 'trace', 'freehand', 'scribble', 'path', 'stroke'],
    },
    preconditions: { minimum_targets: 0, planned_matter_satisfies_target_minimum: true },
    effects: ['mark.drawn'],
    composition: { order: 20, requires: [] },
    adapter: { id: 'canvas-ops.v1', action_type: 'canvas_ops', operations: ['draw'] },
    evidence: { qualification: 'adapter-fixture-tested', example_ids: [] },
  }),
  capability({
    id: 'matter.native.edit',
    title: 'Edit native matter',
    intent: {
      use_when: 'Existing or newly planned native matter should change content, style, placement, rotation, or opacity.',
      not_for: 'Custom DOM behavior or arbitrary shape properties.',
      trigger_terms: ['edit', 'change', 'update', 'style', 'rename', 'refine'],
      keywords: ['edit', 'change', 'update', 'style', 'rename', 'refine', 'move', 'rotate', 'opacity'],
    },
    preconditions: { minimum_targets: 1, planned_matter_satisfies_target_minimum: true },
    effects: ['matter.edited'],
    composition: { order: 30, requires: [] },
    adapter: { id: 'canvas-ops.v1', action_type: 'canvas_ops', operations: ['update'] },
    evidence: { qualification: 'adapter-fixture-tested', example_ids: [] },
  }),
  capability({
    id: 'layout.arrange',
    title: 'Arrange native matter',
    intent: {
      use_when: 'Several editable items should be aligned, distributed, stacked, or packed.',
      not_for: 'Responsive DOM layout, binding-driven layout, or unconstrained simulation.',
      trigger_terms: ['align', 'aligned', 'distribute', 'arrange', 'stack', 'pack', 'organize', 'organise'],
      keywords: ['align', 'aligned', 'distribute', 'arrange', 'stack', 'pack', 'organize', 'organise', 'layout'],
    },
    preconditions: { minimum_targets: 2, planned_matter_satisfies_target_minimum: true },
    effects: ['geometry.arranged'],
    composition: { order: 40, requires: [] },
    adapter: { id: 'canvas-ops.v1', action_type: 'canvas_ops', operations: ['align', 'distribute', 'stack', 'pack'] },
    evidence: {
      qualification: 'adapter-fixture-tested',
      example_ids: ['tldraw-example.editor-api.align-and-distribute-shapes'],
    },
  }),
  capability({
    id: 'connector-arrow.create',
    version: 2,
    title: 'Create an editable bound connector arrow',
    intent: {
      use_when: 'Exactly two canvas items should stay connected by an editable native arrow as either endpoint moves.',
      not_for: 'Canonical relationship kinds, arbitrary routing code, more than two endpoints, or collaboration records.',
      trigger_terms: ['connect', 'connected', 'link'],
      keywords: ['arrow', 'connector', 'connect', 'connected', 'link', 'bound', 'edge'],
    },
    preconditions: { minimum_targets: 2, planned_matter_satisfies_target_minimum: true },
    effects: ['connector-arrow.created'],
    composition: { order: 50, requires: [] },
    adapter: { id: 'canvas-ops.v2', action_type: 'canvas_ops', operations: ['connect'] },
    limits: { max_targets: 2, bounded: true },
    evidence: { qualification: 'adapter-fixture-tested', example_ids: [] },
  }),
  capability({
    id: 'structure.group',
    title: 'Group native matter',
    intent: {
      use_when: 'Several editable items should become one movable unit or be separated again.',
      not_for: 'Semantic regions, DOM containment, or nested application state.',
      trigger_terms: ['group', 'grouped', 'ungroup'],
      keywords: ['group', 'grouped', 'ungroup', 'unit', 'contain'],
    },
    preconditions: { minimum_targets: 2, planned_matter_satisfies_target_minimum: true },
    effects: ['structure.grouped'],
    composition: { order: 60, requires: [] },
    adapter: { id: 'canvas-ops.v1', action_type: 'canvas_ops', operations: ['group', 'ungroup'] },
    evidence: { qualification: 'adapter-fixture-tested', example_ids: [] },
  }),
  capability({
    id: 'layer.reorder',
    title: 'Reorder native matter',
    intent: {
      use_when: 'Overlap or visual layering should change by moving exact items forward or backward.',
      not_for: 'A custom layer panel or application-level navigation.',
      trigger_terms: ['front', 'back', 'forward', 'backward', 'reorder'],
      keywords: ['front', 'back', 'forward', 'backward', 'reorder', 'layer', 'z-order'],
    },
    preconditions: { minimum_targets: 1, planned_matter_satisfies_target_minimum: true },
    effects: ['layer.order.changed'],
    composition: { order: 70, requires: [] },
    adapter: { id: 'canvas-ops.v1', action_type: 'canvas_ops', operations: ['reorder'] },
    evidence: {
      qualification: 'adapter-fixture-tested',
      example_ids: ['tldraw-example.editor-api.z-order'],
    },
  }),
  capability({
    id: 'matter.native.delete',
    title: 'Delete native matter',
    intent: {
      use_when: 'Exact unlocked native matter should be deleted after human review.',
      not_for: 'Clearing the page, deleting locked matter, or removing semantic bindings.',
      trigger_terms: ['delete', 'remove', 'discard'],
      keywords: ['delete', 'remove', 'discard', 'native', 'matter'],
    },
    preconditions: { minimum_targets: 1, planned_matter_satisfies_target_minimum: true },
    effects: ['matter.deleted'],
    composition: { order: 35, requires: [] },
    adapter: { id: 'canvas-ops.v1', action_type: 'canvas_ops', operations: ['delete'] },
    evidence: { qualification: 'adapter-fixture-tested', example_ids: [] },
  }),
]);

export type FogwoodCapabilityPlanningRequest = Readonly<{
  intent: string;
  base_revision: string;
  context_token: string;
  scope: 'new' | 'selection' | 'page';
  desired_effects?: readonly FogwoodCapabilityEffect[];
  planned_item_count?: number;
  max_steps?: number;
}>;

export type FogwoodCapabilityPlanningFacts = Readonly<{
  current_revision: string;
  current_context_token: string;
  page_item_count: number;
  selection_count: number;
  locked_selection_count: number;
  locked_page_item_count: number;
  readonly?: boolean;
}>;

type PlanError = Readonly<{ code: string; message: string; capability_id?: string; recovery?: string }>;

export type FogwoodCapabilityPlan = Readonly<{
  status: 'ready' | 'blocked' | 'refused' | 'needs-clarification';
  ontology_version: typeof FOGWOOD_CAPABILITY_ONTOLOGY_VERSION;
  base_revision: string;
  context_token: string;
  intent: string;
  steps: readonly Readonly<{
    capability_id: string;
    title: string;
    effects: readonly FogwoodCapabilityEffect[];
    preconditions: FogwoodCapabilityManifest['preconditions'];
    adapter_id: string;
    action_type: 'canvas_ops';
    operations: readonly string[];
    qualification: FogwoodCapabilityManifest['evidence']['qualification'];
    supporting_example_ids: readonly string[];
    reason: string;
    execution_policy: FogwoodCapabilityManifest['execution_policy'];
  }>[];
  supporting_example_ids: readonly string[];
  errors: readonly PlanError[];
  planning_policy: Readonly<{
    purity: 'pure';
    determinism: 'deterministic';
    speculation: 'shadow-only';
  }>;
  next_call?: Readonly<{ tool: 'fogwood-propose'; action_type: 'canvas_ops' }>;
}>;

function lexical(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function safeInteger(value: unknown, minimum: number, maximum: number) {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum;
}

function tokenize(value: string) {
  return new Set(value.toLowerCase().split(/[^a-z0-9-]+/u).filter(Boolean));
}

export const FOGWOOD_CAPABILITY_TARGET_LIMIT = 64 as const;
export const FOGWOOD_CAPABILITY_PLANNED_ITEM_LIMIT = 24 as const;

export type FogwoodCapabilityAvailabilityReason = Readonly<{
  code: string;
  message: string;
}>;

export type FogwoodCapabilityAvailabilityFacts = Readonly<{
  page_item_count: number;
  selection_count: number;
  locked_selection_count: number;
  locked_page_item_count: number;
  readonly?: boolean;
}>;

export type FogwoodCapabilityAvailabilityEntry = FogwoodCapabilityManifest & Readonly<{
  availability: 'available' | 'blocked';
  reasons: readonly FogwoodCapabilityAvailabilityReason[];
}>;

function availabilityFactsValid(facts: FogwoodCapabilityAvailabilityFacts) {
  return Boolean(facts)
    && safeInteger(facts.page_item_count, 0, 5_000)
    && safeInteger(facts.selection_count, 0, 5_000)
    && safeInteger(facts.locked_selection_count, 0, 5_000)
    && safeInteger(facts.locked_page_item_count, 0, 5_000)
    && facts.locked_selection_count <= facts.selection_count
    && facts.locked_page_item_count <= facts.page_item_count;
}

function availabilityReasons(
  manifest: FogwoodCapabilityManifest,
  facts: FogwoodCapabilityAvailabilityFacts,
): FogwoodCapabilityAvailabilityReason[] {
  const reasons: FogwoodCapabilityAvailabilityReason[] = [];
  if (!availabilityFactsValid(facts)) {
    reasons.push({ code: 'INVALID_CANVAS_FACTS', message: 'Current canvas facts exceed the bounded availability limits.' });
    return reasons;
  }
  if (facts.readonly === true) {
    reasons.push({ code: 'READONLY', message: 'The current page is read-only; mutating capabilities are unavailable.' });
  }
  const minimumTargets = manifest.preconditions.minimum_targets;
  const hasTargetRequirement = minimumTargets > 0;
  if (hasTargetRequirement && facts.locked_selection_count > 0) {
    reasons.push({ code: 'LOCKED_SELECTION', message: 'The current selection contains locked matter or a locked ancestor.' });
  }
  if (hasTargetRequirement && facts.selection_count > manifest.limits.max_targets) {
    reasons.push({ code: 'SELECTION_LIMIT', message: `${manifest.id} accepts at most ${manifest.limits.max_targets} selected item(s).` });
  }
  if (hasTargetRequirement && facts.selection_count < minimumTargets) {
    reasons.push({
      code: minimumTargets === 1 ? 'SELECTION_REQUIRED' : 'MULTI_SELECTION_REQUIRED',
      message: `${manifest.id} requires at least ${minimumTargets} selected item(s) in the current context.`,
    });
  }
  if (manifest.effects.includes('matter.created') || manifest.effects.includes('mark.drawn')) {
    if (facts.page_item_count >= 5_000) reasons.push({ code: 'PAGE_CONTEXT_LIMIT', message: 'The current page has reached the bounded 5,000-item context limit.' });
  }
  return reasons;
}

/**
 * Return every qualified semantic manifest with current-context availability.
 * This is advisory data only; proposal validation repeats exact target checks.
 */
export function listCapabilityAvailability(
  facts: FogwoodCapabilityAvailabilityFacts,
): readonly FogwoodCapabilityAvailabilityEntry[] {
  return Object.freeze(FOGWOOD_CAPABILITY_ONTOLOGY.map((manifest) => {
    const reasons = availabilityReasons(manifest, facts);
    return Object.freeze({
      ...manifest,
      availability: reasons.length === 0 ? 'available' as const : 'blocked' as const,
      reasons: Object.freeze(reasons),
    });
  }));
}

export const availableCapabilities = listCapabilityAvailability;
export const evaluateCapabilityAvailability = listCapabilityAvailability;

export function isValidDesiredEffects(value: unknown): value is readonly FogwoodCapabilityEffect[] {
  if (!Array.isArray(value) || value.length > 12) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (!(index in value) || !FOGWOOD_CAPABILITY_EFFECTS.includes(value[index])) return false;
  }
  return true;
}

function basePlan(
  status: FogwoodCapabilityPlan['status'],
  request: FogwoodCapabilityPlanningRequest,
  errors: readonly PlanError[],
  steps: FogwoodCapabilityPlan['steps'] = [],
  supportingExampleIds: readonly string[] = [],
): FogwoodCapabilityPlan {
  return Object.freeze({
    status,
    ontology_version: FOGWOOD_CAPABILITY_ONTOLOGY_VERSION,
    base_revision: typeof request.base_revision === 'string' ? request.base_revision : '',
    context_token: typeof request.context_token === 'string' ? request.context_token : '',
    intent: typeof request.intent === 'string' ? request.intent : '',
    steps: Object.freeze([...steps]),
    supporting_example_ids: Object.freeze([...supportingExampleIds]),
    errors: Object.freeze([...errors]),
    planning_policy: Object.freeze({ purity: 'pure', determinism: 'deterministic', speculation: 'shadow-only' }),
    ...(status === 'ready' ? { next_call: Object.freeze({ tool: 'fogwood-propose', action_type: 'canvas_ops' }) } : {}),
  });
}

export function planCapabilities(
  request: FogwoodCapabilityPlanningRequest,
  facts: FogwoodCapabilityPlanningFacts,
): FogwoodCapabilityPlan {
  if (!request || typeof request !== 'object' || !facts || typeof facts !== 'object') {
    return basePlan('refused', request ?? ({} as FogwoodCapabilityPlanningRequest), [
      { code: 'INVALID_PLANNER_INPUT', message: 'Planning request and canvas facts must be objects.' },
    ]);
  }
  if (typeof request.intent !== 'string' || request.intent.trim().length < 1 || request.intent.length > 500) {
    return basePlan('refused', request, [{ code: 'INVALID_INTENT', message: 'intent must contain 1-500 characters.' }]);
  }
  if (typeof request.base_revision !== 'string' || request.base_revision.length < 1 || request.base_revision.length > 120) {
    return basePlan('refused', request, [{ code: 'INVALID_REVISION', message: 'base_revision must contain 1-120 characters.' }]);
  }
  if (request.base_revision !== facts.current_revision) {
    return basePlan('refused', request, [{ code: 'STALE_STATE', message: 'The inspected canvas revision is no longer current.' }]);
  }
  if (typeof request.context_token !== 'string' || request.context_token.length < 1 || request.context_token.length > 64) {
    return basePlan('refused', request, [{ code: 'INVALID_CONTEXT_TOKEN', message: 'context_token must contain 1-64 characters.' }]);
  }
  if (typeof facts.current_context_token !== 'string' || facts.current_context_token.length < 1 || request.context_token !== facts.current_context_token) {
    return basePlan('refused', request, [{
      code: 'STALE_CONTEXT',
      message: 'The inspected semantic context is no longer current; inspect the page again before planning.',
      recovery: 'Call fogwood-inspect, then retry fogwood-capabilities with its returned base_revision and context_token.',
    }]);
  }
  if (!['new', 'selection', 'page'].includes(request.scope)) {
    return basePlan('refused', request, [{ code: 'INVALID_SCOPE', message: 'scope must be new, selection, or page.' }]);
  }
  if (!safeInteger(facts.page_item_count, 0, 5_000)
    || !safeInteger(facts.selection_count, 0, 5_000)
    || !safeInteger(facts.locked_selection_count, 0, 5_000)
    || !safeInteger(facts.locked_page_item_count, 0, 5_000)
    || facts.locked_selection_count > facts.selection_count
    || facts.locked_page_item_count > facts.page_item_count) {
    return basePlan('refused', request, [{ code: 'INVALID_CANVAS_FACTS', message: 'Canvas facts exceed the planner limits.' }]);
  }
  if (facts.readonly === true) {
    return basePlan('blocked', request, [{ code: 'READONLY', message: 'The current page is read-only; mutating capabilities cannot be planned.' }]);
  }
  if (request.scope === 'selection' && facts.locked_selection_count > 0) {
    return basePlan('blocked', request, [{ code: 'LOCKED_SELECTION', message: 'The selected scope contains locked matter.' }]);
  }
  const maxSteps = request.max_steps === undefined ? 8 : request.max_steps;
  if (!safeInteger(maxSteps, 1, 12)) {
    return basePlan('refused', request, [{ code: 'INVALID_STEP_LIMIT', message: 'max_steps must be an integer from 1 to 12.' }]);
  }
  if (request.planned_item_count !== undefined && !safeInteger(request.planned_item_count, 0, FOGWOOD_CAPABILITY_PLANNED_ITEM_LIMIT)) {
    return basePlan('refused', request, [{ code: 'INVALID_PLANNED_ITEM_COUNT', message: `planned_item_count must be an integer from 0 to ${FOGWOOD_CAPABILITY_PLANNED_ITEM_LIMIT}.` }]);
  }
  if (request.desired_effects !== undefined) {
    if (!isValidDesiredEffects(request.desired_effects)) {
      return basePlan('refused', request, [{ code: 'INVALID_DESIRED_EFFECT', message: 'desired_effects contains an unsupported or sparse value.' }]);
    }
  }

  const intentTokens = tokenize(request.intent);
  const desiredEffects = new Set(request.desired_effects ?? []);
  const hasExplicitEffects = desiredEffects.size > 0;
  let selected = FOGWOOD_CAPABILITY_ONTOLOGY.filter((entry) => (
    entry.effects.some((effect) => desiredEffects.has(effect))
    || (!hasExplicitEffects && entry.intent.trigger_terms.some((keyword) => intentTokens.has(keyword)))
  )).sort((a, b) => a.composition.order - b.composition.order || lexical(a.id, b.id));

  if (!hasExplicitEffects) {
    const superseded = new Set(selected.flatMap((entry) => entry.composition.supersedes ?? []));
    selected = selected.filter((entry) => !superseded.has(entry.id));
  }

  if (selected.length === 0) {
    return basePlan('needs-clarification', request, [{
      code: 'NO_MATCHING_CAPABILITY',
      message: 'No qualified capability matched the requested intent or desired effects.',
    }]);
  }
  if (selected.length > maxSteps) {
    return basePlan('refused', request, [{ code: 'PLAN_STEP_LIMIT', message: `The plan requires ${selected.length} capabilities, above max_steps ${maxSteps}.` }]);
  }

  const plansMatter = selected.some((entry) => entry.effects.includes('matter.created'));
  const targetCapabilities = selected.filter((entry) => entry.preconditions.minimum_targets > 0);
  if (request.scope === 'page' && facts.locked_page_item_count > 0 && targetCapabilities.length > 0) {
    return basePlan('blocked', request, [{ code: 'LOCKED_PAGE_SCOPE', message: 'The page scope contains locked matter or locked descendants.' }]);
  }
  if (request.scope === 'new' && plansMatter && targetCapabilities.length > 0 && request.planned_item_count === undefined) {
    return basePlan('blocked', request, [{ code: 'PLANNED_TARGET_COUNT_REQUIRED', message: 'New-scope plans that target created matter must declare planned_item_count.' }]);
  }
  const currentTargets = request.scope === 'selection'
    ? facts.selection_count
    : request.scope === 'page'
      ? facts.page_item_count
      : plansMatter
        ? (request.planned_item_count ?? 0)
        : 0;
  const preconditionErrors: PlanError[] = [];
  for (const entry of selected) {
    if (entry.preconditions.minimum_targets > 0 && currentTargets > entry.limits.max_targets) {
      preconditionErrors.push({
        code: 'TARGET_SCOPE_LIMIT',
        capability_id: entry.id,
        message: `${entry.id} cannot target ${currentTargets} items; its adapter limit is ${entry.limits.max_targets}.`,
      });
      continue;
    }
    if (entry.preconditions.minimum_targets <= currentTargets) continue;
    preconditionErrors.push({
      code: 'MINIMUM_TARGETS_UNMET',
      capability_id: entry.id,
      message: `${entry.id} requires at least ${entry.preconditions.minimum_targets} target(s) in this scope or planned native matter.`,
    });
  }
  if (preconditionErrors.length > 0) return basePlan('blocked', request, preconditionErrors);

  const steps = selected.map((entry) => Object.freeze({
    capability_id: entry.id,
    title: entry.title,
    effects: entry.effects,
    preconditions: entry.preconditions,
    adapter_id: entry.adapter.id,
    action_type: entry.adapter.action_type,
    operations: Object.freeze([...entry.adapter.operations]),
    qualification: entry.evidence.qualification,
    supporting_example_ids: entry.evidence.example_ids,
    reason: entry.effects.some((effect) => desiredEffects.has(effect))
      ? `Selected for requested effect ${entry.effects.find((effect) => desiredEffects.has(effect))}.`
      : `Selected from intent language matching ${entry.intent.trigger_terms.find((keyword) => intentTokens.has(keyword))}.`,
    execution_policy: entry.execution_policy,
  }));
  const supportingExampleIds = [...new Set(selected.flatMap((entry) => entry.evidence.example_ids))].sort(lexical);
  return basePlan('ready', request, [], steps, supportingExampleIds);
}
