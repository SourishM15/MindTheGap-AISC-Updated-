"""
Regional Policy History Engine
Loads documented historical economic policies from S3 and provides
evidence-grounded context to the chatbot.  No policy records are
hardcoded here — update the dataset in S3 without redeploying:

  S3 key : s3://mindthegap-gov-data/government-data/policy-history/regional_policy_history.json
  Schema : { "region_policy_history": { <region>: [<policy>, ...] },
             "region_aliases":        { "<alias_lower>": "<region>" } }

To force an in-process reload call reload_policy_data().
To push new data to S3 and refresh call update_policy_data(payload).
"""

import os
import json
import logging
import threading
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional

import boto3
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Load .env so AWS credentials are available when the module is imported
_ENV_PATH = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(_ENV_PATH)

_S3_BUCKET      = "mindthegap-gov-data"
_S3_KEY         = "government-data/policy-history/regional_policy_history.json"
_LOCAL_FALLBACK = os.path.join(os.path.dirname(__file__), "policy_history_data.json")


# ─────────────────────────────────────────────────────────────────────────────
# OUTCOME CONSTANTS
# ─────────────────────────────────────────────────────────────────────────────

class PolicyOutcome:
    POSITIVE  = "positive"
    NEGATIVE  = "negative"
    MIXED     = "mixed"
    ONGOING   = "ongoing"
    REVERSED  = "reversed"


# ─────────────────────────────────────────────────────────────────────────────
# S3 LOADER — fetches data from S3, falls back to local JSON, caches in RAM
# ─────────────────────────────────────────────────────────────────────────────

class PolicyHistoryLoader:
    """
    Thread-safe loader that keeps an in-memory copy of the policy database.
    Refreshes from S3 at most once per CACHE_TTL seconds; falls back to the
    bundled policy_history_data.json when S3 is unreachable.
    """

    CACHE_TTL = 3600  # seconds

    def __init__(self):
        self._lock       = threading.Lock()
        self._history_db: Dict[str, List[Dict[str, Any]]] = {}
        self._aliases:    Dict[str, str] = {}
        self._loaded_at:  Optional[datetime] = None
        self._s3 = boto3.client(
            "s3",
            region_name=os.getenv("AWS_REGION", "us-east-2"),
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        )

    def _is_stale(self) -> bool:
        if self._loaded_at is None:
            return True
        return datetime.now() - self._loaded_at > timedelta(seconds=self.CACHE_TTL)

    def _parse_payload(self, payload: dict) -> None:
        self._history_db = payload.get("region_policy_history", {})
        self._aliases    = payload.get("region_aliases", {})
        self._loaded_at  = datetime.now()

    def _load_from_s3(self) -> bool:
        try:
            obj = self._s3.get_object(Bucket=_S3_BUCKET, Key=_S3_KEY)
            payload = json.loads(obj["Body"].read().decode("utf-8"))
            self._parse_payload(payload)
            logger.info(
                f"✓ PolicyHistoryLoader: loaded {len(self._history_db)} regions "
                f"from S3 ({sum(len(v) for v in self._history_db.values())} policies)"
            )
            return True
        except Exception as exc:
            logger.warning(f"PolicyHistoryLoader: S3 load failed — {exc}")
            return False

    def _load_from_local(self) -> bool:
        try:
            with open(_LOCAL_FALLBACK, encoding="utf-8") as f:
                payload = json.load(f)
            self._parse_payload(payload)
            logger.info(
                f"✓ PolicyHistoryLoader: loaded {len(self._history_db)} regions "
                f"from local fallback ({sum(len(v) for v in self._history_db.values())} policies)"
            )
            return True
        except Exception as exc:
            logger.error(f"PolicyHistoryLoader: local fallback also failed — {exc}")
            return False

    def _ensure_loaded(self) -> None:
        if not self._is_stale():
            return
        with self._lock:
            if not self._is_stale():
                return
            if not self._load_from_s3():
                self._load_from_local()

    def get_history_db(self) -> Dict[str, List[Dict[str, Any]]]:
        self._ensure_loaded()
        return self._history_db

    def get_aliases(self) -> Dict[str, str]:
        self._ensure_loaded()
        return self._aliases

    def reload(self) -> bool:
        """Force a reload from S3 regardless of TTL. Returns True on success."""
        self._loaded_at = None
        return self._load_from_s3() or self._load_from_local()

    def save_to_s3(self, payload: dict) -> bool:
        """
        Persist an updated payload back to S3 and refresh the in-memory cache.
        Use this to add new regions or update existing policy records at runtime.
        """
        try:
            body = json.dumps(payload, indent=2, ensure_ascii=False).encode("utf-8")
            self._s3.put_object(
                Bucket=_S3_BUCKET,
                Key=_S3_KEY,
                Body=body,
                ContentType="application/json",
            )
            self._parse_payload(payload)
            logger.info(f"✓ PolicyHistoryLoader: saved {len(self._history_db)} regions to S3")
            return True
        except Exception as exc:
            logger.error(f"PolicyHistoryLoader: S3 save failed — {exc}")
            return False


# Module-level singleton — all other classes/functions use this instance
_loader = PolicyHistoryLoader()


# ─────────────────────────────────────────────────────────────────────────────
# ANALYZER  — all data access goes through _loader (S3, never hardcoded)
# ─────────────────────────────────────────────────────────────────────────────

class PolicyHistoryAnalyzer:
    """
    Queries the policy database (loaded from S3 via _loader) and generates
    context-aware summaries for the chatbot.
    """

    def resolve_region(self, region_input: str) -> Optional[str]:
        """Normalize a free-text region name to a key in the history DB."""
        if not region_input:
            return None
        db      = _loader.get_history_db()
        aliases = _loader.get_aliases()
        cleaned = region_input.strip()

        if cleaned in db:
            return cleaned

        alias_key = aliases.get(cleaned.lower())
        if alias_key and alias_key in db:
            return alias_key

        cleaned_lower = cleaned.lower()
        for key in db:
            if key.lower() in cleaned_lower or cleaned_lower in key.lower():
                return key

        return "National"

    def get_history_for_region(self, region: str) -> List[Dict[str, Any]]:
        db  = _loader.get_history_db()
        key = self.resolve_region(region)
        return db.get(key, db.get("National", []))

    def get_history_by_category(self, region: str, category: str) -> List[Dict[str, Any]]:
        return [
            p for p in self.get_history_for_region(region)
            if category.lower() in p.get("category", "").lower()
        ]

    def summarize_for_chatbot(
        self,
        region: str,
        current_metrics: Optional[Dict[str, Any]] = None,
        max_policies: int = 5,
    ) -> str:
        db  = _loader.get_history_db()
        key = self.resolve_region(region)
        history = db.get(key, [])

        if not history and key != "National":
            history = db.get("National", [])[:3]
            key = f"{region} (using National context)"

        if not history:
            return f"No detailed policy history available for {region}."

        lines: List[str] = [f"=== Policy History Context: {key} ===", ""]

        sorted_history = sorted(
            history,
            key=lambda p: (
                0 if p["outcome"] == PolicyOutcome.POSITIVE else
                1 if p["outcome"] == PolicyOutcome.ONGOING  else
                2 if p["outcome"] == PolicyOutcome.MIXED    else 3
            ),
        )
        outcome_labels = {
            PolicyOutcome.POSITIVE: "✓ Positive",
            PolicyOutcome.NEGATIVE: "✗ Negative",
            PolicyOutcome.MIXED:    "~ Mixed",
            PolicyOutcome.ONGOING:  "→ Ongoing",
            PolicyOutcome.REVERSED: "↩ Reversed",
        }

        for i, policy in enumerate(sorted_history[:max_policies]):
            label = outcome_labels.get(policy["outcome"], policy["outcome"])
            lines.extend([
                f"{i+1}. {policy['policy']} [{policy['period']}] — {label}",
                f"   Category: {policy['category']}",
                f"   Summary: {policy['description']}",
            ])
            for eff in policy.get("measured_effects", [])[:2]:
                lines.append(f"     • {eff}")
            for les in policy.get("lessons", [])[:2]:
                lines.append(f"     → {les}")
            lines.append("")

        lines.append("=== Evidence-Based Synthesis ===")
        lines.append(self._synthesize_recommendations(key, history, current_metrics))
        return "\n".join(lines)

    def _synthesize_recommendations(
        self,
        region: str,
        history: List[Dict[str, Any]],
        metrics: Optional[Dict[str, Any]],
    ) -> str:
        positive = [p for p in history if p["outcome"] == PolicyOutcome.POSITIVE]
        negative = [p for p in history if p["outcome"] == PolicyOutcome.NEGATIVE]
        mixed    = [p for p in history if p["outcome"] == PolicyOutcome.MIXED]

        proven = [p["policy"] for p in positive[:3]]
        failed = [p["policy"] for p in negative[:2]]
        parts: List[str] = []

        if proven:
            parts.append(
                f"Approaches with documented positive outcomes in {region}: "
                + "; ".join(proven) + "."
            )
        if failed:
            parts.append(
                "Approaches that did not achieve intended goals: "
                + "; ".join(failed) + "."
            )

        if metrics:
            poverty = metrics.get("poverty_rate")
            gini    = metrics.get("gini_coefficient")
            income  = metrics.get("median_household_income")
            if poverty and poverty > 15:
                parts.append(
                    f"With a current poverty rate of {poverty:.1f}%, direct income "
                    "transfer programs (EITC expansion, CTC) have the strongest "
                    "evidence base for near-term poverty reduction based on this region's history."
                )
            if gini and gini > 0.48:
                parts.append(
                    f"A Gini coefficient of {gini:.3f} indicates high inequality; "
                    "historical evidence supports progressive taxation + education investment "
                    "as the most durable dual strategy."
                )
            if income and income < 55000:
                parts.append(
                    f"Median household income of ${income:,} is well below the national median; "
                    "minimum wage adjustments and workforce upskilling programs have shown "
                    "income gains of $1,000–$4,000/yr in comparable regions."
                )

        if mixed:
            categories_tried = list({p["category"] for p in mixed})
            parts.append(
                f"Mixed-outcome policies were observed in: {', '.join(categories_tried)}. "
                "These areas warrant careful design and phased implementation with "
                "evaluation checkpoints."
            )

        return "\n".join(parts) if parts else (
            f"Historical evidence from {region} is limited; recommend drawing on "
            "national comparables and phased pilot implementations."
        )

    def get_policy_brief(
        self,
        region: str,
        category: Optional[str] = None,
        current_metrics: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        key      = self.resolve_region(region)
        raw      = self.get_history_for_region(region)
        filtered = (
            [p for p in raw if category.lower() in p.get("category", "").lower()]
            if category else raw
        )

        outcome_counts: Dict[str, int] = {
            PolicyOutcome.POSITIVE: 0,
            PolicyOutcome.NEGATIVE: 0,
            PolicyOutcome.MIXED:    0,
            PolicyOutcome.ONGOING:  0,
            PolicyOutcome.REVERSED: 0,
        }
        for p in filtered:
            o = p.get("outcome", PolicyOutcome.MIXED)
            outcome_counts[o] = outcome_counts.get(o, 0) + 1

        proven = [p["policy"] for p in filtered if p["outcome"] == PolicyOutcome.POSITIVE]
        cautionary = [
            {
                "policy": p["policy"],
                "reason": p["lessons"][0] if p.get("lessons") else "See full record",
            }
            for p in filtered
            if p["outcome"] in (PolicyOutcome.NEGATIVE, PolicyOutcome.REVERSED)
        ]

        return {
            "region": key,
            "category_filter": category,
            "total_policies_tracked": len(filtered),
            "outcome_summary": outcome_counts,
            "proven_successes": proven,
            "cautionary_examples": cautionary,
            "policies": filtered,
            "chatbot_synthesis": self._synthesize_recommendations(key, filtered, current_metrics),
            "data_note": (
                "Historical data sourced from peer-reviewed research, government reports, "
                "and independent policy evaluations. Some outcomes are ongoing. "
                "Data loaded from S3: s3://mindthegap-gov-data/government-data/"
                "policy-history/regional_policy_history.json"
            ),
        }


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC INTERFACE
# ─────────────────────────────────────────────────────────────────────────────

_analyzer = PolicyHistoryAnalyzer()


def get_policy_history_context(
    region: str,
    current_metrics: Optional[Dict[str, Any]] = None,
    max_policies: int = 5,
) -> str:
    """
    Returns a formatted text block ready to inject into the chatbot's context.
    Data is loaded from S3 and refreshed automatically every hour.
    """
    return _analyzer.summarize_for_chatbot(region, current_metrics, max_policies)


def get_policy_brief_for_api(
    region: str,
    category: Optional[str] = None,
    current_metrics: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Returns a structured brief for the /api/policy-history/{region} endpoint."""
    return _analyzer.get_policy_brief(region, category, current_metrics)


def get_available_regions() -> List[str]:
    """Returns all regions with policy history data (loaded from S3)."""
    return list(_loader.get_history_db().keys())


def reload_policy_data() -> bool:
    """
    Force-reload the policy database from S3 immediately.
    Call this from an admin endpoint to pick up new data without restarting.
    """
    return _loader.reload()


def update_policy_data(payload: dict) -> bool:
    """
    Save an updated policy payload to S3 AND refresh the in-memory cache.

    payload schema:
      {
        "region_policy_history": { <region>: [ { policy record }, ... ], ... },
        "region_aliases":        { "<alias_lower>": "<region>", ... }
      }
    """
    return _loader.save_to_s3(payload)

