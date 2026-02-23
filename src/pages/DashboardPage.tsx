import React, { useState } from 'react';
import FilterControls from '../components/FilterControls';
import VisualizationPanel from '../components/VisualizationPanel';
import { FilterState } from '../types';

const DashboardPage: React.FC = () => {
  const [selectedRegion, setSelectedRegion] = useState<string>('United States');
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

  const handleRegionChange = (region: string) => {
    setSelectedRegion(region);
  };

  return (
    <main className="container mx-auto px-6 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-3">
          <FilterControls 
            filters={filters} 
            onFilterChange={handleFilterChange}
            selectedRegion={selectedRegion}
            onRegionChange={handleRegionChange}
          />
        </div>
        <div className="lg:col-span-9">
          <VisualizationPanel 
            filters={filters}
            selectedRegion={selectedRegion}
          />
        </div>
      </div>
    </main>
  );
};

export default DashboardPage;