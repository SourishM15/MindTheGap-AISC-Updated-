import React from 'react';
import { AlertTriangle, Lightbulb, MapPinned, TrendingUp } from 'lucide-react';
import SourceBadge from './SourceBadge';
import { useStateBenchmarks } from '../hooks/useStateBenchmarks';

interface InsightsSummaryProps {
  selectedRegion?: string;
  context?: 'home' | 'dashboard' | 'compare';
}

const formatIncome = (value: number) => `$${Math.round(value / 1000)}K`;

type BenchmarkRow = { state: string; gini: number; poverty: number; income: number };

const getRank = (rows: BenchmarkRow[], state: string, metric: keyof Omit<BenchmarkRow, 'state'>, direction: 'high' | 'low' = 'high') => {
  const sorted = [...rows].sort((a, b) => direction === 'high' ? b[metric] - a[metric] : a[metric] - b[metric]);
  const index = sorted.findIndex((row) => row.state === state);
  return index >= 0 ? index + 1 : null;
};

const InsightsSummary: React.FC<InsightsSummaryProps> = ({ selectedRegion = 'United States', context = 'home' }) => {
  const { benchmarks, benchmarkMap, isLive, generatedAt, sources } = useStateBenchmarks();
  const stateRows = benchmarks;
  const highestGini = [...stateRows].sort((a, b) => b.gini - a.gini)[0];
  const lowestPoverty = [...stateRows].sort((a, b) => a.poverty - b.poverty)[0];
  const highestIncome = [...stateRows].sort((a, b) => b.income - a.income)[0];
  const selectedData = benchmarkMap[selectedRegion];

  const selectedInsight = selectedData
    ? {
        icon: MapPinned,
        label: `${selectedRegion} snapshot`,
        text: `Ranks #${getRank(stateRows, selectedRegion, 'gini')} for Gini, #${getRank(stateRows, selectedRegion, 'poverty')} for poverty, and #${getRank(stateRows, selectedRegion, 'income')} for median income.`,
        accent: 'border-cyan-500 text-cyan-700 dark:text-cyan-300',
      }
    : {
        icon: Lightbulb,
        label: context === 'compare' ? 'Comparison lens' : 'National lens',
        text: 'Use the map, dashboard filters, or ranking table to move from national patterns into state-level detail.',
        accent: 'border-cyan-500 text-cyan-700 dark:text-cyan-300',
      };

  const insights = [
    selectedInsight,
    {
      icon: AlertTriangle,
      label: 'Highest inequality',
      text: `${highestGini.state} has the highest Gini index in the current state dataset at ${highestGini.gini.toFixed(3)}.`,
      accent: 'border-rose-500 text-rose-700 dark:text-rose-300',
    },
    {
      icon: TrendingUp,
      label: 'Income leader',
      text: `${highestIncome.state} leads median household income at ${formatIncome(highestIncome.income)}.`,
      accent: 'border-emerald-500 text-emerald-700 dark:text-emerald-300',
    },
    {
      icon: Lightbulb,
      label: 'Lower poverty benchmark',
      text: `${lowestPoverty.state} has the lowest poverty rate at ${lowestPoverty.poverty.toFixed(1)}%.`,
      accent: 'border-violet-500 text-violet-700 dark:text-violet-300',
    },
  ];

  return (
    <section className="surface mb-8 overflow-hidden">
      <div className="accent-strip" />
      <div className="p-5">
        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-cyan-700 dark:text-cyan-300">AI-Ready Takeaways</p>
            <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950 dark:text-white">Insight Summary</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <SourceBadge source={isLive ? 'Live ACS' : 'Fallback ACS'} year={sources.gini?.year ?? 'N/A'} tone="cyan" />
            <SourceBadge source={isLive ? 'Live SAIPE' : 'Fallback SAIPE'} year={sources.poverty?.year ?? 'N/A'} tone="amber" />
            {generatedAt && <SourceBadge source="Fetched" year={new Date(generatedAt).toLocaleDateString()} tone="slate" />}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {insights.map((insight) => {
            const Icon = insight.icon;
            return (
              <article key={insight.label} className={`metric-card border-l-4 ${insight.accent}`}>
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <Icon size={18} />
                </div>
                <p className="text-sm font-black text-slate-900 dark:text-white">{insight.label}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{insight.text}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default InsightsSummary;
