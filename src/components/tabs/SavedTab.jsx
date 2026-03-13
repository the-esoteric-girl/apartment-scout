/**
 * SavedTab — view, search, filter, sort, and manage all saved listings.
 *
 * Filters:
 *   - Text search (name / address)
 *   - Status pills (Considering / Toured / Applied / Rejected)
 *   - Bedrooms pills (Studio / 1BR / 2BR / 3BR / 4BR+)
 *   - Verdict pills (Apply / Tour / Skip)
 *   - Score floor (70+ / 45+ / Any)
 *   - Max rent (number input)
 *   - Neighborhood search (neighborhood field, falls back to address text)
 *   - Must-be-yes chips (one per scored criterion — dynamic from criteria prop)
 *
 * Props:
 *   criteria          — current criteria array
 *   listings          — all saved listing objects (from App state)
 *   onUpdate(id, obj) — persist field changes
 *   onDelete(id)      — remove a listing
 *   onUseInDecision   — fn(listing) → switches to Decision tab with listing preloaded
 *   onCompare         — fn(listing[]) → switches to Decision tab with multiple listings preloaded
 *   onGoToBrowse      — fn() → switches to Browse tab (used in empty state)
 */
import { useState, useMemo } from 'react';
import { SlidersHorizontal, ChevronDown, ChevronUp, Download } from 'lucide-react';
import EmptyState from '../EmptyState';
import ListingCard from '../ListingCard';
import ExportModal from '../ExportModal';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const STATUS_LABELS = {
  considering: 'Considering',
  toured: 'Toured',
  applied: 'Applied',
  rejected: 'Rejected',
};

const SORT_OPTIONS = [
  { value: 'score',  label: 'Highest score' },
  { value: 'price',  label: 'Lowest price' },
  { value: 'recent', label: 'Most recent' },
];

const STATUS_FILTERS = ['all', 'considering', 'toured', 'applied', 'rejected'];

const BEDROOM_OPTIONS = [
  { value: 'any',   label: 'Any' },
  { value: 'studio', label: 'Studio' },
  { value: '1br',   label: '1BR' },
  { value: '2br',   label: '2BR' },
  { value: '3br',   label: '3BR' },
  { value: '4br+',  label: '4BR+' },
];

const VERDICT_OPTIONS = [
  { value: 'any',   label: 'Any' },
  { value: 'apply', label: 'Apply' },
  { value: 'tour',  label: 'Tour' },
  { value: 'skip',  label: 'Skip' },
];

const SCORE_FLOOR_OPTIONS = [
  { value: 0,  label: 'Any' },
  { value: 70, label: '70+' },
  { value: 45, label: '45+' },
];

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function parsePrice(priceStr) {
  if (!priceStr) return Infinity;
  const match = priceStr.replace(/,/g, '').match(/\d+/);
  return match ? parseInt(match[0], 10) : Infinity;
}

// Neighborhood match: check listing.neighborhood first, fall back to address text
function matchesNeighborhood(listing, query) {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  if (listing.neighborhood) return listing.neighborhood.toLowerCase().includes(q);
  return listing.address?.toLowerCase().includes(q) ?? false;
}

// ─────────────────────────────────────────────────────────────
// PillGroup — reusable pill row
// ─────────────────────────────────────────────────────────────
function PillGroup({ options, value, onChange, getLabel }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => {
        const v = typeof opt === 'object' ? opt.value : opt;
        const label = getLabel ? getLabel(opt) : (typeof opt === 'object' ? opt.label : opt);
        const isActive = value === v;
        return (
          <button
            key={v}
            onClick={() => onChange(v)}
            className="px-3 py-1 rounded-full text-xs font-semibold transition-colors"
            style={
              isActive
                ? { backgroundColor: '#1a1a2e', color: '#ffffff', cursor: 'default' }
                : { backgroundColor: '#f3f4f6', color: '#6b7280', cursor: 'pointer' }
            }
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = '#e5e7eb'; }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = '#f3f4f6'; }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SummaryBar
// ─────────────────────────────────────────────────────────────
function SummaryBar({ listings, statusFilter, onSetFilter }) {
  const counts = listings.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] ?? 0) + 1;
    return acc;
  }, {});

  const parts = Object.entries(counts).map(([status, n]) => {
    const isActive = statusFilter === status;
    return (
      <button
        key={status}
        onClick={() => onSetFilter('statusFilter', isActive ? 'all' : status)}
        className="text-sm transition-colors"
        style={{
          color: isActive ? '#2A7F7F' : '#6b7280',
          fontWeight: isActive ? '600' : '400',
          textDecoration: isActive ? 'underline' : 'none',
          cursor: 'pointer',
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = '#1a1a2e'; }}
        onMouseLeave={e => { e.currentTarget.style.color = isActive ? '#2A7F7F' : '#6b7280'; }}
        title={isActive ? `Clear ${STATUS_LABELS[status] ?? status} filter` : `Filter by ${STATUS_LABELS[status] ?? status}`}
      >
        {n} {STATUS_LABELS[status] ?? status}
      </button>
    );
  });

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-5">
      <span className="text-sm font-bold text-primary">
        {listings.length} listing{listings.length !== 1 ? 's' : ''}
      </span>
      {parts.length > 0 && (
        <>
          <span className="text-border">·</span>
          <span className="flex flex-wrap gap-x-3 text-sm">
            {parts.reduce((acc, el, i) => [
              ...acc,
              i > 0 && <span key={`sep-${i}`} style={{ color: '#d1d5db' }}>·</span>,
              el,
            ], [])}
          </span>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// FilterPanel
// ─────────────────────────────────────────────────────────────
function FilterPanel({ filters, setFilter, resetAllFilters, activeFilterCount, scoredCriteria }) {
  const {
    statusFilter, bedroomsFilter, verdictFilter,
    scoreFloor, maxRent, neighborhoodSearch, mustBeYes,
  } = filters;

  function toggleMustBeYes(key) {
    setFilter('mustBeYes', prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Status */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide mb-2 text-tertiary">Status</p>
        <PillGroup
          options={STATUS_FILTERS}
          value={statusFilter}
          onChange={v => setFilter('statusFilter', v)}
          getLabel={v => v === 'all' ? 'All' : STATUS_LABELS[v]}
        />
      </div>

      {/* Row 3: Bedrooms + Verdict */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide mb-2 text-tertiary">Bedrooms</p>
          <PillGroup
            options={BEDROOM_OPTIONS}
            value={bedroomsFilter}
            onChange={v => setFilter('bedroomsFilter', v)}
          />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide mb-2 text-tertiary">Verdict</p>
          <PillGroup
            options={VERDICT_OPTIONS}
            value={verdictFilter}
            onChange={v => setFilter('verdictFilter', v)}
          />
        </div>
      </div>

      {/* Row 4: Score floor + Max rent + Neighborhood */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2 text-tertiary">Score</p>
          <PillGroup
            options={SCORE_FLOOR_OPTIONS}
            value={scoreFloor}
            onChange={v => setFilter('scoreFloor', v)}
          />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide mb-2 text-tertiary">Max rent</p>
          <input
            type="number"
            value={maxRent}
            onChange={e => setFilter('maxRent', e.target.value)}
            placeholder="e.g. 2000"
            min={0}
            className="w-full rounded-lg border px-3 py-1.5 text-sm outline-none border-border text-primary bg-white"
            onFocus={e => (e.target.style.borderColor = '#2A7F7F')}
            onBlur={e => (e.target.style.borderColor = '#e8e8e8')}
          />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide mb-2 text-tertiary">Neighborhood</p>
          <input
            type="text"
            value={neighborhoodSearch}
            onChange={e => setFilter('neighborhoodSearch', e.target.value)}
            placeholder="e.g. Capitol Hill"
            className="w-full rounded-lg border px-3 py-1.5 text-sm outline-none border-border text-primary bg-white"
            onFocus={e => (e.target.style.borderColor = '#2A7F7F')}
            onBlur={e => (e.target.style.borderColor = '#e8e8e8')}
          />
        </div>
      </div>

      {/* Row 5: Must be yes — dynamic scored criteria chips */}
      {scoredCriteria.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2 text-tertiary">Must be yes</p>
          <div className="flex flex-wrap gap-1.5">
            {scoredCriteria.map(c => {
              const isActive = mustBeYes.has(c.key);
              return (
                <button
                  key={c.key}
                  onClick={() => toggleMustBeYes(c.key)}
                  className="px-3 py-1 rounded-full text-xs font-semibold border transition-colors"
                  style={
                    isActive
                      ? { backgroundColor: '#2A7F7F', color: '#ffffff', borderColor: '#2A7F7F', cursor: 'pointer' }
                      : { backgroundColor: '#f3f4f6', color: '#6b7280', borderColor: 'transparent', cursor: 'pointer' }
                  }
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = '#e5e7eb'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = '#f3f4f6'; }}
                >
                  {isActive ? '✓ ' : ''}{c.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Clear all */}
      {activeFilterCount > 0 && (
        <div className="pt-1 border-t border-inactive">
          <button
            onClick={resetAllFilters}
            className="text-xs font-semibold text-accent"
          >
            Clear all filters ({activeFilterCount} active)
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

export default function SavedTab({
  criteria, listings, onUpdate, onDelete, onUseInDecision, onCompareMany, onGoToBrowse,
  filters, onSetFilter, onResetFilters,
  compareQueue, onToggleCompare, onClearCompareQueue,
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  function toggleCompare(listing) {
    onToggleCompare(listing.id);
  }

  function handleCompareSelected() {
    const selected = listings.filter(l => compareQueue.has(l.id));
    if (selected.length >= 2) {
      onCompareMany(selected);
      onClearCompareQueue();
    }
  }

  // Scored criteria (not flagOnly) — used for must-be-yes chips
  const scoredCriteria = useMemo(
    () => criteria.filter(c => !c.flagOnly),
    [criteria]
  );

  // Count active filters (excluding sort, which is always set)
  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.search.trim()) n++;
    if (filters.statusFilter !== 'all') n++;
    if (filters.bedroomsFilter !== 'any') n++;
    if (filters.verdictFilter !== 'any') n++;
    if (filters.scoreFloor > 0) n++;
    if (filters.maxRent !== '') n++;
    if (filters.neighborhoodSearch.trim()) n++;
    n += filters.mustBeYes.size;
    return n;
  }, [filters]);

  const displayed = useMemo(() => {
    let result = [...listings];

    if (filters.statusFilter !== 'all') {
      result = result.filter(l => l.status === filters.statusFilter);
    }
    if (filters.verdictFilter !== 'any') {
      result = result.filter(l => l.verdict === filters.verdictFilter);
    }
    if (filters.scoreFloor > 0) {
      result = result.filter(l => l.weighted_score >= filters.scoreFloor);
    }
    if (filters.maxRent !== '') {
      const cap = parseInt(filters.maxRent, 10);
      if (!isNaN(cap)) result = result.filter(l => parsePrice(l.price) <= cap);
    }
    if (filters.bedroomsFilter !== 'any') {
      result = result.filter(l => l.bedrooms === filters.bedroomsFilter);
    }
    if (filters.neighborhoodSearch.trim()) {
      result = result.filter(l => matchesNeighborhood(l, filters.neighborhoodSearch));
    }
    if (filters.mustBeYes.size > 0) {
      result = result.filter(l =>
        [...filters.mustBeYes].every(key => l.scores?.[key] === 'yes')
      );
    }
    if (filters.search.trim()) {
      const q = filters.search.toLowerCase();
      result = result.filter(l =>
        l.name?.toLowerCase().includes(q) ||
        l.address?.toLowerCase().includes(q)
      );
    }

    if (filters.sortBy === 'score') {
      result.sort((a, b) => b.weighted_score - a.weighted_score);
    } else if (filters.sortBy === 'price') {
      result.sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
    } else if (filters.sortBy === 'recent') {
      result.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
    }

    return result;
  }, [listings, filters]);

  if (listings.length === 0) {
    return (
      <div className="mx-auto" style={{ maxWidth: '780px' }}>
        <EmptyState onGoToBrowse={onGoToBrowse} />
      </div>
    );
  }

  const compareCount = compareQueue.size;

  return (
    <div className="mx-auto pb-24" style={{ maxWidth: '780px' }}>
      <SummaryBar listings={listings} statusFilter={filters.statusFilter} onSetFilter={onSetFilter} />

      {/* ── Always-visible search + sort + export ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <input
          type="text"
          value={filters.search}
          onChange={e => onSetFilter('search', e.target.value)}
          placeholder="Search by name or address…"
          className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none border-border text-primary bg-white"
          onFocus={e => (e.target.style.borderColor = '#2A7F7F')}
          onBlur={e => (e.target.style.borderColor = '#e8e8e8')}
        />
        <select
          value={filters.sortBy}
          onChange={e => onSetFilter('sortBy', e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm outline-none border-border text-primary bg-white cursor-pointer"
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          onClick={() => setExportOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold transition-colors border-border text-secondary bg-white shrink-0"
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#2A7F7F'; e.currentTarget.style.color = '#2A7F7F'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.color = '#6b7280'; }}
          title="Export listings to CSV"
        >
          <Download size={15} />
          Export
        </button>
      </div>

      {/* ── Collapsible filter panel ── */}
      <div className="rounded-xl border mb-5 overflow-hidden bg-white border-border">
        <button
          onClick={() => setFiltersOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={14} className="text-tertiary" />
            <span className="text-sm font-semibold text-primary">Filters</span>
            {activeFilterCount > 0 && (
              <span
                className="rounded-full px-2 py-0 text-xs font-bold text-white bg-accent"
                style={{ fontSize: '11px' }}
              >
                {activeFilterCount}
              </span>
            )}
          </div>
          {filtersOpen
            ? <ChevronUp size={15} className="text-tertiary" />
            : <ChevronDown size={15} className="text-tertiary" />
          }
        </button>

        {filtersOpen && (
          <div className="border-t px-4 pb-4 pt-3 flex flex-col gap-4 border-inactive">
            <FilterPanel
              filters={filters}
              setFilter={onSetFilter}
              resetAllFilters={onResetFilters}
              activeFilterCount={activeFilterCount}
              scoredCriteria={scoredCriteria}
            />
          </div>
        )}
      </div>

      {displayed.length === 0 ? (
        <div className="rounded-xl border py-12 text-center flex flex-col items-center gap-3 border-border bg-white">
          <p className="text-sm text-tertiary">No listings match your filters.</p>
          <button
            onClick={onResetFilters}
            className="text-sm font-semibold px-4 py-1.5 rounded-lg border transition-colors border-border text-secondary"
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f3f4f6'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {displayed.map(listing => (
            <ListingCard
              key={listing.id}
              listing={listing}
              criteria={criteria}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onUseInDecision={onUseInDecision}
              onAddToCompare={toggleCompare}
              inCompareQueue={compareQueue.has(listing.id)}
            />
          ))}
        </div>
      )}

      {/* ── Export modal ── */}
      {exportOpen && (
        <ExportModal
          listings={listings}
          criteria={criteria}
          onClose={() => setExportOpen(false)}
        />
      )}

      {/* ── Sticky compare bar ── */}
      {compareCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-4 px-5 py-4 border-t shadow-lg bg-primary border-accent">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-sm font-semibold text-white shrink-0">
              {compareCount} selected
            </span>
            <div className="flex flex-wrap gap-1.5 min-w-0">
              {listings
                .filter(l => compareQueue.has(l.id))
                .map(l => (
                  <span
                    key={l.id}
                    className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1 bg-accent text-white"
                  >
                    {l.name}
                    <button
                      onClick={() => toggleCompare(l)}
                      className="opacity-70 hover:opacity-100 leading-none"
                    >
                      ×
                    </button>
                  </span>
                ))}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onClearCompareQueue}
              className="text-xs font-medium px-3 py-1.5 rounded-lg text-tertiary"
            >
              Cancel
            </button>
            <button
              onClick={handleCompareSelected}
              disabled={compareCount < 2 || compareCount > 4}
              className="text-sm font-bold px-5 py-2 rounded-lg transition-colors"
              style={
                compareCount >= 2 && compareCount <= 4
                  ? { backgroundColor: '#2A7F7F', color: '#ffffff', cursor: 'pointer' }
                  : { backgroundColor: '#374151', color: '#9ca3af', cursor: 'default' }
              }
            >
              Compare {compareCount} →
            </button>
          </div>

          {compareCount > 4 && (
            <p className="absolute bottom-full left-0 right-0 text-center text-xs py-1 bg-score-no text-white">
              Max 4 listings
            </p>
          )}
        </div>
      )}
    </div>
  );
}
