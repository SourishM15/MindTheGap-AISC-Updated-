export interface NeighborhoodDemographics {
  name: string;
  childrenUnder18: number;
  workingAgeAdults: number;
  olderAdults: number;
  aggregateAgeTotal: number;
  aggregateAgeMale: number;
  aggregateAgeFemale: number;
  medianAgeTotal: number;
  medianAgeMale: number;
  medianAgeFemale: number;
  type: string;
  medianIncome?: number;
}

export interface TimeSeriesPoint {
  year: number;
  value: number;
}

export interface NeighborhoodHistory {
  population: TimeSeriesPoint[];
  medianIncome: TimeSeriesPoint[];
  giniCoefficient: TimeSeriesPoint[];
  incomeRatio: TimeSeriesPoint[];
  povertyRate: TimeSeriesPoint[];
  wealthShare: TimeSeriesPoint[];
}

export interface NeighborhoodForecast {
  population: TimeSeriesPoint[];
  medianIncome: TimeSeriesPoint[];
  giniCoefficient: TimeSeriesPoint[];
  incomeRatio: TimeSeriesPoint[];
  povertyRate: TimeSeriesPoint[];
  wealthShare: TimeSeriesPoint[];
}

export interface DemographicsSummary {
  totalPopulation: number;
  ageDistribution: {
    children: number;
    workingAge: number;
    elderly: number;
  };
  medianAge: number;
  genderRatio: {
    male: number;
    female: number;
  };
  medianIncome: number;
  history?: NeighborhoodHistory;
  forecast?: NeighborhoodForecast;
}