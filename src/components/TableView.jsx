/**
 * TableView — transposed comparison table for the Saved tab.
 *
 * Layout:
 *   Rows    = criteria labels  (sticky first column)
 *   Columns = listings         (sticky thead row)
 *
 * Row order (tbody):
 *   1. Expanded ListingCard row (colspan all, appears when header is clicked)
 *   2. Score row (top)
 *   3. Verdict row (top)
 *   4. Scored criteria rows   — ScorePill per cell; price/green_lake also show raw value
 *   5. Flag-only rows         — pet_policy shows styled pill; ceiling/neighborhood show raw string
 *   6. Score row (bottom repeat)
 *   7. Verdict row (bottom repeat)
 *
 * Props:
 *   listings        — filtered+sorted array from SavedTab
 *   criteria        — current criteria array
 *   onUpdate        — fn(id, changes)
 *   onDelete        — fn(id)
 *   onUseInDecision — fn(listing)
 *   onAddToCompare  — fn(listing)  (optional)
 *   compareQueue    — Set of listing IDs (optional)
 */
import { useState } from 'react';
import ScorePill from './ScorePill';
import VerdictBadge from './VerdictBadge';
import ListingCard from './ListingCard';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const LABEL_COL_W = 164;
const DATA_COL_W  = 176;

const PET_STYLES = {
  safe:    { bg: '#e8f5e9', color: '#2e7d32', icon: '🐱', label: 'Cat-friendly' },
  risk:    { bg: '#ffebee', color: '#c62828', icon: '⚠️', label: 'Pet risk' },
  unknown: { bg: '#fff8e1', color: '#e65100', icon: '❓', label: 'Unknown' },
};

// ─────────────────────────────────────────────────────────────
// Shared cell styles
// ─────────────────────────────────────────────────────────────

const CELL_BORDER = { borderBottom: '1px solid #f3f4f6' };

function stickyLabelStyle(bg) {
  return {
    position: 'sticky',
    left: 0,
    backgroundColor: bg,
    width: LABEL_COL_W,
    minWidth: LABEL_COL_W,
    zIndex: 1,
    ...CELL_BORDER,
  };
}

// ─────────────────────────────────────────────────────────────
// TableView
// ─────────────────────────────────────────────────────────────

export default function TableView({
  listings,
  criteria,
  onUpdate,
  onDelete,
  onUseInDecision,
  onAddToCompare,
  compareQueue,
}) {
  const [expandedId, setExpandedId] = useState(null);

  if (!listings.length) return null;

  const scoredCriteria = criteria.filter(c => !c.flagOnly);
  const flagCriteria   = criteria.filter(c =>  c.flagOnly);
  const colCount       = listings.length + 1; // +1 for the label column

  function toggleExpand(id) {
    setExpandedId(prev => (prev === id ? null : id));
  }

  // ── Cell renderers ────────────────────────────────────────────

  function ScoredCell({ listing, criterion }) {
    const score = listing.scores?.[criterion.key] ?? 'unclear';

    // Extra raw value shown below the pill for specific keys
    const extra =
      criterion.key === 'price'      ? listing.price       :
      criterion.key === 'green_lake' ? listing.neighborhood :
      null;

    return (
      <td
        className="px-3 py-2.5 text-center align-middle"
        style={{ minWidth: DATA_COL_W, borderLeft: '1px solid #f3f4f6', ...CELL_BORDER }}
      >
        <ScorePill score={score} />
        {extra && (
          <div
            className="text-xs mt-1 truncate mx-auto"
            style={{ color: '#6b7280', maxWidth: DATA_COL_W - 24 }}
          >
            {extra}
          </div>
        )}
      </td>
    );
  }

  function FlagCell({ listing, criterion }) {
    const val = listing.scores?.[criterion.key];

    let content;
    if (criterion.key === 'pet_policy') {
      const ps = PET_STYLES[val];
      content = ps ? (
        <span
          className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
          style={{ backgroundColor: ps.bg, color: ps.color }}
        >
          {ps.icon} {ps.label}
        </span>
      ) : (
        <span style={{ color: '#9ca3af' }}>—</span>
      );
    } else {
      // ceiling_height or neighborhood_note → raw string
      content = val ? (
        <span className="text-xs italic leading-snug" style={{ color: '#4b5563' }}>
          &ldquo;{val}&rdquo;
        </span>
      ) : (
        <span style={{ color: '#9ca3af' }}>—</span>
      );
    }

    return (
      <td
        className="px-3 py-2.5 text-center align-middle text-xs"
        style={{ minWidth: DATA_COL_W, borderLeft: '1px solid #f3f4f6', ...CELL_BORDER }}
      >
        {content}
      </td>
    );
  }

  // ── Row builders ──────────────────────────────────────────────

  function SummaryRow({ rowKey, label, renderCell }) {
    return (
      <tr key={rowKey} style={{ backgroundColor: '#fafafa' }}>
        <td
          className="px-4 py-3 text-xs font-semibold uppercase tracking-wide"
          style={stickyLabelStyle('#fafafa')}
        >
          <span style={{ color: '#9ca3af' }}>{label}</span>
        </td>
        {listings.map(l => renderCell(l))}
      </tr>
    );
  }

  function SectionDivider({ label }) {
    return (
      <tr>
        <td
          colSpan={colCount}
          className="px-4 py-1 text-xs font-semibold uppercase tracking-wide"
          style={{
            backgroundColor: '#f3f4f6',
            color: '#9ca3af',
            borderTop: '1px solid #e8e8e8',
            borderBottom: '1px solid #e8e8e8',
          }}
        >
          {label}
        </td>
      </tr>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: '#ffffff', borderColor: '#e8e8e8' }}
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>

          {/* ══════════════════ THEAD ══════════════════ */}
          <thead>
            <tr style={{ borderBottom: '2px solid #e8e8e8' }}>

              {/* Corner cell */}
              <th
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                style={{
                  position: 'sticky',
                  top: 0,
                  left: 0,
                  backgroundColor: '#ffffff',
                  color: '#9ca3af',
                  width: LABEL_COL_W,
                  minWidth: LABEL_COL_W,
                  zIndex: 3,
                  borderBottom: '2px solid #e8e8e8',
                }}
              >
                Criterion
              </th>

              {/* Listing column headers */}
              {listings.map(listing => {
                const isExpanded = expandedId === listing.id;
                const inQueue    = compareQueue?.has(listing.id);

                return (
                  <th
                    key={listing.id}
                    className="px-3 py-3 text-left align-top"
                    style={{
                      position: 'sticky',
                      top: 0,
                      minWidth: DATA_COL_W,
                      backgroundColor: isExpanded ? '#f0fafa' : '#ffffff',
                      borderLeft: '1px solid #f3f4f6',
                      borderBottom: '2px solid #e8e8e8',
                      verticalAlign: 'top',
                      zIndex: 2,
                    }}
                  >
                    {/* Name + expand arrow */}
                    <button
                      onClick={() => toggleExpand(listing.id)}
                      className="text-left w-full group"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span
                          className="text-sm font-bold leading-tight"
                          style={{ color: '#1a1a2e' }}
                        >
                          {listing.name}
                        </span>
                        <span
                          className="text-xs shrink-0 mt-0.5 font-medium"
                          style={{ color: '#2A7F7F' }}
                        >
                          {isExpanded ? '↑' : '↓'}
                        </span>
                      </div>
                      {(listing.address || listing.price) && (
                        <p className="text-xs mt-0.5 truncate" style={{ color: '#6b7280' }}>
                          {[listing.address, listing.price].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </button>

                    {/* Compare toggle */}
                    {onAddToCompare && (
                      <button
                        onClick={() => onAddToCompare(listing)}
                        className="mt-1.5 text-xs font-semibold px-2 py-0.5 rounded border transition-colors"
                        style={
                          inQueue
                            ? { color: '#ffffff', borderColor: '#1a1a2e', backgroundColor: '#1a1a2e' }
                            : { color: '#9ca3af', borderColor: '#e8e8e8', backgroundColor: '#ffffff' }
                        }
                      >
                        {inQueue ? '✓ Compare' : '+ Compare'}
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* ══════════════════ TBODY ══════════════════ */}
          <tbody>

            {/* ── Expanded ListingCard row (first in tbody) ── */}
            {expandedId && (() => {
              const expanded = listings.find(l => l.id === expandedId);
              return expanded ? (
                <tr>
                  <td
                    colSpan={colCount}
                    className="p-4"
                    style={{ backgroundColor: '#f0fafa', borderBottom: '1px solid #e8e8e8' }}
                  >
                    <ListingCard
                      listing={expanded}
                      criteria={criteria}
                      onUpdate={onUpdate}
                      onDelete={id => { setExpandedId(null); onDelete(id); }}
                      onUseInDecision={onUseInDecision}
                      onAddToCompare={onAddToCompare}
                      inCompareQueue={compareQueue?.has(expandedId)}
                    />
                  </td>
                </tr>
              ) : null;
            })()}

            {/* ── Verdict (top) ── */}
            <SummaryRow
              rowKey="verdict-top"
              label="Verdict"
              renderCell={l => (
                <td
                  key={l.id}
                  className="px-3 py-3 text-center"
                  style={{ minWidth: DATA_COL_W, borderLeft: '1px solid #f3f4f6', ...CELL_BORDER }}
                >
                  <VerdictBadge verdict={l.verdict} size="sm" />
                </td>
              )}
            />

            {/* ── Score (top) ── */}
            <SummaryRow
              rowKey="score-top"
              label="Score"
              renderCell={l => (
                <td
                  key={l.id}
                  className="px-3 py-3 text-center"
                  style={{ minWidth: DATA_COL_W, borderLeft: '1px solid #f3f4f6', ...CELL_BORDER }}
                >
                  <span className="text-2xl font-extrabold" style={{ color: '#1a1a2e' }}>
                    {l.weighted_score}
                  </span>
                  <span className="text-xs ml-0.5" style={{ color: '#9ca3af' }}>/100</span>
                </td>
              )}
            />

            {/* ── Scored criteria ── */}
            {scoredCriteria.length > 0 && (
              <>
                <SectionDivider label="Criteria" />
                {scoredCriteria.map((criterion, index) => {
                  // Tint the whole row if it's a disqualifier and any listing scores "no"
                  const anyDQ =
                    criterion.isDisqualifier &&
                    listings.some(l => (l.scores?.[criterion.key] ?? 'unclear') === 'no');

                  const rowBg = anyDQ ? '#fff5f5' : (index % 2 === 0 ? '#ffffff' : '#fafafa');

                  return (
                    <tr key={criterion.key} style={{ backgroundColor: rowBg }}>
                      {/* Label cell */}
                      <td
                        className="px-4 py-2.5 align-middle"
                        style={stickyLabelStyle(rowBg)}
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className="text-xs font-semibold w-5 shrink-0 text-right"
                            style={{ color: '#9ca3af' }}
                          >
                            #{index + 1}
                          </span>
                          <span
                            className="text-sm font-medium leading-snug"
                            style={{ color: '#1a1a2e' }}
                          >
                            {criterion.label}
                          </span>
                          {criterion.isDisqualifier && (
                            <span
                              className="text-xs px-1 py-0.5 rounded font-semibold shrink-0"
                              style={{ backgroundColor: '#ffebee', color: '#ef5350' }}
                            >
                              must
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Score cells */}
                      {listings.map(listing => (
                        <ScoredCell key={listing.id} listing={listing} criterion={criterion} />
                      ))}
                    </tr>
                  );
                })}
              </>
            )}

            {/* ── Flag-only criteria ── */}
            {flagCriteria.length > 0 && (
              <>
                <SectionDivider label="Flags" />
                {flagCriteria.map(criterion => (
                  <tr key={criterion.key} style={{ backgroundColor: '#ffffff' }}>
                    <td
                      className="px-4 py-2.5 align-middle"
                      style={stickyLabelStyle('#ffffff')}
                    >
                      <div className="flex items-center gap-1.5 pl-6">
                        <span
                          className="text-sm font-medium"
                          style={{ color: '#1a1a2e' }}
                        >
                          {criterion.label}
                        </span>
                      </div>
                    </td>
                    {listings.map(listing => (
                      <FlagCell key={listing.id} listing={listing} criterion={criterion} />
                    ))}
                  </tr>
                ))}
              </>
            )}

            {/* ── Verdict (bottom) ── */}
            <SummaryRow
              rowKey="verdict-bottom"
              label="Verdict"
              renderCell={l => (
                <td
                  key={l.id}
                  className="px-3 py-3 text-center"
                  style={{ minWidth: DATA_COL_W, borderLeft: '1px solid #f3f4f6', ...CELL_BORDER }}
                >
                  <VerdictBadge verdict={l.verdict} size="sm" />
                </td>
              )}
            />

            {/* ── Score (bottom) ── */}
            <SummaryRow
              rowKey="score-bottom"
              label="Score"
              renderCell={l => (
                <td
                  key={l.id}
                  className="px-3 py-3 text-center"
                  style={{ minWidth: DATA_COL_W, borderLeft: '1px solid #f3f4f6', ...CELL_BORDER }}
                >
                  <span className="text-2xl font-extrabold" style={{ color: '#1a1a2e' }}>
                    {l.weighted_score}
                  </span>
                  <span className="text-xs ml-0.5" style={{ color: '#9ca3af' }}>/100</span>
                </td>
              )}
            />

          </tbody>
        </table>
      </div>
    </div>
  );
}
