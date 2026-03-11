/**
 * SettingsOverlay.jsx
 *
 * Full-screen modal for editing scoring criteria and target location.
 *
 * Features:
 *   - Location field with neighborhood autocomplete
 *   - Drag to reorder scored criteria (rank 1 = most weight)
 *   - Click label to rename inline
 *   - Toggle "must-have" (isDisqualifier) per criterion
 *   - Add criteria from the library (grouped, no free-form custom)
 *   - Delete scored criteria (min 1 required)
 *   - Reset to defaults (with confirmation)
 *   - Flag-only criteria shown read-only (auto-detected callouts)
 *
 * On Save: calls onSave(newCriteria, newLocation) which triggers
 *   recalculation of all saved listings in App.jsx.
 */

import { useState, useEffect, useRef } from 'react';
import { DEFAULT_CRITERIA, CRITERIA_LIBRARY, SEATTLE_NEIGHBORHOODS } from '../constants/defaultCriteria';
import DraggableCriteriaList from './DraggableCriteriaList';

// ─────────────────────────────────────────────────────────────
// Location autocomplete
// ─────────────────────────────────────────────────────────────
function LocationField({ value, onChange }) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Sync if parent value changes (e.g. on reset)
  useEffect(() => { setQuery(value); }, [value]);

  function handleInput(e) {
    const q = e.target.value;
    setQuery(q);
    if (q.trim().length < 1) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const lower = q.toLowerCase();
    const matches = SEATTLE_NEIGHBORHOODS.filter(n =>
      n.toLowerCase().includes(lower)
    ).slice(0, 6);
    setSuggestions(matches);
    setOpen(matches.length > 0);
  }

  function select(neighborhood) {
    setQuery(neighborhood);
    onChange(neighborhood);
    setSuggestions([]);
    setOpen(false);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions.length > 0) {
        select(suggestions[0]);
      } else {
        // Free-text — use as-is
        onChange(query.trim() || value);
        setOpen(false);
      }
    }
    if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  function handleBlur(e) {
    // Delay so click on suggestion fires first
    setTimeout(() => {
      setOpen(false);
      // If user typed but didn't pick a suggestion, commit what they typed
      if (query.trim() && query !== value) {
        onChange(query.trim());
      }
    }, 120);
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
        placeholder="e.g. Capitol Hill, Seattle"
        className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
        style={{ borderColor: '#e8e8e8', color: '#1a1a2e', backgroundColor: '#ffffff' }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = '#2A7F7F')}
        onMouseLeave={e => {
          if (document.activeElement !== e.currentTarget)
            e.currentTarget.style.borderColor = '#e8e8e8';
        }}
        onFocusCapture={e => (e.currentTarget.style.borderColor = '#2A7F7F')}
        onBlurCapture={e => (e.currentTarget.style.borderColor = '#e8e8e8')}
      />
      {open && (
        <ul
          ref={listRef}
          className="absolute z-10 w-full rounded-lg border shadow-lg overflow-hidden mt-1"
          style={{ backgroundColor: '#ffffff', borderColor: '#e8e8e8' }}
        >
          {suggestions.map(s => (
            <li
              key={s}
              onMouseDown={() => select(s)}
              className="px-3 py-2 text-sm cursor-pointer transition-colors"
              style={{ color: '#1a1a2e' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Criteria library picker (inline expandable panel)
// ─────────────────────────────────────────────────────────────
function LibraryPicker({ activeCriteriaKeys, onAdd }) {
  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: '#e8e8e8', backgroundColor: '#fafafa' }}
    >
      <div className="px-4 pt-3 pb-2 border-b" style={{ borderColor: '#f3f4f6' }}>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#9ca3af' }}>
          Criteria library — click to add
        </p>
      </div>
      <div className="px-4 py-3 flex flex-col gap-4">
        {CRITERIA_LIBRARY.map(group => {
          // Only show groups that have at least one not-yet-added item
          const available = group.items.filter(item => !activeCriteriaKeys.has(item.key));
          const added     = group.items.filter(item =>  activeCriteriaKeys.has(item.key));
          if (available.length === 0 && added.length === 0) return null;

          return (
            <div key={group.category}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#d1d5db' }}>
                {group.category}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {group.items.map(item => {
                  const isAdded = activeCriteriaKeys.has(item.key);
                  return (
                    <button
                      key={item.key}
                      onClick={() => !isAdded && onAdd(item)}
                      disabled={isAdded}
                      className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                      style={
                        isAdded
                          ? { backgroundColor: '#e0f2f1', borderColor: '#2A7F7F', color: '#2A7F7F', cursor: 'default' }
                          : { backgroundColor: '#ffffff', borderColor: '#e8e8e8', color: '#6b7280', cursor: 'pointer' }
                      }
                      onMouseEnter={e => {
                        if (!isAdded) {
                          e.currentTarget.style.borderColor = '#2A7F7F';
                          e.currentTarget.style.color = '#2A7F7F';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isAdded) {
                          e.currentTarget.style.borderColor = '#e8e8e8';
                          e.currentTarget.style.color = '#6b7280';
                        }
                      }}
                    >
                      {isAdded ? `✓ ${item.label}` : `+ ${item.label}`}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────
export default function SettingsOverlay({ criteria, location, onSave, onClose }) {
  const [localCriteria, setLocalCriteria] = useState(criteria);
  const [localLocation, setLocalLocation] = useState(location);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const panelRef = useRef(null);

  // Close on Escape; focus the panel on mount so Escape is captured immediately
  useEffect(() => {
    panelRef.current?.focus();
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const scoredCriteria  = localCriteria.filter(c => !c.flagOnly);
  const flagOnlyCriteria = localCriteria.filter(c => c.flagOnly);

  // Keys of currently active scored criteria — used by LibraryPicker to grey out added items
  const activeScoredKeys = new Set(scoredCriteria.map(c => c.key));

  // ── Drag reorder ────────────────────────────────────────────────────────
  function handleReorder(newScoredOrder) {
    setLocalCriteria([...newScoredOrder, ...flagOnlyCriteria]);
  }

  // ── Inline rename ────────────────────────────────────────────────────────
  function handleRename(key, label) {
    setLocalCriteria(prev =>
      prev.map(c => (c.key === key ? { ...c, label } : c))
    );
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
    setLocalCriteria(prev => prev.filter(c => c.key !== key));
  }

  // ── Add from library ──────────────────────────────────────────────────────
  function handleAddFromLibrary(item) {
    const newCriterion = {
      key: item.key,
      label: item.label,
      isDisqualifier: false,
      flagOnly: false,
    };
    setLocalCriteria(prev => {
      const scored = prev.filter(c => !c.flagOnly);
      const flags  = prev.filter(c => c.flagOnly);
      return [...scored, newCriterion, ...flags];
    });
  }

  // ── Reset ────────────────────────────────────────────────────────────────
  function handleReset() {
    setLocalCriteria(DEFAULT_CRITERIA);
    setLocalLocation('Green Lake, Seattle');
    setShowResetConfirm(false);
    setShowLibrary(false);
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
        ref={panelRef}
        tabIndex={-1}
        className="relative flex flex-col bg-white rounded-2xl shadow-2xl outline-none"
        style={{ width: '520px', maxWidth: '95vw', maxHeight: '90vh' }}
      >

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div
          className="flex items-start justify-between px-6 pt-5 pb-4 border-b"
          style={{ borderColor: '#e8e8e8' }}
        >
          <div>
            <h2 className="font-bold text-base" style={{ color: '#1a1a2e' }}>
              Settings
            </h2>
            <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
              Set your target location and scoring criteria.
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
        <div className="overflow-y-auto flex-1 px-6 py-4 flex flex-col gap-5">

          {/* ── Location ── */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#9ca3af' }}>
              Target neighborhood
            </label>
            <LocationField
              value={localLocation}
              onChange={setLocalLocation}
            />
            <p className="text-xs mt-1.5" style={{ color: '#d1d5db' }}>
              Updates the location criterion and Claude's neighborhood awareness.
            </p>
          </div>

          {/* ── Scored criteria ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#9ca3af' }}>
              Scoring criteria
            </p>
            <p className="text-xs mb-3" style={{ color: '#d1d5db' }}>
              Drag to reorder — #1 counts most toward your score. Click a label to rename.
            </p>

            <DraggableCriteriaList
              criteria={localCriteria}
              onReorder={handleReorder}
              onRename={handleRename}
              onToggleDisqualifier={handleToggleDisqualifier}
              onDelete={handleDelete}
            />

            {/* Add from library toggle */}
            <button
              onClick={() => setShowLibrary(v => !v)}
              className="mt-3 w-full py-2.5 rounded-xl text-sm font-medium border-2 border-dashed transition-colors flex items-center justify-center gap-1.5"
              style={
                showLibrary
                  ? { borderColor: '#2A7F7F', color: '#2A7F7F', backgroundColor: '#f0fafa' }
                  : { borderColor: '#e8e8e8', color: '#9ca3af', backgroundColor: 'transparent' }
              }
              onMouseEnter={e => {
                if (!showLibrary) {
                  e.currentTarget.style.borderColor = '#2A7F7F';
                  e.currentTarget.style.color = '#2A7F7F';
                }
              }}
              onMouseLeave={e => {
                if (!showLibrary) {
                  e.currentTarget.style.borderColor = '#e8e8e8';
                  e.currentTarget.style.color = '#9ca3af';
                }
              }}
            >
              {showLibrary ? '▲ Hide library' : '+ Browse criteria library'}
            </button>

            {/* Library picker — inline */}
            {showLibrary && (
              <div className="mt-2">
                <LibraryPicker
                  activeCriteriaKeys={activeScoredKeys}
                  onAdd={handleAddFromLibrary}
                />
              </div>
            )}
          </div>

          {/* ── Flag-only criteria — read-only info ── */}
          {flagOnlyCriteria.length > 0 && (
            <div>
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
            onClick={() => onSave(localCriteria, localLocation)}
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
