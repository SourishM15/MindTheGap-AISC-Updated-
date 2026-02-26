"""
Census Bureau SAIPE (Small Area Income and Poverty Estimates) API Client

Provides state- and county-level annual estimates of:
  - Median household income
  - Poverty rate (all ages)
  - Child poverty rate (under 18)
  - Number of people in poverty

API docs: https://www.census.gov/data/developers/data-sets/Poverty-Statistics.html
Endpoint: https://api.census.gov/data/timeseries/poverty/saipe
Key signup: https://api.census.gov/data/key_signup.html  (same key as Census ACS)
"""
import os
import requests
import logging
from typing import Dict, List, Optional
from dotenv import load_dotenv

logger = logging.getLogger(__name__)
load_dotenv()

# All 50 states + DC: name (lowercase, no spaces) → FIPS code
STATE_FIPS: Dict[str, str] = {
    "alabama": "01", "alaska": "02", "arizona": "04", "arkansas": "05",
    "california": "06", "colorado": "08", "connecticut": "09", "delaware": "10",
    "district-of-columbia": "11", "florida": "12", "georgia": "13",
    "hawaii": "15", "idaho": "16", "illinois": "17", "indiana": "18",
    "iowa": "19", "kansas": "20", "kentucky": "21", "louisiana": "22",
    "maine": "23", "maryland": "24", "massachusetts": "25", "michigan": "26",
    "minnesota": "27", "mississippi": "28", "missouri": "29", "montana": "30",
    "nebraska": "31", "nevada": "32", "new-hampshire": "33", "new-jersey": "34",
    "new-mexico": "35", "new-york": "36", "north-carolina": "37",
    "north-dakota": "38", "ohio": "39", "oklahoma": "40", "oregon": "41",
    "pennsylvania": "42", "rhode-island": "44", "south-carolina": "45",
    "south-dakota": "46", "tennessee": "47", "texas": "48", "utah": "49",
    "vermont": "50", "virginia": "51", "washington": "53",
    "west-virginia": "54", "wisconsin": "55", "wyoming": "56",
    "united-states": "00", "us": "00",
}

# Reverse lookup: FIPS → display name
FIPS_TO_NAME: Dict[str, str] = {v: k.replace("-", " ").title() for k, v in STATE_FIPS.items()}

SAIPE_BASE_URL = "https://api.census.gov/data/timeseries/poverty/saipe"

# Core SAIPE variables
SAIPE_VARS = [
    "NAME",               # State name
    "SAEPOVRTALL_PT",     # Poverty rate – all ages (%)
    "SAEPOVALL_PT",       # Number in poverty – all ages
    "SAEMHI_PT",          # Median household income ($)
    "SAEPOVRT0_17_PT",    # Poverty rate – under 18 (%)
    "SAEPOV0_17_PT",      # Number in poverty – under 18
]


def _state_slug(state_name: str) -> str:
    """Normalise a state name to a slug for FIPS lookup."""
    return state_name.strip().lower().replace(" ", "-")


class SAIPEClient:
    """Fetch SAIPE data from the Census Bureau API."""

    def __init__(self):
        self.api_key = os.getenv("CENSUS_API_KEY")
        if not self.api_key:
            logger.warning("CENSUS_API_KEY not found – SAIPE data will be unavailable.")

    def _get_fips(self, state_name: str) -> Optional[str]:
        slug = _state_slug(state_name)
        fips = STATE_FIPS.get(slug)
        if not fips:
            logger.warning(f"No FIPS code found for state: '{state_name}'")
        return fips

    # ------------------------------------------------------------------ #
    #  Single-year snapshot for a state                                   #
    # ------------------------------------------------------------------ #
    def get_state_snapshot(self, state_name: str, year: int = 2023) -> Dict:
        """
        Return the latest SAIPE snapshot for a single state (or US national).
        """
        fips = self._get_fips(state_name)
        if not fips:
            return {}
        if not self.api_key:
            return self._fallback_snapshot(state_name, fips)

        # SAIPE uses 'us:*' for national, 'state:{fips}' for states
        geo = "us:*" if fips == "00" else f"state:{fips}"

        try:
            resp = requests.get(
                SAIPE_BASE_URL,
                params={
                    "get": ",".join(SAIPE_VARS),
                    "for": geo,
                    "time": str(year),
                    "key": self.api_key,
                },
                timeout=10,
            )
            resp.raise_for_status()
            rows = resp.json()
            if len(rows) < 2:
                return {}
            header, data_row = rows[0], rows[1]
            record = dict(zip(header, data_row))
            return self._parse_snapshot(record, year, state_name, fips)

        except requests.RequestException as exc:
            logger.error(f"SAIPE request failed for {state_name} {year}: {exc}")
            return self._fallback_snapshot(state_name, fips)

    # ------------------------------------------------------------------ #
    #  Multi-year time series for a state                                 #
    # ------------------------------------------------------------------ #
    def get_state_time_series(
        self,
        state_name: str,
        start_year: int = 1995,
        end_year: int = 2023,
    ) -> List[Dict]:
        """
        Return annual SAIPE data for a state from start_year to end_year.
        Uses a single bulk API call (time=from+YYYY+to+YYYY) instead of
        one request per year.
        """
        fips = self._get_fips(state_name)
        if not fips or not self.api_key:
            return self._fallback_time_series(state_name, start_year, end_year)

        geo = "us:*" if fips == "00" else f"state:{fips}"

        try:
            resp = requests.get(
                SAIPE_BASE_URL,
                params={
                    "get": ",".join(SAIPE_VARS),
                    "for": geo,
                    "time": f"from+{start_year}+to+{end_year}",
                    "key": self.api_key,
                },
                timeout=20,
            )
            resp.raise_for_status()
            rows = resp.json()
            if len(rows) < 2:
                return self._fallback_time_series(state_name, start_year, end_year)

            header = rows[0]
            results = []
            for row in rows[1:]:
                record = dict(zip(header, row))
                year_val = int(record.get("time", 0))
                snapshot = self._parse_snapshot(record, year_val, state_name, fips)
                if snapshot:
                    results.append({
                        "year": year_val,
                        "poverty_rate": snapshot.get("poverty_rate"),
                        "child_poverty_rate": snapshot.get("child_poverty_rate"),
                        "median_household_income": snapshot.get("median_household_income"),
                    })
            return sorted(results, key=lambda x: x["year"])

        except requests.RequestException as exc:
            logger.error(f"SAIPE time series failed for {state_name}: {exc}")
            return self._fallback_time_series(state_name, start_year, end_year)

    # ------------------------------------------------------------------ #
    #  All states – single year comparison                                #
    # ------------------------------------------------------------------ #
    def get_all_states_snapshot(self, year: int = 2023) -> List[Dict]:
        """
        Fetch SAIPE data for every state in one API call.
        Useful for map/comparison views.
        """
        if not self.api_key:
            return []
        try:
            resp = requests.get(
                SAIPE_BASE_URL,
                params={
                    "get": ",".join(SAIPE_VARS),
                    "for": "state:*",
                    "time": str(year),
                    "key": self.api_key,
                },
                timeout=15,
            )
            resp.raise_for_status()
            rows = resp.json()
            if len(rows) < 2:
                return []
            header = rows[0]
            results = []
            for row in rows[1:]:
                record = dict(zip(header, row))
                fips = record.get("state", "")
                state_name = FIPS_TO_NAME.get(fips, fips)
                parsed = self._parse_snapshot(record, year, state_name, fips)
                if parsed:
                    results.append(parsed)
            return sorted(results, key=lambda x: x.get("state_name", ""))
        except requests.RequestException as exc:
            logger.error(f"SAIPE all-states request failed: {exc}")
            return []

    # ------------------------------------------------------------------ #
    #  Internal helpers                                                   #
    # ------------------------------------------------------------------ #
    def _parse_snapshot(self, record: Dict, year: int, state_name: str, fips: str) -> Dict:
        def _float(key: str) -> Optional[float]:
            v = record.get(key)
            try:
                return round(float(v), 2) if v not in (None, "", "-1") else None
            except (ValueError, TypeError):
                return None

        def _int(key: str) -> Optional[int]:
            v = record.get(key)
            try:
                return int(v) if v not in (None, "", "-1") else None
            except (ValueError, TypeError):
                return None

        poverty_rate = _float("SAEPOVRTALL_PT")
        child_poverty_rate = _float("SAEPOVRT0_17_PT")
        median_income = _int("SAEMHI_PT")
        poverty_count = _int("SAEPOVALL_PT")
        child_poverty_count = _int("SAEPOV0_17_PT")

        if poverty_rate is None and median_income is None:
            return {}

        return {
            "state_name": record.get("NAME", state_name).title(),
            "fips": fips,
            "year": year,
            "poverty_rate": poverty_rate,
            "child_poverty_rate": child_poverty_rate,
            "median_household_income": median_income,
            "poverty_count": poverty_count,
            "child_poverty_count": child_poverty_count,
            "source": "Census Bureau SAIPE",
        }

    def _fallback_snapshot(self, state_name: str, fips: str) -> Dict:
        """Return None-filled skeleton when API key missing."""
        return {
            "state_name": state_name.title(),
            "fips": fips,
            "year": 2023,
            "poverty_rate": None,
            "child_poverty_rate": None,
            "median_household_income": None,
            "poverty_count": None,
            "child_poverty_count": None,
            "source": "Census Bureau SAIPE (API key required)",
            "note": "Set CENSUS_API_KEY in .env to enable live SAIPE data",
        }

    def _fallback_time_series(
        self, state_name: str, start_year: int, end_year: int
    ) -> List[Dict]:
        return [
            {
                "year": y,
                "poverty_rate": None,
                "child_poverty_rate": None,
                "median_household_income": None,
            }
            for y in range(start_year, end_year + 1)
        ]


# Module-level singleton
saipe_client = SAIPEClient()
