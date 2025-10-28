import React from 'react';
import { Link } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="bg-gradient-to-r from-indigo-600 to-purple-700 dark:from-indigo-800 dark:to-purple-900 text-white p-4 shadow-md">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="flex items-center space-x-3">
          <BarChart3 size={32} className="text-white" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">MindTheGap</h1>
            <p className="text-sm opacity-80">An AI-Driven Dashboard for Monitoring and Forecasting Income Inequality</p>
          </div>
        </Link>
        
        <nav className="hidden md:flex space-x-6">
          <Link to="/" className="text-white hover:text-indigo-200 transition-colors font-medium">Home</Link>
          <Link to="/dashboard" className="text-white hover:text-indigo-200 transition-colors font-medium">Dashboard</Link>
          <Link to="/seattle" className="text-white hover:text-indigo-200 transition-colors font-medium">Seattle</Link>
          <a href="#" className="text-white hover:text-indigo-200 transition-colors font-medium">About</a>
        </nav>
        
        <button className="md:hidden text-white">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
    </header>
  );
};

export default Header;