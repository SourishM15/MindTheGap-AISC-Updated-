# Regional Data Enrichment & Chatbot Learning Guide

## Overview

This system enriches the MindTheGap wealth inequality dashboard with real government data from three major US data sources:

1. **Census Bureau** - Demographics, income, education
2. **Bureau of Labor Statistics** - Employment, unemployment, wages
3. **Federal Reserve** - Economic indicators, GDP, inflation

The enriched data is:
- Organized by state and region in S3
- Used to fine-tune chatbot embeddings
- Transformed into training data for improved responses
- Stored in a knowledge base for enhanced context

## Architecture

```
Government APIs (Census, BLS, FRED)
          ↓
   API Client Modules
   (census_api_client.py, etc.)
          ↓
   Data Enrichment Pipeline
   (data_enrichment_pipeline.py)
          ↓
AWS S3: enriched-regional-data/
   • state-profiles/ (50 states)
   • regional-comparisons/
   • metro-areas/ (optional)
          ↓
   Chatbot Learning Engine
   (chatbot_learning_engine.py)
          ↓
AWS S3: chatbot-training-data/
   • regional-insights.jsonl
   • economic-correlations.json
   • knowledge-base.json
          ↓
    Updated FastAPI Backend
    (main.py with enhanced responses)
```

## Setup: Getting API Keys

### 1. Census Bureau API Key
- Go to: https://api.census.gov/data/key_signup.html
- Sign up with your email
- Copy the API key
- Add to `.env`: `CENSUS_API_KEY=your_key_here`

### 2. Bureau of Labor Statistics API Key
- Go to: https://www.bls.gov/developers/home.htm
- Register for API access
- Copy the API key
- Add to `.env`: `BLS_API_KEY=your_key_here`

### 3. FRED API Key
- Go to: https://fred.stlouisfed.org/docs/api/
- Register and get API key
- Add to `.env`: `FRED_API_KEY=your_key_here`

### Example .env file:
```
OPENAI_API_KEY=sk-proj-...
SUPABASE_URL=https://...
SUPABASE_KEY=sb_...
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-2

# Government API Keys
CENSUS_API_KEY=your_census_key_here
BLS_API_KEY=your_bls_key_here
FRED_API_KEY=your_fred_key_here
```

## Running the Pipeline

### Full Pipeline (All Stages)
```bash
cd src/backend
python run_enrichment_pipeline.py --mode full
```

This runs:
1. **Enrichment** - Fetches government data for all 50 states
2. **Aggregations** - Creates regional groupings
3. **Learning** - Fine-tunes chatbot on enriched data

### Enrichment Only
```bash
python run_enrichment_pipeline.py --mode enrichment-only
```

Fetches Census, BLS, and FRED data → Stores in S3

### Learning Only
```bash
python run_enrichment_pipeline.py --mode learning-only
```

Creates training data → Knowledge base → Chatbot enhancement

### Incremental Update
```bash
python run_enrichment_pipeline.py --mode incremental --states CA TX NY FL
```

Update specific states faster (useful for monthly refreshes)

### Skip API Key Warnings
```bash
python run_enrichment_pipeline.py --mode full --skip-api-keys-warning
```

If you don't have API keys, the system uses default data structures.

## Output: S3 Storage Organization

### Enriched Regional Data
```
s3://mindthegap-gov-data/enriched-regional-data/

state-profiles/
├── alabama/
│   ├── profile.json           # Complete enriched profile
│   ├── demographics.json      # Census data
│   ├── employment.json        # BLS data
│   ├── economics.json         # FRED data
│   └── wealth.json            # Supabase wealth data
├── alaska/
├── arizona/
└── ... (50 states total)

regional-comparisons/
├── northeast.json             # Aggregated Northeast data
├── southeast.json
├── midwest.json
├── southwest.json
└── west.json
```

### Chatbot Training Data
```
s3://mindthegap-gov-data/chatbot-training-data/

regional-insights-2026-02-12.jsonl    # Q&A pairs for fine-tuning
regional-insights-2026-02-12.json     # Same, readable JSON
economic-correlations.json             # Learned patterns
knowledge-base.json                    # Complete knowledge base
```

## State Profile Structure

Each state profile contains:

```json
{
  "identity": {
    "state_code": "CA",
    "state_name": "California",
    "region": "West",
    "fips_code": "06"
  },
  "demographics": {
    "population": 39538223,
    "median_age": 36.8,
    "median_household_income": 84097,
    "education_bachelor_and_above": 35.2,
    "poverty_rate": 12.5,
    "race_distribution": {
      "white_percent": 46.2,
      "hispanic_percent": 39.1,
      "asian_percent": 15.5,
      "black_percent": 5.4
    }
  },
  "employment": {
    "unemployment_data": {
      "2023-01": {"rate": 4.5},
      "2023-02": {"rate": 4.3},
      // ... monthly data
    },
    "top_industries": [
      {"industry": "Technology", ...},
      {"industry": "Entertainment", ...}
    ]
  },
  "economics": {
    "indicators": {
      "unemployment_rate": {...},
      "inflation_proxy": {...},
      "gdp_per_capita": {...}
    }
  },
  "wealth": {
    "top_1_percent_networth": 8500000,
    "bottom_50_percent_networth": 125000,
    "gini_coefficient": 0.49,
    "wealth_gap": 8375000
  },
  "derived_metrics": {
    "inequality_index": 83.75,
    "economic_health_score": 72.3,
    "region_classification": "Prosperous",
    "income_education_ratio": 2.39
  }
}
```

## Chatbot Training Data Format

### Q&A Pairs (regional-insights.jsonl)
```json
{
  "query": "Tell me about California",
  "answer": "California is a large population state...",
  "state": "California",
  "region": "West",
  "metadata": {
    "classification": "Prosperous",
    "inequality_index": 83.75
  }
}
```

### Economic Correlations
```json
{
  "pattern": "High education → Higher income → Lower inequality",
  "description": "States with high educational attainment tend to have higher incomes and lower wealth inequality",
  "confidence": 0.85,
  "examples": ["Massachusetts", "Connecticut", "Maryland"]
}
```

### Few-Shot Examples
```json
{
  "query": "How do Massachusetts and Mississippi compare?",
  "response": "Massachusetts has a median household income of ~$87,000... Mississippi has ~$52,000... The difference reflects their distinct education levels..."
}
```

## Using Enriched Data in Chatbot

### Querying Regional Data
```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Tell me about wealth inequality in California",
    "conversation_history": []
  }'
```

Response will now include enriched government data:
- Population and demographics
- Employment statistics
- Economic indicators
- Comparative analysis with other states

### Updated Endpoints
```
GET /api/enriched-states           # List all enriched states
GET /api/enriched-states/{state}   # Get full state profile
GET /api/enriched-regions/{region} # Get regional aggregation
GET /api/chatbot-knowledge-base    # Get chatbot training knowledge
```

## Monitoring & Logging

### Pipeline Logs
```bash
tail -f enrichment_pipeline.log
```

### S3 Execution Summaries
```
s3://mindthegap-gov-data/data-pipeline-logs/
└── enrichment-summary-2026-02-12-14-30-00.json
```

### Example Summary
```json
{
  "states_processed": 50,
  "states_successful": 48,
  "states_failed": 2,
  "timestamp": "2026-02-12T14:30:00",
  "summary": {
    "CA": {"status": "success", "classification": "Prosperous"},
    "NY": {"status": "success", "classification": "Prosperous"},
    ...
  }
}
```

## Regional Classifications

States are classified based on economic health scores:

- **Prosperous** (75+): High income, high education, low inequality
  - Examples: Massachusetts, Connecticut, Maryland, California
  
- **Healthy** (60-75): Stable economy, balanced metrics
  - Examples: Virginia, Texas, Minnesota, Ohio
  
- **Strained** (40-60): Economic challenges, mixed indicators
  - Examples: Louisiana, Kentucky, South Carolina
  
- **Distressed** (<40): Multiple economic challenges
  - Examples: Mississippi, West Virginia, Puerto Rico

## Chatbot Learning Capabilities

After running the pipeline, the chatbot can:

1. **Answer state-specific questions**
   - "What's the unemployment rate in Texas?"
   - "How educated is the population in Massachusetts?"

2. **Compare regions**
   - "How does the West compare to the Northeast?"
   - "Which states have the highest inequality?"

3. **Explain patterns**
   - "Why do tech states have lower inequality?"
   - "How does education affect wealth?"

4. **Provide context**
   - "What economic factors explain California's wealth gap?"
   - "How do employment patterns affect inequality?"

## Performance & Cost

### Execution Time
- Full pipeline (50 states): ~10-15 minutes
- Enrichment only: ~5-10 minutes
- Learning only: ~2-3 minutes
- Incremental update (5 states): ~2-3 minutes

### AWS Costs
- S3 Storage: ~$0.05/month (negligible for current data)
- API Calls: Free (within tier limits)
  - Census: Unlimited free
  - BLS: Unlimited free with registered key
  - FRED: Unlimited free

### API Rate Limits
- Census: Reasonable limits, no documented cap
- BLS: 120 requests per minute
- FRED: 120 requests per minute

## Troubleshooting

### API Keys Not Working
```bash
# Verify API key configuration
python -c "import os; from dotenv import load_dotenv; load_dotenv(); print('Census:', bool(os.getenv('CENSUS_API_KEY')))"
```

### S3 Upload Failures
```bash
# Check S3 bucket access
aws s3 ls s3://mindthegap-gov-data --region us-east-2
```

### Missing Dependencies
```bash
pip install -r requirements.txt
pip install requests httpx census
```

### Partial Pipeline Failure
```bash
# Check log file for specific states
grep "failed\|error" enrichment_pipeline.log

# Re-run with incremental mode
python run_enrichment_pipeline.py --mode incremental --states [failed_states]
```

## Advanced: Custom Enrichment

### Fetch single state data:
```python
from census_api_client import CensusAPIClient, STATE_FIPS

census = CensusAPIClient()
ca_data = census.get_state_demographics(STATE_FIPS['CA'])
print(ca_data)
```

### Create custom profile:
```python
from data_enrichment_pipeline import DataEnrichmentPipeline

pipeline = DataEnrichmentPipeline()
profile = pipeline.enrich_state_profile('CA', 'California')
pipeline.save_state_profile_to_s3(profile, 'CA')
```

### Fine-tune for specific states:
```python
from chatbot_learning_engine import ChatbotLearningEngine

engine = ChatbotLearningEngine()
data = engine.create_training_dataset()
# Filter by state and save custom dataset
filtered = [d for d in data if d['state'] in ['CA', 'TX', 'NY']]
engine.save_training_data_to_s3(filtered)
```

## Next Steps

1. **Get API Keys** - Sign up for free accounts
2. **Run Full Pipeline** - Enrich all 50 states
3. **Monitor Learning** - Check chatbot improvements
4. **Schedule Updates** - Set up monthly refreshes
5. **Custom Analysis** - Build state comparisons

## Support & Resources

- Census API Docs: https://api.census.gov/
- BLS API Docs: https://www.bls.gov/developers/
- FRED Docs: https://fred.stlouisfed.org/docs/api/
- AWS S3 Guide: https://docs.aws.amazon.com/s3/

---

**Last Updated**: February 12, 2026
**Pipeline Version**: 1.0
**Status**: Ready to deploy
