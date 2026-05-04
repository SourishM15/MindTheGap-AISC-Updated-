import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import FilterControls from '../components/FilterControls';
import VisualizationPanel from '../components/VisualizationPanel';
import InsightsSummary from '../components/InsightsSummary';
import StateRankings from '../components/StateRankings';
import { FilterState } from '../types';
import { Activity, Database } from 'lucide-react';

const DashboardPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRegion = searchParams.get('region') || 'United States';
  const [selectedRegion, setSelectedRegion] = useState<string>(initialRegion);
  const [filters, setFilters] = useState<FilterState>({
    region: 'us',
    timeframe: 'current',
    metrics: ['population', 'median-income', 'poverty-rate', 'education', 'unemployment', 'gini', 'income-ratio', 'wealth-top1'],
    yearRange: [2000, 2035]
  });

  useEffect(() => {
    const regionFromUrl = searchParams.get('region') || 'United States';
    setSelectedRegion(regionFromUrl);
  }, [searchParams]);

  const handleFilterChange = (newFilters: Partial<FilterState>) => {
    setFilters(prevFilters => ({
      ...prevFilters,
      ...newFilters
    }));
  };

  const handleRegionChange = (region: string) => {
    setSelectedRegion(region);
    if (region === 'United States') {
      setSearchParams({});
    } else {
      setSearchParams({ region });
    }
  };

  return (
    <main className="container mx-auto px-6 py-8">
      <section className="data-hero mb-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_420px] lg:items-end">
        <div>
          <p className="hero-eyebrow mb-4">
            <Activity size={14} />
            Analytical Workspace
          </p>
          <h2 className="text-4xl font-black text-white md:text-6xl">
            Inequality Command Center
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
            Filter regions, timeframes, and indicators to inspect inequality from demographic, income, and distribution angles.
          </p>
          <div className="signal-ribbon max-w-3xl">
            <div className="signal-pill">
              <p className="signal-pill-label">Current view</p>
              <p className="signal-pill-value">{selectedRegion}</p>
            </div>
            <div className="signal-pill">
              <p className="signal-pill-label">Selected metrics</p>
              <p className="signal-pill-value">{filters.metrics.length || 'All'} indicators</p>
            </div>
            <div className="signal-pill">
              <p className="signal-pill-label">Research window</p>
              <p className="signal-pill-value">{filters.yearRange[0]}-{filters.yearRange[1]}</p>
            </div>
          </div>
        </div>
        <div className="terminal-card">
          <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-cyan-300" />
              <p className="text-sm font-black">Current Query Stack</p>
            </div>
            <span className="rounded-md bg-emerald-400/15 px-2 py-1 text-xs font-bold text-emerald-200">READY</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="hero-stat">
              <p className="hero-stat-label">Region</p>
              <p className="hero-stat-value">{selectedRegion}</p>
            </div>
            <div className="hero-stat">
              <p className="hero-stat-label">Metrics</p>
              <p className="hero-stat-value">{filters.metrics.length || 'All'}</p>
            </div>
            <div className="hero-stat">
              <p className="hero-stat-label">Mode</p>
              <p className="hero-stat-value capitalize">{filters.timeframe}</p>
            </div>
            <div className="hero-stat">
              <p className="hero-stat-label">Window</p>
              <p className="hero-stat-value">{filters.yearRange[0]}-{filters.yearRange[1]}</p>
            </div>
          </div>
          <div className="distribution-ladder">
            <div className="distribution-row">
              <span className="distribution-label">Income</span>
              <div className="distribution-track"><div className="distribution-fill" style={{ width: '72%' }} /></div>
              <span className="distribution-value">Live</span>
            </div>
            <div className="distribution-row">
              <span className="distribution-label">Wealth</span>
              <div className="distribution-track"><div className="distribution-fill" style={{ width: '88%' }} /></div>
              <span className="distribution-value">DFA</span>
            </div>
            <div className="distribution-row">
              <span className="distribution-label">Policy</span>
              <div className="distribution-track"><div className="distribution-fill" style={{ width: '54%' }} /></div>
              <span className="distribution-value">AI</span>
            </div>
          </div>
        </div>
      </div>
      </section>

      <InsightsSummary selectedRegion={selectedRegion} context="dashboard" />

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

      <div className="mt-8">
        <StateRankings />
      </div>
    </main>
  );
};

export default DashboardPage;
