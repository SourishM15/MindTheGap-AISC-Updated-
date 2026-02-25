import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface LorenzCurveProps {
  incomeData: { bracket: string; percentage: number; cumulativePopulation: number; cumulativeWealth: number }[];
  title?: string;
}

/**
 * Lorenz Curve: Shows cumulative wealth vs cumulative population
 * - Diagonal line = perfect equality
 * - Curve below diagonal = actual inequality
 * - Gini coefficient = area between curve and diagonal / 0.5
 */
const LorenzCurve: React.FC<LorenzCurveProps> = ({ incomeData, title = 'Lorenz Curve - Income Inequality' }) => {
  // Calculate Gini coefficient
  const calculateGini = (): number => {
    if (incomeData.length === 0) return 0;
    
    let area = 0;
    for (let i = 0; i < incomeData.length - 1; i++) {
      const x1 = incomeData[i].cumulativePopulation / 100;
      const x2 = incomeData[i + 1].cumulativePopulation / 100;
      const y1 = incomeData[i].cumulativeWealth / 100;
      const y2 = incomeData[i + 1].cumulativeWealth / 100;
      
      // Trapezoid area under the curve
      area += ((x2 - x1) * (y1 + y2)) / 2;
    }
    
    // Gini = (0.5 - area) / 0.5
    const gini = (0.5 - area) / 0.5;
    return Math.min(1, Math.max(0, gini));
  };

  const gini = calculateGini();

  // Create perfect equality line (diagonal)
  const equalityLine = [
    { cumulativePopulation: 0, cumulativeWealth: 0, equality: 0 },
    { cumulativePopulation: 100, cumulativeWealth: 100, equality: 100 }
  ];

  const chartData = incomeData.map(d => ({
    ...d,
    equality: (d.cumulativePopulation * 100) / 100
  }));

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
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="cumulativePopulation" 
            label={{ value: 'Cumulative % of Population', position: 'insideBottomRight', offset: -10 }}
            stroke="#6b7280"
          />
          <YAxis 
            label={{ value: 'Cumulative % of Wealth', angle: -90, position: 'insideLeft' }}
            stroke="#6b7280"
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '6px',
              color: '#e5e7eb'
            }}
            formatter={(value) => value?.toFixed(1)}
          />
          <Legend />
          
          {/* Perfect Equality Line (Diagonal) */}
          <Line
            name="Perfect Equality"
            data={equalityLine}
            dataKey="equality"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
            strokeDasharray="5 5"
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
