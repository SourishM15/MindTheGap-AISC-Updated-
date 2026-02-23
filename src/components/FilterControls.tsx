import React, { useState } from 'react';
import { FilterState } from '../types';
import { Sliders, Calendar, MapPin, LineChart, ChevronDown } from 'lucide-react';
import { US_STATES, MAJOR_METRO_AREAS } from '../data/states';

interface FilterControlsProps {
  filters: FilterState;
  onFilterChange: (newFilters: Partial<FilterState>) => void;
  selectedRegion?: string;
  onRegionChange?: (region: string) => void;
}

const FilterControls: React.FC<FilterControlsProps> = ({ 
  filters, 
  onFilterChange,
  selectedRegion = 'United States',
  onRegionChange
}) => {
  const [showStateDropdown, setShowStateDropdown] = useState(false);
  const [showMetroDropdown, setShowMetroDropdown] = useState(false);

  const handleTimeframeChange = (timeframe: FilterState['timeframe']) => {
    // Reset year range based on timeframe
    let yearRange: [number, number] = [2000, 2026];
    if (timeframe === 'historical') {
      yearRange = [2000, 2019];
    } else if (timeframe === 'forecast') {
      yearRange = [2020, 2026];
    }
    onFilterChange({ timeframe, yearRange });
  };

  const handleMetricToggle = (metricId: string) => {
    const newMetrics = filters.metrics.includes(metricId)
      ? filters.metrics.filter(id => id !== metricId)
      : [...filters.metrics, metricId];
    
    onFilterChange({ metrics: newMetrics });
  };

  const handleYearRangeChange = (event: React.ChangeEvent<HTMLInputElement>, index: 0 | 1) => {
    const value = parseInt(event.target.value);
    const newYearRange = [...filters.yearRange] as [number, number];
    
    // Get min and max years based on timeframe
    let [minYear, maxYear] = [2000, 2026];
    if (filters.timeframe === 'historical') {
      [minYear, maxYear] = [2000, 2019];
    } else if (filters.timeframe === 'forecast') {
      [minYear, maxYear] = [2020, 2026];
    }

    // Ensure value is within bounds
    const boundedValue = Math.max(minYear, Math.min(maxYear, value));
    
    if (index === 0) {
      // Start year can't be greater than end year
      newYearRange[0] = Math.min(boundedValue, newYearRange[1]);
    } else {
      // End year can't be less than start year
      newYearRange[1] = Math.max(boundedValue, newYearRange[0]);
    }
    
    onFilterChange({ yearRange: newYearRange });
  };

  const metricOptions = [
    { id: 'population', label: 'Population' },
    { id: 'median-income', label: 'Median Income' }
  ];

  // Get min and max years based on timeframe
  let [minYear, maxYear] = [2000, 2026];
  if (filters.timeframe === 'historical') {
    [minYear, maxYear] = [2000, 2019];
  } else if (filters.timeframe === 'forecast') {
    [minYear, maxYear] = [2020, 2026];
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
      {/* Region Selection */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold flex items-center mb-4 text-gray-800 dark:text-gray-200">
          <MapPin size={20} className="mr-2 text-indigo-600 dark:text-indigo-400" />
          Region
        </h3>
        <div className="flex flex-wrap gap-3">
          {/* United States Button */}
          <button
            onClick={() => {
              setShowStateDropdown(false);
              setShowMetroDropdown(false);
              onRegionChange?.('United States');
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedRegion === 'United States'
                ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            United States
          </button>

          {/* States Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowStateDropdown(!showStateDropdown);
                setShowMetroDropdown(false);
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                US_STATES.includes(selectedRegion)
                  ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              States
              <ChevronDown className="w-4 h-4" />
            </button>
            {showStateDropdown && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg z-40 max-h-64 overflow-y-auto">
                {US_STATES.map((state) => (
                  <button
                    key={state}
                    onClick={() => {
                      onRegionChange?.(state);
                      setShowStateDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2 hover:bg-indigo-50 dark:hover:bg-slate-600 transition-colors ${
                      selectedRegion === state ? 'bg-indigo-100 dark:bg-slate-600 text-indigo-700 dark:text-indigo-300 font-medium' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {state}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Metro Areas Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowMetroDropdown(!showMetroDropdown);
                setShowStateDropdown(false);
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                MAJOR_METRO_AREAS.includes(selectedRegion)
                  ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Metro Areas
              <ChevronDown className="w-4 h-4" />
            </button>
            {showMetroDropdown && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg z-40 max-h-64 overflow-y-auto">
                {MAJOR_METRO_AREAS.map((metro) => (
                  <button
                    key={metro}
                    onClick={() => {
                      onRegionChange?.(metro);
                      setShowMetroDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2 hover:bg-indigo-50 dark:hover:bg-slate-600 transition-colors ${
                      selectedRegion === metro ? 'bg-indigo-100 dark:bg-slate-600 text-indigo-700 dark:text-indigo-300 font-medium' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {metro}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Timeframe Selection */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold flex items-center mb-4 text-gray-800 dark:text-gray-200">
          <Calendar size={20} className="mr-2 text-indigo-600 dark:text-indigo-400" />
          Timeframe
        </h3>
        <div className="flex flex-col space-y-2">
          <button
            onClick={() => handleTimeframeChange('current')}
            className={`px-4 py-2 rounded-md transition-colors ${
              filters.timeframe === 'current' 
                ? 'bg-indigo-600 dark:bg-indigo-500 text-white' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Current
          </button>
          <button
            onClick={() => handleTimeframeChange('historical')}
            className={`px-4 py-2 rounded-md transition-colors ${
              filters.timeframe === 'historical' 
                ? 'bg-indigo-600 dark:bg-indigo-500 text-white' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Historical
          </button>
          <button
            onClick={() => handleTimeframeChange('forecast')}
            className={`px-4 py-2 rounded-md transition-colors ${
              filters.timeframe === 'forecast' 
                ? 'bg-indigo-600 dark:bg-indigo-500 text-white' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Forecast
          </button>
        </div>
      </div>

      {/* Metrics Selection */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold flex items-center mb-4 text-gray-800 dark:text-gray-200">
          <LineChart size={20} className="mr-2 text-indigo-600 dark:text-indigo-400" />
          Metrics
        </h3>
        <div className="space-y-2">
          {metricOptions.map(metric => (
            <label 
              key={metric.id}
              className="flex items-center space-x-2 cursor-pointer p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 w-full"
            >
              <input
                type="checkbox"
                checked={filters.metrics.includes(metric.id)}
                onChange={() => handleMetricToggle(metric.id)}
                className="form-checkbox h-5 w-5 text-indigo-600 dark:text-indigo-400 rounded focus:ring-indigo-500 dark:focus:ring-indigo-400"
              />
              <span className="text-gray-700 dark:text-gray-300">{metric.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Year Range Selection */}
      {filters.timeframe !== 'current' && (
        <div>
          <h3 className="text-lg font-semibold flex items-center mb-3 text-gray-800 dark:text-gray-200">
            <Sliders size={18} className="mr-2 text-indigo-600 dark:text-indigo-400" />
            Year Range
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between text-gray-700 dark:text-gray-300">
              <span>{filters.yearRange[0]}</span>
              <span>{filters.yearRange[1]}</span>
            </div>
            <div className="space-y-4">
              <div className="relative">
                <input
                  type="range"
                  min={minYear}
                  max={maxYear}
                  value={filters.yearRange[0]}
                  onChange={(e) => handleYearRangeChange(e, 0)}
                  className="w-full accent-indigo-600 dark:accent-indigo-400"
                />
                <div className="absolute -top-6 left-0 text-xs text-gray-600">Start Year</div>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min={minYear}
                  max={maxYear}
                  value={filters.yearRange[1]}
                  onChange={(e) => handleYearRangeChange(e, 1)}
                  className="w-full accent-indigo-600 dark:accent-indigo-400"
                />
                <div className="absolute -top-6 left-0 text-xs text-gray-600">End Year</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterControls;