/**
 * ListingCard — a single saved listing in the Saved tab.
 *
 * Collapsed view: name, address/price, score, verdict, status selector, expand toggle, delete.
 * Expanded view: full scorecard, ceiling/neighborhood/pet callouts, notes textarea,
 *                "Use in Decision Mode" button, saved timestamp.
 *
 * Props:
 *   listing           — saved listing object
 *   criteria          — current criteria array (for ScoreCard)
 *   onUpdate(id, obj) — persist changes to a listing
 *   onDelete(id)      — remove listing
 *   onUseInDecision   — fn(listing) opens Decision tab with this listing pre-loaded
 */
import { useState, useRef, useEffect } from 'react';
import ScoreCard from './ScoreCard';
import VerdictBadge from './VerdictBadge';

// ─────────────────────────────────────────────────────────────
// Status config
// ─────────────────────────────────────────────────────────────
const STATUSES = [
  { value: 'considering', label: 'Considering' },
  { value: 'toured',      label: 'Toured' },
  { value: 'applied',     label: 'Applied' },
  { value: 'rejected',    label: 'Rejected' },
];

const STATUS_ACTIVE_STYLE = {
  considering: { backgroundColor: '#f3f4f6', color: '#374151' },
  toured:      { backgroundColor: '#dbeafe', color: '#1565c0' },
  applied:     { backgroundColor: '#ccfbf1', color: '#0f766e' },
  rejected:    { backgroundColor: '#fee2e2', color: '#dc2626' },
};

// ─────────────────────────────────────────────────────────────
// Pet policy display
// ─────────────────────────────────────────────────────────────
const PET_STYLES = {
  safe:    { bg: '#e8f5e9', border: '#43a047', color: '#2e7d32', icon: '🐱', label: 'Cat-friendly' },
  risk:    { bg: '#ffebee', border: '#ef5350', color: '#c62828', icon: '⚠️', label: 'Pet risk — check policy' },
  unknown: { bg: '#fff8e1', border: '#ffb300', color: '#e65100', icon: '❓', label: 'Pet policy unknown' },
};

function Callout({ bg, border, color, children }) {
  return (
    <div
      className="rounded-lg px-4 py-3 text-sm border-l-4"
      style={{ backgroundColor: bg, borderLeftColor: border, color }}
    >
      {children}
    </div>
  );
}

function formatDate(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────
export default function ListingCard({ listing, criteria, onUpdate, onDelete, onUseInDecision }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(listing.name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [localNotes, setLocalNotes] = useState(listing.notes ?? '');
  const nameInputRef = useRef(null);

  // Focus name input when editing starts
  useEffect(() => {
    if (isEditingName) nameInputRef.current?.focus();
  }, [isEditingName]);

  function commitNameEdit() {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== listing.name) {
      onUpdate(listing.id, { name: trimmed });
    } else {
      setEditName(listing.name); // revert if empty or unchanged
    }
    setIsEditingName(false);
  }

  function handleNameKeyDown(e) {
    if (e.key === 'Enter') commitNameEdit();
    if (e.key === 'Escape') {
      setEditName(listing.name);
      setIsEditingName(false);
    }
  }

  function handleStatusChange(status) {
    onUpdate(listing.id, { status });
  }

  function handleNotesBlur() {
    if (localNotes !== listing.notes) {
      onUpdate(listing.id, { notes: localNotes });
    }
  }

  const petPolicy = listing.scores?.pet_policy;
  const petStyle = PET_STYLES[petPolicy] ?? null;
  const ceilingQuote = listing.scores?.ceiling_height;
  const neighborhoodNote = listing.scores?.neighborhood_note;

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: '#ffffff', borderColor: '#e8e8e8' }}
    >
      {/* ── Collapsed row ── */}
      <div className="px-5 py-4">

        {/* Top row: name + score + verdict */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            {/* Editable name */}
            {isEditingName ? (
              <input
                ref={nameInputRef}
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onBlur={commitNameEdit}
                onKeyDown={handleNameKeyDown}
                className="text-base font-bold rounded px-1 -mx-1 outline-none border-b-2 w-full"
                style={{ color: '#1a1a2e', borderBottomColor: '#2A7F7F', backgroundColor: 'transparent' }}
              />
            ) : (
              <button
                onClick={() => { setIsEditingName(true); setEditName(listing.name); }}
                className="text-base font-bold text-left hover:underline decoration-dashed truncate block w-full"
                style={{ color: '#1a1a2e' }}
                title="Click to rename"
              >
                {listing.name}
              </button>
            )}

            {/* Address + price */}
            <p className="text-sm mt-0.5 truncate" style={{ color: '#6b7280' }}>
              {[listing.address, listing.price].filter(Boolean).join(' · ')}
            </p>
          </div>

          {/* Score + verdict */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <span className="text-2xl font-extrabold" style={{ color: '#1a1a2e' }}>
                {listing.weighted_score}
              </span>
              <span className="text-xs ml-0.5" style={{ color: '#9ca3af' }}>/100</span>
            </div>
            <VerdictBadge verdict={listing.verdict} size="sm" />
          </div>
        </div>

        {/* Status pill group */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {STATUSES.map(s => {
            const isActive = listing.status === s.value;
            return (
              <button
                key={s.value}
                onClick={() => handleStatusChange(s.value)}
                className="px-3 py-1 rounded-full text-xs font-semibold transition-colors"
                style={
                  isActive
                    ? STATUS_ACTIVE_STYLE[s.value]
                    : { backgroundColor: '#f9fafb', color: '#9ca3af' }
                }
              >
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Bottom row: expand toggle + delete */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setIsExpanded(v => !v)}
            className="text-sm font-medium"
            style={{ color: '#2A7F7F' }}
          >
            {isExpanded ? 'Hide details ↑' : 'View details ↓'}
          </button>

          {/* Delete with confirmation */}
          {showDeleteConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: '#6b7280' }}>Delete this listing?</span>
              <button
                onClick={() => onDelete(listing.id)}
                className="text-xs font-semibold px-2.5 py-1 rounded"
                style={{ backgroundColor: '#ffebee', color: '#ef5350' }}
              >
                Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="text-xs font-medium px-2.5 py-1 rounded"
                style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-lg leading-none px-1 transition-opacity opacity-40 hover:opacity-100"
              style={{ color: '#ef5350' }}
              title="Delete listing"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* ── Expanded detail view ── */}
      {isExpanded && (
        <div
          className="px-5 pb-5 border-t flex flex-col gap-4"
          style={{ borderColor: '#f3f4f6' }}
        >
          <div className="pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#9ca3af' }}>
              Scorecard
            </p>
            <ScoreCard scores={listing.scores} criteria={criteria} />
          </div>

          {/* Neighborhood note */}
          {neighborhoodNote && (
            <Callout bg="#e0f2f1" border="#2A7F7F" color="#00695c">
              <span className="font-semibold">📍 Location: </span>
              {neighborhoodNote}
            </Callout>
          )}

          {/* Ceiling height */}
          {ceilingQuote && (
            <Callout bg="#e8f5e9" border="#43a047" color="#2e7d32">
              <span className="font-semibold">⬆️ Ceiling: </span>
              &ldquo;{ceilingQuote}&rdquo;
            </Callout>
          )}

          {/* Pet policy */}
          {petStyle && (
            <Callout bg={petStyle.bg} border={petStyle.border} color={petStyle.color}>
              <span className="font-semibold">{petStyle.icon} {petStyle.label}</span>
            </Callout>
          )}

          {/* Notes */}
          <div>
            <label
              className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
              style={{ color: '#9ca3af' }}
            >
              Personal notes
            </label>
            <textarea
              value={localNotes}
              onChange={e => setLocalNotes(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder="Add your own notes about this listing…"
              rows={3}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none"
              style={{ borderColor: '#e8e8e8', color: '#1a1a2e' }}
              onFocus={e => (e.target.style.borderColor = '#2A7F7F')}
            />
          </div>

          {/* Footer: Use in Decision Mode + timestamp */}
          <div className="flex items-center justify-between gap-4 pt-1">
            <button
              onClick={() => onUseInDecision(listing)}
              className="text-sm font-semibold px-4 py-2 rounded-lg border transition-colors"
              style={{ color: '#2A7F7F', borderColor: '#2A7F7F', backgroundColor: '#ffffff' }}
            >
              ⚖️ Use in Decision Mode
            </button>

            <span className="text-xs" style={{ color: '#9ca3af' }}>
              Saved {formatDate(listing.savedAt)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
