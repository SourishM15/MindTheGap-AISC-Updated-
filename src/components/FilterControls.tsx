import React, { useEffect, useState } from 'react';
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

  const metroOptions = MAJOR_METRO_AREAS.map((metro) => {
    if (metro === 'New York' || metro === 'Washington') {
      return {
        value: `${metro} Metro`,
        label: `${metro} (Metro)`
      };
    }
    return { value: metro, label: metro };
  });

  const isMetroSelection = MAJOR_METRO_AREAS.includes(selectedRegion) || selectedRegion.endsWith(' Metro');

  const getYearBounds = (timeframe: FilterState['timeframe']): [number, number] => {
    if (timeframe === 'current') return [2019, 2025];
    if (timeframe === 'forecast') return [2024, 2035];
    // Historical:
    // - US uses DFA history (1989+)
    // - state/metro use ACS; ACS resolves to earliest available (~2005), but allow 1989 requests
    return [1989, 2023];
  };

  useEffect(() => {
    const [minYear, maxYear] = getYearBounds(filters.timeframe);
    const nextStart = Math.max(minYear, Math.min(maxYear, filters.yearRange[0]));
    const nextEnd = Math.max(nextStart, Math.min(maxYear, filters.yearRange[1]));
    if (nextStart !== filters.yearRange[0] || nextEnd !== filters.yearRange[1]) {
      onFilterChange({ yearRange: [nextStart, nextEnd] });
    }
  }, [selectedRegion, filters.timeframe]);

  const handleTimeframeChange = (timeframe: FilterState['timeframe']) => {
    // Reset year range based on timeframe
    const yearRange = getYearBounds(timeframe);
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
    const [minYear, maxYear] = getYearBounds(filters.timeframe);

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
    { id: 'median-income', label: 'Median Income' },
    { id: 'poverty-rate', label: 'Poverty Rate' },
    { id: 'education', label: "Bachelor's+ Education" },
    { id: 'unemployment', label: 'Unemployment' },
    { id: 'child-poverty', label: 'Child Poverty' },
    { id: 'gini', label: 'Gini / Lorenz' },
    { id: 'income-ratio', label: 'Income Ratio Lens' },
    { id: 'wealth-top1', label: 'Distribution Charts' }
  ];

  // Get min and max years based on timeframe
  const [minYear, maxYear] = getYearBounds(filters.timeframe);

  return (
    <div className="surface mb-8 overflow-hidden lg:sticky lg:top-24">
      <div className="accent-strip" />
      <div className="p-5">
      {/* Region Selection */}
      <div className="mb-6">
        <h3 className="mb-4 flex items-center text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
          <MapPin size={18} className="mr-2 text-cyan-600 dark:text-cyan-300" />
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
            className={`control-button ${
              selectedRegion === 'United States'
                ? 'control-button-active'
                : 'control-button-idle'
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
              className={`control-button flex items-center gap-2 ${
                US_STATES.includes(selectedRegion)
                  ? 'control-button-active'
                  : 'control-button-idle'
              }`}
            >
              States
              <ChevronDown className="w-4 h-4" />
            </button>
            {showStateDropdown && (
              <div className="absolute left-0 top-full z-40 mt-2 max-h-64 w-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl shadow-slate-200/80 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/30">
                {US_STATES.map((state) => (
                  <button
                    key={state}
                    onClick={() => {
                      onRegionChange?.(state);
                      setShowStateDropdown(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm transition-colors hover:bg-cyan-50 dark:hover:bg-slate-800 ${
                      selectedRegion === state ? 'bg-cyan-50 font-bold text-cyan-700 dark:bg-slate-800 dark:text-cyan-300' : 'text-slate-700 dark:text-slate-300'
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
              className={`control-button flex items-center gap-2 ${
                isMetroSelection
                  ? 'control-button-active'
                  : 'control-button-idle'
              }`}
            >
              Metro Areas
              <ChevronDown className="w-4 h-4" />
            </button>
            {showMetroDropdown && (
              <div className="absolute left-0 top-full z-40 mt-2 max-h-64 w-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl shadow-slate-200/80 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/30">
                {metroOptions.map((metro) => (
                  <button
                    key={metro.value}
                    onClick={() => {
                      onRegionChange?.(metro.value);
                      setShowMetroDropdown(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm transition-colors hover:bg-cyan-50 dark:hover:bg-slate-800 ${
                      selectedRegion === metro.value ? 'bg-cyan-50 font-bold text-cyan-700 dark:bg-slate-800 dark:text-cyan-300' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {metro.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Timeframe Selection */}
      <div className="mb-6">
        <h3 className="mb-4 flex items-center text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
          <Calendar size={18} className="mr-2 text-cyan-600 dark:text-cyan-300" />
          Timeframe
        </h3>
        <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
          <button
            onClick={() => handleTimeframeChange('current')}
            className={`control-button ${
              filters.timeframe === 'current' 
                ? 'control-button-active'
                : 'control-button-idle'
            }`}
          >
            Current
          </button>
          <button
            onClick={() => handleTimeframeChange('historical')}
            className={`control-button ${
              filters.timeframe === 'historical' 
                ? 'control-button-active'
                : 'control-button-idle'
            }`}
          >
            Historical
          </button>
          <button
            onClick={() => handleTimeframeChange('forecast')}
            className={`control-button ${
              filters.timeframe === 'forecast' 
                ? 'control-button-active'
                : 'control-button-idle'
            }`}
          >
            Forecast
          </button>
        </div>
      </div>

      {/* Metrics Selection */}
      <div className="mb-6">
        <h3 className="mb-4 flex items-center text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
          <LineChart size={18} className="mr-2 text-cyan-600 dark:text-cyan-300" />
          Metrics
        </h3>
        <div className="space-y-2">
          {metricOptions.map(metric => (
            <label 
              key={metric.id}
              className="flex w-full cursor-pointer items-center gap-3 rounded-md border border-transparent p-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-200 hover:bg-slate-50 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800/70"
            >
              <input
                type="checkbox"
                checked={filters.metrics.includes(metric.id)}
                onChange={() => handleMetricToggle(metric.id)}
                className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 dark:border-slate-600 dark:bg-slate-900 dark:text-cyan-400"
              />
              <span>{metric.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Year Range Selection */}
      {filters.timeframe !== 'current' && (
        <div>
          <h3 className="mb-3 flex items-center text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
            <Sliders size={18} className="mr-2 text-cyan-600 dark:text-cyan-300" />
            Year Range
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm font-bold text-slate-700 dark:text-slate-300">
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
                  className="w-full accent-cyan-600 dark:accent-cyan-400"
                />
                <div className="absolute -top-6 left-0 text-xs font-semibold text-slate-500 dark:text-slate-400">Start Year</div>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min={minYear}
                  max={maxYear}
                  value={filters.yearRange[1]}
                  onChange={(e) => handleYearRangeChange(e, 1)}
                  className="w-full accent-cyan-600 dark:accent-cyan-400"
                />
                <div className="absolute -top-6 left-0 text-xs font-semibold text-slate-500 dark:text-slate-400">End Year</div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default FilterControls;
