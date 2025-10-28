import React, { useState } from 'react';
import { DemographicsSummary } from '../types/demographics';
import { X, Users, Baby, Briefcase, Heart, DollarSign, Scale as Male, Scale as Female, TrendingUp, History } from 'lucide-react';
import LineChart from './charts/LineChart';

interface DemographicsModalProps {
  neighborhoodName: string;
  data: DemographicsSummary;
  onClose: () => void;
}

const DemographicsModal: React.FC<DemographicsModalProps> = ({ neighborhoodName, data, onClose }) => {
  const [showHistorical, setShowHistorical] = useState(false);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full mx-4 relative overflow-y-auto max-h-[90vh]">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-500 hover:text-gray-700"
        >
          <X size={24} />
        </button>

        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{neighborhoodName} Demographics</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-indigo-50 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <Users className="w-5 h-5 text-indigo-600 mr-2" />
                <h3 className="text-lg font-semibold text-indigo-900">Population</h3>
              </div>
              <p className="text-3xl font-bold text-indigo-600">
                {data.totalPopulation.toLocaleString()}
              </p>
            </div>

            <div className="bg-emerald-50 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <Heart className="w-5 h-5 text-emerald-600 mr-2" />
                <h3 className="text-lg font-semibold text-emerald-900">Median Age</h3>
              </div>
              <p className="text-3xl font-bold text-emerald-600">
                {data.medianAge.toFixed(1)} years
              </p>
            </div>

            <div className="bg-amber-50 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <DollarSign className="w-5 h-5 text-amber-600 mr-2" />
                <h3 className="text-lg font-semibold text-amber-900">Median Income</h3>
              </div>
              <p className="text-3xl font-bold text-amber-600">
                ${data.medianIncome.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Age Distribution</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-2">
                  <Baby className="w-8 h-8 text-blue-600" />
                </div>
                <p className="text-sm text-gray-600">Children</p>
                <p className="text-xl font-bold text-gray-900">{data.ageDistribution.children}%</p>
              </div>
              <div className="text-center">
                <div className="bg-purple-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-2">
                  <Briefcase className="w-8 h-8 text-purple-600" />
                </div>
                <p className="text-sm text-gray-600">Working Age</p>
                <p className="text-xl font-bold text-gray-900">{data.ageDistribution.workingAge}%</p>
              </div>
              <div className="text-center">
                <div className="bg-amber-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-2">
                  <Heart className="w-8 h-8 text-amber-600" />
                </div>
                <p className="text-sm text-gray-600">Elderly</p>
                <p className="text-xl font-bold text-gray-900">{data.ageDistribution.elderly}%</p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Gender Distribution</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-2">
                  <Male className="w-8 h-8 text-blue-600" />
                </div>
                <p className="text-sm text-gray-600">Male</p>
                <p className="text-xl font-bold text-gray-900">{data.genderRatio.male}%</p>
              </div>
              <div className="bg-pink-50 rounded-lg p-4 text-center">
                <div className="bg-pink-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-2">
                  <Female className="w-8 h-8 text-pink-600" />
                </div>
                <p className="text-sm text-gray-600">Female</p>
                <p className="text-xl font-bold text-gray-900">{data.genderRatio.female}%</p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                {showHistorical ? (
                  <>
                    <History className="w-5 h-5 text-indigo-600 mr-2" />
                    Historical Trends
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-5 h-5 text-indigo-600 mr-2" />
                    Future Projections
                  </>
                )}
              </h3>
              <button
                onClick={() => setShowHistorical(!showHistorical)}
                className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
              >
                Show {showHistorical ? 'Forecast' : 'Historical'} Data
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {showHistorical && data.history ? (
                <>
                  <LineChart
                    title="Population Trend"
                    data={data.history.population}
                    unit=""
                    domain={[0, Math.max(...data.history.population.map(p => p.value)) * 1.2]}
                    color="#4F46E5"
                  />
                  <LineChart
                    title="Median Income Trend"
                    data={data.history.medianIncome}
                    unit="$"
                    domain={[0, Math.max(...data.history.medianIncome.map(p => p.value)) * 1.2]}
                    color="#10B981"
                  />
                </>
              ) : data.forecast ? (
                <>
                  <LineChart
                    title="Population Forecast"
                    data={data.forecast.population}
                    unit=""
                    domain={[0, Math.max(...data.forecast.population.map(p => p.value)) * 1.2]}
                    color="#4F46E5"
                  />
                  <LineChart
                    title="Median Income Forecast"
                    data={data.forecast.medianIncome}
                    unit="$"
                    domain={[0, Math.max(...data.forecast.medianIncome.map(p => p.value)) * 1.2]}
                    color="#10B981"
                  />
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemographicsModal;