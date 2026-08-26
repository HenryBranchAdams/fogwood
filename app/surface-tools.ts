import {
  Editor,
  TLArrowShape,
  TLFrameShape,
  TLGeoShape,
  TLNoteShape,
  TLShape,
  TLShapeId,
  TLShapePartial,
  TLTextShape,
  createShapeId,
  toRichText,
} from 'tldraw';
import {
  BLOCK_KINDS,
  BLOCK_TONES,
  SURFACE_BLOCK_TYPE,
  SurfaceBlockKind,
  SurfaceBlockProps,
  SurfaceBlockShape,
  SurfaceBlockTone,
} from './surface-block';

export type SurfaceBlockInput = {
  kind?: SurfaceBlockKind;
  tone?: SurfaceBlockTone;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  title?: string;
  body?: string;
  value?: string | number;
  items?: Array<{ label: string; checked?: boolean }>;
  columns?: string[];
  rows?: string[][];
  options?: string[];
  series?: Array<{ label: string; value: number }>;
  min?: number;
  max?: number;
  step?: number;
};

export type ToolConnection = {
  available: boolean;
  registered: number;
  failed: number;
};

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

type WebMcpTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: {
    readOnlyHint?: boolean;
    untrustedContentHint?: boolean;
  };
  execute: (input: unknown) => ToolResult | Promise<ToolResult>;
};

type ModelContext = {
  registerTool: (
    tool: WebMcpTool,
    options?: { signal?: AbortSignal },
  ) => Promise<void> | void;
};

const DEFAULT_SIZES: Record<SurfaceBlockKind, { w: number; h: number }> = {
  panel: { w: 330, h: 210 },
  heading: { w: 720, h: 130 },
  text: { w: 360, h: 180 },
  metric: { w: 230, h: 150 },
  checklist: { w: 380, h: 300 },
  table: { w: 560, h: 320 },
  input: { w: 340, h: 145 },
  select: { w: 340, h: 145 },
  slider: { w: 360, h: 150 },
  button: { w: 300, h: 150 },
  progress: { w: 350, h: 155 },
  chart: { w: 520, h: 320 },
};

const CANVAS_SHAPE_KINDS = [
  'rectangle',
  'ellipse',
  'diamond',
  'triangle',
  'cloud',
  'note',
  'text',
  'arrow',
  'frame',
] as const;

const CANVAS_COLORS = [
  'black',
  'grey',
  'violet',
  'blue',
  'light-blue',
  'yellow',
  'orange',
  'green',
  'light-green',
  'light-red',
  'red',
  'white',
] as const;

const CANVAS_FILLS = ['none', 'semi', 'solid', 'pattern'] as const;

type CanvasShapeKind = (typeof CANVAS_SHAPE_KINDS)[number];
type CanvasColor = (typeof CANVAS_COLORS)[number];
type CanvasFill = (typeof CANVAS_FILLS)[number];
type NativeCanvasShape =
  | TLArrowShape
  | TLFrameShape
  | TLGeoShape
  | TLNoteShape
  | TLTextShape;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clampNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}

function boundedText(value: unknown, max: number, fallback = '') {
  if (typeof value === 'string') return value.slice(0, max);
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value).slice(0, max);
  }
  return fallback;
}

function normalizeKind(value: unknown): SurfaceBlockKind {
  return typeof value === 'string' &&
    BLOCK_KINDS.includes(value as SurfaceBlockKind)
    ? (value as SurfaceBlockKind)
    : 'panel';
}

function normalizeTone(value: unknown): SurfaceBlockTone {
  return typeof value === 'string' &&
    BLOCK_TONES.includes(value as SurfaceBlockTone)
    ? (value as SurfaceBlockTone)
    : 'paper';
}

function normalizeCanvasKind(value: unknown): CanvasShapeKind {
  return typeof value === 'string' &&
    CANVAS_SHAPE_KINDS.includes(value as CanvasShapeKind)
    ? (value as CanvasShapeKind)
    : 'rectangle';
}

function normalizeCanvasColor(value: unknown): CanvasColor {
  return typeof value === 'string' && CANVAS_COLORS.includes(value as CanvasColor)
    ? (value as CanvasColor)
    : 'black';
}

function normalizeCanvasFill(value: unknown): CanvasFill {
  return typeof value === 'string' && CANVAS_FILLS.includes(value as CanvasFill)
    ? (value as CanvasFill)
    : 'semi';
}

function parseBlockData(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function safeTextList(value: unknown, limit: number) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .slice(0, limit)
        .map((item) => item.slice(0, 160))
    : [];
}

function makeBlockData(input: Record<string, unknown>) {
  const items = Array.isArray(input.items)
    ? input.items.slice(0, 20).flatMap((item) => {
        if (!isRecord(item) || typeof item.label !== 'string') return [];
        return [
          {
            label: item.label.slice(0, 240),
            checked: item.checked === true,
          },
        ];
      })
    : [];

  const columns = safeTextList(input.columns, 8);
  const rows = Array.isArray(input.rows)
    ? input.rows.slice(0, 12).map((row) => safeTextList(row, 8))
    : [];
  const options = safeTextList(input.options, 20);
  const series = Array.isArray(input.series)
    ? input.series.slice(0, 10).flatMap((item) => {
        if (
          !isRecord(item) ||
          typeof item.label !== 'string' ||
          typeof item.value !== 'number' ||
          !Number.isFinite(item.value)
        ) {
          return [];
        }
        return [
          {
            label: item.label.slice(0, 80),
            value: Math.max(-1_000_000_000, Math.min(1_000_000_000, item.value)),
          },
        ];
      })
    : [];

  return JSON.stringify({
    items,
    columns,
    rows,
    options,
    series,
    min: clampNumber(input.min, 0, -1_000_000, 1_000_000),
    max: clampNumber(input.max, 100, -1_000_000, 1_000_000),
    step: clampNumber(input.step, 1, 0.001, 100_000),
  });
}

function textResult(value: unknown, isError = false): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(value) }],
    ...(isError ? { isError: true } : {}),
  };
}

function positionFor(
  editor: Editor,
  input: Record<string, unknown>,
  index: number,
  coordinateSpace: 'viewport' | 'page',
) {
  const viewport = editor.getViewportPageBounds();
  const defaultX = 70 + (index % 3) * 370;
  const defaultY = 90 + Math.floor(index / 3) * 250;
  const rawX = clampNumber(input.x, defaultX, -100_000, 100_000);
  const rawY = clampNumber(input.y, defaultY, -100_000, 100_000);

  return coordinateSpace === 'viewport'
    ? { x: viewport.x + rawX, y: viewport.y + rawY }
    : { x: rawX, y: rawY };
}

export function addSurfaceBlocks(
  editor: Editor,
  inputs: unknown[],
  options: {
    coordinateSpace?: 'viewport' | 'page';
    focusAfter?: boolean;
  } = {},
) {
  const coordinateSpace = options.coordinateSpace ?? 'viewport';
  const records = inputs.filter(isRecord).slice(0, 48);
  if (records.length === 0) return [];

  editor.markHistoryStoppingPoint('Add interface blocks');
  const shapes: TLShapePartial<SurfaceBlockShape>[] = records.map(
    (input, index) => {
      const kind = normalizeKind(input.kind);
      const size = DEFAULT_SIZES[kind];
      const position = positionFor(editor, input, index, coordinateSpace);

      return {
        id: createShapeId(),
        type: SURFACE_BLOCK_TYPE,
        x: position.x,
        y: position.y,
        props: {
          w: clampNumber(input.w, size.w, 120, 1_400),
          h: clampNumber(input.h, size.h, 56, 1_000),
          kind,
          tone: normalizeTone(input.tone),
          title: boundedText(input.title, 180),
          body: boundedText(input.body, 2_000),
          value: boundedText(input.value, 500),
          data: makeBlockData(input),
        },
      };
    },
  );

  editor.createShapes<SurfaceBlockShape>(shapes);
  const ids = shapes.map((shape) => shape.id as TLShapeId);
  editor.select(...ids);
  if (options.focusAfter !== false) {
    editor.zoomToSelection({ animation: { duration: 320 } });
  }
  return ids;
}

function explicitCoordinate(
  editor: Editor,
  value: unknown,
  fallback: number,
  axis: 'x' | 'y',
  coordinateSpace: 'viewport' | 'page',
) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const bounded = Math.max(-100_000, Math.min(100_000, value));
  if (coordinateSpace === 'page') return bounded;
  const viewport = editor.getViewportPageBounds();
  return (axis === 'x' ? viewport.x : viewport.y) + bounded;
}

function addCanvasShapes(
  editor: Editor,
  inputs: unknown[],
  options: {
    coordinateSpace?: 'viewport' | 'page';
    focusAfter?: boolean;
  } = {},
) {
  const coordinateSpace = options.coordinateSpace ?? 'viewport';
  const records = inputs.filter(isRecord).slice(0, 64);
  if (records.length === 0) return [];

  const shapes: Array<TLShapePartial<NativeCanvasShape>> = [];

  records.forEach((input, index) => {
    const kind = normalizeCanvasKind(input.kind);
    const color = normalizeCanvasColor(input.color);
    const position = positionFor(editor, input, index, coordinateSpace);
    const text = boundedText(input.text, 2_000);
    const id = createShapeId();

    if (kind === 'arrow') {
      const endX = explicitCoordinate(
        editor,
        input.end_x,
        position.x + 240,
        'x',
        coordinateSpace,
      );
      const endY = explicitCoordinate(
        editor,
        input.end_y,
        position.y + 100,
        'y',
        coordinateSpace,
      );
      shapes.push({
        id,
        type: 'arrow',
        x: position.x,
        y: position.y,
        props: {
          color,
          labelColor: color,
          dash: 'solid',
          arrowheadStart: 'none',
          arrowheadEnd: 'arrow',
          start: { x: 0, y: 0 },
          end: { x: endX - position.x, y: endY - position.y },
          richText: toRichText(text),
        },
      });
      return;
    }

    if (kind === 'frame') {
      shapes.push({
        id,
        type: 'frame',
        x: position.x,
        y: position.y,
        props: {
          w: clampNumber(input.w, 720, 160, 2_000),
          h: clampNumber(input.h, 480, 120, 1_600),
          name: text || 'Frame',
          color,
        },
      });
      return;
    }

    if (kind === 'note') {
      shapes.push({
        id,
        type: 'note',
        x: position.x,
        y: position.y,
        props: {
          color: color === 'black' ? 'yellow' : color,
          labelColor: 'black',
          font: 'sans',
          richText: toRichText(text || 'Note'),
        },
      });
      return;
    }

    if (kind === 'text') {
      shapes.push({
        id,
        type: 'text',
        x: position.x,
        y: position.y,
        props: {
          w: clampNumber(input.w, 320, 40, 1_400),
          color,
          font: 'sans',
          autoSize: false,
          richText: toRichText(text || 'Text'),
        },
      });
      return;
    }

    shapes.push({
      id,
      type: 'geo',
      x: position.x,
      y: position.y,
      props: {
        geo: kind,
        w: clampNumber(input.w, 260, 40, 1_400),
        h: clampNumber(input.h, 160, 40, 1_000),
        color,
        labelColor: color,
        fill: normalizeCanvasFill(input.fill),
        dash: 'solid',
        font: 'sans',
        align: 'middle',
        verticalAlign: 'middle',
        richText: toRichText(text),
      },
    });
  });

  editor.markHistoryStoppingPoint('Add canvas shapes');
  editor.createShapes<NativeCanvasShape>(shapes);
  const ids = shapes.map((shape) => shape.id as TLShapeId);
  editor.select(...ids);
  if (options.focusAfter !== false) {
    editor.zoomToSelection({ animation: { duration: 320 } });
  }
  return ids;
}

function updateSurfaceBlocks(editor: Editor, rawUpdates: unknown[]) {
  const updates = rawUpdates.filter(isRecord).slice(0, 48);
  const shapeUpdates: Array<{
    id: SurfaceBlockShape['id'];
    type: typeof SURFACE_BLOCK_TYPE;
    x?: number;
    y?: number;
    props: Partial<SurfaceBlockProps>;
  }> = [];

  for (const input of updates) {
    if (typeof input.id !== 'string') continue;
    const shape = editor.getShape(input.id as TLShapeId);
    if (!shape || shape.type !== SURFACE_BLOCK_TYPE) continue;

    const props: Partial<SurfaceBlockProps> = {};
    if ('kind' in input) props.kind = normalizeKind(input.kind);
    if ('tone' in input) props.tone = normalizeTone(input.tone);
    if ('title' in input) props.title = boundedText(input.title, 180);
    if ('body' in input) props.body = boundedText(input.body, 2_000);
    if ('value' in input) props.value = boundedText(input.value, 500);
    if ('w' in input) props.w = clampNumber(input.w, shape.props.w, 120, 1_400);
    if ('h' in input) props.h = clampNumber(input.h, shape.props.h, 56, 1_000);
    if (
      ['items', 'columns', 'rows', 'options', 'series', 'min', 'max', 'step'].some(
        (key) => key in input,
      )
    ) {
      props.data = makeBlockData({
        ...parseBlockData(shape.props.data),
        ...input,
      });
    }

    const update: (typeof shapeUpdates)[number] = {
      id: shape.id,
      type: SURFACE_BLOCK_TYPE,
      props,
    };
    if ('x' in input) {
      update.x = clampNumber(input.x, shape.x, -100_000, 100_000);
    }
    if ('y' in input) {
      update.y = clampNumber(input.y, shape.y, -100_000, 100_000);
    }
    shapeUpdates.push(update);
  }

  if (shapeUpdates.length > 0) {
    editor.markHistoryStoppingPoint('Update interface blocks');
    editor.updateShapes<SurfaceBlockShape>(shapeUpdates);
  }
  return shapeUpdates.map((update) => update.id);
}

function placeCanvasItems(editor: Editor, rawPlacements: unknown[]) {
  const placements = rawPlacements.filter(isRecord).slice(0, 100);
  const updates: Array<TLShapePartial<TLShape>> = [];

  for (const input of placements) {
    if (typeof input.id !== 'string') continue;
    const shape = editor.getShape(input.id as TLShapeId);
    if (!shape) continue;
    updates.push({
      id: shape.id,
      type: shape.type,
      x: clampNumber(input.x, shape.x, -100_000, 100_000),
      y: clampNumber(input.y, shape.y, -100_000, 100_000),
      ...('rotation' in input
        ? { rotation: clampNumber(input.rotation, shape.rotation, -Math.PI * 4, Math.PI * 4) }
        : {}),
    });
  }

  if (updates.length > 0) {
    editor.markHistoryStoppingPoint('Place canvas items');
    editor.updateShapes(updates);
  }
  return updates.map((update) => update.id);
}

const blockSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    kind: {
      type: 'string',
      enum: BLOCK_KINDS,
      description: 'The safe, built-in interface primitive to render.',
    },
    tone: { type: 'string', enum: BLOCK_TONES },
    x: { type: 'number', description: 'Horizontal canvas coordinate or viewport offset.' },
    y: { type: 'number', description: 'Vertical canvas coordinate or viewport offset.' },
    w: { type: 'number', minimum: 120, maximum: 1400 },
    h: { type: 'number', minimum: 56, maximum: 1000 },
    title: { type: 'string', maxLength: 180 },
    body: { type: 'string', maxLength: 2000 },
    value: { type: ['string', 'number'] },
    items: {
      type: 'array',
      maxItems: 20,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          label: { type: 'string', maxLength: 240 },
          checked: { type: 'boolean' },
        },
        required: ['label'],
      },
    },
    columns: {
      type: 'array',
      maxItems: 8,
      items: { type: 'string', maxLength: 160 },
    },
    rows: {
      type: 'array',
      maxItems: 12,
      items: {
        type: 'array',
        maxItems: 8,
        items: { type: 'string', maxLength: 160 },
      },
    },
    options: {
      type: 'array',
      maxItems: 20,
      items: { type: 'string', maxLength: 160 },
    },
    series: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          label: { type: 'string', maxLength: 80 },
          value: { type: 'number' },
        },
        required: ['label', 'value'],
      },
    },
    min: { type: 'number' },
    max: { type: 'number' },
    step: { type: 'number', exclusiveMinimum: 0 },
  },
  required: ['kind'],
} as const;

const canvasShapeSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    kind: {
      type: 'string',
      enum: CANVAS_SHAPE_KINDS,
      description:
        'A native tldraw diagram primitive. Use blocks instead for interactive interface controls.',
    },
    x: { type: 'number', description: 'Start x coordinate or viewport offset.' },
    y: { type: 'number', description: 'Start y coordinate or viewport offset.' },
    end_x: {
      type: 'number',
      description: 'Arrow endpoint x coordinate or viewport offset. Used only for arrows.',
    },
    end_y: {
      type: 'number',
      description: 'Arrow endpoint y coordinate or viewport offset. Used only for arrows.',
    },
    w: { type: 'number', minimum: 40, maximum: 2000 },
    h: { type: 'number', minimum: 40, maximum: 1600 },
    text: { type: 'string', maxLength: 2000 },
    color: { type: 'string', enum: CANVAS_COLORS },
    fill: { type: 'string', enum: CANVAS_FILLS },
  },
  required: ['kind'],
} as const;

function getNativeShapeText(editor: Editor, shape: TLShape) {
  try {
    return (editor.getShapeUtil(shape).getText(shape) || '').slice(0, 500);
  } catch {
    return '';
  }
}

function inspectSurface(editor: Editor) {
  const viewport = editor.getViewportPageBounds();
  const shapes = editor.getCurrentPageShapesSorted();
  return {
    page_id: editor.getCurrentPageId(),
    viewport: { x: viewport.x, y: viewport.y, w: viewport.w, h: viewport.h },
    shape_count: shapes.length,
    supported_interface_blocks: BLOCK_KINDS,
    supported_canvas_shapes: CANVAS_SHAPE_KINDS,
    items: shapes.map((shape) => {
      if (shape.type !== SURFACE_BLOCK_TYPE) {
        const bounds = editor.getShapePageBounds(shape);
        return {
          id: shape.id,
          type: shape.type,
          x: Math.round(shape.x),
          y: Math.round(shape.y),
          w: bounds ? Math.round(bounds.w) : undefined,
          h: bounds ? Math.round(bounds.h) : undefined,
          text: getNativeShapeText(editor, shape),
        };
      }
      const block = shape as SurfaceBlockShape;
      return {
        id: block.id,
        type: block.type,
        kind: block.props.kind,
        tone: block.props.tone,
        x: Math.round(block.x),
        y: Math.round(block.y),
        w: Math.round(block.props.w),
        h: Math.round(block.props.h),
        title: block.props.title,
        body: block.props.body.slice(0, 500),
        value: block.props.value,
      };
    }),
  };
}

export function registerSurfaceTools(
  editor: Editor,
  onConnection: (connection: ToolConnection) => void,
  onActivity?: (title: string, detail?: string) => void,
) {
  const modelContext = (document as Document & { modelContext?: ModelContext })
    .modelContext;
  if (!modelContext) {
    onConnection({ available: false, registered: 0, failed: 0 });
    return () => undefined;
  }

  const controller = new AbortController();
  const tools: WebMcpTool[] = [
    {
      name: 'surface-inspect',
      title: 'Inspect Open Surface',
      description:
        'Read the current Open Surface page, viewport, item IDs, dimensions, positions, and plain-text content for both interface blocks and native tldraw shapes. This does not modify the canvas or make a network request.',
      inputSchema: { type: 'object', additionalProperties: false, properties: {} },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: () => {
        const surface = inspectSurface(editor);
        onActivity?.(
          'ChatGPT inspected the surface',
          `${surface.shape_count} canvas items read without changing them.`,
        );
        return textResult(surface);
      },
    },
    {
      name: 'surface-add-blocks',
      title: 'Add interface blocks',
      description:
        'Add up to 48 safe, built-in interface blocks to the current device-local tldraw page. Adds are grouped into one undo step. This never executes generated code or contacts an external service.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          coordinate_space: {
            type: 'string',
            enum: ['viewport', 'page'],
            description:
              'Use viewport for x/y offsets from the visible top-left; use page for absolute canvas coordinates.',
          },
          focus_after: { type: 'boolean' },
          blocks: { type: 'array', minItems: 1, maxItems: 48, items: blockSchema },
        },
        required: ['blocks'],
      },
      execute: (input) => {
        if (!isRecord(input) || !Array.isArray(input.blocks)) {
          return textResult({ error: 'blocks must be an array' }, true);
        }
        const coordinateSpace = input.coordinate_space === 'page' ? 'page' : 'viewport';
        const ids = addSurfaceBlocks(editor, input.blocks, {
          coordinateSpace,
          focusAfter: input.focus_after !== false,
        });
        onActivity?.(
          'ChatGPT added interface blocks',
          `${ids.length} blocks added in one undoable step.`,
        );
        return textResult({ added: ids.length, ids, undoable: true });
      },
    },
    {
      name: 'surface-add-canvas-shapes',
      title: 'Add canvas shapes',
      description:
        'Add up to 64 native tldraw diagram primitives such as text, notes, frames, geometric shapes, and arrows. Use this for diagrams and spatial thinking; use surface-add-blocks for interactive UI. Adds are device-local, grouped into one undo step, and never execute generated code.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          coordinate_space: {
            type: 'string',
            enum: ['viewport', 'page'],
            description:
              'Use viewport for coordinates relative to the visible top-left; use page for absolute canvas coordinates.',
          },
          focus_after: { type: 'boolean' },
          shapes: {
            type: 'array',
            minItems: 1,
            maxItems: 64,
            items: canvasShapeSchema,
          },
        },
        required: ['shapes'],
      },
      execute: (input) => {
        if (!isRecord(input) || !Array.isArray(input.shapes)) {
          return textResult({ error: 'shapes must be an array' }, true);
        }
        const coordinateSpace = input.coordinate_space === 'page' ? 'page' : 'viewport';
        const ids = addCanvasShapes(editor, input.shapes, {
          coordinateSpace,
          focusAfter: input.focus_after !== false,
        });
        onActivity?.(
          'ChatGPT added canvas shapes',
          `${ids.length} tldraw shapes added in one undoable step.`,
        );
        return textResult({ added: ids.length, ids, undoable: true });
      },
    },
    {
      name: 'surface-update-blocks',
      title: 'Update interface blocks',
      description:
        'Update existing Open Surface interface blocks by exact ID, including their content, live control data, size, tone, or absolute page x/y position. Only provided fields change. Updates are local and grouped into one undo step.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          updates: {
            type: 'array',
            minItems: 1,
            maxItems: 48,
            items: {
              ...blockSchema,
              required: ['id'],
              properties: {
                ...blockSchema.properties,
                id: { type: 'string', description: 'Exact shape ID from surface-inspect.' },
              },
            },
          },
        },
        required: ['updates'],
      },
      execute: (input) => {
        if (!isRecord(input) || !Array.isArray(input.updates)) {
          return textResult({ error: 'updates must be an array' }, true);
        }
        const ids = updateSurfaceBlocks(editor, input.updates);
        onActivity?.(
          'ChatGPT updated interface blocks',
          `${ids.length} blocks changed in one undoable step.`,
        );
        return textResult({ updated: ids.length, ids, undoable: true });
      },
    },
    {
      name: 'surface-place-items',
      title: 'Place canvas items',
      description:
        'Move or rotate existing interface blocks and native tldraw shapes by exact ID using absolute page coordinates. Only placement changes; content is preserved. Changes are local and grouped into one undo step.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          placements: {
            type: 'array',
            minItems: 1,
            maxItems: 100,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string', description: 'Exact item ID from surface-inspect.' },
                x: { type: 'number', description: 'Absolute page x coordinate.' },
                y: { type: 'number', description: 'Absolute page y coordinate.' },
                rotation: {
                  type: 'number',
                  description: 'Optional rotation in radians.',
                },
              },
              required: ['id', 'x', 'y'],
            },
          },
        },
        required: ['placements'],
      },
      execute: (input) => {
        if (!isRecord(input) || !Array.isArray(input.placements)) {
          return textResult({ error: 'placements must be an array' }, true);
        }
        const ids = placeCanvasItems(editor, input.placements);
        onActivity?.(
          'ChatGPT arranged canvas items',
          `${ids.length} items placed in one undoable step.`,
        );
        return textResult({ placed: ids.length, ids, undoable: true });
      },
    },
    {
      name: 'surface-remove-items',
      title: 'Remove canvas items',
      description:
        'Delete specified items from the current device-local canvas by exact ID. Use only when the user asks to remove them. The deletion is grouped into one undo step.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ids: {
            type: 'array',
            minItems: 1,
            maxItems: 100,
            items: { type: 'string' },
          },
        },
        required: ['ids'],
      },
      execute: (input) => {
        if (!isRecord(input) || !Array.isArray(input.ids)) {
          return textResult({ error: 'ids must be an array' }, true);
        }
        const ids = input.ids
          .filter((id): id is string => typeof id === 'string')
          .map((id) => id as TLShapeId)
          .filter((id) => Boolean(editor.getShape(id)))
          .slice(0, 100);
        if (ids.length > 0) {
          editor.markHistoryStoppingPoint('Remove canvas items');
          editor.deleteShapes(ids);
        }
        onActivity?.(
          'ChatGPT removed canvas items',
          `${ids.length} items removed in one undoable step.`,
        );
        return textResult({ removed: ids.length, ids, undoable: true });
      },
    },
    {
      name: 'surface-focus',
      title: 'Focus the canvas view',
      description:
        'Move only the local canvas camera to show all content or specified item IDs. This does not change or delete content.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ids: {
            type: 'array',
            maxItems: 100,
            items: { type: 'string' },
          },
        },
      },
      execute: (input) => {
        const ids = isRecord(input) && Array.isArray(input.ids)
          ? input.ids
              .filter((id): id is string => typeof id === 'string')
              .map((id) => id as TLShapeId)
              .filter((id) => Boolean(editor.getShape(id)))
          : [];
        if (ids.length > 0) {
          editor.select(...ids);
          editor.zoomToSelection({ animation: { duration: 320 } });
        } else {
          editor.zoomToFit({ animation: { duration: 320 } });
        }
        onActivity?.(
          'ChatGPT focused the canvas',
          ids.length > 0 ? `${ids.length} items brought into view.` : 'All content brought into view.',
        );
        return textResult({ focused: ids.length > 0 ? ids : 'all' });
      },
    },
    {
      name: 'surface-clear',
      title: 'Clear the surface',
      description:
        'Delete every item on the current device-local page. Call only after the user explicitly asks to clear the whole surface. Requires the exact confirmation phrase and remains undoable.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          confirmation: {
            type: 'string',
            enum: ['clear the surface'],
            description:
              'Use this exact phrase only after the user explicitly asked to clear the entire surface.',
          },
        },
        required: ['confirmation'],
      },
      execute: (input) => {
        if (!isRecord(input) || input.confirmation !== 'clear the surface') {
          return textResult({ error: 'Exact confirmation phrase required.' }, true);
        }
        const ids = editor.getCurrentPageShapes().map((shape) => shape.id);
        if (ids.length > 0) {
          editor.markHistoryStoppingPoint('Clear surface');
          editor.deleteShapes(ids);
        }
        onActivity?.(
          'ChatGPT cleared the surface',
          `${ids.length} items removed. Undo remains available.`,
        );
        return textResult({ cleared: ids.length, undoable: true });
      },
    },
  ];

  onConnection({ available: true, registered: 0, failed: 0 });
  Promise.allSettled(
    tools.map((tool) =>
      Promise.resolve(modelContext.registerTool(tool, { signal: controller.signal })),
    ),
  ).then((results) => {
    if (controller.signal.aborted) return;
    const registered = results.filter((result) => result.status === 'fulfilled').length;
    onConnection({
      available: true,
      registered,
      failed: results.length - registered,
    });
  });

  return () => controller.abort();
}

export type RecipeName = 'cockpit' | 'week' | 'decision';

export function buildRecipe(editor: Editor, recipe: RecipeName) {
  const recipes: Record<RecipeName, SurfaceBlockInput[]> = {
    cockpit: [
      {
        kind: 'heading',
        tone: 'paper',
        x: 0,
        y: 0,
        w: 980,
        h: 125,
        value: 'Live workspace',
        title: 'Project cockpit',
        body: 'A composed surface for the work that matters now.',
      },
      { kind: 'metric', tone: 'ink', x: 0, y: 155, title: 'Open work', value: '12', body: '3 need attention' },
      { kind: 'metric', tone: 'accent', x: 255, y: 155, title: 'Momentum', value: '+18%', body: 'This week' },
      { kind: 'metric', tone: 'blue', x: 510, y: 155, title: 'Next gate', value: 'Friday', body: 'Owner review' },
      { kind: 'progress', tone: 'paper', x: 765, y: 155, w: 300, title: 'Release readiness', value: 68, body: 'Evidence gathered' },
      {
        kind: 'checklist',
        tone: 'paper',
        x: 0,
        y: 345,
        w: 410,
        h: 330,
        title: 'Today',
        body: 'Click an item to update the canvas state.',
        items: [
          { label: 'Resolve the product question', checked: true },
          { label: 'Review the live evidence' },
          { label: 'Prepare the decision brief' },
          { label: 'Ask for the owner gate' },
        ],
      },
      {
        kind: 'chart',
        tone: 'paper',
        x: 445,
        y: 345,
        w: 620,
        h: 330,
        title: 'Work by stage',
        body: 'An agent can replace these values without replacing the interface.',
        series: [
          { label: 'Explore', value: 9 },
          { label: 'Build', value: 14 },
          { label: 'Review', value: 6 },
          { label: 'Ready', value: 3 },
        ],
      },
    ],
    week: [
      { kind: 'heading', tone: 'paper', x: 0, y: 0, w: 980, value: 'Personal surface', title: 'A week with room to think', body: 'Plans, constraints, and notes in one movable place.' },
      {
        kind: 'checklist',
        tone: 'yellow',
        x: 0,
        y: 155,
        w: 370,
        h: 360,
        title: 'Commitments',
        items: [
          { label: 'Deep work block', checked: true },
          { label: 'Prepare Wednesday review' },
          { label: 'Call family' },
          { label: 'Long run' },
        ],
      },
      { kind: 'input', tone: 'paper', x: 405, y: 155, title: 'What would make this week count?', body: 'This field is live and saved in the canvas.', value: '' },
      { kind: 'slider', tone: 'green', x: 405, y: 330, title: 'Available energy', body: 'Adjust directly.', value: 72, min: 0, max: 100, step: 1 },
      { kind: 'text', tone: 'ink', x: 800, y: 155, w: 300, h: 325, title: 'Boundary', body: 'Leave enough blank space for the week to change.' },
    ],
    decision: [
      { kind: 'heading', tone: 'paper', x: 0, y: 0, w: 1040, value: 'Decision surface', title: 'Compare without flattening', body: 'Keep the criteria visible, then make the call yourself.' },
      { kind: 'panel', tone: 'blue', x: 0, y: 155, w: 380, h: 250, value: 'Option A', title: 'Move now', body: 'Faster learning, higher near-term disruption.' },
      { kind: 'panel', tone: 'green', x: 410, y: 155, w: 380, h: 250, value: 'Option B', title: 'Wait one cycle', body: 'More evidence, with a real cost of delay.' },
      { kind: 'slider', tone: 'paper', x: 820, y: 155, w: 320, title: 'Confidence', body: 'How certain are we?', value: 58, min: 0, max: 100 },
      {
        kind: 'table',
        tone: 'paper',
        x: 0,
        y: 440,
        w: 790,
        h: 280,
        title: 'Evidence, not vibes',
        columns: ['Criterion', 'Move now', 'Wait'],
        rows: [
          ['Learning speed', 'High', 'Medium'],
          ['Reversibility', 'Medium', 'High'],
          ['Cost of delay', 'High', 'Low'],
        ],
      },
      { kind: 'button', tone: 'accent', x: 820, y: 440, w: 320, h: 180, title: 'Mark ready for review', body: 'A local, reversible interaction. It does not make the decision.' },
    ],
  };

  return addSurfaceBlocks(editor, recipes[recipe], {
    coordinateSpace: 'viewport',
    focusAfter: true,
  });
}
