import React from 'react';
import { Info } from 'lucide-react';

interface MetricTooltipProps {
  label: string;
  description: string;
}

const MetricTooltip: React.FC<MetricTooltipProps> = ({ label, description }) => {
  return (
    <span className="group relative inline-flex">
      <span
        className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-cyan-700 dark:hover:bg-slate-800 dark:hover:text-cyan-300"
        role="img"
        aria-label={`What is ${label}?`}
      >
        <Info size={14} />
      </span>
      <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-64 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-3 text-left text-xs font-medium leading-5 text-slate-600 opacity-0 shadow-xl shadow-slate-200/80 transition-opacity group-hover:opacity-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:shadow-black/30">
        <span className="mb-1 block font-black text-slate-950 dark:text-white">{label}</span>
        {description}
      </span>
    </span>
  );
};

export default MetricTooltip;
