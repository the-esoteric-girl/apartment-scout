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
import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { buildSystemPrompt, buildBrowsePrompt, analyzeListing } from '../../utils/claude';
import ScoreCard from '../ScoreCard';
import VerdictBadge from '../VerdictBadge';

// ─────────────────────────────────────────────────────────────
// Pet policy callout styles
// ─────────────────────────────────────────────────────────────
const PET_STYLES = {
  safe:    { bg: '#e8f5e9', border: '#43a047', color: '#2e7d32', icon: '🐱', label: 'Cat-friendly' },
  risk:    { bg: '#ffebee', border: '#ef5350', color: '#c62828', icon: '⚠️', label: 'Pet risk — check policy' },
  unknown: { bg: '#fff8e1', border: '#ffb300', color: '#e65100', icon: '❓', label: 'Pet policy unknown' },
};

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

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
  const petPolicy = result.scores?.pet_policy;
  const petStyle = PET_STYLES[petPolicy] ?? null;
  const ceilingQuote = result.scores?.ceiling_height;
  const neighborhoodNote = result.scores?.neighborhood_note;

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: '#ffffff', borderColor: '#e8e8e8' }}
    >
      {/* ── Header ── */}
      <div className="px-6 pt-6 pb-4 border-b" style={{ borderColor: '#f3f4f6' }}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2
              className="text-xl font-bold leading-tight mb-1"
              style={{ color: '#1a1a2e' }}
            >
              {result.name || 'Listing'}
            </h2>
            <p className="text-sm" style={{ color: '#6b7280' }}>
              {[result.address, result.price].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="shrink-0 pt-0.5">
            <VerdictBadge verdict={result.verdict} />
          </div>
        </div>

        {/* Score number */}
        <div className="mt-3 flex items-baseline gap-1">
          <span
            className="text-4xl font-extrabold"
            style={{ color: '#1a1a2e' }}
          >
            {Math.round(result.weighted_score)}
          </span>
          <span className="text-sm font-medium" style={{ color: '#9ca3af' }}>/100</span>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="px-6 py-5 flex flex-col gap-4">

        {/* Neighborhood note */}
        {neighborhoodNote && (
          <Callout bg="#e0f2f1" border="#2A7F7F" color="#00695c">
            <span className="font-semibold">📍 Location: </span>
            {neighborhoodNote}
          </Callout>
        )}

        {/* Criteria scorecard */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#9ca3af' }}>
            Scorecard
          </p>
          <ScoreCard scores={result.scores} criteria={criteria} />
        </div>

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

        {/* Key concern */}
        {result.key_concern && (
          <Callout bg="#fff8e1" border="#ffb300" color="#e65100">
            <span className="font-semibold">⚠ Key concern: </span>
            {result.key_concern}
          </Callout>
        )}

        {/* Verdict reason */}
        {result.verdict_reason && (
          <p className="text-sm leading-relaxed" style={{ color: '#6b7280' }}>
            {result.verdict_reason}
          </p>
        )}
      </div>

      {/* ── Save footer ── */}
      <div className="px-6 pb-6">
        <button
          onClick={onSave}
          disabled={isSaved}
          className="w-full py-2.5 rounded-lg text-sm font-semibold border transition-all"
          style={
            isSaved
              ? { backgroundColor: '#f3f4f6', color: '#9ca3af', borderColor: '#e8e8e8', cursor: 'default' }
              : { backgroundColor: '#ffffff', color: '#2A7F7F', borderColor: '#2A7F7F', cursor: 'pointer' }
          }
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

export default function BrowseTab({ criteria, listings, location, onSave }) {
  const [urlOrLabel, setUrlOrLabel] = useState('');
  const [listingText, setListingText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [justSaved, setJustSaved] = useState(false);

  const canAnalyze = listingText.trim().length > 20 && !isLoading && criteria.length > 0;

  // Already saved from a previous session (same raw text exists in storage)
  const alreadySaved = result
    ? listings.some(l => l.rawText === listingText)
    : false;

  const isSaved = alreadySaved || justSaved;

  async function handleAnalyze() {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setJustSaved(false);

    try {
      const system = buildSystemPrompt(criteria, location);
      const userPrompt = buildBrowsePrompt(listingText, urlOrLabel);
      const data = await analyzeListing({ system, userPrompt });
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSave() {
    if (!result || isSaved) return;

    onSave({
      id: uuidv4(),
      savedAt: new Date().toISOString(),
      name: result.name || 'Unnamed listing',
      address: result.address || '',
      price: result.price || '',
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

    setJustSaved(true);
  }

  return (
    <div className="mx-auto" style={{ maxWidth: '680px' }}>

      {/* ── Input card ── */}
      <div
        className="rounded-xl border p-6 mb-6"
        style={{ backgroundColor: '#ffffff', borderColor: '#e8e8e8' }}
      >
        {/* URL / label */}
        <div className="mb-4">
          <label
            className="block text-sm font-medium mb-1.5"
            style={{ color: '#1a1a2e' }}
          >
            URL or nickname{' '}
            <span className="font-normal" style={{ color: '#9ca3af' }}>(optional)</span>
          </label>
          <input
            type="text"
            value={urlOrLabel}
            onChange={e => setUrlOrLabel(e.target.value)}
            placeholder="Zillow URL or nickname"
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ borderColor: '#e8e8e8', color: '#1a1a2e' }}
            onFocus={e => (e.target.style.borderColor = '#2A7F7F')}
            onBlur={e => (e.target.style.borderColor = '#e8e8e8')}
          />
        </div>

        {/* Listing text */}
        <div className="mb-5">
          <label
            className="block text-sm font-medium mb-1.5"
            style={{ color: '#1a1a2e' }}
          >
            Listing text
          </label>
          <textarea
            value={listingText}
            onChange={e => setListingText(e.target.value)}
            placeholder="Paste the full listing text here — description, amenities, price, location..."
            rows={6}
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none"
            style={{ borderColor: '#e8e8e8', color: '#1a1a2e' }}
            onFocus={e => (e.target.style.borderColor = '#2A7F7F')}
            onBlur={e => (e.target.style.borderColor = '#e8e8e8')}
          />
        </div>

        {/* Analyze button */}
        <button
          onClick={handleAnalyze}
          disabled={!canAnalyze}
          className="w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
          style={{
            backgroundColor: canAnalyze ? '#1a1a2e' : '#e8e8e8',
            color: canAnalyze ? '#ffffff' : '#9ca3af',
            cursor: canAnalyze ? 'pointer' : 'default',
          }}
        >
          {isLoading ? <><Spinner /> Analyzing…</> : 'Analyze Listing'}
        </button>

        {/* No criteria warning */}
        {criteria.length === 0 && (
          <p className="mt-2 text-sm text-center" style={{ color: '#ef5350' }}>
            No criteria set — open ⚙ Settings to add at least one before analyzing.
          </p>
        )}
      </div>

      {/* ── Error state ── */}
      {error && (
        <div
          className="rounded-xl px-4 py-3 mb-6 flex items-start gap-3 border-l-4"
          style={{ backgroundColor: '#ffebee', borderLeftColor: '#ef5350' }}
        >
          <span className="text-lg leading-none mt-0.5" aria-hidden="true">⚠</span>
          <div>
            <p className="text-sm font-medium" style={{ color: '#c62828' }}>
              {error}
            </p>
            <button
              onClick={handleAnalyze}
              className="text-sm font-semibold mt-1 underline"
              style={{ color: '#c62828' }}
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
