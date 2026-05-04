import { DashboardMetric, DashboardRegionData, SAIPEData } from '../types/dashboard';

const formatCompactPopulation = (value: number | null | undefined) => {
  if (value == null) return 'N/A';
  return `${(value / 1000000).toFixed(1)}M`;
};

const formatCurrency = (value: number | null | undefined) => {
  if (value == null) return 'N/A';
  return `$${(value / 1000).toFixed(0)}K`;
};

const formatPercent = (value: number | null | undefined) => {
  if (value == null) return 'N/A';
  return `${value.toFixed(1)}%`;
};

export function getLatestUnemploymentRate(regionData: DashboardRegionData | null) {
  const unemploymentData = regionData?.profile?.economics?.indicators?.unemployment_rate?.data || {};
  const latestKey = Object.keys(unemploymentData).sort().pop();
  return latestKey ? unemploymentData[latestKey] : undefined;
}

export function buildDashboardMetrics(
  regionData: DashboardRegionData | null,
  saipeData: SAIPEData | null,
  isMetro: boolean
): DashboardMetric[] {
  const demographics = regionData?.profile?.demographics || {};
  const latestUnemploymentRate = getLatestUnemploymentRate(regionData);

  return [
    {
      id: 'population',
      label: 'Population',
      value: demographics.population ?? null,
      formattedValue: formatCompactPopulation(demographics.population),
      unit: 'people',
      source: 'ACS',
      year: isMetro ? 2021 : 2022,
      description: 'Total residents in the selected region.',
    },
    {
      id: 'median-income',
      label: 'Median Income',
      value: demographics.median_household_income ?? null,
      formattedValue: formatCurrency(demographics.median_household_income),
      unit: 'USD',
      source: isMetro ? 'ACS' : 'ACS/SAIPE',
      year: isMetro ? 2021 : saipeData?.snapshot?.year ?? 2023,
      description: 'The midpoint household income for the selected region.',
    },
    {
      id: 'poverty-rate',
      label: 'Poverty Rate',
      value: demographics.poverty_rate ?? null,
      formattedValue: formatPercent(demographics.poverty_rate),
      unit: '%',
      source: isMetro ? 'ACS' : 'SAIPE',
      year: isMetro ? 2021 : saipeData?.snapshot?.year ?? 2023,
      description: 'Share of residents living below the official poverty threshold.',
    },
    {
      id: 'education',
      label: 'Education',
      value: demographics.education_bachelor_and_above ?? null,
      formattedValue: formatPercent(demographics.education_bachelor_and_above),
      unit: '%',
      source: 'ACS',
      year: isMetro ? 2021 : 2022,
      description: "Estimated share of adults with a bachelor's degree or higher.",
    },
    {
      id: 'unemployment',
      label: 'Unemployment',
      value: latestUnemploymentRate ?? null,
      formattedValue: formatPercent(latestUnemploymentRate),
      unit: '%',
      source: 'BLS/FRED',
      year: 'Latest',
      description: "Latest available unemployment estimate in the region's economic time series.",
    },
    {
      id: 'child-poverty',
      label: 'Child Poverty Rate',
      value: saipeData?.snapshot?.child_poverty_rate ?? null,
      formattedValue: formatPercent(saipeData?.snapshot?.child_poverty_rate),
      unit: '%',
      source: 'SAIPE',
      year: saipeData?.snapshot?.year ?? 2023,
      description: 'Estimated poverty rate for residents under age 18.',
    },
  ];
}
