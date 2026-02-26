import React, { useState, useEffect } from 'react';
import { FilterState } from '../types';
import { MAJOR_METRO_AREAS } from '../data/states';
import LorenzCurve from './charts/LorenzCurve';
import StackedAreaChart from './charts/StackedAreaChart';
import WaffleChart from './charts/WaffleChart';
import Analysis from './Analysis';
import RegionalComparison from './RegionalComparison';
import { BarChart as BarChartIcon, TrendingUp, Info, PieChart, Grid3x3 } from 'lucide-react';

interface VisualizationPanelProps {
  filters: FilterState;
  selectedRegion?: string;
}

interface RegionData {
  state: string;
  profile: {
    demographics?: {
      population?: number;
      median_household_income?: number;
      poverty_rate?: number;
      education_bachelor_and_above?: number;
      unemployment_rate?: number;
    };
    economics?: {
      indicators?: any;
    };
  };
}

interface WealthDistributionData {
  gini_coefficient: number;
  data_date: string;
  lorenz_data: { bracket: string; cumulativePopulation: number; cumulativeWealth: number; percentage: number }[];
  stacked_data: Record<string, number>[];
  waffle_data: { bracket: string; percentage: number; color: string }[];
  source: string;
}

interface IncomeLorenzData {
  gini_coefficient: number | null;
  median_household_income: number | null;
  lorenz_data: { bracket: string; percentage: number; cumulativePopulation: number; cumulativeWealth: number }[];
  waffle_data: { bracket: string; percentage: number; color: string }[];
  source: string;
  year: number;
  state_specific: boolean;
}

interface SAIPESnapshot {
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

interface SAIPETimeSeries {
  year: number;
  poverty_rate: number | null;
  child_poverty_rate: number | null;
  median_household_income: number | null;
}

interface SAIPEData {
  snapshot: SAIPESnapshot;
  time_series: SAIPETimeSeries[];
}

type VisualizationType = 'overview' | 'comparison' | 'analysis' | 'lorenz' | 'stacked' | 'waffle';

// Maps metro area name → home state full name (for SAIPE + income-lorenz which are state-level)
const METRO_TO_STATE: Record<string, string> = {
  'Atlanta':      'Georgia',
  'Austin':       'Texas',
  'Boston':       'Massachusetts',
  'Chicago':      'Illinois',
  'Dallas':       'Texas',
  'Denver':       'Colorado',
  'Houston':      'Texas',
  'Jacksonville': 'Florida',
  'Los Angeles':  'California',
  'Miami':        'Florida',
  'Minneapolis':  'Minnesota',
  'New York':     'New York',
  'Philadelphia': 'Pennsylvania',
  'Phoenix':      'Arizona',
  'Portland':     'Oregon',
  'San Antonio':  'Texas',
  'San Diego':    'California',
  'San Jose':     'California',
  'Seattle':      'Washington',
  'Washington':   'District of Columbia',
};

const VisualizationPanel: React.FC<VisualizationPanelProps> = ({ filters, selectedRegion = 'United States' }) => {
  const [regionData, setRegionData] = useState<RegionData | null>(null);
  const [wealthData, setWealthData] = useState<WealthDistributionData | null>(null);
  const [saipeData, setSaipeData] = useState<SAIPEData | null>(null);
  const [incomeDistData, setIncomeDistData] = useState<IncomeLorenzData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visualizationType, setVisualizationType] = useState<VisualizationType>('overview');

  useEffect(() => {
    const fetchRegionData = async () => {
      setLoading(true);
      setError(null);
      setIncomeDistData(null);
      try {
        const isMetro = MAJOR_METRO_AREAS.includes(selectedRegion);
        const stateForRegion = isMetro ? (METRO_TO_STATE[selectedRegion] ?? selectedRegion) : selectedRegion;
        const enrichedEndpoint = isMetro
          ? `http://localhost:8000/api/enriched-metro/${encodeURIComponent(selectedRegion)}`
          : `http://localhost:8000/api/enriched-state/${selectedRegion}`;

        const [regionRes, wealthRes, saipeRes, incomeRes] = await Promise.all([
          fetch(enrichedEndpoint),
          fetch('http://localhost:8000/api/wealth-distribution'),
          fetch(`http://localhost:8000/api/saipe-state/${stateForRegion}`),
          fetch(`http://localhost:8000/api/income-lorenz/${stateForRegion}`),
        ]);

        if (regionRes.ok) {
          const data = await regionRes.json();
          // Normalise metro response shape to match state shape (state field)
          if (data.success && data.profile) {
            if (isMetro && data.metro) data.state = data.metro;
            setRegionData(data);
          }
        }

        if (wealthRes.ok) {
          const wData = await wealthRes.json();
          if (wData.success) setWealthData(wData);
        }

        if (saipeRes.ok) {
          const sData = await saipeRes.json();
          if (sData.success) setSaipeData(sData);
        }

        if (incomeRes.ok) {
          const iData = await incomeRes.json();
          if (iData.success && iData.state_specific && iData.data) {
            setIncomeDistData({ ...iData.data, state_specific: true });
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error fetching data');
      } finally {
        setLoading(false);
      }
    };

    fetchRegionData();
  }, [selectedRegion]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600 dark:text-gray-400">Loading data for {selectedRegion}...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-800 dark:text-red-200 px-4 py-3 rounded">
        {error}
      </div>
    );
  }

  if (!regionData) {
    return (
      <div className="bg-yellow-100 dark:bg-yellow-900 border border-yellow-400 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200 px-4 py-3 rounded">
        No data available for {selectedRegion}
      </div>
    );
  }

  const demographics = regionData.profile?.demographics || {};
  const economics = regionData.profile?.economics || {};
  
  // Extract latest unemployment rate from time series data
  const unemploymentData = economics.indicators?.unemployment_rate?.data || {};
  const latestUnemploymentRate = unemploymentData[Object.keys(unemploymentData).sort().pop() as string];

  const renderCharts = () => {
    // Determine which metrics to display based on filter selections
    const metricsToShow = {
      showPopulation: filters.metrics.includes('population'),
      showIncome: filters.metrics.includes('median-income'),
      showPoverty: true,
      showEducation: true,
      showUnemployment: true
    };

    return (
      <div className="grid grid-cols-1 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {selectedRegion} - Key Demographics
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Timeframe: {filters.timeframe === 'current' ? 'Current Data' : filters.timeframe === 'historical' ? 'Historical Trends' : 'Forecast'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {metricsToShow.showPopulation && demographics.population != null && (
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 border-l-4 border-blue-500">
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Population</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {(demographics.population / 1000000).toFixed(1)}M
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">Total residents</p>
              </div>
            )}
            {metricsToShow.showIncome && demographics.median_household_income != null && (
              <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4 border-l-4 border-green-500">
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Median Income</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  ${(demographics.median_household_income / 1000).toFixed(0)}K
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">Household annual</p>
              </div>
            )}
            {metricsToShow.showPoverty && demographics.poverty_rate != null && (
              <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded-lg p-4 border-l-4 border-yellow-500">
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Poverty Rate</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {demographics.poverty_rate.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">Below poverty line</p>
              </div>
            )}
            {metricsToShow.showEducation && demographics.education_bachelor_and_above != null && (
              <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-4 border-l-4 border-purple-500">
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Education</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {demographics.education_bachelor_and_above.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">Bachelor's degree+</p>
              </div>
            )}
            {metricsToShow.showUnemployment && latestUnemploymentRate != null && (
              <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-4 border-l-4 border-red-500">
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Unemployment</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {latestUnemploymentRate.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">Current rate</p>
              </div>
            )}
            {/* SAIPE-sourced state-specific data */}
            {saipeData?.snapshot?.child_poverty_rate != null && (
              <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg p-4 border-l-4 border-orange-500">
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Child Poverty Rate</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {saipeData.snapshot.child_poverty_rate.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">Under 18 · SAIPE {saipeData.snapshot.year}</p>
              </div>
            )}
            {saipeData?.snapshot?.median_household_income != null && (
              <div className="bg-teal-50 dark:bg-teal-900/30 rounded-lg p-4 border-l-4 border-teal-500">
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Median Income (SAIPE)</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  ${(saipeData.snapshot.median_household_income / 1000).toFixed(0)}K
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">State estimate · SAIPE {saipeData.snapshot.year}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Visualization Type Selector */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setVisualizationType('overview')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            visualizationType === 'overview'
              ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          <BarChartIcon className="w-4 h-4" />
          Overview
        </button>
        <button
          onClick={() => setVisualizationType('comparison')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            visualizationType === 'comparison'
              ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Compare to USA
        </button>
        <button
          onClick={() => setVisualizationType('analysis')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            visualizationType === 'analysis'
              ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          <Info className="w-4 h-4" />
          Economic Insights
        </button>
        
        {/* New Advanced Visualizations */}
        <div className="border-l border-gray-300 dark:border-gray-600 pl-2 ml-2" />
        
        <button
          onClick={() => setVisualizationType('lorenz')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            visualizationType === 'lorenz'
              ? 'bg-blue-600 dark:bg-blue-500 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
          title="Shows wealth distribution with Gini coefficient"
        >
          <PieChart className="w-4 h-4" />
          Lorenz Curve
        </button>
        
        <button
          onClick={() => setVisualizationType('stacked')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            visualizationType === 'stacked'
              ? 'bg-green-600 dark:bg-green-500 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
          title="Shows income distribution by decile over time"
        >
          <TrendingUp className="w-4 h-4" />
          Stacked Distribution
        </button>
        
        <button
          onClick={() => setVisualizationType('waffle')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            visualizationType === 'waffle'
              ? 'bg-purple-600 dark:bg-purple-500 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
          title="100-square grid showing population distribution"
        >
          <Grid3x3 className="w-4 h-4" />
          Waffle Chart
        </button>
      </div>

      {/* Content based on selected visualization type */}
      {visualizationType === 'overview' && renderCharts()}
      {visualizationType === 'comparison' && regionData && (
        <RegionalComparison selectedRegion={selectedRegion} regionData={regionData} />
      )}
      {visualizationType === 'analysis' && regionData && (
        <Analysis filters={filters} selectedRegion={selectedRegion} regionData={regionData} />
      )}
      
      {/* Advanced Visualizations */}
      {visualizationType === 'lorenz' && (
        <div>
          {/* SAIPE state-specific context banner */}
          {saipeData?.snapshot && (
            <div className="mb-4 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 rounded-lg p-4 flex flex-wrap gap-6 text-sm">
              <span className="font-semibold text-indigo-800 dark:text-indigo-300">{selectedRegion} · SAIPE {saipeData.snapshot.year}</span>
              {saipeData.snapshot.poverty_rate != null && (
                <span className="text-gray-700 dark:text-gray-300">Poverty Rate: <strong>{saipeData.snapshot.poverty_rate.toFixed(1)}%</strong></span>
              )}
              {saipeData.snapshot.child_poverty_rate != null && (
                <span className="text-gray-700 dark:text-gray-300">Child Poverty: <strong>{saipeData.snapshot.child_poverty_rate.toFixed(1)}%</strong></span>
              )}
              {saipeData.snapshot.median_household_income != null && (
                <span className="text-gray-700 dark:text-gray-300">Median Income: <strong>${saipeData.snapshot.median_household_income.toLocaleString()}</strong></span>
              )}
              <span className="text-xs text-indigo-500 dark:text-indigo-400 ml-auto">Source: Census Bureau SAIPE</span>
            </div>
          )}
          <LorenzCurve
            incomeData={generateLorenzData(regionData, wealthData, incomeDistData)}
            giniCoefficient={incomeDistData?.gini_coefficient ?? wealthData?.gini_coefficient}
            title={incomeDistData
              ? `${selectedRegion} Income Inequality · Gini: ${incomeDistData.gini_coefficient?.toFixed(3) ?? 'N/A'} · Source: Census ACS ${incomeDistData.year}`
              : `Net Worth Inequality · Gini: ${wealthData ? wealthData.gini_coefficient.toFixed(3) : 'N/A'} · Source: Federal Reserve DFA (National)`
            }
          />
        </div>
      )}

      {visualizationType === 'stacked' && (
        <StackedAreaChart
          data={generateStackedAreaData(regionData, wealthData)}
          title={`Income Share by Bracket 1989–2025 · Source: Federal Reserve DFA`}
        />
      )}

      {visualizationType === 'waffle' && (
        <div>
          {saipeData?.snapshot && (
            <div className="mb-4 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded-lg p-4 flex flex-wrap gap-6 text-sm">
              <span className="font-semibold text-purple-800 dark:text-purple-300">{selectedRegion} · SAIPE {saipeData.snapshot.year}</span>
              {saipeData.snapshot.poverty_rate != null && (
                <span className="text-gray-700 dark:text-gray-300">All-age Poverty: <strong>{saipeData.snapshot.poverty_rate.toFixed(1)}%</strong></span>
              )}
              {saipeData.snapshot.poverty_count != null && (
                <span className="text-gray-700 dark:text-gray-300">In Poverty: <strong>{saipeData.snapshot.poverty_count.toLocaleString()}</strong> people</span>
              )}
              <span className="text-xs text-purple-500 dark:text-purple-400 ml-auto">Source: Census Bureau SAIPE</span>
            </div>
          )}
          <WaffleChart
            data={generateWaffleData(regionData, wealthData, incomeDistData)}
            title={incomeDistData
              ? `${selectedRegion} Income Distribution (${incomeDistData.year}) · Source: Census ACS`
              : `Income Share Distribution (${wealthData?.data_date ?? 'latest'}) · Source: Federal Reserve DFA`
            }
          />
        </div>
      )}
    </div>
  );
};

// Helper function to generate Lorenz curve data
function generateLorenzData(_regionData: RegionData | null, wealthData: WealthDistributionData | null, incomeDistData: IncomeLorenzData | null = null) {
  // Prefer state-specific ACS income data
  if (incomeDistData?.lorenz_data?.length) return incomeDistData.lorenz_data;
  // Fall back to national DFA wealth data
  if (wealthData?.lorenz_data?.length) return wealthData.lorenz_data;

  // Fallback mock data
  return [
    { bracket: 'Origin',        percentage: 0,    cumulativePopulation: 0,   cumulativeWealth: 0 },
    { bracket: 'Bottom 50%',    percentage: 2.5,  cumulativePopulation: 50,  cumulativeWealth: 2.5 },
    { bracket: 'Next 40%',      percentage: 30.1, cumulativePopulation: 90,  cumulativeWealth: 32.6 },
    { bracket: 'Next 9%',       percentage: 36.4, cumulativePopulation: 99,  cumulativeWealth: 69.0 },
    { bracket: 'Top 1-0.1%',    percentage: 17.1, cumulativePopulation: 99.9,cumulativeWealth: 86.1 },
    { bracket: 'Top 0.1%',      percentage: 13.9, cumulativePopulation: 100, cumulativeWealth: 100 },
  ];
}

// Helper function to generate stacked area chart data
function generateStackedAreaData(_regionData: RegionData | null, wealthData: WealthDistributionData | null): { year: number; [decile: string]: string | number }[] {
  // Use real Federal Reserve DFA time series if available
  if (wealthData?.stacked_data?.length) return wealthData.stacked_data as { year: number; [decile: string]: string | number }[];

  // Fallback mock data
  const years = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023];
  return years.map(year => ({
    year,
    'Bottom 20%': 3 + Math.random() * 0.3,
    '20-40%':     7 + Math.random() * 0.3,
    '40-60%':     12 + Math.random() * 0.3,
    '60-80%':     18 + Math.random() * 0.3,
    '80-99%':     40 + Math.random() * 0.5,
    'Top 1%':     17 + Math.random() * 0.5,
  }));
}

// Helper function to generate waffle chart data
function generateWaffleData(_regionData: RegionData | null, wealthData: WealthDistributionData | null, incomeDistData: IncomeLorenzData | null = null) {
  // Prefer state-specific ACS income data
  if (incomeDistData?.waffle_data?.length) return incomeDistData.waffle_data;
  // Fall back to national DFA data
  if (wealthData?.waffle_data?.length) return wealthData.waffle_data;

  // Fallback mock data
  return [
    { bracket: 'Bottom 20%', percentage: 3,    color: '#ef4444' },
    { bracket: '20-40%',     percentage: 7,    color: '#f97316' },
    { bracket: '40-60%',     percentage: 12,   color: '#eab308' },
    { bracket: '60-80%',     percentage: 18,   color: '#22c55e' },
    { bracket: '80-99%',     percentage: 43,   color: '#0ea5e9' },
    { bracket: 'Top 1%',     percentage: 17,   color: '#3b82f6' },
  ];
}

export default VisualizationPanel;