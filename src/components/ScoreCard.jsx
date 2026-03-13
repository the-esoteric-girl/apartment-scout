/**
 * ScoreCard — full criteria scorecard for a listing result.
 *
 * Shows each scored criterion as a row: rank (#1, #2…), label, score pill.
 * Weights are never shown — only rank numbers (per architectural decision #6).
 * Flag-only criteria (pet policy, ceiling height, neighborhood note) are NOT
 * shown here — they're rendered as callout boxes in the parent component.
 *
 * Props:
 *   scores   — the scores object from Claude's response or a saved listing
 *   criteria — current criteria array (from App state / localStorage)
 */
import ScorePill from './ScorePill';

const SCORE_CYCLE = { yes: 'unclear', unclear: 'no', no: 'yes' };

// onScoreChange(key, newScore) — optional; when provided, pills become clickable
export default function ScoreCard({ scores, criteria, onScoreChange }) {
  const scored = criteria.filter(c => !c.flagOnly);

  return (
    <div className="divide-y divide-inactive">
      {scored.map((criterion, index) => {
        const score = scores?.[criterion.key] ?? 'unclear';
        const rank = index + 1;

        return (
          <div
            key={criterion.key}
            className="flex items-center justify-between py-2.5"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-semibold w-6 text-center shrink-0 text-tertiary">
                {rank}
              </span>
              <span className="text-sm font-medium text-primary">
                {criterion.label}
              </span>
              {criterion.isDisqualifier && (
                <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-score-no-bg text-score-no">
                  must-have
                </span>
              )}
            </div>

            {onScoreChange ? (
              <button
                onClick={() => onScoreChange(criterion.key, SCORE_CYCLE[score] ?? 'unclear')}
                title="Click to override score"
                className="rounded transition-opacity hover:opacity-75"
              >
                <ScorePill score={score} />
              </button>
            ) : (
              <ScorePill score={score} />
            )}
          </div>
        );
      })}

      {onScoreChange && (
        <p className="pt-2 text-xs text-tertiary">
          Tap a score to override · cycles yes → unclear → no
        </p>
      )}
    </div>
  );
}
