import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import ThemeToggle from './components/ThemeToggle';

const HomePage = lazy(() => import('./pages/HomePage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ComparisonPage = lazy(() => import('./pages/ComparisonPage'));
const SeattleNeighborhoodsPage = lazy(() => import('./pages/SeattleNeighborhoodsPage'));

function App() {
  return (
    <Router>
      <div className="min-h-screen text-slate-950 transition-colors duration-200 dark:text-slate-100">
        <Header />
        <Suspense
          fallback={
            <main className="container mx-auto px-6 py-8">
              <div className="surface p-6 text-sm font-semibold text-slate-600 dark:text-slate-300">
                Loading workspace...
              </div>
            </main>
          }
        >
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/compare" element={<ComparisonPage />} />
            <Route path="/seattle-neighborhoods" element={<SeattleNeighborhoodsPage />} />
            <Route path="/seattle-neighborhoods/:neighborhoodName" element={<SeattleNeighborhoodsPage />} />
          </Routes>
        </Suspense>
        
        <footer className="mt-10 overflow-hidden border-t border-slate-200/80 bg-white/70 text-slate-600 backdrop-blur dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
          <div className="accent-strip" />
          <div className="container mx-auto px-6 py-5">
            <p className="text-center text-sm">
              &copy; 2025 MindThe_Gap · Inequality Forecast Dashboard
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
