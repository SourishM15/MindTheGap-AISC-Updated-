import React, { useState } from 'react';
import ChatInterface from '../components/ChatInterface';
import { usMetrics, washingtonMetrics } from '../data/inequalityData';
import Map from '../components/Map';

const HomePage: React.FC = () => {
  const [view, setView] = useState<'US' | 'WA'>('US');

  const handleStateClick = (geo: any) => {
    const stateName = geo.properties.name;
    if (stateName === 'Washington') {
      setView('WA');
    }
  };

  const handleShowNationalMap = () => {
    setView('US');
  };

  const getQuickStats = () => {
    const metrics = view === 'WA' ? washingtonMetrics : usMetrics;
    return {
      gini: metrics.find(m => m.id === 'gini')?.currentValue.toFixed(2),
      poverty: metrics.find(m => m.id === 'poverty-rate')?.currentValue.toFixed(1),
      wealth: metrics.find(m => m.id === 'wealth-top1')?.currentValue.toFixed(1)
    };
  };

  const stats = getQuickStats();

  return (
    <main className="container mx-auto px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar with chat */}
        <div className="lg:col-span-3">
          <ChatInterface onChatQuery={() => {}} />
        </div>
        
        {/* Main content area */}
        <div className="lg:col-span-9">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {view === 'WA' ? 'Washington State' : 'United States'} Inequality Overview
              </h2>
              {view === 'WA' && (
                <button
                  onClick={handleShowNationalMap}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  View National Map
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-indigo-50 dark:bg-indigo-900 p-4 rounded-lg">
                <h3 className="text-sm font-semibold text-indigo-800 dark:text-indigo-200">Gini Coefficient</h3>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-300">{stats.gini}</p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-900 p-4 rounded-lg">
                <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Poverty Rate</h3>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-300">{stats.poverty}%</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900 p-4 rounded-lg">
                <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200">Top 1% Wealth Share</h3>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-300">{stats.wealth}%</p>
              </div>
            </div>
            <Map view={view} onStateClick={handleStateClick} />
          </div>
        </div>
      </div>
    </main>
  );
};

export default HomePage;
