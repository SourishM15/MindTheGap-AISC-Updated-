"""
Sync government data into Supabase normalized tables.

This module is imported by /api/admin/sync-government-data. It can also be run:
  python src/backend/sync_government_data.py --states California Texas
"""
import argparse
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from dotenv import load_dotenv

from bea_api_client import BEAAPIClient
from census_api_client import CensusAPIClient
from saipe_api_client import FIPS_TO_NAME, STATE_FIPS, saipe_client
from supabase_db import get_db

logger = logging.getLogger(__name__)
load_dotenv(Path(__file__).with_name(".env"), override=True)

ACS_SOURCE_URL = "https://www.census.gov/programs-surveys/acs/data/data-via-api.html"
SAIPE_SOURCE_URL = "https://www.census.gov/programs-surveys/saipe/data/api.html"
BEA_SOURCE_URL = "https://www.bea.gov/open-data"


def sync_all(states: Optional[List[str]] = None) -> bool:
    """Sync selected states, or all states when states is omitted."""
    db = get_db()
    if not db or not db.client:
        logger.error("Supabase is not configured. Check SUPABASE_URL and SUPABASE_KEY.")
        return False

    run_id = db.create_source_run(
        "government_data_sync",
        {
            "requested_states": states or "all",
            "sources": ["Census ACS", "Census SAIPE", "BEA Regional"],
        },
    )

    try:
        rows_written = 0
        quality_issues: List[Dict[str, Any]] = []
        census = CensusAPIClient()
        bea = BEAAPIClient()

        for state_name, fips in _iter_states(states):
            metric_rows, issue_rows = _build_state_rows(state_name, fips, census, bea)
            if metric_rows:
                if db.upsert_state_metrics(metric_rows):
                    rows_written += len(metric_rows)
            quality_issues.extend(issue_rows)

        if quality_issues:
            db.insert_data_quality_issues(quality_issues)

        db.finish_source_run(run_id, "success", records_written=rows_written)
        logger.info("Government data sync complete: %s rows", rows_written)
        return True
    except Exception as e:
        db.finish_source_run(run_id, "failed", error_message=str(e))
        logger.error("Government data sync failed: %s", type(e).__name__)
        return False


def _iter_states(states: Optional[List[str]]) -> Iterable[tuple[str, str]]:
    if states:
        requested = {state.strip().lower().replace(" ", "-") for state in states}
        for slug in requested:
            fips = STATE_FIPS.get(slug)
            if fips and fips != "00":
                yield _display_name(slug, fips), fips
        return

    limit = _sync_limit()
    count = 0
    for slug, fips in sorted(STATE_FIPS.items(), key=lambda item: item[1]):
        if fips == "00":
            continue
        if limit is not None and count >= limit:
            break
        yield _display_name(slug, fips), fips
        count += 1


def _sync_limit() -> Optional[int]:
    raw = os.getenv("SYNC_STATE_LIMIT")
    if not raw:
        return None
    try:
        value = int(raw)
        return value if value > 0 else None
    except ValueError:
        return None


def _display_name(slug: str, fips: str) -> str:
    return FIPS_TO_NAME.get(fips) or slug.replace("-", " ").title()


def _build_state_rows(
    state_name: str,
    fips: str,
    census: CensusAPIClient,
    bea: BEAAPIClient,
) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    rows: List[Dict[str, Any]] = []
    issues: List[Dict[str, Any]] = []

    demographics = census.get_state_demographics(fips)
    if demographics:
        rows.extend(_acs_demographic_rows(state_name, fips, demographics))
    else:
        issues.append(_missing_issue(state_name, fips, "acs_demographics", "Census ACS demographic snapshot unavailable"))

    opportunity = census.get_state_opportunity_metrics(fips)
    if opportunity:
        rows.extend(_acs_opportunity_rows(state_name, fips, opportunity))
    else:
        issues.append(_missing_issue(state_name, fips, "acs_opportunity", "Census ACS labor/housing opportunity snapshot unavailable"))

    saipe = saipe_client.get_state_snapshot(state_name, year=2023)
    if saipe:
        rows.extend(_saipe_rows(state_name, fips, saipe))
    else:
        issues.append(_missing_issue(state_name, fips, "saipe_snapshot", "Census SAIPE snapshot unavailable"))

    bea_profile = bea.get_state_regional_profile(fips)
    if bea_profile:
        rows.extend(_bea_rows(state_name, fips, bea_profile))
    else:
        issues.append(_missing_issue(state_name, fips, "bea_regional_profile", "BEA Regional profile unavailable"))

    return rows, issues


def _metric_row(
    state_name: str,
    fips: str,
    key: str,
    label: str,
    value: Any,
    unit: str,
    period: Any,
    source: str,
    source_table: str,
    source_url: str,
    raw: Optional[Dict[str, Any]] = None,
    vintage_year: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    if value is None:
        return None
    try:
        numeric_value = float(value)
    except (TypeError, ValueError):
        return None

    return {
        "state_name": state_name,
        "state_fips": fips,
        "metric_key": key,
        "metric_label": label,
        "value": numeric_value,
        "unit": unit,
        "period": str(period),
        "source": source,
        "source_table": source_table,
        "source_url": source_url,
        "vintage_year": vintage_year,
        "fetched_at": datetime.now().isoformat(),
        "raw": raw or {},
    }


def _compact(rows: Iterable[Optional[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    return [row for row in rows if row is not None]


def _acs_demographic_rows(state_name: str, fips: str, data: Dict[str, Any]) -> List[Dict[str, Any]]:
    year = data.get("year", 2022)
    source = data.get("source", "Census Bureau ACS")
    return _compact([
        _metric_row(state_name, fips, "population", "Population", data.get("population"), "people", year, source, "ACS B01003", ACS_SOURCE_URL, data, year),
        _metric_row(state_name, fips, "median_age", "Median Age", data.get("median_age"), "years", year, source, "ACS B01002", ACS_SOURCE_URL, data, year),
        _metric_row(state_name, fips, "acs_median_household_income", "ACS Median Household Income", data.get("median_household_income"), "dollars", year, source, "ACS B19013", ACS_SOURCE_URL, data, year),
        _metric_row(state_name, fips, "acs_poverty_rate", "ACS Poverty Rate", data.get("poverty_rate"), "percent", year, source, "ACS B17001", ACS_SOURCE_URL, data, year),
        _metric_row(state_name, fips, "education_bachelor_plus", "Bachelor's Degree or Higher", data.get("education_bachelor_and_above"), "percent", year, source, "ACS B15003", ACS_SOURCE_URL, data, year),
    ])


def _acs_opportunity_rows(state_name: str, fips: str, data: Dict[str, Any]) -> List[Dict[str, Any]]:
    year = data.get("year", 2022)
    source = data.get("source", "Census Bureau ACS")
    labor = data.get("labor", {})
    income = data.get("income", {})
    housing = data.get("housing", {})
    safety_net = data.get("safety_net", {})

    specs = [
        ("labor_force", "Labor Force", labor.get("labor_force"), "people", "ACS B23025"),
        ("employed", "Employed Population", labor.get("employed"), "people", "ACS B23025"),
        ("unemployed", "Unemployed Population", labor.get("unemployed"), "people", "ACS B23025"),
        ("labor_force_participation_rate", "Labor Force Participation Rate", labor.get("labor_force_participation_rate"), "percent", "ACS B23025"),
        ("employment_population_ratio", "Employment-Population Ratio", labor.get("employment_population_ratio"), "percent", "ACS B23025"),
        ("acs_unemployment_rate", "ACS Unemployment Rate", labor.get("acs_unemployment_rate"), "percent", "ACS B23025"),
        ("per_capita_income", "Per-Capita Income", income.get("per_capita_income"), "dollars", "ACS B19301"),
        ("median_gross_rent", "Median Gross Rent", housing.get("median_gross_rent"), "dollars", "ACS B25064"),
        ("median_home_value", "Median Home Value", housing.get("median_home_value"), "dollars", "ACS B25077"),
        ("homeownership_rate", "Homeownership Rate", housing.get("homeownership_rate"), "percent", "ACS B25003"),
        ("rent_burdened_rate", "Rent-Burdened Renter Households", housing.get("rent_burdened_rate"), "percent", "ACS B25070"),
        ("snap_household_rate", "SNAP Household Rate", safety_net.get("snap_household_rate"), "percent", "ACS B22010"),
        ("public_assistance_rate", "Public Assistance Household Rate", safety_net.get("public_assistance_rate"), "percent", "ACS B19057"),
    ]

    return _compact([
        _metric_row(state_name, fips, key, label, value, unit, year, source, table, ACS_SOURCE_URL, data, year)
        for key, label, value, unit, table in specs
    ])


def _saipe_rows(state_name: str, fips: str, data: Dict[str, Any]) -> List[Dict[str, Any]]:
    year = data.get("year", 2023)
    source = data.get("source", "Census Bureau SAIPE")
    return _compact([
        _metric_row(state_name, fips, "poverty_rate", "SAIPE Poverty Rate", data.get("poverty_rate"), "percent", year, source, "SAIPE", SAIPE_SOURCE_URL, data, year),
        _metric_row(state_name, fips, "child_poverty_rate", "SAIPE Child Poverty Rate", data.get("child_poverty_rate"), "percent", year, source, "SAIPE", SAIPE_SOURCE_URL, data, year),
        _metric_row(state_name, fips, "poverty_count", "People in Poverty", data.get("poverty_count"), "people", year, source, "SAIPE", SAIPE_SOURCE_URL, data, year),
        _metric_row(state_name, fips, "child_poverty_count", "Children in Poverty", data.get("child_poverty_count"), "people", year, source, "SAIPE", SAIPE_SOURCE_URL, data, year),
        _metric_row(state_name, fips, "median_household_income", "SAIPE Median Household Income", data.get("median_household_income"), "dollars", year, source, "SAIPE", SAIPE_SOURCE_URL, data, year),
    ])


def _bea_rows(state_name: str, fips: str, data: Dict[str, Any]) -> List[Dict[str, Any]]:
    rows: List[Optional[Dict[str, Any]]] = []
    for key, metric in data.get("metrics", {}).items():
        period = metric.get("period")
        year = _period_year(period)
        rows.append(_metric_row(
            state_name,
            fips,
            f"bea_{key}",
            _title_from_key(key),
            metric.get("value"),
            metric.get("unit") or "index",
            period,
            data.get("source", "U.S. Bureau of Economic Analysis Regional API"),
            f"{metric.get('table_name')} line {metric.get('line_code')}",
            BEA_SOURCE_URL,
            metric,
            year,
        ))
    return _compact(rows)


def _period_year(period: Any) -> Optional[int]:
    if period is None:
        return None
    text = str(period)
    try:
        return int(text[:4])
    except ValueError:
        return None


def _title_from_key(key: str) -> str:
    return key.replace("_", " ").title()


def _missing_issue(state_name: str, fips: str, metric_key: str, message: str) -> Dict[str, Any]:
    return {
        "state_name": state_name,
        "state_fips": fips,
        "metric_key": metric_key,
        "severity": "warning",
        "issue_type": "missing_upstream_data",
        "message": message,
        "source": "government_data_sync",
        "created_at": datetime.now().isoformat(),
        "raw": {},
    }


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%H:%M:%S",
    )
    parser = argparse.ArgumentParser(description="Sync government data into Supabase")
    parser.add_argument("--states", nargs="*", help="Optional state names to sync")
    args = parser.parse_args()
    return 0 if sync_all(args.states) else 1


if __name__ == "__main__":
    raise SystemExit(main())
