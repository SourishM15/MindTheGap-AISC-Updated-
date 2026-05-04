import { DashboardMetric, DashboardMetric3DPoint, VisualizationType } from '../types/dashboard';

interface Metric3DConfig {
  min: number;
  max: number;
  color: string;
  targetView: VisualizationType;
  axisLabel: string;
}

const METRIC_3D_CONFIG: Record<string, Metric3DConfig> = {
  population: {
    min: 0,
    max: 90000000,
    color: '#06b6d4',
    targetView: 'comparison',
    axisLabel: 'Scale',
  },
  'median-income': {
    min: 35000,
    max: 130000,
    color: '#10b981',
    targetView: 'stacked',
    axisLabel: 'Income',
  },
  'poverty-rate': {
    min: 4,
    max: 25,
    color: '#f59e0b',
    targetView: 'analysis',
    axisLabel: 'Poverty',
  },
  education: {
    min: 10,
    max: 65,
    color: '#8b5cf6',
    targetView: 'comparison',
    axisLabel: 'Education',
  },
  unemployment: {
    min: 2,
    max: 12,
    color: '#f43f5e',
    targetView: 'analysis',
    axisLabel: 'Labor',
  },
  'child-poverty': {
    min: 4,
    max: 35,
    color: '#f97316',
    targetView: 'analysis',
    axisLabel: 'Child poverty',
  },
};

const DEFAULT_CONFIG: Metric3DConfig = {
  min: 0,
  max: 100,
  color: '#64748b',
  targetView: 'overview',
  axisLabel: 'Metric',
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const normalize = (value: number, min: number, max: number) => {
  if (max <= min) return 0;
  return clamp01((value - min) / (max - min));
};

export function buildDashboard3DPoints(metrics: DashboardMetric[]): DashboardMetric3DPoint[] {
  return metrics
    .filter((metric) => metric.value != null && Number.isFinite(metric.value))
    .map((metric) => {
      const config = METRIC_3D_CONFIG[metric.id] ?? DEFAULT_CONFIG;
      const value = metric.value ?? 0;
      const normalizedValue = normalize(value, config.min, config.max);
      const easedHeight = Math.sqrt(normalizedValue);

      return {
        id: metric.id,
        label: metric.label,
        value,
        formattedValue: metric.formattedValue,
        normalizedValue,
        height: 0.55 + easedHeight * 2.65,
        color: config.color,
        source: metric.source,
        year: metric.year,
        description: metric.description,
        targetView: config.targetView,
        axisLabel: config.axisLabel,
      };
    });
}
