import React from 'react';
import { FilterState } from '../types';
import { getDemographicsSummary } from '../data/seattleDemographics';

interface AnalysisProps {
  filters: FilterState;
}

const Analysis: React.FC<AnalysisProps> = ({ filters }) => {
  const getAnalysisText = (): { title: string; content: React.ReactNode } => {
    const neighborhoods = [
      'Ballard',
      'Capitol Hill',
      'Downtown',
      'Fremont',
      'Queen Anne',
      'University District',
      'South Lake Union'
    ];

    const demographicsData = neighborhoods.map(name => ({
      name,
      data: getDemographicsSummary(name)
    })).filter(item => item.data);

    if (filters.timeframe === 'current') {
      // Check if we have enough data for comparison
      if (demographicsData.length < 2) {
        return {
          title: 'Data Availability Notice',
          content: (
            <p className="text-amber-600 dark:text-amber-400">
              Insufficient neighborhood data available for detailed comparison. Please ensure multiple neighborhoods have complete demographic information.
            </p>
          )
        };
      }

      // Sort neighborhoods by median income
      const sortedByIncome = [...demographicsData].sort((a, b) => 
        (b.data?.medianIncome || 0) - (a.data?.medianIncome || 0)
      );

      // Sort neighborhoods by population
      const sortedByPopulation = [...demographicsData].sort((a, b) => 
        (b.data?.totalPopulation || 0) - (a.data?.totalPopulation || 0)
      );

      // Find youngest and oldest neighborhoods by median age
      const sortedByAge = [...demographicsData].sort((a, b) => 
        (a.data?.medianAge || 0) - (b.data?.medianAge || 0)
      );

      return {
        title: 'Seattle Neighborhoods Analysis',
        content: (
          <>
            <p className="mb-3">
              Among Seattle's major neighborhoods, {sortedByIncome[0].name} shows the highest median income at ${sortedByIncome[0].data?.medianIncome.toLocaleString()}, 
              while {sortedByIncome[sortedByIncome.length - 1].name} has the lowest at ${sortedByIncome[sortedByIncome.length - 1].data?.medianIncome.toLocaleString()}.
            </p>
            <p className="mb-3">
              {sortedByPopulation[0].name} is the most populous neighborhood with {sortedByPopulation[0].data?.totalPopulation.toLocaleString()} residents, 
              followed by {sortedByPopulation[1].name} with {sortedByPopulation[1].data?.totalPopulation.toLocaleString()} residents.
            </p>
            <p>
              The {sortedByAge[0].name} has the youngest median age at {sortedByAge[0].data?.medianAge.toFixed(1)} years, 
              while {sortedByAge[sortedByAge.length - 1].name} has the highest at {sortedByAge[sortedByAge.length - 1].data?.medianAge.toFixed(1)} years.
            </p>
          </>
        )
      };
    } else {
      return {
        title: 'Neighborhood Comparison',
        content: (
          <p>Select the current timeframe to view neighborhood comparisons.</p>
        )
      };
    }
  };

  const analysis = getAnalysisText();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
      <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200 border-b pb-2">{analysis.title}</h3>
      <div className="text-gray-700 dark:text-gray-300">
        {analysis.content}
      </div>
      <div className="mt-4 bg-blue-50 dark:bg-blue-900 border-l-4 border-blue-500 p-3 rounded">
        <h4 className="font-semibold text-blue-700 dark:text-blue-300 mb-1">Neighborhood Insights</h4>
        <p className="text-blue-800 dark:text-blue-200 text-sm">
          Seattle's neighborhoods show significant demographic and economic diversity, with distinct characteristics in terms of age distribution, population density, and income levels.
        </p>
      </div>
    </div>
  );
};

export default Analysis;