import {
  BaseBoxShapeUtil,
  Editor,
  HTMLContainer,
  T,
  TLShape,
  stopEventPropagation,
} from 'tldraw';
import { BLOCK_KINDS, BLOCK_TONES } from './fogwood-runtime';

declare module 'tldraw' {
  interface TLGlobalShapePropsMap {
    'surface-block': SurfaceBlockProps;
  }
}

export const SURFACE_BLOCK_TYPE = 'surface-block' as const;

export { BLOCK_KINDS, BLOCK_TONES } from './fogwood-runtime';

export type SurfaceBlockKind = (typeof BLOCK_KINDS)[number];
export type SurfaceBlockTone = (typeof BLOCK_TONES)[number];

export type SurfaceBlockProps = {
  w: number;
  h: number;
  kind: SurfaceBlockKind;
  tone: SurfaceBlockTone;
  title: string;
  body: string;
  value: string;
  data: string;
};

export type SurfaceBlockShape = TLShape<typeof SURFACE_BLOCK_TYPE>;

type ChecklistItem = { label: string; checked: boolean };
type SeriesItem = { label: string; value: number };

function parseData(data: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(data);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function textList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function checklistItems(value: unknown): ChecklistItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    if (typeof record.label !== 'string') return [];
    return [{ label: record.label, checked: record.checked === true }];
  });
}

function seriesItems(value: unknown): SeriesItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    if (typeof record.label !== 'string' || typeof record.value !== 'number') {
      return [];
    }
    return [{ label: record.label, value: record.value }];
  });
}

function updateProps(
  editor: Editor,
  shape: SurfaceBlockShape,
  props: Partial<SurfaceBlockProps>,
) {
  editor.updateShape<SurfaceBlockShape>({
    id: shape.id,
    type: SURFACE_BLOCK_TYPE,
    props,
  });
}

function SurfaceBlockView({
  editor,
  shape,
}: {
  editor: Editor;
  shape: SurfaceBlockShape;
}) {
  const { kind, title, body, value, data, tone } = shape.props;
  const parsed = parseData(data);

  function toggleChecklistItem(index: number) {
    const items = checklistItems(parsed.items);
    const next = items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, checked: !item.checked } : item,
    );
    updateProps(editor, shape, {
      data: JSON.stringify({ ...parsed, items: next }),
    });
  }

  let content: React.ReactNode;

  switch (kind) {
    case 'heading':
      content = (
        <div className="block-heading-content">
          <span className="block-kicker">{value || 'Surface'}</span>
          <h2>{title || 'Untitled surface'}</h2>
          {body && <p>{body}</p>}
        </div>
      );
      break;

    case 'text':
      content = (
        <div className="block-text-content">
          {title && <h3>{title}</h3>}
          <p>{body || 'Add text here.'}</p>
        </div>
      );
      break;

    case 'metric':
      content = (
        <div className="block-metric-content">
          <span className="block-label">{title || 'Metric'}</span>
          <strong>{value || '—'}</strong>
          {body && <span className="block-detail">{body}</span>}
        </div>
      );
      break;

    case 'checklist': {
      const items = checklistItems(parsed.items);
      content = (
        <div className="block-list-content">
          <div className="block-header-row">
            <h3>{title || 'Checklist'}</h3>
            <span>
              {items.filter((item) => item.checked).length}/{items.length}
            </span>
          </div>
          {body && <p className="block-supporting">{body}</p>}
          <div className="block-checklist">
            {items.map((item, index) => (
              <label key={`${item.label}-${index}`}>
                <input
                  type="checkbox"
                  checked={item.checked}
                  onPointerDown={stopEventPropagation}
                  onChange={() => toggleChecklistItem(index)}
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        </div>
      );
      break;
    }

    case 'table': {
      const columns = textList(parsed.columns);
      const rows = Array.isArray(parsed.rows)
        ? parsed.rows.map(textList).slice(0, 12)
        : [];
      content = (
        <div className="block-table-content">
          <h3>{title || 'Table'}</h3>
          {body && <p className="block-supporting">{body}</p>}
          <div className="block-table-wrap">
            <table>
              <thead>
                <tr>
                  {columns.map((column, index) => (
                    <th key={`${column}-${index}`}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={`row-${rowIndex}`}>
                    {columns.map((_, columnIndex) => (
                      <td key={`cell-${rowIndex}-${columnIndex}`}>
                        {row[columnIndex] || ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
      break;
    }

    case 'input':
      content = (
        <label className="block-control-content">
          <span className="block-label">{title || 'Input'}</span>
          {body && <span className="block-supporting">{body}</span>}
          <input
            type="text"
            value={value}
            placeholder="Type here…"
            onPointerDown={stopEventPropagation}
            onChange={(event) =>
              updateProps(editor, shape, { value: event.target.value.slice(0, 500) })
            }
          />
        </label>
      );
      break;

    case 'select': {
      const options = textList(parsed.options);
      content = (
        <label className="block-control-content">
          <span className="block-label">{title || 'Select'}</span>
          {body && <span className="block-supporting">{body}</span>}
          <select
            value={value}
            onPointerDown={stopEventPropagation}
            onChange={(event) =>
              updateProps(editor, shape, { value: event.target.value })
            }
          >
            <option value="">Choose…</option>
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      );
      break;
    }

    case 'slider': {
      const min = typeof parsed.min === 'number' ? parsed.min : 0;
      const max = typeof parsed.max === 'number' ? parsed.max : 100;
      const step = typeof parsed.step === 'number' ? parsed.step : 1;
      const sliderValue = Number.isFinite(Number(value)) ? Number(value) : min;
      content = (
        <label className="block-slider-content">
          <span className="block-header-row">
            <span className="block-label">{title || 'Range'}</span>
            <strong>{sliderValue}</strong>
          </span>
          {body && <span className="block-supporting">{body}</span>}
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={sliderValue}
            onPointerDown={stopEventPropagation}
            onChange={(event) =>
              updateProps(editor, shape, { value: event.target.value })
            }
          />
        </label>
      );
      break;
    }

    case 'button': {
      const pressed = value === 'pressed';
      content = (
        <div className="block-button-content">
          {body && <p>{body}</p>}
          <button
            type="button"
            aria-pressed={pressed}
            onPointerDown={stopEventPropagation}
            onClick={(event) => {
              stopEventPropagation(event);
              updateProps(editor, shape, { value: pressed ? '' : 'pressed' });
            }}
          >
            <span>{pressed ? '✓' : '→'}</span>
            {title || 'Run action'}
          </button>
        </div>
      );
      break;
    }

    case 'progress': {
      const progress = Math.max(0, Math.min(100, Number(value) || 0));
      content = (
        <div className="block-progress-content">
          <div className="block-header-row">
            <h3>{title || 'Progress'}</h3>
            <strong>{progress}%</strong>
          </div>
          {body && <p className="block-supporting">{body}</p>}
          <div className="block-progress-track">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
      );
      break;
    }

    case 'chart': {
      const series = seriesItems(parsed.series).slice(0, 10);
      const max = Math.max(...series.map((item) => Math.abs(item.value)), 1);
      content = (
        <div className="block-chart-content">
          <div className="block-header-row">
            <h3>{title || 'Chart'}</h3>
            {value && <span>{value}</span>}
          </div>
          {body && <p className="block-supporting">{body}</p>}
          <div className="block-bars">
            {series.map((item) => (
              <div className="block-bar-row" key={item.label}>
                <span>{item.label}</span>
                <div>
                  <i style={{ width: `${(Math.abs(item.value) / max) * 100}%` }} />
                </div>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
      );
      break;
    }

    case 'panel':
    default:
      content = (
        <div className="block-panel-content">
          <span className="block-label">{value || 'Panel'}</span>
          <h3>{title || 'Untitled panel'}</h3>
          {body && <p>{body}</p>}
        </div>
      );
  }

  return (
    <HTMLContainer
      id={shape.id}
      className={`surface-block surface-block-${kind} tone-${tone}`}
      style={{
        width: shape.props.w,
        height: shape.props.h,
        pointerEvents: 'all',
      }}
    >
      {content}
    </HTMLContainer>
  );
}

export class SurfaceBlockUtil extends BaseBoxShapeUtil<SurfaceBlockShape> {
  static override type = SURFACE_BLOCK_TYPE;
  static override props = {
    w: T.number,
    h: T.number,
    kind: T.string,
    tone: T.string,
    title: T.string,
    body: T.string,
    value: T.string,
    data: T.string,
  };

  override getDefaultProps(): SurfaceBlockShape['props'] {
    return {
      w: 320,
      h: 180,
      kind: 'panel',
      tone: 'paper',
      title: '',
      body: '',
      value: '',
      data: '{}',
    };
  }

  override canResize() {
    return true;
  }

  override isAspectRatioLocked() {
    return false;
  }

  component(shape: SurfaceBlockShape) {
    return <SurfaceBlockView editor={this.editor} shape={shape} />;
  }

  getIndicatorPath(shape: SurfaceBlockShape) {
    const path = new Path2D();
    path.roundRect(0, 0, shape.props.w, shape.props.h, 14);
    return path;
  }
}
