"""
Vector Embedding Module for Semantic Search
Converts wealth and demographic data into embeddings for semantic similarity search
"""

import os
import json
import numpy as np
from typing import List, Dict, Tuple, Any
from sentence_transformers import SentenceTransformer
import faiss
from datetime import datetime

# Initialize the embedding model
try:
    model = SentenceTransformer('all-MiniLM-L6-v2')
    print("✓ Embedding model loaded successfully")
except Exception as e:
    print(f"Error loading embedding model: {e}")
    model = None


class VectorStore:
    """Manages embeddings and semantic search for wealth data"""
    
    def __init__(self, embedding_cache_path: str = "embeddings_cache.json"):
        self.embedding_cache_path = embedding_cache_path
        self.embeddings_index = None
        self.metadata = []
        self.embeddings_cache = self._load_cache()
        if model is None:
            print("WARNING: Embedding model not available. Semantic search will be disabled.")
    
    def _load_cache(self) -> Dict:
        """Load cached embeddings to avoid recomputation"""
        if os.path.exists(self.embedding_cache_path):
            try:
                with open(self.embedding_cache_path, 'r') as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error loading cache: {e}")
        return {}
    
    def _save_cache(self):
        """Save embeddings cache to disk"""
        try:
            with open(self.embedding_cache_path, 'w') as f:
                json.dump(self.embeddings_cache, f)
        except Exception as e:
            print(f"Error saving cache: {e}")
    
    def embed_text(self, text: str) -> np.ndarray:
        """Generate embeddings for text with caching"""
        if model is None:
            return np.zeros(384)  # Return zero vector if model unavailable
        
        # Check cache first
        if text in self.embeddings_cache:
            return np.array(self.embeddings_cache[text])
        
        # Generate embedding
        embedding = model.encode(text, convert_to_numpy=True)
        self.embeddings_cache[text] = embedding.tolist()
        
        return embedding
    
    def add_documents(self, documents: List[Dict[str, Any]]):
        """Add documents to the vector store"""
        if model is None:
            print("Cannot add documents: embedding model not available")
            return
        
        embeddings_list = []
        self.metadata = []
        
        for doc in documents:
            # Create text representation of document
            doc_text = self._document_to_text(doc)
            embedding = self.embed_text(doc_text)
            
            embeddings_list.append(embedding)
            self.metadata.append(doc)
        
        if embeddings_list:
            # Create FAISS index
            embeddings_array = np.array(embeddings_list).astype('float32')
            self.embeddings_index = faiss.IndexFlatL2(embeddings_array.shape[1])
            self.embeddings_index.add(embeddings_array)
            
            self._save_cache()
            print(f"✓ Added {len(documents)} documents to vector store")
    
    def _document_to_text(self, doc: Dict[str, Any]) -> str:
        """Convert document to searchable text"""
        parts = []
        
        # Prioritize important fields
        important_fields = [
            'Category', 'Neighborhood Name', 'data_type', 'Date',
            'wealth_group', 'demographic_category'
        ]
        
        for field in important_fields:
            if field in doc:
                parts.append(f"{field}: {doc[field]}")
        
        # Add other relevant fields
        for key, value in doc.items():
            if key not in important_fields and isinstance(value, (str, int, float)):
                if not str(value).startswith('http'):  # Skip URLs
                    parts.append(f"{key}: {value}")
        
        return " ".join(parts)
    
    def search(self, query: str, top_k: int = 5) -> List[Tuple[Dict, float]]:
        """Search for similar documents using semantic similarity"""
        if model is None or self.embeddings_index is None:
            print("Cannot search: embedding model or index not available")
            return []
        
        query_embedding = self.embed_text(query)
        query_embedding = np.array([query_embedding]).astype('float32')
        
        distances, indices = self.embeddings_index.search(query_embedding, min(top_k, len(self.metadata)))
        
        results = []
        for idx, distance in zip(indices[0], distances):
            if idx < len(self.metadata):
                # Convert L2 distance to similarity score (0-1)
                similarity = 1 / (1 + distance)
                results.append((self.metadata[idx], similarity))
        
        return results
    
    def hybrid_search(self, query: str, keyword_matches: List[Dict], top_k: int = 5) -> List[Tuple[Dict, float]]:
        """
        Hybrid search combining semantic similarity with keyword matching
        Boosts score of keyword-matched documents
        """
        semantic_results = self.search(query, top_k * 2)
        
        # Create a scoring dict
        scored_docs = {}
        
        # Add semantic scores
        for doc, similarity in semantic_results:
            doc_id = id(doc)
            scored_docs[doc_id] = {
                'doc': doc,
                'semantic_score': similarity,
                'keyword_score': 0.0
            }
        
        # Boost scores for keyword matches
        for keyword_doc in keyword_matches:
            doc_id = id(keyword_doc)
            if doc_id not in scored_docs:
                scored_docs[doc_id] = {
                    'doc': keyword_doc,
                    'semantic_score': 0.0,
                    'keyword_score': 0.8
                }
            else:
                scored_docs[doc_id]['keyword_score'] = 0.8
        
        # Combine scores (70% semantic, 30% keyword)
        ranked = sorted(
            scored_docs.values(),
            key=lambda x: (0.7 * x['semantic_score'] + 0.3 * x['keyword_score']),
            reverse=True
        )
        
        return [(item['doc'], item['semantic_score']) for item in ranked[:top_k]]


def create_wealth_query_embedding(query: str) -> Dict[str, Any]:
    """
    Extract structured information from a wealth-related query
    Returns embedding attributes useful for searching
    """
    vector_store = VectorStore()
    
    # Parse common wealth-related terms
    wealth_groups = {
        'top 0.1%': 'toppt1', 'top one-tenth percent': 'toppt1',
        'top 1%': 'top1', 'top one percent': 'top1',
        'next 9%': 'next9', 'next nine percent': 'next9',
        'next 40%': 'next40', 'middle class': 'next40',
        'bottom 50%': 'bottom50', 'bottom half': 'bottom50'
    }
    
    demographics = {
        'race': 'race', 'racial': 'race', 'ethnicity': 'race',
        'age': 'age', 'generation': 'generation',
        'education': 'education', 'income': 'income',
        'employment': 'employment'
    }
    
    locations = {}  # Could expand with known cities
    
    query_lower = query.lower()
    
    # Extract wealth group
    wealth_group = None
    for term, group in wealth_groups.items():
        if term in query_lower:
            wealth_group = group
            break
    
    # Extract demographics
    demographic = None
    for term, demo in demographics.items():
        if term in query_lower:
            demographic = demo
            break
    
    # Embed the full query
    embedding = vector_store.embed_text(query)
    
    return {
        'query': query,
        'embedding': embedding,
        'wealth_group': wealth_group,
        'demographic': demographic,
        'timestamp': datetime.now().isoformat()
    }
