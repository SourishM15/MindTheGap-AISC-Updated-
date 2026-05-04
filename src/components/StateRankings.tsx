import React, { useMemo, useState } from 'react';
import { ArrowDownUp, BarChart3, ExternalLink, GitCompare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MetricTooltip from './MetricTooltip';
import SourceBadge from './SourceBadge';
import { useStateBenchmarks } from '../hooks/useStateBenchmarks';

type RankingMetric = 'gini' | 'poverty' | 'income';

const metricLabels: Record<RankingMetric, string> = {
  gini: 'Gini Index',
  poverty: 'Poverty Rate',
  income: 'Median Income',
};

const metricHelp: Record<RankingMetric, string> = {
  gini: 'Higher values indicate more income inequality.',
  poverty: 'Higher values indicate a larger share below poverty.',
  income: 'Higher values indicate higher median household income.',
};

const formatMetric = (metric: RankingMetric, value: number) => {
  if (metric === 'gini') return value.toFixed(3);
  if (metric === 'poverty') return `${value.toFixed(1)}%`;
  return `$${Math.round(value / 1000)}K`;
};

const StateRankings: React.FC = () => {
  const navigate = useNavigate();
  const { benchmarks, loading, isLive, generatedAt, sources } = useStateBenchmarks();
  const [metric, setMetric] = useState<RankingMetric>('gini');
  const [direction, setDirection] = useState<'desc' | 'asc'>('desc');

  const rows = useMemo(() => {
    return [...benchmarks].sort((a, b) => direction === 'desc' ? b[metric] - a[metric] : a[metric] - b[metric]);
  }, [benchmarks, metric, direction]);

  const openDashboard = (state: string) => {
    navigate(`/dashboard?region=${encodeURIComponent(state)}`);
  };

  const compareState = (state: string) => {
    navigate(`/compare?state=${encodeURIComponent(state)}`);
  };

  return (
    <section className="surface overflow-hidden">
      <div className="accent-strip" />
      <div className="p-5">
        <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Sortable National Rankings</p>
            <div className="mt-1 flex items-center gap-2">
              <h3 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">All-State Ranking Table</h3>
              <MetricTooltip label="Ranking Table" description="Sort states by the selected metric. Use the action buttons to open the state in Dashboard or Compare." />
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Sort every state by inequality, poverty, or income, then jump directly into the dashboard or comparison workflow.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <SourceBadge source={isLive ? 'Live ACS' : 'Fallback ACS'} year={sources.gini?.year ?? 'N/A'} tone="cyan" />
              <SourceBadge source={isLive ? 'Live SAIPE' : 'Fallback SAIPE'} year={sources.poverty?.year ?? 'N/A'} tone="amber" />
              {generatedAt && <SourceBadge source="Fetched" year={new Date(generatedAt).toLocaleDateString()} tone="slate" />}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['gini', 'poverty', 'income'] as RankingMetric[]).map((option) => (
              <button
                key={option}
                onClick={() => setMetric(option)}
                className={`control-button ${metric === option ? 'control-button-active' : 'control-button-idle'}`}
              >
                {metricLabels[option]}
              </button>
            ))}
            <button
              onClick={() => setDirection((current) => current === 'desc' ? 'asc' : 'desc')}
              className="control-button control-button-idle inline-flex items-center gap-2"
            >
              <ArrowDownUp size={16} />
              {direction === 'desc' ? 'High to Low' : 'Low to High'}
            </button>
          </div>
        </div>

        <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-950/35 dark:text-slate-300">
          {metricHelp[metric]}
        </div>

        {loading && (
          <div className="mb-3 rounded-lg border border-cyan-200 bg-white px-4 py-3 text-sm font-medium text-cyan-800 dark:border-cyan-900 dark:bg-slate-950/35 dark:text-cyan-200">
            Refreshing current benchmark data...
          </div>
        )}

        <div className="max-h-[520px] overflow-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/30">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100/95 text-left text-xs uppercase tracking-wide text-slate-500 backdrop-blur dark:bg-slate-900/95 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3 text-right">{metricLabels[metric]}</th>
                <th className="px-4 py-3 text-right">Gini</th>
                <th className="px-4 py-3 text-right">Poverty</th>
                <th className="px-4 py-3 text-right">Income</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {rows.map((row, index) => (
                <tr key={row.state} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/70">
                  <td className="px-4 py-3 font-black text-slate-500 dark:text-slate-400">#{index + 1}</td>
                  <td className="px-4 py-3 font-bold text-slate-950 dark:text-white">{row.state}</td>
                  <td className="px-4 py-3 text-right text-lg font-black text-cyan-700 dark:text-cyan-300">
                    {formatMetric(metric, row[metric])}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{row.gini.toFixed(3)}</td>
                  <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{row.poverty.toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">${Math.round(row.income / 1000)}K</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openDashboard(row.state)}
                        className="rounded-md p-2 text-cyan-700 transition-colors hover:bg-cyan-100 dark:text-cyan-300 dark:hover:bg-cyan-950/60"
                        title={`Open ${row.state} in Dashboard`}
                      >
                        <ExternalLink size={16} />
                      </button>
                      <button
                        onClick={() => compareState(row.state)}
                        className="rounded-md p-2 text-violet-700 transition-colors hover:bg-violet-100 dark:text-violet-300 dark:hover:bg-violet-950/60"
                        title={`Compare ${row.state}`}
                      >
                        <GitCompare size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          <BarChart3 size={14} />
          Gini values are ACS 2022; poverty and income values use SAIPE 2023 estimates from the current app dataset.
        </div>
      </div>
    </section>
  );
};

export default StateRankings;
