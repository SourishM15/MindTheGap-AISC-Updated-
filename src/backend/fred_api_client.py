"""
Federal Reserve Economic Data (FRED) API Client
Fetches economic indicators by state and national
"""
import os
import requests
import json
import logging
from typing import Dict, List, Optional
from datetime import datetime
from dotenv import load_dotenv

logger = logging.getLogger(__name__)
load_dotenv()

class FREDAPIClient:
    """Fetch FRED economic indicators via FRED API"""
    
    BASE_URL = "https://api.stlouisfed.org/fred"
    
    def __init__(self):
        self.api_key = os.getenv("FRED_API_KEY")
        if not self.api_key:
            logger.warning("FRED_API_KEY not found. FRED data will be unavailable.")
            logger.info("Get free key at: https://fred.stlouisfed.org/docs/api/")
    
    def get_state_economic_indicators(self, state_code: str) -> Dict:
        """
        Fetch major economic indicators for a state
        
        National indicators (available for all regions):
        - UNRATE: Unemployment Rate (National)
        - CPIAUCSL: Consumer Price Index (inflation proxy)
        - GDPC1: Real GDP per Capita (national, can use as proxy)
        - MORTGAGE30US: 30-Year Mortgage Rate
        - HOUST: Housing Starts (national)
        """
        try:
            state_code = state_code.upper()
            
            indicators = {
                'unemployment_rate': {},
                'inflation_proxy': {},
                'mortgage_rate': {},
                'gdp_per_capita': {},
            }
            
            # National unemployment rate (state-level would require state-specific series)
            unemployment = self._get_series_data('UNRATE', 24)  # Last 24 months
            if unemployment:
                indicators['unemployment_rate'] = unemployment
            
            # CPI (inflation indicator)
            inflation = self._get_series_data('CPIAUCSL', 24)
            if inflation:
                indicators['inflation_proxy'] = inflation
            
            # Mortgage rates
            mortgage = self._get_series_data('MORTGAGE30US', 24)
            if mortgage:
                indicators['mortgage_rate'] = mortgage
            
            # GDP per Capita
            gdp = self._get_series_data('GDPC1', 24)
            if gdp:
                indicators['gdp_per_capita'] = gdp
            
            return {
                'state': state_code,
                'indicators': indicators,
                'source': 'Federal Reserve Economic Data (FRED)',
                'note': 'National indicators; state-specific requires FRED+ subscription'
            }
        
        except Exception as e:
            logger.error(f"Error fetching FRED data: {e}")
            return {}
    
    def _get_series_data(self, series_id: str, limit: int = 24) -> Dict:
        """
        Fetch data for a specific FRED series
        
        Args:
            series_id: FRED series ID (e.g., 'UNRATE')
            limit: Number of observations to return
        
        Returns:
            Dictionary with series data
        """
        try:
            if not self.api_key:
                logger.debug(f"Skipping FRED series {series_id} (no API key)")
                return {}
            
            params = {
                'series_id': series_id,
                'api_key': self.api_key,
                'limit': limit,
                'sort_order': 'desc',  # Get most recent first
                'file_type': 'json',
                'units': 'lin'  # Linear scale (not percentage change)
            }
            
            response = requests.get(
                f"{self.BASE_URL}/series/observations",
                params=params,
                timeout=10
            )
            response.raise_for_status()
            
            data = response.json()
            
            if data.get('error_code'):
                logger.warning(f"FRED API error for {series_id}: {data.get('error_message')}")
                return {}
            
            observations = data.get('observations', [])
            series_data = {}
            
            for obs in reversed(observations):  # Reverse to get chronological order
                date = obs['date']
                value = obs.get('value')
                
                if value != '.':  # FRED uses '.' for missing values
                    try:
                        series_data[date] = float(value)
                    except ValueError:
                        pass
            
            return {
                'series_id': series_id,
                'title': data.get('seriess', [{}])[0].get('title', 'Unknown'),
                'units': data.get('seriess', [{}])[0].get('units', 'Unknown'),
                'data': series_data,
                'observations_count': len(series_data)
            }
        
        except Exception as e:
            logger.error(f"Error fetching FRED series {series_id}: {e}")
            return {}
    
    def get_national_indicators(self) -> Dict:
        """Get key national economic indicators"""
        try:
            indicators = {
                'unemployment_rate': self._get_series_data('UNRATE', 24),
                'inflation_rate': self._get_series_data('CPIAUCSL', 24),
                'real_gdp_per_capita': self._get_series_data('GDPC1', 24),
                'mortgage_rate': self._get_series_data('MORTGAGE30US', 24),
                'housing_starts': self._get_series_data('HOUST', 24),
                'consumer_confidence': self._get_series_data('UMCSENT', 24),
            }
            
            return {
                'country': 'United States',
                'indicators': indicators,
                'source': 'Federal Reserve Economic Data (FRED)',
                'timestamp': datetime.now().isoformat()
            }
        
        except Exception as e:
            logger.error(f"Error fetching national indicators: {e}")
            return {}
    
    def get_state_gdp(self, state_code: str) -> Dict:
        """
        Fetch state GDP data (if available in FRED)
        Note: Some state data available via FRED with state acronyms
        """
        try:
            state_code = state_code.upper()
            
            # Some states have GDP data (e.g., CAGSP for California GDP)
            # Full list requires FRED documentation lookup
            state_gdp_series = {
                'CA': 'CAGSP',  # California
                'TX': 'TXGSP',  # Texas
                'NY': 'NYGSP',  # New York
                'FL': 'FLGSP',  # Florida
                # Add more as needed
            }
            
            series_id = state_gdp_series.get(state_code)
            if series_id:
                return self._get_series_data(series_id, 12)
            
            return {'note': f'State GDP not available in FRED for {state_code}'}
        
        except Exception as e:
            logger.error(f"Error fetching state GDP: {e}")
            return {}


if __name__ == "__main__":
    # Test the FRED API client
    client = FREDAPIClient()
    
    # Fetch national indicators
    national = client.get_national_indicators()
    print("National Economic Indicators:")
    print(json.dumps(national, indent=2, default=str))
    
    # Fetch state indicators
    ca_indicators = client.get_state_economic_indicators('CA')
    print("\nCalifornia Economic Indicators:")
    print(json.dumps(ca_indicators, indent=2, default=str))
