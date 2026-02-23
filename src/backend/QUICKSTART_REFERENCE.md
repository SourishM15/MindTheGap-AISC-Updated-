# ⚡ Quick Reference: Using Your Enhanced Backend

## 🎯 Common Tasks

### 1. Ask the Chatbot About Wealth Disparity
```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is the wealth gap between the top 1% and bottom 50%?",
    "include_trends": true,
    "include_recommendations": true
  }'

Response:
{
  "response": "...[generated response]...",
  "sources": ["supabase:wealth_distribution", "supabase:trends"],
  "recommendations": [
    {"title": "Progressive taxation", "expected_impact": "15% Gini reduction"},
    ...
  ]
}
```

### 2. Get Trend Analysis
```bash
curl -X GET "http://localhost:8000/api/trends?metric=wealth_inequality&period=monthly"

Response:
{
  "metric": "wealth_inequality",
  "cagr": "2.3%",
  "trend": "increasing",
  "forecast": {"next_quarter": "2.5%, next_year": "2.8%"},
  "inflection_points": ["2008 financial crisis", "2020 pandemic"]
}
```

### 3. Get Policy Recommendations
```bash
curl -X POST http://localhost:8000/api/policy-recommendations \
  -H "Content-Type: application/json" \
  -d '{
    "gini_coefficient": 0.48,
    "unemployment_rate": 4.2,
    "top_1_percent_share": 32.5
  }'

Response:
{
  "recommendations": [
    {
      "title": "Strengthen Earned Income Tax Credit",
      "category": "tax_policy",
      "expected_impact": "5-8% Gini reduction",
      "implementation_difficulty": "medium",
      "success_metrics": ["increased disposable income", "higher employment rate"]
    },
    ...
  ]
}
```

### 4. Query Wealth Data Directly
```bash
# Get top 1% wealth data (last 10 years)
curl "http://localhost:8000/api/wealth-data?category=Top%201%25&limit=100"

Response:
{
  "count": 40,
  "data": [
    {
      "date": "2023-12-31",
      "category": "Top 1%",
      "net_worth": 2850000,
      "income": 385000,
      "assets": 3200000,
      "liabilities": 350000
    },
    ...
  ]
}
```

### 5. Get Demographic Analysis
```bash
# Compare wealth by race
curl "http://localhost:8000/api/demographics?demographic_type=race&group=Black"

Response:
{
  "type": "race", 
  "group": "Black",
  "data": [
    {
      "date": "2023",
      "median_wealth": 18500,
      "median_income": 45000,
      "poverty_rate": 19.5
    }
  ]
}
```

### 6. Get State Economic Indicators
```bash
# Washington state indicators
curl "http://localhost:8000/api/economic-indicators/WA"

Response:
{
  "state": "WA",
  "recent_data": {
    "unemployment_rate": 4.1,
    "labor_force_participation": 62.3,
    "median_household_income": 78500,
    "poverty_rate": 9.2,
    "gini_coefficient": 0.47
  }
}
```

### 7. Ask About a Specific State
```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Tell me about California","conversation_history":[]}'

Response:
{
  "reply": "California is a diverse state with a population of over 39 million people...",
  "source": "enriched_analysis",
  "location": "California",
  "query_type": "state_analysis"
}
```

### 8. Ask About a Major US Metro Area
```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What is the economy like in Seattle?","conversation_history":[]}'

Response:
{
  "reply": "Seattle is a vibrant metro area with strong demographics...",
  "source": "city_metro_data_s3",
  "city": "Seattle",
  "metro_area": "Seattle",
  "query_type": "city_analysis"
}
```

### 9. List Available States & Metro Areas
```bash
# Get all 50 states with enriched data
curl http://localhost:8000/api/enriched-states | jq '.states | length'
# Output: 50

# Get all 20 major metro areas with enriched data
curl http://localhost:8000/api/enriched-metro-areas | jq '.metros'
# Output: ["atlanta", "austin", "boston", "chicago", ..., "seattle", "washington"]
```

---

## 🗺️ Supported Cities & States

### 20 Major Metro Areas (S3-Cached)
Austin, Boston, Chicago, Dallas, Denver, Houston, Jacksonville, Los Angeles, Miami, Minneapolis, New York, Philadelphia, Phoenix, Portland, San Antonio, San Diego, San Jose, Seattle, Washington DC

### All 50 US States (S3-Cached)
Enriched government data available for all states with Census Bureau, BLS, and Federal Reserve data.

---

## 💾 How Data Caching Works

### State Profiles (Fast - S3 Cached)
- **Source**: Enriched profiles in S3
- **Data**: Census Bureau, BLS, Federal Reserve
- **Speed**: < 100ms (cached in S3)
- **Endpoint**: Load from `/enriched-regional-data/state-profiles/{state-slug}/profile.json`

### Metro Area Profiles (Fast - S3 Cached)  
- **Source**: Enriched profiles in S3
- **Data**: Census Bureau ACS, BLS LAUS
- **Speed**: < 100ms (cached in S3)
- **Endpoint**: Load from `/enriched-regional-data/metro-areas/{metro-slug}/profile.json`

### Chat Responses
- State/metro questions: Load profile from S3 → Pass to LLM → Natural response
- General questions: Semantic search + context → LLM response
- Casual conversation: Direct LLM response

---

## 🔧 Setup & Configuration

### First Time Setup (5 Minutes)
```bash
# 1. Clone the repo
git clone <repo-url>
cd MindTheGap-AISC

# 2. Create Supabase account
# → https://supabase.com
# → Create project
# → Copy SUPABASE_URL and SUPABASE_KEY

# 3. Set environment variables
cp .env.example .env
# Edit .env with your Supabase credentials:
# SUPABASE_URL=https://xxx.supabase.co
# SUPABASE_KEY=eyJhbGc...

# 4. Set up database
# → Open Supabase SQL Editor
# → Copy-paste SQL from SUPABASE_SETUP.md
# → Execute all statements

# 5. Install dependencies
cd src/backend
pip install -r requirements.txt

# 6. Migrate data (CSV → Supabase)
python migrate_to_supabase.py
# Output: "✅ Migration verified successfully!"

# 7. Start backend
python main.py
# Output: "Uvicorn running on http://127.0.0.1:8000"

# 8. Test it!
curl http://localhost:8000/api/health
# Response: {"status": "ok", "using_supabase": true}
```

### Environment Variables
```bash
# Required
SUPABASE_URL=https://project.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIs...  # from Supabase dashboard
OPENAI_API_KEY=sk-...                   # from OpenAI platform

# Optional (for government data sync)
CENSUS_API_KEY=...                      # from census.gov
BLS_API_KEY=...                         # from bls.gov
FRED_API_KEY=...                        # from stlouisfed.org
EXA_API_KEY=...                         # from exa.ai
```

---

## 🗄️ Data Management

### Update Data Manually
```bash
# Sync latest government data
curl -X POST http://localhost:8000/api/admin/sync-government-data

# Or from Python:
from src.backend.sync_government_data import sync_all
if sync_all():
    print("✅ Government data synced!")
```

### Back Up Your Data
```bash
# Backup to CSV (Supabase → CSV)
from src.backend.supabase_db import get_db
db = get_db()
wealth_data = db.get_wealth_data(limit=10000)
# Save to CSV...

# Or use Supabase UI:
# → Database → wealth_distribution → Download
```

### Monitor Data Quality
```bash
# Check data freshness
from src.backend.supabase_db import get_db
db = get_db()
stats = db.get_statistics("wealth_distribution")
print(f"Latest date: {stats['max_date']}")
print(f"Records: {stats['count']}")
```

---

## 🧠 Backend Architecture (Mental Model)

```
┌─────────────────────────────────────────┐
│         FastAPI (main.py)               │
│  Handles HTTP requests & routing        │
└────────────────┬────────────────────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
    ▼            ▼            ▼
┌─────────┐  ┌────────┐  ┌───────────┐
│ Graph   │  │Vector  │  │Supabase   │
│ RAG     │  │Search  │  │Database   │
│(chat)   │  │(embeddings)│(data)   │
└─────────┘  └────────┘  └───────────┘
    │            │            │
    └────────────┼────────────┘
                 │
                 ▼
        ┌─────────────────┐
        │ LLM (GPT-3.5)   │
        │ (OpenAI API)    │
        └─────────────────┘
```

### Key Modules
| Module | Purpose | Input | Output |
|--------|---------|-------|--------|
| `graph_rag.py` | Chat & retrieval | User question | LLM response |
| `vector_embeddings.py` | Semantic search | Query text | Similar records |
| `supabase_db.py` | Database operations | SQL-like queries | Records from DB |
| `government_api.py` | Government data | API calls | Structured data |
| `trend_analysis.py` | Trend detection | Time series | CAGR, forecasts |
| `policy_recommendations.py` | Policy engine | Economic indicators | Policy suggestions |

---

## 🚨 Common Issues & Solutions

### "Connection refused" / "Database unavailable"
```
Problem: Supabase credentials wrong or service down
Solution:
1. Check .env file has SUPABASE_URL and SUPABASE_KEY
2. Verify credentials in Supabase dashboard
3. Check backend logs for errors
4. System will fall back to CSV automatically
```

### "No data found"
```
Problem: Migration not run yet
Solution:
1. Verify CSV files exist in src/data/
2. Run: python migrate_to_supabase.py
3. Check Supabase dashboard shows data in tables
```

### "Query too slow"
```
Problem: Missing indexes or unoptimized query
Solution:
1. Check indexes exist: SUPABASE_SETUP.md has SQL
2. Use EXPLAIN to analyze query
3. Cache results (automatic after first query)
4. Contact support if persistent
```

### "Rate limited - too many requests"
```
Problem: Hitting API limits
Solution:
1. Check Supabase plan (free tier: 2GB/month bandwidth)
2. Implement caching (cache_manager.py)
3. Batch requests when possible
4. Upgrade Supabase plan if needed
```

---

## 📊 API Endpoints Reference

### Chat & Analysis
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/chat` | Ask question about wealth |
| GET | `/api/trends` | Get trend analysis |
| POST | `/api/policy-recommendations` | Get suggested policies |
| POST | `/api/search` | Full-text search |

### Data Access
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/wealth-data` | Query wealth data |
| GET | `/api/demographics` | Get demographic data |
| GET | `/api/economic-indicators/{state}` | State indicators |
| POST | `/api/admin/sync-government-data` | Manual data sync |

### System
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/health` | Check system status |
| GET | `/docs` | Swagger UI documentation |
| GET | `/openapi.json` | OpenAPI schema |

---

## 🔍 Debugging Tips

### Enable Debug Logging
```python
# In main.py, set:
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Check Database Connection
```python
from src.backend.supabase_db import get_db
db = get_db()
if db.client:
    print("✅ Connected to Supabase")
else:
    print("❌ Using CSV fallback")
```

### Test a Single Function
```python
from src.backend.supabase_db import get_db

db = get_db()
data = db.get_wealth_data(category="Top 1%", limit=5)
print(data)
```

### View Supabase Data
```bash
# Open browser:
https://app.supabase.com

# → Select project
# → Database
# → wealth_distribution (or other table)
# → View all data
```

---

## 📈 Performance Tips

### For Faster Queries
1. Add filters (category, date range)
2. Use pagination (limit, offset)
3. Cache results locally
4. Use indexes (automatic)

### Example: Optimized Query
```python
# Slow (unfiltered)
data = db.get_wealth_data(limit=10000)  # All data

# Fast (filtered)
data = db.get_wealth_data(
    category="Top 1%",
    date_range=("2020-01-01", "2023-12-31"),
    limit=100
)  # Only what you need
```

### Monitor Performance
```python
import time
start = time.time()
data = db.get_wealth_data()
elapsed = time.time() - start
print(f"Query took {elapsed:.2f}s")
```

---

## 📖 Learn More

| Topic | Resource |
|-------|----------|
| Database Setup | [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) |
| Migration Guide | [CSV_TO_SUPABASE.md](./CSV_TO_SUPABASE.md) |
| Full Architecture | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Modernization | [DATABASE_MODERNIZATION.md](./DATABASE_MODERNIZATION.md) |
| Enhancement Details | [BACKEND_ENHANCEMENTS.md](./BACKEND_ENHANCEMENTS.md) |

---

## ✅ Troubleshooting Checklist

| Issue | Check | Solution |
|-------|-------|----------|
| API won't start | Port 8000 available | `lsof -i :8000` to find process |
| Database errors | .env file correct | Copy exact values from Supabase |
| No data in DB | CSV files exist | Check `src/data/` folder |
| Slow responses | Query indexed | Check SUPABASE_SETUP.md indexes |
| Cache not working | cache_manager.py | Check disk space in src/cache/ |
| Government API fails | API keys set | Get keys from respective agencies |

---

**Ready to use!** Start with task #1 (Ask Chatbot) and explore from there.

For detailed docs, see [ARCHITECTURE.md](./ARCHITECTURE.md) or [DATABASE_MODERNIZATION.md](./DATABASE_MODERNIZATION.md).
