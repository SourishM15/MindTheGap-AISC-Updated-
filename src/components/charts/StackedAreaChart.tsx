import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface StackedAreaChartProps {
  data: {
    year: number;
    [decile: string]: number | string;
  }[];
  title?: string;
  deciles?: string[];
}

// Labels match the 6 brackets produced by the backend /api/wealth-distribution
const DECILE_COLORS = {
  'Bottom 20%': '#ef4444',
  '20-40%':     '#f97316',
  '40-60%':     '#eab308',
  '60-80%':     '#22c55e',
  '80-99%':     '#0ea5e9',
  'Top 1%':     '#3b82f6',
};

/**
 * Stacked Area Chart: Shows income distribution changes over time
 * - Each colored area represents a decile (10% of population)
 * - Height shows share of total income
 * - Reveals trends in wealth gap widening/narrowing
 */
const StackedAreaChart: React.FC<StackedAreaChartProps> = ({ 
  data, 
  title = 'Wealth Distribution by Income Decile Over Time',
  deciles = Object.keys(DECILE_COLORS)
}) => {
  const [hiddenDeciles, setHiddenDeciles] = useState<Set<string>>(new Set());

  const latest = data.length ? data[data.length - 1] : null;
  const first = data.length ? data[0] : null;
  const latestTop1 = latest && typeof latest['Top 1%'] === 'number' ? latest['Top 1%'] : null;
  const latestBottom20 = latest && typeof latest['Bottom 20%'] === 'number' ? latest['Bottom 20%'] : null;
  const concentrationRatio = latestTop1 != null && latestBottom20 != null && latestBottom20 > 0
    ? latestTop1 / latestBottom20
    : null;
  const topBandLatest = latest && typeof latest['80-99%'] === 'number' && latestTop1 != null
    ? latest['80-99%'] + latestTop1
    : null;

  const toggleDecile = (decile: string) => {
    const newHidden = new Set(hiddenDeciles);
    if (newHidden.has(decile)) {
      newHidden.delete(decile);
    } else {
      newHidden.add(decile);
    }
    setHiddenDeciles(newHidden);
  };

  // Calculate change from first to last year
  const calculateChange = (decile: string): number | null => {
    if (data.length < 2) return null;
    const first = data[0][decile] as number;
    const last = data[data.length - 1][decile] as number;
    if (typeof first !== 'number' || typeof last !== 'number') return null;
    return ((last - first) / first) * 100;
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-white to-slate-50 dark:from-gray-800 dark:to-slate-900 rounded-xl shadow-md p-6 border border-slate-200/80 dark:border-slate-700/60">
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">{title}</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="p-3 rounded-lg bg-blue-50/90 dark:bg-blue-900/40 border border-blue-200/60 dark:border-blue-700/50">
            <p className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-300">Latest Year</p>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{latest ? latest.year : 'N/A'}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{data.length > 3 ? 'Trend series' : 'Snapshot view'}</p>
          </div>
          <div className="p-3 rounded-lg bg-amber-50/90 dark:bg-amber-900/40 border border-amber-200/60 dark:border-amber-700/50">
            <p className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-300">Top 20% Share</p>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{topBandLatest != null ? `${topBandLatest.toFixed(1)}%` : 'N/A'}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">80-99% + Top 1%</p>
          </div>
          <div className="p-3 rounded-lg bg-rose-50/90 dark:bg-rose-900/40 border border-rose-200/60 dark:border-rose-700/50">
            <p className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-300">Top1 / Bottom20 Ratio</p>
            <p className="text-2xl font-bold text-rose-700 dark:text-rose-300">{concentrationRatio != null ? `${concentrationRatio.toFixed(1)}x` : 'N/A'}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Higher means more concentration</p>
          </div>
        </div>
        
        {/* Decile Legend with Toggle */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
          {deciles.map((decile) => {
            const change = calculateChange(decile);
            const isHidden = hiddenDeciles.has(decile);
            
            return (
              <button
                key={decile}
                onClick={() => toggleDecile(decile)}
                className={`p-2 rounded border-2 transition-all text-sm ${
                  isHidden
                    ? 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 opacity-50'
                    : 'border-opacity-100 bg-opacity-100'
                }`}
                style={{
                  borderColor: DECILE_COLORS[decile as keyof typeof DECILE_COLORS],
                  backgroundColor: isHidden 
                    ? '#f3f4f6' 
                    : DECILE_COLORS[decile as keyof typeof DECILE_COLORS] + '20'
                }}
              >
                <div className="font-semibold text-gray-800 dark:text-gray-200">{decile}</div>
                {change !== null && (
                  <div className={`text-xs ${change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {change > 0 ? '+' : ''}{change.toFixed(1)}%
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="#94a3b8" opacity={0.35} />
          <XAxis 
            dataKey="year" 
            stroke="#6b7280"
            label={{ value: 'Year', position: 'insideBottomRight', offset: -10 }}
          />
          <YAxis 
            stroke="#6b7280"
            label={{ value: '% of Total Income', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '6px',
              color: '#e5e7eb'
            }}
            formatter={(value) => typeof value === 'number' ? value.toFixed(1) + '%' : value}
            labelFormatter={(value) => `Year: ${value}`}
          />
          
          {/* Render areas for each non-hidden decile */}
          {deciles.map((decile) => {
            if (hiddenDeciles.has(decile)) return null;
            
            return (
              <Area
                key={decile}
                type="monotone"
                dataKey={decile}
                stackId="1"
                stroke={DECILE_COLORS[decile as keyof typeof DECILE_COLORS]}
                fill={DECILE_COLORS[decile as keyof typeof DECILE_COLORS]}
                fillOpacity={0.82}
                name={decile}
                activeDot={{ r: 4 }}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>

      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900 rounded border-l-4 border-blue-500">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>How to read:</strong> Each colored area represents one income decile. Higher areas = larger share of total income. 
          Click deciles to hide/show them. Watch for areas expanding (inequality) or contracting (equality).
        </p>
      </div>
    </div>
  );
};

export default StackedAreaChart;
