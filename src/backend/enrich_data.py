import pandas as pd
import networkx as nx
import os
import json
import sys
import logging

# Add the backend directory to the Python path to resolve module imports
script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(script_dir)

from web_search import search_and_extract_web_data

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Define file paths relative to the script's location
project_root = os.path.dirname(os.path.dirname(script_dir))
csv_file_path = os.path.join(project_root, 'src', 'data', 'Demographics_Basic_Small.csv')
output_graph_path = os.path.join(project_root, 'src', 'data', 'expanded_graph.json')

def create_enriched_graph():
    """
    Reads data from the demographics CSV, enriches it with web search results,
    and saves it as a NetworkX graph.
    """
    if not os.path.exists(csv_file_path):
        logging.error(f"CSV file not found at: {csv_file_path}")
        return

    logging.info("Starting data enrichment process...")
    df = pd.read_csv(csv_file_path)
    G = nx.Graph()

    # Limiting to the first 10 rows for a quicker run as an example
    # Remove or adjust the .head(10) to process the full dataset
    for index, row in df.iterrows():
        neighborhood = row['Neighborhood Name']
        logging.info(f"Processing neighborhood: {neighborhood}")

        # Add the neighborhood as a node
        G.add_node(neighborhood, type='neighborhood')

        # Add attributes from the CSV
        for col, value in row.items():
            if pd.notna(value):
                G.add_node(neighborhood, **{col.replace(" ", "_").lower(): value})

        # Enrich with web search
        try:
            query = f"demographics and key facts about {neighborhood}, Seattle"
            logging.info(f"Performing web search for: '{query}'")
            extracted_data = search_and_extract_web_data(query)

            if extracted_data:
                logging.info(f"Found {len(extracted_data)} new data points for {neighborhood}.")
                for key, value in extracted_data.items():
                    # Add new info as attributes to the neighborhood node
                    G.add_node(neighborhood, **{key.lower(): value})
            else:
                logging.warning(f"No additional data found for {neighborhood}.")

        except Exception as e:
            logging.error(f"An error occurred while processing {neighborhood}: {e}")

    # Save the graph
    logging.info(f"Enrichment complete. Saving graph to {output_graph_path}")
    graph_data = nx.node_link_data(G)
    with open(output_graph_path, 'w') as f:
        json.dump(graph_data, f, indent=4)
    logging.info("Graph saved successfully.")

if __name__ == "__main__":
    # Ensure environment variables are set if needed by dependencies
    from dotenv import load_dotenv
    dotenv_path = os.path.join(project_root, '.env')
    load_dotenv(dotenv_path=dotenv_path)
    
    if not os.getenv("METAPHOR_API_KEY") or not os.getenv("OPENAI_API_KEY"):
        logging.error("API keys for METAPHOR_API_KEY or OPENAI_API_KEY are not set.")
        logging.error("Please create a .env file in the root directory with the keys.")
    else:
        create_enriched_graph()