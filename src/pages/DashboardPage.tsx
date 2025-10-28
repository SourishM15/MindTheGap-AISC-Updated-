import React, { useState } from 'react';
import FilterControls from '../components/FilterControls';
import VisualizationPanel from '../components/VisualizationPanel';
import { FilterState } from '../types';

const DashboardPage: React.FC = () => {
  const [filters, setFilters] = useState<FilterState>({
    region: 'us',
    timeframe: 'current',
    metrics: ['gini', 'income-ratio', 'poverty-rate', 'wealth-top1'],
    yearRange: [2000, 2035]
  });

  const handleFilterChange = (newFilters: Partial<FilterState>) => {
    setFilters(prevFilters => ({
      ...prevFilters,
      ...newFilters
    }));
  };

  return (
    <main className="container mx-auto px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3">
          <FilterControls filters={filters} onFilterChange={handleFilterChange} />
        </div>
        <div className="lg:col-span-9">
          <VisualizationPanel filters={filters} />
        </div>
      </div>
    </main>
  );
};

export default DashboardPage;