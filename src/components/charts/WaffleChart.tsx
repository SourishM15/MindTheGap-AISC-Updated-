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

  const squareSize = 30;

  return (
    <div className="w-full h-full bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">{title}</h3>
        
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
                border: '1px solid rgba(255,255,255,0.3)'
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
