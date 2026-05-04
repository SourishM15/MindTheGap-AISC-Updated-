import React from 'react';
import { DashboardRegionData, SAIPEData } from '../../types/dashboard';

interface DistributionContextBannerProps {
  variant: 'lorenz' | 'waffle';
  selectedRegion: string;
  isMetro: boolean;
  regionData: DashboardRegionData;
  saipeData: SAIPEData | null;
}

const DistributionContextBanner: React.FC<DistributionContextBannerProps> = ({
  variant,
  selectedRegion,
  isMetro,
  regionData,
  saipeData,
}) => {
  const demographics = regionData.profile?.demographics || {};

  if (isMetro && demographics.population != null) {
    return (
      <div className="surface-muted mb-4 flex flex-wrap gap-6 p-4 text-sm">
        <span className="font-semibold text-slate-900 dark:text-white">
          {selectedRegion} Metro Statistical Area · ACS 2021
        </span>
        {demographics.poverty_rate != null && (
          <span className="text-slate-700 dark:text-slate-300">MSA Poverty Rate: <strong>{demographics.poverty_rate.toFixed(1)}%</strong></span>
        )}
        {variant === 'lorenz' && demographics.median_household_income != null && (
          <span className="text-slate-700 dark:text-slate-300">MSA Median Income: <strong>${demographics.median_household_income.toLocaleString()}</strong></span>
        )}
        {variant === 'waffle' && demographics.poverty_rate != null && (
          <span className="text-slate-700 dark:text-slate-300">In Poverty: <strong>{Math.round(demographics.population * demographics.poverty_rate / 100).toLocaleString()}</strong> people</span>
        )}
        <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">Source: Census Bureau ACS (MSA-level)</span>
      </div>
    );
  }

  if (!saipeData?.snapshot) return null;

  return (
    <div className="surface-muted mb-4 flex flex-wrap gap-6 p-4 text-sm">
      <span className="font-semibold text-slate-900 dark:text-white">
        {selectedRegion} · SAIPE {saipeData.snapshot.year}
      </span>
      {variant === 'lorenz' ? (
        <>
          {saipeData.snapshot.poverty_rate != null && (
            <span className="text-slate-700 dark:text-slate-300">Poverty Rate: <strong>{saipeData.snapshot.poverty_rate.toFixed(1)}%</strong></span>
          )}
          {saipeData.snapshot.child_poverty_rate != null && (
            <span className="text-slate-700 dark:text-slate-300">Child Poverty: <strong>{saipeData.snapshot.child_poverty_rate.toFixed(1)}%</strong></span>
          )}
          {saipeData.snapshot.median_household_income != null && (
            <span className="text-slate-700 dark:text-slate-300">Median Income: <strong>${saipeData.snapshot.median_household_income.toLocaleString()}</strong></span>
          )}
        </>
      ) : (
        <>
          {saipeData.snapshot.poverty_rate != null && (
            <span className="text-slate-700 dark:text-slate-300">All-age Poverty: <strong>{saipeData.snapshot.poverty_rate.toFixed(1)}%</strong></span>
          )}
          {saipeData.snapshot.poverty_count != null && (
            <span className="text-slate-700 dark:text-slate-300">In Poverty: <strong>{saipeData.snapshot.poverty_count.toLocaleString()}</strong> people</span>
          )}
        </>
      )}
      <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">Source: Census Bureau SAIPE</span>
    </div>
  );
};

export default DistributionContextBanner;
