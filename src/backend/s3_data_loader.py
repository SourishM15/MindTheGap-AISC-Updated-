"""
Government Data Loader
Loads and caches government datasets from Supabase Storage (free tier).
"""
import os
import pandas as pd
import json
import logging
from io import StringIO
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client

logger = logging.getLogger(__name__)
load_dotenv(override=True)

def _get_supabase() -> Client | None:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    if not url or not key:
        logger.warning("⚠️  Supabase credentials not set — storage unavailable")
        return None
    try:
        return create_client(url, key)
    except Exception as e:
        logger.error(f"Could not create Supabase client: {e}")
        return None

class S3DataLoader:
    """Load and cache government data from Supabase Storage.

    Public interface is unchanged from the previous AWS S3 version so the
    rest of the codebase requires no modifications.
    """

    def __init__(self):
        self.bucket = "mindthegap-gov-data"
        self._supabase = _get_supabase()
        self.cache: dict = {}
        self.cache_timestamp: dict = {}
        self.cache_ttl = 3600  # 1 hour

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _download(self, key: str) -> bytes | None:
        """Download a file from Supabase Storage; returns raw bytes or None."""
        if not self._supabase:
            return None
        try:
            return self._supabase.storage.from_(self.bucket).download(key)
        except Exception as e:
            logger.warning(f"Supabase Storage download failed for '{key}': {e}")
            return None

    def _read_csv(self, key: str) -> pd.DataFrame:
        raw = self._download(key)
        if raw:
            return pd.read_csv(StringIO(raw.decode("utf-8")))
        return pd.DataFrame()

    def _read_json(self, key: str):
        raw = self._download(key)
        if raw:
            return json.loads(raw)
        return None

    def upload(self, key: str, data: bytes) -> bool:
        """Upload bytes to Supabase Storage (upsert)."""
        if not self._supabase:
            return False
        try:
            self._supabase.storage.from_(self.bucket).upload(
                key, data, file_options={"upsert": "true"}
            )
            return True
        except Exception as e:
            logger.error(f"Supabase Storage upload failed for '{key}': {e}")
            return False
    
    # ------------------------------------------------------------------
    # Public data-loading methods
    # ------------------------------------------------------------------

    def load_census_data(self) -> pd.DataFrame:
        """Load Census demographic data from Supabase Storage."""
        cache_key = "census_data"
        if self._is_cached(cache_key):
            return self.cache[cache_key]

        df = self._read_csv('government-data/census/census_demographics_2023.csv')

        for extra_key in [
            'government-data/census/dfa-age-levels.csv',
            'government-data/census/dfa-education-levels.csv',
            'government-data/census/dfa-income-levels.csv',
            'government-data/census/dfa-race-levels.csv',
        ]:
            tmp = self._read_csv(extra_key)
            if not tmp.empty:
                df = pd.concat([df, tmp], ignore_index=True)

        if not df.empty:
            self.cache[cache_key] = df
            self.cache_timestamp[cache_key] = datetime.now()
            logger.info(f"✓ Loaded {len(df)} Census records from Supabase Storage")
        else:
            logger.warning("Census data unavailable from Supabase Storage")
        return df

    def load_bls_data(self) -> pd.DataFrame:
        """Load BLS employment data from Supabase Storage."""
        cache_key = "bls_data"
        if self._is_cached(cache_key):
            return self.cache[cache_key]

        df = self._read_csv('government-data/bls/bls_employment_2023.csv')
        if not df.empty:
            self.cache[cache_key] = df
            self.cache_timestamp[cache_key] = datetime.now()
            logger.info(f"✓ Loaded {len(df)} BLS records from Supabase Storage")
        else:
            logger.warning("BLS data unavailable from Supabase Storage")
        return df

    def load_dfa_dataframe(self, filename: str) -> pd.DataFrame:
        """Load a Federal Reserve DFA CSV.

        Tries Supabase Storage first; falls back to local src/data/ directory.
        """
        cache_key = f"dfa_{filename}"
        if self._is_cached(cache_key):
            return self.cache[cache_key]

        df = self._read_csv(f"government-data/census/{filename}")
        if df.empty:
            local_path = os.path.join(os.path.dirname(__file__), '..', 'data', filename)
            try:
                df = pd.read_csv(local_path)
                logger.info(f"✓ Loaded {filename} from local fallback ({len(df)} rows)")
            except Exception as e:
                logger.error(f"Local fallback failed for {filename}: {e}")

        if not df.empty:
            self.cache[cache_key] = df
            self.cache_timestamp[cache_key] = datetime.now()
        return df

    def load_fred_data(self) -> pd.DataFrame:
        """Load FRED economic indicators from Supabase Storage."""
        cache_key = "fred_data"
        if self._is_cached(cache_key):
            return self.cache[cache_key]

        df = self._read_csv('government-data/fred/fred_economic_indicators_2023.csv')
        if not df.empty:
            self.cache[cache_key] = df
            self.cache_timestamp[cache_key] = datetime.now()
            logger.info(f"✓ Loaded {len(df)} FRED records from Supabase Storage")
        else:
            logger.warning("FRED data unavailable from Supabase Storage")
        return df

    def load_all_data(self) -> dict:
        """Load all government data."""
        census = self.load_census_data()
        bls = self.load_bls_data()
        fred = self.load_fred_data()
        total = len(census) + len(bls) + len(fred)
        logger.info(f"✓ Loaded {total} total government records")
        return {
            'census': census,
            'bls': bls,
            'fred': fred,
            'timestamp': datetime.now().isoformat(),
        }

    def get_economic_indicators(self, indicator_type=None) -> list:
        fred_data = self.load_fred_data()
        if fred_data.empty:
            return []
        if indicator_type:
            return fred_data[fred_data['Indicator'] == indicator_type].to_dict('records')
        return fred_data.to_dict('records')

    def get_employment_stats(self, industry=None) -> list:
        bls_data = self.load_bls_data()
        if bls_data.empty:
            return []
        if industry:
            return bls_data[bls_data['Industry'] == industry].to_dict('records')
        return bls_data.to_dict('records')

    def get_demographic_info(self, location=None) -> list:
        census_data = self.load_census_data()
        if census_data.empty:
            return []
        if location:
            for col in ('Location', 'State'):
                if col in census_data.columns:
                    return census_data[
                        census_data[col].str.contains(location, case=False, na=False)
                    ].to_dict('records')
        
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
    
    def _is_cached(self, cache_key: str) -> bool:
        if cache_key not in self.cache or cache_key not in self.cache_timestamp:
            return False
        age = (datetime.now() - self.cache_timestamp[cache_key]).total_seconds()
        return age < self.cache_ttl

    def clear_cache(self) -> None:
        self.cache.clear()
        self.cache_timestamp.clear()
        logger.info("✓ Storage data cache cleared")

    def get_storage_stats(self) -> dict:
        """Return basic info about the configured storage bucket."""
        files: list = []
        if self._supabase:
            try:
                files = self._supabase.storage.from_(self.bucket).list() or []
            except Exception as e:
                logger.error(f"Could not list Supabase Storage bucket: {e}")
        return {
            'bucket': self.bucket,
            'provider': 'supabase',
            'total_objects': len(files),
            'data_types': ['census', 'bls', 'fred'],
            'cached_data': list(self.cache.keys()),
        }

    # Keep old name as alias so existing callers don't break
    get_s3_stats = get_storage_stats


# Global instance
s3_loader = S3DataLoader()

