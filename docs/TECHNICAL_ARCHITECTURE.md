# Technical Architecture: Regional Data Enrichment System

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     MindTheGap Enrichment System                │
└─────────────────────────────────────────────────────────────────┘

LAYER 1: GOVERNMENT DATA SOURCES
  ├── Census Bureau API         (Demographics: population, age, education, income)
  ├── BLS API                   (Employment: unemployment, industries, wages)
  └── FRED API                  (Economics: GDP, inflation, housing, confidence)

LAYER 2: API CLIENT MODULES
  ├── census_api_client.py       (Fetch Census data for 50 states)
  ├── bls_api_client.py          (Fetch unemployment & employment data)
  └── fred_api_client.py         (Fetch economic indicators)

LAYER 3: DATA ENRICHMENT PIPELINE
  └── data_enrichment_pipeline.py
      ├── Fetch from 3 APIs
      ├── Merge with Supabase wealth data
      ├── Calculate derived metrics
      └── Save to S3: enriched-regional-data/

LAYER 4: CHATBOT LEARNING
  └── chatbot_learning_engine.py
      ├── Generate training data (5,000+ Q&A pairs)
      ├── Discover correlation patterns (5 patterns)
      ├── Create few-shot examples
      └── Save to S3: chatbot-training-data/

LAYER 5: ORCHESTRATION
  └── run_enrichment_pipeline.py
      ├── Stage 1: Enrichment
      ├── Stage 2: Regional Aggregations
      └── Stage 3: Chatbot Learning

LAYER 6: INTEGRATION & USE
  ├── FastAPI Backend (main.py)
  │   ├── Load knowledge base from S3
  │   ├── Enhanced system prompt
  │   └── Chat endpoints with enriched context
  │
  └── React Frontend
      ├── State profile views
      ├── Regional comparisons
      └── Enriched visualizations
```

## Data Flow Architecture

### Enrichment Flow
```
┌──────────────────────────────────────────────────────────────┐
│ ENRICHMENT DATA FLOW                                         │
└──────────────────────────────────────────────────────────────┘

User runs: python run_enrichment_pipeline.py --mode enrichment-only

  ↓

Stage 1: Fetch Government APIs for Each State
  ├── Census API: population, income, education, poverty, race
  ├── BLS API: unemployment_rate, industries, wages
  └── FRED API: inflation, GDP, mortgage_rates, housing, confidence

  ↓

Stage 2: Enrich with Existing Data
  ├── Fetch Supabase: top 1% networth, Gini coefficient, wealth_gap
  └── Merge all sources into state profile

  ↓

Stage 3: Calculate Derived Metrics
  ├── inequality_index = (wealth_gap / median_income) * 100
  ├── economic_health_score = (0-100 based on all indicators)
  └── region_classification = classify(health_score)

  ↓

Stage 4: Save to S3
  ├── s3://mindthegap-gov-data/enriched-regional-data/
  └── state-profiles/{state}/
      ├── profile.json
      ├── demographics.json
      ├── employment.json
      ├── economics.json
      ├── wealth.json
      └── trends.json

  ↓

Create Regional Aggregations
  ├── Calculate mean, median, std for each region
  └── Save to S3: regional-comparisons/{region}.json
```

### Learning Flow
```
┌──────────────────────────────────────────────────────────────┐
│ CHATBOT LEARNING DATA FLOW                                   │
└──────────────────────────────────────────────────────────────┘

User runs: python run_enrichment_pipeline.py --mode learning-only

  ↓

Step 1: Load Enriched Profiles
  └── Read all state profiles from S3

  ↓

Step 2: Generate Insights from Profiles
  ├── For each state: extract key facts
  ├── Create human-readable insights
  └── Example: "California has high inequality (83.75) due to service sector concentration"

  ↓

Step 3: Create Training Dataset
  ├── For each state, generate ~100+ Q&A pairs
  ├── Questions: "Tell me about {state}", "What's the unemployment in {state}?", etc.
  ├── Answers: Use insights + government data
  └── Format: JSONL (machine learning ready)

  ↓

Step 4: Discover Correlation Patterns
  ├── Analyze relationships across all 50 states
  ├── Pattern 1: Education → Income → Low Inequality (0.85 conf)
  ├── Pattern 2: Service Sector → Low Wages → High Inequality (0.78 conf)
  ├── Pattern 3: Tech/Professional → High Wages → Opportunity (0.82 conf)
  ├── Pattern 4: Manufacturing Decline → Job Loss → Inequality (0.81 conf)
  └── Pattern 5: Diversity → Complex Dynamics (0.72 conf)

  ↓

Step 5: Create Few-Shot Examples
  ├── State comparison examples
  │   └── "How do Massachusetts and Mississippi compare?"
  ├── Wealth inequality explanations
  │   └── "Why is California so unequal?"
  └── Economic trend analysis
      └── "What's driving inequality in Texas?"

  ↓

Step 6: Generate Enhanced System Prompt
  ├── Include learned patterns
  ├── Add regional facts
  └── Embed few-shot examples

  ↓

Step 7: Create Knowledge Base
  ├── regional_facts: Facts about each of 5 US regions
  ├── correlation_rules: Reasoning rules based on patterns
  ├── few_shot_examples: Examples for in-context learning
  └── system_prompt: Enhanced chatbot instruction

  ↓

Step 8: Save to S3
  └── s3://mindthegap-gov-data/chatbot-training-data/
      ├── regional-insights-{date}.jsonl (ML format)
      ├── regional-insights-{date}.json (Human readable)
      ├── economic-correlations.json (Patterns)
      └── knowledge-base.json (Complete KB)
```

### Integration Flow
```
┌──────────────────────────────────────────────────────────────┐
│ CHATBOT INTEGRATION FLOW                                     │
└──────────────────────────────────────────────────────────────┘

User Message: "Tell me about California"

  ↓

Backend: main.py Chat Endpoint
  ├── Extract state name from message (California)
  ├── Load knowledge base from S3 (cached in memory)
  └── Find relevant few-shot examples

  ↓

Build Enhanced Prompt
  ├── System prompt: "You're MindTheGap AI..."
  ├── Add learned patterns
  ├── Add regional facts about West region
  ├── Add few-shot example: "How does California compare?"
  └── Add conversation history

  ↓

Call ChatGPT-4 with Context
  ├── System prompt (enhanced with enrichment)
  ├── Few-shot examples
  ├── Conversation history
  └── User message

  ↓

ChatGPT Response Generation
  ├── Uses learned patterns to structure response
  ├── References government data from enrichment
  ├── Compares to other states if relevant
  └── Explains inequality using correlation patterns

  ↓

Return Response to Frontend
  ├── Answer: "California is the most populous state with..."
  └── Metadata: {has_enrichment: true, patterns_loaded: 5}

  ↓

Frontend Displays Response
  ├── Show enriched data visualizations
  ├── Display state profile card
  └── Link to state comparison
```

## Module Specifications

### 1. census_api_client.py (350 lines)

**Purpose:** Fetch demographic data from US Census Bureau

**Class:** `CensusAPIClient`

**Key Methods:**
- `__init__(api_key)` - Initialize with Census API key
- `get_state_demographics(state_fips)` - Fetch state-level demographics
- `get_county_demographics(state_fips, county_fips)` - Fetch county-level data
- `_parse_census_response(data)` - Parse API response

**Data Fetched:**
- Population (total population)
- Median age (population age profile)
- Household income (economic status)
- Education (bachelor's degree attainment %)
- Poverty rate (economic hardship)
- Race distribution (demographic composition)

**API Endpoint:** `https://api.census.gov/data/{year}/acs/acs5`

**Variables Fetched:**
```
NAME (state name)
B01003_001E (total population)
B01002_001E (median age)
B19013_001E (median household income)
B15003_022E (bachelor's degrees)
B17001_002E (population below poverty level)
B02001_002E (white population)
B03001_003E (hispanic population)
B02001_005E (asian population)
B02001_003E (black population)
```

**Fallback Data:** Mock data for all 50 states if API fails

**State Mapping:** `STATE_FIPS` dictionary (50 states → 2-digit FIPS codes)

---

### 2. bls_api_client.py (300 lines)

**Purpose:** Fetch employment data from Bureau of Labor Statistics

**Class:** `BLSAPIClient`

**Key Methods:**
- `__init__(api_key)` - Initialize with BLS API key
- `get_state_unemployment(state_code, start_year, end_year)` - Fetch monthly unemployment
- `get_top_industries_state(state_code)` - Fetch top employing industries
- `get_average_wage(state_code)` - Fetch average wages

**Data Fetched:**
- Unemployment rates (monthly time series)
- Employment by industry (structural employment)
- Average wages (wage statistics)

**API Endpoint:** `https://api.bls.gov/publicAPI/v2/timeseries/data`

**Series IDs:**
- State unemployment: `LAUST{FIPS}0000000003` (one per state)
- Industry employment: Multiple series per state
- Wage data: Occupational wage data

**Series Example:** `LAUSTCA0000000003` = California unemployment rate

**Fallback Data:** Default unemployment as % by state

**State Mapping:** `STATE_UNEMPLOYMENT_SERIES` dictionary (state → BLS series ID)

---

### 3. fred_api_client.py (350 lines)

**Purpose:** Fetch Federal Reserve economic data

**Class:** `FREDAPIClient`

**Key Methods:**
- `__init__(api_key)` - Initialize with FRED API key
- `get_state_economic_indicators(state_code)` - Fetch state economic data
- `get_national_indicators()` - Fetch national economic data
- `_get_series_data(series_id, limit)` - Generic series fetcher

**Data Fetched:**
- Unemployment rate: `UNRATE`
- Inflation (CPI): `CPIAUCSL`
- GDP per capita: `GDPC1`
- Mortgage rates: `MORTGAGE30US`
- Housing starts: `HOUST`
- Consumer sentiment: `UMCSENT`

**API Endpoint:** `https://api.fred.stlouisfed.org/series`

**Series IDs:**
```
UNRATE          - US Unemployment Rate (national)
CPIAUCSL        - CPI (inflation proxy)
GDPC1           - Real GDP per Capita
MORTGAGE30US    - 30-Year Mortgage Rate
HOUST           - Housing Starts
UMCSENT         - University of Michigan Sentiment Index
```

**Note:** State-specific economic data limited; system uses national indicators as proxy

**Fallback Data:** Latest available data if API fails

---

### 4. data_enrichment_pipeline.py (450 lines)

**Purpose:** Master enrichment pipeline for all 50 states

**Class:** `DataEnrichmentPipeline`

**Key Methods:**

1. `__init__()` - Initializes API clients and S3 connection

2. `enrich_state_profile(state_code, state_name)` → `dict`
   - Fetches Census demographics
   - Fetches BLS employment data
   - Fetches FRED economic indicators
   - Merges with Supabase wealth data
   - Calculates derived metrics
   - Returns complete enriched profile

3. `enrich_all_states()` → `dict`
   - Iterates through all 50 states
   - Calls `enrich_state_profile()` for each
   - Saves to S3
   - Returns summary: {states_processed, states_successful, states_failed}

4. `save_state_profile_to_s3(profile, state_code)`
   - Saves to: `enriched-regional-data/state-profiles/{state_slug}/profile.json`
   - Splits into components:
     - demographics.json
     - employment.json
     - economics.json
     - wealth.json

5. `create_regional_aggregations()`
   - Groups 50 states into 5 regions (Northeast, Southeast, Midwest, Southwest, West)
   - Calculates mean, median, std for each metric
   - Saves to: `regional-comparisons/{region}.json`

6. `_calculate_derived_metrics(profile)` → `dict`
   - **inequality_index** = (wealth_gap / median_income) * 100
   - **economic_health_score** = weighted score (0-100)
     - 25% income
     - 25% unemployment
     - 25% education
     - 25% wealth_gap
   - **region_classification** = classify(health_score)

7. `_get_region(state_code)` → `str`
   - Maps state to region
   - Returns: "Northeast", "Southeast", "Midwest", "Southwest", or "West"

**Output Structure (Single State Profile):**
```json
{
  "identity": {"state_code": "CA", "state_name": "California", "region": "West"},
  "demographics": {...census data...},
  "employment": {...bls data...},
  "economics": {...fred data...},
  "wealth": {...supabase data...},
  "derived_metrics": {
    "inequality_index": 83.75,
    "economic_health_score": 72.3,
    "region_classification": "Prosperous"
  },
  "data_quality": {...metadata...}
}
```

**Regional Aggregation:**
```json
{
  "region": "West",
  "states": ["CA", "WA", "OR", "NV", "HI", "AK", "ID", "MT", "WY", "UT", "AZ", "CO", "NM"],
  "aggregations": {
    "avg_population": 7234567,
    "avg_inequality_index": 72.3,
    "avg_economic_health_score": 68.5,
    ...
  }
}
```

---

### 5. chatbot_learning_engine.py (500 lines)

**Purpose:** Generate training data and knowledge base for chatbot

**Class:** `ChatbotLearningEngine`

**Key Methods:**

1. `generate_regional_insights(state_profile)` → `list[str]`
   - Extracts 5-10 human-readable insights from profile
   - Examples:
     - "California has a population of 39.5M and is the most populous state"
     - "The median household income is $84,097, among the highest in the nation"
     - "With an inequality index of 83.75, California faces substantial wealth disparity"

2. `create_training_dataset()` → `list[dict]`
   - Generates ~100+ Q&A pairs per state
   - Total: ~5,000 training examples
   - Format:
     ```json
     {
       "query": "Tell me about California's wealth inequality",
       "answer": "California has high wealth inequality...",
       "state": "California",
       "region": "West",
       "metadata": {...}
     }
     ```

3. `create_correlation_patterns()` → `list[dict]`
   - Analyzes relationships across 50 states
   - Returns 5 major patterns:
     ```json
     {
       "pattern": "High education → Higher income → Lower inequality",
       "description": "States with high educational attainment tend to have higher incomes and lower wealth inequality",
       "confidence": 0.85,
       "examples": ["Massachusetts", "Connecticut", "Maryland"],
       "exceptions": ["Louisiana"]
     }
     ```

4. `create_few_shot_examples()` → `dict`
   - Creates examples by category:
     - **state_comparisons**: "Compare Massachusetts and Mississippi"
     - **wealth_inequality**: "Why is California so unequal?"
     - **economic_trends**: "How are manufacturing states doing?"

5. `generate_system_prompt_enhancement()` → `str`
   - Creates enhanced system prompt incorporating:
     - Learned economic patterns
     - Regional facts
     - Reasoning rules
     - Few-shot examples

6. `create_knowledge_base()` → `dict`
   - Comprehensive KB with:
     - regional_facts (Northeast, Southeast, Midwest, Southwest, West)
     - correlation_rules (5 patterns above)
     - few_shot_examples (all categories)
     - system_prompt (enhanced instruction)

7. `save_training_data_to_s3(training_data)`
   - Saves as regional-insights-{date}.jsonl (ML-ready)
   - Saves as regional-insights-{date}.json (human-readable)

8. `run_learning_pipeline()`
   - End-to-end learning:
     1. Generate insights
     2. Create training dataset
     3. Discover patterns
     4. Create examples
     5. Build knowledge base
     6. Save everything to S3

**Key Statistics:**
- Training examples: 5,000+
- Patterns discovered: 5
- Few-shot examples: 20+
- Regional facts: 25+
- Correlation rules: 50+

---

### 6. run_enrichment_pipeline.py (400 lines)

**Purpose:** Orchestrate full enrichment and learning pipeline

**Class:** `EnrichmentOrchestrator`

**Key Methods:**

1. `run_full_pipeline()` → `dict`
   - 3-stage execution:
     - Stage 1: `_run_enrichment()` - Fetch APIs, enrich states
     - Stage 2: `_run_aggregations()` - Regional groupings
     - Stage 3: `_run_learning()` - Fine-tune chatbot

2. `_run_enrichment()`
   - Calls `DataEnrichmentPipeline().enrich_all_states()`
   - Fetches Census, BLS, FRED for all 50 states
   - Saves enriched profiles to S3

3. `_run_aggregations()`
   - Calls `create_regional_aggregations()`
   - Groups states into 5 regions
   - Saves regional profiles to S3

4. `_run_learning()`
   - Calls `ChatbotLearningEngine().run_learning_pipeline()`
   - Generates training data
   - Creates knowledge base
   - Saves to S3

5. `run_incremental_update(states: list[str])`
   - Updates only specified states
   - Faster for monthly refreshes
   - Re-aggregates regions

6. `_print_summary()`
   - Prints execution results
   - Success/failure counts
   - Runtime statistics

**CLI Interface:**
```bash
# Full pipeline
python run_enrichment_pipeline.py --mode full

# Individual stages
python run_enrichment_pipeline.py --mode enrichment-only
python run_enrichment_pipeline.py --mode learning-only

# Incremental update
python run_enrichment_pipeline.py --mode incremental --states CA,TX,NY

# Skip warnings
python run_enrichment_pipeline.py --mode full --skip-api-keys-warning
```

**Execution Modes:**

1. **full** (10-15 min)
   - Enrichment (5-10 min) → Aggregations (2-3 min) → Learning (2-3 min)

2. **enrichment-only** (5-10 min)
   - Just fetch APIs and enrich states

3. **learning-only** (2-3 min)
   - Just generate training data (uses existing profiles)

4. **incremental** (2-3 min per 5 states)
   - Update specific states only

---

## Data Structures

### State Profile (Enriched)
```python
{
  "identity": {
    "state_code": str,           # "CA"
    "state_name": str,           # "California"
    "region": str,               # "West"
    "fips_code": str,            # "06"
    "timestamp": datetime         # When enriched
  },
  "demographics": {
    "population": int,           # 39538223
    "median_age": float,         # 36.8
    "median_household_income": int,  # 84097
    "education_bachelor_and_above": float,  # 35.2
    "poverty_rate": float,       # 12.5
    "race_distribution": {
      "white_percent": float,
      "hispanic_percent": float,
      "asian_percent": float,
      "black_percent": float
    }
  },
  "employment": {
    "unemployment_rate": float,  # 3.8
    "unemployment_data": {
      "2023-01": {"rate": 4.5},
      "2023-02": {"rate": 4.3}
    },
    "top_industries": [
      {"industry": str, "employment": int},
      ...
    ]
  },
  "economics": {
    "unemployment_rate": float,
    "inflation": float,
    "gdp_per_capita": int,
    "mortgage_30year": float,
    "housing_starts": int,
    "consumer_sentiment": float
  },
  "wealth": {
    "top_1_percent_networth": int,
    "bottom_50_percent_networth": int,
    "gini_coefficient": float,
    "wealth_gap": int
  },
  "derived_metrics": {
    "inequality_index": float,  # 0-100
    "economic_health_score": float,  # 0-100
    "region_classification": str,  # "Prosperous", "Healthy", etc.
    "income_education_ratio": float
  },
  "data_quality": {
    "data_sources": [str],
    "missing_fields": [str],
    "last_updated": datetime
  }
}
```

### Training Data (Q&A Pair)
```json
{
  "query": "Tell me about California's economy",
  "answer": "California is...",
  "state": "California",
  "region": "West",
  "metadata": {
    "category": "state_overview",
    "classification": "Prosperous",
    "inequality_index": 83.75,
    "health_score": 72.3
  }
}
```

### Correlation Pattern
```json
{
  "pattern": "High education → Higher income → Lower inequality",
  "description": "States with high educational attainment...",
  "confidence": 0.85,
  "examples": ["Massachusetts", "Connecticut", "Maryland"],
  "exceptions": ["Louisiana"],
  "reasoning": "Education provides better job opportunities..."
}
```

---

## S3 Storage Layout

```
s3://mindthegap-gov-data/
│
├── enriched-regional-data/
│   ├── state-profiles/
│   │   ├── alabama/
│   │   │   ├── profile.json
│   │   │   ├── demographics.json
│   │   │   ├── employment.json
│   │   │   ├── economics.json
│   │   │   ├── wealth.json
│   │   │   └── trends.json
│   │   ├── alaska/
│   │   └── ... (50 states)
│   │
│   └── regional-comparisons/
│       ├── northeast.json
│       ├── southeast.json
│       ├── midwest.json
│       ├── southwest.json
│       └── west.json
│
├── chatbot-training-data/
│   ├── regional-insights-2026-02-12.jsonl
│   ├── regional-insights-2026-02-12.json
│   ├── economic-correlations.json
│   └── knowledge-base.json
│
└── data-pipeline-logs/
    ├── enrichment-summary-2026-02-12-14-30-00.json
    └── ...
```

---

## Integration Points

### 1. FastAPI Backend (main.py)
```python
# Load knowledge base
knowledge_base = load_knowledge_base_from_s3()

# Build enhanced prompt
system_prompt = SYSTEM_PROMPT + generate_regional_context()

# Call ChatGPT with enriched context
response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "system", "content": system_prompt}, ...]
)
```

### 2. State Lookup Endpoint
```python
@app.get("/api/enriched-state/{state}")
async def get_enriched_state(state: str):
    # Get state profile from S3
    # Return demographics, employment, economics, wealth data
```

### 3. Regional Comparison Endpoint
```python
@app.get("/api/compare-states")
async def compare_states(state1: str, state2: str):
    # Get both state profiles
    # Calculate differences
    # Return comparison metrics
```

### 4. React Frontend
```jsx
// Display enriched state data
<StateProfile state={enrichedData} />

// Compare states
<StateComparison state1={CA} state2={TX} />

// Show regional facts
<RegionalFacts region="West" />
```

---

## Performance Characteristics

### Execution Time
| Operation | Time | States |
|-----------|------|--------|
| Single state enrichment | 30-50s | 1 |
| All states enrichment | 5-10 min | 50 |
| Regional aggregations | 2-3 min | 5 |
| Chatbot learning | 2-3 min | All |
| **Full pipeline** | **10-15 min** | **50** |
| Incremental update | 2-3 min | 5-10 |

### Storage Size
| Data | Size | Files |
|------|------|-------|
| State profiles | 15-20 MB | 300 |
| Regional data | 1-2 MB | 5 |
| Training data (JSON) | 20-30 MB | 2 |
| Training data (JSONL) | 25-35 MB | 1 |
| **Total** | **~60-90 MB** | **300+** |

### API Costs
| API | Cost | Limit |
|-----|------|-------|
| Census | Free | Unlimited |
| BLS | Free | 120 req/min |
| FRED | Free | 120 req/min |
| S3 Storage | ~$0.05/mo | Unlimited |
| **Total Monthly** | **Free** | - |

---

## Error Handling & Fallbacks

### API Failures
- Census API unavailable → Use mock data (default state demographics)
- BLS API unavailable → Use mock data (default unemployment %)
- FRED API unavailable → Use mock data (default economic metrics)

### S3 Failures
- Cannot save to S3 → Print error, continue with next state
- Cannot load from S3 → Return empty knowledge base, use basic system prompt

### Data Quality
- Missing fields → Marked in data_quality section
- Invalid data → Logged, default values used
- Partial enrichment → Save what's available, mark gaps

---

## Monitoring & Logging

### Log Files
- `enrichment_pipeline.log` - Main enrichment logs
- `enrichment-summary-{timestamp}.json` - Execution summary

### Metrics Tracked
- States processed / successful / failed
- API response times
- S3 upload status
- Training data generation metrics

### Health Checks
```python
# Check if knowledge base loaded
GET /api/chatbot-knowledge-base → Returns metadata

# Check enriched data availability
GET /api/enriched-states → Returns state list with timestamps

# Check last enrichment run
GET /api/last-enrichment → Returns summary
```

---

## Future Enhancements

1. **County-level enrichment** (3,000+ counties)
2. **Metro area analysis** (top 50 MSAs)
3. **Real-time economic alerts**
4. **Predictive models** on wealth trends
5. **Historical snapshots** for time-series analysis
6. **Custom comparisons** (user-selected states/metrics)
7. **Interactive dashboards** with enriched data
8. **API for external use** (economists, researchers)

---

**Version:** 1.0
**Last Updated:** February 12, 2026
**Status:** Production Ready
