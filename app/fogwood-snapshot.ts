import type { Editor, TLAssetId } from 'tldraw';

export const FOGWOOD_SNAPSHOT_FORMAT = 'image/svg+xml' as const;
export const DEFAULT_SNAPSHOT_MAX_BYTES = 16 * 1024 * 1024;
export const DEFAULT_SNAPSHOT_MAX_SHAPES = 2_048;

export type SnapshotExportErrorCode =
  | 'EMPTY_PAGE'
  | 'TOO_MANY_SHAPES'
  | 'INVALID_REVISION'
  | 'INVALID_LIMIT'
  | 'STALE_PAGE'
  | 'EXTERNAL_ASSET'
  | 'EXPORT_FAILED'
  | 'INVALID_ARTIFACT'
  | 'ARTIFACT_TOO_LARGE'
  | 'HASH_UNAVAILABLE'
  | 'HASH_FAILED'
  | 'DOWNLOAD_UNAVAILABLE';

export class SnapshotExportError extends Error {
  readonly code: SnapshotExportErrorCode;

  constructor(code: SnapshotExportErrorCode, message: string) {
    super(message);
    this.name = 'SnapshotExportError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

type Digest = (algorithm: 'SHA-256', data: ArrayBuffer) => Promise<ArrayBuffer>;

export type FogwoodSnapshotOptions = {
  get_revision: () => string;
  max_bytes?: number;
  max_shapes?: number;
  now?: () => Date;
  digest?: Digest;
  crypto?: Pick<Crypto, 'subtle'>;
};

export type FogwoodSnapshot = Readonly<{
  blob: Blob;
  file_name: string;
  source_revision: string;
  artifact: Readonly<{
    format: typeof FOGWOOD_SNAPSHOT_FORMAT;
    hash: string;
  }>;
  size_bytes: number;
  shape_count: number;
  width: number;
  height: number;
}>;

type SnapshotEditor = Pick<Editor, 'getCurrentPageShapeIds' | 'getCurrentPageShapes' | 'getAsset' | 'getSvgString'>;

function positiveInteger(value: unknown, fallback: number) {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new SnapshotExportError('INVALID_LIMIT', 'Snapshot bounds must be positive safe integers.');
  }
  return value;
}

function artifactFileName(now: Date) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new SnapshotExportError('EXPORT_FAILED', 'Snapshot clock returned an invalid date.');
  }
  return `fogwood-snapshot-${now.toISOString().replace(/[.:]/g, '-')}.svg`;
}

function hexadecimal(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function digestFor(options: FogwoodSnapshotOptions): Digest {
  if (options.digest) return options.digest;
  const provider = Object.prototype.hasOwnProperty.call(options, 'crypto')
    ? options.crypto
    : globalThis.crypto;
  if (!provider?.subtle) {
    throw new SnapshotExportError('HASH_UNAVAILABLE', 'SHA-256 is unavailable in this browser. No snapshot was downloaded.');
  }
  return (algorithm, data) => provider.subtle.digest(algorithm, data) as Promise<ArrayBuffer>;
}

function codeUnitCompare(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function externalReference(value: unknown, depth = 0, entries = { count: 0 }, key?: string): boolean {
  if (depth > 8 || entries.count > 512) return true;
  entries.count += 1;
  if (typeof value === 'string') {
    if (key === 'src' || key === 'url' || key === 'href') return value.length > 0 && !value.startsWith('data:');
    return /^(?:https?:|blob:|\/\/)/i.test(value);
  }
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some((child) => externalReference(child, depth + 1, entries));
  return Object.entries(value).some(([childKey, child]) => externalReference(child, depth + 1, entries, childKey));
}

function assertNoExternalAssets(editor: SnapshotEditor) {
  for (const shape of editor.getCurrentPageShapes()) {
    const props = shape.props as Record<string, unknown>;
    if (externalReference(props)) {
      throw new SnapshotExportError('EXTERNAL_ASSET', 'Snapshot export refuses current-page content that could resolve an external URL.');
    }
    const assetId = props.assetId;
    if (typeof assetId !== 'string') continue;
    const asset = editor.getAsset(assetId as TLAssetId);
    if (!asset || externalReference(asset.props)) {
      throw new SnapshotExportError('EXTERNAL_ASSET', 'Snapshot export requires referenced assets to be embedded data only.');
    }
    const source = (asset.props as Record<string, unknown>).src;
    if (typeof source === 'string' && source.length > 0 && !source.startsWith('data:')) {
      throw new SnapshotExportError('EXTERNAL_ASSET', 'Snapshot export requires referenced assets to be embedded data only.');
    }
  }
}

/**
 * Render and hash a bounded current-page SVG. This function never downloads,
 * uploads, stores, or appends a receipt; those remain explicit caller actions.
 */
export async function createFogwoodSnapshot(
  editor: SnapshotEditor,
  sourceRevision: string,
  options: FogwoodSnapshotOptions,
): Promise<FogwoodSnapshot> {
  if (typeof sourceRevision !== 'string' || sourceRevision.length < 1 || sourceRevision.length > 180) {
    throw new SnapshotExportError('INVALID_REVISION', 'Snapshot export requires the exact bounded current-page revision.');
  }
  const maxBytes = positiveInteger(options.max_bytes, DEFAULT_SNAPSHOT_MAX_BYTES);
  const maxShapes = positiveInteger(options.max_shapes, DEFAULT_SNAPSHOT_MAX_SHAPES);
  if (typeof options.get_revision !== 'function' || options.get_revision() !== sourceRevision) {
    throw new SnapshotExportError('STALE_PAGE', 'The current page no longer matches the requested snapshot revision.');
  }
  const ids = [...editor.getCurrentPageShapeIds()].sort((left, right) => codeUnitCompare(String(left), String(right)));
  if (ids.length === 0) throw new SnapshotExportError('EMPTY_PAGE', 'There is no current-page content to export.');
  if (ids.length > maxShapes) throw new SnapshotExportError('TOO_MANY_SHAPES', 'The current page exceeds the bounded snapshot shape limit.');
  assertNoExternalAssets(editor);

  let rendered: Awaited<ReturnType<SnapshotEditor['getSvgString']>>;
  try {
    rendered = await editor.getSvgString(ids, {
      background: true,
      padding: 'auto',
    });
  } catch (error) {
    if (error instanceof SnapshotExportError) throw error;
    throw new SnapshotExportError('EXPORT_FAILED', 'Fogwood could not render the local SVG snapshot.');
  }
  if (
    !rendered ||
    typeof rendered.svg !== 'string' ||
    !Number.isFinite(rendered.width) ||
    !Number.isFinite(rendered.height) ||
    rendered.width <= 0 ||
    rendered.height <= 0
  ) {
    throw new SnapshotExportError('INVALID_ARTIFACT', 'The rendered snapshot artifact is incomplete.');
  }
  if (options.get_revision() !== sourceRevision) {
    throw new SnapshotExportError('STALE_PAGE', 'The page changed while Fogwood rendered the snapshot. No artifact was downloaded.');
  }
  const bytes = new TextEncoder().encode(rendered.svg);
  if (bytes.byteLength > maxBytes) {
    throw new SnapshotExportError('ARTIFACT_TOO_LARGE', 'The rendered snapshot exceeds the local artifact byte limit.');
  }

  const digest = digestFor(options);
  let hash: string;
  try {
    const exactBytes = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const result = await digest('SHA-256', exactBytes);
    if (!(result instanceof ArrayBuffer) || result.byteLength !== 32) {
      throw new SnapshotExportError('HASH_FAILED', 'SHA-256 returned an invalid digest.');
    }
    hash = `sha256:${hexadecimal(result)}`;
  } catch (error) {
    if (error instanceof SnapshotExportError) throw error;
    throw new SnapshotExportError('HASH_FAILED', 'Fogwood could not hash the local snapshot artifact.');
  }

  const blob = new Blob([bytes], { type: FOGWOOD_SNAPSHOT_FORMAT });
  return Object.freeze({
    blob,
    file_name: artifactFileName((options.now ?? (() => new Date()))()),
    source_revision: sourceRevision,
    artifact: Object.freeze({ format: FOGWOOD_SNAPSHOT_FORMAT, hash }),
    size_bytes: bytes.byteLength,
    shape_count: ids.length,
    width: rendered.width,
    height: rendered.height,
  });
}

type DownloadLink = { href: string; download: string; rel: string; click: () => void };
type DownloadDocument = { createElement: (tag: 'a') => DownloadLink };
type DownloadUrl = { createObjectURL: (blob: Blob) => string; revokeObjectURL: (url: string) => void };

/** Perform the separate, human-triggered local download step. */
export function downloadFogwoodSnapshot(
  snapshot: Pick<FogwoodSnapshot, 'blob' | 'file_name'>,
  dependencies: { document?: DownloadDocument; url?: DownloadUrl } = {},
) {
  const ownerDocument = dependencies.document ?? (globalThis.document as unknown as DownloadDocument | undefined);
  const urlApi = dependencies.url ?? (globalThis.URL as unknown as DownloadUrl | undefined);
  if (!ownerDocument || !urlApi?.createObjectURL || !urlApi?.revokeObjectURL) {
    throw new SnapshotExportError('DOWNLOAD_UNAVAILABLE', 'Local file download is unavailable in this browser.');
  }
  const link = ownerDocument.createElement('a');
  const objectUrl = urlApi.createObjectURL(snapshot.blob);
  try {
    link.href = objectUrl;
    link.download = snapshot.file_name;
    link.rel = 'noopener';
    link.click();
  } finally {
    urlApi.revokeObjectURL(objectUrl);
  }
}
