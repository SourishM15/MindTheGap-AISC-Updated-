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
load_dotenv(override=True)

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
                'B01003_001E': 'total_population',         # Total population
                'B19013_001E': 'median_household_income',  # Median household income
                'B17001_002E': 'poverty_count',            # Population below poverty line
                'B15003_001E': 'pop_25_plus',              # Population 25+ (education denominator)
                'B15003_022E': 'bachelor_degree',          # Bachelor's degree
                'B15003_023E': 'masters_degree',           # Master's degree
                'B15003_024E': 'professional_degree',      # Professional degree
                'B15003_025E': 'doctorate_degree',         # Doctorate
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

            # Education: bachelor's or higher among adults 25+
            pop_25_plus = result.get('pop_25_plus') or 0
            bachelors_plus = sum(result.get(k, 0) or 0 for k in (
                'bachelor_degree', 'masters_degree', 'professional_degree', 'doctorate_degree'
            ))
            if bachelors_plus and pop_25_plus:
                result['education_bachelor_and_above'] = (bachelors_plus / pop_25_plus) * 100
            
            logger.info(f"✅ Retrieved demographics for {metro_name}")
            return result
            
        except Exception as e:
            logger.error(f"Error fetching metro demographics for {metro_name}: {e}")
            return None

    def get_metro_income_distribution(self, metro_name: str, year: Optional[int] = None) -> Optional[Dict]:
        """
        Fetch metro-level income distribution for Lorenz and waffle charts.

        Uses ACS variables:
          - B19083_001E (Gini)
          - B19013_001E (median household income)
          - B19001_001E and B19001_002E..017E (income brackets)
        """
        if not self.census_api_key:
            logger.warning(f"No Census API key - cannot fetch income distribution for {metro_name}")
            return None

        metro = self.metro_areas.get(metro_name)
        if not metro:
            logger.warning(f"Metro area {metro_name} not in database")
            return None

        # ACS income bracket variables with midpoint assumptions
        brackets = [
            ("B19001_002E", "< $10k", 5_000),
            ("B19001_003E", "$10-15k", 12_500),
            ("B19001_004E", "$15-20k", 17_500),
            ("B19001_005E", "$20-25k", 22_500),
            ("B19001_006E", "$25-30k", 27_500),
            ("B19001_007E", "$30-35k", 32_500),
            ("B19001_008E", "$35-40k", 37_500),
            ("B19001_009E", "$40-45k", 42_500),
            ("B19001_010E", "$45-50k", 47_500),
            ("B19001_011E", "$50-60k", 55_000),
            ("B19001_012E", "$60-75k", 67_500),
            ("B19001_013E", "$75-100k", 87_500),
            ("B19001_014E", "$100-125k", 112_500),
            ("B19001_015E", "$125-150k", 137_500),
            ("B19001_016E", "$150-200k", 175_000),
            ("B19001_017E", "$200k+", 350_000),
        ]

        vars_needed = ["B19083_001E", "B19001_001E", "B19013_001E"] + [b[0] for b in brackets]

        try:
            default_year = 2021
            if year is None:
                year_candidates = [default_year, max(1989, default_year - 1)]
            else:
                start_year = year if year <= 2025 else 2025
                year_candidates = list(range(start_year, 1988, -1))[:35]
                if default_year not in year_candidates:
                    year_candidates.append(default_year)

            rows = None
            resolved_year = None
            for y in year_candidates:
                try:
                    url = f"https://api.census.gov/data/{y}/acs/acs5"
                    params = {
                        "get": ",".join(vars_needed),
                        "for": f"metropolitan statistical area/micropolitan statistical area:{metro['fips']}",
                        "key": self.census_api_key,
                    }
                    response = requests.get(url, params=params, timeout=10)
                    response.raise_for_status()
                    candidate_rows = response.json()
                    if len(candidate_rows) >= 2:
                        rows = candidate_rows
                        resolved_year = y
                        break
                except Exception:
                    continue

            if not rows or resolved_year is None:
                return None

            header, row = rows[0], rows[1]
            record = dict(zip(header, row))

            def safe_int(val):
                try:
                    v = int(val)
                    return v if v >= 0 else 0
                except (TypeError, ValueError):
                    return 0

            def safe_float(val):
                try:
                    return float(val)
                except (TypeError, ValueError):
                    return None

            gini = safe_float(record.get("B19083_001E"))
            total_hh = safe_int(record.get("B19001_001E")) or 1
            median_income = safe_float(record.get("B19013_001E"))

            counts = [safe_int(record.get(b[0])) for b in brackets]
            labels = [b[1] for b in brackets]
            midpoints = [b[2] for b in brackets]

            total_income = sum(c * m for c, m in zip(counts, midpoints)) or 1

            # Lorenz points
            cum_pop = 0.0
            cum_inc = 0.0
            lorenz_data = [{"bracket": "Origin", "cumulativePopulation": 0.0, "cumulativeWealth": 0.0, "percentage": 0.0}]
            for label, count, midpoint in zip(labels, counts, midpoints):
                pop_share = (count / total_hh) * 100
                inc_share = (count * midpoint / total_income) * 100
                cum_pop += pop_share
                cum_inc += inc_share
                lorenz_data.append({
                    "bracket": label,
                    "cumulativePopulation": round(cum_pop, 2),
                    "cumulativeWealth": round(cum_inc, 2),
                    "percentage": round(inc_share, 2),
                })

            # 6-bucket waffle aggregation
            waffle_colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#0ea5e9", "#3b82f6"]
            waffle_names = ["Bottom 20%", "20-40%", "40-60%", "60-80%", "80-95%", "Top 5%"]
            waffle_thresholds = [20, 40, 60, 80, 95, 100]

            group_incomes = [0.0] * 6
            cum_pop2 = 0.0
            for count, midpoint in zip(counts, midpoints):
                pop_share = (count / total_hh) * 100
                inc_share = (count * midpoint / total_income) * 100
                cum_pop2 += pop_share
                for gi, threshold in enumerate(waffle_thresholds):
                    if cum_pop2 <= threshold or gi == 5:
                        group_incomes[gi] += inc_share
                        break

            waffle_data = [
                {"bracket": name, "percentage": round(group_incomes[i], 1), "color": waffle_colors[i]}
                for i, name in enumerate(waffle_names)
                if group_incomes[i] > 0
            ]

            return {
                "metro": metro_name,
                "metro_fips": metro["fips"],
                "gini_coefficient": gini,
                "median_household_income": median_income,
                "lorenz_data": lorenz_data,
                "waffle_data": waffle_data,
                "source": "Census ACS B19001/B19083 (metro)",
                "year": resolved_year,
                "requested_year": year,
                "state_specific": False,
                "metro_specific": True,
            }
        except Exception as e:
            logger.error(f"Error fetching metro income distribution for {metro_name}: {e}")
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
