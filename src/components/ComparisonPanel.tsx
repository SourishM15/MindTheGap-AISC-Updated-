import React, { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { US_STATES } from '../data/states';

interface StateMetrics {
  state: string;
  population?: number;
  medianIncome?: number;
  povertyRate?: number;
  educationRate?: number;
  unemploymentRate?: number;
}

interface ComparisonPanelProps {
  selectedStates: string[];
  onStateAdd: (state: string) => void;
  onStateRemove: (state: string) => void;
}

const ComparisonPanel: React.FC<ComparisonPanelProps> = ({
  selectedStates,
  onStateAdd,
  onStateRemove
}) => {
  const [metrics, setMetrics] = useState<Map<string, StateMetrics>>(new Map());
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    // Fetch metrics for selected states
    const fetchMetrics = async () => {
      setLoading(true);
      const newMetrics = new Map<string, StateMetrics>();

      // Fetch USA average
      try {
        const response = await fetch('http://localhost:8000/api/enriched-states');
        if (response.ok) {
          // Store USA for reference
          newMetrics.set('United States', {
            state: 'United States',
            population: 331000000,
            medianIncome: 69717,
            povertyRate: 11.6,
            educationRate: 37.9,
            unemploymentRate: 3.7
          });
        }
      } catch (error) {
        console.error('Failed to fetch USA stats:', error);
      }

      // Fetch state metrics
      for (const state of selectedStates) {
        try {
          const response = await fetch(`http://localhost:8000/api/enriched-state/${state}`);
          if (response.ok) {
            const data = await response.json();
            const profile = data.profile;
            let unemploymentRate: number | undefined = undefined;
            const uneRate = profile?.economics?.indicators?.unemployment_rate?.data;
            if (uneRate) {
              const rate = Object.values(uneRate)[0];
              unemploymentRate = typeof rate === 'number' ? rate : undefined;
            }
            newMetrics.set(state, {
              state,
              population: profile?.demographics?.population,
              medianIncome: profile?.demographics?.median_household_income,
              povertyRate: profile?.demographics?.poverty_rate,
              educationRate: profile?.demographics?.education_bachelor_and_above,
              unemploymentRate
            });
          }
        } catch (error) {
          console.error(`Failed to fetch metrics for ${state}:`, error);
        }
      }

      setMetrics(newMetrics);
      setLoading(false);
    };

    if (selectedStates.length > 0) {
      fetchMetrics();
    }
  }, [selectedStates]);

  const availableStates = US_STATES.filter(
    state => !selectedStates.includes(state)
  );

  const formatNumber = (value: number | undefined, decimals: number = 0): string => {
    if (value === undefined || value === null) return 'N/A';
    if (decimals === 0) return value.toLocaleString();
    return value.toFixed(decimals);
  };

  const getComparison = (value: number | undefined, usaValue: number | undefined): string => {
    if (!value || !usaValue) return '';
    const diff = ((value - usaValue) / usaValue) * 100;
    if (diff > 0) return `+${diff.toFixed(1)}%`;
    return `${diff.toFixed(1)}%`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Region Comparison Tool
        </h3>
        
        <div className="flex items-center space-x-2 mb-4">
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors flex items-center space-x-2"
            >
              <Plus size={18} />
              <span>Add State</span>
            </button>
            
            {showDropdown && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                {availableStates.map(state => (
                  <button
                    key={state}
                    onClick={() => {
                      onStateAdd(state);
                      setShowDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-gray-800 dark:text-gray-200 transition-colors"
                  >
                    {state}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {selectedStates.length > 0 && `${selectedStates.length} state${selectedStates.length !== 1 ? 's' : ''} selected`}
          </span>
        </div>

        {selectedStates.length === 0 && (
          <div className="bg-indigo-50 dark:bg-indigo-900 border border-indigo-200 dark:border-indigo-700 rounded-lg p-4 text-indigo-700 dark:text-indigo-200">
            <p className="text-sm">Select states to compare. USA average will be shown as a reference.</p>
          </div>
        )}
      </div>

      {loading && selectedStates.length > 0 && (
        <div className="text-center py-8 text-gray-600 dark:text-gray-400">
          Loading metrics...
        </div>
      )}

      {!loading && selectedStates.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-300 dark:border-gray-600">
                <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">Metric</th>
                <th className="text-right py-3 px-4 font-semibold text-indigo-600 dark:text-indigo-400">USA</th>
                {selectedStates.map(state => (
                  <th key={state} className="text-right py-3 px-4">
                    <div className="font-semibold text-gray-900 dark:text-white">{state}</div>
                    <button
                      onClick={() => onStateRemove(state)}
                      className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 mt-1"
                    >
                      <X size={14} className="inline" /> Remove
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Population */}
              <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <td className="py-3 px-4 font-medium text-gray-800 dark:text-gray-300">Population</td>
                <td className="text-right py-3 px-4 text-gray-900 dark:text-white">
                  {formatNumber(metrics.get('United States')?.population)}
                </td>
                {selectedStates.map(state => (
                  <td key={`pop-${state}`} className="text-right py-3 px-4 text-gray-900 dark:text-white">
                    <div>{formatNumber(metrics.get(state)?.population)}</div>
                    <div className="text-xs text-gray-500">
                      {getComparison(metrics.get(state)?.population, metrics.get('United States')?.population)}
                    </div>
                  </td>
                ))}
              </tr>

              {/* Median Income */}
              <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <td className="py-3 px-4 font-medium text-gray-800 dark:text-gray-300">Median Income</td>
                <td className="text-right py-3 px-4 text-gray-900 dark:text-white">
                  ${formatNumber(metrics.get('United States')?.medianIncome)}
                </td>
                {selectedStates.map(state => (
                  <td key={`income-${state}`} className="text-right py-3 px-4">
                    <div className="text-gray-900 dark:text-white">${formatNumber(metrics.get(state)?.medianIncome)}</div>
                    <div className={`text-xs font-medium ${
                      (metrics.get(state)?.medianIncome ?? 0) > (metrics.get('United States')?.medianIncome ?? 0)
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {getComparison(metrics.get(state)?.medianIncome, metrics.get('United States')?.medianIncome)}
                    </div>
                  </td>
                ))}
              </tr>

              {/* Poverty Rate */}
              <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <td className="py-3 px-4 font-medium text-gray-800 dark:text-gray-300">Poverty Rate</td>
                <td className="text-right py-3 px-4 text-gray-900 dark:text-white">
                  {formatNumber(metrics.get('United States')?.povertyRate, 1)}%
                </td>
                {selectedStates.map(state => (
                  <td key={`poverty-${state}`} className="text-right py-3 px-4">
                    <div className="text-gray-900 dark:text-white">{formatNumber(metrics.get(state)?.povertyRate, 1)}%</div>
                    <div className={`text-xs font-medium ${
                      (metrics.get(state)?.povertyRate ?? 0) < (metrics.get('United States')?.povertyRate ?? 0)
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {getComparison(metrics.get(state)?.povertyRate, metrics.get('United States')?.povertyRate)}
                    </div>
                  </td>
                ))}
              </tr>

              {/* Education Rate */}
              <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <td className="py-3 px-4 font-medium text-gray-800 dark:text-gray-300">Bachelor's Degree+</td>
                <td className="text-right py-3 px-4 text-gray-900 dark:text-white">
                  {formatNumber(metrics.get('United States')?.educationRate, 1)}%
                </td>
                {selectedStates.map(state => (
                  <td key={`edu-${state}`} className="text-right py-3 px-4">
                    <div className="text-gray-900 dark:text-white">{formatNumber(metrics.get(state)?.educationRate, 1)}%</div>
                    <div className={`text-xs font-medium ${
                      (metrics.get(state)?.educationRate ?? 0) > (metrics.get('United States')?.educationRate ?? 0)
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {getComparison(metrics.get(state)?.educationRate, metrics.get('United States')?.educationRate)}
                    </div>
                  </td>
                ))}
              </tr>

              {/* Unemployment Rate */}
              <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <td className="py-3 px-4 font-medium text-gray-800 dark:text-gray-300">Unemployment Rate</td>
                <td className="text-right py-3 px-4 text-gray-900 dark:text-white">
                  {formatNumber(metrics.get('United States')?.unemploymentRate, 1)}%
                </td>
                {selectedStates.map(state => (
                  <td key={`unemp-${state}`} className="text-right py-3 px-4">
                    <div className="text-gray-900 dark:text-white">{formatNumber(metrics.get(state)?.unemploymentRate, 1)}%</div>
                    <div className={`text-xs font-medium ${
                      (metrics.get(state)?.unemploymentRate ?? 0) < (metrics.get('United States')?.unemploymentRate ?? 0)
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {getComparison(metrics.get(state)?.unemploymentRate, metrics.get('United States')?.unemploymentRate)}
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {!loading && selectedStates.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p>Select states above to see a detailed comparison with the USA average.</p>
        </div>
      )}
    </div>
  );
};

export default ComparisonPanel;
