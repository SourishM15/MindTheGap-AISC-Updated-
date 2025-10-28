import { InequalityMetric, RegionData } from '../types';

// Generate mock historical data
const generateHistoricalData = (startValue: number, volatility: number, startYear = 2000, endYear = 2023) => {
  const data = [];
  let currentValue = startValue;
  
  for (let year = startYear; year <= endYear; year++) {
    // Add some randomization to simulate real data patterns
    const change = (Math.random() - 0.5) * volatility;
    currentValue = Math.max(0, currentValue + change);
    
    data.push({
      year,
      value: parseFloat(currentValue.toFixed(2))
    });
  }
  
  return data;
};

// Generate mock forecast data
const generateForecastData = (
  lastHistoricalValue: number, 
  trend: 'increasing' | 'decreasing' | 'stable', 
  volatility: number,
  startYear = 2024,
  endYear = 2035
) => {
  const data = [];
  let currentValue = lastHistoricalValue;
  
  // Set trend factor
  const trendFactor = trend === 'increasing' ? 0.3 : 
                     trend === 'decreasing' ? -0.2 : 0;
  
  for (let year = startYear; year <= endYear; year++) {
    // Apply trend and some randomization
    const trendChange = currentValue * trendFactor * (Math.random() * 0.5 + 0.75) / 100;
    const randomChange = (Math.random() - 0.5) * volatility;
    currentValue = Math.max(0, currentValue + trendChange + randomChange);
    
    data.push({
      year,
      value: parseFloat(currentValue.toFixed(2))
    });
  }
  
  return data;
};

// Create US inequality metrics
const usGiniHistorical = generateHistoricalData(0.45, 0.015);
const usGiniCurrent = usGiniHistorical[usGiniHistorical.length - 1].value;
const usGiniForecast = generateForecastData(usGiniCurrent, 'increasing', 0.01);

const usIncomeRatioHistorical = generateHistoricalData(15, 1.2);
const usIncomeRatioCurrent = usIncomeRatioHistorical[usIncomeRatioHistorical.length - 1].value;
const usIncomeRatioForecast = generateForecastData(usIncomeRatioCurrent, 'increasing', 0.8);

const usPovertyRateHistorical = generateHistoricalData(12, 1.5);
const usPovertyRateCurrent = usPovertyRateHistorical[usPovertyRateHistorical.length - 1].value;
const usPovertyRateForecast = generateForecastData(usPovertyRateCurrent, 'decreasing', 0.7);

const usWealthShareHistorical = generateHistoricalData(30, 2);
const usWealthShareCurrent = usWealthShareHistorical[usWealthShareHistorical.length - 1].value;
const usWealthShareForecast = generateForecastData(usWealthShareCurrent, 'increasing', 1.5);

// Create Washington state inequality metrics (slightly different trends)
const waGiniHistorical = generateHistoricalData(0.42, 0.012);
const waGiniCurrent = waGiniHistorical[waGiniHistorical.length - 1].value;
const waGiniForecast = generateForecastData(waGiniCurrent, 'stable', 0.008);

const waIncomeRatioHistorical = generateHistoricalData(13, 1.0);
const waIncomeRatioCurrent = waIncomeRatioHistorical[waIncomeRatioHistorical.length - 1].value;
const waIncomeRatioForecast = generateForecastData(waIncomeRatioCurrent, 'stable', 0.6);

const waPovertyRateHistorical = generateHistoricalData(10, 1.3);
const waPovertyRateCurrent = waPovertyRateHistorical[waPovertyRateHistorical.length - 1].value;
const waPovertyRateForecast = generateForecastData(waPovertyRateCurrent, 'decreasing', 0.8);

const waWealthShareHistorical = generateHistoricalData(25, 1.8);
const waWealthShareCurrent = waWealthShareHistorical[waWealthShareHistorical.length - 1].value;
const waWealthShareForecast = generateForecastData(waWealthShareCurrent, 'increasing', 1.2);

// Define US metrics
export const usMetrics: InequalityMetric[] = [
  {
    id: 'gini',
    name: 'Gini Coefficient',
    description: 'Measures income inequality where 0 represents perfect equality and 1 represents perfect inequality',
    currentValue: usGiniCurrent,
    historicalValues: usGiniHistorical,
    forecastValues: usGiniForecast,
    unit: '',
    domain: [0, 1]
  },
  {
    id: 'income-ratio',
    name: 'Income Ratio (Top 10% / Bottom 50%)',
    description: 'Ratio of income between the top 10% and bottom 50% of earners',
    currentValue: usIncomeRatioCurrent,
    historicalValues: usIncomeRatioHistorical,
    forecastValues: usIncomeRatioForecast,
    unit: 'x',
    domain: [0, 30]
  },
  {
    id: 'poverty-rate',
    name: 'Poverty Rate',
    description: 'Percentage of population living below the poverty line',
    currentValue: usPovertyRateCurrent,
    historicalValues: usPovertyRateHistorical,
    forecastValues: usPovertyRateForecast,
    unit: '%',
    domain: [0, 20]
  },
  {
    id: 'wealth-top1',
    name: 'Wealth Share (Top 1%)',
    description: 'Percentage of total wealth owned by the top 1%',
    currentValue: usWealthShareCurrent,
    historicalValues: usWealthShareHistorical,
    forecastValues: usWealthShareForecast,
    unit: '%',
    domain: [0, 50]
  }
];

// Define Washington metrics
export const washingtonMetrics: InequalityMetric[] = [
  {
    id: 'gini',
    name: 'Gini Coefficient',
    description: 'Measures income inequality where 0 represents perfect equality and 1 represents perfect inequality',
    currentValue: waGiniCurrent,
    historicalValues: waGiniHistorical,
    forecastValues: waGiniForecast,
    unit: '',
    domain: [0, 1]
  },
  {
    id: 'income-ratio',
    name: 'Income Ratio (Top 10% / Bottom 50%)',
    description: 'Ratio of income between the top 10% and bottom 50% of earners',
    currentValue: waIncomeRatioCurrent,
    historicalValues: waIncomeRatioHistorical,
    forecastValues: waIncomeRatioForecast,
    unit: 'x',
    domain: [0, 30]
  },
  {
    id: 'poverty-rate',
    name: 'Poverty Rate',
    description: 'Percentage of population living below the poverty line',
    currentValue: waPovertyRateCurrent,
    historicalValues: waPovertyRateHistorical,
    forecastValues: waPovertyRateForecast,
    unit: '%',
    domain: [0, 20]
  },
  {
    id: 'wealth-top1',
    name: 'Wealth Share (Top 1%)',
    description: 'Percentage of total wealth owned by the top 1%',
    currentValue: waWealthShareCurrent,
    historicalValues: waWealthShareHistorical,
    forecastValues: waWealthShareForecast,
    unit: '%',
    domain: [0, 50]
  }
];

// Export region data
export const regions: RegionData[] = [
  {
    id: 'us',
    name: 'United States',
    metrics: usMetrics
  },
  {
    id: 'washington',
    name: 'Washington State',
    metrics: washingtonMetrics
  }
];

// Helper functions to get data
export const getMetricById = (regionId: string, metricId: string): InequalityMetric | undefined => {
  const region = regions.find(r => r.id === regionId);
  if (!region) return undefined;
  
  return region.metrics.find(m => m.id === metricId);
};

export const getRegionById = (regionId: string): RegionData | undefined => {
  return regions.find(r => r.id === regionId);
};