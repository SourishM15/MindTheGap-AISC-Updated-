import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import ComparisonPage from './pages/ComparisonPage';
import SeattleNeighborhoodsPage from './pages/SeattleNeighborhoodsPage';
import ThemeToggle from './components/ThemeToggle';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-200">
        <Header />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/compare" element={<ComparisonPage />} />
          <Route path="/seattle-neighborhoods" element={<SeattleNeighborhoodsPage />} />
          <Route path="/seattle-neighborhoods/:neighborhoodName" element={<SeattleNeighborhoodsPage />} />
        </Routes>
        
        <footer className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white p-4 mt-10">
          <div className="container mx-auto">
            <p className="text-center text-sm">
              &copy; 2025 Inequality Forecast Dashboard | Data is simulated for demonstration purposes
            </p>
          </div>
        </footer>

        <div className="fixed bottom-4 right-4 z-50">
          <ThemeToggle />
        </div>
      </div>
    </Router>
  );
}

export default App;