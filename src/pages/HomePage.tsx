import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ChatInterface from '../components/ChatInterface';
import { usMetrics } from '../data/inequalityData';
import Map from '../components/Map';
import { getStateColors } from '../data/stateColors';
import { generateMetricsFromStateData, EnrichedStateData } from '../utils/metricGenerator';
import { InequalityMetric } from '../types';
import InsightsSummary from '../components/InsightsSummary';
import LoadingSkeleton from '../components/LoadingSkeleton';
import MetricTooltip from '../components/MetricTooltip';
import SourceBadge from '../components/SourceBadge';
import { ArrowLeft, GitCompare, LayoutDashboard, MapPinned, Sparkles, TrendingUp } from 'lucide-react';
import { useStateBenchmarks } from '../hooks/useStateBenchmarks';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedState, setSelectedState] = useState<string>('United States');
  const [metrics, setMetrics] = useState<InequalityMetric[]>(usMetrics);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const { benchmarkMap, isLive, generatedAt, sources } = useStateBenchmarks();

  // Detect dark mode
  useEffect(() => {
    const syncDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    syncDarkMode();

    const observer = new MutationObserver(syncDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('storage', syncDarkMode);

    return () => {
      observer.disconnect();
      window.removeEventListener('storage', syncDarkMode);
    };
  }, []);

  // Fetch state data from backend when state changes
  useEffect(() => {
    if (selectedState === 'United States') {
      setMetrics(usMetrics);
      setError(null);
    } else {
      fetchStateMetrics(selectedState);
    }
  }, [selectedState]);

  const fetchStateMetrics = async (stateName: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`http://localhost:8000/api/enriched-state/${stateName}`);
      if (!response.ok) {
        throw new Error(`Failed to load data for ${stateName}`);
      }
      const data: EnrichedStateData = await response.json();
      
      // Generate metrics from the enriched state data
      const generatedMetrics = generateMetricsFromStateData(data);
      setMetrics(generatedMetrics);
    } catch (err) {
      console.error('Error loading state metrics:', err);
      setError(`Could not load data for ${stateName}`);
      // Fallback to US metrics
      setMetrics(usMetrics);
    } finally {
      setLoading(false);
    }
  };

  const handleStateClick = (geo: { properties: { name: string } }) => {
    const stateName = geo.properties.name;
    setSelectedState(stateName);
  };

  const handleShowNationalMap = () => {
    setSelectedState('United States');
  };

  const openSelectedInDashboard = () => {
    navigate(`/dashboard?region=${encodeURIComponent(selectedState)}`);
  };

  const compareSelectedState = () => {
    if (selectedState === 'United States') {
      navigate('/compare');
      return;
    }
    navigate(`/compare?state=${encodeURIComponent(selectedState)}`);
  };

  const getQuickStats = () => {
    return {
      gini: metrics.find(m => m.id === 'gini')?.currentValue.toFixed(2),
      poverty: metrics.find(m => m.id === 'poverty-rate')?.currentValue.toFixed(1),
      wealth: metrics.find(m => m.id === 'wealth-top1')?.currentValue.toFixed(1)
    };
  };

  const stats = getQuickStats();
  const stateColors = getStateColors(selectedState);

  return (
    <main className="container mx-auto px-6 py-8">
      <section className="data-hero mb-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
          <div className="hero-eyebrow mb-4">
            <Sparkles size={14} />
            National Inequality Atlas
          </div>
          <h2 className="max-w-4xl text-4xl font-black text-white md:text-6xl">
            See where income, wealth, and opportunity diverge across the U.S.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
            Explore state-level patterns, then ask the assistant to explain what changed and where policy could matter most.
          </p>
          <div className="signal-ribbon max-w-3xl">
            <div className="signal-pill">
              <p className="signal-pill-label">Data coverage</p>
              <p className="signal-pill-value">ACS + SAIPE + DFA</p>
            </div>
            <div className="signal-pill">
              <p className="signal-pill-label">Analysis lens</p>
              <p className="signal-pill-value">Income, wealth, mobility</p>
            </div>
            <div className="signal-pill">
              <p className="signal-pill-label">AI layer</p>
              <p className="signal-pill-value">Policy signal extraction</p>
            </div>
          </div>
        </div>
          <div className="terminal-card">
            <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <MapPinned className="h-5 w-5 text-cyan-300" />
                <p className="text-sm font-black">Live Region Signal</p>
              </div>
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.9)]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="hero-stat col-span-2">
                <p className="hero-stat-label">Active region</p>
                <p className="hero-stat-value">{selectedState}</p>
                <p className="mt-1 text-xs font-medium text-slate-400">
                  {isLive ? 'Current data' : 'Fallback data'}{generatedAt ? ` · ${new Date(generatedAt).toLocaleDateString()}` : ''}
                </p>
              </div>
              <div className="hero-stat">
                <p className="hero-stat-label">Gini</p>
                <p className="hero-stat-value">{stats.gini ?? 'N/A'}</p>
              </div>
              <div className="hero-stat">
                <p className="hero-stat-label">Poverty</p>
                <p className="hero-stat-value">{stats.poverty ? `${stats.poverty}%` : 'N/A'}</p>
              </div>
              <div className="hero-stat col-span-2">
                <p className="hero-stat-label">Top 1% wealth share</p>
                <p className="hero-stat-value">{stats.wealth ? `${stats.wealth}%` : 'N/A'}</p>
              </div>
            </div>
            <div className="distribution-ladder">
              <div className="distribution-row">
                <span className="distribution-label">Bottom</span>
                <div className="distribution-track"><div className="distribution-fill" style={{ width: '18%' }} /></div>
                <span className="distribution-value">20%</span>
              </div>
              <div className="distribution-row">
                <span className="distribution-label">Middle</span>
                <div className="distribution-track"><div className="distribution-fill" style={{ width: '44%' }} /></div>
                <span className="distribution-value">50%</span>
              </div>
              <div className="distribution-row">
                <span className="distribution-label">Top</span>
                <div className="distribution-track"><div className="distribution-fill" style={{ width: '88%' }} /></div>
                <span className="distribution-value">1%</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <InsightsSummary selectedRegion={selectedState} context="home" />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Sidebar with chat */}
        <div className="lg:col-span-3">
          <div className="sticky top-24">
            <ChatInterface onChatQuery={() => {}} />
          </div>
        </div>
        
        {/* Main content area */}
        <div className="lg:col-span-9">
          {error && (
            <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-800 dark:text-red-200 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}
          
          <div className="surface mb-8 overflow-hidden">
            <div className="accent-strip" />
            <div
              style={{
                backgroundColor: isDarkMode ? stateColors.bgDark : stateColors.bgLight,
                borderColor: stateColors.borderColor,
              }}
              className="border-b p-6"
            >
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <p style={{ color: isDarkMode ? stateColors.accentDark : stateColors.accentLight }} className="mb-2 text-xs font-bold uppercase tracking-wide">
                  Interactive Overview
                </p>
                <h2 style={{ color: isDarkMode ? stateColors.textDark : stateColors.textLight }} className="text-2xl font-black tracking-tight md:text-3xl">
                  {loading ? `Loading ${selectedState} data...` : `${selectedState} Inequality Overview`}
                </h2>
              </div>
              {selectedState !== 'United States' && !loading && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={openSelectedInDashboard}
                    className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-800 dark:bg-cyan-400 dark:text-slate-950 dark:hover:bg-cyan-300"
                  >
                    <LayoutDashboard size={16} />
                    Open Dashboard
                  </button>
                  <button
                    onClick={compareSelectedState}
                    className="inline-flex items-center gap-2 rounded-md bg-white/75 px-4 py-2 text-sm font-bold text-slate-800 ring-1 ring-slate-200 transition-colors hover:bg-white dark:bg-slate-950/40 dark:text-slate-100 dark:ring-slate-700"
                  >
                    <GitCompare size={16} />
                    Compare
                  </button>
                  <button
                    onClick={handleShowNationalMap}
                    className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white/80 px-4 py-2 text-sm font-bold text-slate-800 transition-colors hover:bg-white dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-100 dark:hover:bg-slate-900"
                  >
                    <ArrowLeft size={16} />
                    National Map
                  </button>
                </div>
              )}
              </div>
            </div>

            {loading ? (
              <LoadingSkeleton variant="map" />
            ) : (
              <div className="p-6">
                <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div style={{ 
                    borderColor: stateColors.borderColor,
                    borderLeftWidth: '4px'
                  }} className="metric-card">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <h3 style={{ color: isDarkMode ? stateColors.textDark : stateColors.textLight }} className="text-sm font-bold">Gini Coefficient</h3>
                        <MetricTooltip label="Gini Coefficient" description="Measures income inequality from 0 to 1. Higher values mean more inequality." />
                      </div>
                      <div className="rounded-md bg-cyan-100 p-1.5 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-300"><TrendingUp className="h-4 w-4" /></div>
                    </div>
                    <p style={{ color: isDarkMode ? stateColors.accentDark : stateColors.accentLight }} className="text-3xl font-black tracking-tight">{stats.gini}</p>
                    <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Income inequality index</p>
                    <div className="mt-3"><SourceBadge source={isLive ? 'Live ACS' : 'Fallback ACS'} year={sources.gini?.year ?? 'N/A'} tone="cyan" /></div>
                  </div>
                  <div style={{ 
                    borderColor: stateColors.borderColor,
                    borderLeftWidth: '4px'
                  }} className="metric-card">
                    <div className="flex items-center gap-1">
                      <h3 style={{ color: isDarkMode ? stateColors.textDark : stateColors.textLight }} className="text-sm font-bold">Poverty Rate</h3>
                      <MetricTooltip label="Poverty Rate" description="Share of residents living below the official poverty threshold." />
                    </div>
                    <p style={{ color: isDarkMode ? stateColors.accentDark : stateColors.accentLight }} className="mt-3 text-3xl font-black tracking-tight">{stats.poverty}%</p>
                    <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Share below poverty line</p>
                    <div className="mt-3"><SourceBadge source={isLive ? 'Live SAIPE' : 'Fallback SAIPE'} year={sources.poverty?.year ?? 'N/A'} tone="amber" /></div>
                  </div>
                  <div style={{ 
                    borderColor: stateColors.borderColor,
                    borderLeftWidth: '4px'
                  }} className="metric-card">
                    <div className="flex items-center gap-1">
                      <h3 style={{ color: isDarkMode ? stateColors.textDark : stateColors.textLight }} className="text-sm font-bold">Top 1% Wealth Share</h3>
                      <MetricTooltip label="Top 1% Wealth Share" description="Estimated share of total wealth owned by the top 1% of households." />
                    </div>
                    <p style={{ color: isDarkMode ? stateColors.accentDark : stateColors.accentLight }} className="mt-3 text-3xl font-black tracking-tight">{stats.wealth}%</p>
                    <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Concentration of wealth</p>
                    <div className="mt-3"><SourceBadge source="Federal Reserve DFA" year="Latest" tone="violet" /></div>
                  </div>
                </div>
                <Map view={selectedState === 'United States' ? 'US' : 'state'} onStateClick={handleStateClick} selectedState={selectedState} stateData={benchmarkMap} />
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};

export default HomePage;
