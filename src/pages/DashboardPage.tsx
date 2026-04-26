import React, { useState } from 'react';
import FilterControls from '../components/FilterControls';
import VisualizationPanel from '../components/VisualizationPanel';
import { FilterState } from '../types';
import { Activity, Database, MapPin } from 'lucide-react';

const DashboardPage: React.FC = () => {
  const [selectedRegion, setSelectedRegion] = useState<string>('United States');
  const [filters, setFilters] = useState<FilterState>({
    region: 'us',
    timeframe: 'current',
    metrics: ['population', 'median-income', 'poverty-rate', 'education', 'unemployment', 'gini', 'income-ratio', 'wealth-top1'],
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
      <div className="mb-8 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-gradient-to-r from-teal-50 via-cyan-50 to-violet-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-teal-800 dark:border-teal-800 dark:from-teal-950/70 dark:via-cyan-950/50 dark:to-violet-950/50 dark:text-teal-200">
            <Activity size={14} />
            Analytical Workspace
          </p>
          <h2 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white md:text-4xl">
            Dashboard
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
            Filter regions, timeframes, and indicators to inspect inequality from demographic, income, and distribution angles.
          </p>
        </div>
        <div className="surface-muted grid min-w-[260px] grid-cols-2 gap-3 p-3">
          <div className="flex items-center gap-2 rounded-md bg-white/60 p-2 dark:bg-slate-950/25">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-cyan-500 to-sky-400 text-white dark:from-cyan-300 dark:to-sky-300 dark:text-slate-950">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Region</p>
              <p className="text-sm font-bold text-slate-950 dark:text-white">{selectedRegion}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-white/60 p-2 dark:bg-slate-950/25">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-amber-400 to-rose-400 text-white dark:from-amber-300 dark:to-fuchsia-300 dark:text-slate-950">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Metrics</p>
              <p className="text-sm font-bold text-slate-950 dark:text-white">{filters.metrics.length || 'All'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
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
