import spacy
import networkx as nx
from typing import List, Dict, Any
from thefuzz import process, fuzz
from web_search import search_and_extract_web_data

# Load the spaCy model
try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    print("Downloading spaCy model 'en_core_web_sm'...")
    import spacy.cli
    spacy.cli.download("en_core_web_sm")
    nlp = spacy.load("en_core_web_sm")

def extract_entities(question: str) -> List[str]:
    """Extracts wealth-related and geographic entities from the question."""
    doc = nlp(question)
    entities = []
    
    # Extract geographic entities
    geographic_entities = [ent.text for ent in doc.ents if ent.label_ in ["GPE", "LOC"]]
    
    # Add common tech cities and industry terms that might not be caught by NER
    tech_cities = ["Silicon Valley", "Bay Area", "tech cities", "Seattle", "San Francisco", 
                   "Austin", "Boston", "New York", "Los Angeles", "Denver", "Portland"]
    question_lower = question.lower()
    
    for city in tech_cities:
        if city.lower() in question_lower:
            geographic_entities.append(city)
    
    # Look for wealth-related terms
    wealth_terms = {
        "top 1%": "TopPt1",
        "top 0.1%": "TopPt1", 
        "top one percent": "TopPt1",
        "richest": "TopPt1",
        "wealthy": "TopPt1",
        "next 9": "Next9",
        "next 40": "Next40", 
        "middle class": "Next40",
        "bottom 50": "Bottom50",
        "bottom half": "Bottom50",
        "poorest": "Bottom50",
        "remaining top 1": "RemainingTop1"
    }
    
    # Look for data types
    data_types = {
        "wealth": "networth",
        "net worth": "networth", 
        "income": "income",
        "assets": "networth",
        "race": "race",
        "racial": "race",
        "age": "age",
        "education": "education",
        "generation": "generation"
    }
    
    # Extract wealth percentile groups
    for term, group in wealth_terms.items():
        if term in question_lower:
            entities.append(group)
    
    # Extract data types  
    for term, dtype in data_types.items():
        if term in question_lower:
            entities.append(dtype)
            
    # Add geographic entities with a special marker
    for geo in geographic_entities:
        entities.append(f"GEO:{geo}")
            
    # If no specific terms found, default to wealth data
    if not entities:
        entities = ["networth", "TopPt1", "Bottom50"]
        
    return entities

def search_graph(graph: nx.Graph, entities: List[str]) -> List[Dict[str, Any]]:
    """Searches the graph for nodes matching wealth-related entities."""
    relevant_nodes = []
    
    for node_id, node_data in graph.nodes(data=True):
        # Check if any entity matches this node
        for entity in entities:
            # Check multiple match conditions
            # 1) direct data_type/category match
            if (node_data.get('data_type') == entity or 
                node_data.get('category') == entity):
                relevant_nodes.append(node_data)
                break

            # 2) string match in node id
            if entity.lower() in node_id.lower():
                relevant_nodes.append(node_data)
                break

            # 3) geographic entity matching: allow matching against stored "Neighborhood Name"
            if entity.startswith("GEO:"):
                geo = entity[4:].lower()
                neighborhood = str(node_data.get('Neighborhood Name', '')).lower()
                if geo == neighborhood or geo in neighborhood:
                    relevant_nodes.append(node_data)
                    break
    
    # If we have too many nodes, filter to most recent data
    if len(relevant_nodes) > 10:
        # Sort by date and take most recent
        relevant_nodes = sorted(relevant_nodes, 
                              key=lambda x: x.get('Date', '1989:Q1'), 
                              reverse=True)[:10]
    
    return relevant_nodes

def create_context_from_nodes(nodes: List[Dict[str, Any]]) -> str:
    """Creates a string context from Federal Reserve wealth data nodes."""
    if not nodes:
        return "No specific data found for the wealth groups or time periods in the question."
    
    context = "Here is Federal Reserve data on wealth distribution:\n\n"
    
    for node_data in nodes:
        data_type = node_data.get('data_type', 'Unknown')
        category = node_data.get('Category', 'Unknown')
        date = node_data.get('Date', 'Unknown')
        
        context += f"Data Type: {data_type.title()}, Group: {category}, Date: {date}\n"
        
        # Include key financial metrics
        key_fields = ['Net worth', 'Assets', 'Real estate', 'Corporate equities and mutual fund shares', 
                     'Liabilities', 'Home mortgages', 'Consumer credit']
        
        for field in key_fields:
            if field in node_data and node_data[field] is not None:
                # Convert to billions for readability
                try:
                    value_billions = float(node_data[field]) / 1000
                    context += f"  {field}: ${value_billions:.1f} billion\n"
                except (ValueError, TypeError):
                    context += f"  {field}: {node_data[field]}\n"
        
        context += "\n"
    
    return context

def get_graph_rag_context(question: str, graph: nx.Graph) -> str:
    """
    Performs the GraphRAG process for wealth inequality data:
    1. Extracts wealth-related and geographic entities from the question.
    2. Searches the graph for those entities.
    3. If geographic entities are found, uses Exa search to find local data.
    4. Creates a context string from the search results.
    """
    entities = extract_entities(question)
    print(f"Extracted entities: {entities}")
    
    # Check if there are geographic entities
    geographic_entities = [e for e in entities if e.startswith("GEO:")]
    wealth_entities = [e for e in entities if not e.startswith("GEO:")]
    
    # First, gather relevant national wealth nodes
    relevant_nodes = search_graph(graph, wealth_entities)
    print(f"Found {len(relevant_nodes)} relevant nodes from Federal Reserve data")

    # If no relevant nodes found, provide general wealth context
    if not relevant_nodes:
        print("No specific nodes found, providing general wealth context")
        # Get some recent wealth data as fallback
        general_entities = ["networth", "TopPt1", "Bottom50"]
        relevant_nodes = search_graph(graph, general_entities)

    # If geographic entities were found, try to find local nodes already in graph
    local_nodes = []
    if geographic_entities:
        locations = [e.replace("GEO:", "") for e in geographic_entities]
        print(f"=== GEOGRAPHIC ENTITIES DETECTED: {geographic_entities} ===")
        for location in locations:
            # Search graph for existing local node matches
            geo_entity = f"GEO:{location}"
            matches = search_graph(graph, [geo_entity])
            if matches:
                print(f"Found {len(matches)} existing local node(s) for {location} in graph")
                local_nodes.extend(matches)
            else:
                print(f"No local node in graph for {location}, will query Exa")
                # Attempt Exa search to fetch local data
                # Prefer official government domains for known cities to get authoritative metrics
                city_domain_map = {
                    'seattle': ['seattle.gov', 'kingcounty.gov'],
                    'king county': ['kingcounty.gov'],
                    'san francisco': ['sfgov.org', 'sf.gov'],
                    'new york': ['ny.gov', 'nyc.gov']
                }
                loc_key = location.strip().lower()
                preferred = city_domain_map.get(loc_key)
                local_data = search_and_extract_web_data(location, preferred_domains=preferred)
                print(f"=== Local data result for {location}: {local_data} ===")
                if local_data and len(local_data) > 1:
                    # Ensure data_type is set
                    local_data.setdefault('data_type', 'local')
                    add_node_to_graph(graph, local_data)
                    # Add to local_nodes for context assembly
                    local_nodes.append(local_data)
                else:
                    print(f"No useful local data found for {location}")

    # Build context string starting with national data
    context = create_context_from_nodes(relevant_nodes)

    # Append any local data found (either preexisting or fetched)
    if local_nodes:
        for local in local_nodes:
            location_name = local.get('Neighborhood Name', 'Local area')
            context += f"\n\n=== Local data for {location_name} ===\n"
            # If structured metrics exist, prefer those
            for k, v in local.items():
                if k in ['Neighborhood Name']:
                    continue
                context += f"{k}: {v}\n"
    else:
        # If geographic entities were asked but nothing found, add a helpful note
        if geographic_entities:
            location_text = ", ".join([e.replace('GEO:', '') for e in geographic_entities])
            context += f"\n\nNote: While I searched for specific data on {location_text}, no detailed local economic data was found. "
            context += "The Federal Reserve data above represents overall U.S. wealth distribution patterns."

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
