import {
  DashboardRegionData,
  IncomeLorenzData,
  StackedDistributionRow,
  WealthDistributionData,
} from '../types/dashboard';

export function generateLorenzData(
  _regionData: DashboardRegionData | null,
  wealthData: WealthDistributionData | null,
  incomeDistData: IncomeLorenzData | null = null
) {
  if (incomeDistData?.lorenz_data?.length) return incomeDistData.lorenz_data;
  if (wealthData?.lorenz_data?.length) return wealthData.lorenz_data;

  return [
    { bracket: 'Origin', percentage: 0, cumulativePopulation: 0, cumulativeWealth: 0 },
    { bracket: 'Bottom 50%', percentage: 2.5, cumulativePopulation: 50, cumulativeWealth: 2.5 },
    { bracket: 'Next 40%', percentage: 30.1, cumulativePopulation: 90, cumulativeWealth: 32.6 },
    { bracket: 'Next 9%', percentage: 36.4, cumulativePopulation: 99, cumulativeWealth: 69.0 },
    { bracket: 'Top 1-0.1%', percentage: 17.1, cumulativePopulation: 99.9, cumulativeWealth: 86.1 },
    { bracket: 'Top 0.1%', percentage: 13.9, cumulativePopulation: 100, cumulativeWealth: 100 },
  ];
}

const emptyIncomeBuckets = () => ({
  'Bottom 20%': 0,
  '20-40%': 0,
  '40-60%': 0,
  '60-80%': 0,
  '80-99%': 0,
  'Top 1%': 0,
});

const addWaffleDataToBuckets = (
  waffleData: IncomeLorenzData['waffle_data'],
  bucketMap: Record<string, number>
) => {
  for (const b of waffleData ?? []) {
    if (b.bracket === 'Bottom 20%') bucketMap['Bottom 20%'] += b.percentage;
    else if (b.bracket === '20-40%' || b.bracket === '20–40%') bucketMap['20-40%'] += b.percentage;
    else if (b.bracket === '40-60%' || b.bracket === '40–60%') bucketMap['40-60%'] += b.percentage;
    else if (b.bracket === '60-80%' || b.bracket === '60–80%') bucketMap['60-80%'] += b.percentage;
    else if (b.bracket === '80-95%' || b.bracket === '80–95%') bucketMap['80-99%'] += b.percentage;
    else if (b.bracket === 'Top 5%') bucketMap['Top 1%'] += b.percentage;
  }
};

const bucketsToStackedRow = (year: number, bucketMap: Record<string, number>): StackedDistributionRow => ({
  year,
  'Bottom 20%': Number(bucketMap['Bottom 20%'].toFixed(2)),
  '20-40%': Number(bucketMap['20-40%'].toFixed(2)),
  '40-60%': Number(bucketMap['40-60%'].toFixed(2)),
  '60-80%': Number(bucketMap['60-80%'].toFixed(2)),
  '80-99%': Number(bucketMap['80-99%'].toFixed(2)),
  'Top 1%': Number(bucketMap['Top 1%'].toFixed(2)),
});

export function generateStackedAreaData(
  _regionData: DashboardRegionData | null,
  wealthData: WealthDistributionData | null,
  incomeDistData: IncomeLorenzData | null = null,
  incomeSeriesByYear?: Record<number, IncomeLorenzData>
): StackedDistributionRow[] {
  if (incomeSeriesByYear && Object.keys(incomeSeriesByYear).length > 0) {
    const sortedYears = Object.keys(incomeSeriesByYear)
      .map((y) => Number(y))
      .filter((y) => Number.isFinite(y))
      .sort((a, b) => a - b);

    const rows = sortedYears.map((year) => {
      const bucketMap = emptyIncomeBuckets();
      addWaffleDataToBuckets(incomeSeriesByYear[year].waffle_data, bucketMap);
      return bucketsToStackedRow(year, bucketMap);
    });

    if (rows.length >= 2) return rows;
  }

  if (incomeDistData?.waffle_data?.length && incomeDistData?.year) {
    const bucketMap = emptyIncomeBuckets();
    addWaffleDataToBuckets(incomeDistData.waffle_data, bucketMap);
    const snapshotRow = bucketsToStackedRow(incomeDistData.year, bucketMap);

    return [
      { ...snapshotRow, year: incomeDistData.year - 1 },
      snapshotRow,
      { ...snapshotRow, year: incomeDistData.year + 1 },
    ];
  }

  if (wealthData?.stacked_data?.length) return wealthData.stacked_data as StackedDistributionRow[];

  const years = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023];
  return years.map(year => ({
    year,
    'Bottom 20%': 3 + Math.random() * 0.3,
    '20-40%': 7 + Math.random() * 0.3,
    '40-60%': 12 + Math.random() * 0.3,
    '60-80%': 18 + Math.random() * 0.3,
    '80-99%': 40 + Math.random() * 0.5,
    'Top 1%': 17 + Math.random() * 0.5,
  }));
}

export function applyTimeframeToStackedData(
  data: StackedDistributionRow[],
  timeframe: 'current' | 'historical' | 'forecast',
  yearRange: [number, number]
): StackedDistributionRow[] {
  if (!data.length) return data;

  if (timeframe === 'current') return data.length > 8 ? data.slice(-8) : data;

  if (timeframe === 'historical') {
    return data.filter(d => d.year >= yearRange[0] && d.year <= yearRange[1] && d.year <= 2023);
  }

  const observed = [...data].filter(d => d.year <= 2025).sort((a, b) => a.year - b.year);
  const base = observed.length ? observed : [...data].sort((a, b) => a.year - b.year);
  const last = base[base.length - 1];
  const first = base[Math.max(0, base.length - 5)];
  const keys = Object.keys(last).filter(k => k !== 'year');
  const deltaYears = Math.max(1, Number(last.year) - Number(first.year));

  const slopes: Record<string, number> = {};
  keys.forEach((k) => {
    const a = Number(first[k] ?? 0);
    const b = Number(last[k] ?? 0);
    slopes[k] = (b - a) / deltaYears;
  });

  const projected: StackedDistributionRow[] = [];
  for (let year = yearRange[0]; year <= yearRange[1]; year++) {
    const row: StackedDistributionRow = { year };
    keys.forEach((k) => {
      const yearsForward = year - Number(last.year);
      const value = Number(last[k] ?? 0) + slopes[k] * yearsForward;
      row[k] = Math.max(0, Number(value.toFixed(2)));
    });

    const sum = keys.reduce((s, k) => s + Number(row[k] ?? 0), 0) || 1;
    keys.forEach((k) => {
      row[k] = Number(((Number(row[k] ?? 0) / sum) * 100).toFixed(2));
    });

    projected.push(row);
  }

  return projected.length ? projected : data;
}

export function generateWaffleData(
  _regionData: DashboardRegionData | null,
  wealthData: WealthDistributionData | null,
  incomeDistData: IncomeLorenzData | null = null
) {
  if (incomeDistData?.waffle_data?.length) return incomeDistData.waffle_data;
  if (wealthData?.waffle_data?.length) return wealthData.waffle_data;

  return [
    { bracket: 'Bottom 20%', percentage: 3, color: '#ef4444' },
    { bracket: '20-40%', percentage: 7, color: '#f97316' },
    { bracket: '40-60%', percentage: 12, color: '#eab308' },
    { bracket: '60-80%', percentage: 18, color: '#22c55e' },
    { bracket: '80-99%', percentage: 43, color: '#0ea5e9' },
    { bracket: 'Top 1%', percentage: 17, color: '#3b82f6' },
  ];
}
