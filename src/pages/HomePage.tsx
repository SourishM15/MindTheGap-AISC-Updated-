import React, { useState, useEffect } from 'react';
import ChatInterface from '../components/ChatInterface';
import { usMetrics } from '../data/inequalityData';
import Map from '../components/Map';
import { getStateColors } from '../data/stateColors';
import { generateMetricsFromStateData, EnrichedStateData } from '../utils/metricGenerator';
import { InequalityMetric } from '../types';
import { ArrowLeft, MapPinned, Sparkles, TrendingUp } from 'lucide-react';

const HomePage: React.FC = () => {
  const [selectedState, setSelectedState] = useState<string>('United States');
  const [metrics, setMetrics] = useState<InequalityMetric[]>(usMetrics);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Detect dark mode
  useEffect(() => {
    setIsDarkMode(document.documentElement.classList.contains('dark'));
  }, []);

  // Fetch state data from backend when state changes
  useEffect(() => {
    if (selectedState === 'United States') {
      setMetrics(usMetrics);
      setError(null);
    } else {
      fetchStateMetrics(selectedState);
    }
  }, [selectedState]);

  const fetchStateMetrics = async (stateName: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`http://localhost:8000/api/enriched-state/${stateName}`);
      if (!response.ok) {
        throw new Error(`Failed to load data for ${stateName}`);
      }
      const data: EnrichedStateData = await response.json();
      
      // Generate metrics from the enriched state data
      const generatedMetrics = generateMetricsFromStateData(data);
      setMetrics(generatedMetrics);
    } catch (err) {
      console.error('Error loading state metrics:', err);
      setError(`Could not load data for ${stateName}`);
      // Fallback to US metrics
      setMetrics(usMetrics);
    } finally {
      setLoading(false);
    }
  };

  const handleStateClick = (geo: any) => {
    const stateName = geo.properties.name;
    setSelectedState(stateName);
  };

  const handleShowNationalMap = () => {
    setSelectedState('United States');
  };

  const getQuickStats = () => {
    return {
      gini: metrics.find(m => m.id === 'gini')?.currentValue.toFixed(2),
      poverty: metrics.find(m => m.id === 'poverty-rate')?.currentValue.toFixed(1),
      wealth: metrics.find(m => m.id === 'wealth-top1')?.currentValue.toFixed(1)
    };
  };

  const stats = getQuickStats();
  const stateColors = getStateColors(selectedState);

  return (
    <main className="container mx-auto px-6 py-8">
      <div className="mb-8 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-gradient-to-r from-cyan-50 via-teal-50 to-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-800 dark:border-cyan-800 dark:from-cyan-950/70 dark:via-teal-950/60 dark:to-amber-950/40 dark:text-cyan-200">
            <Sparkles size={14} />
            National Inequality Atlas
          </div>
          <h2 className="max-w-4xl text-3xl font-black tracking-tight text-slate-950 dark:text-white md:text-5xl">
            See where income, wealth, and opportunity diverge across the U.S.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
            Explore state-level patterns, then ask the assistant to explain what changed and where policy could matter most.
          </p>
        </div>
        <div className="surface-muted flex items-center gap-3 px-4 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-emerald-400 text-white shadow-sm dark:from-cyan-300 dark:to-lime-300 dark:text-slate-950">
            <MapPinned className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Active Region</p>
            <p className="font-bold text-slate-950 dark:text-white">{selectedState}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Sidebar with chat */}
        <div className="lg:col-span-3">
          <div className="sticky top-24">
            <ChatInterface onChatQuery={() => {}} />
          </div>
        </div>
        
        {/* Main content area */}
        <div className="lg:col-span-9">
          {error && (
            <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-800 dark:text-red-200 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}
          
          <div className="surface mb-8 overflow-hidden">
            <div className="accent-strip" />
            <div
              style={{
                backgroundColor: isDarkMode ? stateColors.bgDark : stateColors.bgLight,
                borderColor: stateColors.borderColor,
              }}
              className="border-b p-6"
            >
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <p style={{ color: isDarkMode ? stateColors.accentDark : stateColors.accentLight }} className="mb-2 text-xs font-bold uppercase tracking-wide">
                  Interactive Overview
                </p>
                <h2 style={{ color: isDarkMode ? stateColors.textDark : stateColors.textLight }} className="text-2xl font-black tracking-tight md:text-3xl">
                  {loading ? `Loading ${selectedState} data...` : `${selectedState} Inequality Overview`}
                </h2>
              </div>
              {selectedState !== 'United States' && !loading && (
                <button
                  onClick={handleShowNationalMap}
                  className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-800 dark:bg-cyan-400 dark:text-slate-950 dark:hover:bg-cyan-300"
                >
                  <ArrowLeft size={16} />
                  National Map
                </button>
              )}
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div style={{ color: isDarkMode ? stateColors.accentDark : stateColors.accentLight }} className="text-lg font-medium">
                  Fetching data for {selectedState}...
                </div>
              </div>
            ) : (
              <div className="p-6">
                <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div style={{ 
                    borderColor: stateColors.borderColor,
                    borderWidth: '2px'
                  }} className="metric-card bg-gradient-to-br from-cyan-50 to-white dark:from-cyan-950/35 dark:to-slate-900">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 style={{ color: isDarkMode ? stateColors.textDark : stateColors.textLight }} className="text-sm font-bold">Gini Coefficient</h3>
                      <div className="rounded-md bg-cyan-100 p-1.5 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-300">
                        <TrendingUp className="h-4 w-4" />
                      </div>
                    </div>
                    <p style={{ color: isDarkMode ? stateColors.accentDark : stateColors.accentLight }} className="text-3xl font-black tracking-tight">{stats.gini}</p>
                    <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Income inequality index</p>
                  </div>
                  <div style={{ 
                    borderColor: stateColors.borderColor,
                    borderWidth: '2px'
                  }} className="metric-card bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/30 dark:to-slate-900">
                    <h3 style={{ color: isDarkMode ? stateColors.textDark : stateColors.textLight }} className="text-sm font-bold">Poverty Rate</h3>
                    <p style={{ color: isDarkMode ? stateColors.accentDark : stateColors.accentLight }} className="mt-3 text-3xl font-black tracking-tight">{stats.poverty}%</p>
                    <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Share below poverty line</p>
                  </div>
                  <div style={{ 
                    borderColor: stateColors.borderColor,
                    borderWidth: '2px'
                  }} className="metric-card bg-gradient-to-br from-fuchsia-50 to-white dark:from-fuchsia-950/30 dark:to-slate-900">
                    <h3 style={{ color: isDarkMode ? stateColors.textDark : stateColors.textLight }} className="text-sm font-bold">Top 1% Wealth Share</h3>
                    <p style={{ color: isDarkMode ? stateColors.accentDark : stateColors.accentLight }} className="mt-3 text-3xl font-black tracking-tight">{stats.wealth}%</p>
                    <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Concentration of wealth</p>
                  </div>
                </div>
                <Map view={selectedState === 'United States' ? 'US' : 'state'} onStateClick={handleStateClick} selectedState={selectedState} />
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};

export default HomePage;
