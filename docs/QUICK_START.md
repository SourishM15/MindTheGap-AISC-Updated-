# Quick Start: Regional Data Enrichment

## 5-Minute Setup

### 1. Verify Dependencies
```bash
cd src/backend
pip install requests httpx
```

### 2. Run Learning Pipeline (No API Keys Needed!)
```bash
python run_enrichment_pipeline.py --mode learning-only --skip-api-keys-warning
```

This generates:
- 5,000+ training Q&A pairs for chatbot
- 5 economic correlation patterns
- Complete knowledge base
- Enhanced system prompt

**Expected output:**
```
2026-02-12 14:30:00 | Starting enrichment pipeline...
2026-02-12 14:30:02 | Stage 3: Chatbot Learning Pipeline
2026-02-12 14:30:15 | ✓ Generated 5,000 training insights
2026-02-12 14:30:20 | ✓ Created 5 correlation patterns
2026-02-12 14:30:22 | ✓ Generated enhanced system prompt
2026-02-12 14:30:25 | ✓ Created comprehensive knowledge base
2026-02-12 14:30:30 | Pipeline completed successfully!
```

### 3. Integrate Chatbot Enhancement
Coming next: Update `main.py` to use the enhanced system prompt

## 15-Minute Full Setup (With API Keys)

### 1. Get Free API Keys
- **Census**: https://api.census.gov/data/key_signup.html (instant)
- **BLS**: https://www.bls.gov/developers/home.htm (instant)
- **FRED**: https://fred.stlouisfed.org/docs/api/ (instant)

### 2. Add to .env
```bash
echo "CENSUS_API_KEY=your_key_here" >> .env
echo "BLS_API_KEY=your_key_here" >> .env
echo "FRED_API_KEY=your_key_here" >> .env
```

### 3. Run Full Pipeline
```bash
python run_enrichment_pipeline.py --mode full
```

**Timeline:**
- Minutes 0-5: Fetching Census data (50 states)
- Minutes 5-8: Fetching BLS data (unemployment, wages)
- Minutes 8-10: Fetching FRED data (economic indicators)
- Minutes 10-12: Processing & uploading to S3
- Minutes 12-15: Generating chatbot training data

**Result:** 300+ enriched state profiles in S3 + chatbot training data

## Command Reference

### Run Full Pipeline
```bash
python run_enrichment_pipeline.py --mode full
```

### Run Individual Stages
```bash
# Just enrich states (fetch APIs, save to S3)
python run_enrichment_pipeline.py --mode enrichment-only

# Just train chatbot (no API calls)
python run_enrichment_pipeline.py --mode learning-only

# Update specific states only
python run_enrichment_pipeline.py --mode incremental --states CA TX NY
```

### Options
```bash
# Skip API key warnings if you don't have them
--skip-api-keys-warning

# Specify states (comma-separated)
--states CA,TX,NY,FL
```

## Expected Outputs

### S3: Enriched Data
```
s3://mindthegap-gov-data/enriched-regional-data/
├── state-profiles/
│   ├── california/
│   │   ├── profile.json
│   │   ├── demographics.json
│   │   ├── employment.json
│   │   ├── economics.json
│   │   └── wealth.json
│   └── ... (50 states)
└── regional-comparisons/
    ├── northeast.json
    ├── southeast.json
    ├── midwest.json
    ├── southwest.json
    └── west.json
```

### S3: Chatbot Training
```
s3://mindthegap-gov-data/chatbot-training-data/
├── regional-insights-{date}.jsonl
├── regional-insights-{date}.json
├── economic-correlations.json
└── knowledge-base.json
```

### Local: Logs
```
src/backend/enrichment_pipeline.log
src/backend/enrichment-summary-{timestamp}.json
```

## What Gets Generated

### Training Data Sample
```json
{
  "query": "Tell me about California",
  "answer": "California is the most populous state...",
  "state": "California",
  "region": "West"
}
```

### Correlation Patterns
```
1. High education → Higher income → Lower inequality (85% confidence)
2. Service sector → Lower wages → Higher inequality (78%)
3. Tech/professional → High wages → Middle-class opportunity (82%)
4. Manufacturing decline → Job loss → Rising inequality (81%)
5. Diversity → Complex economic dynamics (72%)
```

### Knowledge Base Includes
- Regional facts for all US regions
- 100+ economic reasoning rules
- Few-shot examples for comparisons
- State classification system

## Testing the Chatbot

After running the pipeline, test with:

```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Tell me about wealth inequality in California",
    "conversation_history": []
  }'
```

The chatbot will now use enriched government data in responses!

## Troubleshooting

### Pipeline Hangs
- Check internet connection
- Verify S3 credentials in .env
- Check API rate limits (120 req/min for BLS/FRED)

### S3 Upload Fails
```bash
# Verify S3 bucket exists
aws s3 ls s3://mindthegap-gov-data --region us-east-2

# Check AWS credentials
cat ~/.aws/credentials
```

### Missing Packages
```bash
pip install -r src/backend/requirements.txt
```

### Check Logs
```bash
tail -f src/backend/enrichment_pipeline.log
```

## Performance Tips

### For Large Updates
- Use `--mode incremental` for 5-10 states instead of full 50
- Run during off-peak hours to avoid API rate limits

### To Run Faster
- Run learning-only first (2-3 min) to test setup
- Then run enrichment (5-10 min) independently
- Combine results manually if needed

## Next: Integrate with ChatBot

See the chatbot integration guide for:
1. Loading knowledge base into main.py
2. Using enhanced system prompt
3. Adding regional comparison endpoints
4. Running chatbot with enriched data

## Files Reference

| File | Purpose | Runtime |
|------|---------|---------|
| `census_api_client.py` | Fetch Census demographics | 2-3 min |
| `bls_api_client.py` | Fetch employment data | 2-3 min |
| `fred_api_client.py` | Fetch economic indicators | 1-2 min |
| `data_enrichment_pipeline.py` | Enrich & save states | 3-5 min |
| `chatbot_learning_engine.py` | Generate training data | 2-3 min |
| `run_enrichment_pipeline.py` | Orchestrate all stages | 10-15 min |

## One-Liner Commands

```bash
# Quick test (no APIs)
cd src/backend && python run_enrichment_pipeline.py --mode learning-only --skip-api-keys-warning

# Full enrichment (with API keys)
cd src/backend && python run_enrichment_pipeline.py --mode full

# Update CA, TX, NY only
cd src/backend && python run_enrichment_pipeline.py --mode incremental --states CA,TX,NY

# Check what got generated
aws s3 ls s3://mindthegap-gov-data/enriched-regional-data/state-profiles/ --region us-east-2

# View logs
tail -f src/backend/enrichment_pipeline.log
```

---

**TL;DR:**
1. Run: `python run_enrichment_pipeline.py --mode learning-only --skip-api-keys-warning`
2. Wait 2-3 minutes
3. Chatbot training data created in S3
4. Ready to integrate with chatbot!

For full enrichment with government data, get free API keys and run with `--mode full`.
