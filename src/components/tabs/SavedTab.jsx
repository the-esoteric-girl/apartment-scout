/**
 * SavedTab — view, search, filter, sort, and manage all saved listings.
 *
 * Layout: single column, max-width 780px.
 *
 * Props:
 *   criteria          — current criteria array
 *   listings          — all saved listing objects (from App state)
 *   onUpdate(id, obj) — persist field changes
 *   onDelete(id)      — remove a listing
 *   onUseInDecision   — fn(listing) → switches to Decision tab with listing preloaded
 *   onGoToBrowse      — fn() → switches to Browse tab (used in empty state)
 */
import { useState, useMemo } from 'react';
import EmptyState from '../EmptyState';
import ListingCard from '../ListingCard';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const STATUS_LABELS = {
  considering: 'Considering',
  toured: 'Toured',
  applied: 'Applied',
  rejected: 'Rejected',
};

// Extract a numeric price from strings like "$1,800/mo", "1800", "1,950/month"
function parsePrice(priceStr) {
  if (!priceStr) return Infinity;
  const match = priceStr.replace(/,/g, '').match(/\d+/);
  return match ? parseInt(match[0], 10) : Infinity;
}

const SORT_OPTIONS = [
  { value: 'score',  label: 'Highest score' },
  { value: 'price',  label: 'Lowest price' },
  { value: 'recent', label: 'Most recent' },
];

const STATUS_FILTERS = ['all', 'considering', 'toured', 'applied', 'rejected'];

// ─────────────────────────────────────────────────────────────
// Summary bar
// ─────────────────────────────────────────────────────────────
function SummaryBar({ listings }) {
  const counts = listings.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] ?? 0) + 1;
    return acc;
  }, {});

  const parts = Object.entries(counts).map(([status, n]) => (
    <span key={status} style={{ color: '#6b7280' }}>
      {n} {STATUS_LABELS[status] ?? status}
    </span>
  ));

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-5">
      <span className="text-sm font-bold" style={{ color: '#1a1a2e' }}>
        {listings.length} listing{listings.length !== 1 ? 's' : ''}
      </span>
      {parts.length > 0 && (
        <>
          <span style={{ color: '#e8e8e8' }}>·</span>
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
// Main component
// ─────────────────────────────────────────────────────────────
export default function SavedTab({ criteria, listings, onUpdate, onDelete, onUseInDecision, onGoToBrowse }) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('score');
  const [statusFilter, setStatusFilter] = useState('all');

  // Filter + sort — memoised so it only recalculates when inputs change
  const displayed = useMemo(() => {
    let result = [...listings];

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter(l => l.status === statusFilter);
    }

    // Filter by search (name, address)
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        l.name?.toLowerCase().includes(q) ||
        l.address?.toLowerCase().includes(q)
      );
    }

    // Sort
    if (sortBy === 'score') {
      result.sort((a, b) => b.weighted_score - a.weighted_score);
    } else if (sortBy === 'price') {
      result.sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
    } else if (sortBy === 'recent') {
      result.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
    }

    return result;
  }, [listings, search, sortBy, statusFilter]);

  // ── Empty state ──
  if (listings.length === 0) {
    return (
      <div className="mx-auto" style={{ maxWidth: '780px' }}>
        <EmptyState onGoToBrowse={onGoToBrowse} />
      </div>
    );
  }

  return (
    <div className="mx-auto" style={{ maxWidth: '780px' }}>

      {/* ── Summary bar ── */}
      <SummaryBar listings={listings} />

      {/* ── Controls row ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        {/* Search */}
        <div className="flex-1">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or address…"
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ borderColor: '#e8e8e8', color: '#1a1a2e', backgroundColor: '#ffffff' }}
            onFocus={e => (e.target.style.borderColor = '#2A7F7F')}
            onBlur={e => (e.target.style.borderColor = '#e8e8e8')}
          />
        </div>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm outline-none"
          style={{ borderColor: '#e8e8e8', color: '#1a1a2e', backgroundColor: '#ffffff', cursor: 'pointer' }}
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* ── Status filter pills ── */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {STATUS_FILTERS.map(s => {
          const isActive = statusFilter === s;
          const label = s === 'all' ? 'All' : STATUS_LABELS[s];
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors"
              style={
                isActive
                  ? { backgroundColor: '#1a1a2e', color: '#ffffff' }
                  : { backgroundColor: '#f3f4f6', color: '#6b7280' }
              }
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Listing cards ── */}
      {displayed.length === 0 ? (
        <div
          className="rounded-xl border py-12 text-center flex flex-col items-center gap-3"
          style={{ borderColor: '#e8e8e8', backgroundColor: '#ffffff' }}
        >
          <p className="text-sm" style={{ color: '#9ca3af' }}>No listings match your filters.</p>
          <button
            onClick={() => { setSearch(''); setStatusFilter('all'); }}
            className="text-sm font-semibold px-4 py-1.5 rounded-lg border transition-colors"
            style={{ borderColor: '#e8e8e8', color: '#6b7280' }}
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
