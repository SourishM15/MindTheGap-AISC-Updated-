import React from 'react';
import { Database } from 'lucide-react';

interface SourceBadgeProps {
  source: string;
  year?: string | number;
  tone?: 'cyan' | 'amber' | 'violet' | 'slate';
}

const toneClasses = {
  cyan: 'border-cyan-200 bg-white text-cyan-800 dark:border-cyan-900 dark:bg-slate-950/35 dark:text-cyan-200',
  amber: 'border-amber-200 bg-white text-amber-800 dark:border-amber-900 dark:bg-slate-950/35 dark:text-amber-200',
  violet: 'border-violet-200 bg-white text-violet-800 dark:border-violet-900 dark:bg-slate-950/35 dark:text-violet-200',
  slate: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300',
};

const SourceBadge: React.FC<SourceBadgeProps> = ({ source, year, tone = 'slate' }) => {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-bold ${toneClasses[tone]}`}>
      <Database size={12} />
      {source}{year ? ` ${year}` : ''}
    </span>
  );
};

export default SourceBadge;
