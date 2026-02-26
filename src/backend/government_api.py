"""
Government API Integration Module
Fetches data from US Census Bureau, Bureau of Labor Statistics, and other government sources
"""

import logging
import os
import requests
import json
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import aiohttp
import asyncio
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# API Keys from environment
CENSUS_API_KEY = os.getenv("CENSUS_API_KEY")
BLS_API_KEY = os.getenv("BLS_API_KEY")

# Cache for API responses
_api_cache = {}
_cache_expiry = {}

# Constants
CACHE_TTL = 86400  # 24 hours in seconds


class CensusAPI:
    """US Census Bureau Data API wrapper"""
    
    BASE_URL = "https://api.census.gov/data"
    
    # ACS 5-year estimates - most recent complete data
    ACS_5_YEAR = "acs/acs5"
    
    @staticmethod
    def get_demographic_data(fips_code: str, variables: List[str] = None) -> Dict[str, Any]:
        """
        Fetch demographic data for a geographic area
        
        Args:
            fips_code: County/state FIPS code
            variables: List of Census variable codes (e.g., 'B01003_001E' for total population)
        
        Returns:
            Dictionary with demographic data
        """
        if not CENSUS_API_KEY:
            logger.warning("CENSUS_API_KEY not set – Census data unavailable.")
            return {}
        
        # Default variables if not specified
        if variables is None:
            variables = [
                'B01003_001E',  # Total population
                'B19013_001E',  # Median household income
                'B17001_002E',  # Population below poverty line
                'B02001_002E',  # White population
                'B02001_003E',  # Black population
                'B02001_005E',  # Asian population
                'B03001_003E',  # Hispanic population
            ]
        
        cache_key = f"census_{fips_code}_{','.join(variables)}"
        if cache_key in _api_cache and _cache_expiry.get(cache_key, 0) > datetime.now().timestamp():
            return _api_cache[cache_key]
        
        try:
            # Build query
            variables_str = ','.join(variables)
            params = {
                'get': variables_str,
                'for': fips_code,
                'key': CENSUS_API_KEY
            }
            
            url = f"{CensusAPI.BASE_URL}/2022/{CensusAPI.ACS_5_YEAR}"
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            # Cache the result
            _api_cache[cache_key] = data
            _cache_expiry[cache_key] = datetime.now().timestamp() + CACHE_TTL
            
            return data
        
        except Exception as e:
            logger.error(f"Error fetching Census data: {e}")
            return {}
    
    @staticmethod
    def get_wealth_distribution(state_fips: str) -> Dict[str, Any]:
        """Fetch wealth distribution data by race for a state"""
        # Note: Census doesn't directly provide wealth data. This would need custom tables
        # For now, returning structure for integration
        return {
            'state': state_fips,
            'note': 'Wealth distribution requires custom Census tables or Federal Reserve data'
        }


class BLSApi:
    """Bureau of Labor Statistics API wrapper"""
    
    BASE_URL = "https://api.bls.gov/publicAPI/v2/timeseries/data"
    
    # Common series IDs
    UNEMPLOYMENT_RATE = "LNS14000000"
    CIVILIAN_LABOR_FORCE = "LNS11000000"
    STATE_UNEMPLOYMENT = {
        'AL': 'LASST010000000000003', 'AK': 'LASST020000000000003',
        'AZ': 'LASST040000000000003', 'AR': 'LASST050000000000003',
        'CA': 'LASST060000000000003', 'CO': 'LASST080000000000003',
        'CT': 'LASST090000000000003', 'DE': 'LASST100000000000003',
        'FL': 'LASST120000000000003', 'GA': 'LASST130000000000003',
        'HI': 'LASST150000000000003', 'ID': 'LASST160000000000003',
        'IL': 'LASST170000000000003', 'IN': 'LASST180000000000003',
        'IA': 'LASST190000000000003', 'KS': 'LASST200000000000003',
        'KY': 'LASST210000000000003', 'LA': 'LASST220000000000003',
        'ME': 'LASST230000000000003', 'MD': 'LASST240000000000003',
        'MA': 'LASST250000000000003', 'MI': 'LASST260000000000003',
        'MN': 'LASST270000000000003', 'MS': 'LASST280000000000003',
        'MO': 'LASST290000000000003', 'MT': 'LASST300000000000003',
        'NE': 'LASST310000000000003', 'NV': 'LASST320000000000003',
        'NH': 'LASST330000000000003', 'NJ': 'LASST340000000000003',
        'NM': 'LASST350000000000003', 'NY': 'LASST360000000000003',
        'NC': 'LASST370000000000003', 'ND': 'LASST380000000000003',
        'OH': 'LASST390000000000003', 'OK': 'LASST400000000000003',
        'OR': 'LASST410000000000003', 'PA': 'LASST420000000000003',
        'RI': 'LASST440000000000003', 'SC': 'LASST450000000000003',
        'SD': 'LASST460000000000003', 'TN': 'LASST470000000000003',
        'TX': 'LASST480000000000003', 'UT': 'LASST490000000000003',
        'VT': 'LASST500000000000003', 'VA': 'LASST510000000000003',
        'WA': 'LASST530000000000003', 'WV': 'LASST540000000000003',
        'WI': 'LASST550000000000003', 'WY': 'LASST560000000000003',
        'DC': 'LASST110000000000003'
    }
    
    @staticmethod
    def get_unemployment_data(series_ids: List[str], start_year: int = 2020, end_year: int = 2024) -> Dict[str, Any]:
        """Fetch unemployment data from BLS"""
        if not BLS_API_KEY:
            logger.warning("BLS_API_KEY not set – BLS data unavailable.")
            return {}
        
        cache_key = f"bls_{','.join(series_ids)}_{start_year}_{end_year}"
        if cache_key in _api_cache and _cache_expiry.get(cache_key, 0) > datetime.now().timestamp():
            return _api_cache[cache_key]
        
        try:
            headers = {'Content-type': 'application/json'}
            data_payload = json.dumps({
                'seriesid': series_ids,
                'startyear': start_year,
                'endyear': end_year,
                'registrationkey': BLS_API_KEY
            })
            
            response = requests.post(BLSApi.BASE_URL, data=data_payload, headers=headers, timeout=10)
            response.raise_for_status()
            
            result = response.json()
            
            # Cache the result
            _api_cache[cache_key] = result
            _cache_expiry[cache_key] = datetime.now().timestamp() + CACHE_TTL
            
            return result
        
        except Exception as e:
            logger.error(f"Error fetching BLS data: {e}")
            return {}
    
    @staticmethod
    def get_state_unemployment(state_code: str) -> Dict[str, Any]:
        """Get unemployment rate for a specific state"""
        if state_code not in BLSApi.STATE_UNEMPLOYMENT:
            return {}
        
        series_id = BLSApi.STATE_UNEMPLOYMENT[state_code]
        return BLSApi.get_unemployment_data([series_id])


class FederalReserveAPI:
    """Federal Reserve Economic Data (FRED) API wrapper"""
    
    BASE_URL = "https://api.stlouisfed.org/fred"
    FRED_API_KEY = os.getenv("FRED_API_KEY")
    
    # Common series IDs for inequality metrics
    GINI_INDEX = "SIPC"  # Sigma index of inequality
    MEDIAN_HOUSEHOLD_INCOME = "MEHOINUSA646N"
    
    @staticmethod
    def get_series_data(series_id: str, start_date: str = None, end_date: str = None) -> Dict[str, Any]:
        """Fetch time series data from FRED"""
        if not FederalReserveAPI.FRED_API_KEY:
            logger.warning("FRED_API_KEY not set – FRED data unavailable.")
            return {}
        
        cache_key = f"fred_{series_id}_{start_date}_{end_date}"
        if cache_key in _api_cache and _cache_expiry.get(cache_key, 0) > datetime.now().timestamp():
            return _api_cache[cache_key]
        
        try:
            params = {
                'series_id': series_id,
                'api_key': FederalReserveAPI.FRED_API_KEY,
                'file_type': 'json'
            }
            
            if start_date:
                params['observation_start'] = start_date
            if end_date:
                params['observation_end'] = end_date
            
            url = f"{FederalReserveAPI.BASE_URL}/series"
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            result = response.json()
            
            # Cache the result
            _api_cache[cache_key] = result
            _cache_expiry[cache_key] = datetime.now().timestamp() + CACHE_TTL
            
            return result
        
        except Exception as e:
            logger.error(f"Error fetching FRED data: {e}")
            return {}


def get_local_economic_indicators(state: str, county: Optional[str] = None) -> Dict[str, Any]:
    """
    Fetch comprehensive economic indicators for a geographic area
    
    Args:
        state: State code (e.g., 'WA')
        county: County name (optional)
    
    Returns:
        Dictionary with aggregated economic data
    """
    indicators = {
        'state': state,
        'county': county,
        'data_sources': [],
        'timestamp': datetime.now().isoformat()
    }
    
    # Get BLS unemployment
    unemployment_data = BLSApi.get_state_unemployment(state)
    if unemployment_data:
        indicators['unemployment'] = unemployment_data
        indicators['data_sources'].append('BLS')
    
    # Get FRED data
    inequality_data = FederalReserveAPI.get_series_data(FederalReserveAPI.MEDIAN_HOUSEHOLD_INCOME)
    if inequality_data:
        indicators['median_income'] = inequality_data
        indicators['data_sources'].append('FRED')
    
    return indicators


def clear_api_cache():
    """Clear the API response cache"""
    global _api_cache, _cache_expiry
    _api_cache = {}
    _cache_expiry = {}
    logger.info("API cache cleared")
