import React, { useMemo } from 'react';

interface WaffleChartProps {
  data: {
    bracket: string;
    percentage: number;
    color: string;
  }[];
  title?: string;
  size?: number; // Grid size (default 10x10 = 100 squares)
}

/**
 * Waffle Chart: 100-square grid visualization of population distribution
 * - Each square = 1% of population
 * - Color = income bracket
 * - Size of colored area = percentage in that bracket
 * - Extremely intuitive for understanding inequality
 */
const WaffleChart: React.FC<WaffleChartProps> = ({ 
  data, 
  title = 'Income Distribution by Population',
  size = 10 
}) => {
  const gridSize = size * size;

  const sortedByShare = [...data].sort((a, b) => b.percentage - a.percentage);
  const largest = sortedByShare[0];
  const topTwoShare = sortedByShare.slice(0, 2).reduce((s, d) => s + d.percentage, 0);
  const concentrationIndex = sortedByShare.reduce((sum, d) => sum + Math.pow(d.percentage / 100, 2), 0);

  // Create grid of squares with distribution
  const waffleData = useMemo(() => {
    const squares: { bracket: string; color: string }[] = [];
    let remaining = data.map(d => ({ ...d }));
    
    for (let i = 0; i < gridSize; i++) {
      for (let bracket of remaining) {
        if (bracket.percentage > 0) {
          squares.push({ bracket: bracket.bracket, color: bracket.color });
          bracket.percentage -= (100 / gridSize);
          break;
        }
      }
    }
    
    return squares;
  }, [data, gridSize]);

  // Calculate what legend should show
  const legendData = data.filter(d => d.percentage > 0).map(d => ({
    bracket: d.bracket,
    color: d.color,
    percentage: (d.percentage * gridSize / 100).toFixed(1)
  }));

  const squareSize = 26;

  return (
    <div className="w-full h-full bg-gradient-to-br from-white to-slate-50 dark:from-gray-800 dark:to-slate-900 rounded-xl shadow-md p-6 border border-slate-200/80 dark:border-slate-700/60">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">{title}</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          <div className="p-3 rounded-lg bg-purple-50/90 dark:bg-purple-900/40 border border-purple-200/60 dark:border-purple-700/50">
            <p className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-300">Largest Bracket</p>
            <p className="text-lg font-bold text-purple-700 dark:text-purple-300">{largest ? largest.bracket : 'N/A'}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{largest ? `${largest.percentage.toFixed(1)}%` : ''}</p>
          </div>
          <div className="p-3 rounded-lg bg-cyan-50/90 dark:bg-cyan-900/40 border border-cyan-200/60 dark:border-cyan-700/50">
            <p className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-300">Top 2 Brackets</p>
            <p className="text-2xl font-bold text-cyan-700 dark:text-cyan-300">{topTwoShare.toFixed(1)}%</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Combined share of dominant groups</p>
          </div>
          <div className="p-3 rounded-lg bg-rose-50/90 dark:bg-rose-900/40 border border-rose-200/60 dark:border-rose-700/50">
            <p className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-300">Concentration Index</p>
            <p className="text-2xl font-bold text-rose-700 dark:text-rose-300">{concentrationIndex.toFixed(3)}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Higher = less evenly distributed</p>
          </div>
        </div>
        
        {/* Legend */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {legendData.map((item) => (
            <div key={item.bracket} className="flex items-center gap-2">
              <div
                className="rounded"
                style={{
                  width: '20px',
                  height: '20px',
                  backgroundColor: item.color,
                  border: '1px solid #d1d5db'
                }}
              />
              <div className="text-sm">
                <p className="font-semibold text-gray-800 dark:text-gray-200">{item.bracket}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{item.percentage} squares</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Waffle Grid */}
      <div className="flex justify-center mb-6">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${size}, ${squareSize}px)`,
            gridTemplateRows: `repeat(${size}, ${squareSize}px)`,
            gap: '2px',
            padding: '12px',
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            border: '2px solid #e5e7eb'
          }}
          className="dark:bg-gray-700 dark:border-gray-600"
        >
          {waffleData.map((square, idx) => (
            <div
              key={idx}
              title={`${square.bracket} - Square ${idx + 1}`}
              style={{
                width: `${squareSize}px`,
                height: `${squareSize}px`,
                backgroundColor: square.color,
                borderRadius: '2px',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                border: '1px solid rgba(255,255,255,0.3)',
                boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)'
              }}
              className="hover:scale-110 hover:shadow-lg"
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div className="p-3 bg-purple-50 dark:bg-purple-900 rounded border-l-4 border-purple-500">
          <p className="text-purple-800 dark:text-purple-200">
            <strong>Total Squares:</strong> {gridSize} (representing 100% of population)
          </p>
        </div>
        <div className="p-3 bg-emerald-50 dark:bg-emerald-900 rounded border-l-4 border-emerald-500">
          <p className="text-emerald-800 dark:text-emerald-200">
            <strong>Visual Power:</strong> See at a glance if one color dominates the waffle.
          </p>
        </div>
      </div>

      <div className="mt-4 p-3 bg-indigo-50 dark:bg-indigo-900 rounded border-l-4 border-indigo-500">
        <p className="text-sm text-indigo-800 dark:text-indigo-200">
          <strong>How to interpret:</strong> In a perfectly equal society, each color would take up roughly equal space. 
          If one color dominates (like top 10% in green taking 40+ squares), that shows high inequality. Hover over squares for details.
        </p>
      </div>
    </div>
  );
};

export default WaffleChart;
