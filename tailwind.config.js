/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Core palette
        primary:            '#1a1a2e',
        accent:             '#2A7F7F',
        border:             '#e8e8e8',
        secondary:          '#6b7280',
        tertiary:           '#9ca3af',
        inactive:           '#f3f4f6',

        // Score colors
        'score-yes':        '#43a047',
        'score-yes-bg':     '#e8f5e9',
        'score-no':         '#ef5350',
        'score-no-bg':      '#ffebee',
        'score-unclear':    '#e65100',
        'score-unclear-bg': '#fff8e1',

        // Verdict colors
        'verdict-tour':     '#1565c0',

        // Neighborhood callout
        'callout-bg':       '#e0f2f1',
        'callout-text':     '#00695c',
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
      },
      borderRadius: {
        card:  '12px',
        pill:  '20px',
        input: '8px',
      },
    },
  },
  plugins: [],
}
