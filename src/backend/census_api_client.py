"""
Census Bureau API Client
Fetches demographic and socioeconomic data for states/regions
"""
import os
import requests
import json
import logging
from typing import Dict, List, Optional
from dotenv import load_dotenv

logger = logging.getLogger(__name__)
load_dotenv()

class CensusAPIClient:
    """Fetch Census Bureau data via American Community Survey (ACS)"""
    
    BASE_URL = "https://api.census.gov/data"
    YEAR = "2022"
    DATASET = "acs/acs5"  # American Community Survey 5-year
    
    def __init__(self):
        self.api_key = os.getenv("CENSUS_API_KEY")
        if not self.api_key:
            logger.warning("CENSUS_API_KEY not found. Census data will be unavailable.")
            logger.info("Get free key at: https://api.census.gov/data/key_signup.html")
    
    def get_url(self, variables: str, geo: str) -> str:
        """Build Census API URL"""
        return f"{self.BASE_URL}/{self.YEAR}/{self.DATASET}?get={variables}&for={geo}&key={self.api_key}"
    
    def get_state_demographics(self, state_fips: str) -> Dict:
        """
        Fetch demographic data for a state
        
        Variables fetched:
        - Population (B01003_001E)
        - Median age (B01002_001E)
        - Race: White (B02001_002E), Black (B02001_003E), Asian (B02001_005E), Hispanic (B03003_003E)
        - Educational attainment: Bachelor's degree+ (B15003_022E to _025E)
        - Median household income (B19013_001E)
        - Poverty rate (B17001_002E / B17001_001E)
        """
        try:
            variables = ",".join([
                "B01003_001E",  # Total population
                "B01002_001E",  # Median age
                "B02001_002E",  # White population
                "B02001_003E",  # Black population
                "B02001_005E",  # Asian population
                "B03003_003E",  # Hispanic population
                "B15003_022E",  # Bachelor's degree
                "B15003_023E",  # Master's degree
                "B15003_024E",  # Professional degree
                "B15003_025E",  # Doctorate degree
                "B19013_001E",  # Median household income
                "B17001_002E",  # Below poverty level
                "B17001_001E",  # Total for poverty ratio
            ])
            
            geo_filter = f"state:{state_fips}"
            url = self.get_url(variables, geo_filter)
            
            if not self.api_key:
                logger.warning(f"Skipping Census API call (no key). Using default data.")
                return self._get_default_state_data(state_fips)
            
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            if len(data) > 1:
                return self._parse_census_response(data)
            
            return {}
        
        except Exception as e:
            logger.error(f"Error fetching Census data: {e}")
            return {}
    
    def _parse_census_response(self, data: List) -> Dict:
        """Parse Census API response into structured format"""
        try:
            headers = data[0]
            values = data[1]
            
            idx = {header: i for i, header in enumerate(headers)}
            
            population = int(values[idx.get('B01003_001E', 0)] or 0)
            
            # Calculate education attainment
            bachelors_up = (
                int(values[idx.get('B15003_022E', 0)] or 0) +
                int(values[idx.get('B15003_023E', 0)] or 0) +
                int(values[idx.get('B15003_024E', 0)] or 0) +
                int(values[idx.get('B15003_025E', 0)] or 0)
            )
            education_pct = (bachelors_up / population * 100) if population > 0 else 0
            
            # Calculate poverty rate
            in_poverty = int(values[idx.get('B17001_002E', 0)] or 0)
            total_for_poverty = int(values[idx.get('B17001_001E', 0)] or 0)
            poverty_rate = (in_poverty / total_for_poverty * 100) if total_for_poverty > 0 else 0
            
            # Race percentages
            white = int(values[idx.get('B02001_002E', 0)] or 0)
            black = int(values[idx.get('B02001_003E', 0)] or 0)
            asian = int(values[idx.get('B02001_005E', 0)] or 0)
            hispanic = int(values[idx.get('B03003_003E', 0)] or 0)
            
            return {
                'population': population,
                'median_age': float(values[idx.get('B01002_001E', 0)] or 0),
                'median_household_income': int(values[idx.get('B19013_001E', 0)] or 0),
                'poverty_rate': round(poverty_rate, 2),
                'education_bachelor_and_above': round(education_pct, 2),
                'race_distribution': {
                    'white_percent': round(white / population * 100, 2) if population > 0 else 0,
                    'black_percent': round(black / population * 100, 2) if population > 0 else 0,
                    'asian_percent': round(asian / population * 100, 2) if population > 0 else 0,
                    'hispanic_percent': round(hispanic / population * 100, 2) if population > 0 else 0,
                },
                'source': 'Census Bureau ACS',
                'year': 2022
            }
        
        except Exception as e:
            logger.error(f"Error parsing Census response: {e}")
            return {}
    
    def _get_default_state_data(self, state_fips: str) -> Dict:
        """Return default data structure when API unavailable"""
        return {
            'population': 0,
            'median_age': 0,
            'median_household_income': 0,
            'poverty_rate': 0,
            'education_bachelor_and_above': 0,
            'race_distribution': {
                'white_percent': 0,
                'black_percent': 0,
                'asian_percent': 0,
                'hispanic_percent': 0,
            },
            'source': 'default',
            'year': 2022
        }
    
    def get_state_income_distribution(self, state_fips: str) -> Dict:
        """
        Fetch state-level income distribution for Lorenz curve and Gini coefficient.

        Uses:
          B19083_001E — Gini coefficient of income inequality (ACS direct estimate)
          B19001_001E — Total households (denominator)
          B19001_002E–017E — Household count by income bracket

        Returns lorenz_data (list of cumulative population/income points),
        waffle_data (aggregated income share groups), gini_coefficient, and
        median_household_income.
        """
        # ACS income bracket variables with their midpoints (in $)
        BRACKETS = [
            ("B19001_002E", "< $10k",        5_000),
            ("B19001_003E", "$10–15k",       12_500),
            ("B19001_004E", "$15–20k",       17_500),
            ("B19001_005E", "$20–25k",       22_500),
            ("B19001_006E", "$25–30k",       27_500),
            ("B19001_007E", "$30–35k",       32_500),
            ("B19001_008E", "$35–40k",       37_500),
            ("B19001_009E", "$40–45k",       42_500),
            ("B19001_010E", "$45–50k",       47_500),
            ("B19001_011E", "$50–60k",       55_000),
            ("B19001_012E", "$60–75k",       67_500),
            ("B19001_013E", "$75–100k",      87_500),
            ("B19001_014E", "$100–125k",    112_500),
            ("B19001_015E", "$125–150k",    137_500),
            ("B19001_016E", "$150–200k",    175_000),
            ("B19001_017E", "$200k+",       350_000),
        ]
        vars_needed = ["B19083_001E", "B19001_001E", "B19013_001E"] + [b[0] for b in BRACKETS]

        try:
            if not self.api_key:
                return {}

            url = self.get_url(",".join(vars_needed), f"state:{state_fips}")
            resp = requests.get(url, timeout=10)
            resp.raise_for_status()
            rows = resp.json()
            if len(rows) < 2:
                return {}

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

            counts = [safe_int(record.get(b[0])) for b in BRACKETS]
            midpoints = [b[2] for b in BRACKETS]
            labels = [b[1] for b in BRACKETS]

            # Build Lorenz curve: cumulative population vs cumulative income
            total_income = sum(c * m for c, m in zip(counts, midpoints)) or 1
            cum_pop = 0.0
            cum_inc = 0.0
            lorenz_data = [{"bracket": "Origin", "cumulativePopulation": 0.0,
                            "cumulativeWealth": 0.0, "percentage": 0.0}]
            for label, count, midpoint in zip(labels, counts, midpoints):
                cum_pop += (count / total_hh) * 100
                cum_inc += (count * midpoint / total_income) * 100
                lorenz_data.append({
                    "bracket": label,
                    "cumulativePopulation": round(cum_pop, 2),
                    "cumulativeWealth": round(cum_inc, 2),
                    "percentage": round((count * midpoint / total_income) * 100, 2),
                })

            # Aggregate into 6 quintile-ish waffle groups
            # Group brackets by cumulative population into ~20% buckets
            WAFFLE_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#0ea5e9", "#3b82f6"]
            WAFFLE_NAMES = ["Bottom 20%", "20–40%", "40–60%", "60–80%", "80–95%", "Top 5%"]
            WAFFLE_THRESHOLDS = [20, 40, 60, 80, 95, 100]

            group_incomes = [0.0] * 6
            cum_pop2 = 0.0
            for count, midpoint in zip(counts, midpoints):
                pop_share = (count / total_hh) * 100
                inc_share = (count * midpoint / total_income) * 100
                cum_pop2 += pop_share
                for gi, threshold in enumerate(WAFFLE_THRESHOLDS):
                    if cum_pop2 <= threshold or gi == 5:
                        group_incomes[gi] += inc_share
                        break

            waffle_data = [
                {"bracket": name, "percentage": round(group_incomes[i], 1), "color": WAFFLE_COLORS[i]}
                for i, name in enumerate(WAFFLE_NAMES)
                if group_incomes[i] > 0
            ]

            return {
                "gini_coefficient": gini,
                "median_household_income": median_income,
                "lorenz_data": lorenz_data,
                "waffle_data": waffle_data,
                "source": "Census ACS B19001/B19083",
                "year": int(self.YEAR),
            }

        except Exception as e:
            logger.error(f"Error fetching income distribution for FIPS {state_fips}: {e}")
            return {}

    def get_county_demographics(self, state_fips: str, county_fips: str) -> Dict:
        """Fetch demographic data for a specific county"""
        try:
            variables = "B01003_001E,B01002_001E,B19013_001E"
            geo_filter = f"county:{county_fips}&in=state:{state_fips}"
            url = self.get_url(variables, geo_filter)
            
            if not self.api_key:
                return {}
            
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            if len(data) > 1:
                return self._parse_census_response(data)
            
            return {}
        
        except Exception as e:
            logger.error(f"Error fetching county data: {e}")
            return {}


# US State FIPS Codes mapping
STATE_FIPS = {
    'AL': '01', 'AK': '02', 'AZ': '04', 'AR': '05', 'CA': '06',
    'CO': '08', 'CT': '09', 'DE': '10', 'FL': '12', 'GA': '13',
    'HI': '15', 'ID': '16', 'IL': '17', 'IN': '18', 'IA': '19',
    'KS': '20', 'KY': '21', 'LA': '22', 'ME': '23', 'MD': '24',
    'MA': '25', 'MI': '26', 'MN': '27', 'MS': '28', 'MO': '29',
    'MT': '30', 'NE': '31', 'NV': '32', 'NH': '33', 'NJ': '34',
    'NM': '35', 'NY': '36', 'NC': '37', 'ND': '38', 'OH': '39',
    'OK': '40', 'OR': '41', 'PA': '42', 'RI': '44', 'SC': '45',
    'SD': '46', 'TN': '47', 'TX': '48', 'UT': '49', 'VT': '50',
    'VA': '51', 'WA': '53', 'WV': '54', 'WI': '55', 'WY': '56'
}


if __name__ == "__main__":
    # Test the API client
    client = CensusAPIClient()
    
    # Fetch data for California (FIPS 06)
    ca_data = client.get_state_demographics('06')
    print("California Demographics:")
    print(json.dumps(ca_data, indent=2))
