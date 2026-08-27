'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  BAZAAR_CATALOG_REVISION,
  readBazaar,
  searchBazaar,
  type BazaarReadSuccess,
  type BazaarSearchSummary,
} from './fogwood-bazaar';

type BazaarPanelProps = {
  open: boolean;
  canStage: boolean;
  onClose: () => void;
  onStage: (recipeId: string, packageSummary: BazaarSearchSummary) => void;
};

type JsonRecord = Record<string, unknown>;
type SectionEntry = { path: string; content: unknown };

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function jsonText(value: unknown) {
  try {
    return JSON.stringify(value, null, 2) ?? 'Unavailable';
  } catch {
    return 'Unavailable';
  }
}

function sectionEntries(value: unknown): SectionEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.path !== 'string' || !('content' in entry)) return [];
    return [{ path: entry.path, content: entry.content }];
  });
}

function packageRecipeId(packageSummary: BazaarSearchSummary, read: BazaarReadSuccess | null) {
  const recipes = sectionEntries(read?.sections.recipes);
  const exact = recipes.find((entry) => {
    if (!isRecord(entry.content)) return false;
    return entry.content.id === packageSummary.recipe_ids[0] && entry.content.version === packageSummary.version;
  });
  if (exact && isRecord(exact.content) && typeof exact.content.id === 'string') return exact.content.id;
  return packageSummary.recipe_ids[0] ?? '';
}

function packageQualification(packageSummary: BazaarSearchSummary, read: BazaarReadSuccess | null) {
  const manifest = isRecord(read?.sections.manifest) ? read.sections.manifest : null;
  return manifest?.qualification ?? packageSummary.qualification;
}

function packageNetwork(packageSummary: BazaarSearchSummary, read: BazaarReadSuccess | null) {
  const manifest = isRecord(read?.sections.manifest) ? read.sections.manifest : null;
  return manifest?.network ?? packageSummary.network;
}

function BazaarPackageCard({
  packageSummary,
  selected,
  canStage,
  onSelect,
  onStage,
}: {
  packageSummary: BazaarSearchSummary;
  selected: boolean;
  canStage: boolean;
  onSelect: () => void;
  onStage: () => void;
}) {
  return (
    <article className={`bazaar-card ${selected ? 'is-selected' : ''}`}>
      <button
        type="button"
        className="bazaar-card-select"
        aria-pressed={selected}
        onClick={onSelect}
      >
        <span className="bazaar-card-kind">{packageSummary.kind} · local</span>
        <span className="bazaar-card-title">{packageSummary.title}</span>
        <span className="bazaar-card-summary">{packageSummary.summary}</span>
      </button>
      <div className="bazaar-card-footer">
        <span>v{packageSummary.version}</span>
        <button
          type="button"
          className="bazaar-stage-button"
          disabled={!canStage || packageSummary.recipe_ids.length === 0}
          onClick={onStage}
          title={canStage ? 'Stage this exact recipe for page review' : 'The canvas is still connecting'}
        >
          Add to board
        </button>
      </div>
    </article>
  );
}

function ExactPreview({
  packageSummary,
  read,
}: {
  packageSummary: BazaarSearchSummary;
  read: BazaarReadSuccess | null;
}) {
  if (!read) return null;

  const manifest = isRecord(read.sections.manifest) ? read.sections.manifest : null;
  const prompts = sectionEntries(read.sections.prompts);
  const examples = sectionEntries(read.sections.examples);
  const recipes = sectionEntries(read.sections.recipes);
  const recipeId = packageRecipeId(packageSummary, read);
  const recipe = recipes.find((entry) => isRecord(entry.content) && entry.content.id === recipeId)?.content;
  const qualification = packageQualification(packageSummary, read);
  const network = packageNetwork(packageSummary, read);
  const useWhen = typeof manifest?.use_when === 'string' ? manifest.use_when : packageSummary.use_when;
  const notFor = typeof manifest?.not_for === 'string' ? manifest.not_for : packageSummary.not_for;

  return (
    <section className="bazaar-preview" aria-label={`Exact preview for ${packageSummary.title}`}>
      <div className="bazaar-preview-heading">
        <div>
          <span className="bazaar-section-label">Read-only exact preview</span>
          <h3>{packageSummary.title}</h3>
        </div>
        <span className="bazaar-preview-status">Pinned</span>
      </div>

      <dl className="bazaar-identity-grid">
        <div>
          <dt>ID</dt>
          <dd><code>{read.id}</code></dd>
        </div>
        <div>
          <dt>Version</dt>
          <dd>{read.version}</dd>
        </div>
        <div className="bazaar-identity-wide">
          <dt>Full content hash</dt>
          <dd><code className="bazaar-full-hash">{read.content_hash}</code></dd>
        </div>
        <div>
          <dt>Locality</dt>
          <dd>{packageSummary.locality}</dd>
        </div>
      </dl>

      <div className="bazaar-copy-pair">
        <div>
          <h4>Use when</h4>
          <p>{useWhen}</p>
        </div>
        <div>
          <h4>Not for</h4>
          <p>{notFor}</p>
        </div>
      </div>

      <details className="bazaar-detail-block" open>
        <summary>Qualification</summary>
        <pre>{jsonText(qualification)}</pre>
      </details>
      <details className="bazaar-detail-block" open>
        <summary>Network boundary</summary>
        <pre>{jsonText(network)}</pre>
      </details>
      <details className="bazaar-detail-block" open>
        <summary>Prompts ({prompts.length})</summary>
        {prompts.length > 0 ? prompts.map((entry) => (
          <div className="bazaar-source-entry" key={entry.path}>
            <strong>{entry.path}</strong>
            <pre>{typeof entry.content === 'string' ? entry.content : jsonText(entry.content)}</pre>
          </div>
        )) : <p className="bazaar-empty-detail">No prompt assets in this package.</p>}
      </details>
      <details className="bazaar-detail-block" open>
        <summary>Examples ({examples.length})</summary>
        {examples.length > 0 ? examples.map((entry) => (
          <div className="bazaar-source-entry" key={entry.path}>
            <strong>{entry.path}</strong>
            <pre>{jsonText(entry.content)}</pre>
          </div>
        )) : <p className="bazaar-empty-detail">No examples in this package.</p>}
      </details>
      <details className="bazaar-detail-block" open>
        <summary>Recipe identity</summary>
        <dl className="bazaar-recipe-identity">
          <div><dt>ID</dt><dd><code>{recipeId || 'No recipe identity'}</code></dd></div>
          <div><dt>Version</dt><dd>{packageSummary.version}</dd></div>
          <div><dt>Package</dt><dd><code>{packageSummary.id}</code></dd></div>
        </dl>
        {recipe !== undefined && <pre>{jsonText(recipe)}</pre>}
      </details>

      <p className="bazaar-read-note">
        Catalog revision <code>{read.catalog_revision}</code>. Reading this package does not change the page.
      </p>
    </section>
  );
}

export default function BazaarPanel({ open, canStage, onClose, onStage }: BazaarPanelProps) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const searchResult = useMemo(
    () => searchBazaar({
      query: deferredQuery.slice(0, 120),
      locality: 'local',
      limit: 4,
      catalog_revision: BAZAAR_CATALOG_REVISION,
    }),
    [deferredQuery],
  );
  const results = searchResult.ok ? searchResult.results : [];
  const [selectedId, setSelectedId] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
  }, [open]);

  const selectedPackage = results.find((result) => result.id === selectedId) ?? results[0] ?? null;
  const readResult = useMemo(() => {
    if (!selectedPackage) return null;
    return readBazaar({
      id: selectedPackage.id,
      version: selectedPackage.version,
      content_hash: selectedPackage.content_hash,
      catalog_revision: BAZAAR_CATALOG_REVISION,
      include: ['manifest', 'prompts', 'examples', 'recipes'],
    });
  }, [selectedPackage]);
  const read = readResult?.ok ? readResult : null;
  const isSearching = query !== deferredQuery;

  if (!open) return null;

  return (
    <aside id="fogwood-bazaar-panel" className="bazaar-panel" aria-label="Fogwood Bazaar">
      <header className="bazaar-panel-header">
        <div>
          <span className="bazaar-section-label">Local catalog · read only</span>
          <h2>Fogwood Bazaar</h2>
          <p>Discover exact packages before you stage a reviewable board proposal.</p>
        </div>
        <button type="button" className="bazaar-close" aria-label="Close Fogwood Bazaar" onClick={onClose}>×</button>
      </header>

      <div className="bazaar-search-wrap">
        <label htmlFor="bazaar-search">Search the local Bazaar</label>
        <div className="bazaar-search-field">
          <span aria-hidden="true">⌕</span>
          <input
            ref={searchRef}
            id="bazaar-search"
            type="search"
            value={query}
            maxLength={120}
            placeholder="Try compare, meeting, evidence…"
            onChange={(event) => setQuery(event.currentTarget.value.slice(0, 120))}
          />
          {query && <button type="button" aria-label="Clear Bazaar search" onClick={() => setQuery('')}>×</button>}
        </div>
        <p className="bazaar-search-meta" aria-live="polite">
          {isSearching ? 'Updating local results…' : `${results.length} package${results.length === 1 ? '' : 's'} in this view`}
        </p>
      </div>

      <div className="bazaar-panel-scroll">
        <section className="bazaar-card-list" aria-label="Local Bazaar packages">
          {!searchResult.ok && <p className="bazaar-error" role="alert">Bazaar search failed: {searchResult.message}</p>}
          {searchResult.ok && results.length === 0 && <p className="bazaar-empty-detail">No local packages match that search. Try a shorter phrase.</p>}
          {results.map((packageSummary) => (
            <BazaarPackageCard
              key={`${packageSummary.id}@${packageSummary.version}`}
              packageSummary={packageSummary}
              selected={packageSummary.id === selectedId}
              canStage={canStage}
              onSelect={() => setSelectedId(packageSummary.id)}
              onStage={() => onStage(packageSummary.recipe_ids[0] ?? '', packageSummary)}
            />
          ))}
        </section>

        {selectedPackage && (
          <>
            {!readResult?.ok && readResult && <p className="bazaar-error" role="alert">Exact package read failed: {readResult.message}</p>}
            <ExactPreview packageSummary={selectedPackage} read={read} />
          </>
        )}
      </div>
    </aside>
  );
}
