/**
 * SettingsTab.jsx
 *
 * Full-page tab for editing scoring criteria and target location.
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

import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  DEFAULT_CRITERIA,
  CRITERIA_LIBRARY,
  SEATTLE_NEIGHBORHOODS,
} from "../../constants/defaultCriteria";
import {
  DEFAULT_LOCATION,
  DEFAULT_PRICE_THRESHOLD,
  getPriceThreshold,
  savePriceThreshold,
} from "../../utils/storage";
import DraggableCriteriaList from "../DraggableCriteriaList";

// ─────────────────────────────────────────────────────────────
// Dirty-state confirmation dialog
// ─────────────────────────────────────────────────────────────
export function UnsavedChangesDialog({ onStay, onLeave }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
    >
      <div
        className="rounded-2xl border bg-white p-6 shadow-xl border-border"
        style={{ maxWidth: "360px", width: "90%" }}
      >
        <h2 className="font-bold text-base mb-1 text-primary">
          Unsaved settings changes
        </h2>
        <p className="text-sm mb-5 text-secondary">Leave without saving?</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onStay}
            className="px-4 py-2 rounded-xl text-sm font-medium border border-border text-primary bg-white hover:bg-inactive"
          >
            Stay
          </button>
          <button
            onClick={onLeave}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-primary"
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.85";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}

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
  useEffect(() => {
    setQuery(value);
  }, [value]);

  function handleInput(e) {
    const q = e.target.value;
    setQuery(q);
    if (q.trim().length < 1) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const lower = q.toLowerCase();
    const matches = SEATTLE_NEIGHBORHOODS.filter((n) =>
      n.toLowerCase().includes(lower),
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
    if (e.key === "Enter") {
      e.preventDefault();
      if (suggestions.length > 0) {
        select(suggestions[0]);
      } else {
        onChange(query.trim() || value);
        setOpen(false);
      }
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function handleBlur(e) {
    setTimeout(() => {
      setOpen(false);
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
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        placeholder="e.g. Capitol Hill, Seattle"
        className="w-full rounded-lg border px-3 py-2 text-sm outline-none border-border text-primary bg-white focus:border-accent"
      />
      {open && (
        <ul
          ref={listRef}
          className="absolute z-10 w-full rounded-lg border shadow-lg overflow-hidden mt-1 bg-white border-border"
        >
          {suggestions.map((s) => (
            <li
              key={s}
              onMouseDown={() => select(s)}
              className="px-3 py-2 text-sm cursor-pointer transition-colors text-primary hover:bg-inactive"
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
function LibraryPicker({ activeCriteriaKeys, onAdd, onRemove }) {
  return (
    <div className="px-4 py-3 flex flex-col gap-4">
      {CRITERIA_LIBRARY.map((group) => {
        if (group.items.length === 0) return null;
        return (
          <div key={group.category}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2 text-faint">
              {group.category}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {group.items.map((item) => {
                const isAdded = activeCriteriaKeys.has(item.key);
                return (
                  <button
                    key={item.key}
                    onClick={() => (isAdded ? onRemove(item.key) : onAdd(item))}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                      isAdded
                        ? "bg-callout-bg border-accent text-accent hover:bg-score-no-bg hover:border-score-no hover:text-score-no"
                        : "bg-white border-border text-secondary hover:border-accent hover:text-accent"
                    }`}
                    title={isAdded ? "Click to remove" : "Click to add"}
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
  );
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────
export default function SettingsTab({
  criteria,
  location,
  onSave,
  onDirtyChange,
}) {
  const [localCriteria, setLocalCriteria] = useState(criteria);
  const [localLocation, setLocalLocation] = useState(location);
  const [localMaxRent, setLocalMaxRent] = useState(() => getPriceThreshold());
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);

  // Track the persisted max rent so we can detect dirty state after saves
  const savedMaxRentRef = useRef(getPriceThreshold());

  // Notify parent whenever dirty state changes
  useEffect(() => {
    const dirty =
      JSON.stringify(localCriteria) !== JSON.stringify(criteria) ||
      localLocation !== location ||
      localMaxRent !== savedMaxRentRef.current;
    onDirtyChange?.(dirty);
  }, [localCriteria, localLocation, localMaxRent, criteria, location]);

  const scoredCriteria = localCriteria.filter((c) => !c.flagOnly);
  const flagOnlyCriteria = localCriteria.filter((c) => c.flagOnly);
  const activeScoredKeys = new Set(scoredCriteria.map((c) => c.key));

  // ── Drag reorder ────────────────────────────────────────────────────────
  function handleReorder(newScoredOrder) {
    setLocalCriteria([...newScoredOrder, ...flagOnlyCriteria]);
  }

  // ── Inline rename ────────────────────────────────────────────────────────
  function handleRename(key, label) {
    setLocalCriteria((prev) =>
      prev.map((c) => (c.key === key ? { ...c, label } : c)),
    );
  }

  // ── Must-have toggle ─────────────────────────────────────────────────────
  function handleToggleDisqualifier(key) {
    setLocalCriteria((prev) =>
      prev.map((c) =>
        c.key === key ? { ...c, isDisqualifier: !c.isDisqualifier } : c,
      ),
    );
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  function handleDelete(key) {
    const scored = localCriteria.filter((c) => !c.flagOnly);
    if (scored.length <= 1) return;
    setLocalCriteria((prev) => prev.filter((c) => c.key !== key));
  }

  // ── Max rent change ───────────────────────────────────────────────────────
  function handleMaxRentChange(raw) {
    const value = raw === "" ? "" : Number(raw);
    setLocalMaxRent(value);
    const threshold = value === "" ? DEFAULT_PRICE_THRESHOLD : value;
    setLocalCriteria((prev) =>
      prev.map((c) =>
        c.key === "price"
          ? { ...c, label: `Price ≤ $${threshold.toLocaleString()}` }
          : c,
      ),
    );
  }

  // ── Add from library ──────────────────────────────────────────────────────
  function handleAddFromLibrary(item) {
    const threshold =
      localMaxRent === "" ? DEFAULT_PRICE_THRESHOLD : localMaxRent;
    const newCriterion = {
      key: item.key,
      label:
        item.key === "price"
          ? `Price ≤ $${threshold.toLocaleString()}`
          : item.label,
      isDisqualifier: false,
      flagOnly: false,
    };
    setLocalCriteria((prev) => {
      const scored = prev.filter((c) => !c.flagOnly);
      const flags = prev.filter((c) => c.flagOnly);
      return [...scored, newCriterion, ...flags];
    });
  }

  // ── Reset ────────────────────────────────────────────────────────────────
  function handleReset() {
    setLocalCriteria(DEFAULT_CRITERIA);
    setLocalLocation(DEFAULT_LOCATION);
    setLocalMaxRent(DEFAULT_PRICE_THRESHOLD);
    setShowResetConfirm(false);
    setShowLibrary(false);
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  function handleSave() {
    const shortName = localLocation.split(",")[0].trim();
    const threshold =
      localMaxRent === "" ? DEFAULT_PRICE_THRESHOLD : localMaxRent;
    const updatedCriteria = localCriteria.map((c) => {
      if (c.key === "green_lake") return { ...c, label: `Near ${shortName}` };
      if (c.key === "price")
        return { ...c, label: `Price ≤ $${threshold.toLocaleString()}` };
      return c;
    });
    savePriceThreshold(threshold);
    savedMaxRentRef.current = threshold;
    onSave(updatedCriteria, localLocation);
  }

  return (
    <div className="mx-auto" style={{ maxWidth: "560px" }}>
      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="font-bold text-xl text-primary">Settings</h1>
        <p className="text-sm mt-1 text-tertiary">
          Set your target location and scoring criteria.
        </p>
      </div>

      {/* ── Content card ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-white flex flex-col gap-5 p-6 border-border">
        {/* ── Location ── */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-tertiary">
            Target neighborhood
          </label>
          <LocationField value={localLocation} onChange={setLocalLocation} />
          <p className="text-xs mt-1.5 text-faint">
            Updates the location criterion and Claude's neighborhood awareness.
          </p>
        </div>

        {/* ── Maximum rent ── */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-tertiary">
            Maximum rent
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none text-tertiary">
              $
            </span>
            <input
              type="number"
              min="0"
              step="50"
              value={localMaxRent}
              onChange={(e) =>
                handleMaxRentChange(
                  e.target.value === "" ? "" : Number(e.target.value),
                )
              }
              placeholder="2000"
              className="w-full rounded-lg border pl-7 pr-3 py-2 text-sm outline-none border-border text-primary bg-white focus:border-accent"
            />
          </div>
          <p className="text-xs mt-1.5 text-faint">
            Updates the "Price" criterion label (e.g. Price ≤ $2,000).
          </p>
        </div>

        {/* ── Scored criteria ── */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2 text-tertiary">
            Scoring criteria
          </p>
          <p className="text-xs mb-3 text-faint">
            Drag to reorder — 1 counts most toward your score. Click a label to
            rename.
          </p>

          <DraggableCriteriaList
            criteria={localCriteria}
            onReorder={handleReorder}
            onRename={handleRename}
            onToggleDisqualifier={handleToggleDisqualifier}
            onDelete={handleDelete}
          />

          {/* Add from library — collapsible */}
          <div className="mt-3 rounded-xl border overflow-hidden bg-white border-border">
            <button
              onClick={() => setShowLibrary((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3"
            >
              <span className="text-sm font-semibold text-primary">
                Criteria library
              </span>
              {showLibrary ? (
                <ChevronUp size={15} className="text-tertiary" />
              ) : (
                <ChevronDown size={15} className="text-tertiary" />
              )}
            </button>
            {showLibrary && (
              <div className="border-t border-inactive">
                <LibraryPicker
                  activeCriteriaKeys={activeScoredKeys}
                  onAdd={handleAddFromLibrary}
                  onRemove={handleDelete}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Flag-only criteria — read-only info ── */}
        {flagOnlyCriteria.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2 text-tertiary">
              Auto-detected info fields
            </p>
            <div className="flex flex-col gap-2">
              {flagOnlyCriteria.map((c) => (
                <div
                  key={c.key}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-row-alt"
                >
                  <span className="text-faint text-[13px]">ℹ</span>
                  <span className="flex-1 text-sm text-secondary">
                    {c.label}
                  </span>
                  <span className="text-xs italic text-faint">not scored</span>
                </div>
              ))}
            </div>
            <p className="text-xs mt-2 text-faint">
              These are surfaced as callouts but don't affect the score.
            </p>
          </div>
        )}

        {/* ── Footer: reset + save ── */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          {showResetConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-secondary">
                Reset all to defaults?
              </span>
              <button
                onClick={handleReset}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white bg-score-no"
              >
                Yes, reset
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="text-xs px-3 py-1.5 rounded-lg font-medium text-secondary hover:bg-inactive"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="text-xs text-tertiary hover:text-secondary"
            >
              Reset to defaults
            </button>
          )}

          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-opacity bg-primary"
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.85";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
