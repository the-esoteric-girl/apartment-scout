/**
 * DecisionTab — compare 2–4 listings side by side.
 *
 * Each slot can pull from a saved listing (uses stored rawText) or accept
 * pasted new text. Claude analyzes all slots together in decision mode,
 * returning strengths/concerns/winner/tradeoff for each listing.
 *
 * Architectural note (decision log #2):
 *   When ALL slots are saved listings, stored scores/verdict are used directly
 *   and Claude is NOT called. When at least one slot is new (pasted text),
 *   Claude is called; saved slots contribute a brief score summary (not rawText)
 *   to keep the prompt small.
 *
 * Props:
 *   criteria          — current criteria array
 *   listings          — all saved listings (for "From saved" dropdowns)
 *   preloadListing    — a listing object to pre-load into slot 0 (from Saved tab)
 *   onPreloadConsumed — fn() called after preload is consumed into state
 *   onSave            — fn(listing) saves a new result listing
 */
import { useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { buildSystemPrompt, buildDecisionPrompt, analyzeListing } from '../../utils/claude';
import ScoreCard from '../ScoreCard';
import ScorePill from '../ScorePill';
import VerdictBadge from '../VerdictBadge';

// ─────────────────────────────────────────────────────────────
// DecisionTable — transposed criteria table for results
// ─────────────────────────────────────────────────────────────

const DT_LABEL_W = 160;
const DT_COL_W   = 180;
const DT_CELL_BORDER = { borderBottom: '1px solid #f3f4f6' };

function dtStickyLabel(bg) {
  return {
    position: 'sticky',
    left: 0,
    backgroundColor: bg,
    width: DT_LABEL_W,
    minWidth: DT_LABEL_W,
    zIndex: 1,
    ...DT_CELL_BORDER,
  };
}

function DecisionTable({ results, criteria, winnerIndex, isAlreadySaved, savedIndices, onSave }) {
  const listings    = results.listings ?? [];
  const scoredCriteria = criteria.filter(c => !c.flagOnly);
  const hasAnalysis = listings.some(l => l.strengths?.length || l.concerns?.length);
  const allSaved    = !hasAnalysis; // all-saved mode produces no strengths/concerns

  const colCount = listings.length + 1;

  // ── shared row builders ────────────────────────────────────

  function SummaryRow({ rowKey, label, renderCell }) {
    return (
      <tr key={rowKey} style={{ backgroundColor: '#fafafa' }}>
        <td
          className="px-4 py-3 text-xs font-semibold uppercase tracking-wide"
          style={dtStickyLabel('#fafafa')}
        >
          <span style={{ color: '#9ca3af' }}>{label}</span>
        </td>
        {listings.map((l, i) => renderCell(l, i))}
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

  const verdictRow = (key) => (
    <SummaryRow
      key={key}
      rowKey={key}
      label="Verdict"
      renderCell={(l, i) => (
        <td
          key={i}
          className="px-3 py-3 text-center"
          style={{
            minWidth: DT_COL_W,
            borderLeft: '1px solid #f3f4f6',
            backgroundColor: i === winnerIndex ? '#f0fafa' : 'transparent',
            ...DT_CELL_BORDER,
          }}
        >
          <VerdictBadge verdict={l.verdict} size="sm" />
        </td>
      )}
    />
  );

  const scoreRow = (key) => (
    <SummaryRow
      key={key}
      rowKey={key}
      label="Score"
      renderCell={(l, i) => (
        <td
          key={i}
          className="px-3 py-3 text-center"
          style={{
            minWidth: DT_COL_W,
            borderLeft: '1px solid #f3f4f6',
            backgroundColor: i === winnerIndex ? '#f0fafa' : 'transparent',
            ...DT_CELL_BORDER,
          }}
        >
          <span className="text-2xl font-extrabold" style={{ color: '#1a1a2e' }}>
            {Math.round(l.weighted_score)}
          </span>
          <span className="text-xs ml-0.5" style={{ color: '#9ca3af' }}>/100</span>
        </td>
      )}
    />
  );

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: '#ffffff', borderColor: '#e8e8e8' }}
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>

          {/* ── THEAD ── */}
          <thead>
            <tr style={{ borderBottom: '2px solid #e8e8e8' }}>
              {/* Corner */}
              <th
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                style={{
                  position: 'sticky',
                  top: 0,
                  left: 0,
                  backgroundColor: '#ffffff',
                  color: '#9ca3af',
                  width: DT_LABEL_W,
                  minWidth: DT_LABEL_W,
                  zIndex: 3,
                  borderBottom: '2px solid #e8e8e8',
                }}
              >
                Criterion
              </th>

              {listings.map((l, i) => {
                const isWinner = i === winnerIndex;
                const saved    = isAlreadySaved(i) || savedIndices.has(i);
                return (
                  <th
                    key={i}
                    className="px-3 py-3 text-left align-top"
                    style={{
                      position: 'sticky',
                      top: 0,
                      minWidth: DT_COL_W,
                      backgroundColor: isWinner ? '#e0f2f1' : '#ffffff',
                      borderLeft: '1px solid #f3f4f6',
                      borderBottom: '2px solid #e8e8e8',
                      verticalAlign: 'top',
                      zIndex: 2,
                    }}
                  >
                    {isWinner && (
                      <p className="text-xs font-bold mb-1" style={{ color: '#2A7F7F' }}>✦ Top Pick</p>
                    )}
                    <p className="text-sm font-bold leading-tight" style={{ color: '#1a1a2e' }}>
                      {l.name}
                    </p>
                    {(l.address || l.price) && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: '#6b7280' }}>
                        {[l.address, l.price].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    <button
                      onClick={() => !saved && onSave(l, i)}
                      disabled={saved}
                      className="mt-2 text-xs font-semibold px-2.5 py-1 rounded border transition-colors"
                      style={
                        saved
                          ? { backgroundColor: '#f3f4f6', color: '#9ca3af', borderColor: '#e8e8e8', cursor: 'default' }
                          : { backgroundColor: '#ffffff', color: '#2A7F7F', borderColor: '#2A7F7F', cursor: 'pointer' }
                      }
                    >
                      {saved ? 'Saved ✓' : 'Save'}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* ── TBODY ── */}
          <tbody>

            {/* Verdict + Score (top) */}
            {verdictRow('verdict-top')}
            {scoreRow('score-top')}

            {/* Scored criteria */}
            {scoredCriteria.length > 0 && (
              <>
                <SectionDivider label="Criteria" />
                {scoredCriteria.map((criterion, index) => {
                  const anyDQ =
                    criterion.isDisqualifier &&
                    listings.some(l => (l.scores?.[criterion.key] ?? 'unclear') === 'no');
                  const rowBg = anyDQ ? '#fff5f5' : (index % 2 === 0 ? '#ffffff' : '#fafafa');

                  return (
                    <tr key={criterion.key} style={{ backgroundColor: rowBg }}>
                      <td
                        className="px-4 py-2.5 align-middle"
                        style={dtStickyLabel(rowBg)}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold w-5 shrink-0 text-right" style={{ color: '#9ca3af' }}>
                            {index + 1}
                          </span>
                          <span className="text-sm font-medium leading-snug" style={{ color: '#1a1a2e' }}>
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
                      {listings.map((l, i) => {
                        const score = l.scores?.[criterion.key] ?? 'unclear';
                        const extra =
                          criterion.key === 'price'      ? l.price       :
                          criterion.key === 'green_lake' ? l.neighborhood :
                          null;
                        return (
                          <td
                            key={i}
                            className="px-3 py-2.5 text-center align-middle"
                            style={{
                              minWidth: DT_COL_W,
                              borderLeft: '1px solid #f3f4f6',
                              backgroundColor: i === winnerIndex ? '#f5fffe' : 'transparent',
                              ...DT_CELL_BORDER,
                            }}
                          >
                            <ScorePill score={score} />
                            {extra && (
                              <div className="text-xs mt-1 truncate mx-auto" style={{ color: '#6b7280', maxWidth: DT_COL_W - 24 }}>
                                {extra}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </>
            )}

            {/* Analysis: Strengths / Concerns */}
            <SectionDivider label="Analysis" />
            {allSaved ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-3">
                  <span className="text-xs italic" style={{ color: '#9ca3af' }}>
                    Strengths and concerns are not available when comparing saved listings — Claude was not called.
                  </span>
                </td>
              </tr>
            ) : (
              <>
                <tr style={{ backgroundColor: '#ffffff' }}>
                  <td
                    className="px-4 py-2.5 align-top"
                    style={dtStickyLabel('#ffffff')}
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide pl-6" style={{ color: '#43a047' }}>
                      Strengths
                    </span>
                  </td>
                  {listings.map((l, i) => (
                    <td
                      key={i}
                      className="px-3 py-2.5 align-top text-xs"
                      style={{ minWidth: DT_COL_W, borderLeft: '1px solid #f3f4f6', backgroundColor: i === winnerIndex ? '#f5fffe' : 'transparent', ...DT_CELL_BORDER }}
                    >
                      {l.strengths?.length ? (
                        <ul className="flex flex-col gap-0.5">
                          {l.strengths.map((s, j) => (
                            <li key={j} className="flex gap-1 items-start" style={{ color: '#374151' }}>
                              <span style={{ color: '#43a047' }}>✓</span> {s}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>—</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr style={{ backgroundColor: '#fafafa' }}>
                  <td
                    className="px-4 py-2.5 align-top"
                    style={dtStickyLabel('#fafafa')}
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide pl-6" style={{ color: '#ef5350' }}>
                      Concerns
                    </span>
                  </td>
                  {listings.map((l, i) => (
                    <td
                      key={i}
                      className="px-3 py-2.5 align-top text-xs"
                      style={{ minWidth: DT_COL_W, borderLeft: '1px solid #f3f4f6', backgroundColor: i === winnerIndex ? '#f5fffe' : 'transparent', ...DT_CELL_BORDER }}
                    >
                      {l.concerns?.length ? (
                        <ul className="flex flex-col gap-0.5">
                          {l.concerns.map((c, j) => (
                            <li key={j} className="flex gap-1 items-start" style={{ color: '#374151' }}>
                              <span style={{ color: '#ef5350' }}>✗</span> {c}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>—</span>
                      )}
                    </td>
                  ))}
                </tr>
              </>
            )}

            {/* Verdict + Score (bottom) */}
            {verdictRow('verdict-bottom')}
            {scoreRow('score-bottom')}

          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

export function createSlot(mode = 'new', savedListing = null) {
  return { id: uuidv4(), mode, savedListing, urlOrLabel: '', text: '' };
}

function isSlotValid(slot) {
  if (slot.mode === 'saved') return slot.savedListing !== null;
  return slot.text.trim().length > 20;
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// SlotInput — one comparison slot
// ─────────────────────────────────────────────────────────────
function SlotInput({ slot, index, totalSlots, savedListings, onChange, onRemove }) {
  const canRemove = totalSlots > 2;

  function setMode(mode) {
    onChange({ mode, savedListing: null, urlOrLabel: '', text: '' });
  }

  const hasSaved = savedListings.length > 0;

  return (
    <div
      className="rounded-xl border p-5 flex flex-col gap-4"
      style={{ backgroundColor: '#ffffff', borderColor: '#e8e8e8' }}
    >
      {/* Slot header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#9ca3af' }}>
          Listing {index + 1}
        </span>

        <div className="flex items-center gap-2">
          {/* Mode toggle pills */}
          {hasSaved && (
            <div
              className="flex rounded-lg overflow-hidden border text-xs font-semibold"
              style={{ borderColor: '#e8e8e8' }}
            >
              <button
                onClick={() => setMode('saved')}
                className="px-2.5 py-1 transition-colors"
                style={
                  slot.mode === 'saved'
                    ? { backgroundColor: '#1a1a2e', color: '#ffffff' }
                    : { backgroundColor: '#f9fafb', color: '#6b7280' }
                }
              >
                From saved
              </button>
              <button
                onClick={() => setMode('new')}
                className="px-2.5 py-1 transition-colors"
                style={
                  slot.mode === 'new'
                    ? { backgroundColor: '#1a1a2e', color: '#ffffff' }
                    : { backgroundColor: '#f9fafb', color: '#6b7280' }
                }
              >
                Paste new
              </button>
            </div>
          )}

          {/* Remove button */}
          {canRemove && (
            <button
              onClick={onRemove}
              className="text-lg leading-none px-1 opacity-40 hover:opacity-100 transition-opacity"
              style={{ color: '#ef5350' }}
              title="Remove this slot"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* From saved */}
      {slot.mode === 'saved' && (
        <div>
          <select
            value={slot.savedListing?.id ?? ''}
            onChange={e => {
              const found = savedListings.find(l => l.id === e.target.value) ?? null;
              onChange({ savedListing: found });
            }}
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ borderColor: '#e8e8e8', color: slot.savedListing ? '#1a1a2e' : '#9ca3af', backgroundColor: '#ffffff', cursor: 'pointer' }}
          >
            <option value="">Select a saved listing…</option>
            {savedListings.map(l => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>

          {/* Preview of selected saved listing */}
          {slot.savedListing && (
            <div
              className="mt-3 rounded-lg px-3 py-2 text-sm flex items-center justify-between"
              style={{ backgroundColor: '#f7f7f5' }}
            >
              <div>
                <span className="font-medium" style={{ color: '#1a1a2e' }}>{slot.savedListing.name}</span>
                {slot.savedListing.price && (
                  <span className="ml-2" style={{ color: '#6b7280' }}>{slot.savedListing.price}</span>
                )}
              </div>
              <VerdictBadge verdict={slot.savedListing.verdict} size="sm" />
            </div>
          )}
        </div>
      )}

      {/* Paste new */}
      {slot.mode === 'new' && (
        <div className="flex flex-col gap-3">
          <input
            type="text"
            value={slot.urlOrLabel}
            onChange={e => onChange({ urlOrLabel: e.target.value })}
            placeholder="Zillow URL or nickname (optional)"
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ borderColor: '#e8e8e8', color: '#1a1a2e' }}
            onFocus={e => (e.target.style.borderColor = '#2A7F7F')}
            onBlur={e => (e.target.style.borderColor = '#e8e8e8')}
          />
          <textarea
            value={slot.text}
            onChange={e => onChange({ text: e.target.value })}
            placeholder="Paste the full listing text here…"
            rows={5}
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none"
            style={{ borderColor: '#e8e8e8', color: '#1a1a2e' }}
            onFocus={e => (e.target.style.borderColor = '#2A7F7F')}
            onBlur={e => (e.target.style.borderColor = '#e8e8e8')}
          />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ResultCard — one listing's result in the comparison
// ─────────────────────────────────────────────────────────────
function ResultCard({ result, isWinner, criteria, alreadySaved, isSaved, onSave }) {
  const ceilingQuote = result.scores?.ceiling_height;
  const neighborhoodNote = result.scores?.neighborhood_note;

  return (
    <div
      className="rounded-xl border flex flex-col overflow-hidden"
      style={{
        backgroundColor: '#ffffff',
        borderColor: isWinner ? '#2A7F7F' : '#e8e8e8',
        borderWidth: isWinner ? '2px' : '1px',
      }}
    >
      {/* Winner badge */}
      {isWinner && (
        <div
          className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-center"
          style={{ backgroundColor: '#2A7F7F', color: '#ffffff' }}
        >
          ✦ Top Pick
        </div>
      )}

      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: '#f3f4f6' }}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-base font-bold leading-tight" style={{ color: '#1a1a2e' }}>
            {result.name}
          </h3>
          <VerdictBadge verdict={result.verdict} size="sm" />
        </div>
        <p className="text-xs mb-3" style={{ color: '#6b7280' }}>
          {[result.address, result.price].filter(Boolean).join(' · ')}
        </p>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-extrabold" style={{ color: '#1a1a2e' }}>
            {Math.round(result.weighted_score)}
          </span>
          <span className="text-xs" style={{ color: '#9ca3af' }}>/100</span>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 flex flex-col gap-4 flex-1">

        {/* Scorecard */}
        <ScoreCard scores={result.scores} criteria={criteria} />

        {/* Strengths */}
        {result.strengths?.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#43a047' }}>
              Strengths
            </p>
            <ul className="flex flex-col gap-1">
              {result.strengths.map((s, i) => (
                <li key={i} className="text-sm flex gap-1.5 items-start" style={{ color: '#374151' }}>
                  <span style={{ color: '#43a047' }}>✓</span> {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Concerns */}
        {result.concerns?.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#ef5350' }}>
              Concerns
            </p>
            <ul className="flex flex-col gap-1">
              {result.concerns.map((c, i) => (
                <li key={i} className="text-sm flex gap-1.5 items-start" style={{ color: '#374151' }}>
                  <span style={{ color: '#ef5350' }}>✗</span> {c}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Neighborhood note */}
        {neighborhoodNote && (
          <div
            className="rounded-lg px-3 py-2 text-xs border-l-4"
            style={{ backgroundColor: '#e0f2f1', borderLeftColor: '#2A7F7F', color: '#00695c' }}
          >
            <span className="font-semibold">📍 </span>{neighborhoodNote}
          </div>
        )}

        {/* Ceiling height */}
        {ceilingQuote && (
          <div
            className="rounded-lg px-3 py-2 text-xs border-l-4"
            style={{ backgroundColor: '#e8f5e9', borderLeftColor: '#43a047', color: '#2e7d32' }}
          >
            <span className="font-semibold">⬆️ </span>&ldquo;{ceilingQuote}&rdquo;
          </div>
        )}
      </div>

      {/* Save footer */}
      <div className="px-5 pb-5">
        <button
          onClick={onSave}
          disabled={alreadySaved || isSaved}
          className="w-full py-2 rounded-lg text-sm font-semibold border transition-colors"
          style={
            alreadySaved || isSaved
              ? { backgroundColor: '#f3f4f6', color: '#9ca3af', borderColor: '#e8e8e8', cursor: 'default' }
              : { backgroundColor: '#ffffff', color: '#2A7F7F', borderColor: '#2A7F7F', cursor: 'pointer' }
          }
        >
          {alreadySaved ? 'Already saved ✓' : isSaved ? 'Saved ✓' : 'Save listing'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────
export default function DecisionTab({ criteria, listings, location, preloadListing, preloadMany, onPreloadConsumed, onSave, decisionState, onDecisionStateChange }) {
  const { slots, isLoading, results, error, resultsView, savedIndices } = decisionState;

  function setSlots(updater) {
    if (typeof updater === 'function') {
      onDecisionStateChange({ slots: updater(decisionState.slots) });
    } else {
      onDecisionStateChange({ slots: updater });
    }
  }
  const setIsLoading  = v => onDecisionStateChange({ isLoading: v });
  const setResults    = v => onDecisionStateChange({ results: v });
  const setError      = v => onDecisionStateChange({ error: v });
  const setResultsView = v => onDecisionStateChange({ resultsView: v });
  const setSavedIndices = v => onDecisionStateChange({ savedIndices: typeof v === 'function' ? v(decisionState.savedIndices) : v });

  // Consume single preloaded listing into slot 0
  useEffect(() => {
    if (preloadListing) {
      setSlots(prev => {
        const updated = [...prev];
        updated[0] = { ...updated[0], mode: 'saved', savedListing: preloadListing };
        return updated;
      });
      setResults(null);
      setError(null);
      setSavedIndices(new Set());
      onPreloadConsumed();
    }
  }, [preloadListing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Consume multi-listing preload (from compare queue in Saved tab)
  useEffect(() => {
    if (preloadMany && preloadMany.length >= 2) {
      const newSlots = preloadMany.map(l => createSlot('saved', l));
      // Pad to at least 2 slots
      while (newSlots.length < 2) newSlots.push(createSlot('new'));
      setSlots(newSlots);
      setResults(null);
      setError(null);
      setSavedIndices(new Set());
      onPreloadConsumed();
    }
  }, [preloadMany]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateSlot(index, changes) {
    setSlots(prev => prev.map((s, i) => i === index ? { ...s, ...changes } : s));
  }

  function removeSlot(index) {
    setSlots(prev => prev.filter((_, i) => i !== index));
    setResults(null);
    setSavedIndices(new Set());
  }

  function addSlot() {
    if (slots.length < 4) {
      setSlots(prev => [...prev, createSlot('new')]);
      setResults(null);
      setSavedIndices(new Set());
    }
  }

  const validCount = slots.filter(isSlotValid).length;
  const canCompare = validCount >= 2 && !isLoading && criteria.length > 0;

  // Detect duplicate saved listings across slots
  const savedIds = slots
    .filter(s => s.mode === 'saved' && s.savedListing)
    .map(s => s.savedListing.id);
  const hasDuplicateSlots = new Set(savedIds).size !== savedIds.length;

  async function handleCompare() {
    setIsLoading(true);
    setError(null);
    setResults(null);
    setSavedIndices(new Set());

    try {
      // Decision D2: if every slot is a saved listing, use stored scores — no API call.
      const allSaved = slots.every(s => s.mode === 'saved' && s.savedListing);

      if (allSaved) {
        const listingsFromStored = slots.map(slot => ({
          name: slot.savedListing.name,
          address: slot.savedListing.address || '',
          price: slot.savedListing.price || '',
          scores: slot.savedListing.scores,
          weighted_score: slot.savedListing.weighted_score,
          verdict: slot.savedListing.verdict,
          strengths: [],
          concerns: [],
        }));

        // Pick winner by highest weighted_score
        let winnerIdx = 0;
        listingsFromStored.forEach((l, i) => {
          if (l.weighted_score > listingsFromStored[winnerIdx].weighted_score) winnerIdx = i;
        });

        setResults({
          mode: 'decision',
          listings: listingsFromStored,
          winner: winnerIdx + 1,
          winner_reason: null,
          tradeoff_note: null,
        });
        return;
      }

      // Mixed mode (at least one new listing) — call Claude.
      // For saved slots, pass a brief summary instead of rawText to avoid oversized prompts.
      const promptSlots = slots.map(slot => {
        if (slot.mode === 'saved' && slot.savedListing) {
          const l = slot.savedListing;
          const scoreLines = Object.entries(l.scores || {})
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ');
          return {
            urlOrLabel: l.name,
            text: `[Previously scored listing]\nName: ${l.name}\nPrice: ${l.price || 'unknown'}\nAddress: ${l.address || 'unknown'}\nScores: ${scoreLines}`,
          };
        }
        return { urlOrLabel: slot.urlOrLabel, text: slot.text };
      });

      const system = buildSystemPrompt(criteria, location);
      const userPrompt = buildDecisionPrompt(promptSlots);
      const data = await analyzeListing({ system, userPrompt });
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSaveResult(resultListing, slotIndex) {
    const slot = slots[slotIndex];
    onSave({
      id: uuidv4(),
      savedAt: new Date().toISOString(),
      name: resultListing.name || 'Unnamed listing',
      address: resultListing.address || '',
      price: resultListing.price || '',
      bedrooms: resultListing.bedrooms ?? slot.savedListing?.bedrooms ?? null,
      neighborhood: resultListing.neighborhood ?? slot.savedListing?.neighborhood ?? null,
      url: slot.mode === 'new' ? (slot.urlOrLabel?.trim() || null) : null,
      rawText: slot.mode === 'new' ? slot.text : (slot.savedListing?.rawText ?? ''),
      scores: resultListing.scores,
      weighted_score: resultListing.weighted_score,
      verdict: resultListing.verdict,
      verdict_reason: '',
      key_concern: null,
      status: 'considering',
      notes: '',
    });
    setSavedIndices(prev => new Set([...prev, slotIndex]));
  }

  // Check if a slot's listing is already in the saved list (by rawText or ID)
  function isAlreadySaved(slotIndex) {
    const slot = slots[slotIndex];
    if (slot.mode === 'saved' && slot.savedListing) return true; // it's from saved — already there
    if (slot.mode === 'new') {
      return listings.some(l => l.rawText === slot.text);
    }
    return false;
  }

  const winnerIndex = results ? (results.winner ?? 1) - 1 : -1;

  return (
    <div>
      {/* ── Slots grid ── */}
      <div className="grid gap-4 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))' }}>
        {slots.map((slot, i) => (
          <SlotInput
            key={slot.id}
            slot={slot}
            index={i}
            totalSlots={slots.length}
            savedListings={listings}
            onChange={changes => updateSlot(i, changes)}
            onRemove={() => removeSlot(i)}
          />
        ))}
      </div>

      {/* ── Add listing button ── */}
      {slots.length < 4 && (
        <div className="mb-5">
          <button
            onClick={addSlot}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-medium transition-colors"
            style={{ borderColor: '#e8e8e8', color: '#6b7280', backgroundColor: '#ffffff' }}
          >
            <span className="text-lg leading-none">+</span>
            Add listing
          </button>
        </div>
      )}

      {/* ── Compare button ── */}
      <div className="mb-8">
        <button
          onClick={handleCompare}
          disabled={!canCompare}
          className="flex items-center justify-center gap-2 px-8 py-3 rounded-lg text-sm font-semibold transition-colors"
          style={{
            backgroundColor: canCompare ? '#1a1a2e' : '#e8e8e8',
            color: canCompare ? '#ffffff' : '#9ca3af',
            cursor: canCompare ? 'pointer' : 'default',
          }}
        >
          {isLoading ? <><Spinner /> Comparing…</> : 'Compare Listings'}
        </button>
        {validCount < 2 && !isLoading && (
          <p className="mt-2 text-sm" style={{ color: '#9ca3af' }}>
            Add at least 2 listings to compare
          </p>
        )}
        {hasDuplicateSlots && (
          <p className="mt-2 text-sm" style={{ color: '#ffb300' }}>
            You have the same listing in multiple slots — each slot should be a different listing.
          </p>
        )}
        {criteria.length === 0 && (
          <p className="mt-2 text-sm" style={{ color: '#ef5350' }}>
            No criteria set — open ⚙ Settings to add at least one before comparing.
          </p>
        )}
      </div>

      {/* ── Error ── */}
      {error && (
        <div
          className="rounded-xl px-4 py-3 mb-6 flex items-start gap-3 border-l-4"
          style={{ backgroundColor: '#ffebee', borderLeftColor: '#ef5350' }}
        >
          <span className="text-lg leading-none mt-0.5">⚠</span>
          <div>
            <p className="text-sm font-medium" style={{ color: '#c62828' }}>{error}</p>
            <button
              onClick={handleCompare}
              className="text-sm font-semibold mt-1 underline"
              style={{ color: '#c62828' }}
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {results && (
        <div>
          {/* Winner banner */}
          {results.listings?.[winnerIndex] && (
            <div
              className="rounded-xl px-6 py-5 mb-6"
              style={{ backgroundColor: '#1a1a2e' }}
            >
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#2A7F7F' }}>
                ✦ Top Pick
              </p>
              <p className="text-xl font-bold mb-1" style={{ color: '#ffffff' }}>
                {results.listings[winnerIndex].name}
              </p>
              {results.winner_reason && (
                <p className="text-sm" style={{ color: '#9ca3af' }}>{results.winner_reason}</p>
              )}
            </div>
          )}

          {/* View toggle */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold" style={{ color: '#1a1a2e' }}>
              Results
            </p>
            <div
              className="flex rounded-lg border overflow-hidden"
              style={{ borderColor: '#e8e8e8' }}
            >
              {[{ mode: 'card', label: 'Cards' }, { mode: 'table', label: 'Table' }].map(({ mode, label }) => (
                <button
                  key={mode}
                  onClick={() => setResultsView(mode)}
                  className="px-3 py-1.5 text-xs font-semibold transition-colors"
                  style={
                    resultsView === mode
                      ? { backgroundColor: '#1a1a2e', color: '#ffffff' }
                      : { backgroundColor: '#ffffff', color: '#9ca3af' }
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Cards view */}
          {resultsView === 'card' && (
            <div className="grid gap-4 mb-6 grid-cols-1 sm:grid-cols-2">
              {results.listings?.map((result, i) => (
                <ResultCard
                  key={i}
                  result={result}
                  isWinner={i === winnerIndex}
                  criteria={criteria}
                  alreadySaved={isAlreadySaved(i)}
                  isSaved={savedIndices.has(i)}
                  onSave={() => handleSaveResult(result, i)}
                />
              ))}
            </div>
          )}

          {/* Table view */}
          {resultsView === 'table' && (
            <div className="mb-6">
              <DecisionTable
                results={results}
                criteria={criteria}
                winnerIndex={winnerIndex}
                isAlreadySaved={isAlreadySaved}
                savedIndices={savedIndices}
                onSave={handleSaveResult}
              />
            </div>
          )}

          {/* Save all button — only for new slots not yet saved, card view only */}
          {resultsView === 'card' && results.listings?.some((_, i) => !isAlreadySaved(i) && !savedIndices.has(i)) && (
            <div className="flex justify-end mb-4">
              <button
                onClick={() => {
                  results.listings.forEach((result, i) => {
                    if (!isAlreadySaved(i) && !savedIndices.has(i)) {
                      handleSaveResult(result, i);
                    }
                  });
                }}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
                style={{ backgroundColor: '#2A7F7F' }}
              >
                Save all listings
              </button>
            </div>
          )}

          {/* Tradeoff note */}
          {results.tradeoff_note && (
            <div
              className="rounded-xl px-5 py-4 border-l-4"
              style={{ backgroundColor: '#fff8e1', borderLeftColor: '#ffb300' }}
            >
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#e65100' }}>
                Key tradeoff
              </p>
              <p className="text-sm" style={{ color: '#374151' }}>{results.tradeoff_note}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
