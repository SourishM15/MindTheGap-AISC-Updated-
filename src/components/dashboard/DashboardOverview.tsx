import React, { Suspense, lazy, useMemo } from 'react';
import { FilterState } from '../../types';
import { DashboardMetric, DashboardRegionData, SAIPEData, VisualizationType, WealthDistributionData } from '../../types/dashboard';
import MetricTooltip from '../MetricTooltip';
import SourceBadge from '../SourceBadge';
import { buildDashboard3DPoints } from '../../utils/dashboard3DData';

const EconomicSignal3D = lazy(() => import('./EconomicSignal3D'));

interface DashboardOverviewProps {
  filters: FilterState;
  selectedRegion: string;
  isMetro: boolean;
  regionData: DashboardRegionData;
  saipeData: SAIPEData | null;
  wealthData: WealthDistributionData | null;
  dashboardMetrics: DashboardMetric[];
  timeframeLabel: string;
  saipeRegionLabel: string;
  latestUnemploymentRate?: number;
  onDrillTo: (type: VisualizationType) => void;
}

const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  filters,
  selectedRegion,
  isMetro,
  regionData,
  saipeData,
  wealthData,
  dashboardMetrics,
  timeframeLabel,
  saipeRegionLabel,
  latestUnemploymentRate,
  onDrillTo,
}) => {
  const demographics = regionData.profile?.demographics || {};
  const dashboardMetricById = new Map(dashboardMetrics.map((metric) => [metric.id, metric]));
  const signal3DPoints = useMemo(() => buildDashboard3DPoints(dashboardMetrics), [dashboardMetrics]);

  const metricEnabled = (metricId: string) => {
    if (!filters.metrics || filters.metrics.length === 0) return true;
    return filters.metrics.includes(metricId);
  };

  const metricsToShow = {
    showPopulation: metricEnabled('population'),
    showIncome: metricEnabled('median-income'),
    showPoverty: metricEnabled('poverty-rate'),
    showEducation: metricEnabled('education'),
    showUnemployment: metricEnabled('unemployment'),
    showChildPoverty: metricEnabled('child-poverty'),
    showSaipeIncome: metricEnabled('median-income'),
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

        <Suspense
          fallback={
            <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="grid gap-2 md:grid-cols-3">
                {signal3DPoints.slice(0, 6).map((point) => (
                  <button
                    key={point.id}
                    type="button"
                    onClick={() => onDrillTo(point.targetView)}
                    className="rounded-md border border-slate-200 bg-white p-3 text-left shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  >
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{point.label}</p>
                    <p className="mt-1 text-xl font-black text-slate-950 dark:text-white">{point.formattedValue}</p>
                  </button>
                ))}
              </div>
            </div>
          }
        >
          <EconomicSignal3D points={signal3DPoints} onDrillTo={onDrillTo} />
        </Suspense>

        <div className={`text-xs px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 mb-5 font-medium
          ${isMetro
            ? 'bg-cyan-100 dark:bg-cyan-950/70 text-cyan-800 dark:text-cyan-300'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
          <span className={`w-2 h-2 rounded-full ${isMetro ? 'bg-cyan-500' : 'bg-amber-400'}`} />
          {isMetro
            ? `Census ACS 2021 · ${selectedRegion} Metro Statistical Area (MSA FIPS: ${demographics.metro_fips ?? '-'})`
            : `Census ACS / SAIPE · ${selectedRegion}`}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {metricsToShow.showPopulation && demographics.population != null && (
            <CardButton className="metric-card border-l-4 border-l-cyan-500" onClick={() => onDrillTo('comparison')} title="Compare population context to the USA">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-slate-600 dark:text-slate-400 font-bold">Population</p>
                <MetricTooltip label="Population" description="Total residents in the selected region. Use this to contextualize rates and counts." />
              </div>
              <p className="text-2xl font-black text-slate-950 dark:text-white mt-1">{dashboardMetricById.get('population')?.formattedValue ?? 'N/A'}</p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">Total residents</p>
              <div className="mt-3"><SourceBadge source="ACS" year={isMetro ? 2021 : 2022} tone="cyan" /></div>
            </CardButton>
          )}

          {metricsToShow.showIncome && demographics.median_household_income != null && (
            <CardButton className="metric-card border-l-4 border-l-emerald-500" onClick={() => onDrillTo('stacked')} title="Open income distribution chart">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-slate-600 dark:text-slate-400 font-bold">Median Income</p>
                <MetricTooltip label="Median Income" description="The midpoint household income: half of households earn more and half earn less." />
              </div>
              <p className="text-2xl font-black text-slate-950 dark:text-white mt-1">{dashboardMetricById.get('median-income')?.formattedValue ?? 'N/A'}</p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">Household annual</p>
              <div className="mt-3"><SourceBadge source={isMetro ? 'ACS' : 'ACS/SAIPE'} year={isMetro ? 2021 : saipeData?.snapshot?.year ?? 2023} tone="cyan" /></div>
            </CardButton>
          )}

          {metricsToShow.showPoverty && demographics.poverty_rate != null && (
            <CardButton className="metric-card border-l-4 border-l-amber-500" onClick={() => onDrillTo('analysis')} title="Open economic insight analysis">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-slate-600 dark:text-slate-400 font-bold">Poverty Rate</p>
                <MetricTooltip label="Poverty Rate" description="Share of residents living below the official poverty threshold." />
              </div>
              <p className="text-2xl font-black text-slate-950 dark:text-white mt-1">{dashboardMetricById.get('poverty-rate')?.formattedValue ?? 'N/A'}</p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">Below poverty line</p>
              <div className="mt-3"><SourceBadge source={isMetro ? 'ACS' : 'SAIPE'} year={isMetro ? 2021 : saipeData?.snapshot?.year ?? 2023} tone="amber" /></div>
            </CardButton>
          )}

          {metricsToShow.showEducation && demographics.education_bachelor_and_above != null && (
            <CardButton className="metric-card border-l-4 border-l-violet-500" onClick={() => onDrillTo('comparison')} title="Compare education context to the USA">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-slate-600 dark:text-slate-400 font-bold">Education</p>
                <MetricTooltip label="Bachelor's Degree+" description="Estimated share of adults with a bachelor's degree or higher." />
              </div>
              <p className="text-2xl font-black text-slate-950 dark:text-white mt-1">{dashboardMetricById.get('education')?.formattedValue ?? 'N/A'}</p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">Bachelor's degree+</p>
              <div className="mt-3"><SourceBadge source="ACS" year={isMetro ? 2021 : 2022} tone="violet" /></div>
            </CardButton>
          )}

          {metricsToShow.showUnemployment && latestUnemploymentRate != null && (
            <CardButton className="metric-card border-l-4 border-l-rose-500" onClick={() => onDrillTo('analysis')} title="Open economic insight analysis">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-slate-600 dark:text-slate-400 font-bold">Unemployment</p>
                <MetricTooltip label="Unemployment Rate" description="Latest available unemployment estimate in the region's economic time series." />
              </div>
              <p className="text-2xl font-black text-slate-950 dark:text-white mt-1">{dashboardMetricById.get('unemployment')?.formattedValue ?? 'N/A'}</p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">Current rate</p>
              <div className="mt-3"><SourceBadge source="BLS/FRED" year="Latest" tone="slate" /></div>
            </CardButton>
          )}

          {metricsToShow.showChildPoverty && saipeData?.snapshot?.child_poverty_rate != null && (
            <CardButton className="metric-card border-l-4 border-l-orange-500" onClick={() => onDrillTo('analysis')} title="Open poverty insight analysis">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-slate-600 dark:text-slate-400 font-bold">Child Poverty Rate</p>
                <MetricTooltip label="Child Poverty Rate" description="Estimated poverty rate for residents under age 18." />
              </div>
              <p className="text-2xl font-black text-slate-950 dark:text-white mt-1">{dashboardMetricById.get('child-poverty')?.formattedValue ?? 'N/A'}</p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">
                Under 18 · SAIPE {saipeData.snapshot.year}{isMetro ? ` · ${saipeRegionLabel} (state)` : ''}
              </p>
              <div className="mt-3"><SourceBadge source="SAIPE" year={saipeData.snapshot.year} tone="amber" /></div>
            </CardButton>
          )}

          {!isMetro && metricsToShow.showSaipeIncome && saipeData?.snapshot?.median_household_income != null && (
            <CardButton className="metric-card border-l-4 border-l-teal-500" onClick={() => onDrillTo('stacked')} title="Open income distribution chart">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-slate-600 dark:text-slate-400 font-bold">Median Income (SAIPE)</p>
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

export default DashboardOverview;
