import React, { useState, useEffect } from 'react';
import { FilterState } from '../types';
import LineChart from './charts/LineChart';
import BarChart from './charts/BarChart';
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

type VisualizationType = 'overview' | 'comparison' | 'analysis' | 'lorenz' | 'stacked' | 'waffle';

const VisualizationPanel: React.FC<VisualizationPanelProps> = ({ filters, selectedRegion = 'United States' }) => {
  const [regionData, setRegionData] = useState<RegionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visualizationType, setVisualizationType] = useState<VisualizationType>('overview');

  useEffect(() => {
    const fetchRegionData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`http://localhost:8000/api/enriched-state/${selectedRegion}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch data for ${selectedRegion}`);
        }
        const data = await response.json();
        if (data.success && data.profile) {
          setRegionData(data);
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
            {metricsToShow.showPopulation && demographics.population !== undefined && (
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 border-l-4 border-blue-500">
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Population</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {(demographics.population / 1000000).toFixed(1)}M
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">Total residents</p>
              </div>
            )}
            {metricsToShow.showIncome && demographics.median_household_income !== undefined && (
              <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4 border-l-4 border-green-500">
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Median Income</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  ${(demographics.median_household_income / 1000).toFixed(0)}K
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">Household annual</p>
              </div>
            )}
            {metricsToShow.showPoverty && demographics.poverty_rate !== undefined && (
              <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded-lg p-4 border-l-4 border-yellow-500">
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Poverty Rate</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {demographics.poverty_rate.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">Below poverty line</p>
              </div>
            )}
            {metricsToShow.showEducation && demographics.education_bachelor_and_above !== undefined && (
              <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-4 border-l-4 border-purple-500">
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Education</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {demographics.education_bachelor_and_above.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">Bachelor's degree+</p>
              </div>
            )}
            {metricsToShow.showUnemployment && latestUnemploymentRate !== undefined && (
              <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-4 border-l-4 border-red-500">
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Unemployment</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {latestUnemploymentRate.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">Current rate</p>
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
        <LorenzCurve
          incomeData={generateLorenzData(regionData)}
          title={`${selectedRegion} - Income Inequality (Lorenz Curve)`}
        />
      )}
      
      {visualizationType === 'stacked' && (
        <StackedAreaChart
          data={generateStackedAreaData(regionData)}
          title={`${selectedRegion} - Income Distribution by Decile Over Time`}
        />
      )}
      
      {visualizationType === 'waffle' && (
        <WaffleChart
          data={generateWaffleData(regionData)}
          title={`${selectedRegion} - Population Distribution by Income Bracket`}
        />
      )}
    </div>
  );
};

// Helper function to generate Lorenz curve data
function generateLorenzData(regionData: RegionData | null) {
  if (!regionData) return [];
  
  // Generate mock decile data - in production, this would come from API
  return [
    { bracket: 'Bottom 10%', percentage: 2, cumulativePopulation: 10, cumulativeWealth: 2 },
    { bracket: '10-20%', percentage: 3.5, cumulativePopulation: 20, cumulativeWealth: 5.5 },
    { bracket: '20-30%', percentage: 4.5, cumulativePopulation: 30, cumulativeWealth: 10 },
    { bracket: '30-40%', percentage: 5.5, cumulativePopulation: 40, cumulativeWealth: 15.5 },
    { bracket: '40-50%', percentage: 6.5, cumulativePopulation: 50, cumulativeWealth: 22 },
    { bracket: '50-60%', percentage: 7.5, cumulativePopulation: 60, cumulativeWealth: 29.5 },
    { bracket: '60-70%', percentage: 9, cumulativePopulation: 70, cumulativeWealth: 38.5 },
    { bracket: '70-80%', percentage: 11, cumulativePopulation: 80, cumulativeWealth: 49.5 },
    { bracket: '80-90%', percentage: 14, cumulativePopulation: 90, cumulativeWealth: 63.5 },
    { bracket: 'Top 10%', percentage: 36.5, cumulativePopulation: 100, cumulativeWealth: 100 },
  ];
}

// Helper function to generate stacked area chart data
function generateStackedAreaData(regionData: RegionData | null) {
  if (!regionData) return [];
  
  // Generate mock time series data
  const years = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023];
  return years.map(year => ({
    year,
    'Bottom 10%': 2 + Math.random() * 0.5,
    '10-20%': 3.5 + Math.random() * 0.5,
    '20-30%': 4.5 + Math.random() * 0.5,
    '30-40%': 5.5 + Math.random() * 0.5,
    '40-50%': 6.5 + Math.random() * 0.5,
    '50-60%': 7.5 + Math.random() * 0.5,
    '60-70%': 9 + Math.random() * 0.5,
    '70-80%': 11 + Math.random() * 0.5,
    '80-90%': 14 + Math.random() * 0.5,
    'Top 10%': 36.5 + Math.random() * 1,
  }));
}

// Helper function to generate waffle chart data
function generateWaffleData(regionData: RegionData | null) {
  if (!regionData) return [];
  
  return [
    { bracket: 'Bottom 10%', percentage: 2, color: '#ef4444' },
    { bracket: '10-20%', percentage: 3.5, color: '#f97316' },
    { bracket: '20-30%', percentage: 4.5, color: '#eab308' },
    { bracket: '30-40%', percentage: 5.5, color: '#84cc16' },
    { bracket: '40-50%', percentage: 6.5, color: '#22c55e' },
    { bracket: '50-60%', percentage: 7.5, color: '#10b981' },
    { bracket: '60-70%', percentage: 9, color: '#14b8a6' },
    { bracket: '70-80%', percentage: 11, color: '#06b6d4' },
    { bracket: '80-90%', percentage: 14, color: '#0ea5e9' },
    { bracket: 'Top 10%', percentage: 36.5, color: '#3b82f6' },
  ];
}

export default VisualizationPanel;