import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ComparisonPanel from '../components/ComparisonPanel';
import InsightsSummary from '../components/InsightsSummary';
import { GitCompare, Scale } from 'lucide-react';

const ComparisonPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialState = searchParams.get('state');
  const [selectedStates, setSelectedStates] = useState<string[]>(initialState ? [initialState] : []);

  useEffect(() => {
    const stateFromUrl = searchParams.get('state');
    if (stateFromUrl) {
      setSelectedStates((current) => current.includes(stateFromUrl) ? current : [stateFromUrl, ...current].slice(0, 4));
    }
  }, [searchParams]);

  const handleAddState = (state: string) => {
    if (selectedStates.length < 4 && !selectedStates.includes(state)) {
      setSelectedStates([...selectedStates, state]);
    }
  };

  const handleRemoveState = (state: string) => {
    setSelectedStates(selectedStates.filter(s => s !== state));
  };

  return (
    <main className="container mx-auto px-6 py-8">
      <section className="data-hero mb-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_420px] lg:items-end">
        <div>
          <p className="hero-eyebrow mb-4">
            <GitCompare size={14} />
            Regional Benchmarking
          </p>
          <h1 className="text-4xl font-black text-white md:text-6xl">
            Benchmark Regions Side by Side
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
            Select up to 4 states to compare key economic and demographic metrics against the United States baseline.
          </p>
          <div className="signal-ribbon max-w-3xl">
            <div className="signal-pill">
              <p className="signal-pill-label">Selection capacity</p>
              <p className="signal-pill-value">{selectedStates.length}/4 regions</p>
            </div>
            <div className="signal-pill">
              <p className="signal-pill-label">Baseline</p>
              <p className="signal-pill-value">United States</p>
            </div>
            <div className="signal-pill">
              <p className="signal-pill-label">Benchmark mode</p>
              <p className="signal-pill-value">Cross-state scan</p>
            </div>
          </div>
        </div>

        <div className="terminal-card">
          <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-cyan-300" />
              <p className="text-sm font-black">Benchmark Console</p>
            </div>
            <span className="rounded-md bg-cyan-400/15 px-2 py-1 text-xs font-bold text-cyan-200">MAX 4</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="hero-stat">
              <p className="hero-stat-label">Selected</p>
              <p className="hero-stat-value">{selectedStates.length}/4</p>
            </div>
            <div className="hero-stat">
              <p className="hero-stat-label">Baseline</p>
              <p className="hero-stat-value">U.S.</p>
            </div>
            <div className="hero-stat col-span-2">
              <p className="hero-stat-label">Active selection</p>
              <p className="hero-stat-value text-base">
                {selectedStates.length ? selectedStates.join(', ') : 'No states selected'}
              </p>
            </div>
          </div>
          <div className="distribution-ladder">
            <div className="distribution-row">
              <span className="distribution-label">Gini</span>
              <div className="distribution-track"><div className="distribution-fill" style={{ width: selectedStates.length ? '78%' : '24%' }} /></div>
              <span className="distribution-value">Rank</span>
            </div>
            <div className="distribution-row">
              <span className="distribution-label">Poverty</span>
              <div className="distribution-track"><div className="distribution-fill" style={{ width: selectedStates.length ? '62%' : '24%' }} /></div>
              <span className="distribution-value">Gap</span>
            </div>
            <div className="distribution-row">
              <span className="distribution-label">Income</span>
              <div className="distribution-track"><div className="distribution-fill" style={{ width: selectedStates.length ? '84%' : '24%' }} /></div>
              <span className="distribution-value">Delta</span>
            </div>
          </div>
        </div>
      </div>
      </section>

      <InsightsSummary selectedRegion={selectedStates[0] || 'United States'} context="compare" />

      <ComparisonPanel
        selectedStates={selectedStates}
        onStateAdd={handleAddState}
        onStateRemove={handleRemoveState}
      />
    </main>
  );
};

export default ComparisonPage;
