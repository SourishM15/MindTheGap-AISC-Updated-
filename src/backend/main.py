import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import networkx as nx
from langchain_core.prompts import PromptTemplate
from langchain_openai import OpenAI
from dotenv import load_dotenv
from graph_rag import get_graph_rag_context

# Load environment variables from .env file
load_dotenv()

# Set up OpenAI API key
# Make sure you have an .env file with your OPENAI_API_KEY
openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
    print("OPENAI_API_KEY not found in .env file. Please add it.")

# Initialize FastAPI app
app = FastAPI()

# Add CORS middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  # Frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Data Loading and Graph Creation ---
def load_data_and_create_graph():
    """Loads the Federal Reserve DFA data and creates a graph."""
    try:
        # Load multiple DFA datasets
        networth_df = pd.read_csv("../data/dfa-networth-levels.csv")
        income_df = pd.read_csv("../data/dfa-income-levels.csv")
        race_df = pd.read_csv("../data/dfa-race-levels.csv")
        
        print(f"Loaded {len(networth_df)} net worth records")
        print(f"Loaded {len(income_df)} income records")
        print(f"Loaded {len(race_df)} race records")
        
    except FileNotFoundError as e:
        print(f"Error: DFA data file not found: {e}")
        return None

    G = nx.Graph()
    
    # Add net worth data nodes
    for _, row in networth_df.iterrows():
        node_id = f"networth_{row['Date']}_{row['Category']}"
        G.add_node(node_id, 
                  data_type="networth",
                  date=row['Date'],
                  category=row['Category'],
                  **row.to_dict())
    
    # Add income data nodes
    for _, row in income_df.iterrows():
        node_id = f"income_{row['Date']}_{row['Category']}"
        G.add_node(node_id,
                  data_type="income", 
                  date=row['Date'],
                  category=row['Category'],
                  **row.to_dict())
    
    # Add demographic data nodes
    for _, row in race_df.iterrows():
        node_id = f"race_{row['Date']}_{row['Category']}"
        G.add_node(node_id,
                  data_type="race",
                  date=row['Date'], 
                  category=row['Category'],
                  **row.to_dict())
    
    print(f"Created graph with {G.number_of_nodes()} nodes")
    return G

graph = load_data_and_create_graph()

# --- LangChain and RAG Setup ---
def setup_llm_chain():
    """Sets up the LangChain runnable sequence for question answering."""
    llm = OpenAI(temperature=0, api_key=openai_api_key)
    
    template = """
    You are a helpful chatbot for the MindTheGap project. You answer questions about wealth inequality in the United States based on the provided context.
    Your primary data source is the Federal Reserve's Distributional Financial Accounts (DFA), which provides comprehensive national-level data on:
    - Wealth distribution by percentile groups (Top 0.1%, Next 0.9%, Next 9%, Next 40%, Bottom 50%)
    - Income inequality across demographics
    - Asset composition by wealth groups
    - Historical trends from 1989 to present
    - Breakdowns by race, age, education, and generation
    
    Use the following context to answer questions about wealth inequality, asset distribution, and economic trends.
    Important rules:
    1) ALWAYS prioritize facts and metrics provided in the Context. If the Context contains local/city-specific data, use those values when answering questions about that city.
    2) When context includes an external source (e.g., a city report), explicitly cite the source and label it as local data.
    3) If the Context does not contain data for the requested location, be explicit about that and then provide national-level context from the DFA.
    4) If you cannot find an answer in the Context, say you don't know rather than inventing values.

    Context: {context}

    Question: {question}

    Helpful Answer:"""
    
    prompt = PromptTemplate(template=template, input_variables=["context", "question"])
    # Using the new RunnableSequence syntax (prompt | llm)
    llm_chain = prompt | llm
    return llm_chain

llm_chain = setup_llm_chain()

# --- API Endpoints ---
@app.get("/")
def read_root():
    """Root endpoint to check if the server is running."""
    return {"message": "MindTheGap Backend is running!"}

class ChatRequest(BaseModel):
    message: str

@app.post("/api/chat")
async def chat(request: ChatRequest):
    """Endpoint to handle chat requests from the frontend."""
    if not graph:
        raise HTTPException(status_code=500, detail="Graph not loaded. Check data file.")

    question = request.message
    
    # The get_graph_rag_context function now handles the entire RAG process,
    # including the web search fallback and dynamic graph expansion.
    context = get_graph_rag_context(question, graph)

    try:
        response = llm_chain.invoke({"context": context, "question": question})
        # Handle different response formats from LangChain
        if isinstance(response, str):
            reply = response
        elif hasattr(response, 'content'):
            reply = response.content
        else:
            reply = str(response)
        
        print(f"LLM Response: {reply}")
        return {"reply": reply}
    except Exception as e:
        print(f"Error invoking LLM chain: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# To run this app:
# 1. Make sure you have an .env file in the 'backend' directory with your OPENAI_API_KEY.
#    Example .env file:
#    OPENAI_API_KEY="your_openai_api_key_here"
# 2. In your terminal, navigate to the 'backend' directory.
# 3. Run: uvicorn main:app --reload
