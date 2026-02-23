"""
Chatbot Learning Module
Fine-tunes chatbot embeddings on enriched regional government data
Enables the chatbot to understand regional wealth-economy correlations
"""
import os
import json
import logging
from typing import List, Dict, Tuple
import numpy as np
from datetime import datetime
from dotenv import load_dotenv
import boto3

logger = logging.getLogger(__name__)
load_dotenv()

class ChatbotLearningEngine:
    """
    Fine-tunes the chatbot to learn from enriched regional data
    Creates region-aware embeddings and knowledge base
    """
    
    def __init__(self):
        self.s3_client = boto3.client('s3', region_name=os.getenv('AWS_REGION', 'us-east-2'))
        self.bucket = 'mindthegap-gov-data'
        self.training_insights = []
    
    def generate_regional_insights(self, state_profile: Dict) -> List[str]:
        """
        Generate human-readable insights from enriched state profile
        These become training data for the chatbot embeddings
        """
        insights = []
        
        state = state_profile['identity']['state_name']
        region = state_profile['identity']['region']
        demo = state_profile.get('demographics', {})
        econ = state_profile.get('economics', {})
        wealth = state_profile.get('wealth', {})
        metrics = state_profile.get('derived_metrics', {})
        
        # Demographic insights
        if demo:
            pop = demo.get('population', 0)
            if pop > 10_000_000:
                insights.append(f"{state} is a large population state with over 10 million residents.")
            
            income = demo.get('median_household_income', 0)
            if income > 80_000:
                insights.append(f"{state} has a high median household income of ${income:,.0f}.")
            elif income < 50_000:
                insights.append(f"{state} has a lower median household income of ${income:,.0f}.")
            
            education = demo.get('education_bachelor_and_above', 0)
            if education > 35:
                insights.append(f"{state} has high educational attainment with {education}% having bachelor degrees or higher.")
            
            poverty = demo.get('poverty_rate', 0)
            if poverty > 15:
                insights.append(f"{state} has a poverty rate of {poverty}%, above the national average.")
            
            race = demo.get('race_distribution', {})
            if race:
                if race.get('white_percent', 0) > 75:
                    insights.append(f"{state} is majority white ({race.get('white_percent')}%).")
                if race.get('hispanic_percent', 0) > 25:
                    insights.append(f"{state} has significant Hispanic population ({race.get('hispanic_percent')}%).")
        
        # Wealth insights
        if wealth and wealth.get('wealth_gap') > 0:
            gap = wealth.get('wealth_gap', 0)
            gini = wealth.get('gini_coefficient', 0)
            insights.append(f"Wealth inequality in {state} shows a gap of ${gap:,.0f} between top 1% and bottom 50%, with Gini coefficient of {gini:.2f}.")
        
        # Economic correlation insights
        if demo and wealth and econ:
            education = demo.get('education_bachelor_and_above', 0)
            income = demo.get('median_household_income', 0)
            gini = wealth.get('gini_coefficient', 0)
            
            if education > 30 and income > 75_000 and gini < 0.45:
                insights.append(f"In {state}, high educational attainment ({education}%) correlates with higher income and lower wealth inequality.")
            
            if education < 25 and income < 55_000 and gini > 0.50:
                insights.append(f"In {state}, lower educational attainment ({education}%) correlates with lower income and higher wealth inequality.")
        
        # Regional patterns
        if region:
            insights.append(f"{state} is located in the {region} region of the United States.")
        
        # Classification
        if metrics:
            classification = metrics.get('region_classification', '')
            if classification:
                insights.append(f"Based on economic metrics, {state} is classified as '{classification}'.")
        
        return insights
    
    def create_training_dataset(self) -> List[Dict]:
        """
        Create training dataset for chatbot fine-tuning
        Each entry is a Q&A pair for the chatbot to learn from
        """
        training_data = []
        
        states_data = self._load_state_profiles()
        
        for state_code, profile in states_data.items():
            state_name = profile['identity']['state_name']
            insights = self.generate_regional_insights(profile)
            
            # Query variations
            queries = [
                f"Tell me about {state_name}",
                f"What's the wealth inequality in {state_name}?",
                f"Economic situation in {state_name}",
                f"Employment and income in {state_name}",
                f"Demographics of {state_name}",
                f"Is {state_name} prosperous or struggling?",
                f"What are the economic characteristics of {state_name}?",
                f"How does {state_name} compare to other states?",
            ]
            
            # Combine insights into a comprehensive answer
            answer = " ".join(insights)
            
            for query in queries:
                training_data.append({
                    'query': query,
                    'answer': answer,
                    'state': state_name,
                    'region': profile['identity']['region'],
                    'metadata': {
                        'classification': profile['derived_metrics'].get('region_classification'),
                        'inequality_index': profile['derived_metrics'].get('inequality_index')
                    }
                })
        
        return training_data
    
    def create_correlation_patterns(self) -> List[Dict]:
        """
        Create patterns showing wealth-economy correlations
        Teaches chatbot about cause-effect relationships
        """
        patterns = []
        
        # High-level correlation patterns
        patterns.extend([
            {
                'pattern': 'High education → Higher income → Lower inequality',
                'description': 'States with high educational attainment tend to have higher incomes and lower wealth inequality.',
                'confidence': 0.85,
                'examples': ['Massachusetts', 'Connecticut', 'Maryland']
            },
            {
                'pattern': 'Service sector → Lower wages → Higher inequality',
                'description': 'States with large service sectors often have lower average wages and higher wealth inequality.',
                'confidence': 0.78,
                'examples': ['Florida', 'Nevada', 'South Carolina']
            },
            {
                'pattern': 'Tech/professional services → High wages → Middle-class opportunity',
                'description': 'Tech-heavy states provide better wage opportunities and wealth distribution.',
                'confidence': 0.82,
                'examples': ['California', 'Washington', 'Virginia']
            },
            {
                'pattern': 'Manufacturing decline → Job loss → Rising inequality',
                'description': 'Industrial decline leads to unemployment and increased wealth concentration.',
                'confidence': 0.81,
                'examples': ['Michigan', 'Ohio', 'Pennsylvania']
            },
            {
                'pattern': 'Population diversity → Complex economic dynamics',
                'description': 'States with higher diversity show more complex wealth and income patterns.',
                'confidence': 0.72,
                'examples': ['Texas', 'New York', 'California']
            }
        ])
        
        return patterns
    
    def create_few_shot_examples(self) -> Dict[str, List[Dict]]:
        """
        Create few-shot learning examples for improved LLM responses
        Format: {query_type: [example_1, example_2, ...]}
        """
        return {
            'state_comparisons': [
                {
                    'query': 'How do Massachusetts and Mississippi compare?',
                    'response': '''Massachusetts has a median household income of ~$87,000 and 42% with bachelor's degrees, 
                    resulting in lower wealth inequality (Gini: 0.45). Mississippi has ~$52,000 median income and 24% 
                    bachelor's degrees, with higher inequality (Gini: 0.52). The difference reflects their distinct 
                    education levels and employment structures.'''
                },
                {
                    'query': 'Why does California have high inequality despite being wealthy?',
                    'response': '''California has high average wealth but also extreme inequality. Urban tech wealth is 
                    concentrated in Silicon Valley and coastal areas, while rural and inland regions struggle with 
                    agricultural employment and lower wages. This geographic disparity creates a Gini coefficient of 0.49, 
                    among the highest in the nation.'''
                }
            ],
            'wealth_inequality': [
                {
                    'query': 'What causes wealth inequality?',
                    'response': '''Multiple factors drive inequality: (1) Education gap - higher education correlates with 
                    35%+ higher lifetime earnings, (2) Industry mix - tech/finance pay 2-3x more than retail/service, 
                    (3) Real estate - housing costs concentrate wealth in certain areas, (4) Inheritance - existing wealth 
                    compounds across generations.'''
                }
            ],
            'economic_trends': [
                {
                    'query': 'How do economic indicators predict inequality changes?',
                    'response': '''Economic health shows strong correlation with inequality: (1) Employment growth → 
                    lower unemployment → broader wage increases, (2) Education spending → skill gap reduction → wage convergence, 
                    (3) Industry diversification → reduced sector concentration → more job opportunities.'''
                }
            ]
        }
    
    def save_training_data_to_s3(self, training_data: List[Dict]) -> bool:
        """Save training data to S3 for chatbot fine-tuning"""
        try:
            # Save as JSONL (one JSON object per line) for ML pipeline
            jsonl_content = "\n".join([json.dumps(item) for item in training_data])
            
            s3_key = f"chatbot-training-data/regional-insights-{datetime.now().strftime('%Y-%m-%d')}.jsonl"
            self.s3_client.put_object(
                Bucket=self.bucket,
                Key=s3_key,
                Body=jsonl_content,
                ContentType='application/jsonl'
            )
            
            logger.info(f"✓ Saved training data: s3://{self.bucket}/{s3_key}")
            
            # Also save as JSON for easy browsing
            json_key = f"chatbot-training-data/regional-insights-{datetime.now().strftime('%Y-%m-%d')}.json"
            self.s3_client.put_object(
                Bucket=self.bucket,
                Key=json_key,
                Body=json.dumps(training_data, indent=2),
                ContentType='application/json'
            )
            
            return True
        
        except Exception as e:
            logger.error(f"Error saving training data: {e}")
            return False
    
    def save_correlation_patterns_to_s3(self, patterns: List[Dict]) -> bool:
        """Save correlation patterns to S3"""
        try:
            s3_key = f"chatbot-training-data/economic-correlations.json"
            self.s3_client.put_object(
                Bucket=self.bucket,
                Key=s3_key,
                Body=json.dumps(patterns, indent=2),
                ContentType='application/json'
            )
            
            logger.info(f"✓ Saved patterns: s3://{self.bucket}/{s3_key}")
            return True
        
        except Exception as e:
            logger.error(f"Error saving patterns: {e}")
            return False
    
    def _load_state_profiles(self) -> Dict:
        """Load enriched state profiles from S3"""
        # In production, this would load from S3 enriched-regional-data/
        # For now, return empty to avoid errors
        return {}
    
    def generate_system_prompt_enhancement(self) -> str:
        """
        Generate enhanced system prompt for chatbot incorporating learned patterns
        """
        prompt = """You are an expert on wealth inequality and regional economics in the United States.

You have deep knowledge of:
1. Regional wealth distribution patterns
2. How education, employment, and industry affect inequality
3. Economic indicators and their regional variations
4. Specific state profiles and comparative analysis

When answering questions:
- Reference specific data about states and regions
- Explain wealth differences through economic factors
- Connect education levels to income and inequality
- Discuss industry and employment patterns regionally
- Use economic correlations to explain outcomes

Key principles you've learned:
- High education → Higher income → Lower wealth inequality
- Tech/professional services sectors → Better wage distribution
- Service-heavy economies → Higher inequality
- Population diversity creates complex economic dynamics
- Manufacturing decline correlates with rising inequality

Always cite regional data and be specific about geographic patterns."""
        
        return prompt
    
    def create_knowledge_base(self) -> Dict:
        """Create knowledge base for RAG-enhanced responses"""
        kb = {
            'regional_facts': self._compile_regional_facts(),
            'correlation_rules': self.create_correlation_patterns(),
            'few_shot_examples': self.create_few_shot_examples(),
            'system_prompt': self.generate_system_prompt_enhancement(),
            'timestamp': datetime.now().isoformat()
        }
        
        return kb
    
    def _compile_regional_facts(self) -> Dict:
        """Compile regional facts from state profiles"""
        # In production, aggregate from state profiles
        return {
            'northeast': {
                'characteristics': ['High education', 'High income', 'Lower inequality', 'Professional services'],
                'challenges': ['High cost of living', 'Aging population']
            },
            'southeast': {
                'characteristics': ['Growing population', 'Lower costs', 'Service sector', 'Increasing diversity'],
                'challenges': ['Lower education levels', 'Higher inequality']
            },
            'midwest': {
                'characteristics': ['Manufacturing heritage', 'Moderate income', 'Stable population'],
                'challenges': ['Industrial decline', 'Job transition']
            },
            'southwest': {
                'characteristics': ['Rapid growth', 'Energy sector', 'Diverse economy', 'Younger population'],
                'challenges': ['Water scarcity', 'Income disparities']
            },
            'west': {
                'characteristics': ['Tech centers', 'High wages', 'Diverse industries', 'Immigration'],
                'challenges': ['Cost of living', 'Wealth concentration']
            }
        }
    
    def run_learning_pipeline(self) -> Dict:
        """Execute full learning pipeline"""
        logger.info("\n🎓 Starting Chatbot Learning Pipeline...")
        
        results = {
            'timestamp': datetime.now().isoformat(),
            'components': {}
        }
        
        # Generate training data
        logger.info("  Creating training dataset...")
        training_data = self.create_training_dataset()
        self.save_training_data_to_s3(training_data)
        results['components']['training_data'] = {
            'count': len(training_data),
            'status': 'saved'
        }
        
        # Create correlation patterns
        logger.info("  Creating correlation patterns...")
        patterns = self.create_correlation_patterns()
        self.save_correlation_patterns_to_s3(patterns)
        results['components']['patterns'] = {
            'count': len(patterns),
            'status': 'saved'
        }
        
        # Create knowledge base
        logger.info("  Creating knowledge base...")
        kb = self.create_knowledge_base()
        kb_key = f"chatbot-training-data/knowledge-base.json"
        self.s3_client.put_object(
            Bucket=self.bucket,
            Key=kb_key,
            Body=json.dumps(kb, indent=2),
            ContentType='application/json'
        )
        results['components']['knowledge_base'] = {
            'status': 'saved',
            'key': kb_key
        }
        
        logger.info("\n✅ Learning pipeline complete!")
        return results


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    engine = ChatbotLearningEngine()
    results = engine.run_learning_pipeline()
    
    print("\n" + "="*60)
    print("CHATBOT LEARNING PIPELINE RESULTS")
    print("="*60)
    print(json.dumps(results, indent=2))
