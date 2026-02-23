import React, { useState, useEffect } from 'react';
import ChatInterface from '../components/ChatInterface';
import { usMetrics } from '../data/inequalityData';
import Map from '../components/Map';
import { getStateColors } from '../data/stateColors';
import { generateMetricsFromStateData, EnrichedStateData } from '../utils/metricGenerator';
import { InequalityMetric } from '../types';

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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar with chat */}
        <div className="lg:col-span-3">
          <div className="sticky top-20">
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
          
          <div style={{ 
            backgroundColor: isDarkMode ? stateColors.bgDark : stateColors.bgLight
          }} className="rounded-lg shadow-md p-6 mb-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 style={{ color: isDarkMode ? stateColors.textDark : stateColors.textLight }} className="text-3xl font-bold">
                  {loading ? `Loading ${selectedState} data...` : `${selectedState} Inequality Overview`}
                </h2>
              </div>
              {selectedState !== 'United States' && !loading && (
                <button
                  onClick={handleShowNationalMap}
                  className={`px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium`}
                >
                  ← View National Map
                </button>
              )}
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div style={{ color: isDarkMode ? stateColors.accentDark : stateColors.accentLight }} className="text-lg font-medium">
                  Fetching data for {selectedState}...
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-6 mb-8">
                  <div style={{ 
                    backgroundColor: isDarkMode ? stateColors.bgDark : stateColors.bgLight,
                    borderColor: stateColors.borderColor,
                    borderWidth: '2px'
                  }} className="rounded-lg p-6">
                    <h3 style={{ color: isDarkMode ? stateColors.textDark : stateColors.textLight }} className="text-sm font-semibold">Gini Coefficient</h3>
                    <p style={{ color: isDarkMode ? stateColors.accentDark : stateColors.accentLight }} className="text-3xl font-bold mt-2">{stats.gini}</p>
                  </div>
                  <div style={{ 
                    backgroundColor: isDarkMode ? stateColors.bgDark : stateColors.bgLight,
                    borderColor: stateColors.borderColor,
                    borderWidth: '2px'
                  }} className="rounded-lg p-6">
                    <h3 style={{ color: isDarkMode ? stateColors.textDark : stateColors.textLight }} className="text-sm font-semibold">Poverty Rate</h3>
                    <p style={{ color: isDarkMode ? stateColors.accentDark : stateColors.accentLight }} className="text-3xl font-bold mt-2">{stats.poverty}%</p>
                  </div>
                  <div style={{ 
                    backgroundColor: isDarkMode ? stateColors.bgDark : stateColors.bgLight,
                    borderColor: stateColors.borderColor,
                    borderWidth: '2px'
                  }} className="rounded-lg p-6">
                    <h3 style={{ color: isDarkMode ? stateColors.textDark : stateColors.textLight }} className="text-sm font-semibold">Top 1% Wealth Share</h3>
                    <p style={{ color: isDarkMode ? stateColors.accentDark : stateColors.accentLight }} className="text-3xl font-bold mt-2">{stats.wealth}%</p>
                  </div>
                </div>
                <Map view={selectedState === 'United States' ? 'US' : 'state'} onStateClick={handleStateClick} selectedState={selectedState} />
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};

export default HomePage;
