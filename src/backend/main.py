import os
import logging
import json
import boto3
from functools import lru_cache
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import networkx as nx
from langchain_core.prompts import PromptTemplate
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv
from graph_rag import get_graph_rag_context
from vector_embeddings import VectorStore
from trend_analysis import TrendAnalyzer, analyze_wealth_gap_trends
from policy_recommendations import get_policy_recommendations_for_region
from government_api import get_local_economic_indicators, clear_api_cache
from s3_data_loader import s3_loader
from city_api_client import city_client

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv()

# Set up OpenAI API key
openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
    logger.warning("OPENAI_API_KEY not found in .env file. Please add it.")

# Initialize FastAPI app
app = FastAPI(title="MindTheGap API", version="2.0", docs_url="/docs")

# Add CORS middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Enrichment Data Loading (Government Data from S3) ---
@lru_cache(maxsize=1)
def load_enrichment_knowledge_base():
    """Load chatbot knowledge base from S3 enrichment pipeline"""
    try:
        s3_client = boto3.client('s3', region_name='us-east-2')
        
        # Load knowledge base
        response = s3_client.get_object(
            Bucket='mindthegap-gov-data',
            Key='chatbot-training-data/knowledge-base.json'
        )
        knowledge_base = json.loads(response['Body'].read())
        
        # Load correlation patterns
        response = s3_client.get_object(
            Bucket='mindthegap-gov-data',
            Key='chatbot-training-data/economic-correlations.json'
        )
        correlations = json.loads(response['Body'].read())
        
        logger.info("✓ Enrichment knowledge base loaded from S3")
        return {
            'knowledge_base': knowledge_base,
            'correlations': correlations,
            'status': 'loaded'
        }
    except Exception as e:
        logger.warning(f"Could not load enrichment knowledge base from S3: {e}")
        return {
            'knowledge_base': None,
            'correlations': None,
            'status': 'unavailable'
        }

def load_enriched_state_profile(state_name: str) -> dict:
    """Load enriched profile for a specific state from S3"""
    try:
        s3_client = boto3.client('s3', region_name='us-east-2')
        state_slug = state_name.lower().replace(' ', '-')
        
        response = s3_client.get_object(
            Bucket='mindthegap-gov-data',
            Key=f'enriched-regional-data/state-profiles/{state_slug}/profile.json'
        )
        
        profile = json.loads(response['Body'].read())
        return profile
    except Exception as e:
        logger.warning(f"Could not load enriched state profile for {state_name}: {e}")
        return None

def load_enriched_metro_profile(metro_name: str) -> dict:
    """Load enriched profile for a specific metro area from S3"""
    try:
        s3_client = boto3.client('s3', region_name='us-east-2')
        metro_slug = metro_name.lower().replace(' ', '-')
        
        response = s3_client.get_object(
            Bucket='mindthegap-gov-data',
            Key=f'enriched-regional-data/metro-areas/{metro_slug}/profile.json'
        )
        
        profile = json.loads(response['Body'].read())
        return profile
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

# --- Data Loading (from Supabase or CSV fallback) ---
from supabase_db import get_db

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
    
    # Initialize vector store with all records for semantic search
    try:
        vector_store = VectorStore()
        vector_store.add_documents(all_records)
        logger.info("✓ Vector embeddings initialized")
    except Exception as e:
        logger.warning(f"Could not initialize vector store: {e}")
else:
    logger.error("❌ Failed to load data from any source")

# --- LangChain and RAG Setup ---
def setup_llm_chain():
    """Sets up the LangChain runnable sequence for enhanced question answering."""
    llm = ChatOpenAI(temperature=0.2, api_key=openai_api_key, model="gpt-3.5-turbo")
    
    template = """You are an expert AI analyst for the MindTheGap project, specializing in wealth inequality analysis and economic policy recommendations. Your knowledge includes:

PRIMARY DATA SOURCES:
- Federal Reserve's Distributional Financial Accounts (DFA): Comprehensive national-level data on wealth distribution by percentile groups
- US Census Bureau: Demographic and socioeconomic data by race, age, education, and location
- Bureau of Labor Statistics: Employment and income data
- Government economic indicators and historical policy outcomes

YOUR EXPERTISE INCLUDES:
- Wealth inequality analysis and trends
- Demographic disparities in wealth and income
- Economic policy impacts (both historical and projected)
- Evidence-based policy recommendations
- Regional economic variations

GUIDELINES FOR RESPONSES:
1. ALWAYS cite data sources and metrics from the Context provided
2. For geographic queries: Prioritize local data when available; supplement with national context
3. For trend queries: Analyze changes over time and highlight inflection points
4. For policy queries: Provide evidence-based recommendations based on historical precedents
5. Be honest about uncertainty - if Context lacks data, explicitly state this

IMPORTANT RULES:
- Use the specific metrics and percentages provided in the Context
- When discussing wealth disparity, use precise terminology (percentile groups, not vague terms)
- Support recommendations with historical examples and empirical evidence
- Consider implementation feasibility and unintended consequences
- Maintain objectivity and present multiple perspectives when relevant

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


# --- Request/Response Models ---
class Message(BaseModel):
    role: str  # 'user' or 'assistant'
    content: str

class ChatRequest(BaseModel):
    message: str
    conversation_history: list[Message] = []  # Optional conversation context
    
class TrendRequest(BaseModel):
    category: str  # e.g., "networth", "income"
    demographic: str = None
    
class PolicyRequest(BaseModel):
    gini_coefficient: float = 0.45
    top_1_percent_share: float = 35
    bottom_50_percent_share: float = 3
    unemployment_rate: float = 4.5
    poverty_rate: float = 12
    region: str = "National"


# --- Chat Endpoint (Enhanced) ---
def build_conversation_context(history: list[Message]) -> str:
    """Build conversation context from chat history"""
    if not history:
        return ""
    
    context = "Previous conversation:\n"
    for msg in history[-3:]:  # Last 3 messages for context
        role = "User" if msg.role == "user" else "Assistant"
        context += f"{role}: {msg.content}\n"
    return context


def extract_location_from_query(question: str) -> dict:
    """Extract location (state or city) from user query"""
    states = [
        'California', 'Texas', 'Florida', 'Pennsylvania', 
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
    
    # Priority 1: Check for explicit city mentions (with "city" or "metro" keywords)
    for city in cities:
        if city.lower() in q_lower:
            # If also contains state name, check context to disambiguate
            if q_lower.count('york') > 0 and 'new york' in q_lower:
                return {'type': 'city', 'name': 'New York'}
            elif q_lower.count('washington') > 0 and 'washington dc' in q_lower:
                return {'type': 'city', 'name': 'Washington'}
            elif q_lower.count('washington') > 0 and 'state of washington' not in q_lower:
                # Default to city if just "Washington"
                return {'type': 'city', 'name': 'Washington'}
            elif city.lower() in q_lower:
                return {'type': 'city', 'name': city}
    
    # Priority 2: Check for states (excluding those covered by cities)
    for state in states:
        if state.lower() in q_lower:
            return {'type': 'state', 'name': state}
    
    return {'type': None, 'name': None}


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
    """Smart conversation-aware chat with natural language + enriched government data"""
    if not graph:
        raise HTTPException(status_code=500, detail="Graph not loaded. Check data files.")
    
    question = request.message
    conversation_context = build_conversation_context(request.conversation_history)
    
    logger.info(f"Chat request: {question}")
    
    try:
        # Check if this is a casual conversation (greeting, general chat)
        casual_keywords = ['hi', 'hello', 'hey', 'how are you', 'what are you', 'who are you', 'thanks', 'thank you']
        is_casual = any(keyword in question.lower() for keyword in casual_keywords)
        
        # Check if this is a data/comparison query
        data_keywords = ['compare', 'difference', 'data', 'statistics', 'tell me about', 'what is', 'how']
        is_data_query = any(keyword in question.lower() for keyword in data_keywords)
        
        # If casual conversation, respond naturally without forcing data
        if is_casual and not is_data_query:
            prompt_text = f"""You are a friendly wealth inequality expert AI assistant. 
Respond warmly and naturally to this casual greeting. Keep it brief (1-2 sentences).
You can offer to help with questions about US wealth, inequality, or state economics.

User: {question}

Response:"""
            
            llm = ChatOpenAI(
                temperature=0.7, 
                api_key=openai_api_key, 
                model="gpt-3.5-turbo", 
                max_tokens=150
            )
            response = llm.invoke(prompt_text)
            reply = response.content if hasattr(response, 'content') else str(response)
            
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
                
                prompt_text = f"""You are a wealth inequality and economics expert. 
Based on the government data below, provide a natural, articulate comparison answering the user's question.
Focus on the key differences that matter. Be conversational, not just a list. (2-3 sentences max)

{conversation_context}

Government Data from Census Bureau, BLS, and Federal Reserve:
{data_context}

User Question: {question}

Articulate Comparison:"""
                
                llm = ChatOpenAI(
                    temperature=0.3, 
                    api_key=openai_api_key, 
                    model="gpt-3.5-turbo", 
                    max_tokens=250
                )
                response = llm.invoke(prompt_text)
                reply = response.content if hasattr(response, 'content') else str(response)
                
                return {
                    "reply": reply,
                    "source": "enriched_comparison",
                    "states": [state1, state2],
                    "query_type": "state_comparison"
                }
        
        # Handle single state queries
        location_info = extract_location_from_query(question)
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
                
                # Use LLM to articulate the data naturally
                prompt_text = f"""You are a wealth and economics expert analyst.
Use the government data below to naturally answer the user's question about {location}.
Be conversational and insightful - articulate what the data means, don't just repeat numbers. (2-3 sentences)

{conversation_context}

Government Data:
{data_context}

User Question: {question}

Natural Analysis:"""
                
                llm = ChatOpenAI(
                    temperature=0.3, 
                    api_key=openai_api_key, 
                    model="gpt-3.5-turbo", 
                    max_tokens=250
                )
                response = llm.invoke(prompt_text)
                reply = response.content if hasattr(response, 'content') else str(response)
                
                return {
                    "reply": reply,
                    "source": "enriched_analysis",
                    "location": location,
                    "query_type": "state_analysis"
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
                
                # Use LLM to articulate city data
                prompt_text = f"""You are a wealth and economics expert analyst.
Use the government metro area data below to naturally answer the user's question about {city_name}.
Be conversational and insightful - explain what the data tells us about this metro area. (2-3 sentences)

{conversation_context}

Government Data:
{data_context}

User Question: {question}

Natural Analysis:"""
                
                llm = ChatOpenAI(
                    temperature=0.3, 
                    api_key=openai_api_key, 
                    model="gpt-3.5-turbo", 
                    max_tokens=250
                )
                response = llm.invoke(prompt_text)
                reply = response.content if hasattr(response, 'content') else str(response)
                
                return {
                    "reply": reply,
                    "source": "city_metro_data_s3",
                    "city": city_name,
                    "metro_area": metro_area,
                    "query_type": "city_analysis"
                }
        
        # For general, non-location-specific questions, use semantic search + LLM
        context = get_graph_rag_context(question, graph)
        
        prompt_text = f"""You are a wealth inequality and economics expert.
Answer this question using your knowledge and the context provided.
Be conversational and direct. (2-3 sentences max)

{conversation_context}

Context: {context}

Question: {question}

Answer:"""
        
        llm = ChatOpenAI(
            temperature=0.3, 
            api_key=openai_api_key, 
            model="gpt-3.5-turbo", 
            max_tokens=200
        )
        response = llm.invoke(prompt_text)
        reply = response.content if hasattr(response, 'content') else str(response)
        
        return {
            "reply": reply,
            "source": "semantic_search",
            "query_type": "general_question"
        }
        
    except Exception as e:
        logger.error(f"Chat error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


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
        analysis = TrendAnalyzer.trend_analysis(relevant_data)
        
        return {
            "category": request.category,
            "demographic": request.demographic,
            "analysis": analysis,
            "data_points": len(relevant_data)
        }
        
    except Exception as e:
        logger.error(f"Trend analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --- Policy Recommendations Endpoint ---
@app.post("/api/policy-recommendations")
async def get_policy(request: PolicyRequest):
    """Generate evidence-based policy recommendations"""
    try:
        region_data = {
            'gini_coefficient': request.gini_coefficient,
            'top_1_percent_share': request.top_1_percent_share,
            'bottom_50_percent_share': request.bottom_50_percent_share,
            'unemployment_rate': request.unemployment_rate,
            'poverty_rate': request.poverty_rate,
            'region': request.region
        }
        
        recommendations = get_policy_recommendations_for_region(region_data)
        
        return {
            "region": request.region,
            "economic_indicators": {
                "gini_coefficient": request.gini_coefficient,
                "top_1_percent_share": request.top_1_percent_share,
                "poverty_rate": request.poverty_rate
            },
            "recommendations": recommendations,
            "count": len(recommendations)
        }
        
    except Exception as e:
        logger.error(f"Policy recommendation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/admin/sync-government-data")
async def sync_government_data_endpoint():
    """Trigger government data sync (admin endpoint)"""
    try:
        from sync_government_data import sync_all
        
        success = sync_all()
        
        return {
            "status": "success" if success else "partial",
            "message": "Government data sync completed",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Sync error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --- Cache Management Endpoint ---
@app.post("/api/admin/clear-cache")
async def clear_cache():
    """Clear API caches (admin endpoint)"""
    try:
        clear_api_cache()
        return {"message": "API cache cleared successfully"}
    except Exception as e:
        logger.error(f"Cache clear error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/s3/search")
async def search_s3_data(query: str, data_type: str = "all"):
    """Search government data across S3 datasets"""
    try:
        results = s3_loader.search_government_data(query, data_type)
        
        return {
            "query": query,
            "data_types_searched": list(results.keys()),
            "total_results": sum(len(v) for v in results.values()),
            "results": {
                k: v[:10] for k, v in results.items()  # Limit to 10 per type
            },
            "source": "s3:search"
        }
    
    except Exception as e:
        logger.error(f"Error searching S3 data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/s3/stats")
async def get_s3_stats():
    """Get S3 bucket statistics"""
    try:
        stats = s3_loader.get_s3_stats()
        return stats
    
    except Exception as e:
        logger.error(f"Error getting S3 stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Enriched Regional Data Endpoints ---
@app.get("/api/enriched-state/{state_name}")
async def get_enriched_state(state_name: str):
    """Get enriched government data for a specific state"""
    try:
        profile = load_enriched_state_profile(state_name)
        
        if not profile:
            return {
                "success": False,
                "error": f"No enriched data found for {state_name}"
            }
        
        return {
            "success": True,
            "state": state_name,
            "profile": profile,
            "data_sources": ["Census Bureau", "Bureau of Labor Statistics", "Federal Reserve (FRED)"]
        }
    except Exception as e:
        logger.error(f"Error fetching enriched state data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/enriched-states")
async def list_enriched_states():
    """List all states with enriched government data available"""
    try:
        s3_client = boto3.client('s3', region_name='us-east-2')
        
        response = s3_client.list_objects_v2(
            Bucket='mindthegap-gov-data',
            Prefix='enriched-regional-data/state-profiles/',
            Delimiter='/'
        )
        
        states = []
        if 'CommonPrefixes' in response:
            states = [prefix['Prefix'].split('/')[-2] for prefix in response['CommonPrefixes']]
        
        return {
            "success": True,
            "states_available": len(states),
            "states": sorted(states),
            "enriched": True
        }
    except Exception as e:
        logger.error(f"Error listing enriched states: {e}")
        return {
            "success": False,
            "error": str(e),
            "states": []
        }

@app.post("/api/admin/enrich-metro-areas")
async def enrich_metro_areas():
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
        
        # Upload each metro profile to S3
        s3_client = boto3.client('s3', region_name='us-east-2')
        uploaded_count = 0
        
        for metro_name, metro_data in all_metros.items():
            try:
                metro_slug = metro_name.lower().replace(' ', '-')
                s3_key = f'enriched-regional-data/metro-areas/{metro_slug}/profile.json'
                
                s3_client.put_object(
                    Bucket='mindthegap-gov-data',
                    Key=s3_key,
                    Body=json.dumps(metro_data, indent=2),
                    ContentType='application/json'
                )
                
                logger.info(f"✓ Uploaded {metro_name} to S3")
                uploaded_count += 1
                
            except Exception as e:
                logger.warning(f"Failed to upload {metro_name}: {e}")
        
        return {
            "success": True,
            "message": f"Enriched and uploaded {uploaded_count} metro areas to S3",
            "metro_areas_enriched": uploaded_count,
            "total_metro_areas": len(all_metros),
            "timestamp": str(pd.Timestamp.now())
        }
    
    except Exception as e:
        logger.error(f"Metro area enrichment error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/enriched-metro-areas")
async def list_enriched_metro_areas():
    """List all metro areas with enriched government data available"""
    try:
        s3_client = boto3.client('s3', region_name='us-east-2')
        
        response = s3_client.list_objects_v2(
            Bucket='mindthegap-gov-data',
            Prefix='enriched-regional-data/metro-areas/',
            Delimiter='/'
        )
        
        metros = []
        if 'CommonPrefixes' in response:
            metros = [prefix['Prefix'].split('/')[-2] for prefix in response['CommonPrefixes']]
        
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
            "error": str(e),
            "metros": []
        }

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
        raise HTTPException(status_code=500, detail=str(e))

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
