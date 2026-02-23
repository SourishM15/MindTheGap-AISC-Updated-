# AWS S3 + Athena - Government Data Integration Guide

## Why AWS S3 for Your $100 Credits?

✅ **$100 Credits = 4-6 months FREE**
- S3: $0.023/GB/month = ~$230/year for 1TB
- Your credits cover this entirely ✨

✅ **Athena** - Query massive datasets with SQL directly
- Query 100GB datasets without loading to database
- Only pay for data scanned: $6.25/TB
- Perfect for analyzing government datasets

✅ **Scalability** - No Supabase table limits
- Store unlimited government datasets
- Heat/cold storage tiers
- Archival to Glacier for old data

---

## Architecture

```
Government APIs (Census, BLS, FRED)
        ↓
   AWS S3 Bucket (Raw Data Lake)
        ↓
    Athena Queries (SQL on S3)  OR  Download & Process
        ↓
   Supabase (Processed Hot Data)
        ↓
   Frontend/API
```

---

## Quick Setup

### 1. Create S3 Bucket

```bash
# Using AWS CLI
aws s3 mb s3://mindthegap-gov-data --region us-east-1

# Create folders
aws s3 mb s3://mindthegap-gov-data/government-data/census/
aws s3 mb s3://mindthegap-gov-data/government-data/bls/
aws s3 mb s3://mindthegap-gov-data/government-data/fred/
aws s3 mb s3://mindthegap-gov-data/metadata/
aws s3 mb s3://mindthegap-gov-data/athena-results/
```

### 2. Get AWS Credentials

```bash
# Go to AWS Console → IAM → Users → Create User
# Create access key → Copy Access Key ID and Secret Access Key
```

### 3. Add to .env

```
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=us-east-1
```

### 4. Install AWS SDK

```bash
pip install boto3 pyathena
```

### 5. Create Athena Database (Optional but powerful)

```bash
# Create Athena database for SQL queries on S3
aws athena start-query-execution \
  --query-string "CREATE DATABASE IF NOT EXISTS government_data" \
  --result-configuration OutputLocation=s3://mindthegap-gov-data/athena-results/
```

---

## Usage

### Upload Government Data

```python
from s3_government_data import S3GovernmentDataManager

s3_mgr = S3GovernmentDataManager()

# Upload Census data
s3_mgr.upload_government_data('data/census_population.csv', 'census')

# Upload BLS unemployment data
s3_mgr.upload_government_data('data/unemployment.csv', 'bls')

# Upload FRED economic data
s3_mgr.upload_government_data('data/fred_gdp.csv', 'fred')
```

### List What You've Uploaded

```python
s3_mgr = S3GovernmentDataManager()

# List all datasets
all_data = s3_mgr.list_datasets()
for file in all_data:
    print(f"{file['key']}: {file['size_mb']:.2f}MB")

# List Census datasets specifically
census_data = s3_mgr.list_datasets('census')
```

### Download & Process

```python
# Download from S3
df = s3_mgr.download_government_data('census', 'census_population.csv')
print(f"Downloaded: {len(df)} rows")

# Process
df_summary = df.groupby('state').agg({'population': 'sum'})

# Sync to Supabase
from supabase_db import get_db
db = get_db()

s3_mgr.sync_to_supabase(
    dataset_type='census',
    file_name='census_population.csv',
    table_name='census_data',
    db=db
)
```

### Power: Query with Athena (SQL on S3)

```python
# Execute SQL directly on S3 data - no database load!
query_id = s3_mgr.query_with_athena("""
SELECT state, 
       SUM(population) as total_population,
       AVG(income) as avg_income
FROM s3://mindthegap-gov-data/government-data/census/population.csv
WHERE year = 2024
GROUP BY state
ORDER BY total_population DESC
""")

print(f"Query ID: {query_id}")
# Results saved to s3://mindthegap-gov-data/athena-results/
```

### Get Public URLs

```python
# Share government data files
url = s3_mgr.get_s3_url('census', 'census_population.csv')
print(f"Public URL: {url}")
```

### Check Storage Usage

```python
stats = s3_mgr.get_storage_stats()
print(f"Total storage: {stats['total_size_gb']:.2f}GB")
print(f"Files: {stats['file_count']}")
```

---

## Integration in Main App

### Option 1: Sync on Startup

```python
# In main.py
from s3_government_data import S3GovernmentDataManager
from supabase_db import get_db

@app.on_event("startup")
async def startup():
    s3_mgr = S3GovernmentDataManager()
    s3_mgr.create_bucket()  # Create if doesn't exist
    db = get_db()
    
    # Sync latest government datasets
    s3_mgr.sync_to_supabase('census', 'population.csv', 'census_data', db)
    s3_mgr.sync_to_supabase('bls', 'unemployment.csv', 'economic_indicators', db)
    
    logger.info("✓ Government data synced from S3")
```

### Option 2: Scheduled Sync (Daily)

```python
from apscheduler.schedulers.background import BackgroundScheduler
import atexit

scheduler = BackgroundScheduler()

def sync_s3_data():
    s3_mgr = S3GovernmentDataManager()
    db = get_db()
    s3_mgr.sync_to_supabase('census', 'population.csv', 'census_data', db)
    s3_mgr.sync_to_supabase('bls', 'unemployment.csv', 'economic_indicators', db)
    logger.info("✓ Scheduled S3 sync completed")

scheduler.add_job(sync_s3_data, 'cron', hour=2)  # 2 AM daily
scheduler.start()

atexit.register(lambda: scheduler.shutdown())

@app.on_event("startup")
async def startup():
    # Scheduler already running
    logger.info("✓ S3 sync scheduler started")
```

### Option 3: API Endpoint for Data Sync

```python
@app.post("/api/sync-government-data")
async def sync_government_data():
    """Manual trigger to sync S3 data to Supabase"""
    try:
        s3_mgr = S3GovernmentDataManager()
        db = get_db()
        
        results = {
            'census': s3_mgr.sync_to_supabase('census', 'population.csv', 'census_data', db),
            'bls': s3_mgr.sync_to_supabase('bls', 'unemployment.csv', 'economic_indicators', db),
            'fred': s3_mgr.sync_to_supabase('fred', 'gdp.csv', 'economic_indicators', db),
        }
        
        return {
            "status": "success",
            "synced": results
        }
    except Exception as e:
        logger.error(f"Sync failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

---

## Cost Breakdown (with $100 credits)

| Service | Monthly Cost | Annual | 100GB |
|---------|---|---|---|
| **S3 Storage** | $2.30 | $27.60 | $0.50/month |
| **Athena Queries** | $0-5 | $0-60 | ~$0.60 scan 100GB |
| **Data Transfer** | $0-2 | $0-24 | Within AWS region = free |
| **TOTAL/month** | ~$2-7 | ~$27-111 | Covered by credits! |

**Your $100 covers ~1-4 years of storage!** 🎉

---

## Government Data Sources

### 1. US Census Bureau
**API**: https://api.census.gov/data/

```python
import requests

response = requests.get(
    'https://api.census.gov/data/2022/acs/acs1',
    params={
        'get': 'B01003_001E,NAME',
        'for': 'state:*',
        'key': 'YOUR_CENSUS_KEY'
    }
)
df = pd.DataFrame(response.json()[1:], columns=response.json()[0])
df.to_csv('census_population.csv', index=False)
```

### 2. Bureau of Labor Statistics (BLS)
**API**: https://www.bls.gov/developers/api_python.htm

```python
import requests

series_id = 'UNRATE'  # National unemployment rate
response = requests.post(
    'https://api.bls.gov/publicAPI/v2/timeseries/data/',
    json={'seriesid': [series_id]},
    headers={'Content-type': 'application/json'}
)
# Parse and save to CSV
```

### 3. Federal Reserve FRED
**API**: https://fred.stlouisfed.org/api/

```python
import requests

response = requests.get(
    'https://api.stlouisfed.org/fred/series/observations',
    params={
        'series_id': 'GDP',
        'api_key': 'YOUR_FRED_KEY'
    }
)
df = pd.DataFrame(response.json()['observations'])
df.to_csv('fred_gdp.csv', index=False)
```

---

## Troubleshooting

**Error: "Unable to locate credentials"**
```bash
# Check .env has AWS keys
cat .env | grep AWS_

# Or configure AWS CLI
aws configure
# Enter your Access Key ID and Secret Access Key
```

**Error: "NoSuchBucket"**
```bash
# Check bucket exists
aws s3 ls

# If not, create it
aws s3 mb s3://mindthegap-gov-data --region us-east-1
```

**Large file uploads slow?**
```python
# Use boto3 with multipart upload (handled automatically for files > 8MB)
# For 100MB+ files:
s3_client.put_object(
    Bucket='mindthegap-gov-data',
    Key='government-data/census/large_file.csv',
    Body=open('large_file.csv', 'rb')
)
```

---

## Monitoring Storage

```python
s3_mgr = S3GovernmentDataManager()
stats = s3_mgr.get_storage_stats()

print(f"Bucket: {stats['bucket']}")
print(f"Total Size: {stats['total_size_gb']:.2f}GB")
print(f"Files: {stats['file_count']}")
print(f"Monthly Cost: ${stats['total_size_gb'] * 0.023:.2f}")
```

---

## Next Steps

1. ✅ Add AWS credentials to `.env`
2. ✅ Create S3 bucket and folders
3. ✅ Install `boto3` and `pyathena`
4. ✅ Download government data CSVs
5. ✅ Upload to S3 with `s3_government_data.py`
6. ✅ Sync to Supabase or query with Athena
7. ✅ Monitor storage with stats endpoint

Your $100 AWS credits will last months! 🚀


