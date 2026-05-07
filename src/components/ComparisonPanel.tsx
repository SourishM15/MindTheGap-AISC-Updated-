import React, { useState, useEffect } from 'react';
import { GitCompare, Landmark, Plus, X } from 'lucide-react';
import { US_STATES } from '../data/states';
import LoadingSkeleton from './LoadingSkeleton';
import MetricTooltip from './MetricTooltip';
import SourceBadge from './SourceBadge';
import ScaleComparison3D from './ScaleComparison3D';
import { SCALE_METRICS, ScaleMetricKey } from './scaleComparisonConfig';
import { apiFetch } from '../utils/api';

interface StateMetrics {
  state: string;
  population?: number;
  medianIncome?: number;
  povertyRate?: number;
  educationRate?: number;
  unemploymentRate?: number;
  laborForceParticipationRate?: number;
  employmentPopulationRatio?: number;
  perCapitaIncome?: number;
  rentBurdenRate?: number;
  medianGrossRent?: number;
  homeownershipRate?: number;
  snapHouseholdRate?: number;
  currentDollarGdp?: number;
  realGdp?: number;
  beaPerCapitaPersonalIncome?: number;
  regionalPriceParity?: number;
}

interface ComparisonPanelProps {
  selectedStates: string[];
  onStateAdd: (state: string) => void;
  onStateRemove: (state: string) => void;
}

interface EnrichedStateProfile {
  demographics?: {
    population?: number;
    median_household_income?: number;
    poverty_rate?: number;
    education_bachelor_and_above?: number;
  };
  employment?: {
    unemployment_data?: unknown;
    acs_labor?: {
      acs_unemployment_rate?: number;
    };
  };
  economics?: {
    indicators?: {
      unemployment_rate?: {
        data?: unknown;
      };
    };
  };
  opportunity?: {
    labor?: {
      labor_force_participation_rate?: number;
      employment_population_ratio?: number;
      acs_unemployment_rate?: number;
    };
    housing?: {
      rent_burdened_rate?: number;
      median_gross_rent?: number;
      homeownership_rate?: number;
    };
    safety_net?: {
      snap_household_rate?: number;
    };
    income?: {
      per_capita_income?: number;
    };
  };
  bea?: {
    metrics?: Record<string, { value?: unknown }>;
  };
}

const getLatestNumericValue = (values: unknown): number | undefined => {
  if (!values || typeof values !== 'object') return undefined;
  const entries = Object.entries(values as Record<string, unknown>);
  const sortedEntries = entries.sort(([dateA], [dateB]) => dateB.localeCompare(dateA));
  for (const [, value] of sortedEntries) {
    if (typeof value === 'number') return value;
    if (value && typeof value === 'object') {
      const rate = (value as { rate?: unknown }).rate;
      if (typeof rate === 'number') return rate;
    }
  }
  return undefined;
};

const getUnemploymentRate = (profile: EnrichedStateProfile): number | undefined => {
  return (
    getLatestNumericValue(profile.employment?.unemployment_data) ??
    getLatestNumericValue(profile.economics?.indicators?.unemployment_rate?.data) ??
    profile.employment?.acs_labor?.acs_unemployment_rate ??
    profile.opportunity?.labor?.acs_unemployment_rate
  );
};

const getBEAMetric = (profile: EnrichedStateProfile, key: string): number | undefined => {
  const value = profile.bea?.metrics?.[key]?.value;
  return typeof value === 'number' ? value : undefined;
};

const ComparisonPanel: React.FC<ComparisonPanelProps> = ({
  selectedStates,
  onStateAdd,
  onStateRemove
}) => {
  const [metrics, setMetrics] = useState<Map<string, StateMetrics>>(new Map());
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [scaleMetric, setScaleMetric] = useState<ScaleMetricKey>('medianIncome');
  const [compareMode, setCompareMode] = useState<'states' | 'us'>('states');
  const [leftState, setLeftState] = useState<string>('');
  const [rightState, setRightState] = useState<string>('');

  useEffect(() => {
    if (!selectedStates.length) {
      setLeftState('');
      setRightState('');
      return;
    }

    if (!leftState || !selectedStates.includes(leftState)) {
      setLeftState(selectedStates[0]);
    }

    if (compareMode === 'states') {
      const fallbackRight = selectedStates.find((state) => state !== (leftState || selectedStates[0])) ?? selectedStates[1] ?? '';
      if (!rightState || !selectedStates.includes(rightState) || rightState === (leftState || selectedStates[0])) {
        setRightState(fallbackRight);
      }
    }
  }, [selectedStates, leftState, rightState, compareMode]);

  useEffect(() => {
    // Fetch metrics for selected states
    const fetchMetrics = async () => {
      setLoading(true);
      const newMetrics = new Map<string, StateMetrics>();

      newMetrics.set('United States', {
        state: 'United States',
        population: 331000000,
        medianIncome: 69717,
        povertyRate: 11.6,
        educationRate: 37.9,
        unemploymentRate: 3.7,
        laborForceParticipationRate: 62.6,
        employmentPopulationRatio: 60.3,
        perCapitaIncome: 41968,
        rentBurdenRate: 49.7,
        medianGrossRent: 1354,
        homeownershipRate: 64.8,
        snapHouseholdRate: 11.5
      });

      // Fetch state metrics
      for (const state of selectedStates) {
        try {
          const response = await apiFetch(`/api/enriched-state/${encodeURIComponent(state)}`);
          if (response.ok) {
            const data = await response.json();
            const profile = (data.profile ?? {}) as EnrichedStateProfile;
            const labor = profile?.opportunity?.labor ?? profile?.employment?.acs_labor;
            const housing = profile?.opportunity?.housing;
            const safetyNet = profile?.opportunity?.safety_net;
            const unemploymentRate = getUnemploymentRate(profile);
            newMetrics.set(state, {
              state,
              population: profile?.demographics?.population,
              medianIncome: profile?.demographics?.median_household_income,
              povertyRate: profile?.demographics?.poverty_rate,
              educationRate: profile?.demographics?.education_bachelor_and_above,
              unemploymentRate,
              laborForceParticipationRate: labor?.labor_force_participation_rate,
              employmentPopulationRatio: labor?.employment_population_ratio,
              perCapitaIncome: profile?.opportunity?.income?.per_capita_income,
              rentBurdenRate: housing?.rent_burdened_rate,
              medianGrossRent: housing?.median_gross_rent,
              homeownershipRate: housing?.homeownership_rate,
              snapHouseholdRate: safetyNet?.snap_household_rate,
              currentDollarGdp: getBEAMetric(profile, 'current_dollar_gdp'),
              realGdp: getBEAMetric(profile, 'real_gdp'),
              beaPerCapitaPersonalIncome: getBEAMetric(profile, 'per_capita_personal_income'),
              regionalPriceParity: getBEAMetric(profile, 'regional_price_parity')
            });
          }
        } catch (error) {
          console.error(`Failed to fetch metrics for ${state}:`, error);
        }
      }

      setMetrics(newMetrics);
      setLoading(false);
    };

    fetchMetrics();
  }, [selectedStates]);

  const availableStates = US_STATES.filter(
    state => !selectedStates.includes(state)
  );

  const formatNumber = (value: number | undefined, decimals: number = 0): string => {
    if (value === undefined || value === null) return 'N/A';
    if (decimals === 0) return value.toLocaleString();
    return value.toFixed(decimals);
  };

  const formatDollarsFromMillions = (value: number | undefined): string => {
    if (value == null) return 'N/A';
    const dollars = value * 1000000;
    if (dollars >= 1000000000000) return `$${(dollars / 1000000000000).toFixed(2)}T`;
    if (dollars >= 1000000000) return `$${(dollars / 1000000000).toFixed(1)}B`;
    return `$${formatNumber(dollars)}`;
  };

  const getComparison = (value: number | undefined, usaValue: number | undefined): string => {
    if (!value || !usaValue) return '';
    const diff = ((value - usaValue) / usaValue) * 100;
    if (diff > 0) return `+${diff.toFixed(1)}%`;
    return `${diff.toFixed(1)}%`;
  };

  const leftMetrics = leftState ? metrics.get(leftState) : undefined;
  const rightComparisonState = compareMode === 'us' ? 'United States' : rightState;
  const rightMetrics = rightComparisonState ? metrics.get(rightComparisonState) : undefined;
  const canCompareStates = selectedStates.length >= 2;

  return (
    <div className="surface overflow-hidden">
      <div className="accent-strip" />
      <div className="p-6">
      <div className="mb-6">
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div className="flex items-center gap-2">
            <h3 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">
              Region Comparison Tool
            </h3>
            <MetricTooltip label="Comparison Tool" description="Compare selected states against a fixed United States baseline across demographic and economic indicators." />
          </div>
          <div className="flex flex-wrap gap-2">
            <SourceBadge source="ACS" year="2022" tone="cyan" />
            <SourceBadge source="SAIPE" year="2023" tone="amber" />
            <SourceBadge source="BEA" year="Latest" tone="slate" />
          </div>
        </div>
        
        <div className="flex items-center space-x-2 mb-4">
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-800 dark:bg-cyan-400 dark:text-slate-950 dark:hover:bg-cyan-300"
            >
              <Plus size={18} />
              <span>Add State</span>
            </button>
            
            {showDropdown && (
              <div className="absolute left-0 top-full z-10 mt-2 max-h-64 w-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl shadow-slate-200/80 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/30">
                {availableStates.map(state => (
                  <button
                    key={state}
                    onClick={() => {
                      onStateAdd(state);
                      setShowDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-slate-800 transition-colors hover:bg-cyan-50 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {state}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
            {selectedStates.length > 0 && `${selectedStates.length} state${selectedStates.length !== 1 ? 's' : ''} selected`}
          </span>
        </div>

        {selectedStates.length === 0 && (
          <div className="surface-muted p-4 text-slate-700 dark:text-slate-300">
            <p className="text-sm font-medium">Select states to compare. USA average will be shown as a reference.</p>
          </div>
        )}
      </div>

      {loading && selectedStates.length > 0 && (
        <LoadingSkeleton variant="dashboard" />
      )}

      {!loading && selectedStates.length > 0 && (
        <>
        <div className="mb-6 grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
          <ScaleComparison3D
            left={leftMetrics}
            right={rightMetrics}
            metricKey={scaleMetric}
            compareMode={compareMode}
          />

          <aside className="surface-muted p-4">
            <div className="mb-4 flex items-center gap-2">
              <GitCompare className="h-5 w-5 text-cyan-700 dark:text-cyan-300" />
              <h4 className="text-lg font-black text-slate-950 dark:text-white">Scale Controls</h4>
            </div>

            <div className="mb-5 grid gap-2">
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Left state</label>
              <select
                value={leftState}
                onChange={(event) => setLeftState(event.target.value)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                {selectedStates.map((state) => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCompareMode('states')}
                disabled={!canCompareStates}
                className={`control-button ${compareMode === 'states' ? 'control-button-active' : 'control-button-idle'} disabled:cursor-not-allowed disabled:opacity-45`}
              >
                State vs State
              </button>
              <button
                type="button"
                onClick={() => setCompareMode('us')}
                className={`control-button inline-flex items-center justify-center gap-2 ${compareMode === 'us' ? 'control-button-active' : 'control-button-idle'}`}
              >
                <Landmark size={15} />
                vs U.S.
              </button>
            </div>

            {compareMode === 'states' && (
              <div className="mb-5 grid gap-2">
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Right state</label>
                <select
                  value={rightState}
                  onChange={(event) => setRightState(event.target.value)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                >
                  {selectedStates.filter((state) => state !== leftState).map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
                {!canCompareStates && (
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Add a second state or use the U.S. benchmark.
                  </p>
                )}
              </div>
            )}

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">What to compare</p>
              <div className="grid gap-2">
                {SCALE_METRICS.map((metric) => {
                  const Icon = metric.icon;
                  return (
                    <button
                      key={metric.key}
                      type="button"
                      onClick={() => setScaleMetric(metric.key)}
                      className={`control-button flex items-center justify-between gap-2 text-left ${scaleMetric === metric.key ? 'control-button-active' : 'control-button-idle'}`}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Icon size={16} />
                        {metric.shortLabel}
                      </span>
                      <span className="text-xs opacity-70">{metric.higherIsBetter ? 'High +' : 'Low +'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="px-4 py-3 text-left font-semibold">Metric</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-950 dark:text-white">USA</th>
                {selectedStates.map(state => (
                  <th key={state} className="text-right py-3 px-4">
                    <div className="font-semibold text-slate-950 dark:text-white">{state}</div>
                    <button
                      onClick={() => onStateRemove(state)}
                      className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 mt-1"
                    >
                      <X size={14} className="inline" /> Remove
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Population */}
              <tr className="border-b border-slate-200 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/70">
                <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-300">Population</td>
                <td className="px-4 py-3 text-right text-slate-900 dark:text-white">
                  {formatNumber(metrics.get('United States')?.population)}
                </td>
                {selectedStates.map(state => (
                  <td key={`pop-${state}`} className="px-4 py-3 text-right text-slate-900 dark:text-white">
                    <div>{formatNumber(metrics.get(state)?.population)}</div>
                    <div className="text-xs text-slate-500">
                      {getComparison(metrics.get(state)?.population, metrics.get('United States')?.population)}
                    </div>
                  </td>
                ))}
              </tr>

              {/* Median Income */}
              <tr className="border-b border-slate-200 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/70">
                <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-300">Median Income</td>
                <td className="px-4 py-3 text-right text-slate-900 dark:text-white">
                  ${formatNumber(metrics.get('United States')?.medianIncome)}
                </td>
                {selectedStates.map(state => (
                  <td key={`income-${state}`} className="text-right py-3 px-4">
                    <div className="text-slate-900 dark:text-white">${formatNumber(metrics.get(state)?.medianIncome)}</div>
                    <div className={`text-xs font-medium ${
                      (metrics.get(state)?.medianIncome ?? 0) > (metrics.get('United States')?.medianIncome ?? 0)
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {getComparison(metrics.get(state)?.medianIncome, metrics.get('United States')?.medianIncome)}
                    </div>
                  </td>
                ))}
              </tr>

              {/* Poverty Rate */}
              <tr className="border-b border-slate-200 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/70">
                <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-300">Poverty Rate</td>
                <td className="px-4 py-3 text-right text-slate-900 dark:text-white">
                  {formatNumber(metrics.get('United States')?.povertyRate, 1)}%
                </td>
                {selectedStates.map(state => (
                  <td key={`poverty-${state}`} className="text-right py-3 px-4">
                    <div className="text-slate-900 dark:text-white">{formatNumber(metrics.get(state)?.povertyRate, 1)}%</div>
                    <div className={`text-xs font-medium ${
                      (metrics.get(state)?.povertyRate ?? 0) < (metrics.get('United States')?.povertyRate ?? 0)
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {getComparison(metrics.get(state)?.povertyRate, metrics.get('United States')?.povertyRate)}
                    </div>
                  </td>
                ))}
              </tr>

              {/* Education Rate */}
              <tr className="border-b border-slate-200 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/70">
                <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-300">Bachelor's Degree+</td>
                <td className="px-4 py-3 text-right text-slate-900 dark:text-white">
                  {formatNumber(metrics.get('United States')?.educationRate, 1)}%
                </td>
                {selectedStates.map(state => (
                  <td key={`edu-${state}`} className="text-right py-3 px-4">
                    <div className="text-slate-900 dark:text-white">{formatNumber(metrics.get(state)?.educationRate, 1)}%</div>
                    <div className={`text-xs font-medium ${
                      (metrics.get(state)?.educationRate ?? 0) > (metrics.get('United States')?.educationRate ?? 0)
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {getComparison(metrics.get(state)?.educationRate, metrics.get('United States')?.educationRate)}
                    </div>
                  </td>
                ))}
              </tr>

              {/* Unemployment Rate */}
              <tr className="border-b border-slate-200 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/70">
                <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-300">Unemployment Rate</td>
                <td className="px-4 py-3 text-right text-slate-900 dark:text-white">
                  {formatNumber(metrics.get('United States')?.unemploymentRate, 1)}%
                </td>
                {selectedStates.map(state => (
                  <td key={`unemp-${state}`} className="text-right py-3 px-4">
                    <div className="text-slate-900 dark:text-white">{formatNumber(metrics.get(state)?.unemploymentRate, 1)}%</div>
                    <div className={`text-xs font-medium ${
                      (metrics.get(state)?.unemploymentRate ?? 0) < (metrics.get('United States')?.unemploymentRate ?? 0)
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {getComparison(metrics.get(state)?.unemploymentRate, metrics.get('United States')?.unemploymentRate)}
                    </div>
                  </td>
                ))}
              </tr>

              {/* BEA Current-Dollar GDP */}
              <tr className="border-b border-slate-200 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/70">
                <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-300">BEA Current-Dollar GDP</td>
                <td className="px-4 py-3 text-right text-slate-500">N/A</td>
                {selectedStates.map(state => (
                  <td key={`bea-gdp-${state}`} className="px-4 py-3 text-right text-slate-900 dark:text-white">
                    {formatDollarsFromMillions(metrics.get(state)?.currentDollarGdp)}
                  </td>
                ))}
              </tr>

              {/* BEA Per-Capita Personal Income */}
              <tr className="border-b border-slate-200 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/70">
                <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-300">BEA Per-Capita Personal Income</td>
                <td className="px-4 py-3 text-right text-slate-500">N/A</td>
                {selectedStates.map(state => (
                  <td key={`bea-pcpi-${state}`} className="px-4 py-3 text-right text-slate-900 dark:text-white">
                    ${formatNumber(metrics.get(state)?.beaPerCapitaPersonalIncome)}
                  </td>
                ))}
              </tr>

              {/* BEA Regional Price Parity */}
              <tr className="border-b border-slate-200 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/70">
                <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-300">BEA Regional Price Parity</td>
                <td className="px-4 py-3 text-right text-slate-500">100.0</td>
                {selectedStates.map(state => (
                  <td key={`bea-rpp-${state}`} className="px-4 py-3 text-right text-slate-900 dark:text-white">
                    <div>{formatNumber(metrics.get(state)?.regionalPriceParity, 1)}</div>
                    <div className="text-xs text-slate-500">U.S. average = 100</div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        </>
      )}

      {!loading && selectedStates.length === 0 && (
        <div className="py-12 text-center text-slate-500 dark:text-slate-400">
          <p>Select states above to see a detailed comparison with the USA average.</p>
        </div>
      )}
      </div>
    </div>
  );
};

export default ComparisonPanel;
