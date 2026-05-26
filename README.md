# MindThe_Gap

A comprehensive dashboard for analyzing wealth inequality and economic disparities across the United States using real government data.

## Project Overview

MindThe_Gap is an interactive platform that combines wealth inequality metrics with government economic data to provide insights into regional economic patterns. The dashboard visualizes demographic trends, employment statistics, and economic indicators to help understand wealth distribution across different regions and populations.

## Key Features

- **Interactive Regional Analysis** - Explore wealth inequality metrics by state and metro area
- **Government Data Integration** - Real-time data from Census Bureau, Bureau of Labor Statistics, and Federal Reserve
- **Economic Indicators** - Track employment, demographics, income distribution, and economic trends
- **Data Visualization** - Interactive maps, charts, and comparative analysis tools
- **Enriched Knowledge Base** - AI-assisted analysis and policy recommendations based on enriched regional data

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **D3.js & Recharts** for data visualization
- **Leaflet** for interactive mapping
- **React Router** for navigation

### Backend
- **Python 3.13** with FastAPI
- **LangChain** for AI/LLM integration
- **Pandas & NumPy** for data processing
- **FAISS** for vector similarity search
- **SQLAlchemy** for data management
- **Supabase Storage/Database** for prebuilt government datasets and enriched regional profiles

## Project Structure

```
├── src/
│   ├── components/        # React UI components
│   ├── pages/             # Page components
│   ├── data/              # CSV fallback data & TypeScript fixtures
│   ├── backend/           # Python FastAPI backend
│   │   ├── main.py        # API endpoints
│   │   ├── government_api.py      # API client integrations
│   │   ├── graph_rag.py           # Knowledge graph RAG
│   │   ├── vector_embeddings.py   # Embedding generation
│   │   └── requirements.txt       # Python dependencies
│   └── hooks/             # Custom React hooks
├── package.json           # Frontend dependencies
├── vite.config.ts         # Vite configuration
├── tailwind.config.js     # Tailwind configuration
└── tsconfig.json          # TypeScript configuration
```

## Getting Started

### Prerequisites
- Node.js 16+ and npm
- Python 3.13+
- Virtual environment (recommended)


## Deployment

### Live Deployment

- Frontend: https://mind-the-gap-aisc-updated.vercel.app/ 
- Backend API: https://mindthegap-api.onrender.com

This project deploys as two services:

- **Frontend:** Netlify builds the Vite/React app from GitHub and serves `dist/`.
- **Backend:** Railway, Render, Fly.io, or another Python host runs the FastAPI service in `src/backend`.


### Frontend Deployment on Vercel

The frontend can also deploy to Vercel while keeping the FastAPI backend on
Render.

1. In Vercel, choose **Add New** > **Project** and import this GitHub repo.
2. Use the Vite framework preset, or confirm these settings:

```text
Build command: npm run build
Output directory: dist
```

The repo includes `vercel.json` for the build output and React Router fallback
rewrite.

Add this Vercel environment variable for Production, Preview, and Development:

```text
VITE_API_BASE_URL=https://mindthegap-api.onrender.com
```

After the Vercel URL is live, update the Render backend CORS setting to include
the Vercel frontend. If Netlify remains live too, keep both origins:

```text
CORS_ALLOW_ORIGINS=https://mindthe-gap.netlify.app,https://your-vercel-app.vercel.app
```

### Backend Deployment on Render

If Railway gives you trouble, Render can run the FastAPI backend from the same
GitHub repo. The repo includes `render.yaml` for a Render Blueprint.

1. In Render, choose **New** > **Blueprint** and select this GitHub repo.
2. Render should create a `mindthegap-api` web service using:

```text
Root directory: src/backend
Build command: pip install -r requirements.txt
Start command: uvicorn main:app --host 0.0.0.0 --port $PORT
```

3. Add the secret environment variables in Render. Use
   `src/backend/.env.example` as the checklist.
4. After Render gives you a URL like
   `https://mindthegap-api.onrender.com`, set:

```text
ALLOWED_HOSTS=mindthegap-api.onrender.com
CORS_ALLOW_ORIGINS=https://mindthe-gap.netlify.app
```

5. In Netlify, set the frontend API URL and redeploy:

```text
VITE_API_BASE_URL=https://mindthegap-api.onrender.com
```

## Configuration

The backend requires environment variables for API authentication. Create a `.env` file in `src/backend/`:

```
OPENAI_API_KEY=your_key_here
CENSUS_API_KEY=your_key_here
BLS_API_KEY=your_key_here
FRED_API_KEY=your_key_here
BEA_API_KEY=your_key_here
SUPABASE_URL=your_project_url
SUPABASE_KEY=your_supabase_key
```

For production, also set the security controls:

```
APP_ENV=production
ENABLE_API_DOCS=false
ENABLE_SEMANTIC_SEARCH=false
CORS_ALLOW_ORIGINS=https://your-frontend-domain.com
ALLOWED_HOSTS=your-api-domain.com
ADMIN_API_KEY=use-a-long-random-secret
RATE_LIMIT_WINDOW_SECONDS=60
RATE_LIMIT_MAX_REQUESTS=60
STATE_BENCHMARK_YEARS=2024,2023,2022
```

The frontend API base URL is configured separately with `VITE_API_BASE_URL`; see `.env.example`. Backend environment examples are in `src/backend/.env.example`.

Refer to the government agencies' websites to obtain API keys:
- [Census Bureau](https://api.census.gov/)
- [Bureau of Labor Statistics](https://www.bls.gov/developers/)
- [Federal Reserve Economic Data](https://fred.stlouisfed.org/docs/api/)

## Development

### Available Scripts

**Frontend:**
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

**Backend:**
- `python main.py` - Start FastAPI server
- `python run_enrichment_pipeline.py` - Run data enrichment jobs

### Supabase Data Seeding

Supabase GitHub integration expects a root-level `supabase/` directory. Use `.` as
the integration working directory and `main` as the production branch. Schema
changes should be committed as timestamped SQL files in `supabase/migrations/`.

The backend expects prebuilt objects in Supabase Storage so state pages do not need to rebuild enriched data on every request. From `src/backend`, run:

```bash
python seed_supabase_storage.py --dfa --verify
python seed_supabase_storage.py --states California Minnesota --verify
```

Use `--all-states` when you are ready to prebuild every state profile:

```bash
python seed_supabase_storage.py --all-states
```

Seed the curated major metro/city profiles with:

```bash
python seed_supabase_storage.py --all-metros
```

Or seed selected metros:

```bash
python seed_supabase_storage.py --metros "New York" "Los Angeles" Seattle
```

The state profile seed path builds from the live government API clients first, including Census ACS, Census SAIPE, BLS, FRED, and BEA where API keys are configured, then uploads JSON to `mindthegap-gov-data/enriched-regional-data/state-profiles/{state}/`. Metro profiles use Census ACS metro data, BLS LAUS, ACS income distribution, and the metro's home-state SAIPE snapshot, then upload to `mindthegap-gov-data/enriched-regional-data/metro-areas/{metro}/`.

After seeding, check Storage coverage and sample freshness with:

```bash
curl http://localhost:8000/api/data-health
```

To also sync normalized metrics into Supabase database tables:

```bash
python sync_government_data.py --states California Minnesota
```

## Data Sources

- **Census Bureau API** - Demographic data, income, education
- **Bureau of Labor Statistics** - Employment, unemployment rates
- **Federal Reserve Economic Data (FRED)** - Economic indicators, inflation, GDP
- **Local CSV Files** - Fallback data for offline functionality

## License

This project is part of the AISC (AI for Social Change) initiative.

## Support

For issues or questions, please open an issue in the repository.
