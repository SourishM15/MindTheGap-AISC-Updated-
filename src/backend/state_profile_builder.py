"""
Build enriched state profiles from live government API clients.

This module is shared by the FastAPI fallback path and Supabase seeding so
profiles stored in Supabase match what the app builds on demand.
"""
from __future__ import annotations

from datetime import datetime
import logging
from typing import Any

from bea_api_client import BEAAPIClient
from bls_api_client import BLSAPIClient
from census_api_client import CensusAPIClient, STATE_FIPS as CENSUS_STATE_FIPS
from city_api_client import CityAPIClient
from data_enrichment_pipeline import STATES
from fred_api_client import FREDAPIClient
from saipe_api_client import STATE_FIPS as SAIPE_STATE_FIPS, saipe_client

logger = logging.getLogger(__name__)


def safe_slug(value: str) -> str:
    return value.strip().lower().replace(" ", "-")


def resolve_state(state_name_or_code: str) -> tuple[str, str]:
    """Resolve a state name or postal code into (state_code, state_name)."""
    raw = state_name_or_code.strip()
    by_code = {code.upper(): (code, name) for code, name in STATES.items()}
    by_name = {name.lower(): (code, name) for code, name in STATES.items()}

    match = by_code.get(raw.upper()) or by_name.get(raw.lower())
    if not match:
        raise ValueError(f"Unknown state '{state_name_or_code}'")
    return match


def _source_status(payload: dict[str, Any]) -> str:
    return "available" if payload else "unavailable"


def build_api_enriched_state_profile(
    state_name_or_code: str,
    *,
    census_client: CensusAPIClient | None = None,
    bls_client: BLSAPIClient | None = None,
    fred_client: FREDAPIClient | None = None,
    bea_client: BEAAPIClient | None = None,
) -> dict[str, Any]:
    """Build a state profile from live Census, SAIPE, BLS, FRED, and BEA APIs."""
    state_code, state_name = resolve_state(state_name_or_code)
    state_slug = safe_slug(state_name)
    fips = SAIPE_STATE_FIPS.get(state_slug) or CENSUS_STATE_FIPS.get(state_code, "")

    census = census_client or CensusAPIClient()
    bls = bls_client or BLSAPIClient()
    fred = fred_client or FREDAPIClient()
    bea = bea_client or BEAAPIClient()

    census_data: dict[str, Any] = {}
    opportunity_data: dict[str, Any] = {}
    employment_data: dict[str, Any] = {}
    fred_data: dict[str, Any] = {}
    bea_data: dict[str, Any] = {}
    saipe_data: dict[str, Any] = {}

    if fips and fips != "00":
        try:
            census_data = census.get_state_demographics(fips)
        except Exception as exc:
            logger.warning("Census demographics failed for %s: %s", state_name, type(exc).__name__)

        try:
            opportunity_data = census.get_state_opportunity_metrics(fips)
        except Exception as exc:
            logger.warning("ACS opportunity metrics failed for %s: %s", state_name, type(exc).__name__)

        try:
            bea_data = bea.get_state_regional_profile(fips)
        except Exception as exc:
            logger.warning("BEA profile failed for %s: %s", state_name, type(exc).__name__)

    try:
        saipe_data = saipe_client.get_state_snapshot(state_name, year=2023)
    except Exception as exc:
        logger.warning("SAIPE snapshot failed for %s: %s", state_name, type(exc).__name__)

    try:
        employment_data = bls.get_state_unemployment(state_code)
    except Exception as exc:
        logger.warning("BLS unemployment failed for %s: %s", state_name, type(exc).__name__)

    try:
        fred_data = fred.get_state_economic_indicators(state_code)
    except Exception as exc:
        logger.warning("FRED indicators failed for %s: %s", state_name, type(exc).__name__)

    if not any([census_data, opportunity_data, saipe_data, employment_data, fred_data, bea_data]):
        return {}

    demographics = {
        "population": census_data.get("population", 0),
        "median_age": census_data.get("median_age", 0),
        "median_household_income": (
            saipe_data.get("median_household_income")
            or census_data.get("median_household_income", 0)
        ),
        "poverty_rate": saipe_data.get("poverty_rate") or census_data.get("poverty_rate", 0),
        "child_poverty_rate": saipe_data.get("child_poverty_rate"),
        "education_bachelor_and_above": census_data.get("education_bachelor_and_above", 0),
        "race_distribution": census_data.get("race_distribution", {}),
        "source": "Census ACS 2022 + Census SAIPE 2023",
        "year": 2023,
    }

    employment = {
        **employment_data,
        "acs_labor": opportunity_data.get("labor", {}),
        "acs_source": opportunity_data.get("source", "Census Bureau ACS") if opportunity_data else "unavailable",
        "acs_year": opportunity_data.get("year"),
    }

    profile = {
        "identity": {
            "state_code": state_code,
            "state_name": state_name,
            "fips_code": fips,
            "state_slug": state_slug,
            "timestamp": datetime.now().isoformat(),
        },
        "demographics": demographics,
        "saipe": saipe_data,
        "opportunity": opportunity_data,
        "employment": employment,
        "economics": fred_data,
        "bea": bea_data,
        "data_quality": {
            "sources": [
                {"name": "Census Bureau ACS", "status": _source_status(census_data or opportunity_data)},
                {"name": "Census Bureau SAIPE", "status": _source_status(saipe_data)},
                {"name": "Bureau of Labor Statistics", "status": _source_status(employment_data)},
                {"name": "Federal Reserve Economic Data", "status": _source_status(fred_data)},
                {"name": "Bureau of Economic Analysis", "status": _source_status(bea_data)},
            ],
            "last_updated": datetime.now().isoformat(),
        },
        "source": "live_api",
    }

    return profile


def build_api_enriched_metro_profile(
    metro_name: str,
    *,
    city_client: CityAPIClient | None = None,
) -> dict[str, Any]:
    """Build a major metro profile from live Census ACS, BLS LAUS, and state SAIPE APIs."""
    client = city_client or CityAPIClient()
    if metro_name not in client.metro_areas:
        raise ValueError(f"Unknown metro area '{metro_name}'")

    metro_info = client.metro_areas[metro_name]
    demographics = client.get_metro_area_demographics(metro_name) or {}
    employment = client.get_metro_unemployment(metro_name) or {}
    income_distribution = client.get_metro_income_distribution(metro_name) or {}

    if "total_population" in demographics and "population" not in demographics:
        demographics["population"] = demographics["total_population"]

    state_code = metro_info.get("state", "")
    state_name = STATES.get(state_code)
    saipe_data: dict[str, Any] = {}
    if state_name:
        try:
            saipe_data = saipe_client.get_state_snapshot(state_name, year=2023)
            if saipe_data:
                saipe_data["note"] = (
                    f"State-level SAIPE data for {state_name}; metro-level SAIPE is not available"
                )
        except Exception as exc:
            logger.warning("SAIPE snapshot failed for %s metro: %s", metro_name, type(exc).__name__)

    if not any([demographics, employment, income_distribution, saipe_data]):
        return {}

    return {
        "identity": {
            "metro_name": metro_name,
            "metro_slug": safe_slug(metro_name),
            "metro_fips": metro_info.get("fips"),
            "state_code": state_code,
            "state_name": state_name,
            "cities": metro_info.get("cities", []),
            "region_type": "metro",
            "timestamp": datetime.now().isoformat(),
        },
        "demographics": demographics,
        "employment": employment,
        "income_distribution": income_distribution,
        "saipe": saipe_data,
        "data_quality": {
            "sources": [
                {"name": "Census Bureau ACS Metro/Micro Area", "status": _source_status(demographics or income_distribution)},
                {"name": "BLS Local Area Unemployment Statistics", "status": _source_status(employment)},
                {"name": "Census Bureau SAIPE State Snapshot", "status": _source_status(saipe_data)},
            ],
            "last_updated": datetime.now().isoformat(),
        },
        "source": "live_api",
    }
