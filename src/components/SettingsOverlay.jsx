/**
 * SettingsOverlay.jsx
 *
 * Full-screen modal for editing scoring criteria.
 *
 * Features:
 *   - Drag to reorder scored criteria (rank 1 = most weight)
 *   - Click label to rename inline
 *   - Toggle "must-have" (isDisqualifier) per criterion
 *   - Add new scored criteria (gets a UUID key)
 *   - Delete scored criteria (min 1 required)
 *   - Reset to defaults (with confirmation)
 *   - Flag-only criteria shown read-only (they're auto-detected callouts)
 *
 * On Save: calls onSave(newCriteria) which triggers recalculation of all
 * saved listings in App.jsx via recalculateForCriteria().
 */

import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_CRITERIA } from '../constants/defaultCriteria';
import DraggableCriteriaList from './DraggableCriteriaList';

export default function SettingsOverlay({ criteria, onSave, onClose }) {
  const [localCriteria, setLocalCriteria] = useState(criteria);
  const [editingKey, setEditingKey] = useState(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const flagOnlyCriteria = localCriteria.filter(c => c.flagOnly);

  // ── Drag reorder ────────────────────────────────────────────────────────
  function handleReorder(newScoredOrder) {
    // Preserve flagOnly criteria at the end
    setLocalCriteria([...newScoredOrder, ...flagOnlyCriteria]);
  }

  // ── Inline rename ────────────────────────────────────────────────────────
  function handleStartEdit(criterion) {
    setEditingKey(criterion.key);
    setEditingLabel(criterion.label);
  }

  function handleCommitEdit() {
    const trimmed = editingLabel.trim();
    if (trimmed) {
      setLocalCriteria(prev =>
        prev.map(c => (c.key === editingKey ? { ...c, label: trimmed } : c))
      );
    }
    setEditingKey(null);
  }

  function handleCancelEdit() {
    setEditingKey(null);
  }

  // ── Must-have toggle ─────────────────────────────────────────────────────
  function handleToggleDisqualifier(key) {
    setLocalCriteria(prev =>
      prev.map(c => (c.key === key ? { ...c, isDisqualifier: !c.isDisqualifier } : c))
    );
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  function handleDelete(key) {
    const scored = localCriteria.filter(c => !c.flagOnly);
    if (scored.length <= 1) return; // always keep at least one
    if (editingKey === key) setEditingKey(null);
    setLocalCriteria(prev => prev.filter(c => c.key !== key));
  }

  // ── Add ──────────────────────────────────────────────────────────────────
  function handleAdd() {
    const newKey = uuidv4();
    const newCriterion = {
      key: newKey,
      label: 'New criterion',
      isDisqualifier: false,
      flagOnly: false,
    };
    setLocalCriteria(prev => {
      const scored = prev.filter(c => !c.flagOnly);
      const flags = prev.filter(c => c.flagOnly);
      return [...scored, newCriterion, ...flags];
    });
    // Immediately start editing the new criterion's label
    setEditingKey(newKey);
    setEditingLabel('New criterion');
  }

  // ── Reset ────────────────────────────────────────────────────────────────
  function handleReset() {
    setLocalCriteria(DEFAULT_CRITERIA);
    setEditingKey(null);
    setShowResetConfirm(false);
  }

  // ── Close via backdrop click ─────────────────────────────────────────────
  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
      onClick={handleBackdropClick}
    >
      <div
        className="relative flex flex-col bg-white rounded-2xl shadow-2xl"
        style={{ width: '520px', maxWidth: '95vw', maxHeight: '90vh' }}
      >

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div
          className="flex items-start justify-between px-6 pt-5 pb-4 border-b"
          style={{ borderColor: '#e8e8e8' }}
        >
          <div>
            <h2 className="font-bold text-base" style={{ color: '#1a1a2e' }}>
              Scoring Criteria
            </h2>
            <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
              Drag to reorder — #1 counts most toward your score. Click a label to rename.
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-sm transition-colors ml-4 flex-shrink-0"
            style={{ color: '#9ca3af' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f3f4f6'; e.currentTarget.style.color = '#374151'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#9ca3af'; }}
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        {/* ── Body (scrollable) ────────────────────────────────────────── */}
        <div className="overflow-y-auto flex-1 px-6 py-4">

          {/* Scored criteria — draggable */}
          <DraggableCriteriaList
            criteria={localCriteria}
            editingKey={editingKey}
            editingLabel={editingLabel}
            onReorder={handleReorder}
            onStartEdit={handleStartEdit}
            onEditChange={setEditingLabel}
            onCommitEdit={handleCommitEdit}
            onCancelEdit={handleCancelEdit}
            onToggleDisqualifier={handleToggleDisqualifier}
            onDelete={handleDelete}
          />

          {/* Add criterion button */}
          <button
            onClick={handleAdd}
            className="mt-3 w-full py-2.5 rounded-xl text-sm font-medium border-2 border-dashed transition-colors"
            style={{ borderColor: '#e8e8e8', color: '#9ca3af' }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#2A7F7F';
              e.currentTarget.style.color = '#2A7F7F';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#e8e8e8';
              e.currentTarget.style.color = '#9ca3af';
            }}
          >
            + Add criterion
          </button>

          {/* Flag-only criteria — read-only info */}
          {flagOnlyCriteria.length > 0 && (
            <div className="mt-5">
              <p
                className="text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: '#9ca3af' }}
              >
                Auto-detected info fields
              </p>
              <div className="flex flex-col gap-2">
                {flagOnlyCriteria.map(c => (
                  <div
                    key={c.key}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl border"
                    style={{ borderColor: '#e8e8e8', backgroundColor: '#fafafa' }}
                  >
                    <span style={{ color: '#d1d5db', fontSize: '13px' }}>ℹ</span>
                    <span className="flex-1 text-sm" style={{ color: '#6b7280' }}>
                      {c.label}
                    </span>
                    <span className="text-xs italic" style={{ color: '#d1d5db' }}>
                      not scored
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs mt-2" style={{ color: '#d1d5db' }}>
                These are surfaced as callouts but don't affect the score.
              </p>
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-6 py-4 border-t"
          style={{ borderColor: '#e8e8e8' }}
        >
          {/* Reset */}
          {showResetConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: '#6b7280' }}>
                Reset all to defaults?
              </span>
              <button
                onClick={handleReset}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white"
                style={{ backgroundColor: '#ef5350' }}
              >
                Yes, reset
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="text-xs px-3 py-1.5 rounded-lg font-medium"
                style={{ color: '#6b7280' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f3f4f6'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="text-xs"
              style={{ color: '#9ca3af' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#6b7280'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af'; }}
            >
              Reset to defaults
            </button>
          )}

          {/* Save */}
          <button
            onClick={() => onSave(localCriteria)}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-opacity"
            style={{ backgroundColor: '#1a1a2e' }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
