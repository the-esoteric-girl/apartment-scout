/**
 * ExportModal — CSV export configuration dialog.
 *
 * Sections:
 *   1. Listings   — checkbox list with Select All (indeterminate-aware)
 *   2. Criteria   — grouped by category (mirrors CRITERIA_LIBRARY).
 *                   Active criteria are styled normally; inactive library
 *                   criteria are dimmed with an "(unscored)" italic label.
 *                   Flag-only criteria get a "(note)" italic label.
 *                   Any active criteria not in the library (e.g. green_lake,
 *                   user-added) appear under a "Priority" group at the top.
 *   3. Format     — radio group: Clean / Database values / Both
 *
 * Props:
 *   listings  — full array of saved listing objects
 *   criteria  — current active criteria array (from user settings)
 *   onClose   — fn() called to dismiss the modal
 */
import { useState, useRef, useEffect } from 'react';
import { X, Download } from 'lucide-react';
import { exportToCSV } from '../utils/export';
import { CRITERIA_LIBRARY } from '../constants/defaultCriteria';

/**
 * Build grouped criteria for the export picker.
 *
 * Returns [{ category, items }] mirroring CRITERIA_LIBRARY structure.
 * Active criteria keep their metadata (flagOnly, isDisqualifier).
 * Inactive library items are tagged inactive: true.
 * Active criteria absent from the library go into a "Priority" group first.
 */
function buildGroupedCriteria(activeCriteria) {
  const activeByKey = new Map(activeCriteria.map(c => [c.key, c]));

  // Keys covered by the library
  const libraryKeys = new Set(
    CRITERIA_LIBRARY.flatMap(g => g.items.map(i => i.key))
  );

  // Active criteria not in any library group → "Priority" group at top
  const priorityItems = activeCriteria
    .filter(c => !libraryKeys.has(c.key))
    .map(c => ({ ...c, inactive: false }));

  // Map library groups; mark each item active or inactive
  const libraryGroups = CRITERIA_LIBRARY.map(group => ({
    category: group.category,
    items: group.items.map(item => {
      const active = activeByKey.get(item.key);
      if (active) {
        return { ...active, inactive: false };
      }
      return { key: item.key, label: item.label, flagOnly: false, inactive: true };
    }),
  }));

  const groups = [...libraryGroups];
  if (priorityItems.length > 0) {
    groups.unshift({ category: 'Priority', items: priorityItems });
  }
  return groups;
}

const FORMAT_OPTIONS = [
  {
    value: 'scores',
    label: 'Clean',
    desc: 'Yes / No / Unclear',
  },
  {
    value: 'raw',
    label: 'Database values',
    desc: 'yes / no / unclear (as stored)',
  },
  {
    value: 'both',
    label: 'Both',
    desc: 'Two columns per criterion',
  },
];

export default function ExportModal({ listings, criteria, onClose }) {
  // ── Grouped criteria + flat list for select-all / export logic ───────────
  const groupedCriteria = buildGroupedCriteria(criteria);
  const flatAllCriteria = groupedCriteria.flatMap(g => g.items);

  // ── Selection state ───────────────────────────────────────────────────────
  const [selectedListings, setSelectedListings] = useState(
    () => new Set(listings.map(l => l.id))
  );
  const [selectedCriteria, setSelectedCriteria] = useState(
    () => new Set(flatAllCriteria.map(c => c.key))
  );
  const [scoreFormat, setScoreFormat] = useState('scores');

  // ── Derived booleans for indeterminate checkbox state ────────────────────
  const allListingsChecked = selectedListings.size === listings.length;
  const someListingsChecked = selectedListings.size > 0 && !allListingsChecked;

  const allCriteriaChecked = selectedCriteria.size === flatAllCriteria.length;
  const someCriteriaChecked = selectedCriteria.size > 0 && !allCriteriaChecked;

  const selectAllListingsRef = useRef(null);
  const selectAllCriteriaRef = useRef(null);

  useEffect(() => {
    if (selectAllListingsRef.current) {
      selectAllListingsRef.current.indeterminate = someListingsChecked;
    }
  }, [someListingsChecked]);

  useEffect(() => {
    if (selectAllCriteriaRef.current) {
      selectAllCriteriaRef.current.indeterminate = someCriteriaChecked;
    }
  }, [someCriteriaChecked]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  function toggleListing(id) {
    setSelectedListings(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAllListings() {
    if (allListingsChecked || someListingsChecked) {
      setSelectedListings(new Set());
    } else {
      setSelectedListings(new Set(listings.map(l => l.id)));
    }
  }

  function toggleCriterion(key) {
    setSelectedCriteria(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleAllCriteria() {
    if (allCriteriaChecked || someCriteriaChecked) {
      setSelectedCriteria(new Set());
    } else {
      setSelectedCriteria(new Set(flatAllCriteria.map(c => c.key)));
    }
  }

  function handleExport() {
    const listingsToExport = listings.filter(l => selectedListings.has(l.id));
    const criteriaToExport = flatAllCriteria.filter(c => selectedCriteria.has(c.key));
    exportToCSV(listingsToExport, criteriaToExport, { scoreFormat });
    onClose();
  }

  const canExport = selectedListings.size > 0;
  const exportCount = selectedListings.size;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-xl border border-border w-full mx-4 flex flex-col overflow-hidden"
        style={{ maxWidth: '520px', maxHeight: '90vh' }}
      >

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Download size={16} className="text-accent" />
            <h2 className="text-base font-bold text-primary">Export to CSV</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors text-tertiary hover:bg-inactive"
            aria-label="Close"
          >
            <X size={17} />
          </button>
        </div>

        {/* ── Scrollable body ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-6">

          {/* ── Section 1: Listings ──────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-tertiary">
                Listings
              </p>
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  ref={selectAllListingsRef}
                  checked={allListingsChecked}
                  onChange={toggleAllListings}
                />
                <span className="text-xs font-medium text-secondary">Select all</span>
              </label>
            </div>

            <div
              className="rounded-lg border border-border divide-y overflow-hidden"
              style={{ maxHeight: '200px', overflowY: 'auto' }}
            >
              {listings.map(listing => {
                const isChecked = selectedListings.has(listing.id);
                return (
                  <label
                    key={listing.id}
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors bg-white hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleListing(listing.id)}
                      className="shrink-0"
                    />
                    <span className="flex-1 text-sm font-medium text-primary truncate">
                      {listing.name}
                    </span>
                    <span className="text-xs text-tertiary shrink-0">
                      {listing.weighted_score}/100
                    </span>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 capitalize ${
                        listing.verdict === 'apply'
                          ? 'bg-score-yes-bg text-score-yes'
                          : listing.verdict === 'tour'
                          ? 'bg-verdict-tour-bg text-verdict-tour'
                          : 'bg-score-no-bg text-score-no'
                      }`}
                    >
                      {listing.verdict}
                    </span>
                  </label>
                );
              })}
            </div>
          </section>

          {/* ── Section 2: Criteria Columns ──────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-tertiary">
                Criteria Columns
              </p>
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  ref={selectAllCriteriaRef}
                  checked={allCriteriaChecked}
                  onChange={toggleAllCriteria}
                />
                <span className="text-xs font-medium text-secondary">Select all</span>
              </label>
            </div>

            <div className="flex flex-col gap-4">
              {groupedCriteria.map(group => (
                <div key={group.category}>
                  {/* Category header */}
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 text-tertiary">
                    {group.category}
                  </p>

                  {/* Items grid */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {group.items.map(c => {
                      const isChecked = selectedCriteria.has(c.key);
                      return (
                        <label
                          key={c.key}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                            isChecked ? 'border-accent bg-accent-subtle' : 'border-border bg-white'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleCriterion(c.key)}
                            className="shrink-0"
                          />
                          <span className={`text-sm truncate flex-1 ${c.inactive ? 'text-tertiary' : ''}`}>
                            {c.label}
                            {(c.inactive || c.flagOnly) && (
                              <em className="not-italic font-normal text-tertiary"> (note)</em>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Section 3: Score Format ──────────────────────────────────── */}
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2.5 text-tertiary">
              Score Format
            </p>
            <div className="flex flex-col gap-2">
              {FORMAT_OPTIONS.map(opt => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                    scoreFormat === opt.value ? 'border-accent bg-accent-subtle' : 'border-border bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="scoreFormat"
                    value={opt.value}
                    checked={scoreFormat === opt.value}
                    onChange={() => setScoreFormat(opt.value)}
                    className="shrink-0"
                  />
                  <span className="text-sm font-semibold text-primary">{opt.label}</span>
                  <span className="text-xs text-tertiary">{opt.desc}</span>
                </label>
              ))}
            </div>
          </section>

        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-border bg-white shrink-0">
          <button
            onClick={onClose}
            className="text-sm font-medium px-4 py-2 rounded-lg border border-border text-secondary transition-colors hover:bg-inactive"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={!canExport}
            className={`flex items-center gap-2 text-sm font-bold px-5 py-2 rounded-lg transition-colors ${
              canExport
                ? 'bg-accent text-white cursor-pointer'
                : 'bg-gray-200 text-tertiary cursor-default'
            }`}
          >
            <Download size={15} />
            Export {exportCount} listing{exportCount !== 1 ? 's' : ''}
          </button>
        </div>

      </div>
    </div>
  );
}
