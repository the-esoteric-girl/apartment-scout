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
    yes:     { backgroundColor: '#e8f5e9', color: '#43a047', label: 'Yes' },
    no:      { backgroundColor: '#ffebee', color: '#ef5350', label: 'No' },
    unclear: { backgroundColor: '#fff8e1', color: '#e65100', label: 'Unclear' },
  };

  const s = styles[score] ?? styles.unclear;

  return (
    <span
      className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: s.backgroundColor, color: s.color, cursor: 'default' }}
    >
      {s.label}
    </span>
  );
}
