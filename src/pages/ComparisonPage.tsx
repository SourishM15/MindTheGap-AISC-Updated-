import React, { useState } from 'react';
import ComparisonPanel from '../components/ComparisonPanel';

const ComparisonPage: React.FC = () => {
  const [selectedStates, setSelectedStates] = useState<string[]>([]);

  const handleAddState = (state: string) => {
    if (selectedStates.length < 4) {
      setSelectedStates([...selectedStates, state]);
    }
  };

  const handleRemoveState = (state: string) => {
    setSelectedStates(selectedStates.filter(s => s !== state));
  };

  return (
    <main className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
          Compare States & Regions
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Select up to 4 states to compare key economic and demographic metrics against the USA average.
        </p>
      </div>

      <ComparisonPanel
        selectedStates={selectedStates}
        onStateAdd={handleAddState}
        onStateRemove={handleRemoveState}
      />
    </main>
  );
};

export default ComparisonPage;
