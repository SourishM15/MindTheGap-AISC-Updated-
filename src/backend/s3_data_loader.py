"""
S3 Government Data Loader
Loads and caches government datasets from AWS S3
"""
import os
import boto3
import pandas as pd
import json
import logging
from io import StringIO
from datetime import datetime, timedelta
from functools import lru_cache
from dotenv import load_dotenv

logger = logging.getLogger(__name__)
load_dotenv()

class S3DataLoader:
    """Load and cache government data from S3"""
    
    def __init__(self):
        self.bucket = "mindthegap-gov-data"
        self.region = os.getenv("AWS_REGION", "us-east-2")
        self.s3_client = boto3.client('s3', region_name=self.region)
        self.cache = {}
        self.cache_timestamp = {}
        self.cache_ttl = 3600  # 1 hour cache
    
    def load_census_data(self):
        """Load Census demographic data from S3"""
        cache_key = "census_data"
        
        if self._is_cached(cache_key):
            return self.cache[cache_key]
        
        try:
            # Load the 2023 Census demographics file
            response = self.s3_client.get_object(
                Bucket=self.bucket,
                Key='government-data/census/census_demographics_2023.csv'
            )
            df = pd.read_csv(StringIO(response['Body'].read().decode('utf-8')))
            
            # Also try to load detailed demographic files if available
            demo_files = [
                'government-data/census/dfa-age-levels.csv',
                'government-data/census/dfa-education-levels.csv',
                'government-data/census/dfa-income-levels.csv',
                'government-data/census/dfa-race-levels.csv'
            ]
            
            for file_key in demo_files:
                try:
                    response = self.s3_client.get_object(Bucket=self.bucket, Key=file_key)
                    temp_df = pd.read_csv(StringIO(response['Body'].read().decode('utf-8')))
                    df = pd.concat([df, temp_df], ignore_index=True)
                except:
                    pass
            
            self.cache[cache_key] = df
            self.cache_timestamp[cache_key] = datetime.now()
            logger.info(f"✓ Loaded {len(df)} Census records from S3")
            return df
        
        except Exception as e:
            logger.error(f"Error loading Census data from S3: {e}")
            return pd.DataFrame()
    
    def load_bls_data(self):
        """Load BLS employment data from S3"""
        cache_key = "bls_data"
        
        if self._is_cached(cache_key):
            return self.cache[cache_key]
        
        try:
            response = self.s3_client.get_object(
                Bucket=self.bucket,
                Key='government-data/bls/bls_employment_2023.csv'
            )
            df = pd.read_csv(StringIO(response['Body'].read().decode('utf-8')))
            
            self.cache[cache_key] = df
            self.cache_timestamp[cache_key] = datetime.now()
            logger.info(f"✓ Loaded {len(df)} BLS employment records from S3")
            return df
        
        except Exception as e:
            logger.error(f"Error loading BLS data from S3: {e}")
            return pd.DataFrame()
    
    def load_fred_data(self):
        """Load FRED economic indicators from S3"""
        cache_key = "fred_data"
        
        if self._is_cached(cache_key):
            return self.cache[cache_key]
        
        try:
            response = self.s3_client.get_object(
                Bucket=self.bucket,
                Key='government-data/fred/fred_economic_indicators_2023.csv'
            )
            df = pd.read_csv(StringIO(response['Body'].read().decode('utf-8')))
            
            self.cache[cache_key] = df
            self.cache_timestamp[cache_key] = datetime.now()
            logger.info(f"✓ Loaded {len(df)} FRED economic records from S3")
            return df
        
        except Exception as e:
            logger.error(f"Error loading FRED data from S3: {e}")
            return pd.DataFrame()
    
    def load_all_data(self):
        """Load all government data from S3"""
        try:
            census = self.load_census_data()
            bls = self.load_bls_data()
            fred = self.load_fred_data()
            
            total_records = len(census) + len(bls) + len(fred)
            logger.info(f"✓ Loaded {total_records} total government records from S3")
            
            return {
                'census': census,
                'bls': bls,
                'fred': fred,
                'timestamp': datetime.now().isoformat()
            }
        
        except Exception as e:
            logger.error(f"Error loading data from S3: {e}")
            return {}
    
    def get_economic_indicators(self, indicator_type=None):
        """Get economic indicators (FRED data) optionally filtered by type"""
        fred_data = self.load_fred_data()
        
        if fred_data.empty:
            return []
        
        if indicator_type:
            return fred_data[fred_data['Indicator'] == indicator_type].to_dict('records')
        
        return fred_data.to_dict('records')
    
    def get_employment_stats(self, industry=None):
        """Get employment statistics (BLS data) optionally filtered by industry"""
        bls_data = self.load_bls_data()
        
        if bls_data.empty:
            return []
        
        if industry:
            return bls_data[bls_data['Industry'] == industry].to_dict('records')
        
        return bls_data.to_dict('records')
    
    def get_demographic_info(self, location=None):
        """Get demographic information (Census data) optionally filtered by location"""
        census_data = self.load_census_data()
        
        if census_data.empty:
            return []
        
        # Try both 'Location' and 'State' columns for location filtering
        if location:
            if 'Location' in census_data.columns:
                return census_data[census_data['Location'].str.contains(location, case=False, na=False)].to_dict('records')
            elif 'State' in census_data.columns:
                return census_data[census_data['State'].str.contains(location, case=False, na=False)].to_dict('records')
        
        return census_data.to_dict('records')
    
    def search_government_data(self, query, data_type='all'):
        """Search government data by keyword"""
        results = {
            'census': [],
            'bls': [],
            'fred': []
        }
        
        query_lower = query.lower()
        
        if data_type in ['census', 'all']:
            census = self.load_census_data()
            # Search across all columns
            for col in census.columns:
                if census[col].dtype == 'object':
                    mask = census[col].astype(str).str.contains(query_lower, case=False, na=False)
                    results['census'].extend(census[mask].to_dict('records'))
        
        if data_type in ['bls', 'all']:
            bls = self.load_bls_data()
            for col in bls.columns:
                if bls[col].dtype == 'object':
                    mask = bls[col].astype(str).str.contains(query_lower, case=False, na=False)
                    results['bls'].extend(bls[mask].to_dict('records'))
        
        if data_type in ['fred', 'all']:
            fred = self.load_fred_data()
            for col in fred.columns:
                if fred[col].dtype == 'object':
                    mask = fred[col].astype(str).str.contains(query_lower, case=False, na=False)
                    results['fred'].extend(fred[mask].to_dict('records'))
        
        return results
    
    def _is_cached(self, cache_key):
        """Check if cache is still valid"""
        if cache_key not in self.cache:
            return False
        
        if cache_key not in self.cache_timestamp:
            return False
        
        age = (datetime.now() - self.cache_timestamp[cache_key]).total_seconds()
        return age < self.cache_ttl
    
    def clear_cache(self):
        """Clear all cached data"""
        self.cache.clear()
        self.cache_timestamp.clear()
        logger.info("✓ S3 data cache cleared")
    
    def get_s3_stats(self):
        """Get statistics about S3 bucket"""
        try:
            response = self.s3_client.list_objects_v2(Bucket=self.bucket)
            object_count = len(response.get('Contents', []))
            total_size = sum([obj['Size'] for obj in response.get('Contents', [])])
            
            return {
                'bucket': self.bucket,
                'region': self.region,
                'total_objects': object_count,
                'total_size_mb': round(total_size / (1024 * 1024), 2),
                'data_types': ['census', 'bls', 'fred'],
                'cached_data': list(self.cache.keys())
            }
        
        except Exception as e:
            logger.error(f"Error getting S3 stats: {e}")
            return {}


# Global instance
s3_loader = S3DataLoader()
