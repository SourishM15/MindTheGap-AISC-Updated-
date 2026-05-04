import React, { useState, useEffect, useRef } from 'react';
import { FilterState } from '../types';
import { MAJOR_METRO_AREAS } from '../data/states';
import LorenzCurve from './charts/LorenzCurve';
import StackedAreaChart from './charts/StackedAreaChart';
import WaffleChart from './charts/WaffleChart';
import Analysis from './Analysis';
import RegionalComparison from './RegionalComparison';
import { BarChart as BarChartIcon, TrendingUp, Info, PieChart, Grid3x3 } from 'lucide-react';
import LoadingSkeleton from './LoadingSkeleton';
import MetricTooltip from './MetricTooltip';
import SourceBadge from './SourceBadge';

interface VisualizationPanelProps {
  filters: FilterState;
  selectedRegion?: string;
}

interface RegionData {
  state: string;
  metro?: string;
  profile: {
    demographics?: {
      population?: number;
      metro_fips?: string;
      median_household_income?: number;
      poverty_rate?: number;
      education_bachelor_and_above?: number;
      unemployment_rate?: number;
    };
    economics?: {
      indicators?: {
        unemployment_rate?: {
          data?: Record<string, number>;
        };
      };
    };
  };
}

interface WealthDistributionData {
  gini_coefficient: number;
  data_date: string;
  lorenz_data: { bracket: string; cumulativePopulation: number; cumulativeWealth: number; percentage: number }[];
  stacked_data: Record<string, number>[];
  waffle_data: { bracket: string; percentage: number; color: string }[];
  source: string;
}

interface IncomeLorenzData {
  gini_coefficient: number | null;
  median_household_income: number | null;
  lorenz_data: { bracket: string; percentage: number; cumulativePopulation: number; cumulativeWealth: number }[];
  waffle_data: { bracket: string; percentage: number; color: string }[];
  source: string;
  year: number;
  requested_year?: number | null;
  state_specific: boolean;
  metro_specific?: boolean;
}

interface SAIPESnapshot {
  state_name: string;
  fips: string;
  year: number;
  poverty_rate: number | null;
  child_poverty_rate: number | null;
  median_household_income: number | null;
  poverty_count: number | null;
  child_poverty_count: number | null;
  source: string;
}

interface SAIPETimeSeries {
  year: number;
  poverty_rate: number | null;
  child_poverty_rate: number | null;
  median_household_income: number | null;
}

interface SAIPEData {
  snapshot: SAIPESnapshot;
  time_series: SAIPETimeSeries[];
}

type VisualizationType = 'overview' | 'comparison' | 'analysis' | 'lorenz' | 'stacked' | 'waffle';

// Maps metro area name → home state full name (for SAIPE + income-lorenz which are state-level)
const METRO_TO_STATE: Record<string, string> = {
  'Atlanta':      'Georgia',
  'Austin':       'Texas',
  'Boston':       'Massachusetts',
  'Chicago':      'Illinois',
  'Dallas':       'Texas',
  'Denver':       'Colorado',
  'Houston':      'Texas',
  'Jacksonville': 'Florida',
  'Los Angeles':  'California',
  'Miami':        'Florida',
  'Minneapolis':  'Minnesota',
  'New York':     'New York',
  'Philadelphia': 'Pennsylvania',
  'Phoenix':      'Arizona',
  'Portland':     'Oregon',
  'San Antonio':  'Texas',
  'San Diego':    'California',
  'San Jose':     'California',
  'Seattle':      'Washington',
  'Washington':   'District of Columbia',
};

const METRO_REGION_ALIASES: Record<string, string> = {
  'New York Metro': 'New York',
  'Washington Metro': 'Washington',
};

const VisualizationPanel: React.FC<VisualizationPanelProps> = ({ filters, selectedRegion = 'United States' }) => {
  const canonicalRegion = METRO_REGION_ALIASES[selectedRegion] ?? selectedRegion;
  const isForcedMetro = selectedRegion.endsWith(' Metro');
  // A region is metro if explicitly selected as metro alias, or if it is a non-ambiguous metro name.
  const isMetro = isForcedMetro || (MAJOR_METRO_AREAS.includes(canonicalRegion) && !(['Washington', 'New York'].includes(canonicalRegion)));

  const [regionData, setRegionData] = useState<RegionData | null>(null);
  const [wealthData, setWealthData] = useState<WealthDistributionData | null>(null);
  const [saipeData, setSaipeData] = useState<SAIPEData | null>(null);
  const [incomeDistData, setIncomeDistData] = useState<IncomeLorenzData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visualizationType, setVisualizationType] = useState<VisualizationType>('overview');
  const incomeCacheRef = useRef<Record<string, IncomeLorenzData>>({});
  const incomeSeriesCacheRef = useRef<Record<string, Record<number, IncomeLorenzData>>>({});

  // Base data for cards + national DFA should only refetch when region changes.
  useEffect(() => {
    let cancelled = false;

    const fetchRegionData = async () => {
      setLoading(true);
      setError(null);
      setRegionData(null);
      setSaipeData(null);
      setIncomeDistData(null);
      try {
        const stateForRegion = isMetro ? (METRO_TO_STATE[canonicalRegion] ?? canonicalRegion) : canonicalRegion;
        const enrichedEndpoint = isMetro
          ? `http://localhost:8000/api/enriched-metro/${encodeURIComponent(canonicalRegion)}`
          : `http://localhost:8000/api/enriched-state/${canonicalRegion}`;

        const [regionRes, wealthRes, saipeRes] = await Promise.all([
          fetch(enrichedEndpoint),
          fetch('http://localhost:8000/api/wealth-distribution'),
          fetch(`http://localhost:8000/api/saipe-state/${stateForRegion}`),
        ]);

        if (cancelled) return;

        if (regionRes.ok) {
          const data = await regionRes.json();
          if (cancelled) return;
          // Normalise metro response shape to match state shape (state field)
          if (data.success && data.profile) {
            if (isMetro && data.metro) data.state = data.metro;
            setRegionData(data);
          }
        }

        if (wealthRes.ok) {
          const wData = await wealthRes.json();
          if (cancelled) return;
          if (wData.success) setWealthData(wData);
        }

        if (saipeRes.ok) {
          const sData = await saipeRes.json();
          if (cancelled) return;
          if (sData.success) setSaipeData(sData);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Error fetching data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRegionData();

    return () => { cancelled = true; };
  }, [selectedRegion, canonicalRegion, isMetro]);

  // Warm a yearly income-distribution cache (1989-2023) per region so time slider updates
  // are driven by real annual snapshots instead of repeating one point.
  useEffect(() => {
    const needsIncomeData = visualizationType === 'lorenz' || visualizationType === 'waffle' || visualizationType === 'stacked';
    const needsSeries = needsIncomeData && (filters.timeframe === 'historical' || filters.timeframe === 'forecast');
    if (!needsSeries) return;

    const seriesKey = `${isMetro ? 'metro' : 'state'}:${selectedRegion}`;
    const existing = incomeSeriesCacheRef.current[seriesKey] ?? {};
    const targetYears: number[] = [];
    for (let y = 1989; y <= 2023; y++) {
      if (!existing[y]) targetYears.push(y);
    }
    if (!targetYears.length) return;

    let cancelled = false;

    const fetchYear = async (year: number): Promise<void> => {
      const stateForRegion = isMetro ? (METRO_TO_STATE[canonicalRegion] ?? canonicalRegion) : canonicalRegion;
      const endpoint = isMetro
        ? `http://localhost:8000/api/income-lorenz-metro/${encodeURIComponent(canonicalRegion)}?year=${year}`
        : `http://localhost:8000/api/income-lorenz/${stateForRegion}?year=${year}`;

      const res = await fetch(endpoint);
      if (cancelled || !res.ok) return;
      const payload = await res.json();
      if (cancelled || !payload.success || !payload.data?.year) return;

      const normalized: IncomeLorenzData = {
        ...payload.data,
        state_specific: !!payload.state_specific,
        metro_specific: !!payload.metro_specific,
      };

      if (!incomeSeriesCacheRef.current[seriesKey]) incomeSeriesCacheRef.current[seriesKey] = {};
      incomeSeriesCacheRef.current[seriesKey][normalized.year] = normalized;
      const pointCacheKey = `${isMetro ? 'metro' : 'state'}:${selectedRegion}:${normalized.year}`;
      incomeCacheRef.current[pointCacheKey] = normalized;
    };

    const prefetch = async () => {
      const chunkSize = 4;
      for (let i = 0; i < targetYears.length; i += chunkSize) {
        if (cancelled) return;
        const chunk = targetYears.slice(i, i + chunkSize);
        await Promise.all(chunk.map(fetchYear));
      }
    };

    prefetch().catch(() => {
      // Keep UI functional with on-demand point fetches even if warmup is partial.
    });

    return () => {
      cancelled = true;
    };
  }, [selectedRegion, canonicalRegion, filters.timeframe, visualizationType, isMetro]);

  // Income distribution (Lorenz/Waffle/region-stacked) is year-sensitive and can be cached/debounced.
  useEffect(() => {
    const needsIncomeData = visualizationType === 'lorenz' || visualizationType === 'waffle' || visualizationType === 'stacked';
    if (!needsIncomeData) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const requestedIncomeYearRaw =
          filters.timeframe === 'historical' || filters.timeframe === 'forecast'
            ? filters.yearRange[1]
            : null;
        const requestedIncomeYear = requestedIncomeYearRaw == null
          ? null
          : Math.max(1989, Math.min(2035, requestedIncomeYearRaw));

        const seriesKey = `${isMetro ? 'metro' : 'state'}:${selectedRegion}`;
        if (requestedIncomeYear != null) {
          const yearlyCached = incomeSeriesCacheRef.current[seriesKey]?.[requestedIncomeYear];
          if (yearlyCached) {
            setIncomeDistData(yearlyCached);
            return;
          }
        }

        const stateForRegion = isMetro ? (METRO_TO_STATE[canonicalRegion] ?? canonicalRegion) : canonicalRegion;
        const endpoint = isMetro
          ? `http://localhost:8000/api/income-lorenz-metro/${encodeURIComponent(canonicalRegion)}${requestedIncomeYear ? `?year=${requestedIncomeYear}` : ''}`
          : `http://localhost:8000/api/income-lorenz/${stateForRegion}${requestedIncomeYear ? `?year=${requestedIncomeYear}` : ''}`;

        const cacheKey = `${isMetro ? 'metro' : 'state'}:${selectedRegion}:${requestedIncomeYear ?? 'latest'}`;
        const cached = incomeCacheRef.current[cacheKey];
        if (cached) {
          setIncomeDistData(cached);
          return;
        }

        const incomeRes = await fetch(endpoint);
        if (cancelled) return;
        if (!incomeRes.ok) {
          setIncomeDistData(null);
          return;
        }
        const iData = await incomeRes.json();
        if (cancelled) return;

        if (iData.success && iData.data) {
          const normalized: IncomeLorenzData = {
            ...iData.data,
            state_specific: !!iData.state_specific,
            metro_specific: !!iData.metro_specific,
          };
          incomeCacheRef.current[cacheKey] = normalized;
          setIncomeDistData(normalized);
        } else {
          setIncomeDistData(null);
        }
      } catch {
        setIncomeDistData(null);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selectedRegion, canonicalRegion, filters.timeframe, filters.yearRange, visualizationType, isMetro]);

  if (loading) {
    return (
      <LoadingSkeleton variant="dashboard" />
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">
        {error}
      </div>
    );
  }

  if (!regionData) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
        No data available for {selectedRegion}
      </div>
    );
  }

  const demographics = regionData.profile?.demographics || {};
  const economics = regionData.profile?.economics || {};
  
  // Extract latest unemployment rate from time series data
  const unemploymentData = economics.indicators?.unemployment_rate?.data || {};
  const latestUnemploymentRate = unemploymentData[Object.keys(unemploymentData).sort().pop() as string];

  const saipeRegionLabel = isMetro
    ? (saipeData?.snapshot?.state_name ?? METRO_TO_STATE[canonicalRegion] ?? canonicalRegion)
    : canonicalRegion;

  const metricEnabled = (metricId: string) => {
    // If user deselects everything, show all by default to avoid an empty dashboard.
    if (!filters.metrics || filters.metrics.length === 0) return true;
    return filters.metrics.includes(metricId);
  };

  const canShowLorenz = metricEnabled('gini') || metricEnabled('income-ratio');
  const canShowDistribution = metricEnabled('wealth-top1') || metricEnabled('income-ratio');

  const regionIncomeSeries = incomeSeriesCacheRef.current[`${isMetro ? 'metro' : 'state'}:${selectedRegion}`];

  const availableHistoricalStartYear = canonicalRegion === 'United States' ? 1989 : 2000;
  const effectiveHistoricalStartYear = Math.max(availableHistoricalStartYear, filters.yearRange[0]);

  const stackedDataForView = applyTimeframeToStackedData(
    generateStackedAreaData(regionData, wealthData, incomeDistData, regionIncomeSeries),
    filters.timeframe,
    filters.yearRange
  );

  const timeframeLabel =
    filters.timeframe === 'current'
      ? 'Current Snapshot'
      : filters.timeframe === 'historical'
        ? `Historical (${effectiveHistoricalStartYear}-${filters.yearRange[1]})`
        : `Forecast (${filters.yearRange[0]}-${filters.yearRange[1]})`;

  const requestResolutionLabel =
    filters.timeframe === 'historical' || filters.timeframe === 'forecast'
      ? `Requested ${filters.yearRange[1]} · Resolved ${incomeDistData?.year ?? 'N/A'}`
      : null;

  const drillTo = (type: VisualizationType) => {
    setVisualizationType(type);
  };

  const CardButton: React.FC<{
    children: React.ReactNode;
    className: string;
    onClick: () => void;
    title: string;
  }> = ({ children, className, onClick, title }) => (
    <button
      type="button"
      onClick={onClick}
      className={`${className} text-left ring-1 ring-transparent transition-all hover:-translate-y-0.5 hover:shadow-md hover:ring-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:hover:ring-slate-700`}
      title={title}
    >
      {children}
    </button>
  );

  const renderCharts = () => {
    // Metric cards are controlled by filter toggles.
    const metricsToShow = {
      showPopulation: metricEnabled('population'),
      showIncome: metricEnabled('median-income'),
      showPoverty: metricEnabled('poverty-rate'),
      showEducation: metricEnabled('education'),
      showUnemployment: metricEnabled('unemployment'),
      showChildPoverty: metricEnabled('child-poverty'),
      showSaipeIncome: metricEnabled('median-income'),
    };

    return (
      <div className="grid grid-cols-1 gap-6 mb-6">
        <div className="surface p-6">
          <div className="mb-4 flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">
                  {selectedRegion} - Key Demographics
                </h2>
                <MetricTooltip
                  label="Metric Cards"
                  description="Click a card to drill into the dashboard view that best explains that indicator."
                />
              </div>
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                Timeframe: {timeframeLabel}
              </p>
            </div>
            <div className="hidden flex-wrap justify-end gap-2 sm:flex">
              <SourceBadge source={isMetro ? 'ACS' : 'ACS/SAIPE'} year={isMetro ? 2021 : saipeData?.snapshot?.year ?? 2023} tone="cyan" />
              <SourceBadge source="DFA" year={wealthData?.data_date ?? 'Latest'} tone="violet" />
            </div>
          </div>

          {/* Data source badge */}
          <div className={`text-xs px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 mb-5 font-medium
            ${isMetro
              ? 'bg-cyan-100 dark:bg-cyan-950/70 text-cyan-800 dark:text-cyan-300'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
            <span className={`w-2 h-2 rounded-full ${isMetro ? 'bg-cyan-500' : 'bg-amber-400'}`} />
            {isMetro
              ? `Census ACS 2021 · ${selectedRegion} Metro Statistical Area (MSA FIPS: ${demographics.metro_fips ?? '—'})`
              : `Census ACS / SAIPE · ${selectedRegion}`}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {metricsToShow.showPopulation && demographics.population != null && (
              <CardButton className="metric-card border-l-4 border-l-cyan-500" onClick={() => drillTo('comparison')} title="Compare population context to the USA">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-bold">Population</p>
                  <MetricTooltip label="Population" description="Total residents in the selected region. Use this to contextualize rates and counts." />
                </div>
                <p className="text-2xl font-black text-slate-950 dark:text-white mt-1">
                  {(demographics.population / 1000000).toFixed(1)}M
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">Total residents</p>
                <div className="mt-3"><SourceBadge source="ACS" year={isMetro ? 2021 : 2022} tone="cyan" /></div>
              </CardButton>
            )}
            {metricsToShow.showIncome && demographics.median_household_income != null && (
              <CardButton className="metric-card border-l-4 border-l-emerald-500" onClick={() => drillTo('stacked')} title="Open income distribution chart">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-bold">Median Income</p>
                  <MetricTooltip label="Median Income" description="The midpoint household income: half of households earn more and half earn less." />
                </div>
                <p className="text-2xl font-black text-slate-950 dark:text-white mt-1">
                  ${(demographics.median_household_income / 1000).toFixed(0)}K
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">Household annual</p>
                <div className="mt-3"><SourceBadge source={isMetro ? 'ACS' : 'ACS/SAIPE'} year={isMetro ? 2021 : saipeData?.snapshot?.year ?? 2023} tone="cyan" /></div>
              </CardButton>
            )}
            {metricsToShow.showPoverty && demographics.poverty_rate != null && (
              <CardButton className="metric-card border-l-4 border-l-amber-500" onClick={() => drillTo('analysis')} title="Open economic insight analysis">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-bold">Poverty Rate</p>
                  <MetricTooltip label="Poverty Rate" description="Share of residents living below the official poverty threshold." />
                </div>
                <p className="text-2xl font-black text-slate-950 dark:text-white mt-1">
                  {demographics.poverty_rate.toFixed(1)}%
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">Below poverty line</p>
                <div className="mt-3"><SourceBadge source={isMetro ? 'ACS' : 'SAIPE'} year={isMetro ? 2021 : saipeData?.snapshot?.year ?? 2023} tone="amber" /></div>
              </CardButton>
            )}
            {metricsToShow.showEducation && demographics.education_bachelor_and_above != null && (
              <CardButton className="metric-card border-l-4 border-l-violet-500" onClick={() => drillTo('comparison')} title="Compare education context to the USA">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-bold">Education</p>
                  <MetricTooltip label="Bachelor's Degree+" description="Estimated share of adults with a bachelor's degree or higher." />
                </div>
                <p className="text-2xl font-black text-slate-950 dark:text-white mt-1">
                  {demographics.education_bachelor_and_above.toFixed(1)}%
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">Bachelor's degree+</p>
                <div className="mt-3"><SourceBadge source="ACS" year={isMetro ? 2021 : 2022} tone="violet" /></div>
              </CardButton>
            )}
            {metricsToShow.showUnemployment && latestUnemploymentRate != null && (
              <CardButton className="metric-card border-l-4 border-l-rose-500" onClick={() => drillTo('analysis')} title="Open economic insight analysis">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-bold">Unemployment</p>
                  <MetricTooltip label="Unemployment Rate" description="Latest available unemployment estimate in the region's economic time series." />
                </div>
                <p className="text-2xl font-black text-slate-950 dark:text-white mt-1">
                  {latestUnemploymentRate.toFixed(1)}%
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">Current rate</p>
                <div className="mt-3"><SourceBadge source="BLS/FRED" year="Latest" tone="slate" /></div>
              </CardButton>
            )}
            {/* SAIPE-sourced data — state-level for metros, state-level for states */}
            {metricsToShow.showChildPoverty && saipeData?.snapshot?.child_poverty_rate != null && (
              <CardButton className="metric-card border-l-4 border-l-orange-500" onClick={() => drillTo('analysis')} title="Open poverty insight analysis">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-bold">Child Poverty Rate</p>
                  <MetricTooltip label="Child Poverty Rate" description="Estimated poverty rate for residents under age 18." />
                </div>
                <p className="text-2xl font-black text-slate-950 dark:text-white mt-1">
                  {saipeData.snapshot.child_poverty_rate.toFixed(1)}%
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">
                  Under 18 · SAIPE {saipeData.snapshot.year}{isMetro ? ` · ${saipeRegionLabel} (state)` : ''}
                </p>
                <div className="mt-3"><SourceBadge source="SAIPE" year={saipeData.snapshot.year} tone="amber" /></div>
              </CardButton>
            )}
            {/* Only show SAIPE income for states — for metros the ACS MSA income card above is
                 already present and more accurate; showing both creates confusing duplicates. */}
            {!isMetro && metricsToShow.showSaipeIncome && saipeData?.snapshot?.median_household_income != null && (
              <CardButton className="metric-card border-l-4 border-l-teal-500" onClick={() => drillTo('stacked')} title="Open income distribution chart">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-bold">
                    Median Income (SAIPE)
                  </p>
                  <MetricTooltip label="SAIPE Median Income" description="State-level Census SAIPE estimate used as a consistent annual benchmark." />
                </div>
                <p className="text-2xl font-black text-slate-950 dark:text-white mt-1">
                  ${(saipeData.snapshot.median_household_income / 1000).toFixed(0)}K
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">
                  State estimate · SAIPE {saipeData.snapshot.year}
                </p>
                <div className="mt-3"><SourceBadge source="SAIPE" year={saipeData.snapshot.year} tone="cyan" /></div>
              </CardButton>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Visualization Type Selector */}
      <div className="surface mb-6 flex flex-wrap gap-2 overflow-hidden p-2">
        <button
          onClick={() => setVisualizationType('overview')}
          className={`control-button flex items-center gap-2 ${
            visualizationType === 'overview'
              ? 'control-button-active'
              : 'control-button-idle'
          }`}
        >
          <BarChartIcon className="w-4 h-4" />
          Overview
        </button>
        <button
          onClick={() => setVisualizationType('comparison')}
          className={`control-button flex items-center gap-2 ${
            visualizationType === 'comparison'
              ? 'control-button-active'
              : 'control-button-idle'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Compare to USA
        </button>
        <button
          onClick={() => setVisualizationType('analysis')}
          className={`control-button flex items-center gap-2 ${
            visualizationType === 'analysis'
              ? 'control-button-active'
              : 'control-button-idle'
          }`}
        >
          <Info className="w-4 h-4" />
          Economic Insights
        </button>
        
        {/* New Advanced Visualizations */}
        <div className="ml-2 border-l border-slate-200 pl-2 dark:border-slate-700" />
        
        <button
          onClick={() => setVisualizationType('lorenz')}
          disabled={!canShowLorenz}
          className={`control-button flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-45 ${
            visualizationType === 'lorenz'
              ? 'control-button-active'
              : 'control-button-idle'
          }`}
          title="Shows wealth distribution with Gini coefficient"
        >
          <PieChart className="w-4 h-4" />
          Lorenz Curve
        </button>
        
        <button
          onClick={() => setVisualizationType('stacked')}
          disabled={!canShowDistribution}
          className={`control-button flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-45 ${
            visualizationType === 'stacked'
              ? 'control-button-active'
              : 'control-button-idle'
          }`}
          title="Shows income distribution by decile over time"
        >
          <TrendingUp className="w-4 h-4" />
          Stacked Distribution
        </button>
        
        <button
          onClick={() => setVisualizationType('waffle')}
          disabled={!canShowDistribution}
          className={`control-button flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-45 ${
            visualizationType === 'waffle'
              ? 'control-button-active'
              : 'control-button-idle'
          }`}
          title="100-square grid showing population distribution"
        >
          <Grid3x3 className="w-4 h-4" />
          Waffle Chart
        </button>
      </div>

      {!canShowLorenz && visualizationType === 'lorenz' && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          Enable "Gini / Lorenz" or "Income Ratio Lens" in Metrics to view Lorenz analysis.
        </div>
      )}

      {!canShowDistribution && (visualizationType === 'stacked' || visualizationType === 'waffle') && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          Enable "Distribution Charts" or "Income Ratio Lens" in Metrics to view stacked and waffle charts.
        </div>
      )}

      {/* Content based on selected visualization type */}
      {visualizationType === 'overview' && renderCharts()}
      {visualizationType === 'comparison' && regionData && (
        <RegionalComparison selectedRegion={canonicalRegion} regionData={regionData} />
      )}
      {visualizationType === 'analysis' && regionData && (
        <Analysis filters={filters} selectedRegion={canonicalRegion} regionData={regionData} />
      )}
      
      {/* Advanced Visualizations */}
      {visualizationType === 'lorenz' && canShowLorenz && (
        <div>
          {/* Context banner: MSA data for metros, SAIPE for states */}
          {isMetro && demographics.population != null ? (
            <div className="surface-muted mb-4 flex flex-wrap gap-6 p-4 text-sm">
              <span className="font-semibold text-slate-900 dark:text-white">
                {selectedRegion} Metro Statistical Area · ACS 2021
              </span>
              {demographics.poverty_rate != null && (
                <span className="text-slate-700 dark:text-slate-300">MSA Poverty Rate: <strong>{demographics.poverty_rate.toFixed(1)}%</strong></span>
              )}
              {demographics.median_household_income != null && (
                <span className="text-slate-700 dark:text-slate-300">MSA Median Income: <strong>${demographics.median_household_income.toLocaleString()}</strong></span>
              )}
              <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">Source: Census Bureau ACS (MSA-level)</span>
            </div>
          ) : saipeData?.snapshot ? (
            <div className="surface-muted mb-4 flex flex-wrap gap-6 p-4 text-sm">
              <span className="font-semibold text-slate-900 dark:text-white">
                {selectedRegion} · SAIPE {saipeData.snapshot.year}
              </span>
              {saipeData.snapshot.poverty_rate != null && (
                <span className="text-slate-700 dark:text-slate-300">Poverty Rate: <strong>{saipeData.snapshot.poverty_rate.toFixed(1)}%</strong></span>
              )}
              {saipeData.snapshot.child_poverty_rate != null && (
                <span className="text-slate-700 dark:text-slate-300">Child Poverty: <strong>{saipeData.snapshot.child_poverty_rate.toFixed(1)}%</strong></span>
              )}
              {saipeData.snapshot.median_household_income != null && (
                <span className="text-slate-700 dark:text-slate-300">Median Income: <strong>${saipeData.snapshot.median_household_income.toLocaleString()}</strong></span>
              )}
              <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">Source: Census Bureau SAIPE</span>
            </div>
          ) : null}
          <LorenzCurve
            incomeData={generateLorenzData(regionData, wealthData, incomeDistData)}
            giniCoefficient={incomeDistData?.gini_coefficient ?? wealthData?.gini_coefficient}
            title={incomeDistData
              ? `${selectedRegion} Income Inequality · Gini: ${incomeDistData.gini_coefficient?.toFixed(3) ?? 'N/A'} · Source: Census ACS ${incomeDistData.year}${requestResolutionLabel ? ` · ${requestResolutionLabel}` : ''} · ${timeframeLabel}`
              : `Net Worth Inequality · Gini: ${wealthData ? wealthData.gini_coefficient.toFixed(3) : 'N/A'} · Source: Federal Reserve DFA (National) · ${timeframeLabel}`
            }
          />
        </div>
      )}

      {visualizationType === 'stacked' && canShowDistribution && (
        <StackedAreaChart
          data={stackedDataForView}
          title={incomeDistData
            ? `${selectedRegion} Income Share Distribution · ${timeframeLabel} · Source: ${incomeDistData.source}${requestResolutionLabel ? ` · ${requestResolutionLabel}` : ''}`
            : `Income Share by Bracket · ${timeframeLabel} · Source: Federal Reserve DFA`
          }
        />
      )}

      {visualizationType === 'waffle' && canShowDistribution && (
        <div>
          {/* Context banner: MSA data for metros, SAIPE for states */}
          {isMetro && demographics.population != null ? (
            <div className="surface-muted mb-4 flex flex-wrap gap-6 p-4 text-sm">
              <span className="font-semibold text-slate-900 dark:text-white">
                {selectedRegion} Metro Statistical Area · ACS 2021
              </span>
              {demographics.poverty_rate != null && (
                <span className="text-slate-700 dark:text-slate-300">MSA Poverty Rate: <strong>{demographics.poverty_rate.toFixed(1)}%</strong></span>
              )}
              {demographics.poverty_rate != null && demographics.population != null && (
                <span className="text-slate-700 dark:text-slate-300">In Poverty: <strong>{Math.round(demographics.population * demographics.poverty_rate / 100).toLocaleString()}</strong> people</span>
              )}
              <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">Source: Census Bureau ACS (MSA-level)</span>
            </div>
          ) : saipeData?.snapshot ? (
            <div className="surface-muted mb-4 flex flex-wrap gap-6 p-4 text-sm">
              <span className="font-semibold text-slate-900 dark:text-white">
                {selectedRegion} · SAIPE {saipeData.snapshot.year}
              </span>
              {saipeData.snapshot.poverty_rate != null && (
                <span className="text-slate-700 dark:text-slate-300">All-age Poverty: <strong>{saipeData.snapshot.poverty_rate.toFixed(1)}%</strong></span>
              )}
              {saipeData.snapshot.poverty_count != null && (
                <span className="text-slate-700 dark:text-slate-300">In Poverty: <strong>{saipeData.snapshot.poverty_count.toLocaleString()}</strong> people</span>
              )}
              <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">Source: Census Bureau SAIPE</span>
            </div>
          ) : null}
          <WaffleChart
            data={generateWaffleData(regionData, wealthData, incomeDistData)}
            title={incomeDistData
              ? `${selectedRegion} Income Distribution (${incomeDistData.year}) · Source: Census ACS${requestResolutionLabel ? ` · ${requestResolutionLabel}` : ''} · ${timeframeLabel}`
              : `Income Share Distribution (${wealthData?.data_date ?? 'latest'}) · Source: Federal Reserve DFA · ${timeframeLabel}`
            }
          />
        </div>
      )}
    </div>
  );
};

// Helper function to generate Lorenz curve data
function generateLorenzData(_regionData: RegionData | null, wealthData: WealthDistributionData | null, incomeDistData: IncomeLorenzData | null = null) {
  // Prefer state-specific ACS income data
  if (incomeDistData?.lorenz_data?.length) return incomeDistData.lorenz_data;
  // Fall back to national DFA wealth data
  if (wealthData?.lorenz_data?.length) return wealthData.lorenz_data;

  // Fallback mock data
  return [
    { bracket: 'Origin',        percentage: 0,    cumulativePopulation: 0,   cumulativeWealth: 0 },
    { bracket: 'Bottom 50%',    percentage: 2.5,  cumulativePopulation: 50,  cumulativeWealth: 2.5 },
    { bracket: 'Next 40%',      percentage: 30.1, cumulativePopulation: 90,  cumulativeWealth: 32.6 },
    { bracket: 'Next 9%',       percentage: 36.4, cumulativePopulation: 99,  cumulativeWealth: 69.0 },
    { bracket: 'Top 1-0.1%',    percentage: 17.1, cumulativePopulation: 99.9,cumulativeWealth: 86.1 },
    { bracket: 'Top 0.1%',      percentage: 13.9, cumulativePopulation: 100, cumulativeWealth: 100 },
  ];
}

// Helper function to generate stacked area chart data
function generateStackedAreaData(
  _regionData: RegionData | null,
  wealthData: WealthDistributionData | null,
  incomeDistData: IncomeLorenzData | null = null,
  incomeSeriesByYear?: Record<number, IncomeLorenzData>
): { year: number; [decile: string]: string | number }[] {
  if (incomeSeriesByYear && Object.keys(incomeSeriesByYear).length > 0) {
    const sortedYears = Object.keys(incomeSeriesByYear)
      .map((y) => Number(y))
      .filter((y) => Number.isFinite(y))
      .sort((a, b) => a - b);

    const rows = sortedYears.map((year) => {
      const snapshot = incomeSeriesByYear[year];
      const bucketMap: Record<string, number> = {
        'Bottom 20%': 0,
        '20-40%': 0,
        '40-60%': 0,
        '60-80%': 0,
        '80-99%': 0,
        'Top 1%': 0,
      };

      for (const b of snapshot.waffle_data ?? []) {
        if (b.bracket === 'Bottom 20%') bucketMap['Bottom 20%'] += b.percentage;
        else if (b.bracket === '20-40%' || b.bracket === '20–40%') bucketMap['20-40%'] += b.percentage;
        else if (b.bracket === '40-60%' || b.bracket === '40–60%') bucketMap['40-60%'] += b.percentage;
        else if (b.bracket === '60-80%' || b.bracket === '60–80%') bucketMap['60-80%'] += b.percentage;
        else if (b.bracket === '80-95%' || b.bracket === '80–95%') bucketMap['80-99%'] += b.percentage;
        else if (b.bracket === 'Top 5%') bucketMap['Top 1%'] += b.percentage;
      }

      return {
        year,
        'Bottom 20%': Number(bucketMap['Bottom 20%'].toFixed(2)),
        '20-40%': Number(bucketMap['20-40%'].toFixed(2)),
        '40-60%': Number(bucketMap['40-60%'].toFixed(2)),
        '60-80%': Number(bucketMap['60-80%'].toFixed(2)),
        '80-99%': Number(bucketMap['80-99%'].toFixed(2)),
        'Top 1%': Number(bucketMap['Top 1%'].toFixed(2)),
      };
    });

    if (rows.length >= 2) return rows;
  }

  // Region-specific ACS snapshot (state or metro): build a single-year stacked row
  if (incomeDistData?.waffle_data?.length && incomeDistData?.year) {
    const bucketMap: Record<string, number> = {
      'Bottom 20%': 0,
      '20-40%': 0,
      '40-60%': 0,
      '60-80%': 0,
      '80-99%': 0,
      'Top 1%': 0,
    };

    for (const b of incomeDistData.waffle_data) {
      if (b.bracket === 'Bottom 20%') bucketMap['Bottom 20%'] += b.percentage;
      else if (b.bracket === '20-40%' || b.bracket === '20–40%') bucketMap['20-40%'] += b.percentage;
      else if (b.bracket === '40-60%' || b.bracket === '40–60%') bucketMap['40-60%'] += b.percentage;
      else if (b.bracket === '60-80%' || b.bracket === '60–80%') bucketMap['60-80%'] += b.percentage;
      else if (b.bracket === '80-95%' || b.bracket === '80–95%') bucketMap['80-99%'] += b.percentage;
      else if (b.bracket === 'Top 5%') bucketMap['Top 1%'] += b.percentage;
    }

    const snapshotRow = {
      year: incomeDistData.year,
      'Bottom 20%': Number(bucketMap['Bottom 20%'].toFixed(2)),
      '20-40%': Number(bucketMap['20-40%'].toFixed(2)),
      '40-60%': Number(bucketMap['40-60%'].toFixed(2)),
      '60-80%': Number(bucketMap['60-80%'].toFixed(2)),
      '80-99%': Number(bucketMap['80-99%'].toFixed(2)),
      'Top 1%': Number(bucketMap['Top 1%'].toFixed(2)),
    };

    // Recharts AreaChart does not visibly fill with a single x-point.
    // Build a tiny 3-year window with identical values so the stacked areas render.
    return [
      { ...snapshotRow, year: incomeDistData.year - 1 },
      snapshotRow,
      { ...snapshotRow, year: incomeDistData.year + 1 },
    ];
  }

  // Use real Federal Reserve DFA time series if available
  if (wealthData?.stacked_data?.length) return wealthData.stacked_data as { year: number; [decile: string]: string | number }[];

  // Fallback mock data — keys must match DECILE_COLORS in StackedAreaChart
  const years = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023];
  return years.map(year => ({
    year,
    'Bottom 20%': 3 + Math.random() * 0.3,
    '20-40%':     7 + Math.random() * 0.3,
    '40-60%':     12 + Math.random() * 0.3,
    '60-80%':     18 + Math.random() * 0.3,
    '80-99%':     40 + Math.random() * 0.5,
    'Top 1%':     17 + Math.random() * 0.5,
  }));
}

function applyTimeframeToStackedData(
  data: { year: number; [decile: string]: string | number }[],
  timeframe: 'current' | 'historical' | 'forecast',
  yearRange: [number, number]
): { year: number; [decile: string]: string | number }[] {
  if (!data.length) return data;

  if (timeframe === 'current') {
    // Show a recent window when available.
    return data.length > 8 ? data.slice(-8) : data;
  }

  if (timeframe === 'historical') {
    const filtered = data.filter(d => d.year >= yearRange[0] && d.year <= yearRange[1] && d.year <= 2023);
    return filtered;
  }

  // Forecast: project from the latest observed pattern.
  const observed = [...data].filter(d => d.year <= 2025).sort((a, b) => a.year - b.year);
  const base = observed.length ? observed : [...data].sort((a, b) => a.year - b.year);
  const last = base[base.length - 1];
  const first = base[Math.max(0, base.length - 5)];
  const keys = Object.keys(last).filter(k => k !== 'year');
  const deltaYears = Math.max(1, Number(last.year) - Number(first.year));

  const slopes: Record<string, number> = {};
  keys.forEach((k) => {
    const a = Number(first[k] ?? 0);
    const b = Number(last[k] ?? 0);
    slopes[k] = (b - a) / deltaYears;
  });

  const projected: { year: number; [decile: string]: string | number }[] = [];
  for (let year = yearRange[0]; year <= yearRange[1]; year++) {
    const row: { year: number; [decile: string]: string | number } = { year };
    keys.forEach((k) => {
      const yearsForward = year - Number(last.year);
      const value = Number(last[k] ?? 0) + slopes[k] * yearsForward;
      row[k] = Math.max(0, Number(value.toFixed(2)));
    });

    // Re-normalize to 100 so stacked shares remain valid percentages.
    const sum = keys.reduce((s, k) => s + Number(row[k] ?? 0), 0) || 1;
    keys.forEach((k) => {
      row[k] = Number(((Number(row[k] ?? 0) / sum) * 100).toFixed(2));
    });

    projected.push(row);
  }

  return projected.length ? projected : data;
}

// Helper function to generate waffle chart data
function generateWaffleData(_regionData: RegionData | null, wealthData: WealthDistributionData | null, incomeDistData: IncomeLorenzData | null = null) {
  // Prefer state-specific ACS income data
  if (incomeDistData?.waffle_data?.length) return incomeDistData.waffle_data;
  // Fall back to national DFA data
  if (wealthData?.waffle_data?.length) return wealthData.waffle_data;

  // Fallback mock data
  return [
    { bracket: 'Bottom 20%', percentage: 3,    color: '#ef4444' },
    { bracket: '20-40%',     percentage: 7,    color: '#f97316' },
    { bracket: '40-60%',     percentage: 12,   color: '#eab308' },
    { bracket: '60-80%',     percentage: 18,   color: '#22c55e' },
    { bracket: '80-99%',     percentage: 43,   color: '#0ea5e9' },
    { bracket: 'Top 1%',     percentage: 17,   color: '#3b82f6' },
  ];
}

export default VisualizationPanel;
