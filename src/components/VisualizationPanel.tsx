import React, { Suspense, lazy, useState } from 'react';
import { FilterState } from '../types';
import { BarChart as BarChartIcon, TrendingUp, Info, PieChart, Grid3x3 } from 'lucide-react';
import LoadingSkeleton from './LoadingSkeleton';
import { useDashboardData } from '../hooks/useDashboardData';
import { VisualizationType } from '../types/dashboard';
import { METRO_TO_STATE } from '../utils/dashboardRegions';
import {
  applyTimeframeToStackedData,
  generateLorenzData,
  generateStackedAreaData,
  generateWaffleData,
} from '../utils/dashboardDistributions';
import { buildDashboardMetrics, getLatestUnemploymentRate } from '../utils/dashboardMetrics';
import DashboardOverview from './dashboard/DashboardOverview';
import DistributionContextBanner from './dashboard/DistributionContextBanner';

const LorenzCurve = lazy(() => import('./charts/LorenzCurve'));
const StackedAreaChart = lazy(() => import('./charts/StackedAreaChart'));
const WaffleChart = lazy(() => import('./charts/WaffleChart'));
const Analysis = lazy(() => import('./Analysis'));
const RegionalComparison = lazy(() => import('./RegionalComparison'));

interface VisualizationPanelProps {
  filters: FilterState;
  selectedRegion?: string;
}

const VisualizationPanel: React.FC<VisualizationPanelProps> = ({ filters, selectedRegion = 'United States' }) => {
  const [visualizationType, setVisualizationType] = useState<VisualizationType>('overview');
  const {
    canonicalRegion,
    isMetro,
    regionData,
    wealthData,
    saipeData,
    incomeDistData,
    incomeSeriesByYear,
    loading,
    error,
  } = useDashboardData({ filters, selectedRegion, visualizationType });

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

  const dashboardMetrics = buildDashboardMetrics(regionData, saipeData, isMetro);
  const latestUnemploymentRate = getLatestUnemploymentRate(regionData);

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

  const availableHistoricalStartYear = canonicalRegion === 'United States' ? 1989 : 2000;
  const effectiveHistoricalStartYear = Math.max(availableHistoricalStartYear, filters.yearRange[0]);

  const stackedDataForView = applyTimeframeToStackedData(
    generateStackedAreaData(regionData, wealthData, incomeDistData, incomeSeriesByYear),
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

      <Suspense fallback={<LoadingSkeleton variant="dashboard" />}>
        {visualizationType === 'overview' && (
          <DashboardOverview
            filters={filters}
            selectedRegion={selectedRegion}
            isMetro={isMetro}
            regionData={regionData}
            saipeData={saipeData}
            wealthData={wealthData}
            dashboardMetrics={dashboardMetrics}
            timeframeLabel={timeframeLabel}
            saipeRegionLabel={saipeRegionLabel}
            latestUnemploymentRate={latestUnemploymentRate}
            onDrillTo={drillTo}
          />
        )}

        {visualizationType === 'comparison' && (
          <RegionalComparison selectedRegion={canonicalRegion} regionData={regionData} />
        )}

        {visualizationType === 'analysis' && (
          <Analysis filters={filters} selectedRegion={canonicalRegion} regionData={regionData} />
        )}

        {visualizationType === 'lorenz' && canShowLorenz && (
          <div>
            <DistributionContextBanner
              variant="lorenz"
              selectedRegion={selectedRegion}
              isMetro={isMetro}
              regionData={regionData}
              saipeData={saipeData}
            />
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
            <DistributionContextBanner
              variant="waffle"
              selectedRegion={selectedRegion}
              isMetro={isMetro}
              regionData={regionData}
              saipeData={saipeData}
            />
            <WaffleChart
              data={generateWaffleData(regionData, wealthData, incomeDistData)}
              title={incomeDistData
                ? `${selectedRegion} Income Distribution (${incomeDistData.year}) · Source: Census ACS${requestResolutionLabel ? ` · ${requestResolutionLabel}` : ''} · ${timeframeLabel}`
                : `Income Share Distribution (${wealthData?.data_date ?? 'latest'}) · Source: Federal Reserve DFA · ${timeframeLabel}`
              }
            />
          </div>
        )}
      </Suspense>
    </div>
  );
};

export default VisualizationPanel;
