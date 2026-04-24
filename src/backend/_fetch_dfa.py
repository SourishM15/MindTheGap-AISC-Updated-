"""Fetch latest DFA data from Fed ZIP, upload to Supabase Storage, update local CSVs."""
import io, os, requests, pandas as pd, zipfile
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client

# Load .env so AWS credentials (AWS_ACCESS_KEY_ID, etc.) are available
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'), override=True)

BUCKET = "mindthegap-gov-data"
S3_PREFIX = "government-data/census/"
LOCAL_DATA = os.path.join(os.path.dirname(__file__), '..', 'data')

FED_ZIP_URL = "https://www.federalreserve.gov/releases/z1/dataviz/download/zips/dfa.zip"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; MindTheGap-DataRefresh/1.0)"}

def main():
    print(f"Downloading Fed DFA ZIP from {FED_ZIP_URL} ...")
    r = requests.get(FED_ZIP_URL, headers=HEADERS, timeout=120)
    r.raise_for_status()
    print(f"  Downloaded {len(r.content):,} bytes")

    _url = os.getenv('SUPABASE_URL')
    _key = os.getenv('SUPABASE_KEY')
    sb = create_client(_url, _key) if _url and _key else None
    if not sb:
        print("ERROR: SUPABASE_URL / SUPABASE_KEY not set — cannot upload")
        return
    zf = zipfile.ZipFile(io.BytesIO(r.content))

    print(f"\nFiles in ZIP: {zf.namelist()}\n")

    uploaded, skipped = [], []
    for zname in zf.namelist():
        # Only process CSV files that match our dfa-*.csv naming
        if not zname.endswith('.csv'):
            continue
        fname = os.path.basename(zname)
        if not fname.startswith('dfa-'):
            continue

        content = zf.read(zname)

        # Parse to confirm latest quarter
        try:
            df = pd.read_csv(io.BytesIO(content))
            if 'Date' in df.columns:
                latest = sorted(df['Date'].unique())[-1]
            else:
                latest = 'unknown'
            rows = len(df)
        except Exception as e:
            print(f"  ✗ {fname}: CSV parse error: {e}")
            skipped.append(fname)
            continue

        print(f"  {fname}: {rows} rows, latest quarter: {latest}")

        # Always update local CSV fallback first (used when S3 is unavailable)
        local_path = os.path.join(LOCAL_DATA, fname)
        try:
            with open(local_path, 'wb') as f:
                f.write(content)
            print(f"    ✓ Updated local copy at {os.path.relpath(local_path)}")
        except Exception as e:
            print(f"    ✗ Local write failed (non-fatal): {e}")

        # Upload to Supabase Storage
        try:
            sb.storage.from_(BUCKET).upload(
                S3_PREFIX + fname,
                content,
                file_options={"upsert": "true"}
            )
            print(f"    ✓ Uploaded to supabase://{BUCKET}/{S3_PREFIX}{fname}")
            uploaded.append((fname, latest))
        except Exception as e:
            print(f"    ✗ Supabase Storage upload failed (local copy still updated): {e}")
            skipped.append(fname)

    print("\n" + "="*60)
    print(f"Done. Uploaded/updated: {len(uploaded)}, Skipped: {len(skipped)}")
    for fname, latest in uploaded:
        print(f"  ✓ {fname}  →  latest: {latest}")
    if skipped:
        print("Skipped:")
        for f in skipped:
            print(f"  ✗ {f}")

if __name__ == '__main__':
    main()
