import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface LorenzCurveProps {
  incomeData: { bracket: string; percentage: number; cumulativePopulation: number; cumulativeWealth: number }[];
  title?: string;
  giniCoefficient?: number; // Use pre-calculated Gini from backend (more accurate than recalculating from sparse points)
}

/**
 * Lorenz Curve: Shows cumulative wealth vs cumulative population
 * - Diagonal line = perfect equality
 * - Curve below diagonal = actual inequality
 * - Gini coefficient = area between curve and diagonal / 0.5
 */
const LorenzCurve: React.FC<LorenzCurveProps> = ({ incomeData, title = 'Lorenz Curve - Income Inequality', giniCoefficient }) => {
  // Use backend-provided Gini (accurate) or fall back to trapezoidal approximation
  const calculateGini = (): number => {
    if (incomeData.length === 0) return 0;
    let area = 0;
    for (let i = 0; i < incomeData.length - 1; i++) {
      const x1 = incomeData[i].cumulativePopulation / 100;
      const x2 = incomeData[i + 1].cumulativePopulation / 100;
      const y1 = incomeData[i].cumulativeWealth / 100;
      const y2 = incomeData[i + 1].cumulativeWealth / 100;
      area += ((x2 - x1) * (y1 + y2)) / 2;
    }
    return Math.min(1, Math.max(0, (0.5 - area) / 0.5));
  };

  const gini = giniCoefficient ?? calculateGini();

  // Interpolate sparse data points into a smooth 101-point curve
  const interpolateLorenz = () => {
    if (incomeData.length < 2) return incomeData;
    const sorted = [...incomeData].sort((a, b) => a.cumulativePopulation - b.cumulativePopulation);
    const result = [];
    for (let pop = 0; pop <= 100; pop++) {
      // Find surrounding control points
      let lo = sorted[0], hi = sorted[sorted.length - 1];
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].cumulativePopulation <= pop && sorted[i + 1].cumulativePopulation >= pop) {
          lo = sorted[i]; hi = sorted[i + 1]; break;
        }
      }
      const range = hi.cumulativePopulation - lo.cumulativePopulation;
      const t = range === 0 ? 0 : (pop - lo.cumulativePopulation) / range;
      result.push({
        cumulativePopulation: pop,
        cumulativeWealth: parseFloat((lo.cumulativeWealth + t * (hi.cumulativeWealth - lo.cumulativeWealth)).toFixed(2)),
        equality: pop,
        bracket: '',
      });
    }
    return result;
  };

  const chartData = interpolateLorenz();

  const giniInterpretation = 
    gini < 0.3 ? 'Low inequality - relatively equal distribution' :
    gini < 0.4 ? 'Moderate inequality' :
    gini < 0.5 ? 'High inequality' :
    'Very high inequality - concentrated wealth';

  return (
    <div className="w-full h-full bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">{title}</h3>
        <div className="flex items-center gap-6">
          <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded">
            <p className="text-sm text-gray-600 dark:text-gray-400">Gini Coefficient</p>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{gini.toFixed(3)}</p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{giniInterpretation}</p>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p><strong>Gini Scale:</strong> 0 (perfect equality) to 1 (complete inequality)</p>
            <p className="mt-2"><strong>How to read:</strong> Points below the diagonal line indicate inequality. The farther below, the greater the inequality.</p>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="cumulativePopulation"
            type="number"
            domain={[0, 100]}
            tickCount={6}
            label={{ value: 'Cumulative % of Population', position: 'insideBottom', offset: -10, fill: '#9ca3af' }}
            stroke="#6b7280"
          />
          <YAxis
            domain={[0, 100]}
            tickCount={6}
            label={{ value: 'Cumulative % of Wealth', angle: -90, position: 'insideLeft', offset: -5, fill: '#9ca3af' }}
            stroke="#6b7280"
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#e5e7eb' }}
            formatter={(value: number) => [`${value.toFixed(1)}%`]}
            labelFormatter={(label) => `Population: ${label}%`}
          />
          <Legend verticalAlign="bottom" height={36} />

          {/* Perfect Equality Line */}
          <Line
            name="Perfect Equality"
            dataKey="equality"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
            strokeDasharray="5 5"
            isAnimationActive={false}
          />

          {/* Actual Lorenz Curve */}
          <Line
            name="Actual Distribution"
            dataKey="cumulativeWealth"
            stroke="#3b82f6"
            strokeWidth={3}
            dot={false}
            isAnimationActive={true}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 p-3 bg-indigo-50 dark:bg-indigo-900 rounded border-l-4 border-indigo-500">
        <p className="text-sm text-indigo-800 dark:text-indigo-200">
          <strong>What this shows:</strong> The blue curve represents the actual wealth distribution. 
          If it's close to the green diagonal line, wealth is distributed equally. The farther it dips below, the more concentrated wealth is among the richest.
        </p>
      </div>
    </div>
  );
};

export default LorenzCurve;
