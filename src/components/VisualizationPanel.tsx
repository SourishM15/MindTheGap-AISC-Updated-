import React, { useState, useEffect } from 'react';
import { FilterState } from '../types';
import LineChart from './charts/LineChart';
import BarChart from './charts/BarChart';
import Analysis from './Analysis';
import RegionalComparison from './RegionalComparison';
import { BarChart as BarChartIcon, TrendingUp, Info } from 'lucide-react';

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

type VisualizationType = 'overview' | 'comparison' | 'analysis';

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
      </div>

      {/* Content based on selected visualization type */}
      {visualizationType === 'overview' && renderCharts()}
      {visualizationType === 'comparison' && regionData && (
        <RegionalComparison selectedRegion={selectedRegion} regionData={regionData} />
      )}
      {visualizationType === 'analysis' && regionData && (
        <Analysis filters={filters} selectedRegion={selectedRegion} regionData={regionData} />
      )}
    </div>
  );
};

export default VisualizationPanel;