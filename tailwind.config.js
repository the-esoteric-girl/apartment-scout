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
        'verdict-tour-bg':  '#e3f2fd',

        // Accent tint (checked/selected state backgrounds)
        'accent-subtle':    '#f0fafa',

        // App surface
        'app-bg':           '#f7f7f5',

        // Neighborhood callout
        'callout-bg':       '#e0f2f1',
        'callout-text':     '#00695c',
        'callout-yes-text': '#2e7d32',

        // Error (deep red, darker than score-no)
        'error':            '#c62828',

        // Amber warning
        'warning':          '#ffb300',

        // Prose / body text
        'prose':            '#374151',

        // Muted / disabled UI elements
        'faint':            '#d1d5db',

        // Table layout
        'row-alt':          '#fafafa',
        'winner-cell':      '#f5fffe',
        'row-dq':           '#fff5f5',

        // Status pill colors
        'status-toured-bg':     '#dbeafe',
        'status-applied-bg':    '#ccfbf1',
        'status-applied-text':  '#0f766e',
        'status-rejected-bg':   '#fee2e2',
        'status-rejected-text': '#dc2626',
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
