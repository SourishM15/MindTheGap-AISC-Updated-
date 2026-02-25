# MindTheGap

A comprehensive dashboard for analyzing wealth inequality and economic disparities across the United States using real government data.

## Project Overview

MindTheGap is an interactive platform that combines wealth inequality metrics with government economic data to provide insights into regional economic patterns. The dashboard visualizes demographic trends, employment statistics, and economic indicators to help understand wealth distribution across different regions and populations.

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
- **AWS S3** for data storage and caching

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

### Frontend Setup

```bash
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`

### Backend Setup

```bash
cd src/backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

The API will be available at `http://localhost:8000`

## Configuration

The backend requires environment variables for API authentication. Create a `.env` file in `src/backend/`:

```
OPENAI_API_KEY=your_key_here
CENSUS_API_KEY=your_key_here
BLS_API_KEY=your_key_here
FRED_API_KEY=your_key_here
AWS_REGION=us-east-2
```

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

## Data Sources

- **Census Bureau API** - Demographic data, income, education
- **Bureau of Labor Statistics** - Employment, unemployment rates
- **Federal Reserve Economic Data (FRED)** - Economic indicators, inflation, GDP
- **Local CSV Files** - Fallback data for offline functionality

## License

This project is part of the AISC (AI for Social Change) initiative.

## Support

For issues or questions, please open an issue in the repository.
