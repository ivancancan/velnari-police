// apps/web/src/components/insights/chartTheme.ts

export const CHART_COLORS = {
  blue:   '#3b82f6',
  amber:  '#f59e0b',
  green:  '#22c55e',
  red:    '#ef4444',
  orange: '#f97316',
  purple: '#a78bfa',
  slate:  '#64748b',
};

export const PRIORITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#f59e0b',
  low:      '#22c55e',
};

export const PRIORITY_LABELS: Record<string, string> = {
  critical: 'Crítico',
  high:     'Alto',
  medium:   'Medio',
  low:      'Bajo',
};

export const TYPE_LABELS: Record<string, string> = {
  robbery:        'Robo',
  assault:        'Agresión',
  traffic:        'Vial',
  noise:          'Ruido',
  domestic:       'Doméstico',
  missing_person: 'Extraviado',
  other:          'Otro',
};

export const CHART_DEFAULTS = {
  gridColor:    '#1e293b',
  tickColor:    '#64748b',
  tickSize:     10,
  fontSize:     11,
  tooltipStyle: {
    backgroundColor: 'rgba(15,23,42,0.95)',
    border: '1px solid #1e293b',
    borderRadius: 8,
    color: '#f8fafc',
    fontSize: 11,
  },
};
