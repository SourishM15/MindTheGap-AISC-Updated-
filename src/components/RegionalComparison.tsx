import React, { useState, useEffect } from 'react';
import { BarChart as BarChartIcon, TrendingUp } from 'lucide-react';
import { apiFetch } from '../utils/api';

interface RegionalComparisonProps {
  selectedRegion: string;
  regionData: RegionalData;
}

type ChartType = 'metrics' | 'vs-usa' | 'chart' | 'trend';

interface RegionalData {
  state?: string;
  profile?: {
    demographics?: {
      population?: number;
      median_household_income?: number;
      poverty_rate?: number;
      education_bachelor_and_above?: number;
    };
  };
}

const RegionalComparison: React.FC<RegionalComparisonProps> = ({ selectedRegion, regionData }) => {
  const [chartType, setChartType] = useState<ChartType>('metrics');
  
  // Initialize with USA baseline so it's always available
  const [usaData, setUsaData] = useState<RegionalData>({
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
      let response = await apiFetch('/api/enriched-state/United%20States');
      
      if (!response.ok) {
        // Try alternative endpoint
        response = await apiFetch('/api/enriched-states');
      }
      
      if (response.ok) {
        const data = await response.json();
        
        // If it's a list of states, do NOT use any single state as the USA baseline —
        // that would show a state's numbers (e.g. California) as national averages.
        // Just keep the hardcoded USA fallback initialized in useState above.
        if (!Array.isArray(data)) {
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
          <div key={idx} className="metric-card border-l-4 border-l-cyan-500">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">{metric.label}</h3>
            </div>
            
            {/* Main value */}
            <div className="mb-4">
              <p className="text-3xl font-bold text-slate-900 dark:text-white">
                {metric.format(metric.regionValue)}
              </p>
            </div>

            {/* Visual bar representation */}
            <div className="mb-4">
              <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-slate-950 transition-all duration-300 dark:bg-cyan-400"
                  style={{ width: '85%' }}
                />
              </div>
            </div>

            {/* USA comparison if available */}
            {metric.usaValue !== undefined && (
              <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
                <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">USA Average</p>
                <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">{metric.format(metric.usaValue)}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderComparisonView = () => {
    if (loading) {
      return <div className="py-8 text-center text-slate-600 dark:text-slate-400">Loading USA baseline data...</div>;
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
          return (
            <div key={idx} className="metric-card">
              {/* Metric header */}
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{metric.label}</h3>
                <span className={`text-xl font-bold ${statusColor}`}>
                  {difference >= 0 ? '+' : ''}{difference.toFixed(1)}%
                </span>
              </div>

              {/* Bar chart comparison */}
              <div className="space-y-3">
                {/* Region bar */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{selectedRegion}</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{metric.format(metric.regionValue)}</span>
                  </div>
                  <div className="h-8 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      className="flex h-full items-center justify-end rounded-full bg-slate-950 pr-2 transition-all duration-300 dark:bg-cyan-400"
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
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">USA Average</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{metric.format(metric.usaValue)}</span>
                  </div>
                  <div className="h-8 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      className="flex h-full items-center justify-end rounded-full bg-slate-500 pr-2 transition-all duration-300 dark:bg-slate-600"
                      style={{ width: '100%' }}
                    >
                      <span className="text-xs font-bold text-white">100%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status indicator */}
              <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
                <p className="text-sm text-slate-600 dark:text-slate-400">
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
    <div className="surface-muted p-6">
      <p className="text-center text-slate-600 dark:text-slate-400">
        Economic indicators for {selectedRegion} are displayed in the key demographics section above.
      </p>
      <p className="mt-3 text-center text-sm text-slate-500 dark:text-slate-500">
        Time-series data and forecasts will be available in future updates.
      </p>
    </div>
  );

  const renderChartView = () => {
    if (loading) {
      return <div className="py-8 text-center text-slate-600 dark:text-slate-400">Loading USA data...</div>;
    }

    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Metrics Comparison Chart</h3>
        
        {/* Normalize all metrics to 0-100 scale for visual comparison */}
        {metrics.map((metric, idx) => {
          if (metric.regionValue === undefined) return null;

          const maxVal = Math.max(metric.regionValue, metric.usaValue || 0);
          const regionPercent = (metric.regionValue / maxVal) * 100;
          const usaPercent = metric.usaValue ? (metric.usaValue / maxVal) * 100 : 0;

          return (
            <div key={idx} className="metric-card">
              <h4 className="mb-3 font-medium text-slate-900 dark:text-white">{metric.label}</h4>
              
              {/* Region bar */}
              <div className="mb-3">
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-slate-700 dark:text-slate-300">{selectedRegion}</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{metric.format(metric.regionValue)}</span>
                </div>
                <div className="h-6 w-full overflow-hidden rounded-md bg-slate-200 dark:bg-slate-800">
                  <div
                    className="flex h-full items-center justify-end bg-slate-950 pr-2 transition-all duration-300 dark:bg-cyan-400"
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
                    <span className="text-sm text-slate-700 dark:text-slate-300">USA Average</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{metric.format(metric.usaValue)}</span>
                  </div>
                  <div className="h-6 w-full overflow-hidden rounded-md bg-slate-200 dark:bg-slate-800">
                    <div
                      className="flex h-full items-center justify-end bg-slate-500 pr-2 transition-all duration-300 dark:bg-slate-600"
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
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setChartType('metrics')}
          className={`control-button flex items-center gap-2 ${
            chartType === 'metrics'
              ? 'control-button-active'
              : 'control-button-idle'
          }`}
        >
          <BarChartIcon className="w-4 h-4" />
          Metrics
        </button>
        <button
          onClick={() => setChartType('chart')}
          className={`control-button flex items-center gap-2 ${
            chartType === 'chart'
              ? 'control-button-active'
              : 'control-button-idle'
          }`}
        >
          <BarChartIcon className="w-4 h-4" />
          Comparison Chart
        </button>
        <button
          onClick={() => setChartType('vs-usa')}
          className={`control-button flex items-center gap-2 ${
            chartType === 'vs-usa'
              ? 'control-button-active'
              : 'control-button-idle'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          vs USA
        </button>
      </div>

      {/* Chart Content */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        {chartType === 'metrics' && renderMetricsView()}
        {chartType === 'chart' && renderChartView()}
        {chartType === 'vs-usa' && renderComparisonView()}
        {chartType === 'trend' && renderTrendView()}
      </div>
    </div>
  );
};

export default RegionalComparison;
