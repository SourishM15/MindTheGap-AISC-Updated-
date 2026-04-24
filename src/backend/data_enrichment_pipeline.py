"""
Data Enrichment Pipeline
Combines wealth data with government data to create comprehensive regional profiles
"""
import os
import json
import logging
from typing import Dict, List, Optional
from datetime import datetime
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client, Client

from census_api_client import CensusAPIClient, STATE_FIPS
from bls_api_client import BLSAPIClient
from fred_api_client import FREDAPIClient
from city_api_client import CityAPIClient

logger = logging.getLogger(__name__)
load_dotenv(override=True)

# US States mapping
STATES = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
    'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
    'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
    'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
    'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
    'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
    'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
    'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
    'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
    'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
}

REGIONS = {
    'Northeast': ['CT', 'ME', 'MA', 'NH', 'RI', 'VT', 'NJ', 'NY', 'PA'],
    'Southeast': ['DE', 'MD', 'VA', 'WV', 'NC', 'SC', 'GA', 'FL', 'KY', 'TN', 'AL', 'MS', 'LA', 'AR'],
    'Midwest': ['OH', 'IN', 'IL', 'MI', 'WI', 'MN', 'IA', 'MO', 'ND', 'SD', 'NE', 'KS'],
    'Southwest': ['OK', 'TX', 'NM', 'AZ'],
    'West': ['MT', 'ID', 'WY', 'CO', 'UT', 'NV', 'CA', 'OR', 'WA', 'AK', 'HI']
}

class DataEnrichmentPipeline:
    """Pipeline to enrich wealth data with government data"""
    
    def __init__(self):
        self.census_client = CensusAPIClient()
        self.bls_client = BLSAPIClient()
        self.fred_client = FREDAPIClient()
        self.city_client = CityAPIClient()
        # Supabase Storage client
        _url = os.getenv('SUPABASE_URL')
        _key = os.getenv('SUPABASE_KEY')
        self._supabase: Client | None = create_client(_url, _key) if _url and _key else None
        self.bucket = 'mindthegap-gov-data'
        
        # Load existing wealth data from Supabase (mock here, replace with real)
        self.wealth_data = self._load_wealth_data()
    
    def _load_wealth_data(self) -> Dict:
        """Load wealth data from S3 (would come from Supabase in production)"""
        try:
            # For now, return structure for enrichment
            return {}
        except Exception as e:
            logger.error(f"Error loading wealth data: {e}")
            return {}
    
    def enrich_state_profile(self, state_code: str, state_name: str) -> Dict:
        """
        Create comprehensive enriched profile for a state
        
        Returns: Complete state profile with all data types
        """
        logger.info(f"Enriching profile for {state_name} ({state_code})")
        
        try:
            profile = {
                'identity': {
                    'state_code': state_code,
                    'state_name': state_name,
                    'fips_code': STATE_FIPS.get(state_code, ''),
                    'region': self._get_region(state_code),
                    'timestamp': datetime.now().isoformat()
                },
                'demographics': {},
                'employment': {},
                'economics': {},
                'wealth': {},
                'derived_metrics': {},
                'data_quality': {
                    'sources': [],
                    'missing_fields': [],
                    'last_updated': datetime.now().isoformat()
                }
            }
            
            # Fetch Census data
            logger.info(f"  Fetching Census data...")
            census_data = self.census_client.get_state_demographics(STATE_FIPS.get(state_code, ''))
            if census_data:
                profile['demographics'] = census_data
                profile['data_quality']['sources'].append('Census Bureau ACS')
            else:
                profile['data_quality']['missing_fields'].append('census_demographics')
            
            # Fetch BLS data
            logger.info(f"  Fetching BLS employment data...")
            bls_data = self.bls_client.get_state_unemployment(state_code)
            if bls_data:
                profile['employment'] = bls_data
                profile['data_quality']['sources'].append('Bureau of Labor Statistics')
            else:
                profile['data_quality']['missing_fields'].append('bls_unemployment')
            
            # Fetch FRED data
            logger.info(f"  Fetching FRED economic data...")
            fred_data = self.fred_client.get_state_economic_indicators(state_code)
            if fred_data:
                profile['economics'] = fred_data
                profile['data_quality']['sources'].append('Federal Reserve Economic Data')
            else:
                profile['data_quality']['missing_fields'].append('fred_indicators')
            
            # Add mock wealth data (would be from Supabase)
            profile['wealth'] = self._get_mock_wealth_data(state_code)
            profile['data_quality']['sources'].append('Supabase Wealth Data')
            
            # Calculate derived metrics
            profile['derived_metrics'] = self._calculate_derived_metrics(profile)
            
            return profile
        
        except Exception as e:
            logger.error(f"Error enriching state profile: {e}")
            return {}
    
    def _get_region(self, state_code: str) -> str:
        """Get region for a state"""
        for region, states in REGIONS.items():
            if state_code in states:
                return region
        return 'Unknown'
    
    def _get_mock_wealth_data(self, state_code: str) -> Dict:
        """Mock wealth data (replace with real Supabase query)"""
        # In production, query Supabase wealth_distribution table
        return {
            'top_1_percent_networth': 0,
            'bottom_50_percent_networth': 0,
            'gini_coefficient': 0,
            'wealth_gap': 0,
            'note': 'Would be populated from Supabase in production'
        }
    
    def _calculate_derived_metrics(self, profile: Dict) -> Dict:
        """Calculate derived metrics from raw data"""
        metrics = {}
        
        # Inequality index (combine Gini with wage distribution)
        wealth_gap = profile['wealth'].get('wealth_gap', 0)
        education_pct = profile['demographics'].get('education_bachelor_and_above', 0)
        metrics['inequality_index'] = round(wealth_gap / 100 if wealth_gap else 0, 2)
        
        # Economic health score (0-100)
        unemployment = profile['employment'].get('unemployment_data', {})
        if unemployment:
            latest_unemp = list(unemployment.values())[-1].get('rate', 0) if unemployment.values() else 0
            health_score = max(0, 100 - (latest_unemp * 2) - (metrics['inequality_index'] * 50))
        else:
            health_score = 50
        
        metrics['economic_health_score'] = round(health_score, 1)
        
        # Region classification
        if health_score >= 75:
            classification = 'Prosperous'
        elif health_score >= 60:
            classification = 'Healthy'
        elif health_score >= 40:
            classification = 'Strained'
        else:
            classification = 'Distressed'
        
        metrics['region_classification'] = classification
        metrics['income_education_ratio'] = round((
            profile['demographics'].get('median_household_income', 0) / 10000) / max(1, education_pct / 10),
            2) if education_pct > 0 else 0
        
        return metrics
    
    def _storage_upload(self, key: str, data: bytes) -> bool:
        """Upload bytes to Supabase Storage (upsert)."""
        if not self._supabase:
            logger.warning("Supabase not configured — cannot save enriched profile")
            return False
        try:
            self._supabase.storage.from_(self.bucket).upload(
                key, data, file_options={"upsert": "true"}
            )
            return True
        except Exception as e:
            logger.error(f"Supabase Storage upload failed for '{key}': {e}")
            return False

    def save_state_profile_to_s3(self, profile: Dict, state_code: str) -> bool:
        """Save enriched state profile to Supabase Storage."""
        try:
            state_name = profile['identity']['state_name']
            state_slug = state_name.lower().replace(' ', '-')

            key = f"enriched-regional-data/state-profiles/{state_slug}/profile.json"
            ok = self._storage_upload(key, json.dumps(profile, indent=2).encode())
            if ok:
                logger.info(f"✓ Saved: supabase://{self.bucket}/{key}")

            for section in ['demographics', 'employment', 'economics', 'wealth']:
                if profile.get(section):
                    sec_key = f"enriched-regional-data/state-profiles/{state_slug}/{section}.json"
                    self._storage_upload(sec_key, json.dumps(profile[section], indent=2).encode())

            return ok

        except Exception as e:
            logger.error(f"Error saving profile: {e}")
            return False
    
    def enrich_all_states(self) -> Dict:
        """Enrich and save all state profiles"""
        logger.info("\n🚀 Starting full state enrichment pipeline...")
        
        results = {
            'states_processed': 0,
            'states_successful': 0,
            'states_failed': 0,
            'timestamp': datetime.now().isoformat(),
            'summary': {}
        }
        
        for state_code, state_name in STATES.items():
            results['states_processed'] += 1
            
            try:
                profile = self.enrich_state_profile(state_code, state_name)
                
                if profile and self.save_state_profile_to_s3(profile, state_code):
                    results['states_successful'] += 1
                    results['summary'][state_code] = {
                        'status': 'success',
                        'classification': profile['derived_metrics'].get('region_classification', 'Unknown')
                    }
                else:
                    results['states_failed'] += 1
                    results['summary'][state_code] = {'status': 'failed'}
            
            except Exception as e:
                logger.error(f"Error processing {state_name}: {e}")
                results['states_failed'] += 1
                results['summary'][state_code] = {'status': 'error', 'error': str(e)}
        
        # Save summary
        self._save_enrichment_summary(results)
        
        logger.info(f"\n✅ Pipeline complete:")
        logger.info(f"   Processed: {results['states_processed']}")
        logger.info(f"   Successful: {results['states_successful']}")
        logger.info(f"   Failed: {results['states_failed']}")
        
        return results
    
    def _save_enrichment_summary(self, results: Dict) -> bool:
        """Save pipeline execution summary to Supabase Storage"""
        try:
            timestamp = datetime.now().strftime('%Y-%m-%d-%H-%M-%S')
            key = f"data-pipeline-logs/enrichment-summary-{timestamp}.json"
            ok = self._storage_upload(key, json.dumps(results, indent=2).encode())
            if ok:
                logger.info(f"✓ Saved summary: supabase://{self.bucket}/{key}")
            return ok
        except Exception as e:
            logger.error(f"Error saving summary: {e}")
            return False
    
    def create_regional_aggregations(self) -> bool:
        """Create aggregated data for geographic regions"""
        logger.info("\n📊 Creating regional aggregations...")
        
        try:
            for region_name, state_codes in REGIONS.items():
                region_data = {
                    'region': region_name,
                    'states': state_codes,
                    'state_count': len(state_codes),
                    'aggregations': {},
                    'timestamp': datetime.now().isoformat()
                }
                
                # In production, load state profiles and aggregate metrics
                region_slug = region_name.lower().replace(' ', '-')
                key = f"enriched-regional-data/regional-comparisons/{region_slug}.json"
                self._storage_upload(key, json.dumps(region_data, indent=2).encode())
                logger.info(f"✓ Saved: supabase://{self.bucket}/{key}")
            
            return True
        
        except Exception as e:
            logger.error(f"Error creating regional aggregations: {e}")
            return False


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    pipeline = DataEnrichmentPipeline()
    
    # Run full enrichment
    results = pipeline.enrich_all_states()
    
    # Create aggregations
    pipeline.create_regional_aggregations()
    
    print("\n" + "="*60)
    print("ENRICHMENT PIPELINE COMPLETE")
    print("="*60)
    print(json.dumps(results, indent=2, default=str))
