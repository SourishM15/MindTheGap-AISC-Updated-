import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ComparisonPanel from '../components/ComparisonPanel';
import InsightsSummary from '../components/InsightsSummary';
import { GitCompare, MapPinned, Scale } from 'lucide-react';

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
      <div className="mb-8 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-gradient-to-r from-violet-50 via-cyan-50 to-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-violet-800 dark:border-violet-800 dark:from-violet-950/70 dark:via-cyan-950/50 dark:to-amber-950/40 dark:text-violet-200">
            <GitCompare size={14} />
            Regional Benchmarking
          </p>
          <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white md:text-4xl">
            Compare States & Regions
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
            Select up to 4 states to compare key economic and demographic metrics against the United States baseline.
          </p>
        </div>

        <div className="surface-muted grid min-w-[280px] grid-cols-2 gap-3 p-3">
          <div className="flex items-center gap-2 rounded-md bg-white/60 p-2 dark:bg-slate-950/25">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-cyan-400 text-white dark:from-violet-300 dark:to-cyan-300 dark:text-slate-950">
              <MapPinned className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Selected</p>
              <p className="text-sm font-bold text-slate-950 dark:text-white">{selectedStates.length}/4</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-white/60 p-2 dark:bg-slate-950/25">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-amber-400 to-rose-400 text-white dark:from-amber-300 dark:to-fuchsia-300 dark:text-slate-950">
              <Scale className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Baseline</p>
              <p className="text-sm font-bold text-slate-950 dark:text-white">United States</p>
            </div>
          </div>
        </div>
      </div>

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
