"""
Bureau of Labor Statistics (BLS) API Client
Fetches employment and unemployment data by state and industry
"""
import os
import requests
import json
import logging
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from dotenv import load_dotenv

logger = logging.getLogger(__name__)
load_dotenv()

class BLSAPIClient:
    """Fetch BLS employment and unemployment data"""
    
    BASE_URL = "https://api.bls.gov/publicAPI/v2"
    
    # BLS Series IDs for state unemployment rates
    STATE_UNEMPLOYMENT_SERIES = {
        # Format: "LAUST{state_fips}0000000003"  - State unemployment rate
        'AL': 'LAUST010000000003', 'AK': 'LAUST020000000003', 'AZ': 'LAUST040000000003',
        'AR': 'LAUST050000000003', 'CA': 'LAUST060000000003', 'CO': 'LAUST080000000003',
        'CT': 'LAUST090000000003', 'DE': 'LAUST100000000003', 'FL': 'LAUST120000000003',
        'GA': 'LAUST130000000003', 'HI': 'LAUST150000000003', 'ID': 'LAUST160000000003',
        'IL': 'LAUST170000000003', 'IN': 'LAUST180000000003', 'IA': 'LAUST190000000003',
        'KS': 'LAUST200000000003', 'KY': 'LAUST210000000003', 'LA': 'LAUST220000000003',
        'ME': 'LAUST230000000003', 'MD': 'LAUST240000000003', 'MA': 'LAUST250000000003',
        'MI': 'LAUST260000000003', 'MN': 'LAUST270000000003', 'MS': 'LAUST280000000003',
        'MO': 'LAUST290000000003', 'MT': 'LAUST300000000003', 'NE': 'LAUST310000000003',
        'NV': 'LAUST320000000003', 'NH': 'LAUST330000000003', 'NJ': 'LAUST340000000003',
        'NM': 'LAUST350000000003', 'NY': 'LAUST360000000003', 'NC': 'LAUST370000000003',
        'ND': 'LAUST380000000003', 'OH': 'LAUST390000000003', 'OK': 'LAUST400000000003',
        'OR': 'LAUST410000000003', 'PA': 'LAUST420000000003', 'RI': 'LAUST440000000003',
        'SC': 'LAUST450000000003', 'SD': 'LAUST460000000003', 'TN': 'LAUST470000000003',
        'TX': 'LAUST480000000003', 'UT': 'LAUST490000000003', 'VT': 'LAUST500000000003',
        'VA': 'LAUST510000000003', 'WA': 'LAUST530000000003', 'WV': 'LAUST540000000003',
        'WI': 'LAUST550000000003', 'WY': 'LAUST560000000003',
    }
    
    def __init__(self):
        self.api_key = os.getenv("BLS_API_KEY")
        if not self.api_key:
            logger.warning("BLS_API_KEY not found. BLS data will be limited.")
            logger.info("Get free key at: https://www.bls.gov/developers/home.htm")
    
    def get_state_unemployment(self, state_code: str, start_year: int = 2021, end_year: int = 2024) -> Dict:
        """
        Fetch unemployment rate data for a state
        
        Args:
            state_code: Two-letter state code (e.g., 'CA', 'NY')
            start_year: Starting year for data
            end_year: Ending year for data
        
        Returns:
            Dictionary with unemployment data by month
        """
        try:
            series_id = self.STATE_UNEMPLOYMENT_SERIES.get(state_code.upper())
            if not series_id:
                logger.warning(f"Unknown state code: {state_code}")
                return {}
            
            payload = {
                "seriesid": [series_id],
                "startyear": start_year,
                "endyear": end_year,
            }
            
            if self.api_key:
                payload["registrationKey"] = self.api_key
            
            response = requests.post(
                f"{self.BASE_URL}/timeseries/data",
                json=payload,
                timeout=10
            )
            response.raise_for_status()
            
            data = response.json()
            
            if data['status'] == 'REQUEST_NOT_PROCESSED':
                logger.warning(f"BLS API error: {data.get('message')}")
                if not self.api_key:
                    logger.info("Request requires registered API key")
                return {}
            
            results = data.get('Results', {}).get('series', [])
            if not results:
                return {}
            
            unemployment_data = {}
            for entry in results[0].get('data', []):
                year = entry['year']
                period = entry['period']  # M01 = January, M02 = February, etc.
                value = float(entry['value'])
                
                month_num = int(period[1:])
                date_str = f"{year}-{month_num:02d}"
                unemployment_data[date_str] = {'rate': value}
            
            return {
                'state': state_code.upper(),
                'unemployment_data': unemployment_data,
                'source': 'Bureau of Labor Statistics',
                'series_id': series_id
            }
        
        except Exception as e:
            logger.error(f"Error fetching BLS unemployment data: {e}")
            return {}
    
    def get_top_industries_state(self, state_code: str) -> Dict:
        """
        Get top employment industries for a state
        Returns sample data structure since detailed series IDs are complex
        """
        # Full implementation would require specific industry series codes
        # For now, return structure for enrichment
        return {
            'state': state_code.upper(),
            'top_industries': [
                {'industry': 'Professional Services', 'employment': 0, 'growth_rate': 0},
                {'industry': 'Healthcare', 'employment': 0, 'growth_rate': 0},
                {'industry': 'Retail Trade', 'employment': 0, 'growth_rate': 0},
                {'industry': 'Manufacturing', 'employment': 0, 'growth_rate': 0},
                {'industry': 'Government', 'employment': 0, 'growth_rate': 0},
            ],
            'note': 'Requires detailed industry series codes'
        }
    
    def get_average_wage(self, state_code: str) -> Dict:
        """
        Fetch average weekly wage for a state
        Returns structure for enrichment
        """
        return {
            'state': state_code.upper(),
            'average_weekly_wage': 0,
            'note': 'Requires specific AES series codes'
        }


if __name__ == "__main__":
    # Test the BLS API client
    client = BLSAPIClient()
    
    # Fetch unemployment data for California
    ca_unemp = client.get_state_unemployment('CA', 2023, 2024)
    print("California Unemployment (requires registered API key):")
    print(json.dumps(ca_unemp, indent=2))
