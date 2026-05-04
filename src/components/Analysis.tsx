import React from 'react';
import { FilterState } from '../types';

interface AnalysisProps {
  filters: FilterState;
  selectedRegion?: string;
  regionData?: {
    profile?: {
      demographics?: {
        median_household_income?: number;
        population?: number;
        poverty_rate?: number;
        education_bachelor_and_above?: number;
      };
    };
  };
}

const Analysis: React.FC<AnalysisProps> = ({ filters, selectedRegion = 'United States', regionData }) => {
  void filters;

  const getAnalysisText = (): { title: string; content: React.ReactNode } => {
    const demographics = regionData?.profile?.demographics || {};
    
    // Provide general regional insight
    const medianIncome = demographics.median_household_income;
    const population = demographics.population;
    const povertyRate = demographics.poverty_rate;
    const educationRate = demographics.education_bachelor_and_above;

    return {
      title: `${selectedRegion} - Economic & Demographic Overview`,
      content: (
        <>
          {medianIncome && (
            <p className="mb-3">
              <strong>{selectedRegion}</strong> has a median household income of <strong>${(medianIncome / 1000).toFixed(0)}K</strong>, 
              which reflects the region's economic conditions and cost of living.
            </p>
          )}
          {population && (
            <p className="mb-3">
              The region has a population of <strong>{(population / 1000000).toFixed(2)}M</strong> residents, 
              indicating {population > 10000000 ? 'a large and diverse economic market' : 'a mid-sized regional economy'}.
            </p>
          )}
          {povertyRate && (
            <p className="mb-3">
              The poverty rate stands at <strong>{povertyRate.toFixed(1)}%</strong>, which provides context for understanding 
              the economic disparities within the region.
            </p>
          )}
          {educationRate && (
            <p>
              Educational attainment is {educationRate > 30 ? 'notably high' : educationRate > 20 ? 'moderate' : 'relatively low'} with 
              <strong> {educationRate.toFixed(1)}%</strong> of the population holding a bachelor's degree or higher.
            </p>
          )}
        </>
      )
    };
  };

  const analysis = getAnalysisText();

  return (
    <div className="surface p-5">
      <h3 className="mb-4 border-b border-slate-200 pb-3 text-xl font-semibold text-slate-900 dark:border-slate-800 dark:text-white">{analysis.title}</h3>
      <div className="leading-7 text-slate-700 dark:text-slate-300">
        {analysis.content}
      </div>
      <div className="surface-muted mt-4 border-l-4 border-l-cyan-500 p-3">
        <h4 className="mb-1 font-semibold text-slate-900 dark:text-white">Regional Insights</h4>
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Explore the Compare Regions page to see how {selectedRegion} stacks up against other states and metros. 
          Use the chart options above to visualize different economic indicators.
        </p>
      </div>
    </div>
  );
};

export default Analysis;
