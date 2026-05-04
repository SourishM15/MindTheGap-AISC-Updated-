import { BarChart3, Briefcase, DollarSign, GraduationCap, Users } from 'lucide-react';

export type ScaleMetricKey = 'medianIncome' | 'povertyRate' | 'educationRate' | 'unemploymentRate' | 'population';

export interface ScaleStateMetrics {
  state: string;
  population?: number;
  medianIncome?: number;
  povertyRate?: number;
  educationRate?: number;
  unemploymentRate?: number;
}

interface MetricConfig {
  key: ScaleMetricKey;
  label: string;
  shortLabel: string;
  unitLabel: string;
  higherIsBetter: boolean;
  icon: typeof DollarSign;
  format: (value?: number) => string;
  normalize: (value?: number) => number;
}

export const SCALE_METRICS: MetricConfig[] = [
  {
    key: 'medianIncome',
    label: 'Median Income',
    shortLabel: 'Income',
    unitLabel: 'household income',
    higherIsBetter: true,
    icon: DollarSign,
    format: (value) => value == null ? 'N/A' : `$${Math.round(value / 1000)}K`,
    normalize: (value) => value == null ? 0.5 : Math.min(1, Math.max(0, (value - 45000) / 65000)),
  },
  {
    key: 'povertyRate',
    label: 'Poverty Rate',
    shortLabel: 'Poverty',
    unitLabel: 'poverty burden',
    higherIsBetter: false,
    icon: BarChart3,
    format: (value) => value == null ? 'N/A' : `${value.toFixed(1)}%`,
    normalize: (value) => value == null ? 0.5 : Math.min(1, Math.max(0, (value - 6) / 18)),
  },
  {
    key: 'educationRate',
    label: "Bachelor's Degree+",
    shortLabel: 'Education',
    unitLabel: 'attainment',
    higherIsBetter: true,
    icon: GraduationCap,
    format: (value) => value == null ? 'N/A' : `${value.toFixed(1)}%`,
    normalize: (value) => value == null ? 0.5 : Math.min(1, Math.max(0, (value - 15) / 35)),
  },
  {
    key: 'unemploymentRate',
    label: 'Unemployment',
    shortLabel: 'Jobs',
    unitLabel: 'labor risk',
    higherIsBetter: false,
    icon: Briefcase,
    format: (value) => value == null ? 'N/A' : `${value.toFixed(1)}%`,
    normalize: (value) => value == null ? 0.5 : Math.min(1, Math.max(0, (value - 2) / 10)),
  },
  {
    key: 'population',
    label: 'Population',
    shortLabel: 'Population',
    unitLabel: 'scale',
    higherIsBetter: true,
    icon: Users,
    format: (value) => {
      if (value == null) return 'N/A';
      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
      return value.toLocaleString();
    },
    normalize: (value) => value == null ? 0.5 : Math.min(1, Math.max(0, Math.log10(value) / 9)),
  },
];
