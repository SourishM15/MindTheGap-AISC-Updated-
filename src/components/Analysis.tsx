import React from 'react';
import { FilterState } from '../types';

interface AnalysisProps {
  filters: FilterState;
  selectedRegion?: string;
  regionData?: any;
}

interface RegionMetrics {
  population?: number;
  medianIncome?: number;
  povertyRate?: number;
  educationRate?: number;
  unemploymentRate?: number;
}

const Analysis: React.FC<AnalysisProps> = ({ filters, selectedRegion = 'United States', regionData }) => {
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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
      <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200 border-b pb-2">{analysis.title}</h3>
      <div className="text-gray-700 dark:text-gray-300">
        {analysis.content}
      </div>
      <div className="mt-4 bg-indigo-50 dark:bg-indigo-900 border-l-4 border-indigo-500 p-3 rounded">
        <h4 className="font-semibold text-indigo-700 dark:text-indigo-300 mb-1">Regional Insights</h4>
        <p className="text-indigo-800 dark:text-indigo-200 text-sm">
          Explore the Compare Regions page to see how {selectedRegion} stacks up against other states and metros. 
          Use the chart options above to visualize different economic indicators.
        </p>
      </div>
    </div>
  );
};

export default Analysis;