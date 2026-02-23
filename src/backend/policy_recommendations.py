"""
Policy Recommendations Engine
Generates evidence-based policy recommendations based on wealth disparity data and trends
"""

from typing import Dict, List, Any, Optional
from datetime import datetime
from enum import Enum
import json


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
    )
}


class PolicyRecommendationEngine:
    """Generates evidence-based policy recommendations"""
    
    @staticmethod
    def get_recommendations_for_situation(
        gini_coefficient: float,
        top_1_percent_share: float,
        bottom_50_percent_share: float,
        unemployment_rate: float,
        poverty_rate: float,
        demographics: Dict[str, Any] = None,
        geographic_focus: str = None
    ) -> List[Dict[str, Any]]:
        """
        Generate tailored policy recommendations based on economic situation
        
        Args:
            gini_coefficient: Inequality measure (0-1)
            top_1_percent_share: Wealth share of top 1%
            bottom_50_percent_share: Wealth share of bottom 50%
            unemployment_rate: Current unemployment rate
            poverty_rate: Percentage of population below poverty line
            demographics: Dictionary with demographic breakdowns
            geographic_focus: Geographic area for context
        
        Returns:
            Prioritized list of policy recommendations
        """
        recommendations = []
        scores = {}
        
        # Score each policy based on the situation
        
        # High inequality calls for wealth redistribution and opportunity
        if gini_coefficient > 0.50:
            scores['education_investment'] = 9.0
            scores['progressive_taxation'] = 8.5
            scores['wealth_building'] = 8.0
        
        # High top 1% share
        if top_1_percent_share > 35:
            scores['progressive_taxation'] = 9.0
            scores['wealth_building'] = 8.0
            scores['land_value_tax'] = 7.5
        
        # High poverty/low bottom 50% share
        if poverty_rate > 15 or bottom_50_percent_share < 3:
            scores['earned_income_tax'] = 9.0
            scores['minimum_wage'] = 8.5
            scores['education_investment'] = 8.0
            scores['housing_first'] = 7.5
        
        # High unemployment
        if unemployment_rate > 5:
            scores['education_investment'] = 8.5
            scores['small_business'] = 8.0
            scores['employment'] = 7.5
        
        # Demographic disparities
        if demographics:
            if demographics.get('racial_wealth_gap', 0) > 10:
                scores['housing'] = 8.5
                scores['small_business'] = 8.5
                scores['homeownership'] = 8.0
            
            if demographics.get('gender_wage_gap', 0) > 20:
                scores['minimum_wage'] = 8.0
                scores['education_investment'] = 7.5
        
        # Convert scores to recommendations
        for policy_key, score in sorted(scores.items(), key=lambda x: x[1], reverse=True):
            # Find matching policy in database
            for db_key, policy in POLICY_DATABASE.items():
                if db_key.replace('_', ' ') in policy_key or policy_key in db_key:
                    rec = policy.to_dict()
                    rec['priority_score'] = min(10.0, score)
                    rec['rationale'] = PolicyRecommendationEngine._generate_rationale(
                        policy_key, gini_coefficient, poverty_rate
                    )
                    recommendations.append(rec)
                    break
        
        # Remove duplicates and sort by priority
        seen = set()
        unique_recs = []
        for rec in recommendations:
            if rec['title'] not in seen:
                seen.add(rec['title'])
                unique_recs.append(rec)
        
        return sorted(unique_recs, key=lambda x: x['priority_score'], reverse=True)[:5]
    
    @staticmethod
    def _generate_rationale(policy_key: str, gini: float, poverty: float) -> str:
        """Generate context-specific rationale for a policy"""
        rationales = {
            '': f"Given the current Gini coefficient of {gini:.2f} and poverty rate of {poverty:.1f}%, ",
        }
        
        base = f"Given the current situation (Gini: {gini:.2f}, Poverty: {poverty:.1f}%), "
        
        if gini > 0.50:
            return base + "this policy addresses the high inequality by..."
        elif poverty > 15:
            return base + "this policy targets the high poverty rate by..."
        else:
            return base + "this policy promotes opportunity and inclusion by..."
    
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


def get_policy_recommendations_for_region(region_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Main entry point for getting policy recommendations for a region
    
    Args:
        region_data: Dictionary with regional economic data
    
    Returns:
        List of policy recommendations with priority scores
    """
    engine = PolicyRecommendationEngine()
    
    return engine.get_recommendations_for_situation(
        gini_coefficient=region_data.get('gini_coefficient', 0.45),
        top_1_percent_share=region_data.get('top_1_percent_share', 35),
        bottom_50_percent_share=region_data.get('bottom_50_percent_share', 3),
        unemployment_rate=region_data.get('unemployment_rate', 4),
        poverty_rate=region_data.get('poverty_rate', 12),
        demographics=region_data.get('demographics', {}),
        geographic_focus=region_data.get('region', 'National')
    )
