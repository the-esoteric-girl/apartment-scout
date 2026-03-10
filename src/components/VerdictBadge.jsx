/**
 * VerdictBadge — displays the Apply / Tour / Skip verdict.
 *
 * Props:
 *   verdict — "apply" | "tour" | "skip"
 *   size    — "sm" | "md" (default "md")
 */
export default function VerdictBadge({ verdict, size = 'md' }) {
  const styles = {
    apply: { backgroundColor: '#1a1a2e', color: '#ffffff', label: '✦ Apply' },
    tour:  { backgroundColor: '#1565c0', color: '#ffffff', label: '◎ Tour' },
    skip:  { backgroundColor: '#f3f4f6', color: '#9ca3af', label: '✕ Skip' },
  };

  const s = styles[verdict] ?? styles.skip;
  const padding = size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3.5 py-1 text-sm';

  return (
    <span
      className={`inline-block rounded-full font-semibold ${padding}`}
      style={{ backgroundColor: s.backgroundColor, color: s.color }}
    >
      {s.label}
    </span>
  );
}
