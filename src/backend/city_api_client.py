"""
City-Level Data Collection Module
Fetches metro area and city-level data from Census Bureau ACS and BLS LAUS
Safe government APIs only - no scraping
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

class CityAPIClient:
    """
    Collects city and metro area data from government sources:
    - Census Bureau ACS (American Community Survey) - demographics by metro area
    - BLS LAUS (Local Area Unemployment Statistics) - employment by city/metro
    """
    
    def __init__(self):
        self.census_api_key = os.getenv("CENSUS_API_KEY")
        self.bls_api_key = os.getenv("BLS_API_KEY")
        
        if not self.census_api_key:
            logger.warning("CENSUS_API_KEY not set - city data will be limited")
        if not self.bls_api_key:
            logger.warning("BLS_API_KEY not set - city employment data unavailable")
        
        # Major metro areas and their FIPS codes (for BLS LAUS)
        self.metro_areas = {
            'New York': {'fips': '35620', 'state': 'NY', 'cities': ['New York', 'Newark', 'Jersey City']},
            'Los Angeles': {'fips': '31080', 'state': 'CA', 'cities': ['Los Angeles', 'Long Beach', 'Santa Ana']},
            'Chicago': {'fips': '16980', 'state': 'IL', 'cities': ['Chicago', 'Evanston', 'Oak Park']},
            'Houston': {'fips': '26420', 'state': 'TX', 'cities': ['Houston', 'The Woodlands', 'Sugar Land']},
            'Phoenix': {'fips': '33860', 'state': 'AZ', 'cities': ['Phoenix', 'Mesa', 'Chandler']},
            'Philadelphia': {'fips': '37980', 'state': 'PA', 'cities': ['Philadelphia', 'Camden', 'Chester']},
            'San Antonio': {'fips': '41700', 'state': 'TX', 'cities': ['San Antonio', 'New Braunfels']},
            'San Diego': {'fips': '41740', 'state': 'CA', 'cities': ['San Diego', 'Carlsbad', 'Oceanside']},
            'Dallas': {'fips': '19100', 'state': 'TX', 'cities': ['Dallas', 'Fort Worth', 'Arlington']},
            'San Jose': {'fips': '41940', 'state': 'CA', 'cities': ['San Jose', 'Santa Clara', 'Sunnyvale']},
            'Austin': {'fips': '12420', 'state': 'TX', 'cities': ['Austin', 'Round Rock', 'Cedar Park']},
            'Jacksonville': {'fips': '27260', 'state': 'FL', 'cities': ['Jacksonville', 'Orange Park']},
            'Denver': {'fips': '19740', 'state': 'CO', 'cities': ['Denver', 'Aurora', 'Littleton']},
            'Washington': {'fips': '47900', 'state': 'DC', 'cities': ['Washington', 'Arlington', 'Alexandria']},
            'Boston': {'fips': '14460', 'state': 'MA', 'cities': ['Boston', 'Cambridge', 'Brookline']},
            'Miami': {'fips': '33100', 'state': 'FL', 'cities': ['Miami', 'Coral Gables', 'Hialeah']},
            'Atlanta': {'fips': '12060', 'state': 'GA', 'cities': ['Atlanta', 'Sandy Springs', 'Marietta']},
            'Seattle': {'fips': '42660', 'state': 'WA', 'cities': ['Seattle', 'Bellevue', 'Kent']},
            'Minneapolis': {'fips': '33460', 'state': 'MN', 'cities': ['Minneapolis', 'St. Paul', 'Bloomington']},
            'Portland': {'fips': '38900', 'state': 'OR', 'cities': ['Portland', 'Beaverton', 'Hillsboro']},
        }
    
    def get_metro_area_demographics(self, metro_name: str) -> Optional[Dict]:
        """
        Fetch metro area demographics from Census Bureau ACS
        Uses American Community Survey data (5-year estimates)
        """
        if not self.census_api_key:
            logger.warning(f"No Census API key - cannot fetch demographics for {metro_name}")
            return None
        
        try:
            # Census Bureau ACS API endpoint for metro area data
            # Using ACS 5-year estimates (most stable data)
            metro = self.metro_areas.get(metro_name)
            if not metro:
                logger.warning(f"Metro area {metro_name} not in database")
                return None
            
            state_fips = self._get_state_fips(metro['state'])
            
            # ACS variables
            variables = {
                'B01003_001E': 'total_population',  # Total population
                'B19013_001E': 'median_household_income',  # Median household income
                'B17001_002E': 'poverty_count',  # Population below poverty line
                'B15003_022E': 'bachelor_degree',  # Bachelor's degree
            }
            
            var_list = ','.join(variables.keys())
            
            url = "https://api.census.gov/data/2021/acs/acs5"
            params = {
                'get': var_list,
                'for': f'metropolitan statistical area/micropolitan statistical area:{metro["fips"]}',
                'key': self.census_api_key
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            if len(data) < 2:
                logger.warning(f"No data returned for {metro_name}")
                return None
            
            values = data[1]
            result = {
                'metro_name': metro_name,
                'metro_fips': metro['fips'],
                'source': 'Census Bureau ACS',
                'year': 2021,
                'timestamp': datetime.now().isoformat()
            }
            
            # Parse results
            for i, var_code in enumerate(variables.keys()):
                var_name = variables[var_code]
                result[var_name] = int(values[i]) if values[i] else 0
            
            # Calculate derived metrics
            if result.get('poverty_count') and result.get('total_population'):
                result['poverty_rate'] = (result['poverty_count'] / result['total_population']) * 100
            
            if result.get('bachelor_degree') and result.get('total_population'):
                result['education_bachelor_and_above'] = (result['bachelor_degree'] / result['total_population']) * 100
            
            logger.info(f"✅ Retrieved demographics for {metro_name}")
            return result
            
        except Exception as e:
            logger.error(f"Error fetching metro demographics for {metro_name}: {e}")
            return None
    
    def get_metro_unemployment(self, metro_name: str) -> Optional[Dict]:
        """
        Fetch metro area unemployment from BLS LAUS (Local Area Unemployment Statistics)
        Most recent monthly data available
        """
        if not self.bls_api_key:
            logger.warning(f"No BLS API key - cannot fetch unemployment for {metro_name}")
            return None
        
        try:
            metro = self.metro_areas.get(metro_name)
            if not metro:
                logger.warning(f"Metro area {metro_name} not in database")
                return None
            
            # BLS LAUS series ID format: LAUMT{state_fips}{area_fips}03
            # 03 = unemployment rate
            state_fips = self._get_state_fips(metro['state'])
            series_id = f"LAUMT{state_fips}{metro['fips']}03"
            
            url = "https://api.bls.gov/publicAPI/v2/timeseries/data/"
            
            payload = {
                'seriesid': [series_id],
                'startyear': '2023',
                'endyear': '2026',
                'registrationkey': self.bls_api_key
            }
            
            response = requests.post(url, json=payload, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            if data['status'] != 'REQUEST_SUCCEEDED':
                logger.warning(f"BLS API request failed for {metro_name}: {data.get('message')}")
                return None
            
            result = {
                'metro_name': metro_name,
                'metro_fips': metro['fips'],
                'source': 'BLS LAUS',
                'unemployment_data': {}
            }
            
            # Parse unemployment rates by period
            if data['Results']['series']:
                for series in data['Results']['series']:
                    for item in series['data']:
                        period = item['period']
                        year = item['year']
                        value = float(item['value'])
                        
                        date_key = f"{year}-{period}"
                        result['unemployment_data'][date_key] = value
            
            logger.info(f"✅ Retrieved unemployment data for {metro_name}")
            return result
            
        except Exception as e:
            logger.error(f"Error fetching metro unemployment for {metro_name}: {e}")
            return None
    
    def get_city_profile(self, city_name: str) -> Optional[Dict]:
        """
        Get integrated city profile combining demographics and employment
        """
        # Find metro area containing this city
        matching_metro = None
        for metro, metro_data in self.metro_areas.items():
            if city_name.lower() in [c.lower() for c in metro_data['cities']]:
                matching_metro = metro
                break
        
        if not matching_metro:
            logger.warning(f"City {city_name} not in metro area database")
            return None
        
        # Fetch both demographics and employment
        demographics = self.get_metro_area_demographics(matching_metro)
        unemployment = self.get_metro_unemployment(matching_metro)
        
        if not demographics and not unemployment:
            return None
        
        # Combine into city profile
        profile = {
            'identity': {
                'city_name': city_name,
                'metro_area': matching_metro,
                'timestamp': datetime.now().isoformat()
            }
        }
        
        if demographics:
            profile['demographics'] = demographics
        
        if unemployment:
            profile['employment'] = unemployment
        
        return profile
    
    def get_all_metro_profiles(self) -> Dict[str, Dict]:
        """Fetch profiles for all major metro areas"""
        profiles = {}
        
        for metro_name in self.metro_areas.keys():
            profile = {
                'name': metro_name,
                'demographics': self.get_metro_area_demographics(metro_name),
                'unemployment': self.get_metro_unemployment(metro_name)
            }
            profiles[metro_name] = profile
            
            # Rate limiting
            import time
            time.sleep(0.1)
        
        return profiles
    
    @staticmethod
    def _get_state_fips(state_code: str) -> str:
        """Convert state code to FIPS code"""
        state_fips_map = {
            'AL': '01', 'AK': '02', 'AZ': '04', 'AR': '05', 'CA': '06',
            'CO': '08', 'CT': '09', 'DE': '10', 'FL': '12', 'GA': '13',
            'HI': '15', 'ID': '16', 'IL': '17', 'IN': '18', 'IA': '19',
            'KS': '20', 'KY': '21', 'LA': '22', 'ME': '23', 'MD': '24',
            'MA': '25', 'MI': '26', 'MN': '27', 'MS': '28', 'MO': '29',
            'MT': '30', 'NE': '31', 'NV': '32', 'NH': '33', 'NJ': '34',
            'NM': '35', 'NY': '36', 'NC': '37', 'ND': '38', 'OH': '39',
            'OK': '40', 'OR': '41', 'PA': '42', 'RI': '44', 'SC': '45',
            'SD': '46', 'TN': '47', 'TX': '48', 'UT': '49', 'VT': '50',
            'VA': '51', 'WA': '53', 'WV': '54', 'WI': '55', 'WY': '56',
            'DC': '11'
        }
        return state_fips_map.get(state_code, '00')


# Initialize client
city_client = CityAPIClient()

if __name__ == "__main__":
    # Test city data collection
    logging.basicConfig(level=logging.INFO)
    
    test_cities = ['New York', 'Los Angeles', 'Chicago']
    for city in test_cities:
        profile = city_client.get_city_profile(city)
        if profile:
            print(f"\n✅ {city}: {json.dumps(profile, indent=2)}")
        else:
            print(f"\n❌ Failed to fetch data for {city}")
