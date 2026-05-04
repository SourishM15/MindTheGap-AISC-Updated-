export interface DashboardRegionData {
  state: string;
  metro?: string;
  profile: {
    demographics?: {
      population?: number;
      metro_fips?: string;
      median_household_income?: number;
      poverty_rate?: number;
      education_bachelor_and_above?: number;
      unemployment_rate?: number;
    };
    economics?: {
      indicators?: {
        unemployment_rate?: {
          data?: Record<string, number>;
        };
      };
    };
  };
}

export interface WealthDistributionData {
  gini_coefficient: number;
  data_date: string;
  lorenz_data: { bracket: string; cumulativePopulation: number; cumulativeWealth: number; percentage: number }[];
  stacked_data: Record<string, number>[];
  waffle_data: { bracket: string; percentage: number; color: string }[];
  source: string;
}

export interface IncomeLorenzData {
  gini_coefficient: number | null;
  median_household_income: number | null;
  lorenz_data: { bracket: string; percentage: number; cumulativePopulation: number; cumulativeWealth: number }[];
  waffle_data: { bracket: string; percentage: number; color: string }[];
  source: string;
  year: number;
  requested_year?: number | null;
  state_specific: boolean;
  metro_specific?: boolean;
}

export interface SAIPESnapshot {
  state_name: string;
  fips: string;
  year: number;
  poverty_rate: number | null;
  child_poverty_rate: number | null;
  median_household_income: number | null;
  poverty_count: number | null;
  child_poverty_count: number | null;
  source: string;
}

export interface SAIPETimeSeries {
  year: number;
  poverty_rate: number | null;
  child_poverty_rate: number | null;
  median_household_income: number | null;
}

export interface SAIPEData {
  snapshot: SAIPESnapshot;
  time_series: SAIPETimeSeries[];
}

export type VisualizationType = 'overview' | 'comparison' | 'analysis' | 'lorenz' | 'stacked' | 'waffle';

export type StackedDistributionRow = { year: number; [decile: string]: string | number };

export interface DashboardMetric {
  id: string;
  label: string;
  value: number | null;
  formattedValue: string;
  unit: string;
  source: string;
  year: number | string;
  description: string;
}

export interface DashboardMetric3DPoint {
  id: string;
  label: string;
  value: number;
  formattedValue: string;
  normalizedValue: number;
  height: number;
  color: string;
  source: string;
  year: number | string;
  description: string;
  targetView: VisualizationType;
  axisLabel: string;
}
