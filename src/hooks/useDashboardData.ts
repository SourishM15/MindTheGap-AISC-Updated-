import { useEffect, useMemo, useRef, useState } from 'react';
import { FilterState } from '../types';
import { DashboardRegionData, IncomeLorenzData, SAIPEData, VisualizationType, WealthDistributionData } from '../types/dashboard';
import { apiFetch, apiUrl } from '../utils/api';
import { getCanonicalRegion, getStateForRegion, isMetroRegion } from '../utils/dashboardRegions';

interface UseDashboardDataArgs {
  filters: FilterState;
  selectedRegion: string;
  visualizationType: VisualizationType;
}

const needsIncomeDistribution = (visualizationType: VisualizationType) => {
  return visualizationType === 'lorenz' || visualizationType === 'waffle' || visualizationType === 'stacked';
};

export function useDashboardData({ filters, selectedRegion, visualizationType }: UseDashboardDataArgs) {
  const canonicalRegion = useMemo(() => getCanonicalRegion(selectedRegion), [selectedRegion]);
  const isMetro = useMemo(() => isMetroRegion(selectedRegion, canonicalRegion), [selectedRegion, canonicalRegion]);

  const [regionData, setRegionData] = useState<DashboardRegionData | null>(null);
  const [wealthData, setWealthData] = useState<WealthDistributionData | null>(null);
  const [saipeData, setSaipeData] = useState<SAIPEData | null>(null);
  const [incomeDistData, setIncomeDistData] = useState<IncomeLorenzData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const incomeCacheRef = useRef<Record<string, IncomeLorenzData>>({});
  const incomeSeriesCacheRef = useRef<Record<string, Record<number, IncomeLorenzData>>>({});

  useEffect(() => {
    let cancelled = false;

    const fetchRegionData = async () => {
      setLoading(true);
      setError(null);
      setRegionData(null);
      setSaipeData(null);
      setIncomeDistData(null);

      try {
        const stateForRegion = getStateForRegion(selectedRegion, canonicalRegion);
        const enrichedEndpoint = isMetro
          ? `/api/enriched-metro/${encodeURIComponent(canonicalRegion)}`
          : `/api/enriched-state/${canonicalRegion}`;

        const [regionRes, wealthRes, saipeRes] = await Promise.all([
          apiFetch(enrichedEndpoint),
          apiFetch('/api/wealth-distribution'),
          apiFetch(`/api/saipe-state/${stateForRegion}`),
        ]);

        if (cancelled) return;

        if (regionRes.ok) {
          const data = await regionRes.json();
          if (cancelled) return;
          if (data.success && data.profile) {
            if (isMetro && data.metro) data.state = data.metro;
            setRegionData(data);
          }
        }

        if (wealthRes.ok) {
          const wData = await wealthRes.json();
          if (cancelled) return;
          if (wData.success) setWealthData(wData);
        }

        if (saipeRes.ok) {
          const sData = await saipeRes.json();
          if (cancelled) return;
          if (sData.success) setSaipeData(sData);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Error fetching data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRegionData();

    return () => { cancelled = true; };
  }, [selectedRegion, canonicalRegion, isMetro]);

  useEffect(() => {
    if (!needsIncomeDistribution(visualizationType)) return;
    if (visualizationType === 'stacked' && wealthData?.stacked_data?.length) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const requestedIncomeYearRaw =
          filters.timeframe === 'historical' || filters.timeframe === 'forecast'
            ? filters.yearRange[1]
            : null;
        const requestedIncomeYear = requestedIncomeYearRaw == null
          ? null
          : Math.max(1989, Math.min(2035, requestedIncomeYearRaw));

        const seriesKey = `${isMetro ? 'metro' : 'state'}:${canonicalRegion}`;
        if (requestedIncomeYear != null) {
          const yearlyCached = incomeSeriesCacheRef.current[seriesKey]?.[requestedIncomeYear];
          if (yearlyCached) {
            setIncomeDistData(yearlyCached);
            return;
          }
        }

        const stateForRegion = getStateForRegion(selectedRegion, canonicalRegion);
        const endpoint = isMetro
          ? apiUrl(`/api/income-lorenz-metro/${encodeURIComponent(canonicalRegion)}${requestedIncomeYear ? `?year=${requestedIncomeYear}` : ''}`)
          : apiUrl(`/api/income-lorenz/${stateForRegion}${requestedIncomeYear ? `?year=${requestedIncomeYear}` : ''}`);

        const cacheKey = `${isMetro ? 'metro' : 'state'}:${canonicalRegion}:${requestedIncomeYear ?? 'latest'}`;
        const cached = incomeCacheRef.current[cacheKey];
        if (cached) {
          setIncomeDistData(cached);
          return;
        }

        const incomeRes = await fetch(endpoint);
        if (cancelled) return;
        if (!incomeRes.ok) {
          setIncomeDistData(null);
          return;
        }
        const iData = await incomeRes.json();
        if (cancelled) return;

        if (iData.success && iData.data) {
          const normalized: IncomeLorenzData = {
            ...iData.data,
            state_specific: !!iData.state_specific,
            metro_specific: !!iData.metro_specific,
          };
          incomeCacheRef.current[cacheKey] = normalized;
          if (normalized.year) {
            if (!incomeSeriesCacheRef.current[seriesKey]) incomeSeriesCacheRef.current[seriesKey] = {};
            incomeSeriesCacheRef.current[seriesKey][normalized.year] = normalized;
          }
          setIncomeDistData(normalized);
        } else {
          setIncomeDistData(null);
        }
      } catch {
        setIncomeDistData(null);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selectedRegion, canonicalRegion, filters.timeframe, filters.yearRange[1], visualizationType, isMetro, wealthData]);

  const incomeSeriesByYear = incomeSeriesCacheRef.current[`${isMetro ? 'metro' : 'state'}:${canonicalRegion}`];

  return {
    canonicalRegion,
    isMetro,
    regionData,
    wealthData,
    saipeData,
    incomeDistData,
    incomeSeriesByYear,
    loading,
    error,
  };
}
