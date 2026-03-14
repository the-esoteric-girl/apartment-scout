/**
 * BrowseTab — analyze a single listing and optionally save it.
 *
 * Flow:
 *   1. User pastes listing text (+ optional URL/label)
 *   2. Clicks "Analyze Listing" → calls Claude via /api/analyze
 *   3. Result renders below: header, scorecard, callouts, verdict
 *   4. "Save this listing" button persists to localStorage
 *
 * Props:
 *   criteria  — current criteria array (from App state)
 *   listings  — all saved listings (used to detect already-saved state)
 *   onSave    — fn(listing) → called when user saves a result
 */
import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { buildSystemPrompt, buildBrowsePrompt, analyzeListing } from '../../utils/claude';
import ScoreCard from '../ScoreCard';
import VerdictBadge from '../VerdictBadge';

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function Callout({ className, children }) {
  return (
    <div className={`rounded-lg px-4 py-3 text-sm border-l-4 ${className}`}>
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v8H4z"
      />
    </svg>
  );
}

function ResultSection({ result, criteria, isSaved, onSave }) {
  const interiorNote = result.scores?.interior_features;
  const locationNote = result.scores?.location_context;

  return (
    <div className="rounded-xl border overflow-hidden bg-white border-border">
      {/* ── Header ── */}
      <div className="px-6 pt-6 pb-4 border-b border-inactive">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-bold leading-tight mb-1 text-primary">
              {result.name || 'Listing'}
            </h2>
            <p className="text-sm text-secondary">
              {[result.address, result.price].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="shrink-0 pt-0.5">
            <VerdictBadge verdict={result.verdict} />
          </div>
        </div>

        {/* Score number */}
        <div className="mt-3 flex items-baseline gap-1">
          <span className="text-4xl font-extrabold text-primary">
            {Math.round(result.weighted_score)}
          </span>
          <span className="text-sm font-medium text-tertiary">/100</span>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="px-6 py-5 flex flex-col gap-4">

        {/* Location & transit note */}
        {locationNote && (
          <Callout className="bg-callout-bg border-l-accent text-callout-text">
            <span className="font-semibold">📍 Location: </span>
            {locationNote}
          </Callout>
        )}

        {/* Criteria scorecard */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2 text-tertiary">
            Scorecard
          </p>
          <ScoreCard scores={result.scores} criteria={criteria} />
        </div>

        {/* Interior features note */}
        {interiorNote && (
          <Callout className="bg-score-yes-bg border-l-score-yes text-callout-yes-text">
            <span className="font-semibold">✦ Interior: </span>
            &ldquo;{interiorNote}&rdquo;
          </Callout>
        )}

        {/* Key concern */}
        {result.key_concern && (
          <Callout className="bg-score-unclear-bg border-l-warning text-score-unclear">
            <span className="font-semibold">⚠ Key concern: </span>
            {result.key_concern}
          </Callout>
        )}

        {/* Verdict reason */}
        {result.verdict_reason && (
          <p className="text-sm leading-relaxed text-secondary">
            {result.verdict_reason}
          </p>
        )}
      </div>

      {/* ── Save footer ── */}
      <div className="px-6 pb-6">
        <button
          onClick={onSave}
          disabled={isSaved}
          className={`w-full py-2.5 rounded-lg text-sm font-semibold border transition-all ${
            isSaved
              ? 'bg-inactive text-tertiary border-border cursor-default'
              : 'bg-white text-accent border-accent cursor-pointer'
          }`}
        >
          {isSaved ? 'Saved ✓' : 'Save this listing'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

export default function BrowseTab({ criteria, listings, location, onSave, browseState, onBrowseStateChange }) {
  const { urlOrLabel, listingText, result, error, isLoading, justSaved } = browseState;

  const canAnalyze = listingText.trim().length > 20 && !isLoading && criteria.length > 0;

  // Already saved from a previous session (same raw text exists in storage)
  const alreadySaved = result
    ? listings.some(l => l.rawText === listingText)
    : false;

  const isSaved = alreadySaved || justSaved;

  const handleAnalyze = useCallback(async () => {
    onBrowseStateChange({ isLoading: true, error: null, result: null, justSaved: false });

    try {
      const system = buildSystemPrompt(criteria, location);
      const userPrompt = buildBrowsePrompt(listingText, urlOrLabel);
      const data = await analyzeListing({ system, userPrompt, criteria });
      onBrowseStateChange({ result: data });
    } catch (err) {
      onBrowseStateChange({ error: err.message });
    } finally {
      onBrowseStateChange({ isLoading: false });
    }
  }, [criteria, location, listingText, urlOrLabel, onBrowseStateChange]);

  function handleSave() {
    if (!result || isSaved) return;

    onSave({
      id: uuidv4(),
      savedAt: new Date().toISOString(),
      name: result.name || 'Unnamed listing',
      address: result.address || '',
      price: result.price || '',
      price_display: result.price_display ?? null,
      price_min: result.price_min ?? null,
      bedrooms: result.bedrooms ?? null,
      neighborhood: result.neighborhood ?? null,
      url: urlOrLabel.trim() || null,
      rawText: listingText,
      scores: result.scores,
      weighted_score: result.weighted_score,
      verdict: result.verdict,
      verdict_reason: result.verdict_reason ?? '',
      key_concern: result.key_concern ?? null,
      status: 'considering',
      notes: '',
    });

    onBrowseStateChange({ justSaved: true });
  }

  return (
    <div className="mx-auto" style={{ maxWidth: '680px' }}>

      {/* ── Input card ── */}
      <div className="rounded-xl border p-6 mb-6 bg-white border-border">
        {/* URL / label */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1.5 text-primary">
            URL or nickname{' '}
            <span className="font-normal text-tertiary">(optional)</span>
          </label>
          <input
            type="text"
            value={urlOrLabel}
            onChange={e => onBrowseStateChange({ urlOrLabel: e.target.value })}
            placeholder="Zillow URL or nickname"
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none border-border text-primary focus:border-accent"
          />
        </div>

        {/* Listing text */}
        <div className="mb-5">
          <label className="block text-sm font-medium mb-1.5 text-primary">
            Listing text
          </label>
          <textarea
            value={listingText}
            onChange={e => onBrowseStateChange({ listingText: e.target.value })}
            placeholder="Paste the full listing text here — description, amenities, price, location..."
            rows={6}
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none resize-y border-border text-primary focus:border-accent"
            style={{ minHeight: '120px' }}
          />
        </div>

        {/* Analyze button / reset */}
        <div className="flex gap-2">
          <button
            onClick={handleAnalyze}
            disabled={!canAnalyze}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
              canAnalyze
                ? 'bg-primary text-white cursor-pointer'
                : 'bg-border text-tertiary cursor-default'
            }`}
          >
            {isLoading ? <><Spinner /> Analyzing…</> : 'Analyze Listing'}
          </button>

          {result && (
            <button
              onClick={() => onBrowseStateChange({ urlOrLabel: '', listingText: '', result: null, error: null, justSaved: false })}
              className="px-4 py-2.5 rounded-lg text-sm font-semibold border transition-colors border-border text-secondary bg-white"
              title="Clear and start over"
            >
              Clear
            </button>
          )}
        </div>

        {/* No criteria warning */}
        {criteria.length === 0 && (
          <p className="mt-2 text-sm text-center text-score-no">
            No criteria set — open ⚙ Settings to add at least one before analyzing.
          </p>
        )}
      </div>

      {/* ── Error state ── */}
      {error && (
        <div className="rounded-xl px-4 py-3 mb-6 flex items-start gap-3 border-l-4 bg-score-no-bg border-l-score-no">
          <span className="text-lg leading-none mt-0.5" aria-hidden="true">⚠</span>
          <div>
            <p className="text-sm font-medium text-error">
              {error}
            </p>
            <button
              onClick={handleAnalyze}
              className="text-sm font-semibold mt-1 underline text-error"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* ── Result ── */}
      {result && (
        <ResultSection
          result={result}
          criteria={criteria}
          isSaved={isSaved}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
