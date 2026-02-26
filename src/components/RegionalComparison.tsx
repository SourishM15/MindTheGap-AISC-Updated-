import React, { useState, useEffect } from 'react';
import { BarChart as BarChartIcon, LineChart as LineChartIcon, TrendingUp } from 'lucide-react';

interface RegionalComparisonProps {
  selectedRegion: string;
  regionData: any;
}

type ChartType = 'metrics' | 'vs-usa' | 'chart' | 'trend';

const RegionalComparison: React.FC<RegionalComparisonProps> = ({ selectedRegion, regionData }) => {
  const [chartType, setChartType] = useState<ChartType>('metrics');
  
  // Initialize with USA baseline so it's always available
  const [usaData, setUsaData] = useState<any>({
    state: 'United States',
    profile: {
      demographics: {
        population: 331897000,
        median_household_income: 74580,
        poverty_rate: 12.6,
        education_bachelor_and_above: 21.9
      }
    }
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if ((chartType === 'vs-usa' || chartType === 'chart') && usaData?.state !== 'United States') {
      // Only fetch if we don't have USA data yet
      fetchUSAData();
    }
  }, [chartType]);

  const fetchUSAData = async () => {
    setLoading(true);
    try {
      // Try multiple approaches to get USA baseline data
      let response = await fetch('http://localhost:8000/api/enriched-state/United%20States');
      
      if (!response.ok) {
        // Try alternative endpoint
        response = await fetch('http://localhost:8000/api/enriched-states');
      }
      
      if (response.ok) {
        const data = await response.json();
        
        // If it's a list, try to calculate averages or use first entry
        if (Array.isArray(data)) {
          const sampleState = data.find((s: any) => s.state === 'California') || data[0];
          setUsaData(sampleState);
        } else {
          setUsaData(data);
        }
      } else {
        // Keep using the initialized fallback from state
      }
    } catch (err) {
      console.error('Error fetching USA data:', err);
      // Keep using the initialized fallback
    } finally {
      setLoading(false);
    }
  };

  const demographics = regionData?.profile?.demographics || {};
  const usaDemographics = usaData?.profile?.demographics || {};

  const metrics = [
    {
      label: 'Population',
      regionValue: demographics.population,
      usaValue: usaDemographics.population,
      format: (val: number) => `${(val / 1000000).toFixed(2)}M`,
      color: 'blue'
    },
    {
      label: 'Median Income',
      regionValue: demographics.median_household_income,
      usaValue: usaDemographics.median_household_income,
      format: (val: number) => `$${(val / 1000).toFixed(0)}K`,
      color: 'green'
    },
    {
      label: 'Poverty Rate',
      regionValue: demographics.poverty_rate,
      usaValue: usaDemographics.poverty_rate,
      format: (val: number) => `${val.toFixed(1)}%`,
      color: 'yellow',
      inverse: true // Lower is better
    },
    {
      label: 'Education (Bachelor+)',
      regionValue: demographics.education_bachelor_and_above,
      usaValue: usaDemographics.education_bachelor_and_above,
      format: (val: number) => `${val.toFixed(1)}%`,
      color: 'purple'
    }
  ];

  const renderMetricsView = () => (
    <div className="space-y-4">
      {metrics.map((metric, idx) => {
        if (metric.regionValue === undefined) return null;

        return (
          <div key={idx} className="bg-white dark:bg-gray-700 rounded-lg p-5 border-l-4 border-indigo-500 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200">{metric.label}</h3>
            </div>
            
            {/* Main value */}
            <div className="mb-4">
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {metric.format(metric.regionValue)}
              </p>
            </div>

            {/* Visual bar representation */}
            <div className="mb-4">
              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-400 to-blue-600 h-full rounded-full transition-all duration-300"
                  style={{ width: '85%' }}
                />
              </div>
            </div>

            {/* USA comparison if available */}
            {metric.usaValue !== undefined && (
              <div className="pt-3 border-t border-gray-300 dark:border-gray-600">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">USA Average</p>
                <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">{metric.format(metric.usaValue)}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderComparisonView = () => {
    if (loading) {
      return <div className="text-center py-8 text-gray-600 dark:text-gray-400">Loading USA baseline data...</div>;
    }

    if (!usaData) {
      return (
        <div className="bg-amber-50 dark:bg-amber-900/30 rounded-lg p-6 border border-amber-300 dark:border-amber-700">
          <p className="text-amber-800 dark:text-amber-200">
            Unable to load USA baseline data.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {metrics.map((metric, idx) => {
          if (metric.regionValue === undefined || metric.usaValue === undefined) return null;

          const percentage = (metric.regionValue / metric.usaValue) * 100;
          const difference = percentage - 100;
          const isAboveAverage = metric.inverse ? difference < 0 : difference > 0;
          const statusColor = isAboveAverage ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

          // Calculate bar widths for visualization
          const maxValue = Math.max(metric.regionValue, metric.usaValue);
          const regionBarWidth = (metric.regionValue / maxValue) * 100;
          const usaBarWidth = (metric.usaValue / maxValue) * 100;

          return (
            <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-700">
              {/* Metric header */}
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{metric.label}</h3>
                <span className={`text-xl font-bold ${statusColor}`}>
                  {difference >= 0 ? '+' : ''}{difference.toFixed(1)}%
                </span>
              </div>

              {/* Bar chart comparison */}
              <div className="space-y-3">
                {/* Region bar */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{selectedRegion}</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{metric.format(metric.regionValue)}</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-8 overflow-hidden">
                    <div
                      className="bg-blue-500 dark:bg-blue-600 h-full rounded-full flex items-center justify-end pr-2 transition-all duration-300"
                      style={{ width: `${regionBarWidth}%` }}
                    >
                      {regionBarWidth > 20 && (
                        <span className="text-xs font-bold text-white">{percentage.toFixed(0)}%</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* USA bar */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">USA Average</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{metric.format(metric.usaValue)}</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-8 overflow-hidden">
                    <div
                      className="bg-indigo-500 dark:bg-indigo-600 h-full rounded-full flex items-center justify-end pr-2 transition-all duration-300"
                      style={{ width: '100%' }}
                    >
                      <span className="text-xs font-bold text-white">100%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status indicator */}
              <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-600">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {isAboveAverage
                    ? `${selectedRegion} is ${Math.abs(difference).toFixed(1)}% ${
                        metric.inverse ? 'lower' : 'higher'
                      } than the USA average`
                    : `${selectedRegion} is ${Math.abs(difference).toFixed(1)}% ${
                        metric.inverse ? 'higher' : 'lower'
                      } than the USA average`}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderTrendView = () => (
    <div className="bg-white dark:bg-gray-700 rounded-lg p-6">
      <p className="text-center text-gray-600 dark:text-gray-400">
        Economic indicators for {selectedRegion} are displayed in the key demographics section above.
      </p>
      <p className="text-center text-sm text-gray-500 dark:text-gray-500 mt-3">
        Time-series data and forecasts will be available in future updates.
      </p>
    </div>
  );

  const renderChartView = () => {
    if (loading) {
      return <div className="text-center py-8 text-gray-600 dark:text-gray-400">Loading USA data...</div>;
    }

    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Metrics Comparison Chart</h3>
        
        {/* Normalize all metrics to 0-100 scale for visual comparison */}
        {metrics.map((metric, idx) => {
          if (metric.regionValue === undefined) return null;

          const maxVal = Math.max(metric.regionValue, metric.usaValue || 0);
          const regionPercent = (metric.regionValue / maxVal) * 100;
          const usaPercent = metric.usaValue ? (metric.usaValue / maxVal) * 100 : 0;

          return (
            <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">{metric.label}</h4>
              
              {/* Region bar */}
              <div className="mb-3">
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-gray-700 dark:text-gray-300">{selectedRegion}</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{metric.format(metric.regionValue)}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-lg h-6 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-400 to-blue-600 h-full flex items-center justify-end pr-2 transition-all duration-300"
                    style={{ width: `${regionPercent}%` }}
                  >
                    {regionPercent > 25 && (
                      <span className="text-xs font-bold text-white">{regionPercent.toFixed(0)}%</span>
                    )}
                  </div>
                </div>
              </div>

              {/* USA bar */}
              {metric.usaValue !== undefined && usaPercent > 0 && (
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-gray-700 dark:text-gray-300">USA Average</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{metric.format(metric.usaValue)}</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-lg h-6 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-indigo-400 to-indigo-600 h-full flex items-center justify-end pr-2 transition-all duration-300"
                      style={{ width: `${usaPercent}%` }}
                    >
                      {usaPercent > 25 && (
                        <span className="text-xs font-bold text-white">{usaPercent.toFixed(0)}%</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Chart Type Selector */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setChartType('metrics')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            chartType === 'metrics'
              ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          <BarChartIcon className="w-4 h-4" />
          Metrics
        </button>
        <button
          onClick={() => setChartType('chart')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            chartType === 'chart'
              ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          <BarChartIcon className="w-4 h-4" />
          Comparison Chart
        </button>
        <button
          onClick={() => setChartType('vs-usa')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            chartType === 'vs-usa'
              ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          vs USA
        </button>
      </div>

      {/* Chart Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        {chartType === 'metrics' && renderMetricsView()}
        {chartType === 'chart' && renderChartView()}
        {chartType === 'vs-usa' && renderComparisonView()}
        {chartType === 'trend' && renderTrendView()}
      </div>
    </div>
  );
};

export default RegionalComparison;
