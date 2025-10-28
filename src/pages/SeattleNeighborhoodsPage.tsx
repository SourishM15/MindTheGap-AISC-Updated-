import React, { useState } from 'react';
import { MapPin } from 'lucide-react';
import { getDemographicsSummary } from '../data/seattleDemographics';
import DemographicsModal from '../components/DemographicsModal';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { LineChart, BarChart, XAxis, YAxis, Tooltip, Legend, Line, Bar, CartesianGrid } from 'recharts';

const neighborhoods = [
  { id: 'ballard', name: 'Ballard', description: 'Historic maritime district known for craft breweries and the Hiram M. Chittenden Locks' },
  { id: 'capitol-hill', name: 'Capitol Hill', description: 'Vibrant arts and culture hub with diverse dining and nightlife' },
  { id: 'downtown', name: 'Downtown', description: 'Urban core featuring Pike Place Market and major shopping destinations' },
  { id: 'fremont', name: 'Fremont', description: 'Quirky area known as the "Center of the Universe" with public art and tech companies' },
  { id: 'queen-anne', name: 'Queen Anne', description: 'Historic neighborhood with stunning views and Kerry Park' },
  { id: 'u-district', name: 'University District', description: 'Academic hub around UW with youthful energy and diverse cuisines' },
  { id: 'west-seattle', name: 'West Seattle', description: 'Beachside community with Alki Beach and stunning city views' },
  { id: 'south-lake-union', name: 'South Lake Union', description: 'Modern tech hub with Amazon campus and Lake Union activities' }
];

const SeattleNeighborhoodsPage: React.FC = () => {
  const { neighborhoodName } = useParams<{ neighborhoodName: string }>();
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string | null>(neighborhoodName || null);
  const [demographicsData, setDemographicsData] = useState<any | null>(() => {
    if (neighborhoodName) {
      return getDemographicsSummary(neighborhoodName);
    }
    return null;
  });

  const navigate = useNavigate();

  const handleNeighborhoodClick = (name: string) => {
    const data = getDemographicsSummary(name);
    if (data) {
      setSelectedNeighborhood(name);
      setDemographicsData(data);
      navigate(`/seattle-neighborhoods/${name.toLowerCase().replace(/ /g, '-')}`);
    } else {
      console.warn(`No demographic data found for neighborhood: ${name}`);
    }
  };

  const handleCloseModal = () => {
    setSelectedNeighborhood(null);
    setDemographicsData(null);
    navigate('/seattle-neighborhoods');
  };

  const getDisplayName = (id: string): string => {
    switch (id) {
      case 'u-district':
        return 'University District';
      case 'capitol-hill':
        return 'Capitol Hill';
      case 'south-lake-union':
        return 'South Lake Union';
      default:
        return id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' ');
    }
  };

  const summary = demographicsData;

  if (neighborhoodName && !summary) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-4xl font-bold mb-4">Neighborhood data not found for {getDisplayName(neighborhoodName)}.</h1>
        <Link to="/seattle-neighborhoods" className="text-indigo-600 hover:underline">Go back to the list</Link>
      </div>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">Seattle Neighborhoods</h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">Explore demographic data across Seattle's diverse communities</p>
        </div>

        {!selectedNeighborhood && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {neighborhoods.map((neighborhood) => (
              <div
                key={neighborhood.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden group"
              >
                <div className="p-6">
                  <div className="flex items-center mb-4">
                    <MapPin className="w-6 h-6 text-indigo-500 mr-2" />
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{neighborhood.name}</h3>
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">{neighborhood.description}</p>
                  <button
                    className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors duration-300 group-hover:shadow-md"
                    onClick={() => handleNeighborhoodClick(neighborhood.name)}
                  >
                    View Demographics
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedNeighborhood && demographicsData && (
        <DemographicsModal
          neighborhoodName={selectedNeighborhood}
          data={demographicsData}
          onClose={handleCloseModal}
        />
      )}

      {summary && summary.history && summary.forecast && (
        <div className="mt-8">
          <h2 className="text-3xl font-bold text-center mb-6">{getDisplayName(selectedNeighborhood || '')} Demographics</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <h3 className="text-2xl font-semibold mb-4">Historical Population</h3>
              <LineChart width={500} height={300} data={summary.history.population}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="value" stroke="#8884d8" />
              </LineChart>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <h3 className="text-2xl font-semibold mb-4">Population Forecast</h3>
              <LineChart width={500} height={300} data={summary.forecast.population}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="value" stroke="#82ca9d" />
              </LineChart>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <h3 className="text-2xl font-semibold mb-4">Age Distribution</h3>
              <BarChart width={500} height={300} data={[
                { name: 'Children', value: summary.ageDistribution.children },
                { name: 'Working Age', value: summary.ageDistribution.workingAge },
                { name: 'Elderly', value: summary.ageDistribution.elderly },
              ]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#8884d8" />
              </BarChart>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default SeattleNeighborhoodsPage;