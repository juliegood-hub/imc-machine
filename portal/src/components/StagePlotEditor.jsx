import { useEffect, useMemo, useRef, useState } from 'react';
import { STAGE_PLOT_ITEM_LIBRARY } from '../constants/productionLibrary';

const CELL = 24;
const DEFAULT_LAYOUT = { width: 24, depth: 16, items: [] };

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeLayout(layout = DEFAULT_LAYOUT) {
  return {
    width: Number(layout.width) > 0 ? Number(layout.width) : DEFAULT_LAYOUT.width,
    depth: Number(layout.depth) > 0 ? Number(layout.depth) : DEFAULT_LAYOUT.depth,
    items: Array.isArray(layout.items) ? layout.items : [],
  };
}

function makeItem(template, index = 0) {
  return {
    id: `plot-item-${Date.now()}-${index}`,
    type: template.type,
    label: template.label,
    x: 0,
    y: 0,
    w: template.w || 1,
    h: template.h || 1,
    rotation: 0,
    notes: '',
  };
}

export default function StagePlotEditor({
  layout,
  onChange,
  editable = true,
  title = 'Stage Plot Layout',
}) {
  const normalized = useMemo(() => normalizeLayout(layout), [layout]);
  const [selectedId, setSelectedId] = useState('');
  const [dragState, setDragState] = useState(null);
  const boardRef = useRef(null);

  const boardWidthPx = normalized.width * CELL;
  const boardDepthPx = normalized.depth * CELL;

  const emit = (next) => {
    if (typeof onChange === 'function') onChange(next);
  };

  const updateItem = (itemId, patch) => {
    emit({
      ...normalized,
      items: normalized.items.map(item => (item.id === itemId ? { ...item, ...patch } : item)),
    });
  };

  const deleteItem = (itemId) => {
    emit({
      ...normalized,
      items: normalized.items.filter(item => item.id !== itemId),
    });
    if (selectedId === itemId) setSelectedId('');
  };

  const addItem = (template) => {
    const next = {
      ...normalized,
      items: [...normalized.items, makeItem(template, normalized.items.length)],
    };
    emit(next);
  };

  const resizeGrid = (axis, value) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed) || parsed < 8 || parsed > 64) return;
    emit({
      ...normalized,
      [axis]: parsed,
      items: normalized.items.map(item => ({
        ...item,
        x: axis === 'width' ? clamp(item.x, 0, Math.max(parsed - (item.w || 1), 0)) : item.x,
        y: axis === 'depth' ? clamp(item.y, 0, Math.max(parsed - (item.h || 1), 0)) : item.y,
      })),
    });
  };

  useEffect(() => {
    if (!dragState || !editable) return undefined;

    const onMove = (event) => {
      if (!boardRef.current) return;
      const rect = boardRef.current.getBoundingClientRect();
      const nextX = clamp(Math.round((event.clientX - rect.left) / CELL) - dragState.offsetX, 0, normalized.width - dragState.w);
      const nextY = clamp(Math.round((event.clientY - rect.top) / CELL) - dragState.offsetY, 0, normalized.depth - dragState.h);
      updateItem(dragState.itemId, { x: nextX, y: nextY });
    };

    const onUp = () => setDragState(null);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragState, editable, normalized.width, normalized.depth]);

  const selectedItem = normalized.items.find(item => item.id === selectedId);

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
        <div>
          <h3 className="text-base m-0">{title}</h3>
          <p className="text-xs text-gray-500 m-0">Top-down grid. Drag items, rotate, and label per show.</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <label className="flex items-center gap-1">
            W
            <input
              type="number"
              value={normalized.width}
              min={8}
              max={64}
              onChange={e => resizeGrid('width', e.target.value)}
              className="w-16 px-2 py-1 border border-gray-300 rounded"
              disabled={!editable}
            />
          </label>
          <label className="flex items-center gap-1">
            D
            <input
              type="number"
              value={normalized.depth}
              min={8}
              max={64}
              onChange={e => resizeGrid('depth', e.target.value)}
              className="w-16 px-2 py-1 border border-gray-300 rounded"
              disabled={!editable}
            />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-4">
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Palette</p>
          <div className="max-h-72 overflow-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
            {STAGE_PLOT_ITEM_LIBRARY.map(template => (
              <button
                key={template.type}
                type="button"
                onClick={() => addItem(template)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-[#faf8f3] border-none bg-transparent cursor-pointer"
                disabled={!editable}
              >
                + {template.label}
              </button>
            ))}
          </div>
          {selectedItem && (
            <div className="mt-3 p-3 border border-gray-200 rounded-lg bg-gray-50">
              <p className="text-xs font-semibold m-0 mb-2">Selected Item</p>
              <label className="text-xs text-gray-600 block mb-1">Label</label>
              <input
                type="text"
                value={selectedItem.label || ''}
                onChange={e => updateItem(selectedItem.id, { label: e.target.value })}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded mb-2"
                disabled={!editable}
              />
              <label className="text-xs text-gray-600 block mb-1">Notes</label>
              <textarea
                value={selectedItem.notes || ''}
                onChange={e => updateItem(selectedItem.id, { notes: e.target.value })}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded resize-y"
                rows={2}
                disabled={!editable}
              />
            </div>
          )}
        </div>

        <div className="overflow-auto">
          <div
            ref={boardRef}
            className="relative border border-gray-300 rounded bg-white"
            style={{
              width: boardWidthPx,
              height: boardDepthPx,
              backgroundImage: 'linear-gradient(to right, #eee 1px, transparent 1px), linear-gradient(to bottom, #eee 1px, transparent 1px)',
              backgroundSize: `${CELL}px ${CELL}px`,
            }}
          >
            {normalized.items.map((item) => (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(item.id)}
                onPointerDown={(e) => {
                  if (!editable) return;
                  e.preventDefault();
                  setSelectedId(item.id);
                  setDragState({
                    itemId: item.id,
                    offsetX: Math.round((e.nativeEvent.offsetX || 0) / CELL),
                    offsetY: Math.round((e.nativeEvent.offsetY || 0) / CELL),
                    w: item.w || 1,
                    h: item.h || 1,
                  });
                }}
                className={`absolute text-[10px] font-semibold border rounded shadow-sm cursor-move select-none ${
                  selectedId === item.id ? 'border-[#c8a45e] bg-[#faf4e2]' : 'border-gray-400 bg-white'
                }`}
                style={{
                  left: item.x * CELL,
                  top: item.y * CELL,
                  width: (item.w || 1) * CELL,
                  height: (item.h || 1) * CELL,
                  transform: `rotate(${item.rotation || 0}deg)`,
                  transformOrigin: 'center center',
                  padding: 2,
                  overflow: 'hidden',
                }}
              >
                <div className="truncate">{item.label || item.type}</div>
                {editable && selectedId === item.id && (
                  <div className="absolute right-0 top-0 flex gap-1 p-0.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateItem(item.id, { rotation: ((item.rotation || 0) + 90) % 360 });
                      }}
                      className="text-[9px] px-1 py-0.5 bg-white border border-gray-300 rounded cursor-pointer"
                    >
                      ↻
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteItem(item.id);
                      }}
                      className="text-[9px] px-1 py-0.5 bg-white border border-red-300 text-red-600 rounded cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2 mb-0">
            Stage is shown as audience-facing top view. Drag items to snap-to-grid cells.
          </p>
        </div>
      </div>
    </div>
  );
}
