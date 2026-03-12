/**
 * DraggableCriteriaList.jsx
 *
 * Renders the scored (non-flagOnly) criteria as a drag-to-reorder list.
 * Uses @dnd-kit/core and @dnd-kit/sortable.
 *
 * Only scored criteria are shown/reorderable here.
 * Flag-only criteria are rendered separately in SettingsOverlay.
 */

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ── Single sortable row ────────────────────────────────────────────────────

function SortableRow({
  criterion,
  rank,
  editingKey,
  editingLabel,
  canDelete,
  onStartEdit,
  onEditChange,
  onCommitEdit,
  onCancelEdit,
  onToggleDisqualifier,
  onDelete,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: criterion.key });

  const isEditing = editingKey === criterion.key;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 10 : 'auto',
        position: 'relative',
        borderColor: isDragging ? '#2A7F7F' : '#e8e8e8',
      }}
      className="flex items-center gap-2.5 px-3 py-2.5 bg-white rounded-xl border"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none select-none"
        style={{ color: '#d1d5db', lineHeight: 1 }}
        aria-label="Drag to reorder"
        tabIndex={-1}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <circle cx="4" cy="3" r="1.2" />
          <circle cx="10" cy="3" r="1.2" />
          <circle cx="4" cy="7" r="1.2" />
          <circle cx="10" cy="7" r="1.2" />
          <circle cx="4" cy="11" r="1.2" />
          <circle cx="10" cy="11" r="1.2" />
        </svg>
      </button>

      {/* Rank number */}
      <span
        className="flex-shrink-0 text-xs font-bold w-6 text-center"
        style={{ color: '#9ca3af' }}
      >
        {rank}
      </span>

      {/* Label — click to edit */}
      {isEditing ? (
        <input
          value={editingLabel}
          onChange={e => onEditChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') onCommitEdit();
            if (e.key === 'Escape') onCancelEdit();
          }}
          onBlur={onCommitEdit}
          onFocus={e => e.target.select()}
          autoFocus
          className="flex-1 text-sm font-medium rounded-lg px-2 py-0.5 outline-none border"
          style={{ borderColor: '#2A7F7F', color: '#1a1a2e', minWidth: 0 }}
        />
      ) : (
        <span
          className="flex-1 text-sm font-medium truncate cursor-text"
          style={{ color: '#1a1a2e', minWidth: 0 }}
          onClick={() => onStartEdit(criterion)}
          title="Click to rename"
        >
          {criterion.label}
        </span>
      )}

      {/* Must-have toggle */}
      <button
        onClick={() => onToggleDisqualifier(criterion.key)}
        className="flex-shrink-0 text-xs px-2 py-1 rounded-full font-medium transition-colors"
        style={
          criterion.isDisqualifier
            ? { backgroundColor: '#ffebee', color: '#ef5350' }
            : { backgroundColor: '#f3f4f6', color: '#9ca3af' }
        }
        title={
          criterion.isDisqualifier
            ? 'Must-have: a "No" here forces Skip verdict'
            : 'Click to make this a must-have'
        }
      >
        must-have
      </button>

      {/* Delete */}
      <button
        onClick={() => onDelete(criterion.key)}
        disabled={!canDelete}
        className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg transition-colors"
        style={{ color: canDelete ? '#d1d5db' : '#e5e7eb' }}
        onMouseEnter={e => { if (canDelete) e.currentTarget.style.color = '#ef5350'; }}
        onMouseLeave={e => { e.currentTarget.style.color = canDelete ? '#d1d5db' : '#e5e7eb'; }}
        title={canDelete ? 'Remove criterion' : 'Must have at least one criterion'}
        aria-label="Remove criterion"
      >
        ✕
      </button>
    </div>
  );
}

// ── Main list component ────────────────────────────────────────────────────

export default function DraggableCriteriaList({
  criteria,
  onReorder,
  onRename,
  onToggleDisqualifier,
  onDelete,
}) {
  const [editingKey, setEditingKey] = useState(null);
  const [editingLabel, setEditingLabel] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Only scored criteria are draggable
  const scoredCriteria = criteria.filter(c => !c.flagOnly);
  const canDelete = scoredCriteria.length > 1;

  function handleStartEdit(criterion) {
    setEditingKey(criterion.key);
    setEditingLabel(criterion.label);
  }

  function handleCommitEdit() {
    const trimmed = editingLabel.trim();
    if (trimmed && editingKey) {
      onRename(editingKey, trimmed);
    }
    setEditingKey(null);
  }

  function handleCancelEdit() {
    setEditingKey(null);
  }

  function handleDelete(key) {
    if (editingKey === key) setEditingKey(null);
    onDelete(key);
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = scoredCriteria.findIndex(c => c.key === active.id);
    const newIndex = scoredCriteria.findIndex(c => c.key === over.id);
    onReorder(arrayMove(scoredCriteria, oldIndex, newIndex));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={scoredCriteria.map(c => c.key)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-2">
          {scoredCriteria.map((c, i) => (
            <SortableRow
              key={c.key}
              criterion={c}
              rank={i + 1}
              editingKey={editingKey}
              editingLabel={editingLabel}
              canDelete={canDelete}
              onStartEdit={handleStartEdit}
              onEditChange={setEditingLabel}
              onCommitEdit={handleCommitEdit}
              onCancelEdit={handleCancelEdit}
              onToggleDisqualifier={onToggleDisqualifier}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
