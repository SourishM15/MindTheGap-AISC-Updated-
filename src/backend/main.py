import os
import re
import logging
import json
import secrets
import time
import asyncio
from collections import defaultdict, deque
from datetime import datetime
from functools import lru_cache
from fastapi import FastAPI, HTTPException, Header, Depends, Query, Request
from typing import Any, Optional, Annotated
from pydantic import BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import pandas as pd
import networkx as nx
from starlette.middleware.trustedhost import TrustedHostMiddleware
from langchain_core.prompts import PromptTemplate
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from dotenv import load_dotenv
from graph_rag import get_graph_rag_context
from policy_recommendations import (
    get_policy_recommendations_for_region,
    reload_policy_database,
    update_policy_database,
    get_policy_database,
    get_policy_database_metadata,
)
from conversation_context_manager import ConversationContextManager, TopicCategory
from regional_policy_history import get_policy_history_context, get_policy_brief_for_api, get_available_regions
from government_api import get_local_economic_indicators, clear_api_cache
from s3_data_loader import s3_loader
from city_api_client import city_client
from saipe_api_client import saipe_client, STATE_FIPS as SAIPE_STATE_FIPS
from census_api_client import CensusAPIClient
from bea_api_client import BEAAPIClient
from data_enrichment_pipeline import STATES
from state_profile_builder import build_api_enriched_metro_profile, build_api_enriched_state_profile

census_client = CensusAPIClient()
bea_client = BEAAPIClient()
_STATE_BENCHMARK_CACHE: dict = {"payload": None, "created_at": None}
_STATE_BENCHMARK_TTL_SECONDS = 60 * 60
_LIVE_STATE_PROFILE_CACHE: dict[str, dict] = {}
_SUPABASE_STORAGE_BUCKET = "mindthegap-gov-data"

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv(override=True)

# Set up Groq API key
groq_api_key = os.getenv("GROQ_API_KEY")
GROQ_MODEL = "llama-3.3-70b-versatile"
if not groq_api_key:
    logger.warning("GROQ_API_KEY not found in .env file. Please add it.")

def _env_csv(name: str, default: str) -> list[str]:
    raw = os.getenv(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


APP_ENV = os.getenv("APP_ENV", "development").lower()
ENABLE_API_DOCS = os.getenv("ENABLE_API_DOCS", "true" if APP_ENV != "production" else "false").lower() == "true"

# Initialize FastAPI app
app = FastAPI(
    title="MindTheGap API",
    version="2.0",
    docs_url="/docs" if ENABLE_API_DOCS else None,
    redoc_url="/redoc" if ENABLE_API_DOCS else None,
    openapi_url="/openapi.json" if ENABLE_API_DOCS else None,
)

allowed_hosts = _env_csv("ALLOWED_HOSTS", "localhost,127.0.0.1,testserver")
app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts)

# Add CORS middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=_env_csv(
        "CORS_ALLOW_ORIGINS",
        "http://localhost:5173,http://localhost:5174,http://localhost:3000,http://localhost:3001",
    ),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "OPTIONS"],
    allow_headers=["Content-Type", "X-Admin-Key"],
)

_RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))
_RATE_LIMIT_MAX_REQUESTS = int(os.getenv("RATE_LIMIT_MAX_REQUESTS", "60"))
_RATE_LIMITED_PREFIXES = ("/api/chat", "/api/admin", "/api/policy-database")
_RATE_LIMIT_BUCKETS: dict[str, deque[float]] = defaultdict(deque)


def _client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@app.middleware("http")
async def security_middleware(request: Request, call_next):
    if request.url.path.startswith(_RATE_LIMITED_PREFIXES):
        now = time.monotonic()
        bucket_key = f"{_client_ip(request)}:{request.url.path}"
        hits = _RATE_LIMIT_BUCKETS[bucket_key]
        while hits and now - hits[0] > _RATE_LIMIT_WINDOW_SECONDS:
            hits.popleft()
        if len(hits) >= _RATE_LIMIT_MAX_REQUESTS:
            return JSONResponse({"detail": "Rate limit exceeded"}, status_code=429)
        hits.append(now)

    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    response.headers.setdefault("Cache-Control", "no-store" if request.url.path.startswith("/api/admin") else "private, max-age=60")
    if request.url.scheme == "https":
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    return response

# ---------------------------------------------------------------------------
# Security helpers
# ---------------------------------------------------------------------------
_SAFE_SLUG_RE = re.compile(r'[^a-zA-Z0-9 \-]')

def _safe_slug(name: str) -> str:
    """Strip any characters that could enable path traversal before embedding
    a user-supplied value in an S3 key.  Only letters, digits, spaces, and
    hyphens are allowed; everything else (dots, slashes, backslashes, etc.)
    is removed."""
    return _SAFE_SLUG_RE.sub('', name).strip().lower().replace(' ', '-')

# Admin endpoints require an X-Admin-Key header matching the ADMIN_API_KEY env var.
# If ADMIN_API_KEY is not set, admin endpoints are disabled entirely.
_ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "")

def _require_admin(x_admin_key: Optional[str] = Header(default=None)) -> None:
    """FastAPI dependency that enforces admin authentication."""
    if not _ADMIN_API_KEY:
        raise HTTPException(status_code=503, detail="Admin endpoints are disabled (ADMIN_API_KEY not configured)")
    if not x_admin_key or not secrets.compare_digest(x_admin_key, _ADMIN_API_KEY):
        raise HTTPException(status_code=403, detail="Invalid or missing admin key")

def _recent_release_years(max_lag: int = 2, lookback: int = 8) -> list[int]:
    """Return likely data release years, newest first.

    Government datasets usually lag the calendar year, so start at current year
    minus max_lag and walk backwards until an API returns data.
    """
    start = datetime.now().year - max_lag
    return list(range(start, start - lookback, -1))

def _benchmark_candidate_years() -> list[int]:
    """Return a short candidate list for live benchmark data.

    This endpoint is user-facing, so keep live Census/SAIPE probing bounded for
    hosted deployments. Override with STATE_BENCHMARK_YEARS=2024,2023,2022.
    """
    raw_years = os.getenv("STATE_BENCHMARK_YEARS", "")
    if raw_years:
        years: list[int] = []
        for raw_year in raw_years.split(","):
            try:
                years.append(int(raw_year.strip()))
            except ValueError:
                logger.warning("Ignoring invalid STATE_BENCHMARK_YEARS value: %s", raw_year)
        if years:
            return years

    lookback = max(1, min(int(os.getenv("STATE_BENCHMARK_LOOKBACK", "2")), 4))
    return _recent_release_years(max_lag=2, lookback=lookback)

async def _call_benchmark_source(label: str, func, *, year: int):
    """Run a blocking benchmark API call with a short API response budget."""
    timeout_seconds = float(os.getenv("STATE_BENCHMARK_CALL_TIMEOUT_SECONDS", "8"))
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(func, year=year),
            timeout=timeout_seconds,
        )
    except asyncio.TimeoutError:
        logger.warning("%s benchmark request timed out for %s", label, year)
        return [] if label == "SAIPE" else {}
    except Exception as exc:
        logger.warning("%s benchmark request failed for %s: %s", label, year, type(exc).__name__)
        return [] if label == "SAIPE" else {}

async def _invoke_chat_model(llm: ChatGroq, messages: list):
    """Invoke the chat model without letting hosted requests hang indefinitely."""
    timeout_seconds = float(os.getenv("CHAT_LLM_TIMEOUT_SECONDS", "12"))
    return await asyncio.wait_for(
        asyncio.to_thread(llm.invoke, messages),
        timeout=timeout_seconds,
    )

# ---------------------------------------------------------------------------
# --- Enrichment Data Loading (Government Data from Supabase Storage) ---
@lru_cache(maxsize=1)
def load_enrichment_knowledge_base():
    """Load chatbot knowledge base from Supabase Storage enrichment pipeline"""
    try:
        from supabase_db import supabase_client
        if not supabase_client:
            raise RuntimeError("Supabase client unavailable")

        kb_raw = supabase_client.storage.from_('mindthegap-gov-data').download(
            'chatbot-training-data/knowledge-base.json'
        )
        knowledge_base = json.loads(kb_raw)

        corr_raw = supabase_client.storage.from_('mindthegap-gov-data').download(
            'chatbot-training-data/economic-correlations.json'
        )
        correlations = json.loads(corr_raw)

        logger.info("✓ Enrichment knowledge base loaded from Supabase Storage")
        return {
            'knowledge_base': knowledge_base,
            'correlations': correlations,
            'status': 'loaded'
        }
    except Exception as e:
        logger.warning(f"Could not load enrichment knowledge base: {e}")
        return {
            'knowledge_base': None,
            'correlations': None,
            'status': 'unavailable'
        }

@lru_cache(maxsize=128)
def load_enriched_state_profile(state_name: str) -> Optional[dict]:
    """Load enriched profile for a specific state from Supabase Storage"""
    try:
        from supabase_db import supabase_client
        if not supabase_client:
            return None
        state_slug = _safe_slug(state_name)
        raw = supabase_client.storage.from_('mindthegap-gov-data').download(
            f'enriched-regional-data/state-profiles/{state_slug}/profile.json'
        )
        return json.loads(raw)
    except Exception as e:
        logger.info(f"No prebuilt enriched state profile for {state_name}; live Census/SAIPE fallback will be used")
        return None

def get_cached_live_state_profile(state_name: str) -> Optional[dict]:
    """Return an in-process live fallback profile, if one was built earlier."""
    return _LIVE_STATE_PROFILE_CACHE.get(_safe_slug(state_name))

def cache_live_state_profile(state_name: str, profile: dict) -> None:
    """Cache live Census/SAIPE/BEA fallback profiles to avoid repeat API calls."""
    _LIVE_STATE_PROFILE_CACHE[_safe_slug(state_name)] = profile

def load_enriched_metro_profile(metro_name: str) -> Optional[dict]:
    """Load enriched profile for a specific metro area from Supabase Storage"""
    try:
        from supabase_db import supabase_client
        if not supabase_client:
            return None
        metro_slug = _safe_slug(metro_name)
        raw = supabase_client.storage.from_('mindthegap-gov-data').download(
            f'enriched-regional-data/metro-areas/{metro_slug}/profile.json'
        )
        return json.loads(raw)
    except Exception as e:
        logger.warning(f"Could not load enriched metro profile for {metro_name}: {e}")
        return None

def get_enhanced_system_prompt():
    """Create system prompt with enriched regional knowledge"""
    enrichment_data = load_enrichment_knowledge_base()
    
    base_prompt = """You are the MindTheGap AI Assistant, an expert on wealth inequality and economic disparities across the United States. 

You have access to comprehensive government data on:
- Demographics (Census Bureau): Population, income, education, age, race distribution
- Employment (BLS): Unemployment rates, industries, wages
- Economics (Federal Reserve): GDP, inflation, housing, economic indicators
- Wealth Distribution: Gini coefficients, wealth gaps, inequality metrics

Your responses should:
1. Use real government data when answering about specific states
2. Explain wealth inequality through economic patterns and data
3. Compare states objectively using enriched data
4. Reference education, employment, and income relationships
5. Acknowledge regional economic differences and patterns"""
    
    # Add learned patterns if available
    if enrichment_data['correlations']:
        patterns_text = "\n\nKnown Economic Patterns (Learned from Enriched Data):\n"
        for i, pattern in enumerate(enrichment_data['correlations'][:5], 1):
            confidence = pattern.get('confidence', 0) * 100
            patterns_text += f"{i}. {pattern['pattern']} ({confidence:.0f}% confidence)\n"
            patterns_text += f"   Description: {pattern.get('description', 'N/A')}\n"
        base_prompt += patterns_text
    
    # Add regional facts if available
    if enrichment_data['knowledge_base'] and 'regional_facts' in enrichment_data['knowledge_base']:
        facts_text = "\n\nRegional Economic Facts:\n"
        for region, facts_dict in enrichment_data['knowledge_base']['regional_facts'].items():
            facts_text += f"\n{region.title()}:\n"
            if isinstance(facts_dict, dict):
                # Handle dictionary format with 'characteristics' and 'challenges'
                if 'characteristics' in facts_dict:
                    facts_text += "  Characteristics: "
                    facts_text += ", ".join(facts_dict['characteristics'][:2]) + "\n"
                if 'challenges' in facts_dict:
                    facts_text += "  Challenges: "
                    facts_text += ", ".join(facts_dict['challenges'][:2]) + "\n"
            elif isinstance(facts_dict, list):
                # Handle list format if it exists
                for fact in facts_dict[:2]:
                    facts_text += f"  • {fact}\n"
        base_prompt += facts_text
    
    return base_prompt

# Load enrichment data at startup
ENRICHMENT_DATA = load_enrichment_knowledge_base()
ENHANCED_SYSTEM_PROMPT = get_enhanced_system_prompt()
logger.info(f"Enrichment knowledge base status: {ENRICHMENT_DATA['status']}")

# Initialize conversation context manager for better topic/context switching
CONVERSATION_MANAGER = ConversationContextManager()
logger.info("✓ Conversation context manager initialized")

# --- Data Loading (from Supabase or CSV fallback) ---
from supabase_db import get_db, supabase_client

def load_data_and_create_graph():
    """Loads data from Supabase (or CSV fallback) and creates a graph."""
    
    G = nx.Graph()
    all_records = []
    
    # Try Supabase first
    db = get_db()
    if db and db.client:
        logger.info("📊 Loading data from Supabase...")
        
        try:
            # Get wealth data
            wealth_data = db.get_wealth_data(limit=10000)
            logger.info(f"✓ Loaded {len(wealth_data)} wealth records from Supabase")
            all_records.extend(wealth_data)
            
            # Get demographic data
            demo_data = db.get_demographic_data("race", limit=1000)
            logger.info(f"✓ Loaded {len(demo_data)} demographic records from Supabase")
            all_records.extend(demo_data)
            
            # Add to graph
            for record in all_records:
                data_type = record.get('data_type') or record.get('type', 'unknown')
                category = record.get('category') or record.get('group_name', 'unknown')
                date = record.get('date', 'unknown')
                
                node_id = f"{data_type}_{date}_{category}"
                G.add_node(node_id, **record)
            
            logger.info(f"✓ Loaded {len(all_records)} total records from Supabase")
            if len(all_records) > 0:
                logger.info("✅ Using Supabase as data source")
                return G, all_records, True  # True = data loaded from Supabase
        
        except Exception as e:
            logger.warning(f"Could not load from Supabase: {e}")
            logger.info("📂 Falling back to CSV files...")
    
    # Fallback: Load from CSV files
    logger.info("📂 Loading data from CSV files...")
    
    try:
        data_files = {
            'networth': "../data/dfa-networth-levels.csv",
            'income': "../data/dfa-income-levels.csv",
            'race': "../data/dfa-race-levels.csv",
            'age': "../data/dfa-age-levels.csv",
            'education': "../data/dfa-education-levels.csv",
            'generation': "../data/dfa-generation-levels.csv"
        }
        
        for data_type, file_path in data_files.items():
            try:
                df = pd.read_csv(file_path)
                logger.info(f"✓ Loaded {len(df)} {data_type} records from CSV")
                
                for _, row in df.iterrows():
                    node_id = f"{data_type}_{row.get('Date', 'unknown')}_{row.get('Category', 'unknown')}"
                    node_data = row.to_dict()
                    node_data['data_type'] = data_type
                    node_data['Date'] = row.get('Date', 'unknown')
                    node_data['Category'] = row.get('Category', 'unknown')
                    
                    G.add_node(node_id, **node_data)
                    all_records.append(node_data)
            
            except FileNotFoundError:
                logger.warning(f"CSV file not found: {file_path}")
                continue
        
        logger.info(f"✓ Created graph with {len(all_records)} records from CSV")
        if len(all_records) > 0:
            logger.info("⚠️  Using CSV files (set up Supabase for full features: see SUPABASE_SETUP.md)")
            return G, all_records, False  # False = data loaded from CSV
    
    except Exception as e:
        logger.error(f"Error loading CSV data: {e}")
    
    logger.error("❌ No data loaded from either source")
    return G, [], False

# Load data at startup
graph, all_records, using_supabase = load_data_and_create_graph()

if graph and len(all_records) > 0:
    logger.info(f"✓ Graph created with {graph.number_of_nodes()} nodes")
    
    if os.getenv("ENABLE_SEMANTIC_SEARCH", "false").lower() == "true":
        # Initialize vector store with all records for semantic search.
        try:
            from vector_embeddings import VectorStore

            vector_store = VectorStore()
            vector_store.add_documents(all_records)
            logger.info("✓ Vector embeddings initialized")
        except Exception as e:
            logger.warning(f"Could not initialize vector store: {e}")
    else:
        logger.info("Semantic search disabled; using keyword graph search")
else:
    logger.error("❌ Failed to load data from any source")

# --- LangChain and RAG Setup ---
def setup_llm_chain():
    """Sets up the LangChain runnable sequence for enhanced question answering."""
    llm = ChatGroq(temperature=0.2, groq_api_key=groq_api_key, model_name=GROQ_MODEL)
    
    template = """You are a non-partisan AI analyst for MindTheGap, a project dedicated to economic honesty and data integrity. You specialise in US wealth inequality analysis using real government data.

PRIMARY DATA SOURCES:
- Federal Reserve Distributional Financial Accounts (DFA): wealth distribution by percentile
- US Census Bureau ACS: demographic and socioeconomic data
- Bureau of Labor Statistics: employment and wage data
- SAIPE: small-area poverty and income estimates
- FRED: macroeconomic indicators

CORE INTEGRITY RULES — non-negotiable:
1. Cite the specific data source and metric for every factual claim (e.g. "BLS 2023: 3.8% unemployment")
2. If the Context lacks data to support a claim, say so explicitly — do not fill gaps with assumptions
3. For policy analysis: cite real programs by name, jurisdiction, year, and MEASURED outcome — not theoretical projections
4. Always present documented trade-offs and unintended consequences alongside any policy discussion
5. If economic evidence is contested or mixed among mainstream economists, say so — never misrepresent academic consensus
6. Use precise terminology: percentile groups, Gini coefficients, real vs nominal values — not vague qualifiers
7. Distinguish correlation from causation when discussing data trends
8. Do not advocate for any political position — present the honest empirical picture

GUIDELINES:
- For geographic queries: prioritise local data; explicitly note when only national data is available
- For trend queries: cite specific years and inflection points directly from the data
- For policy queries: ground every claim in historical precedent with measured, documented outcomes
- When uncertain: explicitly state confidence level and what additional data would change the answer

Context: {context}

Question: {question}

Detailed Analysis:"""
    
    prompt = PromptTemplate(template=template, input_variables=["context", "question"])
    llm_chain = prompt | llm
    return llm_chain

try:
    llm_chain = setup_llm_chain()
    logger.info("✓ LLM chain initialized successfully")
except Exception as e:
    logger.error(f"Error initializing LLM chain: {e}")
    llm_chain = None
# --- API Endpoints ---

@app.get("/")
def read_root():
    """Root endpoint to check if the server is running."""
    return {
        "message": "MindTheGap Backend v2.0 is running!",
        "features": [
            "Semantic search with embeddings",
            "Trend analysis engine",
            "Policy recommendations",
            "Government API integration",
            "Enhanced RAG pipeline"
        ]
    }

@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "graph_loaded": graph is not None,
        "llm_available": llm_chain is not None
    }

def _storage_folder_names(prefix: str) -> list[str]:
    """Return folder/object names under a Supabase Storage prefix."""
    from supabase_db import supabase_client
    if not supabase_client:
        raise RuntimeError("Supabase client unavailable")
    files = supabase_client.storage.from_(_SUPABASE_STORAGE_BUCKET).list(prefix) or []
    return sorted(f["name"] for f in files if f.get("name"))


def _storage_json(key: str) -> dict[str, Any]:
    from supabase_db import supabase_client
    if not supabase_client:
        return {}
    raw = supabase_client.storage.from_(_SUPABASE_STORAGE_BUCKET).download(key)
    return json.loads(raw)


def _profile_freshness(profile: dict[str, Any]) -> dict[str, Any]:
    identity = profile.get("identity") or {}
    data_quality = profile.get("data_quality") or {}
    demographics = profile.get("demographics") or {}
    return {
        "generated_at": identity.get("timestamp") or data_quality.get("last_updated") or demographics.get("timestamp"),
        "demographics_year": demographics.get("year"),
        "source": profile.get("source"),
        "sources": data_quality.get("sources", []),
    }


@app.get("/api/data-health")
async def data_health():
    """Summarize Supabase Storage coverage for prebuilt data assets."""
    expected_state_slugs = sorted(_safe_slug(name) for name in STATES.values())
    expected_metro_slugs = sorted(_safe_slug(name) for name in city_client.metro_areas.keys())

    result: dict[str, Any] = {
        "success": False,
        "status": "unavailable",
        "bucket": _SUPABASE_STORAGE_BUCKET,
        "generated_at": datetime.now().isoformat(),
        "coverage": {},
        "samples": {},
        "errors": [],
    }

    try:
        from supabase_db import supabase_client
        if not supabase_client:
            result["errors"].append("Supabase client is not configured")
            return result

        state_slugs = _storage_folder_names("enriched-regional-data/state-profiles")
        metro_slugs = _storage_folder_names("enriched-regional-data/metro-areas")
        census_objects = _storage_folder_names("government-data/census")
        dfa_objects = sorted(name for name in census_objects if name.startswith("dfa-") and name.endswith(".csv"))

        missing_states = sorted(set(expected_state_slugs) - set(state_slugs))
        missing_metros = sorted(set(expected_metro_slugs) - set(metro_slugs))

        result["coverage"] = {
            "states": {
                "present": len(state_slugs),
                "expected": len(expected_state_slugs),
                "missing": missing_states,
                "complete": not missing_states,
            },
            "metros": {
                "present": len(metro_slugs),
                "expected": len(expected_metro_slugs),
                "missing": missing_metros,
                "complete": not missing_metros,
            },
            "dfa_csvs": {
                "present": len(dfa_objects),
                "files": dfa_objects,
                "complete": len(dfa_objects) > 0,
            },
        }

        sample_state_slugs = [slug for slug in ["california", "minnesota", "new-york", "texas", "florida"] if slug in state_slugs]
        result["samples"]["states"] = {}
        for slug in sample_state_slugs:
            try:
                profile = _storage_json(f"enriched-regional-data/state-profiles/{slug}/profile.json")
                result["samples"]["states"][slug] = _profile_freshness(profile)
            except Exception as exc:
                result["samples"]["states"][slug] = {"error": str(exc)}

        sample_metro_slugs = [slug for slug in ["new-york", "los-angeles", "chicago", "seattle", "minneapolis"] if slug in metro_slugs]
        result["samples"]["metros"] = {}
        for slug in sample_metro_slugs:
            try:
                profile = _storage_json(f"enriched-regional-data/metro-areas/{slug}/profile.json")
                result["samples"]["metros"][slug] = _profile_freshness(profile)
            except Exception as exc:
                result["samples"]["metros"][slug] = {"error": str(exc)}

        result["success"] = True
        result["status"] = "healthy" if (
            result["coverage"]["states"]["complete"]
            and result["coverage"]["metros"]["complete"]
            and result["coverage"]["dfa_csvs"]["complete"]
        ) else "partial"
        return result
    except Exception as exc:
        logger.error(f"Data health check failed: {exc}")
        result["errors"].append(str(exc))
        return result


# --- Request/Response Models ---
class Message(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=4000)

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    conversation_id: str = Field(default="default", min_length=1, max_length=120, pattern=r"^[a-zA-Z0-9_.:-]+$")
    conversation_history: list[Message] = Field(default_factory=list, max_length=20)
    
class TrendRequest(BaseModel):
    category: str = Field(min_length=1, max_length=40)  # e.g., "networth", "income"
    demographic: Optional[str] = Field(default=None, max_length=80)
    
class PolicyRequest(BaseModel):
    gini_coefficient: float = Field(default=0.45, ge=0, le=1)
    top_1_percent_share: float = Field(default=35, ge=0, le=100)
    bottom_50_percent_share: float = Field(default=3, ge=0, le=100)
    unemployment_rate: float = Field(default=4.5, ge=0, le=100)
    poverty_rate: float = Field(default=12, ge=0, le=100)
    region: str = Field(default="National", min_length=1, max_length=120)


# --- Chat Endpoint (Enhanced) ---
def build_conversation_messages(history: list[Message]) -> list:
    """Convert chat history to LangChain message objects for proper multi-turn continuity.

    Returns the last 12 messages (6 full exchanges) so the model retains enough
    context to answer follow-up questions about the same topic without being
    explicitly re-told the location or subject.
    """
    msgs = []
    for msg in history[-12:]:  # 12 messages = 6 full exchanges
        if msg.role == "user":
            msgs.append(HumanMessage(content=msg.content))
        elif msg.role == "assistant":
            msgs.append(AIMessage(content=msg.content))
    return msgs


def build_chat_preamble(context, question: str) -> str:
    """Reusable instruction block for all chat prompts."""
    recent = context.get_recent_context(last_n_turns=4)
    recent_lines = []
    for msg in recent.get("messages", [])[-4:]:
        content = msg.get("content", "").replace("\n", " ")
        if content:
            recent_lines.append(f"- {msg.get('role', 'unknown')}: {content[:180]}")

    recent_text = "\n".join(recent_lines) if recent_lines else "- No prior turns in this session."

    return f"""Conversation State:
- Current topic: {context.current_topic or "not established"}
- Current region: {context.current_region or "national/general"}
- Recent turns:
{recent_text}

Response Rules:
- Default to 1-2 short sentences unless the user asks for detail, examples, recommendations, history, comparison, or a list.
- Do not front-load caveats, program examples, or policy recommendations for broad questions like "what do you do?" or "tell me about Washington?"
- Treat the user's latest message as controlling. Use previous turns to resolve pronouns and follow-ups, not to override the new question.
- If the user asks about regional history or culture, discuss how place, identity, migration, industry, institutions, and economics interact without forcing a policy recommendation.
- If the user explicitly asks about policy, ground the answer in specific programs, places, years, measured outcomes, and trade-offs when available.
- If the user asks about finance, taxes, investing, debt, or budgeting, give educational economic context only. Do not provide individualized financial, tax, legal, or investment advice.
- Distinguish data from interpretation, and flag missing or limited evidence instead of inventing facts.

Latest user message: {question}
"""


def prepend_chat_preamble(prompt_text: str, context, question: str) -> str:
    return f"{build_chat_preamble(context, question)}\n\nTask:\n{prompt_text}"


POLICY_FOLLOWUP_INSTRUCTION = (
    "End with one short follow-up question inviting the user to pick a policy for more detail, "
    "for example: 'Want me to go deeper on #1, #2, or the biggest drawback?'"
)


def extract_location_from_query(question: str) -> dict:
    """Extract location (state or city) from user query"""
    states = [
        'California', 'Texas', 'Florida', 'New York', 'Pennsylvania', 
        'Illinois', 'Ohio', 'Georgia', 'North Carolina', 'Michigan',
        'New Jersey', 'Virginia', 'Washington', 'Arizona', 'Massachusetts',
        'Tennessee', 'Indiana', 'Missouri', 'Maryland', 'Wisconsin',
        'Colorado', 'Minnesota', 'South Carolina', 'Alabama', 'Louisiana',
        'Kentucky', 'Oregon', 'Oklahoma', 'Connecticut', 'Utah',
        'Nevada', 'Arkansas', 'Mississippi', 'Kansas', 'New Mexico',
        'Nebraska', 'Idaho', 'Hawaii', 'Maine', 'Montana',
        'South Dakota', 'Delaware', 'North Dakota', 'Alaska', 'Vermont',
        'West Virginia', 'Wyoming', 'Rhode Island'
    ]
    
    # Metro areas from city_api_client (20 major US metros)
    cities = [
        'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix',
        'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose',
        'Austin', 'Jacksonville', 'Denver', 'Washington', 'Boston',
        'Miami', 'Atlanta', 'Seattle', 'Minneapolis', 'Portland'
    ]
    
    q_lower = question.lower()

    state_context_terms = [
        'state', 'states', 'statewide', 'governor', 'legislature', 'state history',
        'state policy', 'state policies'
    ]
    city_context_terms = ['city', 'metro', 'metropolitan', 'msa', 'urban']

    # Disambiguate names that can mean either a city/metro or a state.
    if 'new york' in q_lower:
        if any(term in q_lower for term in state_context_terms) and 'city' not in q_lower and 'metro' not in q_lower:
            return {'type': 'state', 'name': 'New York'}
        if any(term in q_lower for term in city_context_terms) or 'nyc' in q_lower:
            return {'type': 'city', 'name': 'New York'}

    if 'washington' in q_lower:
        if 'dc' in q_lower or 'd.c.' in q_lower or any(term in q_lower for term in city_context_terms):
            return {'type': 'city', 'name': 'Washington'}
        return {'type': 'state', 'name': 'Washington'}
    
    # Priority 1: Check for explicit city mentions (with "city" or "metro" keywords)
    for city in cities:
        if city.lower() in q_lower:
            return {'type': 'city', 'name': city}
    
    # Priority 2: Check for states (excluding those covered by cities)
    for state in states:
        if state.lower() in q_lower:
            return {'type': 'state', 'name': state}
    
    return {'type': None, 'name': None}


def extract_topic_from_history(history: list[Message]) -> dict:
    """Resolve the active topic/location from conversation history when the
    current message is a follow-up that doesn't explicitly name a location
    (e.g. 'What policies worked there?' after discussing California).

    Walks backwards through the last 8 messages looking for the first
    user or assistant turn that contains a recognisable location.
    """
    for msg in reversed(history[-8:]):
        if msg.role in ("user", "assistant"):
            loc = extract_location_from_query(msg.content)
            if loc["type"] is not None:
                return loc
    return {"type": None, "name": None}


def location_from_context_region(region: Optional[str]) -> dict:
    """Convert the tracked conversation region back into a routeable location."""
    if not region:
        return {"type": None, "name": None}
    region_lower = region.lower()
    if region_lower.endswith(" state"):
        return {"type": "state", "name": region[:-6]}
    if region_lower.endswith(" metro"):
        return {"type": "city", "name": region[:-6]}
    return extract_location_from_query(region)


def extract_states_from_query(question: str) -> list:
    """Extract all states mentioned in query for comparisons"""
    states = [
        'California', 'Texas', 'Florida', 'New York', 'Pennsylvania', 
        'Illinois', 'Ohio', 'Georgia', 'North Carolina', 'Michigan',
        'New Jersey', 'Virginia', 'Washington', 'Arizona', 'Massachusetts',
        'Tennessee', 'Indiana', 'Missouri', 'Maryland', 'Wisconsin',
        'Colorado', 'Minnesota', 'South Carolina', 'Alabama', 'Louisiana',
        'Kentucky', 'Oregon', 'Oklahoma', 'Connecticut', 'Utah',
        'Nevada', 'Arkansas', 'Mississippi', 'Kansas', 'New Mexico',
        'Nebraska', 'Idaho', 'Hawaii', 'Maine', 'Montana',
        'South Dakota', 'Delaware', 'North Dakota', 'Alaska', 'Vermont',
        'West Virginia', 'Wyoming', 'Rhode Island'
    ]
    
    q_lower = question.lower()
    found_states = []
    
    for state in states:
        if state.lower() in q_lower:
            found_states.append(state)
    
    return found_states


def detect_government_data_query(question: str) -> str|None:
    """Detect if query is about government data (employment, economics, etc.)"""
    keywords = {
        'employment': ['employment', 'job', 'unemployment', 'wage', 'bls', 'labor', 'industry'],
        'economic': ['gdp', 'inflation', 'interest rate', 'fred', 'economic', 'recession', 'growth'],
        'census': ['census', 'population', 'demographic', 'age', 'income', 'education', 'state']
    }
    
    q_lower = question.lower()
    for data_type, keywords_list in keywords.items():
        if any(kw in q_lower for kw in keywords_list):
            return data_type
    return None


POLICY_KEYWORDS = [
    'policy', 'policies', 'reform', 'legislation', 'law', 'program', 'initiative',
    'intervention', 'fix', 'improve', 'tackle', 'address', 'solve', 'solution',
    'recommendation', 'strategy', 'what worked', 'what failed', 'what has been tried',
    'past decisions', 'proven', 'effective', 'reduce inequality', 'reduce poverty',
    'trade-off', 'unintended consequence', 'public investment', 'tax credit',
]

HISTORY_KEYWORDS = [
    'history', 'historical', 'past', 'previously', 'before', 'since', 'trend',
    'over time', 'what happened', 'what changed', 'legacy', 'background',
]

CULTURE_KEYWORDS = [
    'culture', 'cultural', 'identity', 'community', 'communities', 'local identity',
    'migration', 'immigration', 'settlement', 'labor history', 'industry history',
    'industrial history', 'religion', 'language', 'food', 'music', 'arts',
    'neighborhood', 'neighborhoods', 'rural', 'urban', 'suburban', 'tribal',
    'indigenous', 'native', 'black history', 'latino', 'hispanic', 'diaspora',
]

PERSONAL_FINANCE_KEYWORDS = [
    'should i invest', 'my portfolio', 'my taxes', 'my debt', 'my budget',
    'my retirement', '401k', 'ira', 'credit card', 'student loan', 'mortgage',
    'buy a house', 'sell my', 'pay off', 'personal finance', 'financial advice',
]

CAPABILITY_KEYWORDS = [
    'what do you do', 'what can you do', 'what are you', 'who are you',
    'how can you help', 'what can i ask', 'help me'
]

DETAIL_REQUEST_KEYWORDS = [
    'detail', 'details', 'deep dive', 'explain', 'why', 'how', 'evidence',
    'examples', 'recommend', 'recommendation', 'policy', 'policies',
    'history', 'historical', 'compare', 'comparison', 'list', 'breakdown'
]

BROAD_LOCATION_STARTERS = [
    'tell me about', 'what about', 'how about', 'give me a snapshot of',
    'give me an overview of', 'overview of'
]

CONVERSATIONAL_PHRASES = [
    'how are you',
    'i am confused', "i'm confused", 'confused', 'explain that', 'explain this',
    'say that differently', 'say it differently', 'simplify', 'simpler',
    'plain english', 'what does that mean', 'what do you mean',
    'why does that matter', 'why is that important', 'help me understand',
    'walk me through', 'can you clarify', 'clarify', 'that makes sense',
    'does that mean', 'so basically', 'in simple terms', 'what should i look at',
    'how should i read', 'how do i use', 'where should i start',
    'what am i looking at', 'what is this showing', 'talk me through',
]

ACKNOWLEDGEMENT_PHRASES = [
    'ok', 'okay', 'cool', 'nice', 'got it', 'thanks', 'thank you',
    'interesting', 'hmm', 'makes sense', 'that helps'
]


def wants_detailed_answer(question: str) -> bool:
    q_lower = question.lower()
    if any(q_lower.startswith(starter) for starter in BROAD_LOCATION_STARTERS):
        detail_terms = [kw for kw in DETAIL_REQUEST_KEYWORDS if kw not in ("how",)]
        return any(keyword in q_lower for keyword in detail_terms)
    return any(keyword in q_lower for keyword in DETAIL_REQUEST_KEYWORDS)


def is_capability_question(question: str) -> bool:
    q_lower = question.lower().strip()
    return any(keyword in q_lower for keyword in CAPABILITY_KEYWORDS)


def is_broad_location_question(question: str) -> bool:
    q_lower = question.lower().strip()
    has_location = extract_location_from_query(question)["type"] is not None
    has_broad_starter = any(q_lower.startswith(starter) for starter in BROAD_LOCATION_STARTERS)
    return has_location and has_broad_starter and not wants_detailed_answer(question)


def is_regional_history_or_culture_query(question: str) -> bool:
    q_lower = question.lower()
    has_location = extract_location_from_query(question)["type"] is not None
    asks_context = any(keyword in q_lower for keyword in HISTORY_KEYWORDS + CULTURE_KEYWORDS)
    broad_regional = any(q_lower.strip().startswith(starter) for starter in BROAD_LOCATION_STARTERS)
    return has_location and (asks_context or broad_regional)


def is_conversational_query(question: str) -> bool:
    q_lower = question.lower().strip()
    compact = q_lower.strip(" .?!")
    if compact in ACKNOWLEDGEMENT_PHRASES:
        return True
    if len(compact.split()) <= 4 and any(phrase == compact for phrase in ACKNOWLEDGEMENT_PHRASES):
        return True
    return any(phrase in q_lower for phrase in CONVERSATIONAL_PHRASES)


def detect_policy_or_history_query(question: str, history: list[Message], topic: TopicCategory) -> bool:
    q_lower = question.lower()
    explicit_policy = any(keyword in q_lower for keyword in POLICY_KEYWORDS)

    if is_broad_location_question(question):
        return False
    if is_regional_history_or_culture_query(question) and not explicit_policy:
        return False
    if is_conversational_query(question) and not explicit_policy:
        return False

    is_policy_or_history = (
        topic == TopicCategory.POLICY_RECOMMENDATIONS
        or explicit_policy
    )

    # Carry forward policy/history intent for short follow-ups such as
    # "What about education?" or "Did it work there?"
    if not is_policy_or_history and len(question.split()) <= 8 and history:
        for msg in history[-6:]:
            msg_lower = msg.content.lower()
            if any(kw in msg_lower for kw in POLICY_KEYWORDS):
                return True

    return is_policy_or_history


def detect_personal_finance_query(question: str, topic: TopicCategory) -> bool:
    q_lower = question.lower()
    return (
        topic == TopicCategory.INDIVIDUAL_FINANCE
        and any(keyword in q_lower for keyword in PERSONAL_FINANCE_KEYWORDS)
    )


def _compact_list(values, max_items: int = 2) -> str:
    if not values:
        return "not specified"
    if not isinstance(values, list):
        return str(values)
    compacted = []
    for value in values[:max_items]:
        if isinstance(value, dict):
            bits = [
                str(value.get(key))
                for key in ("program", "name", "jurisdiction", "year", "measured_outcome", "outcome")
                if value.get(key)
            ]
            compacted.append(", ".join(bits) if bits else str(value))
        else:
            compacted.append(str(value))
    return "; ".join(compacted) if compacted else "not specified"


def render_policy_recommendations_context(recs: list, limit: int = 3) -> str:
    """Serialize rich policy recommendation objects for conversational answers."""
    lines = []
    for i, rec in enumerate(recs[:limit], 1):
        lines.append(
            f"{i}. {rec.get('title', 'Policy')} ({rec.get('category', 'General')})\n"
            f"   Summary: {rec.get('description', 'No description provided')}\n"
            f"   Historical evidence: {rec.get('expected_impact', 'No historical analogue provided')}\n"
            f"   Known drawback/trade-off: {_compact_list(rec.get('known_tradeoffs'), 2)}\n"
            f"   Evidence quality: {rec.get('evidence_quality', 'not rated')}; "
            f"implementation: {rec.get('implementation_difficulty', 'not rated')}; "
            f"cost: {rec.get('cost_estimate', 'not rated')}\n"
            f"   Examples: {_compact_list(rec.get('historical_examples'), 2)}"
        )
    return "\n".join(lines)


def build_regional_culture_prompt(
    location: str,
    location_type: str,
    data_context: str,
    question: str,
) -> str:
    return f"""You are a regional economics guide who can connect place, history, culture, and economic outcomes.
Answer the user's question about {location} as a {location_type}. Explain how history, settlement patterns, industry, migration, culture, institutions, or local identity shaped today's economy when relevant.
Do not turn this into policy recommendations unless the user explicitly asks for policies. Avoid stereotypes; describe groups and regions carefully and with nuance.
Use the available data as grounding, but it is okay to add concise historical/cultural context from general knowledge. If you are uncertain about a specific historical detail, say so.
Keep it conversational: 2-4 short sentences, then offer one natural follow-up angle.

Available Economic/Demographic Data:
{data_context}

User Question: {question}

Regional Context Response:"""


def get_government_data_context(query: str, data_type: str) -> str:
    """Fetch relevant government data for the query"""
    try:
        if data_type == 'employment':
            results = s3_loader.search_government_data(query, 'bls')
            if results['bls']:
                records = results['bls'][:3]
                context = "📊 Employment Data:\n"
                for record in records:
                    if 'Industry' in record:
                        context += f"- {record.get('Industry')}: Unemployment {record.get('Unemployment_Rate')}%\n"
                return context
        
        elif data_type == 'economic':
            results = s3_loader.search_government_data(query, 'fred')
            if results['fred']:
                records = results['fred'][:5]
                context = "📈 Economic Indicators:\n"
                for record in records:
                    context += f"- {record.get('Indicator', 'Unknown')}: {record.get('Value')} {record.get('Unit')}\n"
                return context
        
        elif data_type == 'census':
            results = s3_loader.search_government_data(query, 'census')
            if results['census']:
                records = results['census'][:3]
                context = "🗳️ Census Data:\n"
                for record in records:
                    if 'Location' in record:
                        context += f"- {record.get('Location')}: Population {record.get('Population')}\n"
                return context
        
        return ""
    
    except Exception as e:
        logger.error(f"Error fetching government data: {e}")
        return ""


@app.post("/api/chat")
async def chat(request: ChatRequest):
    """Smart conversation-aware chat with natural language + enriched government data + context management"""
    if not graph:
        raise HTTPException(status_code=500, detail="Graph not loaded. Check data files.")
    
    question = request.message
    history_messages = build_conversation_messages(request.conversation_history)

    logger.info(f"Chat request: {question}")
    
    # ============= NEW: Conversation Context Management =============
    # Track conversation context to improve topic switching and understanding
    context = CONVERSATION_MANAGER.get_or_create_context(request.conversation_id)
    topic, topic_confidence = CONVERSATION_MANAGER.detect_topic(question)
    region_switched = CONVERSATION_MANAGER.detect_region_switch(question, context)
    
    # Log topic detection for debugging
    logger.info(f"Detected topic: {topic.value} (confidence: {topic_confidence:.2f})")
    if region_switched:
        logger.info(f"Region switch detected from {context.current_region}")
    
    # Add this exchange to context
    context.add_message(role="user", content=question, topic=topic.value)
    
    # ============= END: Conversation Context Management =============
    
    try:
        # Check if this is a casual conversation (greeting, general chat)
        casual_keywords = ['hi', 'hello', 'hey', 'how are you', 'what are you', 'who are you', 'thanks', 'thank you']
        is_casual = any(keyword in question.lower() for keyword in casual_keywords)
        
        # Check if this is a data/comparison query
        data_keywords = ['compare', 'difference', 'data', 'statistics', 'tell me about', 'what is', 'how']
        is_data_query = any(keyword in question.lower() for keyword in data_keywords)

        is_policy_query = detect_policy_or_history_query(question, request.conversation_history, topic)
        is_personal_finance = detect_personal_finance_query(question, topic)
        is_conversation_query = is_conversational_query(question)
        is_regional_context_query = is_regional_history_or_culture_query(question)

        if is_capability_question(question):
            prompt_text = f"""You are the MindTheGap economics assistant.
Answer what you do in a warm, direct way. Mention that you help with state/city comparisons, wealth inequality data, regional history and culture, policy history, and economic context.
Keep it to 1-2 short sentences. Do not include policy examples or statistics unless the user asks.

User Question: {question}

Brief Response:"""
            llm = ChatGroq(
                temperature=0.4,
                groq_api_key=groq_api_key,
                model_name=GROQ_MODEL,
                max_tokens=90
            )
            response = await _invoke_chat_model(llm, history_messages + [HumanMessage(content=prepend_chat_preamble(prompt_text, context, question))])
            reply = response.content if hasattr(response, 'content') else str(response)
            context.add_message(role="assistant", content=reply, topic=topic.value)
            return {
                "reply": reply,
                "source": "llm_capability",
                "query_type": "capability_question",
            }

        if is_conversation_query:
            prompt_text = f"""You are a warm, conversational guide inside MindTheGap.
Respond to the user's conversational or clarifying message naturally, using recent context if helpful.
Do not turn this into a policy recommendation unless the user explicitly asks for one.
If the user is confused, explain the core idea in plain English. If they are acknowledging something, respond briefly and offer a natural next step.
Keep it to 1-3 short sentences.

User Message: {question}

Conversational Response:"""
            llm = ChatGroq(
                temperature=0.55,
                groq_api_key=groq_api_key,
                model_name=GROQ_MODEL,
                max_tokens=180
            )
            response = await _invoke_chat_model(llm, history_messages + [HumanMessage(content=prepend_chat_preamble(prompt_text, context, question))])
            reply = response.content if hasattr(response, 'content') else str(response)
            context.add_message(role="assistant", content=reply, topic=topic.value)
            return {
                "reply": reply,
                "source": "llm_conversational",
                "query_type": "conversational_followup",
            }

        if is_personal_finance:
            prompt_text = f"""You are a careful economics educator for MindTheGap.
The user appears to be asking a personal finance question. Answer with general educational context tied to inequality, household balance sheets, debt, taxes, or regional economics where relevant.
Do not give individualized financial, legal, tax, or investment advice. Suggest consulting a qualified professional for decisions specific to their circumstances.
Keep the answer practical and conversational. (2-3 sentences)

User Question: {question}

Educational Response:"""
            llm = ChatGroq(
                temperature=0.3,
                groq_api_key=groq_api_key,
                model_name=GROQ_MODEL,
                max_tokens=220
            )
            response = await _invoke_chat_model(llm, history_messages + [HumanMessage(content=prepend_chat_preamble(prompt_text, context, question))])
            reply = response.content if hasattr(response, 'content') else str(response)
            context.add_message(role="assistant", content=reply, topic=topic.value)
            return {
                "reply": reply,
                "source": "llm_finance_education",
                "query_type": "personal_finance_education",
            }

        if is_casual and not is_data_query:
            prompt_text = f"""You are a friendly wealth inequality expert AI assistant. 
Respond warmly and naturally to this casual greeting. Keep it brief (1-2 sentences).
You can offer to help with questions about US wealth, inequality, or state economics.

User: {question}

Response:"""
            
            llm = ChatGroq(
                temperature=0.7,
                groq_api_key=groq_api_key,
                model_name=GROQ_MODEL,
                max_tokens=150
            )
            response = await _invoke_chat_model(llm, history_messages + [HumanMessage(content=prepend_chat_preamble(prompt_text, context, question))])
            reply = response.content if hasattr(response, 'content') else str(response)
            
            # Track response in conversation context
            context.add_message(role="assistant", content=reply, topic=topic.value)
            
            return {
                "reply": reply,
                "source": "llm_natural",
                "query_type": "casual_conversation"
            }
        
        # Extract states from query for comparison
        states_in_query = extract_states_from_query(question)
        
        # Handle state comparison queries
        if states_in_query and len(states_in_query) >= 2 and ('compare' in question.lower() or 'vs' in question.lower() or 'versus' in question.lower()):
            state1, state2 = states_in_query[0], states_in_query[1]
            
            # Load both state profiles
            profile1 = load_enriched_state_profile(state1)
            profile2 = load_enriched_state_profile(state2)
            
            if profile1 and profile2:
                # Prepare data context for natural comparison
                data_context = f"""
State 1: {state1}
- Population: {profile1.get('demographics', {}).get('population', 'N/A'):,}
- Median Income: ${profile1.get('demographics', {}).get('median_household_income', 0):,.0f}
- Poverty Rate: {profile1.get('demographics', {}).get('poverty_rate', 'N/A')}%
- Education (Bachelor+): {profile1.get('demographics', {}).get('education_bachelor_and_above', 'N/A')}%
- Unemployment: {list(profile1.get('economics', {}).get('indicators', {}).get('unemployment_rate', {}).get('data', {}).values())[-1] if profile1.get('economics', {}).get('indicators', {}).get('unemployment_rate', {}).get('data') else 'N/A'}%

State 2: {state2}
- Population: {profile2.get('demographics', {}).get('population', 'N/A'):,}
- Median Income: ${profile2.get('demographics', {}).get('median_household_income', 0):,.0f}
- Poverty Rate: {profile2.get('demographics', {}).get('poverty_rate', 'N/A')}%
- Education (Bachelor+): {profile2.get('demographics', {}).get('education_bachelor_and_above', 'N/A')}%
- Unemployment: {list(profile2.get('economics', {}).get('indicators', {}).get('unemployment_rate', {}).get('data', {}).values())[-1] if profile2.get('economics', {}).get('indicators', {}).get('unemployment_rate', {}).get('data') else 'N/A'}%
"""

                # Inject policy history for both states when relevant
                policy_history_section = ""
                if is_policy_query:
                    hist1 = get_policy_history_context(
                        region=state1,
                        current_metrics={"poverty_rate": profile1.get('demographics', {}).get('poverty_rate')},
                        max_policies=3,
                    )
                    hist2 = get_policy_history_context(
                        region=state2,
                        current_metrics={"poverty_rate": profile2.get('demographics', {}).get('poverty_rate')},
                        max_policies=3,
                    )
                    if hist1 or hist2:
                        policy_history_section = ""
                        if hist1:
                            policy_history_section += f"\nHistorical Policy Evidence — {state1}:\n{hist1}\n"
                        if hist2:
                            policy_history_section += f"\nHistorical Policy Evidence — {state2}:\n{hist2}\n"

                if policy_history_section:
                    prompt_text = f"""You are a wealth inequality and economics expert with deep knowledge of regional policy history.
Compare the two states using the government data AND their documented policy histories below.
Highlight differences in what each state tried, what worked or failed, and one major trade-off. Be conversational. (3-4 short sentences)
{POLICY_FOLLOWUP_INSTRUCTION}

Government Data from Census Bureau, BLS, and Federal Reserve:
{data_context}
{policy_history_section}
User Question: {question}

Evidence-Based Comparison:"""
                    max_tokens = 380
                else:
                    prompt_text = f"""You are a wealth inequality and economics expert. 
Based on the government data below, provide a natural, articulate comparison answering the user's question.
Focus on the key differences that matter. Be conversational, not just a list. (1-2 sentences max)

Government Data from Census Bureau, BLS, and Federal Reserve:
{data_context}

User Question: {question}

Articulate Comparison:"""
                    max_tokens = 160
                
                llm = ChatGroq(
                    temperature=0.3,
                    groq_api_key=groq_api_key,
                    model_name=GROQ_MODEL,
                    max_tokens=max_tokens
                )
                response = await _invoke_chat_model(llm, history_messages + [HumanMessage(content=prepend_chat_preamble(prompt_text, context, question))])
                reply = response.content if hasattr(response, 'content') else str(response)
                
                # Track comparison in conversation context
                context.add_message(role="assistant", content=reply, topic=topic.value)
                if len(states_in_query) >= 2:
                    # Update region if user is comparing states (track primary one)
                    context.current_region = f"{states_in_query[0]} state"
                
                return {
                    "reply": reply,
                    "source": "enriched_comparison",
                    "states": [state1, state2],
                    "query_type": "state_policy_comparison" if is_policy_query else "state_comparison",
                    "policy_history_used": bool(policy_history_section),
                }
        
        # Handle single state queries
        location_info = extract_location_from_query(question)
        # If the current message has no explicit location, inherit the active topic
        # from conversation history so follow-up questions resolve correctly.
        if location_info['type'] is None and request.conversation_history:
            location_info = extract_topic_from_history(request.conversation_history)
        if location_info['type'] is None and context.current_region:
            location_info = location_from_context_region(context.current_region)
        if location_info['type'] == 'state':
            location = location_info['name']
            state_profile = load_enriched_state_profile(location)
            
            if state_profile:
                demo = state_profile.get('demographics', {})
                econ = state_profile.get('economics', {})
                
                # Build data summary
                data_context = f"""
State: {location}
- Population: {demo.get('population', 'N/A'):,}
- Median Household Income: ${demo.get('median_household_income', 0):,.0f}
- Poverty Rate: {demo.get('poverty_rate', 'N/A')}%
- Bachelor's Degree or Higher: {demo.get('education_bachelor_and_above', 'N/A')}%
- Median Age: {demo.get('median_age', 'N/A')}
- Unemployment Rate: {list(econ.get('indicators', {}).get('unemployment_rate', {}).get('data', {}).values())[-1] if econ.get('indicators', {}).get('unemployment_rate', {}).get('data') else 'N/A'}%

Source: Census Bureau (demographics), Bureau of Labor Statistics (employment), Federal Reserve (economic indicators)
"""

                # Inject historical policy evidence for policy-related questions
                policy_history_section = ""
                if is_policy_query:
                    current_metrics = {
                        "poverty_rate": demo.get("poverty_rate"),
                        "median_household_income": demo.get("median_household_income"),
                    }
                    policy_history_section = get_policy_history_context(
                        region=location,
                        current_metrics=current_metrics,
                        max_policies=4,
                    )

                # Use LLM to articulate the data naturally
                if is_regional_context_query and not is_policy_query:
                    prompt_text = build_regional_culture_prompt(
                        location=location,
                        location_type="state",
                        data_context=data_context,
                        question=question,
                    )
                    max_tokens = 380
                elif policy_history_section:
                    prompt_text = f"""You are a wealth and economics expert analyst with deep knowledge of regional policy history.
Use the government data AND the historical policy evidence below to answer the user's question about {location}.
Ground your response in what was actually tried in this region and what the documented outcomes were.
Mention the main historical lesson and one concrete drawback or implementation risk. Be conversational and evidence-based. (3-4 short sentences)
{POLICY_FOLLOWUP_INSTRUCTION}

Government Data:
{data_context}

Historical Policy Evidence for {location}:
{policy_history_section}

User Question: {question}

Evidence-Based Analysis:"""
                    max_tokens = 380
                else:
                    prompt_text = f"""You are a wealth and economics expert analyst.
Use the government data below to naturally answer the user's question about {location}.
Be conversational and insightful. Give a compact snapshot first; do not recommend policies unless asked. (1-2 sentences)

Government Data:
{data_context}

User Question: {question}

Natural Analysis:"""
                    max_tokens = 140
                
                llm = ChatGroq(
                    temperature=0.3,
                    groq_api_key=groq_api_key,
                    model_name=GROQ_MODEL,
                    max_tokens=max_tokens
                )
                response = await _invoke_chat_model(llm, history_messages + [HumanMessage(content=prepend_chat_preamble(prompt_text, context, question))])
                reply = response.content if hasattr(response, 'content') else str(response)
                
                # Track in conversation context
                context.add_message(role="assistant", content=reply, topic=topic.value)
                context.current_region = f"{location} state"  # Update current region for follow-up questions
                
                return {
                    "reply": reply,
                    "source": "enriched_analysis",
                    "location": location,
                    "query_type": "state_policy_analysis" if is_policy_query else ("state_history_culture" if is_regional_context_query else "state_analysis"),
                    "policy_history_used": bool(policy_history_section),
                }

            elif is_policy_query:
                # State profile not in Supabase — use PolicyRecommendationEngine with
                # national baseline metrics to still return evidence-based recommendations
                graph_ctx = get_graph_rag_context(question, graph)
                policy_hist = get_policy_history_context(
                    region=location,
                    current_metrics={"poverty_rate": 11.5, "gini_coefficient": 0.49},
                    max_policies=4,
                )
                region_data = {
                    "gini_coefficient": 0.49,
                    "top_1_percent_share": 32.0,
                    "bottom_50_percent_share": 2.6,
                    "unemployment_rate": 3.8,
                    "poverty_rate": 11.5,
                    "region": location,
                    "demographics": {},
                }
                recs = get_policy_recommendations_for_region(
                    region_data=region_data,
                    policy_history_context=policy_hist,
                )
                rec_text = render_policy_recommendations_context(recs, limit=3)
                prompt_text = f"""You are a non-partisan economist committed to economic honesty and intellectual integrity.
The user is asking about policy recommendations for {location}.

Strict rules you must follow:
- Give 2-3 policy recommendations, not all 5.
- For each recommendation you discuss, include: why it fits this region, one historical success/failure signal, and one documented drawback or implementation risk.
- If evidence is mixed or contested among mainstream economists, say so explicitly — do not misrepresent consensus
- Anchor all projected impacts to measured historical outcomes, not optimistic assumptions
- Do not advocate for any political position — your role is honest economic analysis
- If the data for this region is limited, say so rather than extrapolating
- {POLICY_FOLLOWUP_INSTRUCTION}

Evidence-Based Policy Recommendations:
{rec_text}

Additional Economic Context:
{graph_ctx}

User Question: {question}

Honest Policy Analysis (compact but substantive, 2-3 short bullets plus follow-up question):"""
                llm = ChatGroq(
                    temperature=0.3,
                    groq_api_key=groq_api_key,
                    model_name=GROQ_MODEL,
                    max_tokens=650,
                )
                response = await _invoke_chat_model(llm, history_messages + [HumanMessage(content=prepend_chat_preamble(prompt_text, context, question))])
                reply = response.content if hasattr(response, "content") else str(response)
                context.add_message(role="assistant", content=reply, topic=topic.value)
                context.current_region = f"{location} state"
                return {
                    "reply": reply,
                    "source": "policy_engine_national_baseline",
                    "location": location,
                    "query_type": "state_policy_analysis",
                    "recommendations_count": len(recs),
                }

        # Handle city/metro area queries (load from S3)
        if location_info['type'] == 'city':
            city_name = location_info['name']
            city_profile = load_enriched_metro_profile(city_name)
            
            if city_profile:
                demo = city_profile.get('demographics', {})
                employment = city_profile.get('employment', {})
                metro_area = city_profile.get('identity', {}).get('metro_area', city_name)
                
                # Build city data summary
                data_context = f"""
City: {city_name} (Metro: {metro_area})
- Population: {demo.get('total_population', 'N/A'):,}
- Median Household Income: ${demo.get('median_household_income', 0):,.0f}
- Poverty Rate: {demo.get('poverty_rate', 'N/A')}%
- Education (Bachelor+): {demo.get('education_bachelor_and_above', 'N/A')}%

Employment Data:
- Metro Area Unemployment: {list(employment.get('unemployment_data', {}).values())[-1] if employment.get('unemployment_data') else 'N/A'}%

Source: Census Bureau ACS (demographics), BLS LAUS (employment)
"""

                # Inject historical policy evidence for policy-related questions
                policy_history_section = ""
                if is_policy_query:
                    current_metrics = {
                        "poverty_rate": demo.get("poverty_rate"),
                        "median_household_income": demo.get("median_household_income"),
                    }
                    policy_history_section = get_policy_history_context(
                        region=city_name,
                        current_metrics=current_metrics,
                        max_policies=4,
                    )

                # Use LLM to articulate city data
                if is_regional_context_query and not is_policy_query:
                    prompt_text = build_regional_culture_prompt(
                        location=city_name,
                        location_type="metro area",
                        data_context=data_context,
                        question=question,
                    )
                    max_tokens = 380
                elif policy_history_section:
                    prompt_text = f"""You are a wealth and economics expert analyst with deep knowledge of regional policy history.
Use the metro area data AND the historical policy evidence below to answer the user's question about {city_name}.
Ground your response in what was actually tried in this region and what the documented outcomes were.
Mention the main historical lesson and one concrete drawback or implementation risk. Be conversational and evidence-based. (3-4 short sentences)
{POLICY_FOLLOWUP_INSTRUCTION}

Government Data:
{data_context}

Historical Policy Evidence for {city_name}:
{policy_history_section}

User Question: {question}

Evidence-Based Analysis:"""
                    max_tokens = 380
                else:
                    prompt_text = f"""You are a wealth and economics expert analyst.
Use the government metro area data below to naturally answer the user's question about {city_name}.
Be conversational and insightful. Give a compact snapshot first; do not recommend policies unless asked. (1-2 sentences)

Government Data:
{data_context}

User Question: {question}

Natural Analysis:"""
                    max_tokens = 140
                
                llm = ChatGroq(
                    temperature=0.3,
                    groq_api_key=groq_api_key,
                    model_name=GROQ_MODEL,
                    max_tokens=max_tokens
                )
                response = await _invoke_chat_model(llm, history_messages + [HumanMessage(content=prepend_chat_preamble(prompt_text, context, question))])
                reply = response.content if hasattr(response, 'content') else str(response)
                
                # Track in conversation context
                context.add_message(role="assistant", content=reply, topic=topic.value)
                if city_name:
                    context.current_region = f"{city_name} metro"
                
                return {
                    "reply": reply,
                    "source": "city_metro_data_s3",
                    "city": city_name,
                    "metro_area": metro_area,
                    "query_type": "city_policy_analysis" if is_policy_query else ("city_history_culture" if is_regional_context_query else "city_analysis"),
                    "policy_history_used": bool(policy_history_section),
                }

            elif is_policy_query:
                # City profile not in Supabase — use PolicyRecommendationEngine with
                # national baseline so policy questions still get a full answer
                graph_ctx = get_graph_rag_context(question, graph)
                policy_hist = get_policy_history_context(
                    region=city_name,
                    current_metrics={"poverty_rate": 11.5, "gini_coefficient": 0.49},
                    max_policies=4,
                )
                region_data = {
                    "gini_coefficient": 0.49,
                    "top_1_percent_share": 32.0,
                    "bottom_50_percent_share": 2.6,
                    "unemployment_rate": 3.8,
                    "poverty_rate": 11.5,
                    "region": city_name,
                    "demographics": {},
                }
                recs = get_policy_recommendations_for_region(
                    region_data=region_data,
                    policy_history_context=policy_hist,
                )
                rec_text = render_policy_recommendations_context(recs, limit=3)
                prompt_text = f"""You are a non-partisan economist committed to economic honesty and intellectual integrity.
The user is asking about policy recommendations for {city_name}.

Strict rules you must follow:
- Give 2-3 policy recommendations, not all 5.
- For each recommendation you discuss, include: why it fits this city, one historical success/failure signal, and one documented drawback or implementation risk.
- If evidence is mixed or contested among mainstream economists, say so explicitly
- Anchor all projected impacts to measured historical outcomes, not optimistic assumptions
- Do not advocate for any political position — your role is honest economic analysis
- If data for this city is limited, say so rather than extrapolating
- {POLICY_FOLLOWUP_INSTRUCTION}

Evidence-Based Policy Recommendations:
{rec_text}

Additional Economic Context:
{graph_ctx}

User Question: {question}

Honest Policy Analysis (compact but substantive, 2-3 short bullets plus follow-up question):"""
                llm = ChatGroq(
                    temperature=0.3,
                    groq_api_key=groq_api_key,
                    model_name=GROQ_MODEL,
                    max_tokens=650,
                )
                response = await _invoke_chat_model(llm, history_messages + [HumanMessage(content=prepend_chat_preamble(prompt_text, context, question))])
                reply = response.content if hasattr(response, "content") else str(response)
                context.add_message(role="assistant", content=reply, topic=topic.value)
                context.current_region = f"{city_name} metro"
                return {
                    "reply": reply,
                    "source": "policy_engine_city_baseline",
                    "city": city_name,
                    "query_type": "city_policy_analysis",
                    "recommendations_count": len(recs),
                }

        # For general, non-location-specific questions, use semantic search + LLM
        graph_rag_context = get_graph_rag_context(question, graph)

        if is_regional_context_query and not is_policy_query:
            loc = extract_location_from_query(question)
            location_label = loc.get("name") or context.current_region or "the region"
            prompt_text = f"""You are a regional economics guide who connects place, history, culture, and economic outcomes.
Answer the user's question about {location_label}. Discuss relevant history, culture, migration, industry, community identity, institutions, or geography when useful.
Do not turn this into policy recommendations unless the user explicitly asks for policies. Avoid stereotypes and be careful with uncertainty.
Use the data/search context only as grounding; if the context is thin, give a concise general answer and say what evidence would make it stronger.
Keep it conversational: 2-4 short sentences, then offer one natural follow-up angle.

Data/Search Context:
{graph_rag_context}

User Question: {question}

Regional Context Response:"""
            max_tokens = 380
        elif is_policy_query:
            # Policy question with no specific location — use PolicyRecommendationEngine
            # with national defaults and the full policy reference library
            region_data = {
                "gini_coefficient": 0.49,
                "top_1_percent_share": 32.0,
                "bottom_50_percent_share": 2.6,
                "unemployment_rate": 3.8,
                "poverty_rate": 11.5,
                "region": "National",
                "demographics": {},
            }
            recs = get_policy_recommendations_for_region(region_data=region_data)
            rec_text = render_policy_recommendations_context(recs, limit=3)
            prompt_text = f"""You are a non-partisan economist committed to economic honesty and intellectual integrity.
Answer the user's policy question using the evidence and data context below.

Strict rules:
- Give 2-3 policy recommendations, not all 5.
- For each recommendation you discuss, include: why it fits the question, one historical success/failure signal, and one documented drawback or implementation risk.
- If evidence is mixed or contested among mainstream economists, say so explicitly
- Anchor all impact estimates to measured historical outcomes — not optimistic projections
- Do not advocate for any political position — present the honest empirical picture
- Distinguish correlation from causation when discussing trends
- {POLICY_FOLLOWUP_INSTRUCTION}

Evidence-Based Policy Recommendations (national baseline):
{rec_text}

Wealth Data Context:
{graph_rag_context}

User Question: {question}

Honest Policy Analysis (compact but substantive, 2-3 short bullets plus follow-up question):"""
            max_tokens = 650
        else:
            prompt_text = f"""You are a wealth inequality and economics expert.
Answer this question using your knowledge and the context provided.
Be conversational and direct. (1-2 sentences max)

Context: {graph_rag_context}

Question: {question}

Answer:"""
            max_tokens = 160

        llm = ChatGroq(
            temperature=0.3,
            groq_api_key=groq_api_key,
            model_name=GROQ_MODEL,
            max_tokens=max_tokens,
        )
        response = await _invoke_chat_model(llm, history_messages + [HumanMessage(content=prepend_chat_preamble(prompt_text, context, question))])
        reply = response.content if hasattr(response, 'content') else str(response)

        # Track general question in conversation context
        context.add_message(role="assistant", content=reply, topic=topic.value)

        return {
            "reply": reply,
            "source": "policy_engine_national" if is_policy_query else "semantic_search",
            "query_type": "general_policy_question" if is_policy_query else "general_question",
        }
        
    except asyncio.TimeoutError:
        logger.warning("Chat model timed out for request: %s", question)
        reply = (
            "I'm having trouble getting a live AI response right now, but the data dashboard is still available. "
            "Try again in a moment or ask a narrower state/city comparison."
        )
        context.add_message(role="assistant", content=reply, topic=topic.value)
        return {
            "reply": reply,
            "source": "llm_timeout_fallback",
            "query_type": "temporary_backend_timeout",
        }
    except Exception as e:
        logger.error(f"Chat error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


# --- Trend Analysis Endpoint ---
@app.post("/api/trends")
async def analyze_trends(request: TrendRequest):
    """Analyze wealth or income trends for a demographic category"""
    if not graph:
        raise HTTPException(status_code=500, detail="Graph not loaded.")
    
    try:
        # Filter nodes by data type and category
        relevant_data = []
        for node_id, node_data in graph.nodes(data=True):
            if node_data.get('data_type') == request.category:
                if request.demographic is None or request.demographic in str(node_data.get('Category', '')):
                    relevant_data.append(node_data)
        
        if not relevant_data:
            return {
                "message": f"No data found for {request.category}",
                "trends": None
            }
        
        # Perform trend analysis
        from trend_analysis import TrendAnalyzer

        analysis = TrendAnalyzer.trend_analysis(relevant_data)
        
        return {
            "category": request.category,
            "demographic": request.demographic,
            "analysis": analysis,
            "data_points": len(relevant_data)
        }
        
    except Exception as e:
        logger.error(f"Trend analysis error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# --- Policy Recommendations Endpoint ---
@app.post("/api/policy-recommendations")
async def get_policy(request: PolicyRequest):
    """Generate LLM-backed, data-driven policy recommendations using real government metrics"""
    try:
        # Pull enriched profile for richer demographic context if available
        enriched_demographics = {}
        enriched_profile = load_enriched_state_profile(request.region) if request.region else None
        if enriched_profile:
            demo = enriched_profile.get('demographics', {})
            enriched_demographics = {
                'median_household_income': demo.get('median_household_income'),
                'education_bachelor_plus': demo.get('education_bachelor_and_above'),
                'median_age': demo.get('median_age'),
                'population': demo.get('population'),
            }

        current_metrics = {
            'gini_coefficient': request.gini_coefficient,
            'poverty_rate': request.poverty_rate,
            'median_household_income': enriched_demographics.get('median_household_income'),
        }

        # Fetch historical policy evidence from S3 to ground the LLM
        policy_history = get_policy_history_context(
            region=request.region,
            current_metrics=current_metrics,
            max_policies=4,
        )

        region_data = {
            'gini_coefficient': request.gini_coefficient,
            'top_1_percent_share': request.top_1_percent_share,
            'bottom_50_percent_share': request.bottom_50_percent_share,
            'unemployment_rate': request.unemployment_rate,
            'poverty_rate': request.poverty_rate,
            'region': request.region,
            'demographics': enriched_demographics,
        }

        recommendations = get_policy_recommendations_for_region(
            region_data=region_data,
            policy_history_context=policy_history,
            groq_api_key=groq_api_key,
        )

        return {
            "region": request.region,
            "economic_indicators": {
                "gini_coefficient": request.gini_coefficient,
                "top_1_percent_share": request.top_1_percent_share,
                "bottom_50_percent_share": request.bottom_50_percent_share,
                "unemployment_rate": request.unemployment_rate,
                "poverty_rate": request.poverty_rate,
            },
            "recommendations": recommendations,
            "count": len(recommendations),
            "generation_method": "llm_data_driven",
            "data_sources": ["Census Bureau", "BLS", "Federal Reserve", "S3 Policy History"],
        }

    except Exception as e:
        logger.error(f"Policy recommendation error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# --- Policy History Endpoints ---
@app.get("/api/policy-history")
async def list_policy_regions():
    """List all regions with documented policy history."""
    return {"regions": get_available_regions()}


# --- Policy Database Admin Endpoints ---
@app.get("/api/policy-database")
async def list_policy_database():
    """
    Return the full policy catalog currently loaded in memory.
    The catalog is sourced from S3 and refreshed hourly.
    """
    db = get_policy_database()
    meta = get_policy_database_metadata()
    return {
        "policies": db,
        "count": len(db),
        "metadata": meta,
        "s3_key": "s3://mindthegap-gov-data/government-data/policy-database/policy_database.json",
    }


@app.post("/api/policy-database/reload", dependencies=[Depends(_require_admin)])
async def reload_policy_db():
    """
    Force-reload the policy catalog from S3 immediately, bypassing the 1-hour TTL.
    Use after uploading new policies to S3 to pick them up without restarting the server.
    """
    success = reload_policy_database()
    if success:
        meta = get_policy_database_metadata()
        return {
            "status": "reloaded",
            "policy_count": len(get_policy_database()),
            "metadata": meta,
        }
    raise HTTPException(status_code=503, detail="Reload from S3 failed; check server logs")


@app.put("/api/policy-database", dependencies=[Depends(_require_admin)])
async def update_policy_db(payload: dict):
    """
    Upload an updated policy catalog to S3 and refresh the in-memory cache.

    Expected body:
      {
        \"policy_database\": {
          \"<key>\": {
            \"title\": \"...\",
            \"category\": \"Education & Workforce Development\",
            \"description\": \"...\",
            \"target_populations\": [...],
            \"expected_impact\": \"...\",
            \"implementation_difficulty\": \"Moderate\",
            \"cost_estimate\": \"High\",
            \"historical_examples\": [...],
            \"success_metrics\": [...],
            \"prerequisites\": []
          }
        },
        \"metadata\": { \"version\": \"1.1\", \"last_updated\": \"YYYY-MM-DD\", \"description\": \"...\" }
      }
    """
    if "policy_database" not in payload:
        raise HTTPException(status_code=400, detail="payload must contain 'policy_database' key")
    success = update_policy_database(payload)
    if success:
        return {
            "status": "updated",
            "policy_count": len(get_policy_database()),
            "metadata": get_policy_database_metadata(),
        }
    raise HTTPException(status_code=503, detail="S3 upload failed; check server logs")


@app.get("/api/policy-history/{region}")
async def get_policy_history(
    region: str,
    category: Optional[str] = None,
    poverty_rate: Optional[float] = None,
    gini_coefficient: Optional[float] = None,
    median_household_income: Optional[float] = None,
):
    """Return documented historical policy evidence for a US region.

    Pass optional economic metrics to receive evidence-based synthesis
    that connects historical outcomes to the region's current conditions.
    """
    try:
        current_metrics = {}
        if poverty_rate is not None:
            current_metrics["poverty_rate"] = poverty_rate
        if gini_coefficient is not None:
            current_metrics["gini_coefficient"] = gini_coefficient
        if median_household_income is not None:
            current_metrics["median_household_income"] = median_household_income

        brief = get_policy_brief_for_api(
            region=region,
            category=category,
            current_metrics=current_metrics or None,
        )
        if "error" in brief:
            raise HTTPException(status_code=404, detail=brief["error"])
        return brief
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Policy history error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


# --- Supabase Direct Query Endpoints ---
@app.get("/api/wealth-data")
async def get_wealth_data(category: str = None, limit: int = 100):
    """Get wealth distribution data directly from Supabase"""
    db = get_db()
    
    if not db or not db.client:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        data = db.get_wealth_data(category=category, limit=limit)
        return {
            "count": len(data),
            "data": data,
            "source": "supabase:wealth_distribution"
        }
    except Exception as e:
        logger.error(f"Error fetching wealth data: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/demographics")
async def get_demographics(demographic_type: str = "race", group: str = None, limit: int = 100):
    """Get demographic data directly from Supabase"""
    db = get_db()
    
    if not db or not db.client:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        data = db.get_demographic_data(demographic_type=demographic_type, group=group)
        return {
            "count": len(data),
            "type": demographic_type,
            "data": data,
            "source": "supabase:demographics"
        }
    except Exception as e:
        logger.error(f"Error fetching demographic data: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/economic-indicators/{state}")
async def get_state_indicators(state: str):
    """Get economic indicators for a specific state from Supabase"""
    db = get_db()
    
    if not db or not db.client:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        data = db.get_economic_indicators(state=state, limit=100)
        return {
            "state": state,
            "count": len(data),
            "data": data,
            "source": "supabase:economic_indicators"
        }
    except Exception as e:
        logger.error(f"Error fetching economic indicators: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/state-metrics/{state_name}")
async def get_normalized_state_metrics(state_name: str):
    """Get latest normalized state metrics from Supabase."""
    db = get_db()

    if not db or not db.client:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        slug = _safe_slug(state_name)
        fips = SAIPE_STATE_FIPS.get(slug)
        rows = db.get_latest_state_metrics(state_name=state_name, state_fips=fips)
        return {
            "success": True,
            "state": state_name,
            "count": len(rows),
            "metrics": rows,
            "source": "supabase:latest_state_metric_snapshots",
        }
    except Exception as e:
        logger.error(f"Error fetching normalized state metrics: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/api/admin/sync-government-data")
async def sync_government_data_endpoint(_: None = Depends(_require_admin)):
    """Trigger government data sync (admin endpoint)"""
    try:
        # Optional module: keep runtime-safe even if sync script is absent.
        import importlib
        sync_module = importlib.import_module("sync_government_data")
        sync_all = getattr(sync_module, "sync_all", None)
        if not callable(sync_all):
            raise RuntimeError("sync_government_data.sync_all not available")

        success = sync_all()
        
        return {
            "status": "success" if success else "partial",
            "message": "Government data sync completed",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Sync error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# --- Cache Management Endpoint ---
@app.post("/api/admin/clear-cache")
async def clear_cache(_: None = Depends(_require_admin)):
    """Clear API caches (admin endpoint)"""
    try:
        clear_api_cache()
        return {"message": "API cache cleared successfully"}
    except Exception as e:
        logger.error(f"Cache clear error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# --- Data Statistics Endpoint ---
@app.get("/api/data-stats")
async def data_stats():
    """Get statistics about loaded data"""
    if not graph:
        return {"message": "No data loaded"}
    
    data_types = {}
    dates = set()
    
    for node_id, node_data in graph.nodes(data=True):
        dtype = node_data.get('data_type', 'unknown')
        date = node_data.get('Date', 'unknown')
        
        data_types[dtype] = data_types.get(dtype, 0) + 1
        dates.add(date)
    
    return {
        "total_nodes": graph.number_of_nodes(),
        "total_edges": graph.number_of_edges(),
        "data_types": data_types,
        "date_range": {
            "count": len(dates),
            "dates": sorted(list(dates))
        }
    }


# --- S3 Government Data Endpoints ---
@app.get("/api/s3/government-data/{data_type}")
async def get_s3_government_data(data_type: str, query: str = None):
    """Get government data from S3 (census, bls, or fred)"""
    try:
        if data_type == "census":
            if query:
                data = s3_loader.get_demographic_info(query)
            else:
                data = s3_loader.load_census_data().head(100).to_dict('records')
        
        elif data_type == "bls":
            if query:
                data = s3_loader.get_employment_stats(query)
            else:
                data = s3_loader.load_bls_data().head(100).to_dict('records')
        
        elif data_type == "fred":
            if query:
                data = s3_loader.get_economic_indicators(query)
            else:
                data = s3_loader.load_fred_data().head(100).to_dict('records')
        
        else:
            raise HTTPException(status_code=400, detail="Invalid data type. Use: census, bls, or fred")
        
        return {
            "data_type": data_type,
            "count": len(data) if isinstance(data, list) else 0,
            "data": data,
            "source": "s3:mindthegap-gov-data"
        }
    
    except Exception as e:
        logger.error(f"Error fetching S3 government data: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/s3/search")
async def search_s3_data(query: str, data_type: str = "all"):
    """Search government data across S3 datasets"""
    _VALID_SEARCH_TYPES = {"all", "census", "bls", "fred"}
    if data_type not in _VALID_SEARCH_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid data_type. Use: {', '.join(sorted(_VALID_SEARCH_TYPES))}")
    # Limit query length to prevent abuse
    query = query[:200]
    try:
        results = s3_loader.search_government_data(query, data_type)
        
        return {
            "query": query,  # already capped at 200 chars
            "data_types_searched": list(results.keys()),
            "total_results": sum(len(v) for v in results.values()),
            "results": {
                k: v[:10] for k, v in results.items()  # Limit to 10 per type
            },
            "source": "s3:search"
        }
    
    except Exception as e:
        logger.error(f"Error searching S3 data: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/s3/stats")
async def get_s3_stats():
    """Get S3 bucket statistics"""
    try:
        stats = s3_loader.get_s3_stats()
        return stats
    
    except Exception as e:
        logger.error(f"Error getting S3 stats: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# --- Enriched Regional Data Endpoints ---
@app.get("/api/saipe-state/{state_name}")
async def get_saipe_state(state_name: str, start_year: int = 1989):
    """
    Return Census SAIPE income & poverty data for a specific state.
    Includes a current snapshot (latest year) and a time series from start_year.
    """
    try:
        slug = state_name.strip().lower().replace(" ", "-")
        if slug not in SAIPE_STATE_FIPS:
            raise HTTPException(status_code=404, detail=f"State not found: {state_name}")

        snapshot = saipe_client.get_state_snapshot(state_name, year=2023)
        time_series = saipe_client.get_state_time_series(state_name, start_year=start_year, end_year=2023)

        return {
            "success": True,
            "state": state_name,
            "snapshot": snapshot,
            "time_series": time_series,
            "source": "Census Bureau SAIPE",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"SAIPE error for {state_name}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/income-lorenz/{state_name}")
async def get_income_lorenz(
    state_name: str,
    year: Annotated[Optional[int], Query(ge=1989, le=2035)] = None,
):
    """
    Return state-specific income distribution (Lorenz curve + Gini + waffle data)
    built from Census ACS B19001 income bracket counts and B19083 Gini coefficient.
    Falls back to national DFA data for 'United States'.
    """
    try:
        slug = state_name.strip().lower().replace(" ", "-")
        fips = SAIPE_STATE_FIPS.get(slug)

        if not fips or slug in ("united-states", "us"):
            # Return national DFA data for US-level selection
            return {
                "success": True,
                "state": state_name,
                "source": "Federal Reserve DFA (national)",
                "state_specific": False,
                "data": None,
            }

        data = census_client.get_state_income_distribution(fips, year=year)
        if not data:
            return {"success": False, "error": f"No income distribution data for {state_name}"}

        return {
            "success": True,
            "state": state_name,
            "requested_year": year,
            "source": data.get("source", "Census ACS"),
            "state_specific": True,
            "data": data,
        }
    except Exception as e:
        logger.error(f"Income Lorenz error for {state_name}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/income-lorenz-metro/{metro_name}")
async def get_income_lorenz_metro(
    metro_name: str,
    year: Annotated[Optional[int], Query(ge=1989, le=2035)] = None,
):
    """
    Return metro-specific income distribution (Lorenz + waffle + Gini)
    from Census ACS metro-level income bracket tables.
    """
    try:
        if metro_name not in city_client.metro_areas:
            raise HTTPException(status_code=404, detail=f"Metro area not found: {metro_name}")

        data = city_client.get_metro_income_distribution(metro_name, year=year)
        if not data:
            return {"success": False, "error": f"No income distribution data for {metro_name}"}

        return {
            "success": True,
            "metro": metro_name,
            "requested_year": year,
            "source": data.get("source", "Census ACS (metro)"),
            "state_specific": False,
            "metro_specific": True,
            "data": data,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Metro income Lorenz error for {metro_name}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/bea-state/{state_name}")
async def get_bea_state(state_name: str):
    """Return BEA Regional economic context for a state."""
    try:
        slug = _safe_slug(state_name)
        fips = SAIPE_STATE_FIPS.get(slug)
        if not fips or fips == "00":
            raise HTTPException(status_code=404, detail=f"State not found: {state_name}")

        data = bea_client.get_state_regional_profile(fips)
        if not data:
            return {
                "success": False,
                "state": state_name,
                "message": "BEA data unavailable. Check BEA_API_KEY or upstream table availability.",
                "source": "U.S. Bureau of Economic Analysis Regional API",
            }

        return {
            "success": True,
            "state": state_name,
            "data": data,
            "source": data.get("source", "U.S. Bureau of Economic Analysis Regional API"),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"BEA state error for {state_name}: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/enriched-state/{state_name}")
async def get_enriched_state(state_name: str):
    """Get enriched government data for a specific state, including SAIPE poverty/income."""
    try:
        # Special case: United States — build national summary from SAIPE + DFA
        if state_name.strip().lower() in ("united states", "united-states", "us"):
            saipe_us = saipe_client.get_state_snapshot("united-states", year=2023)
            return {
                "success": True,
                "state": "United States",
                "profile": {
                    "identity": {"state_name": "United States", "state_code": "US", "fips_code": "00"},
                    "demographics": {
                        "population": 331_000_000,
                        "median_household_income": saipe_us.get("median_household_income", 74580),
                        "poverty_rate": saipe_us.get("poverty_rate", 11.5),
                        "source": "Census SAIPE",
                        "year": 2023,
                    },
                    "saipe": saipe_us,
                    "note": "National-level data. Select a state for regional detail.",
                },
                "data_sources": ["Census SAIPE", "Federal Reserve DFA"],
            }

        profile = load_enriched_state_profile(state_name)

        if not profile:
            cached_live_profile = get_cached_live_state_profile(state_name)
            if cached_live_profile:
                logger.info(f"Using cached live enriched profile for {state_name}")
                return {
                    "success": True,
                    "state": state_name,
                    "profile": cached_live_profile,
                    "data_sources": ["Census Bureau", "Census SAIPE", "Bureau of Labor Statistics", "Federal Reserve (FRED)", "Bureau of Economic Analysis"]
                }

            # Pre-built Supabase profile not available — build a live profile from
            # free government APIs instead of returning an error.
            logger.info(f"No Supabase profile for {state_name}; building live profile from government APIs")
            profile = build_api_enriched_state_profile(
                state_name,
                census_client=census_client,
                bea_client=bea_client,
            )

            if not profile:
                return {"success": False, "error": f"No data available for {state_name}"}

            cache_live_state_profile(state_name, profile)
        else:
            # Enrich cached Supabase profile with fresh SAIPE figures
            try:
                saipe_snapshot = saipe_client.get_state_snapshot(state_name, year=2023)
                if saipe_snapshot:
                    profile["saipe"] = saipe_snapshot
                    if profile.get("demographics"):
                        if saipe_snapshot.get("poverty_rate") is not None:
                            profile["demographics"]["poverty_rate"] = saipe_snapshot["poverty_rate"]
                        if saipe_snapshot.get("median_household_income") is not None:
                            profile["demographics"]["median_household_income"] = saipe_snapshot["median_household_income"]
            except Exception as saipe_err:
                logger.warning(f"Could not enrich with SAIPE data: {saipe_err}")
            try:
                slug = _safe_slug(state_name)
                fips = SAIPE_STATE_FIPS.get(slug) or profile.get("identity", {}).get("fips_code")
                if fips and fips != "00":
                    opportunity_data = census_client.get_state_opportunity_metrics(fips)
                    if opportunity_data:
                        profile["opportunity"] = opportunity_data
                        profile.setdefault("employment", {})
                        profile["employment"]["acs_labor"] = opportunity_data.get("labor", {})
                        profile["employment"]["acs_source"] = opportunity_data.get("source", "Census Bureau ACS")
                        profile["employment"]["acs_year"] = opportunity_data.get("year")
            except Exception as opportunity_err:
                logger.warning(f"Could not enrich with ACS opportunity data: {type(opportunity_err).__name__}")
            try:
                slug = _safe_slug(state_name)
                fips = SAIPE_STATE_FIPS.get(slug) or profile.get("identity", {}).get("fips_code")
                if fips and fips != "00":
                    bea_data = bea_client.get_state_regional_profile(fips)
                    if bea_data:
                        profile["bea"] = bea_data
            except Exception as bea_err:
                logger.warning(f"Could not enrich with BEA data: {type(bea_err).__name__}")

        return {
            "success": True,
            "state": state_name,
            "profile": profile,
            "data_sources": ["Census Bureau", "Bureau of Labor Statistics", "Federal Reserve (FRED)", "Census SAIPE", "Bureau of Economic Analysis"]
        }
    except Exception as e:
        logger.error(f"Error fetching enriched state data: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/enriched-states")
async def list_enriched_states():
    """List all states with enriched government data available"""
    # First try Supabase Storage listing; fall back to the full 50-state SAIPE list
    try:
        files = supabase_client.storage.from_('mindthegap-gov-data').list(
            'enriched-regional-data/state-profiles'
        )
        states = [f['name'] for f in files if f.get('name')]
        if states:
            return {
                "success": True,
                "states_available": len(states),
                "states": sorted(states),
                "enriched": True
            }
    except Exception as e:
        logger.warning(f"Supabase state listing failed: {e}")

    # Fallback: return all 50 states (data is fetched live per-state request)
    from saipe_api_client import STATE_FIPS as _SFIPS
    all_states = sorted(
        k.replace("-", " ").title()
        for k in _SFIPS
        if k not in ("united-states", "us")
    )
    return {
        "success": True,
        "states_available": len(all_states),
        "states": all_states,
        "enriched": False,
        "note": "Live data — fetched on demand from Census/SAIPE APIs"
    }

@app.get("/api/state-benchmarks")
async def get_state_benchmarks():
    """
    Return current all-state benchmark metrics for map, rankings, and insight cards.
    Uses current SAIPE poverty/income estimates and ACS Gini coefficients, with
    source metadata so the frontend can display freshness.
    """
    try:
        cached_payload = _STATE_BENCHMARK_CACHE.get("payload")
        cached_at = _STATE_BENCHMARK_CACHE.get("created_at")
        if cached_payload and cached_at:
            age_seconds = (datetime.now() - cached_at).total_seconds()
            if age_seconds < _STATE_BENCHMARK_TTL_SECONDS:
                return cached_payload

        candidate_years = _benchmark_candidate_years()

        saipe_rows = []
        saipe_year = None
        for candidate_year in candidate_years:
            rows = await _call_benchmark_source(
                "SAIPE",
                saipe_client.get_all_states_snapshot,
                year=candidate_year,
            )
            if rows:
                saipe_rows = rows
                saipe_year = candidate_year
                break

        gini_by_state = {}
        acs_year = None
        for candidate_year in candidate_years:
            rows = await _call_benchmark_source(
                "ACS",
                census_client.get_all_state_gini,
                year=candidate_year,
            )
            if rows:
                gini_by_state = rows
                acs_year = candidate_year
                break

        resolved_sources = {
            "gini": {"source": "Census ACS", "year": acs_year, "status": "live" if acs_year else "unavailable"},
            "poverty": {"source": "Census SAIPE", "year": saipe_year, "status": "live" if saipe_year else "unavailable"},
            "income": {"source": "Census SAIPE", "year": saipe_year, "status": "live" if saipe_year else "unavailable"},
        }

        benchmarks = []
        for row in saipe_rows:
            state_name = row.get("state_name")
            if not state_name:
                continue
            benchmarks.append({
                "state": state_name,
                "gini": gini_by_state.get(state_name),
                "poverty": row.get("poverty_rate"),
                "income": row.get("median_household_income"),
                "sources": resolved_sources,
            })

        if not benchmarks:
            payload = {
                "success": False,
                "benchmarks": [],
                "message": "Live benchmark data unavailable. Check Census API key or upstream availability.",
                "sources": resolved_sources,
                "generated_at": datetime.now().isoformat(),
            }
            _STATE_BENCHMARK_CACHE["payload"] = payload
            _STATE_BENCHMARK_CACHE["created_at"] = datetime.now()
            return payload

        payload = {
            "success": True,
            "benchmarks": benchmarks,
            "sources": resolved_sources,
            "generated_at": datetime.now().isoformat(),
        }
        _STATE_BENCHMARK_CACHE["payload"] = payload
        _STATE_BENCHMARK_CACHE["created_at"] = datetime.now()
        return payload
    except Exception as e:
        logger.error(f"Error fetching state benchmarks: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/api/admin/enrich-metro-areas")
async def enrich_metro_areas(_: None = Depends(_require_admin)):
    """Enrich all metro areas and upload to S3 (admin endpoint)"""
    try:
        logger.info("Starting metro area enrichment...")
        
        # Get all metro profiles from city_api_client
        all_metros = city_client.get_all_metro_profiles()
        
        if not all_metros:
            return {
                "success": False,
                "error": "Could not fetch metro area data"
            }
        
        # Upload each metro profile to Supabase Storage
        uploaded_count = 0
        
        for metro_name, metro_data in all_metros.items():
            try:
                metro_slug = metro_name.lower().replace(' ', '-')
                storage_key = f'enriched-regional-data/metro-areas/{metro_slug}/profile.json'
                
                supabase_client.storage.from_('mindthegap-gov-data').upload(
                    storage_key,
                    json.dumps(metro_data, indent=2).encode(),
                    file_options={"upsert": "true"}
                )
                
                logger.info(f"✓ Uploaded {metro_name} to Supabase Storage")
                uploaded_count += 1
                
            except Exception as e:
                logger.warning(f"Failed to upload {metro_name}: {e}")
        
        return {
            "success": True,
            "message": f"Enriched and uploaded {uploaded_count} metro areas to Supabase Storage",
            "metro_areas_enriched": uploaded_count,
            "total_metro_areas": len(all_metros),
            "timestamp": str(pd.Timestamp.now())
        }
    
    except Exception as e:
        logger.error(f"Metro area enrichment error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/enriched-metro-areas")
async def list_enriched_metro_areas():
    """List all metro areas with enriched government data available"""
    try:
        files = supabase_client.storage.from_('mindthegap-gov-data').list(
            'enriched-regional-data/metro-areas'
        )
        metros = [f['name'] for f in files if f.get('name')]
        return {
            "success": True,
            "metros_available": len(metros),
            "metros": sorted(metros),
            "enriched": True
        }
    except Exception as e:
        logger.error(f"Error listing enriched metro areas: {e}")
        return {
            "success": False,
            "error": "Could not list metro areas",
            "metros": []
        }

@app.get("/api/enriched-metro/{metro_name}")
async def get_enriched_metro(metro_name: str):
    """Get enriched government data for a specific metro area."""
    # Allowlist check — only accept known metro names
    if metro_name not in city_client.metro_areas:
        raise HTTPException(status_code=404, detail=f"Metro area not found: {metro_name}")
    try:
        # Try S3 profile first
        profile = load_enriched_metro_profile(metro_name)

        # If no S3 profile, build one from live APIs
        if not profile:
            profile = build_api_enriched_metro_profile(metro_name, city_client=city_client)

            if not profile:
                return {"success": False, "error": "No data found for requested metro area"}
        else:
            # Enrich S3 profile with latest live data
            demographics = city_client.get_metro_area_demographics(metro_name)
            unemployment = city_client.get_metro_unemployment(metro_name)
            if demographics:
                profile["demographics"] = {**(profile.get("demographics") or {}), **demographics}
            if unemployment:
                profile["employment"] = {**(profile.get("employment") or {}), **unemployment}

        # Tag as metro region
        if "identity" not in profile:
            profile["identity"] = {}
        profile["identity"]["region_type"] = "metro"
        profile["identity"]["metro_name"] = metro_name

        # Normalise demographics keys to match state profile shape
        demo = profile.get("demographics", {})
        if demo:
            if "total_population" in demo and "population" not in demo:
                demo["population"] = demo["total_population"]
            # education_bachelor_and_above is computed correctly by city_api_client (bachelor+/pop_25+)
            # Only compute fallback if city_api_client didn't provide it AND we have the right denominator
            if "education_bachelor_and_above" not in demo and "bachelor_degree" in demo and demo.get("pop_25_plus", 0):
                bachelors_plus = sum(demo.get(k, 0) or 0 for k in ("bachelor_degree", "masters_degree", "professional_degree", "doctorate_degree"))
                demo["education_bachelor_and_above"] = (bachelors_plus / demo["pop_25_plus"]) * 100
            profile["demographics"] = demo

        # Enrich with SAIPE for the metro's home state
        metro_info = city_client.metro_areas.get(metro_name)
        if metro_info:
            state_code = metro_info.get("state", "")
            # Convert 2-letter code to full name for SAIPE
            state_code_to_name = {v: k for k, v in {
                "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR",
                "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE",
                "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID",
                "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS",
                "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
                "massachusetts": "MA", "michigan": "MI", "minnesota": "MN",
                "mississippi": "MS", "missouri": "MO", "montana": "MT", "nebraska": "NE",
                "nevada": "NV", "new-hampshire": "NH", "new-jersey": "NJ",
                "new-mexico": "NM", "new-york": "NY", "north-carolina": "NC",
                "north-dakota": "ND", "ohio": "OH", "oklahoma": "OK", "oregon": "OR",
                "pennsylvania": "PA", "rhode-island": "RI", "south-carolina": "SC",
                "south-dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT",
                "vermont": "VT", "virginia": "VA", "washington": "WA",
                "west-virginia": "WV", "wisconsin": "WI", "wyoming": "WY",
                "district-of-columbia": "DC",
            }.items()}
            state_full_name = state_code_to_name.get(state_code, "")
            if state_full_name:
                try:
                    saipe_snapshot = saipe_client.get_state_snapshot(state_full_name, year=2023)
                    if saipe_snapshot:
                        profile["saipe"] = saipe_snapshot
                        profile["saipe"]["note"] = f"State-level SAIPE data for {state_full_name} (metro-level SAIPE not available)"
                except Exception as saipe_err:
                    logger.warning(f"Could not enrich metro with SAIPE data: {saipe_err}")

        return {
            "success": True,
            "metro": metro_name,
            "profile": profile,
            "data_sources": ["Census Bureau ACS (MSA)", "BLS LAUS", "Census SAIPE (state-level)"],
        }
    except Exception as e:
        logger.error(f"Error fetching enriched metro data for {metro_name}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/compare-states")
async def compare_states(state1: str, state2: str):
    """Compare two states using enriched government data"""
    try:
        profile1 = load_enriched_state_profile(state1)
        profile2 = load_enriched_state_profile(state2)
        
        if not profile1 or not profile2:
            return {
                "success": False,
                "error": "Could not load data for both states"
            }
        
        # Extract key metrics for comparison
        comparison = {
            "state1": state1,
            "state2": state2,
            "metrics": {
                "population": {
                    state1: profile1.get('demographics', {}).get('population'),
                    state2: profile2.get('demographics', {}).get('population')
                },
                "median_income": {
                    state1: profile1.get('demographics', {}).get('median_household_income'),
                    state2: profile2.get('demographics', {}).get('median_household_income')
                },
                "education_rate": {
                    state1: profile1.get('demographics', {}).get('education_bachelor_and_above'),
                    state2: profile2.get('demographics', {}).get('education_bachelor_and_above')
                },
                "unemployment": {
                    state1: profile1.get('employment', {}).get('unemployment_rate'),
                    state2: profile2.get('employment', {}).get('unemployment_rate')
                },
                "inequality_index": {
                    state1: profile1.get('derived_metrics', {}).get('inequality_index'),
                    state2: profile2.get('derived_metrics', {}).get('inequality_index')
                },
                "economic_health_score": {
                    state1: profile1.get('derived_metrics', {}).get('economic_health_score'),
                    state2: profile2.get('derived_metrics', {}).get('economic_health_score')
                }
            }
        }
        
        return {
            "success": True,
            "comparison": comparison
        }
    except Exception as e:
        logger.error(f"Error comparing states: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/wealth-distribution")
async def get_wealth_distribution():
    """
    Return real Federal Reserve DFA wealth/income distribution data for visualizations.
    Sources:
      - Lorenz curve: dfa-networth-shares.csv (latest quarter)
      - Stacked area: dfa-income-shares.csv (full time series, annual avg)
      - Waffle chart: dfa-income-shares.csv (latest quarter)
      - Gini coefficient: FRED API (SIPOVGINIUSA) or derived from DFA
    """
    try:
        # ── 1. LORENZ CURVE (from networth-shares, latest quarter) ─────────
        # Loads from S3 (government-data/census/dfa-networth-shares.csv) with local fallback
        nw_df = s3_loader.load_dfa_dataframe('dfa-networth-shares.csv')
        latest_quarter = nw_df['Date'].iloc[-1]  # last row's date
        # Use the actual latest date in the file
        latest_quarter = nw_df['Date'].max()
        latest_nw = nw_df[nw_df['Date'] == latest_quarter]

        # Map DFA categories to population percentiles (low → high wealth)
        dfa_to_pop = {
            'Bottom50':       {'pop_start': 0,  'pop_end': 50},
            'Next40':         {'pop_start': 50, 'pop_end': 90},
            'Next9':          {'pop_start': 90, 'pop_end': 99},
            'RemainingTop1':  {'pop_start': 99, 'pop_end': 99.9},
            'TopPt1':         {'pop_start': 99.9, 'pop_end': 100},
        }
        nw_row = {row['Category']: row['Net worth'] for _, row in latest_nw.iterrows()
                  if row['Category'] in dfa_to_pop}

        # Sort from poorest to richest and build cumulative series
        ordered = ['Bottom50', 'Next40', 'Next9', 'RemainingTop1', 'TopPt1']
        lorenz_data = []
        cum_pop = 0.0
        cum_wealth = 0.0
        lorenz_data.append({'bracket': 'Origin', 'cumulativePopulation': 0, 'cumulativeWealth': 0,
                             'percentage': 0})
        for cat in ordered:
            if cat not in nw_row:
                continue
            info = dfa_to_pop[cat]
            pop_share = info['pop_end'] - info['pop_start']
            wealth_share = float(nw_row[cat])
            cum_pop += pop_share
            cum_wealth += wealth_share
            lorenz_data.append({
                'bracket': cat.replace('TopPt1', 'Top 0.1%')
                               .replace('RemainingTop1', 'Top 1-0.1%')
                               .replace('Next9', 'Next 9%')
                               .replace('Next40', 'Next 40%')
                               .replace('Bottom50', 'Bottom 50%'),
                'cumulativePopulation': round(cum_pop, 1),
                'cumulativeWealth': round(cum_wealth, 2),
                'percentage': round(wealth_share, 2),
            })

        # Derive Gini from Lorenz data (trapezoidal approximation)
        points = [(0, 0)] + [(d['cumulativePopulation'], d['cumulativeWealth']) for d in lorenz_data[1:]]
        area_under_lorenz = sum(
            (points[i][0] - points[i-1][0]) * (points[i][1] + points[i-1][1]) / 2
            for i in range(1, len(points))
        ) / 10000  # normalise from % to fraction
        gini = round(1 - 2 * area_under_lorenz, 4)

        # Try to get official FRED Gini (SIPOVGINIUSA) as well
        try:
            from fred_api_client import FREDAPIClient
            fred = FREDAPIClient()
            gini_series = fred._get_series_data('SIPOVGINIUSA', 5)
            if gini_series and gini_series.get('data'):
                latest_gini_key = max(gini_series['data'].keys())
                gini = round(gini_series['data'][latest_gini_key] / 100, 4)  # FRED stores as 0-100
        except Exception:
            pass  # fall back to derived gini

        # ── 2. STACKED AREA (from income-shares, annual averages) ─────────
        # Loads from S3 (government-data/census/dfa-income-shares.csv) with local fallback
        inc_df = s3_loader.load_dfa_dataframe('dfa-income-shares.csv')
        # Parse year from "1989:Q3" format
        inc_df['year'] = inc_df['Date'].str[:4].astype(int)
        # Keep relevant income-share categories
        inc_cats = ['pct99to100', 'pct80to99', 'pct60to80', 'pct40to60', 'pct20to40', 'pct00to20']
        inc_filtered = inc_df[inc_df['Category'].isin(inc_cats)]
        # Annual average per category
        annual = inc_filtered.groupby(['year', 'Category'])['Net worth'].mean().reset_index()
        # Pivot so each row is a year
        pivoted = annual.pivot(index='year', columns='Category', values='Net worth').reset_index()
        pivoted = pivoted.sort_values('year')
        label_map = {
            'pct99to100': 'Top 1%',
            'pct80to99':  '80-99%',
            'pct60to80':  '60-80%',
            'pct40to60':  '40-60%',
            'pct20to40':  '20-40%',
            'pct00to20':  'Bottom 20%',
        }
        stacked_data = []
        for _, row in pivoted.iterrows():
            entry = {'year': int(row['year'])}
            for cat, label in label_map.items():
                if cat in pivoted.columns:
                    val = row.get(cat)
                    entry[label] = round(float(val), 2) if pd.notna(val) else 0
            stacked_data.append(entry)

        # ── 3. WAFFLE CHART (latest income share quarter) ─────────────────
        latest_inc_quarter = inc_df['Date'].max()
        latest_inc = inc_df[inc_df['Date'] == latest_inc_quarter]
        waffle_colors = {
            'pct99to100': '#3b82f6',
            'pct80to99':  '#0ea5e9',
            'pct60to80':  '#14b8a6',
            'pct40to60':  '#22c55e',
            'pct20to40':  '#eab308',
            'pct00to20':  '#ef4444',
        }
        waffle_labels = {
            'pct99to100': 'Top 1%',
            'pct80to99':  '80-99%',
            'pct60to80':  '60-80%',
            'pct40to60':  '40-60%',
            'pct20to40':  '20-40%',
            'pct00to20':  'Bottom 20%',
        }
        waffle_data = []
        for cat in ['pct00to20', 'pct20to40', 'pct40to60', 'pct60to80', 'pct80to99', 'pct99to100']:
            row = latest_inc[latest_inc['Category'] == cat]
            if not row.empty:
                waffle_data.append({
                    'bracket': waffle_labels[cat],
                    'percentage': round(float(row['Net worth'].iloc[0]), 2),
                    'color': waffle_colors[cat],
                })

        return {
            'success': True,
            'data_date': latest_quarter,
            'gini_coefficient': gini,
            'lorenz_data': lorenz_data,
            'stacked_data': stacked_data,
            'waffle_data': waffle_data,
            'source': 'Federal Reserve Distributional Financial Accounts (DFA)',
        }

    except Exception as e:
        logger.error(f"Error in wealth distribution endpoint: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/chatbot-knowledge-base")
async def get_chatbot_knowledge_base():
    """Get chatbot's enriched knowledge base and learned patterns"""
    return {
        "status": ENRICHMENT_DATA['status'],
        "knowledge_base_available": ENRICHMENT_DATA['knowledge_base'] is not None,
        "patterns_learned": len(ENRICHMENT_DATA['correlations']) if ENRICHMENT_DATA['correlations'] else 0,
        "data_sources": ["Census Bureau", "Bureau of Labor Statistics", "Federal Reserve (FRED)"],
        "enrichment_date": "2026-02-12",
        "message": "Chatbot has been trained on enriched government data for all 50 US states"
    }

# ============== STARTUP AND RUN INSTRUCTIONS ==============
# 
# 1. ENVIRONMENT SETUP:
#    Create a .env file in the backend directory with:
#    - OPENAI_API_KEY=your_key
#    - CENSUS_API_KEY=your_key (optional, for Census data)
#    - BLS_API_KEY=your_key (optional, for BLS data)
#    - FRED_API_KEY=your_key (optional, for FRED data)
#    - EXA_API_KEY=your_key (optional, for web search)
#
# 2. INSTALL DEPENDENCIES:
#    pip install -r requirements.txt
#    python -m spacy download en_core_web_sm
#
# 3. RUN THE SERVER:
#    uvicorn main:app --reload --port 8000
#
# 4. ACCESS THE API:
#    - Swagger UI: http://localhost:8000/docs
#    - ReDoc: http://localhost:8000/redoc
#    - Chat endpoint: POST /api/chat
#    - Trends endpoint: POST /api/trends
#    - Policy recommendations: POST /api/policy-recommendations
#
# ============================================================
