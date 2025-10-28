export interface InequalityMetric {
  id: string;
  name: string;
  description: string;
  currentValue: number;
  historicalValues: TimeSeriesData[];
  forecastValues: TimeSeriesData[];
  unit: string;
  domain: [number, number]; // Min and max values for visualization scaling
}

export interface TimeSeriesData {
  year: number;
  value: number;
}

export interface RegionData {
  id: string;
  name: string;
  metrics: InequalityMetric[];
}

export type MessageRole = 'user' | 'system' | 'assistant';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
}

export interface FilterState {
  region: 'us' | 'washington' | 'comparison';
  timeframe: 'current' | 'historical' | 'forecast';
  metrics: string[]; // Array of metric IDs
  yearRange: [number, number];
}