/**
 * VerdictBadge — displays the Apply / Tour / Skip verdict.
 *
 * Props:
 *   verdict — "apply" | "tour" | "skip"
 *   size    — "sm" | "md" (default "md")
 */
export default function VerdictBadge({ verdict, size = 'md' }) {
  const styles = {
    apply: { cls: 'bg-primary text-white', label: '✦ Apply' },
    tour:  { cls: 'bg-verdict-tour text-white', label: '◎ Tour' },
    skip:  { cls: 'bg-inactive text-tertiary', label: '✕ Skip' },
  };

  const s = styles[verdict] ?? styles.skip;
  const padding = size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3.5 py-1 text-sm';

  return (
    <span className={`inline-block rounded-full font-semibold cursor-default ${padding} ${s.cls}`}>
      {s.label}
    </span>
  );
}
