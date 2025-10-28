import React from 'react';
import { FilterState } from '../types';
import { getDemographicsSummary } from '../data/seattleDemographics';
import LineChart from './charts/LineChart';
import BarChart from './charts/BarChart';
import Analysis from './Analysis';

interface VisualizationPanelProps {
  filters: FilterState;
}

const neighborhoods = [
  'Ballard',
  'Capitol Hill',
  'Downtown',
  'Fremont',
  'Queen Anne',
  'University District',
  'South Lake Union'
];

const VisualizationPanel: React.FC<VisualizationPanelProps> = ({ filters }) => {
  const getNeighborhoodMetrics = () => {
    return neighborhoods.map(name => {
      const data = getDemographicsSummary(name);
      if (!data) return null;

      return {
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name,
        currentValue: data.medianIncome / 1000,
        description: `Median income and demographics for ${name}`,
        unit: 'k',
        domain: [0, 120],
        historicalValues: [],
        forecastValues: []
      };
    }).filter(Boolean);
  };

  const filterDataByYearRange = (data: { year: number; value: number }[]) => {
    return data.filter(point => 
      point.year >= filters.yearRange[0] && 
      point.year <= filters.yearRange[1]
    );
  };

  const calculateSafeDomain = (data: { year: number; value: number }[]): [number, number] => {
    if (!data.length) return [0, 100]; // Safe default for empty data
    const values = data.map(p => p.value);
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    
    // If all values are 0 or maxValue equals minValue, return a safe domain
    if (maxValue === minValue) {
      const baseValue = maxValue || 100; // Use 100 if maxValue is 0
      return [0, baseValue * 1.2]; // Add 20% padding
    }
    
    // Add 10% padding to the domain
    const padding = (maxValue - minValue) * 0.1;
    return [Math.max(0, minValue - padding), maxValue + padding];
  };

  const metrics = getNeighborhoodMetrics();

  const renderCharts = () => {
    if (filters.timeframe === 'current') {
      return (
        <div className="grid grid-cols-1 gap-6 mb-6">
          <BarChart 
            metrics={metrics}
            title="Median Income by Neighborhood ($K)"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {neighborhoods.map(name => {
              const data = getDemographicsSummary(name);
              if (!data) return null;

              return (
                <div key={name} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
                  <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">{name}</h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Population</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        {data.totalPopulation.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Median Age</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        {data.medianAge.toFixed(1)} years
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Age Distribution</p>
                      <div className="flex gap-2 mt-1">
                        <div className="flex-1 bg-blue-100 dark:bg-blue-900 rounded p-2">
                          <p className="text-xs text-blue-800 dark:text-blue-200">Children</p>
                          <p className="text-sm font-bold text-blue-900 dark:text-blue-100">
                            {data.ageDistribution.children}%
                          </p>
                        </div>
                        <div className="flex-1 bg-purple-100 dark:bg-purple-900 rounded p-2">
                          <p className="text-xs text-purple-800 dark:text-purple-200">Working</p>
                          <p className="text-sm font-bold text-purple-900 dark:text-purple-100">
                            {data.ageDistribution.workingAge}%
                          </p>
                        </div>
                        <div className="flex-1 bg-amber-100 dark:bg-amber-900 rounded p-2">
                          <p className="text-xs text-amber-800 dark:text-amber-200">Elderly</p>
                          <p className="text-sm font-bold text-amber-900 dark:text-amber-100">
                            {data.ageDistribution.elderly}%
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    } else if (filters.timeframe === 'historical') {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {neighborhoods.map(name => {
            const data = getDemographicsSummary(name);
            if (!data?.history) return null;

            // Only show selected metrics
            const charts = [];
            
            if (filters.metrics.includes('population')) {
              const filteredData = filterDataByYearRange(data.history.population);
              if (filteredData.length > 0) {
                charts.push(
                  <LineChart
                    key={`${name}-population`}
                    title={`${name} - Population Trend`}
                    data={filteredData}
                    unit=""
                    domain={calculateSafeDomain(filteredData)}
                    color="#4F46E5"
                  />
                );
              }
            }

            if (filters.metrics.includes('median-income')) {
              const filteredData = filterDataByYearRange(data.history.medianIncome);
              if (filteredData.length > 0) {
                charts.push(
                  <LineChart
                    key={`${name}-income`}
                    title={`${name} - Median Income Trend`}
                    data={filteredData}
                    unit="$"
                    domain={calculateSafeDomain(filteredData)}
                    color="#10B981"
                  />
                );
              }
            }

            return charts;
          })}
        </div>
      );
    } else if (filters.timeframe === 'forecast') {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {neighborhoods.map(name => {
            const data = getDemographicsSummary(name);
            if (!data?.forecast) return null;

            // Only show selected metrics
            const charts = [];
            
            if (filters.metrics.includes('population')) {
              const filteredData = filterDataByYearRange(data.forecast.population);
              if (filteredData.length > 0) {
                charts.push(
                  <LineChart
                    key={`${name}-population`}
                    title={`${name} - Population Forecast`}
                    data={filteredData}
                    unit=""
                    domain={calculateSafeDomain(filteredData)}
                    color="#4F46E5"
                  />
                );
              }
            }

            if (filters.metrics.includes('median-income')) {
              const filteredData = filterDataByYearRange(data.forecast.medianIncome);
              if (filteredData.length > 0) {
                charts.push(
                  <LineChart
                    key={`${name}-income`}
                    title={`${name} - Median Income Forecast`}
                    data={filteredData}
                    unit="$"
                    domain={calculateSafeDomain(filteredData)}
                    color="#10B981"
                  />
                );
              }
            }

            return charts;
          })}
        </div>
      );
    }
    
    return null;
  };

  return (
    <div>
      {renderCharts()}
      <Analysis filters={filters} />
    </div>
  );
};

export default VisualizationPanel;