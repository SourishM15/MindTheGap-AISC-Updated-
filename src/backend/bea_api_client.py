"""
Bureau of Economic Analysis (BEA) API client.

Fetches state-level regional economic context: GDP, personal income,
per-capita personal income, and regional price parities where available.
"""
import logging
import os
from pathlib import Path
from typing import Dict, List, Optional

import requests
from dotenv import load_dotenv

logger = logging.getLogger(__name__)
load_dotenv(Path(__file__).with_name(".env"), override=True)


class BEAAPIClient:
    """Fetch state regional economic data from BEA's Regional dataset."""

    BASE_URL = "https://apps.bea.gov/api/data"

    def __init__(self):
        self.api_key = os.getenv("BEA_API_KEY")
        if not self.api_key:
            logger.warning("BEA_API_KEY not found. BEA data will be unavailable.")
            logger.info("Get a BEA API key at: https://apps.bea.gov/api/signup/")

    def get_state_regional_profile(self, state_fips: str) -> Dict:
        """
        Return a compact BEA state profile.

        BEA Regional geographies generally use 5-digit GeoFips codes for states
        (for example California is 06000). A two-digit state FIPS fallback is
        also attempted for tables that use state-only codes.
        """
        if not self.api_key:
            return {}

        geo_fips = self._state_geo_fips(state_fips)
        candidates = [geo_fips]
        if state_fips not in candidates:
            candidates.append(state_fips)

        metrics = {
            "real_gdp": self._fetch_metric("SAGDP1", "1", candidates, "LAST5"),
            "current_dollar_gdp": self._fetch_metric("SAGDP1", "3", candidates, "LAST5"),
            "personal_income": self._fetch_metric("SAINC1", "1", candidates, "LAST5"),
            "population": self._fetch_metric("SAINC1", "2", candidates, "LAST5"),
            "per_capita_personal_income": self._fetch_metric("SAINC1", "3", candidates, "LAST5"),
            "regional_price_parity": self._fetch_metric("SARPP", "1", candidates, "LAST5"),
            "housing_rent_price_parity": self._fetch_metric("SARPP", "3", candidates, "LAST5"),
        }

        available_metrics = {key: value for key, value in metrics.items() if value}
        if not available_metrics:
            return {}

        return {
            "state_fips": state_fips,
            "geo_fips": geo_fips,
            "metrics": available_metrics,
            "source": "U.S. Bureau of Economic Analysis Regional API",
        }

    def _fetch_metric(
        self,
        table_name: str,
        line_code: str,
        geo_fips_candidates: List[str],
        year: str,
    ) -> Optional[Dict]:
        for geo_fips in geo_fips_candidates:
            rows = self._get_regional_rows(table_name, line_code, geo_fips, year)
            latest = self._latest_numeric_row(rows)
            if latest:
                latest["table_name"] = table_name
                latest["line_code"] = line_code
                latest["geo_fips"] = geo_fips
                return latest
        return None

    def _get_regional_rows(self, table_name: str, line_code: str, geo_fips: str, year: str) -> List[Dict]:
        try:
            params = {
                "UserID": self.api_key,
                "method": "GetData",
                "datasetname": "Regional",
                "TableName": table_name,
                "LineCode": line_code,
                "GeoFips": geo_fips,
                "Year": year,
                "ResultFormat": "JSON",
            }
            response = requests.get(self.BASE_URL, params=params, timeout=12)
            response.raise_for_status()
            payload = response.json()
            results = payload.get("BEAAPI", {}).get("Results", {})
            if isinstance(results, dict) and results.get("Error"):
                logger.debug("BEA returned no rows for %s line %s geo %s", table_name, line_code, geo_fips)
                return []
            data = results.get("Data", []) if isinstance(results, dict) else []
            return data if isinstance(data, list) else []
        except Exception as e:
            logger.warning("BEA request failed for %s line %s geo %s: %s", table_name, line_code, geo_fips, type(e).__name__)
            return []

    def _latest_numeric_row(self, rows: List[Dict]) -> Optional[Dict]:
        parsed_rows = []
        for row in rows:
            value = self._parse_data_value(row.get("DataValue"))
            period = row.get("TimePeriod")
            if value is None or not period:
                continue
            parsed_rows.append((str(period), value, row))

        if not parsed_rows:
            return None

        period, value, row = sorted(parsed_rows, key=lambda item: item[0])[-1]
        return {
            "value": value,
            "period": period,
            "description": row.get("Description"),
            "unit": row.get("CL_UNIT") or row.get("UNIT_MULT"),
        }

    def _parse_data_value(self, value) -> Optional[float]:
        if value in (None, "", "(NA)", "NA", "---"):
            return None
        try:
            return float(str(value).replace(",", ""))
        except (TypeError, ValueError):
            return None

    def _state_geo_fips(self, state_fips: str) -> str:
        clean = str(state_fips).zfill(2)
        if clean == "00" or len(clean) == 5:
            return clean
        return f"{clean}000"


if __name__ == "__main__":
    import json

    client = BEAAPIClient()
    print(json.dumps(client.get_state_regional_profile("06"), indent=2))
