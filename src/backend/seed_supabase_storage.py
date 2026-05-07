"""
Seed Supabase Storage with government datasets and enriched state profiles.

Examples:
    python seed_supabase_storage.py --dfa
    python seed_supabase_storage.py --states California Minnesota
    python seed_supabase_storage.py --all-states
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, TimeoutError
import json
import logging
import os
from pathlib import Path
import time
from typing import Iterable

from dotenv import load_dotenv
import requests
from supabase import Client, create_client

from data_enrichment_pipeline import STATES
from city_api_client import CityAPIClient
from state_profile_builder import (
    build_api_enriched_metro_profile,
    build_api_enriched_state_profile,
    safe_slug,
)

logger = logging.getLogger(__name__)

BACKEND_DIR = Path(__file__).resolve().parent
DATA_DIR = BACKEND_DIR.parent / "data"
BUCKET = "mindthegap-gov-data"
DFA_PREFIX = "government-data/census"
STATE_PROFILE_PREFIX = "enriched-regional-data/state-profiles"
METRO_PROFILE_PREFIX = "enriched-regional-data/metro-areas"
UPLOAD_FAILURES: list[tuple[str, str]] = []


def _state_slug(state_name: str) -> str:
    return safe_slug(state_name)


def _get_supabase_credentials() -> tuple[str, str]:
    load_dotenv(BACKEND_DIR / ".env", override=True)

    url = os.getenv("SUPABASE_URL")
    key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_KEY")
        or os.getenv("SUPABASE_ANON_KEY")
    )

    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_KEY/SUPABASE_SERVICE_ROLE_KEY must be set in src/backend/.env"
        )

    return url.rstrip("/"), key


def _get_supabase_client() -> Client:
    url, key = _get_supabase_credentials()
    return create_client(url, key)


def _storage_headers(content_type: str = "application/json") -> dict[str, str]:
    _, key = _get_supabase_credentials()
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": content_type,
        "x-upsert": "true",
    }


def _storage_url(key: str) -> str:
    url, _ = _get_supabase_credentials()
    return f"{url}/storage/v1/object/{BUCKET}/{key}"


def _upload(
    key: str,
    data: bytes,
    *,
    content_type: str = "application/json",
    timeout_seconds: int = 45,
    retries: int = 3,
) -> None:
    """Upload to Supabase Storage with retries and explicit HTTP timeouts."""
    last_error: Exception | None = None

    for attempt in range(1, retries + 1):
        try:
            response = requests.post(
                _storage_url(key),
                headers=_storage_headers(content_type),
                data=data,
                timeout=(10, timeout_seconds),
            )
            if response.status_code in (200, 201):
                return
            if response.status_code == 409:
                response = requests.put(
                    _storage_url(key),
                    headers=_storage_headers(content_type),
                    data=data,
                    timeout=(10, timeout_seconds),
                )
                if response.status_code in (200, 201):
                    return
            response.raise_for_status()
            return
        except Exception as exc:
            last_error = exc
            if attempt < retries:
                sleep_seconds = min(2 * attempt, 8)
                logger.warning(
                    "Upload attempt %s/%s failed for %s: %s. Retrying in %ss...",
                    attempt,
                    retries,
                    key,
                    type(exc).__name__,
                    sleep_seconds,
                )
                time.sleep(sleep_seconds)

    raise RuntimeError(f"Failed to upload {key} after {retries} attempts: {last_error}")


def _verify(key: str, *, timeout_seconds: int = 20) -> None:
    """Confirm an uploaded object can be read without letting the batch hang forever."""
    response = requests.get(
        _storage_url(key),
        headers=_storage_headers(),
        timeout=(10, timeout_seconds),
    )
    response.raise_for_status()


def _try_upload(
    key: str,
    data: bytes,
    *,
    content_type: str = "application/json",
    verify: bool = False,
    verify_timeout: int = 20,
    upload_timeout: int = 45,
    retries: int = 3,
) -> bool:
    try:
        _upload(
            key,
            data,
            content_type=content_type,
            timeout_seconds=upload_timeout,
            retries=retries,
        )
        if verify:
            _verify(key, timeout_seconds=verify_timeout)
        logger.info("Uploaded supabase://%s/%s", BUCKET, key)
        return True
    except Exception as exc:
        UPLOAD_FAILURES.append((key, str(exc)))
        logger.error("Failed to upload supabase://%s/%s: %s", BUCKET, key, exc)
        return False


def upload_dfa_csvs(
    client: Client,
    *,
    verify: bool = False,
    verify_timeout: int = 20,
    upload_timeout: int = 45,
    retries: int = 3,
) -> list[str]:
    uploaded: list[str] = []
    csv_paths = sorted(DATA_DIR.glob("dfa-*.csv"))

    if not csv_paths:
        raise RuntimeError(f"No DFA CSV files found in {DATA_DIR}")

    for path in csv_paths:
        key = f"{DFA_PREFIX}/{path.name}"
        if _try_upload(
            key,
            path.read_bytes(),
            content_type="text/csv",
            verify=verify,
            verify_timeout=verify_timeout,
            upload_timeout=upload_timeout,
            retries=retries,
        ):
            uploaded.append(key)

    return uploaded


def resolve_states(state_names: Iterable[str], *, all_states: bool = False) -> list[tuple[str, str]]:
    if all_states:
        return list(STATES.items())

    states_by_code = {code.upper(): (code, name) for code, name in STATES.items()}
    states_by_name = {name.lower(): (code, name) for code, name in STATES.items()}
    resolved: list[tuple[str, str]] = []

    for raw_state in state_names:
        state = raw_state.strip()
        match = states_by_code.get(state.upper()) or states_by_name.get(state.lower())
        if not match:
            valid = ", ".join(STATES.values())
            raise ValueError(f"Unknown state '{raw_state}'. Use a state name/code. Valid names: {valid}")
        resolved.append(match)

    return resolved


def resolve_metros(metro_names: Iterable[str], *, all_metros: bool = False) -> list[str]:
    client = CityAPIClient()
    available = client.metro_areas

    if all_metros:
        return list(available.keys())

    by_slug = {safe_slug(name): name for name in available}
    by_lower = {name.lower(): name for name in available}
    resolved: list[str] = []

    for raw_metro in metro_names:
        metro = raw_metro.strip()
        match = by_lower.get(metro.lower()) or by_slug.get(safe_slug(metro))
        if not match:
            valid = ", ".join(available.keys())
            raise ValueError(f"Unknown metro '{raw_metro}'. Valid metros: {valid}")
        resolved.append(match)

    return resolved


def upload_state_profiles(
    client: Client,
    states: Iterable[tuple[str, str]],
    *,
    verify: bool = False,
    verify_timeout: int = 20,
    upload_timeout: int = 45,
    retries: int = 3,
) -> list[str]:
    uploaded: list[str] = []

    for state_code, state_name in states:
        logger.info("Building API-enriched profile for %s (%s)", state_name, state_code)
        profile = build_api_enriched_state_profile(state_code)

        if not profile:
            logger.warning("Skipping %s because no profile was produced", state_name)
            continue

        state_slug = _state_slug(state_name)
        payloads = {
            f"{STATE_PROFILE_PREFIX}/{state_slug}/profile.json": profile,
        }

        for section in ["demographics", "employment", "economics", "wealth"]:
            if profile.get(section):
                payloads[f"{STATE_PROFILE_PREFIX}/{state_slug}/{section}.json"] = profile[section]

        for key, payload in payloads.items():
            if _try_upload(
                key,
                json.dumps(payload, indent=2, default=str).encode("utf-8"),
                verify=verify,
                verify_timeout=verify_timeout,
                upload_timeout=upload_timeout,
                retries=retries,
            ):
                uploaded.append(key)

    return uploaded


def upload_metro_profiles(
    client: Client,
    metros: Iterable[str],
    *,
    verify: bool = False,
    verify_timeout: int = 20,
    upload_timeout: int = 45,
    retries: int = 3,
) -> list[str]:
    uploaded: list[str] = []
    city_client = CityAPIClient()

    for metro_name in metros:
        logger.info("Building API-enriched metro profile for %s", metro_name)
        profile = build_api_enriched_metro_profile(metro_name, city_client=city_client)

        if not profile:
            logger.warning("Skipping %s because no metro profile was produced", metro_name)
            continue

        metro_slug = safe_slug(metro_name)
        payloads = {
            f"{METRO_PROFILE_PREFIX}/{metro_slug}/profile.json": profile,
        }

        for section in ["demographics", "employment", "income_distribution", "saipe"]:
            if profile.get(section):
                payloads[f"{METRO_PROFILE_PREFIX}/{metro_slug}/{section}.json"] = profile[section]

        for key, payload in payloads.items():
            if _try_upload(
                key,
                json.dumps(payload, indent=2, default=str).encode("utf-8"),
                verify=verify,
                verify_timeout=verify_timeout,
                upload_timeout=upload_timeout,
                retries=retries,
            ):
                uploaded.append(key)

    return uploaded


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Upload local DFA CSVs and/or enriched state/metro profiles to Supabase Storage."
    )
    parser.add_argument("--dfa", action="store_true", help="Upload local src/data/dfa-*.csv files.")
    parser.add_argument(
        "--states",
        nargs="+",
        default=[],
        help="Build and upload enriched profiles for specific state names or postal codes.",
    )
    parser.add_argument(
        "--all-states",
        action="store_true",
        help="Build and upload enriched profiles for every state. This can take a while.",
    )
    parser.add_argument(
        "--metros",
        nargs="+",
        default=[],
        help="Build and upload enriched profiles for specific major metro names. Use quotes for multi-word names.",
    )
    parser.add_argument(
        "--all-metros",
        action="store_true",
        help="Build and upload enriched profiles for all curated major metro areas.",
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Download each uploaded object once to confirm it exists in Supabase Storage.",
    )
    parser.add_argument(
        "--verify-timeout",
        type=int,
        default=20,
        help="Seconds to wait for each verification download before failing.",
    )
    parser.add_argument(
        "--upload-timeout",
        type=int,
        default=45,
        help="Seconds to wait for each Supabase upload response before retrying.",
    )
    parser.add_argument(
        "--retries",
        type=int,
        default=3,
        help="Upload attempts per object before recording a failure and continuing.",
    )
    return parser.parse_args()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s:%(message)s")
    args = parse_args()

    if not args.dfa and not args.states and not args.all_states and not args.metros and not args.all_metros:
        raise SystemExit("Choose at least one action: --dfa, --states ..., --all-states, --metros ..., or --all-metros")

    client = _get_supabase_client()
    uploaded: list[str] = []

    if args.dfa:
        uploaded.extend(
            upload_dfa_csvs(
                client,
                verify=args.verify,
                verify_timeout=args.verify_timeout,
                upload_timeout=args.upload_timeout,
                retries=args.retries,
            )
        )

    state_targets = resolve_states(args.states, all_states=args.all_states)
    if state_targets:
        uploaded.extend(
            upload_state_profiles(
                client,
                state_targets,
                verify=args.verify,
                verify_timeout=args.verify_timeout,
                upload_timeout=args.upload_timeout,
                retries=args.retries,
            )
        )

    metro_targets = resolve_metros(args.metros, all_metros=args.all_metros)
    if metro_targets:
        uploaded.extend(
            upload_metro_profiles(
                client,
                metro_targets,
                verify=args.verify,
                verify_timeout=args.verify_timeout,
                upload_timeout=args.upload_timeout,
                retries=args.retries,
            )
        )

    print("\nSeed complete.")
    print(f"Uploaded {len(uploaded)} object(s) to supabase://{BUCKET}")
    for key in uploaded:
        print(f"  - {key}")
    if UPLOAD_FAILURES:
        print(f"\nFailed {len(UPLOAD_FAILURES)} object(s):")
        for key, error in UPLOAD_FAILURES:
            print(f"  - {key}: {error}")


if __name__ == "__main__":
    main()
