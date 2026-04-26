import { useEffect, useState } from 'react';
import { STATE_DATA } from '../components/Map';

export interface StateBenchmark {
  state: string;
  gini: number;
  poverty: number;
  income: number;
  sources?: {
    gini?: { source: string; year: number | string };
    poverty?: { source: string; year: number | string };
    income?: { source: string; year: number | string };
  };
}

export type StateBenchmarkMap = Record<string, { gini: number; poverty: number; income: number }>;
export type BenchmarkSources = {
  gini?: { source: string; year?: number | string | null; status?: string };
  poverty?: { source: string; year?: number | string | null; status?: string };
  income?: { source: string; year?: number | string | null; status?: string };
};

const fallbackBenchmarks = Object.entries(STATE_DATA).map(([state, values]) => ({
  state,
  ...values,
  sources: {
    gini: { source: 'Census ACS', year: 2022 },
    poverty: { source: 'Census SAIPE', year: 2023 },
    income: { source: 'Census SAIPE', year: 2023 },
  },
}));

const fallbackSources: BenchmarkSources = {
  gini: { source: 'Census ACS', year: 2022, status: 'fallback' },
  poverty: { source: 'Census SAIPE', year: 2023, status: 'fallback' },
  income: { source: 'Census SAIPE', year: 2023, status: 'fallback' },
};

const toMap = (rows: StateBenchmark[]): StateBenchmarkMap => {
  return rows.reduce<StateBenchmarkMap>((acc, row) => {
    acc[row.state] = {
      gini: row.gini,
      poverty: row.poverty,
      income: row.income,
    };
    return acc;
  }, {});
};

export const useStateBenchmarks = () => {
  const [benchmarks, setBenchmarks] = useState<StateBenchmark[]>(fallbackBenchmarks);
  const [benchmarkMap, setBenchmarkMap] = useState<StateBenchmarkMap>(() => toMap(fallbackBenchmarks));
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [sources, setSources] = useState<BenchmarkSources>(fallbackSources);

  useEffect(() => {
    let cancelled = false;

    const loadBenchmarks = async () => {
      setLoading(true);
      try {
        const response = await fetch('http://localhost:8000/api/state-benchmarks');
        if (!response.ok) throw new Error('Benchmark request failed');
        const payload = await response.json();
        if (cancelled) return;

        const fallbackByState = toMap(fallbackBenchmarks);
        const rows = (payload.benchmarks || [])
          .filter((row: any) => row.state)
          .map((row: any) => ({
            state: row.state,
            gini: row.gini != null ? Number(row.gini) : fallbackByState[row.state]?.gini,
            poverty: row.poverty != null ? Number(row.poverty) : fallbackByState[row.state]?.poverty,
            income: row.income != null ? Number(row.income) : fallbackByState[row.state]?.income,
            sources: row.sources,
          }))
          .filter((row: StateBenchmark) => row.gini != null && row.poverty != null && row.income != null);

        if (payload.success && rows.length) {
          setBenchmarks(rows);
          setBenchmarkMap(toMap(rows));
          setIsLive(true);
          setGeneratedAt(payload.generated_at || null);
          setSources(payload.sources || fallbackSources);
        } else {
          setIsLive(false);
        }
      } catch {
        if (!cancelled) setIsLive(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadBenchmarks();
    return () => {
      cancelled = true;
    };
  }, []);

  return { benchmarks, benchmarkMap, loading, isLive, generatedAt, sources };
};
