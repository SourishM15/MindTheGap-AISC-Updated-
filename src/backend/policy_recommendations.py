"""
Policy Recommendations Engine
Generates evidence-based policy recommendations based on wealth disparity data and trends
"""

from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from enum import Enum
import json
import os
import logging
import threading

from supabase import create_client
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

_ENV_PATH = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(_ENV_PATH, override=True)

_S3_BUCKET      = "mindthegap-gov-data"
_S3_KEY         = "government-data/policy-database/policy_database.json"
_LOCAL_FALLBACK = os.path.join(os.path.dirname(__file__), "policy_database.json")


class PolicyCategory(Enum):
    """Categories of economic policies"""
    EDUCATION = "Education & Workforce Development"
    INCOME_SUPPORT = "Income Support & Wages"
    WEALTH_BUILDING = "Wealth Building & Asset Ownership"
    EMPLOYMENT = "Employment & Job Creation"
    TAXATION = "Tax & Fiscal Policy"
    HEALTHCARE = "Healthcare & Benefits"
    HOUSING = "Housing & Community Development"
    SMALL_BUSINESS = "Small Business Support"


class PolicyRecommendation:
    """Represents a policy recommendation with evidence"""
    
    def __init__(
        self,
        title: str,
        category: PolicyCategory,
        description: str,
        target_populations: List[str],
        expected_impact: str,
        implementation_difficulty: str,
        cost_estimate: str,
        historical_examples: List[str],
        success_metrics: List[str],
        prerequisites: List[str] = None
    ):
        self.title = title
        self.category = category
        self.description = description
        self.target_populations = target_populations
        self.expected_impact = expected_impact
        self.implementation_difficulty = implementation_difficulty  # Easy, Moderate, Difficult
        self.cost_estimate = cost_estimate  # Low, Moderate, High
        self.historical_examples = historical_examples
        self.success_metrics = success_metrics
        self.prerequisites = prerequisites or []
    
    def to_dict(self) -> Dict:
        return {
            'title': self.title,
            'category': self.category.value,
            'description': self.description,
            'target_populations': self.target_populations,
            'expected_impact': self.expected_impact,
            'implementation_difficulty': self.implementation_difficulty,
            'cost_estimate': self.cost_estimate,
            'historical_examples': self.historical_examples,
            'success_metrics': self.success_metrics,
            'prerequisites': self.prerequisites
        }


# Repository of evidence-based policy recommendations
POLICY_DATABASE = {
    'education_investment': PolicyRecommendation(
        title="Community College & Apprenticeship Expansion",
        category=PolicyCategory.EDUCATION,
        description="Fund free or subsidized community college and apprenticeship programs to increase access to skills training and reduce barriers to economic mobility.",
        target_populations=["Bottom 50%", "Low-income communities", "Underrepresented minorities"],
        expected_impact="Increase earning potential by 30-40%, improve wealth mobility",
        implementation_difficulty="Moderate",
        cost_estimate="High",
        historical_examples=[
            "Post-WWII GI Bill increased college attendance from 5% to 16%",
            "Germany's dual apprenticeship system reduces youth unemployment to <7%",
            "Singapore's workforce training programs correlate with 40-year sustained growth"
        ],
        success_metrics=[
            "Graduation rates increase to 60%+",
            "Average earnings increase $500K+ lifetime",
            "Wage gap with college graduates narrows by 25%"
        ]
    ),
    
    'minimum_wage': PolicyRecommendation(
        title="Regional Minimum Wage Adjustment",
        category=PolicyCategory.INCOME_SUPPORT,
        description="Implement inflation-indexed minimum wage tied to local cost of living to ensure purchasing power parity.",
        target_populations=["Bottom 50% wage earners", "Service industry workers"],
        expected_impact="Increase purchasing power, reduce reliance on public assistance",
        implementation_difficulty="Moderate",
        cost_estimate="Low",
        historical_examples=[
            "Seattle's minimum wage increase (2014-2021) increased incomes without significant job loss",
            "15 OECD countries with indexed minimum wages maintain lower inequality",
            "Denmark's collective bargaining system maintains 22:1 executive-to-worker pay ratio"
        ],
        success_metrics=[
            "Real income growth for bottom quintile",
            "Reduced poverty rate by 15-25%",
            "Improved household financial stability indicator"
        ]
    ),
    
    'wealth_building': PolicyRecommendation(
        title="Universal Savings Accounts & Matched Deposits",
        category=PolicyCategory.WEALTH_BUILDING,
        description="Create government-matched savings accounts for low-income individuals, matching deposits up to a cap to build emergency savings and assets.",
        target_populations=["Bottom 50%", "Bottom 40% by wealth"],
        expected_impact="Build emergency funds, increase asset ownership, break poverty cycle",
        implementation_difficulty="Easy",
        cost_estimate="Moderate",
        historical_examples=[
            "UK Savings Gateway (2005-2010) increased savings by 30% for low-income families",
            "Individual Development Accounts in US show 80%+ participation rates and sustained saving",
            "Singapore's Central Provident Fund increased household asset ownership to 90%"
        ],
        success_metrics=[
            "Median emergency savings increase to 3 months expenses",
            "Asset ownership increases by 20%",
            "Financial resilience index improves"
        ]
    ),
    
    'progressive_taxation': PolicyRecommendation(
        title="Progressive Tax Reform with Wealth Tax",
        category=PolicyCategory.TAXATION,
        description="Increase progressivity through higher top marginal rates and implement modest wealth tax on ultra-high net worth individuals (>$50M).",
        target_populations=["Top 1%", "Ultra-wealthy"],
        expected_impact="Generate revenue for social programs, reduce wealth concentration",
        implementation_difficulty="Difficult",
        cost_estimate="Variable",
        historical_examples=[
            "Post-WWII US tax rates (70-92% top marginal) coincided with lowest inequality (Gini ~0.40)",
            "Nordic countries maintain Gini coefficients 0.25-0.27 with progressive taxation",
            "UK wealth tax (1974-1997) raised £3B+ for social programs"
        ],
        success_metrics=[
            "Gini coefficient improves by 5-10%",
            "Tax revenue increases by 8-12% of GDP",
            "Wealth concentration (share of top 1%) decreases"
        ]
    ),
    
    'home_ownership': PolicyRecommendation(
        title="Down Payment Assistance & Community Development Banking",
        category=PolicyCategory.HOUSING,
        description="Expand down payment assistance programs and support community development financial institutions to increase minority homeownership.",
        target_populations=["Bottom 50% by wealth", "Underrepresented minorities", "First-time homebuyers"],
        expected_impact="Wealth accumulation through home equity, generational wealth building",
        implementation_difficulty="Moderate",
        cost_estimate="Moderate",
        historical_examples=[
            "GI Bill homeownership programs increased White homeownership rate from 43% to 65% (1945-1970)",
            "Since restrictions eased, Black homeownership increased 30% (2012-2021)",
            "Down payment assistance programs show 75% sustained homeownership rates"
        ],
        success_metrics=[
            "Homeownership rate increases by 10-15 percentage points",
            "Median household wealth gap narrows by 30%",
            "Home equity as % of household wealth increases"
        ]
    ),
    
    'small_business': PolicyRecommendation(
        title="Targeted Small Business Access to Capital",
        category=PolicyCategory.SMALL_BUSINESS,
        description="Establish dedicated funding, mentorship, and contract set-asides for minority-owned and women-owned businesses.",
        target_populations=["Entrepreneurs from disadvantaged backgrounds", "Minority-owned businesses"],
        expected_impact="Increase entrepreneurship, create jobs in underserved communities",
        implementation_difficulty="Moderate",
        cost_estimate="Moderate",
        historical_examples=[
            "SBA 8(a) program grew minority business employment from 0.8M to 4.2M (1969-2012)",
            "Women-focused lending programs show 85% 5-year survival rate vs 50% baseline",
            "Brazil's racial quotas for business contracts increased Black business ownership 45%"
        ],
        success_metrics=[
            "Minority business ownership increases by 40%+",
            "Job creation in targeted communities increases 2-3x",
            "Average business revenue grows 25-30% annually"
        ]
    ),
    
    'earned_income_tax': PolicyRecommendation(
        title="Expanded Earned Income Tax Credit (EITC)",
        category=PolicyCategory.INCOME_SUPPORT,
        description="Expand EITC benefit levels and phase-out ranges to provide refundable income support to working families.",
        target_populations=["Working poor", "Bottom 40% income earners"],
        expected_impact="Direct income support, incentivize work participation",
        implementation_difficulty="Easy",
        cost_estimate="Moderate",
        historical_examples=[
            "EITC expansion (1990s) reduced child poverty by 20% and maintained work incentives",
            "Every $1 EITC costs $0.30 in reduced spending elsewhere (multiplier effect)",
            "EITC children show improved educational outcomes and lifetime earnings"
        ],
        success_metrics=[
            "Child poverty rate decreases by 15-25%",
            "Working family income increases by $2,000-$3,000 annually",
            "Work participation rates maintained or increased"
        ]
    ),
    
    'healthcare_access': PolicyRecommendation(
        title="Universal Healthcare or Expanded Coverage",
        category=PolicyCategory.HEALTHCARE,
        description="Implement universal healthcare or significantly expand public coverage to reduce medical bankruptcy and improve health outcomes.",
        target_populations=["Uninsured and underinsured", "Bottom 60% by income"],
        expected_impact="Reduce medical debt, improve preventive care access, increase productivity",
        implementation_difficulty="Difficult",
        cost_estimate="High",
        historical_examples=[
            "Canada's universal healthcare shows lower medical bankruptcies and better preventive outcomes",
            "Massachusetts universal healthcare (2006) reduced uninsured rate from 6.3% to 1.9%",
            "Medicaid expansion in US improved health outcomes and reduced emergency room usage by 40%"
        ],
        success_metrics=[
            "Medical bankruptcy rate decreases by 90%+",
            "Preventive care visits increase by 50%",
            "Health outcomes (life expectancy, disease prevention) improve"
        ],
        prerequisites=["Political consensus on healthcare approach"]
    ),
    
    'housing_first': PolicyRecommendation(
        title="Housing-First Homelessness Prevention",
        category=PolicyCategory.HOUSING,
        description="Provide subsidized permanent housing and supportive services to chronically homeless populations to break the poverty cycle.",
        target_populations=["Chronically homeless", "Households with multiple risk factors"],
        expected_impact="Reduce medical costs, improve employment prospects, strengthen communities",
        implementation_difficulty="Moderate",
        cost_estimate="Moderate",
        historical_examples=[
            "Utah's Housing First initiative reduced chronic homelessness by 90%",
            "Salt Lake City program shows cost savings of $16,281 per person annually",
            "Finland ended chronic homelessness through Housing First approach"
        ],
        success_metrics=[
            "Homelessness decreases by 50%+ in 5 years",
            "Per-capita healthcare costs decrease by $10,000+",
            "Employment rate for formerly homeless increases 60%"
        ]
    ),
    
    'land_value_tax': PolicyRecommendation(
        title="Land Value Tax Implementation",
        category=PolicyCategory.TAXATION,
        description="Implement tax on unimproved land value to capture public value, discourage speculation, and fund public goods.",
        target_populations=["General population (progressive distribution)", "High-value real estate holders"],
        expected_impact="More efficient land use, reduce speculative bubbles, fund public investment",
        implementation_difficulty="Difficult",
        cost_estimate="Low",
        historical_examples=[
            "Denmark's property tax on land values maintains housing affordability",
            "Singapore's land value taxation combined with public housing serves 80% of population",
            "South Africa's land reform program redistributed land to millions"
        ],
        success_metrics=[
            "Housing affordability improves by 15-20%",
            "Speculative real estate transactions decrease",
            "Public revenue from land tax supports community investment"
        ]
    ),
    
    'individual_tax_relief': PolicyRecommendation(
        title="Middle-Income Tax Relief & Refundable Credits",
        category=PolicyCategory.TAXATION,
        description="Expand tax refundable credits and reduce tax burden for middle-income households (earning $50K-$150K annually) to increase take-home pay.",
        target_populations=["Middle-income households ($50K-$150K)", "Working families"],
        expected_impact="Increase disposable income by $2,000-$5,000 annually per household, boost consumer spending",
        implementation_difficulty="Easy",
        cost_estimate="Moderate",
        historical_examples=[
            "2017 US Tax Cuts and Jobs Act increased take-home pay for middle-income earners",
            "Canada's Canada Workers Benefit expanded credits by $1,400+ per eligible worker",
            "UK Child Tax Credit increases disposable income for families by £2,300 annually"
        ],
        success_metrics=[
            "Average household take-home income increases by $3,000+ annually",
            "Consumer spending increases by 5-8%",
            "Poverty rate decreases by 8-12%",
            "Emergency savings for middle-income households increase 25%+"
        ]
    ),
    
    'student_debt_relief': PolicyRecommendation(
        title="Student Loan Forgiveness & Interest Rate Relief",
        category=PolicyCategory.INCOME_SUPPORT,
        description="Implement targeted student loan forgiveness (up to $50K for public service workers) and reduce interest rates on remaining federal student loans to 1-2%.",
        target_populations=["Student loan borrowers (~45M Americans)", "Public service workers", "Recent graduates"],
        expected_impact="Free up $300-$500 monthly household cash flow, enable 15M households to buy homes/start businesses",
        implementation_difficulty="Moderate",
        cost_estimate="High",
        historical_examples=[
            "Income-Based Repayment plans cap payments at 20% of discretionary income",
            "Public Service Loan Forgiveness program forgives debt after 10 years of service",
            "Australia's income-contingent loan scheme adapts repayment to earnings capacity",
            "Germany eliminated tuition fees and reduced student debt burden by 60%+"
        ],
        success_metrics=[
            "Average monthly household savings of $300-$500 from reduced payments",
            "Home purchase rate for young adults increases 20%",
            "Small business formation by millennials increases 35%",
            "Cumulative household wealth increases $20K+ per borrower"
        ]
    ),
    
    'child_dependent_credits': PolicyRecommendation(
        title="Enhanced Child & Dependent Tax Credits",
        category=PolicyCategory.INCOME_SUPPORT,
        description="Expand Child Tax Credit to $3,500+ per child (up from $2,000) and make fully refundable for all households including those with zero tax liability.",
        target_populations=["Families with children (60M+ children)", "Low-income parents", "Single parents"],
        expected_impact="Increase annual child tax credit payments to $35K+ families by $3,000-$5,000",
        implementation_difficulty="Easy",
        cost_estimate="High",
        historical_examples=[
            "2021 American Rescue Plan expanded CTC to $3,600, reducing child poverty by 25%+",
            "Canadian Child Benefit provides $6,400+ per child in low-income families",
            "UK Child Benefit provides £21+ per week per child to all families",
            "Australia's Family Tax Benefit payments reach $4,100+ per family annually"
        ],
        success_metrics=[
            "Child poverty rate decreases by 30%",
            "Annual income for families with children increases $4,000+",
            "Educational outcomes and health metrics improve for low-income children",
            "Parental workforce participation increases 8%"
        ]
    ),
    
    'healthcare_savings_expansion': PolicyRecommendation(
        title="Health Savings Account Expansion & Tax Incentives",
        category=PolicyCategory.HEALTHCARE,
        description="Expand HSA contribution limits to $10,000+ and allow use for broader medical expenses (insurance premiums, childcare with health component, fitness).",
        target_populations=["Middle and upper-middle income households ($75K-$200K)", "Self-employed individuals"],
        expected_impact="Save $2,000-$3,000 annually in taxes, accumulate tax-free medical savings",
        implementation_difficulty="Easy",
        cost_estimate="Low",
        historical_examples=[
            "Current HSA limits ($4,150 individual, $8,300 family) save $1,000-$2,000 in taxes",
            "Singapore's healthcare savings accounts (CPF) reduce per-capita costs while building savings",
            "Switzerland's HSA-like system with tax deductions enables $100K+ in lifetime medical savings"
        ],
        success_metrics=[
            "Healthcare cost burden decreases 15-20% for HSA participants",
            "Personal health savings accumulate $50K+ per household over 20 years",
            "Healthcare expenditure as % of household income decreases 3-5%",
            "Preventive care participation rates increase 30%"
        ]
    ),
    
    'consumer_debt_relief': PolicyRecommendation(
        title="Interest Rate Caps & Consumer Debt Relief",
        category=PolicyCategory.INCOME_SUPPORT,
        description="Cap interest rates at 15-20% for credit cards and personal loans, implement debt restructuring programs for households over $10K in unsecured debt.",
        target_populations=["Low-income households with credit card debt (~40M households)", "Subprime borrowers"],
        expected_impact="Save $2,000-$5,000 annually on debt payments, avoid predatory lending, increase household financial stability",
        implementation_difficulty="Moderate",
        cost_estimate="Low",
        historical_examples=[
            "CARD Act (2009) capped credit card rate increases and improved transparency",
            "Consumer Credit Acts in multiple countries cap rates at 16-25%",
            "New Hampshire's payday loan rate caps reduced defaults by 35%",
            "UK caps high-cost short-term credit at 0.8% daily (effective 29.2% annual)"
        ],
        success_metrics=[
            "Average household credit card savings of $3,000 annually",
            "Default rates on high-cost debt decrease 40%+",
            "Bankruptcy filings from medical/debt causes decrease 30%",
            "Household emergency savings increase as debt service decreases"
        ]
    ),
    
    'homeowner_relief': PolicyRecommendation(
        title="Homeowner Tax Relief & Mortgage Assistance",
        category=PolicyCategory.HOUSING,
        description="Increase deductibility of mortgage interest, property taxes; expand first-time homebuyer tax credits to $20K and establish hardship refinancing programs.",
        target_populations=["Homeowners (~82M households)", "First-time homebuyers", "Underwater mortgages"],
        expected_impact="Increase home affordability, enable 5M+ additional families to qualify for mortgages, reduce foreclosures",
        implementation_difficulty="Moderate",
        cost_estimate="Moderate",
        historical_examples=[
            "Mortgage Interest Deduction saved homeowners $100B+ annually on federal taxes",
            "First-time Homebuyer Credit (2008-2010) enabled 4.5M+ home purchases",
            "Home Affordable Modification Program reduced monthly payments by average $500+",
            "Australia's First Home Super Saver Scheme enables tax-advantaged saving for down payments"
        ],
        success_metrics=[
            "Homeownership rate increases 3-5 percentage points",
            "First-time homebuyer purchases increase 25-30%",
            "Foreclosure rates decrease 40%-50%",
            "Home equity accumulation accelerates ($50K+ over 10 years)"
        ]
    )
}


# ─────────────────────────────────────────────────────────────────────────────
# S3 LOADER  —  thread-safe, TTL-cached, falls back to local JSON then to
#               the in-code POLICY_DATABASE when both are unreachable.
# ─────────────────────────────────────────────────────────────────────────────

class PolicyDatabaseLoader:
    """
    Loads the policy catalog from S3 so it can be updated without redeployment.

    S3 key   : s3://mindthegap-gov-data/government-data/policy-database/policy_database.json
    Schema   : { "policy_database": { "<key>": { policy fields }, ... },
                 "metadata": { "version": "...", "last_updated": "..." } }

    Call reload_policy_database() to force an immediate refresh from S3.
    Call update_policy_database(payload) to push new data to S3 and refresh.
    """

    CACHE_TTL = 3600  # seconds

    def __init__(self):
        self._lock      = threading.Lock()
        self._db: Dict[str, Dict[str, Any]] = {}
        self._meta: Dict[str, Any] = {}
        self._loaded_at: Optional[datetime] = None
        _url = os.getenv("SUPABASE_URL")
        _key = os.getenv("SUPABASE_KEY")
        self._sb = create_client(_url, _key) if _url and _key else None

    def _is_stale(self) -> bool:
        if self._loaded_at is None:
            return True
        return datetime.now() - self._loaded_at > timedelta(seconds=self.CACHE_TTL)

    def _parse_payload(self, payload: dict) -> None:
        self._db       = payload.get("policy_database", {})
        self._meta     = payload.get("metadata", {})
        self._loaded_at = datetime.now()

    def _load_from_s3(self) -> bool:
        if not self._sb:
            return False
        try:
            raw = self._sb.storage.from_(_S3_BUCKET).download(_S3_KEY)
            payload = json.loads(raw)
            self._parse_payload(payload)
            logger.info(
                f"✓ PolicyDatabaseLoader: loaded {len(self._db)} policies from Supabase Storage "
                f"(v{self._meta.get('version', '?')})"
            )
            return True
        except Exception as exc:
            logger.warning(f"PolicyDatabaseLoader: Supabase Storage load failed — {exc}")
            return False

    def _load_from_local(self) -> bool:
        try:
            with open(_LOCAL_FALLBACK, encoding="utf-8") as f:
                payload = json.load(f)
            self._parse_payload(payload)
            logger.info(
                f"✓ PolicyDatabaseLoader: loaded {len(self._db)} policies from local fallback"
            )
            return True
        except Exception as exc:
            logger.warning(f"PolicyDatabaseLoader: local fallback failed — {exc}")
            return False

    def _load_from_code(self) -> None:
        """Last-resort: convert in-code POLICY_DATABASE objects to plain dicts."""
        self._db = {
            key: policy.to_dict()
            for key, policy in POLICY_DATABASE.items()
        }
        # Patch in the dict key as 'key' field for reference
        for key, rec in self._db.items():
            rec.setdefault("key", key)
        self._loaded_at = datetime.now()
        logger.info(
            f"✓ PolicyDatabaseLoader: using {len(self._db)} in-code policies as fallback"
        )

    def _ensure_loaded(self) -> None:
        if not self._is_stale():
            return
        with self._lock:
            if not self._is_stale():
                return
            if not self._load_from_s3():
                if not self._load_from_local():
                    self._load_from_code()

    def get_database(self) -> Dict[str, Dict[str, Any]]:
        self._ensure_loaded()
        return self._db

    def get_metadata(self) -> Dict[str, Any]:
        self._ensure_loaded()
        return self._meta

    def reload(self) -> bool:
        """Force reload from S3 regardless of TTL. Returns True on success."""
        self._loaded_at = None
        return self._load_from_s3() or self._load_from_local()

    def save_to_s3(self, payload: dict) -> bool:
        """Persist an updated policy payload to Supabase Storage AND refresh the in-memory cache."""
        if not self._sb:
            logger.error("PolicyDatabaseLoader: Supabase not configured — cannot save")
            return False
        try:
            body = json.dumps(payload, indent=2, ensure_ascii=False).encode("utf-8")
            self._sb.storage.from_(_S3_BUCKET).upload(
                _S3_KEY, body, file_options={"upsert": "true"}
            )
            self._parse_payload(payload)
            logger.info(f"✓ PolicyDatabaseLoader: saved {len(self._db)} policies to Supabase Storage")
            return True
        except Exception as exc:
            logger.error(f"PolicyDatabaseLoader: Supabase Storage save failed — {exc}")
            return False


# Module-level singleton
_policy_loader = PolicyDatabaseLoader()


def _get_policy_field(policy, field: str, default=None):
    """Uniform access for both plain-dict (S3) and PolicyRecommendation (code) objects."""
    if isinstance(policy, dict):
        return policy.get(field, default)
    # PolicyRecommendation object
    val = getattr(policy, field, default)
    if field == "category" and hasattr(val, "value"):
        return val.value
    return val


def _build_policy_reference_context() -> str:
    """
    Serialize the policy catalog (loaded from S3) into a compact reference string
    for the LLM prompt.  The LLM cites real policy names, historical examples, and
    success metrics from this to ground its output in proven evidence.
    """
    db = _policy_loader.get_database()
    lines = ["=== Policy Reference Library ==="]
    for key, policy in db.items():
        title       = _get_policy_field(policy, "title", key)
        category    = _get_policy_field(policy, "category", "General")
        description = _get_policy_field(policy, "description", "")
        examples    = _get_policy_field(policy, "historical_examples", [])
        metrics     = _get_policy_field(policy, "success_metrics", [])
        targets     = _get_policy_field(policy, "target_populations", [])

        lines.append(f"\n[{key}] {title} ({category})")
        lines.append(f"  Description: {str(description)[:120]}...")
        lines.append(f"  Target: {', '.join(targets[:2])}")
        lines.append(f"  Examples: {examples[0] if examples else 'N/A'}")
        lines.append(f"  Metrics: {metrics[0] if metrics else 'N/A'}")
    return "\n".join(lines)


class PolicyRecommendationEngine:
    """
    LLM-backed policy recommendation engine.
    Uses real government API metrics + POLICY_DATABASE reference + optional
    regional history to generate specific, data-grounded recommendations.
    """

    @staticmethod
    def get_recommendations_for_situation(
        gini_coefficient: float,
        top_1_percent_share: float,
        bottom_50_percent_share: float,
        unemployment_rate: float,
        poverty_rate: float,
        demographics: Dict[str, Any] = None,
        geographic_focus: str = None,
        policy_history_context: str = "",
        openai_api_key: str = None,
    ) -> List[Dict[str, Any]]:
        """
        Generate LLM-backed policy recommendations driven by real economic data.

        The LLM receives:
          - Actual government-sourced metrics for the region
          - The full POLICY_DATABASE as a reference library to cite from
          - Optional historical policy evidence from Supabase (regional_policy_history)

        Returns a list of structured recommendation dicts.
        """
        api_key = openai_api_key or os.getenv("GROQ_API_KEY")
        if not api_key:
            logger.warning("No GROQ_API_KEY — falling back to heuristic scoring")
            return PolicyRecommendationEngine._heuristic_fallback(
                gini_coefficient, top_1_percent_share, bottom_50_percent_share,
                unemployment_rate, poverty_rate
            )

        region_label = geographic_focus or "this region"
        demo_str = ""
        if demographics:
            demo_str = "\nAdditional demographic context:\n" + "\n".join(
                f"  - {k.replace('_', ' ').title()}: {v}"
                for k, v in demographics.items()
                if v is not None
            )

        policy_ref = _build_policy_reference_context()

        history_section = ""
        if policy_history_context:
            history_section = f"""
=== Regional Policy History ===
{policy_history_context}
"""

        prompt = f"""You are a non-partisan economist and public policy analyst. Your only obligation is \
economic accuracy and intellectual honesty. Generate exactly 5 tailored policy recommendations for \
{region_label} grounded strictly in peer-reviewed research, documented historical outcomes, and \
real government data.

CORE INTEGRITY RULES you must follow without exception:
1. ONLY cite real, documented programs with verifiable outcomes (name the program, jurisdiction, year, and measured result).
2. For every recommendation include at least one documented TRADE-OFF or unintended consequence from history.
3. If evidence is contested or mixed among mainstream economists, state that explicitly in the rationale.
4. Do NOT cherry-pick favourable outcomes. If a comparable program failed somewhere, note it.
5. Rate evidence_quality honestly: Strong (RCTs or large quasi-experimental studies), Moderate (observational with good controls), Mixed/Contested (significant academic disagreement).
6. Do NOT recommend a policy because it is politically popular — only because the data supports it.
7. Projected impacts must be grounded in measured effects of real historical precedents, not optimistic assumptions.

For EACH recommendation output a JSON object (5 total, as a JSON array) with exactly these fields:
  - title               : concise policy name
  - category            : one of Education, Income Support, Wealth Building, Employment, Taxation, Healthcare, Housing, Small Business, Individual Finance
  - description         : 2-3 sentences tailored to the specific metrics below referencing actual numbers
  - target_populations  : list of 2-3 groups most affected
  - expected_impact     : specific projected outcome citing a real historical analogue and its measured effect
  - evidence_quality    : Strong | Moderate | Mixed/Contested
  - known_tradeoffs     : list of 1-2 documented downsides or unintended consequences from real-world implementations
  - implementation_difficulty : Easy | Moderate | Difficult
  - cost_estimate       : Low | Moderate | High
  - historical_examples : list of 2 real precedents each with program name, jurisdiction, year, and measured outcome
  - success_metrics     : list of 2 measurable KPIs with numeric targets derived from historical analogues
  - rationale           : 1 sentence explaining why THIS specific data combination makes this policy the priority; note if evidence is contested
  - priority_score      : float 1-10 reflecting data-driven urgency (not political preference)

=== REAL GOVERNMENT DATA ({region_label}) ===
  Gini Coefficient          : {gini_coefficient:.3f}  (national avg ~0.49)
  Top 1% Wealth Share       : {top_1_percent_share:.1f}%
  Bottom 50% Wealth Share   : {bottom_50_percent_share:.1f}%
  Unemployment Rate         : {unemployment_rate:.1f}%
  Poverty Rate              : {poverty_rate:.1f}%{demo_str}

{policy_ref}
{history_section}
Return ONLY a valid JSON array of 5 objects. No markdown fences, no prose."""

        try:
            from langchain_groq import ChatGroq
            from langchain_core.messages import HumanMessage

            llm = ChatGroq(
                temperature=0.3,
                groq_api_key=api_key,
                model_name="llama-3.3-70b-versatile",
                max_tokens=2000,
            )
            response = llm.invoke([HumanMessage(content=prompt)])
            raw = response.content if hasattr(response, "content") else str(response)

            # Strip accidental markdown fences
            raw = raw.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

            recommendations = json.loads(raw)
            if not isinstance(recommendations, list):
                raise ValueError("LLM did not return a JSON array")

            logger.info(
                f"✓ LLM generated {len(recommendations)} policy recommendations for {region_label}"
            )
            return recommendations

        except Exception as exc:
            logger.error(f"LLM policy generation failed ({exc}); using heuristic fallback")
            return PolicyRecommendationEngine._heuristic_fallback(
                gini_coefficient, top_1_percent_share, bottom_50_percent_share,
                unemployment_rate, poverty_rate
            )

    @staticmethod
    def _heuristic_fallback(
        gini_coefficient: float,
        top_1_percent_share: float,
        bottom_50_percent_share: float,
        unemployment_rate: float,
        poverty_rate: float,
    ) -> List[Dict[str, Any]]:
        """
        Lightweight fallback used when the LLM is unavailable.
        Returns top-scored policies from POLICY_DATABASE without LLM involvement.
        """
        scores: Dict[str, float] = {}

        if gini_coefficient > 0.50:
            scores.update({'education_investment': 9.0, 'progressive_taxation': 8.5, 'wealth_building': 8.0})
        if top_1_percent_share > 35:
            scores.update({'progressive_taxation': 9.0, 'land_value_tax': 7.5})
        if poverty_rate > 15 or bottom_50_percent_share < 3:
            scores.update({'earned_income_tax': 9.0, 'minimum_wage': 8.5, 'education_investment': 8.0, 'housing_first': 7.5})
        if unemployment_rate > 5:
            scores.update({'education_investment': 8.5, 'small_business': 8.0})
        if not scores:
            scores = {'education_investment': 7.0, 'minimum_wage': 7.0, 'earned_income_tax': 7.0}

        # Use S3-loaded database (or code fallback)
        db = _policy_loader.get_database()

        results: List[Dict[str, Any]] = []
        seen: set = set()
        for policy_key, score in sorted(scores.items(), key=lambda x: x[1], reverse=True):
            for db_key, policy in db.items():
                title = _get_policy_field(policy, "title", db_key)
                if (db_key.replace('_', ' ') in policy_key or policy_key in db_key) and title not in seen:
                    if isinstance(policy, dict):
                        rec = dict(policy)
                    else:
                        rec = policy.to_dict()
                    rec['priority_score'] = min(10.0, score)
                    rec['rationale'] = (
                        f"Heuristic: Gini={gini_coefficient:.2f}, Poverty={poverty_rate:.1f}%, "
                        f"Unemployment={unemployment_rate:.1f}%"
                    )
                    seen.add(title)
                    results.append(rec)
                    break

        return results[:5]
    
    @staticmethod
    def get_policy_combination_analysis(
        selected_policies: List[str],
        years: int = 10
    ) -> Dict[str, Any]:
        """
        Analyze the combined effect of implementing multiple policies together
        
        Args:
            selected_policies: List of policy keys
            years: Time horizon for analysis
        
        Returns:
            Analysis of combined impact
        """
        analysis = {
            'policies': selected_policies,
            'time_horizon_years': years,
            'combined_impact': {
                'estimated_gini_improvement': '10-15%',
                'estimated_poverty_reduction': '25-35%',
                'estimated_wealth_gap_narrowing': '20-30%',
            },
            'implementation_roadmap': [
                {
                    'phase': 1,
                    'years': '0-2',
                    'focus': 'Quick wins and foundational reforms'
                },
                {
                    'phase': 2,
                    'years': '2-5',
                    'focus': 'Scaling successful programs and systemic changes'
                },
                {
                    'phase': 3,
                    'years': '5-10',
                    'focus': 'Institutional embedding and sustainability'
                }
            ],
            'expected_timeline': f"Measurable improvements within 3-5 years, significant impact within {years} years"
        }
        
        return analysis


def get_policy_recommendations_for_region(
    region_data: Dict[str, Any],
    policy_history_context: str = "",
    openai_api_key: str = None,
) -> List[Dict[str, Any]]:
    """
    Main entry point for LLM-generated policy recommendations for a region.

    Args:
        region_data: Dictionary with real government API data for the region
            (gini_coefficient, top_1_percent_share, bottom_50_percent_share,
             unemployment_rate, poverty_rate, demographics, region)
        policy_history_context: Optional pre-formatted historical policy text
            from regional_policy_history.py to ground LLM in evidence
        openai_api_key: OpenAI API key (falls back to OPENAI_API_KEY env var)

    Returns:
        List of LLM-generated policy recommendations with priority scores
    """
    return PolicyRecommendationEngine.get_recommendations_for_situation(
        gini_coefficient=region_data.get('gini_coefficient', 0.45),
        top_1_percent_share=region_data.get('top_1_percent_share', 35),
        bottom_50_percent_share=region_data.get('bottom_50_percent_share', 3),
        unemployment_rate=region_data.get('unemployment_rate', 4),
        poverty_rate=region_data.get('poverty_rate', 12),
        demographics=region_data.get('demographics', {}),
        geographic_focus=region_data.get('region', 'National'),
        policy_history_context=policy_history_context,
        openai_api_key=openai_api_key,
    )


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC ADMIN INTERFACE  (mirrors regional_policy_history.py pattern)
# ─────────────────────────────────────────────────────────────────────────────

def reload_policy_database() -> bool:
    """
    Force-reload the policy catalog from S3 immediately, bypassing the TTL cache.
    Call this from an admin endpoint to pick up new policies without restarting.
    Returns True on success.
    """
    return _policy_loader.reload()


def update_policy_database(payload: dict) -> bool:
    """
    Save an updated policy catalog to S3 AND refresh the in-memory cache.

    payload schema:
      {
        "policy_database": {
          "<key>": {
            "title": "...",
            "category": "Education & Workforce Development",
            "description": "...",
            "target_populations": [...],
            "expected_impact": "...",
            "implementation_difficulty": "Easy|Moderate|Difficult",
            "cost_estimate": "Low|Moderate|High",
            "historical_examples": [...],
            "success_metrics": [...],
            "prerequisites": [...]
          },
          ...
        },
        "metadata": {
          "version": "1.1",
          "last_updated": "YYYY-MM-DD",
          "description": "..."
        }
      }
    """
    return _policy_loader.save_to_s3(payload)


def get_policy_database() -> Dict[str, Any]:
    """
    Return the current in-memory policy catalog (loaded from S3).
    Safe to call at any time; triggers a load on first call.
    """
    return _policy_loader.get_database()


def get_policy_database_metadata() -> Dict[str, Any]:
    """Return metadata (version, last_updated) for the loaded policy catalog."""
    return _policy_loader.get_metadata()
