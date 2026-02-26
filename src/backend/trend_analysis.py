"""
Trend Analysis Engine for Wealth Disparity
Analyzes trends, identifies patterns, and provides insights
"""

import logging
import numpy as np
import pandas as pd
from typing import List, Dict, Tuple, Any, Optional
from datetime import datetime
from scipy import stats
import json

logger = logging.getLogger(__name__)

class TrendAnalyzer:
    """Analyzes wealth and economic trends"""
    
    @staticmethod
    def parse_date(date_str: str) -> float:
        """Convert date string (e.g., '2020:Q1') to numeric value for calculation"""
        try:
            if ':' in date_str:
                year, quarter = date_str.split(':')
                return float(year) + (int(quarter[1]) - 1) / 4
            else:
                return float(date_str)
        except:
            return 0.0
    
    @staticmethod
    def calculate_growth_rate(values: List[float], periods: int = 1) -> float:
        """
        Calculate compound annual growth rate (CAGR)
        
        Args:
            values: List of values over time
            periods: Number of periods per year (1 for annual, 4 for quarterly)
        
        Returns:
            CAGR as a percentage
        """
        if len(values) < 2 or values[0] <= 0:
            return 0.0
        
        try:
            end_value = values[-1]
            start_value = values[0]
            n_years = (len(values) - 1) / periods
            
            if n_years <= 0 or start_value <= 0:
                return 0.0
            
            cagr = (((end_value / start_value) ** (1 / n_years)) - 1) * 100
            return cagr
        except:
            return 0.0
    
    @staticmethod
    def calculate_gini_coefficient(data: List[float]) -> float:
        """
        Calculate Gini coefficient (0 = perfect equality, 1 = perfect inequality)
        
        Args:
            data: List of wealth/income values
        
        Returns:
            Gini coefficient
        """
        if not data or len(data) < 2:
            return 0.0
        
        try:
            sorted_data = np.array(sorted(data))
            n = len(sorted_data)
            
            # Handle zero or negative values
            if sorted_data[0] < 0:
                sorted_data = sorted_data - sorted_data.min() + 1
            
            cumsum = np.cumsum(sorted_data)
            gini = (2 * np.sum((np.arange(1, n + 1)) * sorted_data)) / (n * cumsum[-1]) - (n + 1) / n
            
            return max(0, min(1, gini))  # Clamp to [0, 1]
        except:
            return 0.0
    
    @staticmethod
    def calculate_inequality_ratio(top_wealth: float, bottom_wealth: float) -> float:
        """Calculate wealth ratio between top and bottom groups"""
        if bottom_wealth <= 0:
            return float('inf')
        return top_wealth / bottom_wealth
    
    @staticmethod
    def trend_analysis(data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Comprehensive trend analysis for a dataset
        
        Args:
            data: List of data points with 'Date' and numeric fields
        
        Returns:
            Dictionary with trend analysis results
        """
        if not data:
            return {'error': 'No data provided'}
        
        df = pd.DataFrame(data)
        
        results = {
            'total_points': len(data),
            'date_range': {
                'start': df['Date'].iloc[0] if 'Date' in df.columns else None,
                'end': df['Date'].iloc[-1] if 'Date' in df.columns else None
            },
            'trends': {}
        }
        
        # Analyze numeric columns
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        
        for col in numeric_cols:
            values = df[col].dropna().values.tolist()
            
            if len(values) < 2:
                continue
            
            # Calculate growth rate
            growth_rate = TrendAnalyzer.calculate_growth_rate(values)
            
            # Calculate trend direction using linear regression
            x = np.arange(len(values))
            slope, intercept, r_value, p_value, std_err = stats.linregress(x, values)
            
            # Determine trend direction
            if abs(slope) < 0.01:
                direction = "stable"
            elif slope > 0:
                direction = "increasing"
            else:
                direction = "decreasing"
            
            results['trends'][col] = {
                'growth_rate': round(growth_rate, 2),
                'direction': direction,
                'slope': round(slope, 4),
                'r_squared': round(r_value ** 2, 4),
                'mean': round(np.mean(values), 2),
                'std_dev': round(np.std(values), 2),
                'min': round(np.min(values), 2),
                'max': round(np.max(values), 2)
            }
        
        return results
    
    @staticmethod
    def identify_inflection_points(data: List[Dict[str, Any]], field: str) -> List[Dict[str, Any]]:
        """
        Identify major inflection points (significant changes) in a time series
        
        Args:
            data: List of data points
            field: Field name to analyze
        
        Returns:
            List of inflection points with dates and magnitude of change
        """
        if not data or len(data) < 3:
            return []
        
        df = pd.DataFrame(data)
        if field not in df.columns:
            return []
        
        values = df[field].values
        dates = df['Date'].values if 'Date' in df.columns else list(range(len(values)))
        
        # Calculate year-over-year changes
        changes = []
        for i in range(1, len(values)):
            if values[i-1] != 0:
                pct_change = ((values[i] - values[i-1]) / values[i-1]) * 100
                
                # Flag significant changes (> 10%)
                if abs(pct_change) > 10:
                    changes.append({
                        'date': dates[i],
                        'change_percent': round(pct_change, 2),
                        'value_before': round(values[i-1], 2),
                        'value_after': round(values[i], 2),
                        'severity': 'high' if abs(pct_change) > 25 else 'moderate'
                    })
        
        return sorted(changes, key=lambda x: abs(x['change_percent']), reverse=True)
    
    @staticmethod
    def compare_demographics(data_by_group: Dict[str, List[Dict]]) -> Dict[str, Any]:
        """
        Compare trends across demographic groups
        
        Args:
            data_by_group: Dictionary mapping group names to data lists
        
        Returns:
            Comparison analysis
        """
        comparison = {
            'groups': list(data_by_group.keys()),
            'group_trends': {},
            'disparities': {}
        }
        
        # Analyze each group
        group_values = {}
        for group_name, group_data in data_by_group.items():
            if group_data:
                # Get the latest value for each group
                latest_point = group_data[-1]
                group_values[group_name] = latest_point
                
                # Trend analysis for this group
                analysis = TrendAnalyzer.trend_analysis(group_data)
                comparison['group_trends'][group_name] = analysis['trends']
        
        # Calculate disparities between groups
        if len(group_values) >= 2:
            group_names = list(group_values.keys())
            
            for i, group1 in enumerate(group_names):
                for group2 in group_names[i+1:]:
                    # Compare numeric fields
                    for field in group_values[group1]:
                        if isinstance(group_values[group1][field], (int, float)) and \
                           field in group_values[group2] and \
                           isinstance(group_values[group2][field], (int, float)):
                            
                            val1 = group_values[group1][field]
                            val2 = group_values[group2][field]
                            
                            if val2 != 0:
                                ratio = val1 / val2
                                disparity_key = f"{group1}_vs_{group2}_{field}"
                                comparison['disparities'][disparity_key] = {
                                    'ratio': round(ratio, 2),
                                    'group1_value': val1,
                                    'group2_value': val2,
                                    'difference': round(val1 - val2, 2)
                                }
        
        return comparison
    
    @staticmethod
    def forecast_trend(historical_data: List[float], periods_ahead: int = 4) -> List[Dict[str, Any]]:
        """
        Simple trend forecast using linear regression
        
        Args:
            historical_data: Historical values
            periods_ahead: Number of periods to forecast
        
        Returns:
            Forecast data with confidence intervals
        """
        if len(historical_data) < 2:
            return []
        
        try:
            x = np.arange(len(historical_data))
            y = np.array(historical_data)
            
            # Fit linear regression
            slope, intercept, r_value, p_value, std_err = stats.linregress(x, y)
            
            # Calculate forecast
            forecast = []
            for i in range(periods_ahead):
                x_pred = len(historical_data) + i
                y_pred = slope * x_pred + intercept
                
                # Simple confidence interval based on std error
                ci = 1.96 * std_err
                
                forecast.append({
                    'period': i + 1,
                    'predicted_value': round(y_pred, 2),
                    'confidence_lower': round(y_pred - ci, 2),
                    'confidence_upper': round(y_pred + ci, 2),
                    'r_squared': round(r_value ** 2, 4)
                })
            
            return forecast
        except Exception as e:
            logger.error(f"Error in forecast: {e}")
            return []


def analyze_wealth_gap_trends(wealth_data: List[Dict]) -> Dict[str, Any]:
    """
    Analyze wealth gap trends over time
    
    Args:
        wealth_data: List of wealth data points with 'Category' and 'Date' fields
    
    Returns:
        Detailed wealth gap analysis
    """
    if not wealth_data:
        return {}
    
    df = pd.DataFrame(wealth_data)
    
    # Separate by wealth group
    groups_data = {}
    if 'Category' in df.columns:
        for category in df['Category'].unique():
            groups_data[category] = df[df['Category'] == category].to_dict('records')
    
    # Compare trends
    comparison = TrendAnalyzer.compare_demographics(groups_data)
    
    # Overall trend analysis
    overall_trend = TrendAnalyzer.trend_analysis(wealth_data)
    
    return {
        'overall_trend': overall_trend,
        'group_comparison': comparison,
        'timestamp': datetime.now().isoformat()
    }


def get_trend_summary(data: List[Dict], field: str = None) -> str:
    """Generate a natural language summary of trends"""
    if not data:
        return "No data available for trend analysis."
    
    analysis = TrendAnalyzer.trend_analysis(data)
    
    if not analysis.get('trends'):
        return "Insufficient data for trend analysis."
    
    trends = analysis['trends']
    
    summary_parts = []
    
    for field_name, metrics in list(trends.items())[:3]:  # Top 3 trends
        growth = metrics['growth_rate']
        direction = metrics['direction']
        
        if direction == "stable":
            summary_parts.append(f"{field_name} remained relatively stable")
        elif direction == "increasing":
            summary_parts.append(f"{field_name} increased at a rate of {growth}% CAGR")
        else:
            summary_parts.append(f"{field_name} declined at a rate of {abs(growth)}% CAGR")
    
    return "Over the analyzed period, " + ", ".join(summary_parts) + "."
