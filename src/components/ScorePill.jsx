/**
 * ScorePill — colored pill for a single criterion score.
 *
 * Used in ScoreCard (Browse, Decision, Saved) and anywhere else a score appears.
 *
 * Props:
 *   score — "yes" | "no" | "unclear"
 */
export default function ScorePill({ score }) {
  const styles = {
    yes:     { cls: 'bg-score-yes-bg text-score-yes', label: 'Yes' },
    no:      { cls: 'bg-score-no-bg text-score-no', label: 'No' },
    unclear: { cls: 'bg-score-unclear-bg text-score-unclear', label: 'Unclear' },
  };

  const s = styles[score] ?? styles.unclear;

  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold cursor-default ${s.cls}`}>
      {s.label}
    </span>
  );
}
