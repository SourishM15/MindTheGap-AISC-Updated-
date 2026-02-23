import spacy
import networkx as nx
from typing import List, Dict, Any, Tuple
from thefuzz import process, fuzz
from web_search import search_and_extract_web_data
from vector_embeddings import VectorStore, create_wealth_query_embedding
from trend_analysis import TrendAnalyzer, analyze_wealth_gap_trends
from government_api import get_local_economic_indicators
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load the spaCy model
try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    logger.info("Downloading spaCy model 'en_core_web_sm'...")
    import spacy.cli
    spacy.cli.download("en_core_web_sm")
    nlp = spacy.load("en_core_web_sm")

# Initialize vector store for semantic search
vector_store = VectorStore()

def extract_entities(question: str) -> Dict[str, Any]:
    """Extracts wealth-related and geographic entities from the question."""
    doc = nlp(question)
    entities = {
        'geographic': [],
        'wealth_groups': [],
        'demographics': [],
        'query_type': 'general',
        'entities_list': []  # For backward compatibility
    }
    
    # Extract geographic entities
    geographic_entities = [ent.text for ent in doc.ents if ent.label_ in ["GPE", "LOC"]]
    
    # Add common cities and areas
    tech_cities = ["Silicon Valley", "Bay Area", "Seattle", "San Francisco", 
                   "Austin", "Boston", "New York", "Los Angeles", "Denver", "Portland",
                   "Chicago", "Washington DC", "Miami", "Atlanta", "Houston"]
    question_lower = question.lower()
    
    for city in tech_cities:
        if city.lower() in question_lower:
            geographic_entities.append(city)
    
    # Look for wealth-related terms
    wealth_terms = {
        "top 1%": "Top1Percent", "top 0.1%": "TopPt1Percent",
        "top one percent": "Top1Percent", "richest": "Top1Percent",
        "wealthy": "Top1Percent", "billionaire": "TopPt1Percent",
        "next 9": "Next9Percent", "upper middle": "Next9Percent",
        "next 40": "Next40Percent", "middle class": "Next40Percent",
        "bottom 50": "Bottom50Percent", "bottom half": "Bottom50Percent",
        "poorest": "Bottom50Percent", "poor": "Bottom50Percent",
        "working class": "Bottom50Percent"
    }
    
    # Look for data types and demographics
    data_types = {
        "wealth": "wealth", "net worth": "wealth", 
        "income": "income", "earnings": "income",
        "assets": "wealth", "property": "housing",
        "race": "race", "racial": "race", "ethnicity": "race",
        "age": "age", "generation": "generation",
        "education": "education", "college": "education",
        "employment": "employment", "jobs": "employment",
        "gender": "gender", "women": "gender", "men": "gender"
    }
    
    # Extract wealth percentile groups
    for term, group in wealth_terms.items():
        if term in question_lower:
            entities['wealth_groups'].append(group)
    
    # Extract data types and demographics
    for term, dtype in data_types.items():
        if term in question_lower:
            entities['demographics'].append(dtype)
    
    # Determine query type
    if any(word in question_lower for word in ["trend", "change", "increase", "decrease", "growth"]):
        entities['query_type'] = 'trend'
    elif any(word in question_lower for word in ["policy", "recommend", "solution", "help", "fix"]):
        entities['query_type'] = 'policy'
    elif any(word in question_lower for word in ["compare", "difference", "vs", "versus"]):
        entities['query_type'] = 'comparison'
    
    # Add geographic entities with marker
    for geo in geographic_entities:
        entities['geographic'].append(geo)
        entities['entities_list'].append(f"GEO:{geo}")
    
    # For backward compatibility, add all to entities_list
    entities['entities_list'].extend(entities['wealth_groups'])
    entities['entities_list'].extend(entities['demographics'])
    
    # If no specific terms found, default to general wealth inquiry
    if not entities['entities_list']:
        entities['wealth_groups'] = ["Top1Percent", "Bottom50Percent"]
        entities['demographics'] = ["wealth"]
        entities['entities_list'] = ["Top1Percent", "Bottom50Percent", "wealth"]
    
    logger.info(f"Extracted entities: {entities}")
    return entities

def search_graph(graph: nx.Graph, entities: List[str]) -> List[Dict[str, Any]]:
    """
    Searches the graph using both keyword and semantic similarity
    
    Enhanced version using vector embeddings for better semantic matching
    """
    relevant_nodes = []
    keyword_matches = []
    
    # First, get keyword matches (backward compatibility and precision)
    for node_id, node_data in graph.nodes(data=True):
        for entity in entities:
            if node_data.get('data_type') == entity or node_data.get('category') == entity:
                keyword_matches.append(node_data)
                break
            elif entity.lower() in node_id.lower():
                keyword_matches.append(node_data)
                break
    
    # Now use semantic search with embeddings
    try:
        if vector_store.embeddings_index is not None and len(vector_store.metadata) > 0:
            # Create semantic query from entities
            query_text = " ".join(entities)
            semantic_results = vector_store.search(query_text, top_k=10)
            
            for doc, similarity_score in semantic_results:
                if similarity_score > 0.3:  # Threshold for relevance
                    relevant_nodes.append({**doc, '_similarity_score': similarity_score})
        
        # Hybrid approach: combine keyword and semantic matches
        if keyword_matches:
            relevant_nodes.extend(keyword_matches)
        else:
            # If no keyword matches, rely on semantic
            relevant_nodes = relevant_nodes or keyword_matches
    
    except Exception as e:
        logger.warning(f"Semantic search failed: {e}, falling back to keyword search")
        relevant_nodes = keyword_matches
    
    # Remove duplicates
    seen_ids = set()
    unique_nodes = []
    for node in relevant_nodes:
        node_id = id(node)
        if node_id not in seen_ids:
            seen_ids.add(node_id)
            unique_nodes.append(node)
    
    # If we have too many nodes, filter to most recent data
    if len(unique_nodes) > 10:
        unique_nodes = sorted(unique_nodes, 
                            key=lambda x: x.get('Date', '1989:Q1'), 
                            reverse=True)[:10]
    
    logger.info(f"Found {len(unique_nodes)} relevant nodes from graph search")
    return unique_nodes

def create_context_from_nodes(nodes: List[Dict[str, Any]]) -> str:
    """Creates a string context from wealth data nodes with enhanced formatting"""
    if not nodes:
        return "No specific data found for the wealth groups or time periods in the question."
    
    context = "=== FEDERAL RESERVE WEALTH DISTRIBUTION DATA ===\n\n"
    
    for node_data in nodes:
        data_type = node_data.get('data_type', 'Unknown')
        category = node_data.get('Category', 'Unknown')
        date = node_data.get('Date', 'Unknown')
        
        context += f"📊 {data_type.title()} | Group: {category} | Date: {date}\n"
        
        # Include key financial metrics with better formatting
        key_fields = ['Net worth', 'Assets', 'Real estate', 'Corporate equities and mutual fund shares', 
                     'Liabilities', 'Home mortgages', 'Consumer credit', 'Median Income', 'Mean Income']
        
        for field in key_fields:
            if field in node_data and node_data[field] is not None:
                try:
                    # Try to convert to billions for large numbers
                    value = float(node_data[field])
                    if abs(value) >= 1_000:
                        value_display = f"${value/1000:.1f}B"
                    else:
                        value_display = f"${value:,.0f}"
                    context += f"  • {field}: {value_display}\n"
                except (ValueError, TypeError):
                    context += f"  • {field}: {node_data[field]}\n"
        
        context += "\n"
    
    return context

def get_graph_rag_context(question: str, graph: nx.Graph) -> str:
    """
    Performs the enhanced GraphRAG process for wealth inequality data:
    1. Extracts entities using NLP and wealth-specific patterns
    2. Performs hybrid (keyword + semantic) graph search
    3. Analyzes trends in the data
    4. Fetches local/government data for geographic entities
    5. Provides context with trend insights and recommendations
    """
    # Extract entities with enhanced understanding
    entity_data = extract_entities(question)
    entities_list = entity_data['entities_list']
    query_type = entity_data['query_type']
    
    logger.info(f"Query type: {query_type}, Entities: {entities_list}")
    
    # Perform hybrid graph search
    relevant_nodes = search_graph(graph, entities_list)
    logger.info(f"Found {len(relevant_nodes)} relevant nodes from Federal Reserve data")
    
    # If no relevant nodes found, provide general wealth context
    if not relevant_nodes:
        logger.info("No specific nodes found, providing general wealth context")
        general_entities = ["wealth", "income"]
        relevant_nodes = search_graph(graph, general_entities)
    
    # Check for geographic entities
    geographic_entities = entity_data['geographic']
    local_nodes = []
    
    if geographic_entities:
        logger.info(f"Geographic entities detected: {geographic_entities}")
        for location in geographic_entities:
            # Try to find government data
            try:
                # Simplified API call - in production would map to proper state codes
                state_code = location[:2].upper() if len(location) > 0 else None
                if state_code:
                    indicators = get_local_economic_indicators(state_code)
                    if indicators:
                        local_nodes.append(indicators)
                        logger.info(f"Added economic indicators for {location}")
            except Exception as e:
                logger.warning(f"Could not fetch government data for {location}: {e}")
            
            # Fallback to web search
            try:
                local_data = search_and_extract_web_data(location, 
                                                        preferred_domains=['census.gov', 'bls.gov'])
                if local_data:
                    add_node_to_graph(graph, local_data)
                    local_nodes.append(local_data)
                    logger.info(f"Added web-sourced data for {location}")
            except Exception as e:
                logger.warning(f"Web search failed for {location}: {e}")
    
    # Build context string
    context = create_context_from_nodes(relevant_nodes)
    
    # Add trend analysis if query is trend-related
    if query_type == 'trend' and relevant_nodes:
        try:
            trend_analysis = analyze_wealth_gap_trends(relevant_nodes)
            context += "\n\n=== TREND ANALYSIS ===\n"
            context += f"Overall trend: {trend_analysis.get('overall_trend', {})}\n"
        except Exception as e:
            logger.warning(f"Trend analysis failed: {e}")
    
    # Add policy recommendations if requested
    if query_type == 'policy' and relevant_nodes:
        try:
            from policy_recommendations import get_policy_recommendations_for_region
            
            region_data = {
                'gini_coefficient': 0.45,  # Would be calculated from data
                'top_1_percent_share': 35,
                'bottom_50_percent_share': 3,
                'unemployment_rate': 4.5,
                'poverty_rate': 12,
                'region': geographic_entities[0] if geographic_entities else 'National'
            }
            
            recommendations = get_policy_recommendations_for_region(region_data)
            
            if recommendations:
                context += "\n\n=== POLICY RECOMMENDATIONS ===\n"
                for rec in recommendations[:3]:  # Top 3 recommendations
                    context += f"\n• {rec['title']} (Priority: {rec.get('priority_score', 0)}/10)\n"
                    context += f"  {rec['description']}\n"
        except Exception as e:
            logger.warning(f"Policy recommendation generation failed: {e}")
    
    # Append local data
    if local_nodes:
        context += "\n\n=== LOCAL & REGIONAL DATA ===\n"
        for local in local_nodes:
            location_name = local.get('Neighborhood Name', local.get('region', 'Local area'))
            context += f"\nData for {location_name}:\n"
            for k, v in local.items():
                if k not in ['Neighborhood Name', 'data_type'] and not str(v).startswith('http'):
                    context += f"  {k}: {v}\n"
    
    # If geographic entities were requested but nothing found
    if geographic_entities and not local_nodes:
        location_text = ", ".join(geographic_entities)
        context += f"\n\nNote: While I searched for specific data on {location_text}, "
        context += "the Federal Reserve data above represents overall U.S. wealth distribution patterns."
    
    return context

def add_node_to_graph(graph: nx.Graph, node_data: Dict[str, Any]):
    """Adds a new node to the graph from a dictionary of data."""
    location_name = node_data.get("Neighborhood Name")
    if not location_name:
        print("Cannot add node to graph: 'Neighborhood Name' is missing from web data.")
        return

    # Create a stable node id for local data
    node_id = f"local_{location_name.replace(' ', '_')}"
    # If this node id already exists, merge; otherwise add with explicit data_type
    if node_id not in graph:
        print(f"Adding new node '{node_id}' to the graph from web search.")
        # Ensure the node has a data_type so that search_graph can match it
        node_entry = dict(node_data)
        node_entry.setdefault('data_type', 'local')
        graph.add_node(node_id, **node_entry)
    else:
        print(f"Node '{node_id}' already exists. Merging data (web data takes precedence).")
        graph.nodes[node_id].update(node_data)
