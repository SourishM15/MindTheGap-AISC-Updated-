import os
import json
from exa_py import Exa
from dotenv import load_dotenv
from langchain_openai import OpenAI
from langchain_core.prompts import PromptTemplate

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
EXA_API_KEY = os.getenv("EXA_API_KEY")

if not EXA_API_KEY:
    print("WARNING: EXA_API_KEY not found in .env file. Web search functionality will be limited.")
    exa = None
else:
    exa = Exa(api_key=EXA_API_KEY)

llm = OpenAI(temperature=0, api_key=OPENAI_API_KEY)

def _extract_structured_data(content: str, query: str) -> dict:
    """
    Uses an LLM to extract structured demographic and inequality data from raw text.
    """
    print(f"Extracting structured data for: {query}")
    
    extraction_template = """
    You are a data extraction specialist. From the following text about '{query}', extract key-value pairs related to demographics and inequality.
    Focus on metrics like: Population, Median Household Income, Poverty Rate, Racial Demographics (e.g., Percent White, Percent Black), Unemployment Rate, and other relevant statistics.
    Return the data as a single, clean JSON object. If you cannot find a specific metric, omit it from the JSON.

    Text to analyze:
    ---
    {content}
    ---

    JSON Output:
    """
    prompt = PromptTemplate(template=extraction_template, input_variables=["content", "query"])
    
    extractor_chain = prompt | llm
    
    try:
        result_str = extractor_chain.invoke({"content": content, "query": query})
        # Clean the string to make sure it's valid JSON
        # The LLM might sometimes include markdown or other text
        json_str = result_str[result_str.find('{'):result_str.rfind('}')+1]
        data = json.loads(json_str)
        print(f"Successfully extracted data: {data}")
        return data
    except (json.JSONDecodeError, IndexError) as e:
        print(f"Error parsing JSON from LLM output: {e}\nOutput was: {result_str}")
        return {}
    except Exception as e:
        print(f"An unexpected error occurred during data extraction: {e}")
        return {}

def search_and_extract_web_data(query: str, preferred_domains: list = None) -> dict:
    """
    Performs a web search using Exa, then extracts structured data from the top result.
    """
    if not exa:
        print("EXA_API_KEY not available. Skipping web search.")
        return {}
        
    try:
        print(f"Performing Exa web search for: {query}")

        base_query = f"{query} demographics income inequality wealth economic data"

        # If preferred domains are provided, try site-restricted searches first
        search_response = None
        if preferred_domains:
            for dom in preferred_domains:
                try_query = f"{base_query} site:{dom}"
                print(f"Trying site-restricted search: {try_query}")
                sr = exa.search(query=try_query, type="neural", num_results=3)
                if sr and getattr(sr, 'results', None):
                    search_response = sr
                    print(f"Site-restricted search for {dom} returned {len(sr.results)} results")
                    break

        # If no site-restricted results, fall back to a general search
        if not search_response:
            search_response = exa.search(query=base_query, type="neural", num_results=3)

        if not getattr(search_response, 'results', None):
            print("Exa search returned no results.")
            return {}

        result_urls = [getattr(result, 'url', None) for result in search_response.results if getattr(result, 'url', None)]
        if not result_urls:
            print("No result URLs found in search results.")
            return {}

        print(f"Getting content for URLs: {result_urls}")

        contents_response = exa.get_contents(urls=result_urls, text=True)

        # Use the first result's content
        if not getattr(contents_response, 'results', None):
            print("No contents returned from Exa get_contents.")
            return {}

        top_result = contents_response.results[0]
        print(f"Top result URL: {top_result.url}")
        print(f"Top result title: {getattr(top_result, 'title', 'No title')}")
        
        # Get the text content
        raw_content = ""
        if hasattr(top_result, 'text') and top_result.text:
            raw_content = top_result.text
            print(f"Content length: {len(raw_content)} characters")
        else:
            print("No text content available from search result.")
            return {}
        
        # Try to extract structured metrics from the content using the LLM extractor
        try:
            structured = _extract_structured_data(raw_content, query)
        except Exception as e:
            print(f"Extractor failed: {e}")
            structured = {}

        # Accept structured only if it contains at least one non-empty metric
        def _has_useful_values(d: dict) -> bool:
            for k, v in d.items():
                if k in ['Neighborhood Name', 'Source', 'data_type']:
                    continue
                if v is not None and v != "" and str(v).strip().lower() != "none":
                    return True
            return False

        if structured and _has_useful_values(structured):
            # Normalize and annotate the returned structured data
            structured['Neighborhood Name'] = query
            structured['Source'] = top_result.url
            structured['data_type'] = 'local'
            print(f"Returning structured local data: {structured}")
            return structured

        # Fallback: return basic content preview so we at least have something
        basic_data = {
            'Neighborhood Name': query,
            'Source': top_result.url,
            'Title': getattr(top_result, 'title', 'No title'),
            'Content_Preview': raw_content[:500] + "..." if len(raw_content) > 500 else raw_content,
            'data_type': 'local'
        }

        print(f"Returning fallback basic data: {basic_data}")
        return basic_data

    except Exception as e:
        print(f"An error occurred during Exa search and extraction: {e}")
        import traceback
        traceback.print_exc()
        return {}
