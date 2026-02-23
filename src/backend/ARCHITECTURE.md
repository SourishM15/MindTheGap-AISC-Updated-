# 🏗️ MindTheGap Backend Architecture (v2.0+)

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                          │
│          Dashboard • Chat • Map • Analytics                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    HTTP/REST │ WebSocket
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                     FastAPI Backend (main.py)                    │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  API Endpoints                                           │  │
│  │  • /api/chat - RAG-powered chatbot                       │  │
│  │  • /api/trends - Trend analysis                          │  │
│  │  • /api/policy-recommendations - Policy engine          │  │
│  │  • /api/wealth-data - Direct DB queries                 │  │
│  │  • /api/demographics - Demographic data                 │  │
│  │  • /api/economic-indicators/* - State indicators        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             │                                    │
│  ┌──────────────────────────┼──────────────────────────────────┐ │
│  │                          │                                  │ │
│  ▼                          ▼                        ┌──────────┼─┤ │
│ ┌─────────────────┐  ┌──────────────────┐  │  Caching  │ │ │
│ │ Graph RAG       │  │ Vector           │  │  Layer    │ │ │
│ │ Pipeline        │  │ Embeddings       │  │ (cache_   │ │ │
│ │ (graph_rag.py)  │  │ (vector_         │  │  manager) │ │ │
│ │                 │  │ embeddings.py)   │  │           │ │ │
│ └────────┬────────┘  └────────┬─────────┘  └─────┬──────┼─┘ │
│          │                    │                   │      │    │
└──────────┼────────────────────┼───────────────────┼──────┼────┘
           │                    │                   │      │
      ┌────▼────────────────────▼───────────────────▼──────▼────┐
      │              Supabase PostgreSQL Database               │
      │                                                         │
      │  Tables:                                                │
      │  • wealth_distribution                                  │
      │  • demographics                                         │
      │  • economic_indicators                                  │
      │  • policy_recommendations                               │
      │  • trend_cache                                          │
      │  • audit_log                                            │
      │                                                         │
      │  Features:                                              │
      │  ✓ Real-time subscriptions                              │
      │  ✓ Full-text search                                     │
      │  ✓ Row-level security                                   │
      │  ✓ Automatic backups                                    │
      │                                                         │
      └──────────┬──────────────────┬──────────────────┬────────┘
                 │                  │                  │
      ┌──────────▼────┐  ┌──────────▼────┐  ┌────────▼────────┐
      │ Fallback:     │  │ Government    │  │ Data             │
      │ CSV Files     │  │ APIs          │  │ Migrations       │
      │ (if DB fail)  │  │ (sync_        │  │ (migrate_        │
      │               │  │  government_  │  │  to_supabase.py) │
      │ • DFA data    │  │  data.py)     │  │                  │
      │ • Levels CSVs │  │               │  │ • One-time       │
      │ • Shares CSVs │  │ • Census API  │  │ • Batch insert   │
      │               │  │ • BLS API     │  │ • Verification   │
      └───────────────┘  │ • FRED API    │  └──────────────────┘
                         └───────────────┘
```

---

## 📊 Data Flow

### Cold Start (1st Query)
```
1. main.py starts
2. Tries Supabase connection
   ├─ Success? Load 10K records → use Supabase ✅
   └─ Failure? Load CSV files → use fallback ⚠️
3. Initialize vector store with embeddings
4. Create network graph from records
5. Ready for queries!
```

### Chat Query Flow
```
User Question
    ↓
/api/chat endpoint
    ↓
extract_entities()
    ├─ Intent detection (trend/policy/comparison)
    ├─ Entity extraction (wealth groups, demographics, locations)
    └─ Query understanding
         ↓
    search_graph() [Hybrid search]
         ├─ Keyword matching (fast)
         └─ Semantic search (embeddings)
         ↓
    get_graph_rag_context()
         ├─ Fetch relevant nodes
         ├─ Query government APIs if needed
         ├─ Trend analysis if requested
         ├─ Policy recommendations if applicable
         └─ Format context string
         ↓
    LLM Chain
         ├─ (Prompt | GPT-3.5)
         └─ Generate response
         ↓
    Return formatted answer to user
```

### Trend Analysis Flow
```
POST /api/trends
    ↓
get_db().get_wealth_data()
    └─ Query Supabase table
    ├─ Filter by category/date
    └─ Return time-series data
         ↓
    TrendAnalyzer.trend_analysis()
    ├─ Calculate CAGR
    ├─ Linear regression analysis
    ├─ Identify inflection points
    ├─ Generate forecasts
    └─ Return analysis
         ↓
    Cache results (24h TTL)
         ↓
    Return to frontend
```

### Policy Recommendation Flow
```
POST /api/policy-recommendations
    ↓
Extract economic indicators from request
    ├─ Gini coefficient
    ├─ Unemployment rate  
    ├─ Poverty rate
    └─ Top/bottom wealth share
         ↓
    PolicyRecommendationEngine
    ├─ Score each policy
    └─ Rank by relevance
         ↓
    Return top 5 with details:
    ├─ Expected impact
    ├─ Historical examples
    ├─ Implementation difficulty
    ├─ Success metrics
    └─ Next steps
```

---

## 🗂️ File Organization

```
src/backend/
├── main.py                          # FastAPI app + endpoints
├── graph_rag.py                     # Enhanced RAG pipeline
├── vector_embeddings.py             # Semantic search
├── supabase_db.py                   # Database client
├── government_api.py                # Census/BLS/FRED integration
├── trend_analysis.py                # Trend analytics engine
├── policy_recommendations.py        # Policy engine
├── cache_manager.py                 # Caching layer
├── web_search.py                    # Web search (Exa)
├── enrich_data.py                   # Data enrichment
│
├── migrate_to_supabase.py           # CSV → Supabase migration
├── sync_government_data.py          # Automated govt sync
│
├── requirements.txt                 # Python dependencies
│
├── SUPABASE_SETUP.md               # Database setup guide
├── QUICKSTART.md                    # Quick start (5 min)
├── CSV_TO_SUPABASE.md              # Migration guide
├── BACKEND_ENHANCEMENTS.md         # Feature overview
├── DATABASE_MODERNIZATION.md       # This file
│
└── .env                            # Secrets (not in git)
    ├── OPENAI_API_KEY
    ├── SUPABASE_URL
    ├── SUPABASE_KEY
    ├── CENSUS_API_KEY
    ├── BLS_API_KEY
    ├── FRED_API_KEY
    └── EXA_API_KEY
```

---

## 🔌 API Layer Architecture

### Request Handling
```
HTTP Request
    ↓
    ├─ Authentication (if needed)
    ├─ Rate limiting check
    ├─ Input validation (Pydantic)
    ├─ CORS check
    ↓
Route Handler
    ├─ Parse request body
    ├─ Call business logic
    ├─ Error handling
    ├─ Response formatting
    ↓
Return Response (JSON)
    └─ 200 OK / 500 Error / etc
```

### Response Format
```json
{
  "status": "success",
  "data": {...},
  "metadata": {
    "timestamp": "2024-02-11T10:30:00Z",
    "source": "supabase:wealth_distribution",
    "cached": false,
    "execution_time_ms": 234
  }
}
```

---

## 💾 Data Layer Architecture

### Supabase Tables

```sql
-- Core Data
wealth_distribution
├─ id (Primary Key)
├─ data_type (indexed)
├─ category (indexed)
├─ date (indexed)
├─ net_worth
├─ income
├─ assets
├─ liabilities
└─ created_at

demographics
├─ id
├─ type (race, age, education)
├─ group_name
├─ date
├─ location
├─ median_income
├─ median_wealth
├─ poverty_rate
└─ created_at

economic_indicators
├─ id
├─ state
├─ county
├─ date
├─ unemployment_rate
├─ median_household_income
├─ poverty_rate
├─ gini_coefficient
└─ data_source

-- Caching
trend_cache
├─ id
├─ metric
├─ date
├─ analysis (JSONB)
├─ cached_at
└─ expires_at

policy_recommendations
├─ id
├─ title
├─ category
├─ description
├─ expected_impact
├─ gini_coefficient_min/max
├─ poverty_rate_min/max
└─ priority_score

-- Audit
audit_log
├─ id
├─ action
├─ table_name
├─ user_ip
├─ data_change (JSONB)
└─ created_at
```

### Query Patterns

```python
# Simple lookup
SELECT * WHERE category = 'Top 1%' ORDER BY date DESC LIMIT 100

# Time series analysis
SELECT date, net_worth 
FROM wealth_distribution 
WHERE category = 'Bottom 50%' 
ORDER BY date

# Comparison (disparities)
SELECT group_name, AVG(median_wealth)
FROM demographics
WHERE type = 'race'
GROUP BY group_name

# Trend detection
SELECT date, unemployment_rate,
       LAG(unemployment_rate) OVER (ORDER BY date) as prev_rate
FROM economic_indicators
WHERE state = 'WA'
ORDER BY date DESC

# Full-text search
SELECT * FROM full_text_search('inequality poverty weighted')
LIMIT 50
```

---

## 🚀 Scaling Strategy

### Current (Year 1)
```
Data Volume: ~15K records
Query Pattern: By category + date
Storage: <10MB (free tier)
Performance: 50-200ms p95
Users: <100 concurrent
```

### Growth (Year 2)
```
Data Volume: ~1M records (govt data + history)
Query Pattern: Complex joins + aggregations
Storage: 100-500MB (still free)
Performance: 100-500ms p95
Users: 100-1K concurrent
Action: Consider caching layer (Redis)
```

### Enterprise (Year 3+)
```
Data Volume: 10M+ records
Query Pattern: ML models + predictive analytics
Storage: 1-5GB (upgrade to paid)
Performance: <100ms p95 (with caching)
Users: 1K-10K concurrent
Action: Upgrade to Supabase Pro ($100/mo)
```

### Scaling Tactics
```
1. Database Indexes (Auto)
   └─ Automatic on date, category, state columns

2. Materialized Views
   └─ Pre-computed aggregations for common queries

3. Caching
   └─ Redis for hot queries (dashboard updates)
   └─ Cache Manager for API responses

4. Query Optimization
   └─ Batch operations
   └─ Pagination for large results
   └─ Connection pooling

5. Monitoring
   └─ Query performance tracking
   └─ Slow query logs
   └─ User analytics
```

---

## 🔐 Security Architecture

### Authentication Flow
```
↓ User login (future)
├─ Supabase Auth
├─ JWT token issued
└─ Stored in secure cookie

↓ API request
├─ Include JWT token
├─ Verify token validity
└─ Check row-level security policies

↓ Database access
├─ Anonymous: Read only
├─ Authenticated: Read most data
└─ Admin: Full access
```

### Data Protection
```
In Transit
├─ HTTPS/TLS 1.3 (Supabase enforced)
└─ All data encrypted during transmission

At Rest
├─ PostgreSQL encryption
├─ Encrypted backups
└─ Encryption key in Supabase managed vault

Audit Trail
├─ All changes logged
├─ Timestamp of each modification
└─ User IP for traceability
```

---

## 📈 Monitoring & Observability

### Logging
```python
# Level 0 (Production - Errors only)
logger.ERROR       # Critical issues

# Level 1 (Production - Important events)
logger.INFO        # Data loaded, migrations complete

# Level 2 (Development - Debug)
logger.DEBUG       # Query details, cache hits/misses
```

### Metrics to Track
```
Performance:
├─ Query latency (p50, p95, p99)
├─ API response time
├─ Cache hit rate
└─ Database connections

Data Quality:
├─ Data freshness (last update)
├─ Record count trends
├─ Missing data patterns
└─ Duplicate detection

Business:
├─ User queries per day
├─ Popular search terms
├─ Feature usage
└─ Error rates
```

### Example Dashboard Queries
```sql
-- Daily performance
SELECT DATE(created_at), COUNT(*), AVG(execution_time_ms)
FROM query_log
GROUP BY DATE(created_at)
ORDER BY DATE DESC LIMIT 30;

-- Data recency
SELECT data_type, MAX(date) as latest_date
FROM wealth_distribution
GROUP BY data_type;

-- Search popularity
SELECT search_query, COUNT(*) as frequency
FROM audit_log
WHERE action = 'search'
GROUP BY search_query
ORDER BY frequency DESC
LIMIT 20;
```

---

## ⚡ Performance Optimization Checklist

### Database Level
- [x] Indexes on frequently filtered columns (date, category, type)
- [ ] Materialized views for complex aggregations
- [ ] Partitioning by date for very large tables
- [ ] Query plan analysis for slow queries

### Application Level
- [x] Connection pooling (Supabase managed)
- [x] Request caching (24h default)
- [ ] Response compression (gzip)
- [ ] Batch API operations
- [ ] Pagination for large results

### Frontend Level
- [ ] Lazy loading data
- [ ] Client-side caching
- [ ] Request debouncing
- [ ] WebSocket for real-time updates

---

## 🔄 CI/CD Pipeline (Recommended)

### Pre-commit
```bash
- Lint Python files
- Run type checks (mypy)
- Format with black
```

### Push to Main
```bash
GitHub Actions:
├─ Unit tests
├─ Integration tests (with test Supabase)
├─ Lint checks
└─ Build Docker image
```

### Deploy to Production
```bash
├─ Run migrations
├─ Sync government data
├─ Health check
└─ Alert on failure
```

### Scheduled Jobs
```
Weekly:
├─ Sync government data
└─ Clear old cache entries

Monthly:
├─ Analyze usage patterns
└─ Update policy recommendations

Quarterly:
├─ Backup validation
├─ Security audit
└─ Performance review
```

---

## 📚 Architecture Decision Records (ADRs)

### ADR-1: Supabase for Database
**Decision**: Use Supabase (PostgreSQL) instead of MongoDB
- **Reason**: Better for relational wealth data, free tier scales to our needs
- **Trade-off**: Less opinionated than MongoDB, requires SQL knowledge

### ADR-2: Hybrid CSV/Supabase Loading
**Decision**: Support both sources, auto-fallback from Supabase to CSV
- **Reason**: Gradual migration path, zero downtime
- **Trade-off**: Slightly more code complexity

### ADR-3: Vector Embeddings with FAISS
**Decision**: Use FAISS for local semantic search instead of Supabase pgvector
- **Reason**: Faster for our scale, cheaper, easier development
- **Trade-off**: Doesn't scale beyond memory if needed

### ADR-4: Government Data Sync Automation
**Decision**: GitHub Actions for scheduled data sync
- **Reason**: Free, reliable, integrates with repo
- **Trade-off**: Need to keep GitHub Actions active

---

## 🎯 Next Architecture Iterations

### v2.1 (Next Month)
- [ ] Add materialized views for analytics
- [ ] Implement Redis caching
- [ ] Add query performance monitoring

### v3.0 (Next Quarter)
- [ ] GraphQL API alongside REST
- [ ] Machine learning models
- [ ] Real-time streaming updates

### v4.0 (Year 2)
- [ ] Distributed system (multi-region)
- [ ] Data virtualization layer
- [ ] Advanced privacy controls

---

## 🚨 Disaster Recovery

### Backup Strategy
```
Daily: Automatic Supabase backups
Weekly: Export to CSV (GitHub)
Monthly: Archive to cold storage
```

### Recovery Procedure
```
1. Detect issue
2. Rollback last diff
3. Restore from backup
4. Verify data integrity
5. Resume operations
```

### RTO/RPO Targets
```
Recovery Time Objective (RTO): 1 hour
Recovery Point Objective (RPO): Daily
```

---

**Architecture Status**: ✅ Production-Ready
**Last Updated**: February 2024  
**Version**: 2.0
