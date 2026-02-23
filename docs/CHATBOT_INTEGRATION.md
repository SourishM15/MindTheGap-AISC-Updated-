# Chatbot Integration Guide: Using Enriched Regional Data

## Overview

This guide shows how to integrate the enriched regional data and chatbot training into the FastAPI backend to improve chatbot responses with government data.

## Architecture

```
FastAPI Backend (main.py)
        ↓
    Chat Endpoint
        ↓
    Knowledge Base Loader
        ↓
    S3: knowledge-base.json
    S3: regional-insights.jsonl
    S3: economic-correlations.json
        ↓
    Enhanced System Prompt
    + Regional Facts
    + Correlation Rules
    + Few-Shot Examples
        ↓
    ChatGPT with Context
        ↓
    Response with Government Data
```

## Step 1: Load Knowledge Base into Memory

Add to `main.py` initialization:

```python
import json
import boto3
from functools import lru_cache

@lru_cache(maxsize=1)
def load_knowledge_base():
    """Load chatbot knowledge base from S3"""
    try:
        s3_client = boto3.client('s3', region_name='us-east-2')
        
        # Load knowledge base
        response = s3_client.get_object(
            Bucket='mindthegap-gov-data',
            Key='chatbot-training-data/knowledge-base.json'
        )
        knowledge_base = json.loads(response['Body'].read())
        
        # Load correlation patterns
        response = s3_client.get_object(
            Bucket='mindthegap-gov-data',
            Key='chatbot-training-data/economic-correlations.json'
        )
        correlations = json.loads(response['Body'].read())
        
        return {
            'knowledge_base': knowledge_base,
            'correlations': correlations
        }
    except Exception as e:
        print(f"Warning: Could not load knowledge base from S3: {e}")
        return {'knowledge_base': None, 'correlations': None}

# Initialize on startup
ENRICHMENT_DATA = load_knowledge_base()
```

## Step 2: Create Enhanced System Prompt

```python
def get_enhanced_system_prompt():
    """Create system prompt with regional knowledge"""
    
    base_prompt = """You are the MindTheGap AI Assistant, an expert on wealth inequality 
    and economic disparity across the United States. You have access to comprehensive 
    government data on demographics, employment, and wealth.
    
    Your responses should:
    1. Use real government data (Census, BLS, FRED) when answering about specific states
    2. Explain wealth inequality through economic patterns
    3. Compare states objectively using data
    4. Reference education, employment, and income relationships
    5. Acknowledge regional economic differences
    """
    
    # Add learned patterns
    if ENRICHMENT_DATA['correlations']:
        patterns_text = "\nKnown Economic Patterns:\n"
        for i, pattern in enumerate(ENRICHMENT_DATA['correlations'][:5], 1):
            confidence = pattern.get('confidence', 0) * 100
            patterns_text += f"{i}. {pattern['pattern']} ({confidence:.0f}% confidence)\n"
            patterns_text += f"   → {pattern['description']}\n"
        base_prompt += patterns_text
    
    # Add regional facts
    if ENRICHMENT_DATA['knowledge_base'] and 'regional_facts' in ENRICHMENT_DATA['knowledge_base']:
        facts_text = "\nRegional Economic Facts:\n"
        for region, facts in ENRICHMENT_DATA['knowledge_base']['regional_facts'].items():
            facts_text += f"\n{region}:\n"
            for fact in facts[:2]:  # Include top 2 facts per region
                facts_text += f"  • {fact}\n"
        base_prompt += facts_text
    
    return base_prompt

# Update the chat endpoint system prompt
SYSTEM_PROMPT = get_enhanced_system_prompt()
```

## Step 3: Add Few-Shot Examples to Prompts

```python
def get_few_shot_examples(user_message: str):
    """Get relevant few-shot examples based on user query"""
    
    if not ENRICHMENT_DATA['knowledge_base']:
        return ""
    
    few_shot = ENRICHMENT_DATA['knowledge_base'].get('few_shot_examples', [])
    
    # Find relevant examples based on message content
    relevant_examples = []
    
    if any(word in user_message.lower() for word in ['compare', 'vs', 'versus', 'difference']):
        state_examples = [ex for ex in few_shot if ex.get('category') == 'state_comparisons']
        relevant_examples.extend(state_examples[:2])
    
    if any(word in user_message.lower() for word in ['inequality', 'wealth', 'gap', 'disparity']):
        inequality_examples = [ex for ex in few_shot if ex.get('category') == 'wealth_inequality']
        relevant_examples.extend(inequality_examples[:2])
    
    if any(word in user_message.lower() for word in ['trend', 'growing', 'declining', 'change']):
        trend_examples = [ex for ex in few_shot if ex.get('category') == 'economic_trends']
        relevant_examples.extend(trend_examples[:2])
    
    # Format examples for prompt
    if relevant_examples:
        examples_text = "\nHere are similar questions and answers for reference:\n\n"
        for ex in relevant_examples[:3]:
            examples_text += f"Example Question: {ex.get('query', '')}\n"
            examples_text += f"Example Answer: {ex.get('response', '')}\n\n"
        return examples_text
    
    return ""
```

## Step 4: Update Chat Endpoint

Replace or enhance the existing chat endpoint:

```python
@app.post("/api/chat")
async def chat(request: dict):
    """Enhanced chat endpoint with enriched regional data"""
    
    user_message = request.get("message", "")
    history = request.get("conversation_history", [])
    
    # Get few-shot examples if relevant
    few_shot_examples = get_few_shot_examples(user_message)
    
    # Build messages for ChatGPT
    messages = [
        {
            "role": "system",
            "content": SYSTEM_PROMPT + few_shot_examples
        }
    ]
    
    # Add conversation history
    for msg in history[-10:]:  # Last 10 messages for context
        messages.append({
            "role": msg.get("role", "user"),
            "content": msg.get("content", "")
        })
    
    # Add current message
    messages.append({
        "role": "user",
        "content": user_message
    })
    
    # Call ChatGPT with enriched context
    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=messages,
            temperature=0.7,
            max_tokens=1000
        )
        
        assistant_message = response.choices[0].message.content
        
        # Add enrichment metadata to response
        response_data = {
            "response": assistant_message,
            "metadata": {
                "has_enrichment": bool(ENRICHMENT_DATA['knowledge_base']),
                "patterns_loaded": len(ENRICHMENT_DATA['correlations']) if ENRICHMENT_DATA['correlations'] else 0
            }
        }
        
        return response_data
        
    except Exception as e:
        return {
            "response": f"Error: {str(e)}",
            "error": True
        }
```

## Step 5: Add State Lookup Endpoint

```python
def find_state_in_message(message: str) -> str | None:
    """Extract state name from user message"""
    
    state_names = [
        'alabama', 'alaska', 'arizona', 'arkansas', 'california',
        'colorado', 'connecticut', 'delaware', 'florida', 'georgia',
        'hawaii', 'idaho', 'illinois', 'indiana', 'iowa',
        'kansas', 'kentucky', 'louisiana', 'maine', 'maryland',
        'massachusetts', 'michigan', 'minnesota', 'mississippi', 'missouri',
        'montana', 'nebraska', 'nevada', 'new hampshire', 'new jersey',
        'new mexico', 'new york', 'north carolina', 'north dakota', 'ohio',
        'oklahoma', 'oregon', 'pennsylvania', 'rhode island', 'south carolina',
        'south dakota', 'tennessee', 'texas', 'utah', 'vermont',
        'virginia', 'washington', 'west virginia', 'wisconsin', 'wyoming'
    ]
    
    message_lower = message.lower()
    for state in state_names:
        if state in message_lower:
            return state.title()
    
    return None

@app.get("/api/enriched-state/{state_name}")
async def get_enriched_state(state_name: str):
    """Get enriched data for a specific state"""
    
    try:
        s3_client = boto3.client('s3', region_name='us-east-2')
        
        state_slug = state_name.lower().replace(' ', '-')
        
        response = s3_client.get_object(
            Bucket='mindthegap-gov-data',
            Key=f'enriched-regional-data/state-profiles/{state_slug}/profile.json'
        )
        
        profile = json.loads(response['Body'].read())
        
        return {
            "success": True,
            "state": state_name,
            "profile": profile
        }
        
    except s3_client.exceptions.NoSuchKey:
        return {
            "success": False,
            "error": f"No enriched data found for {state_name}"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
```

## Step 6: Add Regional Comparison Endpoint

```python
@app.get("/api/compare-states")
async def compare_states(state1: str, state2: str):
    """Compare two states using enriched data"""
    
    try:
        s3_client = boto3.client('s3', region_name='us-east-2')
        
        # Get both state profiles
        states_data = {}
        for state in [state1, state2]:
            state_slug = state.lower().replace(' ', '-')
            response = s3_client.get_object(
                Bucket='mindthegap-gov-data',
                Key=f'enriched-regional-data/state-profiles/{state_slug}/profile.json'
            )
            states_data[state] = json.loads(response['Body'].read())
        
        # Extract key metrics for comparison
        comparison = {
            "states": [state1, state2],
            "comparison": {
                "population": {
                    state1: states_data[state1].get('demographics', {}).get('population'),
                    state2: states_data[state2].get('demographics', {}).get('population')
                },
                "median_income": {
                    state1: states_data[state1].get('demographics', {}).get('median_household_income'),
                    state2: states_data[state2].get('demographics', {}).get('median_household_income')
                },
                "education": {
                    state1: states_data[state1].get('demographics', {}).get('education_bachelor_and_above'),
                    state2: states_data[state2].get('demographics', {}).get('education_bachelor_and_above')
                },
                "inequality_index": {
                    state1: states_data[state1].get('derived_metrics', {}).get('inequality_index'),
                    state2: states_data[state2].get('derived_metrics', {}).get('inequality_index')
                },
                "economic_health_score": {
                    state1: states_data[state1].get('derived_metrics', {}).get('economic_health_score'),
                    state2: states_data[state2].get('derived_metrics', {}).get('economic_health_score')
                }
            }
        }
        
        return comparison
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
```

## Step 7: Test Enhanced Chatbot

```bash
# Test basic query
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Tell me about the wealth gap in California",
    "conversation_history": []
  }'

# Test state lookup
curl http://localhost:8000/api/enriched-state/California

# Test state comparison  
curl "http://localhost:8000/api/compare-states?state1=Massachusetts&state2=Mississippi"
```

## Integration Checklist

- [ ] Run `python run_enrichment_pipeline.py --mode learning-only` to generate training data
- [ ] Copy enrichment integration code into main.py
- [ ] Update system prompt initialization
- [ ] Add few-shot example function
- [ ] Update chat endpoint with enriched context
- [ ] Add state lookup endpoint
- [ ] Add regional comparison endpoint
- [ ] Restart FastAPI server
- [ ] Test with state-specific queries
- [ ] Verify S3 data is loaded correctly
- [ ] Check ChatGPT responses include enriched data

## Example Chatbot Responses

**Before Integration:**
> "California has significant wealth inequality. Could you provide more details about what you'd like to know?"

**After Integration:**
> "California is the most populous state with 39.5 million people. With a median household income of $84,097 and an inequality index of 83.75, it faces substantial wealth disparities. The state's inequality correlates with its service sector economy (lower wages) and tech concentration. The education rate of 35.2% with bachelor degrees shows California's knowledge economy, but creates income gaps between the highly educated tech workers and service sector employees."

## Performance Optimization

### Cache Knowledge Base
```python
from functools import lru_cache
import time

@lru_cache(maxsize=1)
def load_knowledge_base():
    # Load once and cache
    ...

# Refresh cache periodically (hourly)
async def refresh_knowledge_cache():
    load_knowledge_base.cache_clear()
    load_knowledge_base()
```

### Batch State Lookups
```python
async def batch_get_enriched_states(state_names: list):
    """Efficient batch lookup of multiple states"""
    states_data = {}
    for state in state_names:
        try:
            data = await get_enriched_state(state)
            if data['success']:
                states_data[state] = data['profile']
        except:
            pass
    return states_data
```

## Monitoring & Logging

```python
import logging

logger = logging.getLogger("chatbot_enrichment")

@app.post("/api/chat")
async def chat(request: dict):
    user_message = request.get("message", "")
    
    # Log enrichment usage
    state = find_state_in_message(user_message)
    if state:
        logger.info(f"State query detected: {state}")
    
    has_enrichment = bool(ENRICHMENT_DATA['knowledge_base'])
    logger.info(f"Knowledge base available: {has_enrichment}")
    
    # ... rest of chat logic
```

## Troubleshooting

### Knowledge Base Not Loading
```python
# Debug: Check if knowledge base exists
import boto3
s3 = boto3.client('s3', region_name='us-east-2')
try:
    s3.head_object(Bucket='mindthegap-gov-data', Key='chatbot-training-data/knowledge-base.json')
    print("Knowledge base found in S3")
except:
    print("Knowledge base not found - run enrichment pipeline first")
```

### S3 Access Issues
```bash
# Verify AWS credentials
aws sts get-caller-identity

# Check S3 bucket
aws s3 ls s3://mindthegap-gov-data --region us-east-2
```

### ChatGPT Not Using Context
- Increase system prompt length limit if truncated
- Verify few-shot examples are being added
- Check ChatGPT response includes state-specific data

## Next Steps

1. **Deploy Enhanced Chatbot** - Push changes to production
2. **Monitor Response Quality** - Track if responses improve with enriched data
3. **Add Frontend Integration** - Show enriched data on dashboard
4. **Implement Regional Dashboard** - Visualize enriched state profiles
5. **Schedule Knowledge Refresh** - Update monthly as new government data arrives

---

**Benefits of Integration:**
- ✅ Chatbot responses backed by real government data
- ✅ Accurate state-specific statistics
- ✅ Learned economic patterns improve reasoning
- ✅ Few-shot examples improve response quality
- ✅ Regional facts provide context for comparisons
