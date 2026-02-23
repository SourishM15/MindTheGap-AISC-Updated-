"""
Supabase Database Layer for MindTheGap
Replaces CSV-based storage with scalable PostgreSQL via Supabase
"""

import os
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import logging
from functools import wraps
import asyncio

from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Supabase credentials
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.warning("⚠️  Supabase credentials not found. Set SUPABASE_URL and SUPABASE_KEY in .env")
    supabase_client = None
else:
    try:
        supabase_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info("✓ Connected to Supabase")
    except Exception as e:
        logger.error(f"Error connecting to Supabase: {e}")
        supabase_client = None


class SupabaseDB:
    """Supabase database wrapper for MindTheGap"""
    
    def __init__(self):
        self.client = supabase_client
        if not self.client:
            logger.warning("⚠️  Supabase not initialized. Some features will be limited.")
    
    # ============ WEALTH DATA QUERIES ============
    
    def get_wealth_data(
        self,
        category: Optional[str] = None,
        date_range: Optional[Tuple[str, str]] = None,
        limit: int = 100
    ) -> List[Dict]:
        """
        Fetch wealth distribution data
        
        Args:
            category: e.g., "Top 1%", "Bottom 50%"
            date_range: (start_date, end_date) tuple
            limit: Max results
        
        Returns:
            List of wealth records
        """
        if not self.client:
            logger.error("Supabase not connected")
            return []
        
        try:
            query = self.client.table("wealth_distribution").select("*")
            
            if category:
                query = query.eq("category", category)
            
            if date_range:
                start_date, end_date = date_range
                query = query.gte("date", start_date).lte("date", end_date)
            
            query = query.order("date", desc=True).limit(limit)
            result = query.execute()
            
            logger.info(f"Fetched {len(result.data)} wealth records")
            return result.data
        
        except Exception as e:
            logger.error(f"Error fetching wealth data: {e}")
            return []
    
    def get_wealth_by_metric(
        self,
        metric: str,  # e.g., "net_worth", "income", "assets"
        category: str,
        limit: int = 50
    ) -> List[Dict]:
        """Fetch specific wealth metric by category"""
        if not self.client:
            return []
        
        try:
            result = self.client.table("wealth_distribution").select(
                "date,category," + metric
            ).eq("category", category).order("date", desc=True).limit(limit).execute()
            
            return result.data
        except Exception as e:
            logger.error(f"Error fetching {metric}: {e}")
            return []
    
    # ============ DEMOGRAPHIC DATA QUERIES ============
    
    def get_demographic_data(
        self,
        demographic_type: str,  # "race", "age", "education", "generation"
        group: Optional[str] = None,
        location: Optional[str] = None
    ) -> List[Dict]:
        """
        Fetch demographic data with wealth breakdown
        
        Args:
            demographic_type: race, age, education, generation
            group: Specific demographic group (e.g., "Black", "25-34")
            location: Geographic location
        
        Returns:
            Demographic records with wealth data
        """
        if not self.client:
            return []
        
        try:
            query = self.client.table("demographics").select("*").eq("type", demographic_type)
            
            if group:
                query = query.eq("group_name", group)
            
            if location:
                query = query.eq("location", location)
            
            result = query.order("date", desc=True).execute()
            return result.data
        
        except Exception as e:
            logger.error(f"Error fetching demographic data: {e}")
            return []
    
    def get_racial_wealth_gap(self, limit: int = 20) -> List[Dict]:
        """Get racial wealth gap data"""
        return self.get_demographic_data("race", limit=limit)
    
    def get_age_wealth_distribution(self) -> List[Dict]:
        """Get wealth distribution by age group"""
        return self.get_demographic_data("age")
    
    def get_education_wealth_correlation(self) -> List[Dict]:
        """Get wealth by education level"""
        return self.get_demographic_data("education")
    
    # ============ GOVERNMENT DATA QUERIES ============
    
    def get_economic_indicators(
        self,
        state: Optional[str] = None,
        county: Optional[str] = None,
        date_from: Optional[str] = None
    ) -> List[Dict]:
        """
        Fetch government economic indicators (BLS, Census, FRED)
        
        Args:
            state: State code (e.g., "WA")
            county: County name
            date_from: Only data from this date onward
        
        Returns:
            Economic indicator records
        """
        if not self.client:
            return []
        
        try:
            query = self.client.table("economic_indicators").select("*")
            
            if state:
                query = query.eq("state", state.upper())
            
            if county:
                query = query.eq("county", county)
            
            if date_from:
                query = query.gte("date", date_from)
            
            result = query.order("date", desc=True).limit(100).execute()
            return result.data
        
        except Exception as e:
            logger.error(f"Error fetching economic indicators: {e}")
            return []
    
    def get_point_in_time_indicators(self, state: str, date: str) -> Optional[Dict]:
        """Get all indicators for a specific state and date"""
        if not self.client:
            return None
        
        try:
            result = self.client.table("economic_indicators").select("*").eq(
                "state", state.upper()
            ).eq("date", date).single().execute()
            
            return result.data
        except Exception as e:
            logger.debug(f"No indicator for {state} on {date}")
            return None
    
    # ============ TREND DATA QUERIES ============
    
    def get_trend_data(
        self,
        metric: str,
        start_date: str,
        end_date: str
    ) -> List[Dict]:
        """Get historical trend data for analysis"""
        if not self.client:
            return []
        
        try:
            result = self.client.table("trend_cache").select("*").eq(
                "metric", metric
            ).gte("date", start_date).lte("date", end_date).order("date").execute()
            
            return result.data
        except Exception as e:
            logger.error(f"Error fetching trend data: {e}")
            return []
    
    def cache_trend_analysis(self, metric: str, analysis: Dict):
        """Cache trend analysis results"""
        if not self.client:
            return
        
        try:
            self.client.table("trend_cache").insert({
                "metric": metric,
                "analysis": analysis,
                "date": datetime.now().isoformat(),
                "cached_at": datetime.now().isoformat()
            }).execute()
            
            logger.info(f"Cached trend analysis for {metric}")
        except Exception as e:
            logger.warning(f"Could not cache trend: {e}")
    
    # ============ POLICY DATA QUERIES ============
    
    def get_policies_for_situation(
        self,
        gini_min: float = 0.4,
        gini_max: float = 0.6,
        poverty_min: float = 0,
        poverty_max: float = 25
    ) -> List[Dict]:
        """Get policies matching economic situation"""
        if not self.client:
            return []
        
        try:
            result = self.client.table("policy_recommendations").select("*").gte(
                "gini_coefficient_min", gini_min
            ).lte("gini_coefficient_max", gini_max).execute()
            
            return result.data
        except Exception as e:
            logger.error(f"Error fetching policies: {e}")
            return []
    
    # ============ SEARCH & ANALYTICS ============
    
    def search_wealth_data(self, query: str) -> List[Dict]:
        """Full-text search across all wealth data"""
        if not self.client:
            return []
        
        try:
            # Supabase full-text search
            result = self.client.rpc(
                "search_wealth_data",
                {"search_query": query}
            ).execute()
            
            return result.data
        except Exception as e:
            logger.debug(f"Full-text search not available: {e}")
            return []
    
    def get_statistics(self, table: str) -> Dict:
        """Get aggregate statistics for a table"""
        if not self.client:
            return {}
        
        try:
            result = self.client.rpc(
                f"get_{table}_statistics",
                {}
            ).execute()
            
            return result.data
        except Exception as e:
            logger.debug(f"Statistics not available for {table}: {e}")
            return {}
    
    # ============ REAL-TIME SUBSCRIPTIONS ============
    
    def subscribe_to_wealth_updates(self, callback):
        """Subscribe to real-time wealth data updates"""
        if not self.client:
            logger.warning("Cannot subscribe: Supabase not connected")
            return
        
        try:
            self.client.table("wealth_distribution").on(
                "*", lambda payload: callback(payload)
            ).subscribe()
            
            logger.info("✓ Subscribed to real-time wealth updates")
        except Exception as e:
            logger.warning(f"Could not subscribe to updates: {e}")
    
    # ============ DATA INSERTION (FOR MIGRATIONS) ============
    
    def insert_wealth_data(self, data: List[Dict]) -> bool:
        """Insert wealth data (used during migrations)"""
        if not self.client:
            return False
        
        try:
            # Batch insert
            self.client.table("wealth_distribution").insert(data).execute()
            logger.info(f"Inserted {len(data)} wealth records")
            return True
        except Exception as e:
            logger.error(f"Error inserting wealth data: {e}")
            return False
    
    def insert_demographic_data(self, data: List[Dict]) -> bool:
        """Insert demographic data"""
        if not self.client:
            return False
        
        try:
            self.client.table("demographics").insert(data).execute()
            logger.info(f"Inserted {len(data)} demographic records")
            return True
        except Exception as e:
            logger.error(f"Error inserting demographic data: {e}")
            return False
    
    def insert_economic_indicators(self, data: List[Dict]) -> bool:
        """Insert government economic indicator data"""
        if not self.client:
            return False
        
        try:
            self.client.table("economic_indicators").insert(data).execute()
            logger.info(f"Inserted {len(data)} economic indicator records")
            return True
        except Exception as e:
            logger.error(f"Error inserting economic indicators: {e}")
            return False
    
    # ============ UTILITY METHODS ============
    
    def get_date_range(self, table: str) -> Optional[Tuple[str, str]]:
        """Get min and max dates in a table"""
        if not self.client:
            return None
        
        try:
            result = self.client.rpc(
                f"get_{table}_date_range",
                {}
            ).execute()
            
            if result.data:
                return (result.data["min_date"], result.data["max_date"])
        except Exception as e:
            logger.debug(f"Could not get date range: {e}")
        
        return None
    
    def get_unique_categories(self, table: str, column: str) -> List[str]:
        """Get unique values for a column"""
        if not self.client:
            return []
        
        try:
            result = self.client.table(table).select(column, count="exact").execute()
            return [row[column] for row in result.data if row[column]]
        except Exception as e:
            logger.debug(f"Could not get unique values: {e}")
            return []


# Global instance
_db_instance: Optional[SupabaseDB] = None


def get_db() -> SupabaseDB:
    """Get or create the global database instance"""
    global _db_instance
    if _db_instance is None:
        _db_instance = SupabaseDB()
    return _db_instance


def db_fallback(fallback_value=None):
    """
    Decorator to provide fallback when Supabase is unavailable
    Automatically falls back to provided value or logs warning
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                logger.warning(f"Database operation failed: {e}, using fallback")
                return fallback_value
        return wrapper
    return decorator
