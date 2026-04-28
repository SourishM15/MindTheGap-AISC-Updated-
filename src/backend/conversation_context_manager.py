"""
Conversation Context Manager
Handles multi-turn conversations with improved topic switching and context preservation
"""

from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
import logging
from enum import Enum

logger = logging.getLogger(__name__)

US_STATES = [
    'california', 'texas', 'florida', 'new york', 'pennsylvania',
    'illinois', 'ohio', 'georgia', 'north carolina', 'michigan',
    'new jersey', 'virginia', 'washington', 'arizona', 'massachusetts',
    'tennessee', 'indiana', 'missouri', 'maryland', 'wisconsin',
    'colorado', 'minnesota', 'south carolina', 'alabama', 'louisiana',
    'kentucky', 'oregon', 'oklahoma', 'connecticut', 'utah',
    'nevada', 'arkansas', 'mississippi', 'kansas', 'new mexico',
    'nebraska', 'idaho', 'hawaii', 'maine', 'montana',
    'south dakota', 'delaware', 'north dakota', 'alaska', 'vermont',
    'west virginia', 'wyoming', 'rhode island'
]


class TopicCategory(Enum):
    """Categories of conversation topics related to wealth/inequality"""
    REGIONAL_DATA = "regional_data"           # Questions about specific states/regions
    WEALTH_INEQUALITY = "wealth_inequality"   # Gini, wealth gap, disparity
    POLICY_RECOMMENDATIONS = "policy_recs"    # Policy suggestions
    INDIVIDUAL_FINANCE = "personal_finance"   # Personal money/tax/debt advice
    EMPLOYMENT = "employment"                 # Job, wages, career
    EDUCATION = "education"                   # School, skills, training
    HOUSING = "housing"                       # Home, rent, property
    HEALTHCARE = "healthcare"                 # Medical, insurance, health
    TAXATION = "taxation"                     # Taxes, credits, deductions
    HISTORICAL = "historical"                 # History, trends, comparisons
    OTHER = "other"                           # Unknown/unrelated


@dataclass
class ConversationContext:
    """Maintains context for a single conversation"""
    conversation_id: str
    messages: List[Dict] = field(default_factory=list)
    current_topic: Optional[str] = None
    current_region: Optional[str] = None
    topic_history: List[Tuple[str, str]] = field(default_factory=list)  # (topic, timestamp)
    region_history: List[Tuple[str, str]] = field(default_factory=list)  # (region, timestamp)
    extracted_entities: Dict = field(default_factory=dict)  # States, metrics, policies mentioned
    last_user_intent: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    last_updated: str = field(default_factory=lambda: datetime.now().isoformat())
    
    def add_message(self, role: str, content: str, topic: Optional[str] = None, 
                   region: Optional[str] = None) -> None:
        """Add a message to the conversation"""
        self.messages.append({
            'role': role,
            'content': content,
            'timestamp': datetime.now().isoformat(),
            'topic': topic,
            'region': region
        })
        self.last_updated = datetime.now().isoformat()
        
        # Update current context
        if topic and topic != self.current_topic:
            self.topic_history.append((topic, datetime.now().isoformat()))
            self.current_topic = topic
        
        if region and region != self.current_region:
            self.region_history.append((region, datetime.now().isoformat()))
            self.current_region = region
    
    def get_recent_context(self, last_n_turns: int = 6) -> Dict:
        """Get the last N message exchanges for context"""
        return {
            'messages': self.messages[-last_n_turns:],
            'current_topic': self.current_topic,
            'current_region': self.current_region,
            'recent_topics': self.topic_history[-3:],
            'recent_regions': self.region_history[-3:],
        }
    
    def clear_context_on_new_topic(self, new_topic: str) -> None:
        """Clear temporary context when switching to new topic"""
        if new_topic != self.current_topic:
            logger.info(f"Topic switch detected: {self.current_topic} → {new_topic}")
            self.current_topic = new_topic
            self.extracted_entities = {}  # Reset entities for new topic


class ConversationContextManager:
    """Manages conversation contexts and topic detection"""
    
    # Topic keywords mapping
    TOPIC_KEYWORDS = {
        TopicCategory.REGIONAL_DATA: [
            'state', 'states', 'region', 'city', 'metropolitan', 'area', 
            'comparing', 'versus', 'vs', 'california', 'texas', 'florida',
            'new york', 'which state', 'tell me about'
        ],
        TopicCategory.WEALTH_INEQUALITY: [
            'inequality', 'wealth gap', 'disparity', 'gini', 'inequality index',
            'rich', 'poor', 'wealthy', 'poverty rate', 'income gap', 'wealth distribution',
            'concentration', 'unfair', 'unequal'
        ],
        TopicCategory.POLICY_RECOMMENDATIONS: [
            'policy', 'policies', 'reform', 'solution', 'recommend', 'suggestion',
            'should', 'could', 'government', 'increase', 'decrease', 'implement',
            'program', 'initiative', 'intervention', 'funding', 'what worked',
            'what failed', 'evidence', 'trade-off', 'unintended consequence'
        ],
        TopicCategory.INDIVIDUAL_FINANCE: [
            'tax', 'taxes', 'deduction', 'credit', 'refund', 'debt', 'loan',
            'mortgage', 'interest rate', 'money', 'save', 'budget', 'income',
            'paycheck', 'pocket', 'household', 'family', 'personal', 'invest',
            'investment', 'portfolio', 'retirement', '401k', 'ira'
        ],
        TopicCategory.EMPLOYMENT: [
            'job', 'employment', 'wage', 'salary', 'work', 'career',
            'unemployment', 'employee', 'employer', 'labor', 'gig', 'job creation'
        ],
        TopicCategory.EDUCATION: [
            'education', 'college', 'university', 'school', 'student', 'degree',
            'training', 'learning', 'skill', 'apprenticeship', 'tuition'
        ],
        TopicCategory.HOUSING: [
            'home', 'house', 'housing', 'rent', 'property', 'real estate',
            'homeowner', 'mortgage', 'down payment', 'landlord', 'apartment'
        ],
        TopicCategory.HEALTHCARE: [
            'healthcare', 'health', 'insurance', 'medical', 'doctor', 'hospital',
            'prescription', 'coverage', 'deductible', 'premium'
        ],
        TopicCategory.TAXATION: [
            'tax', 'taxes', 'income tax', 'capital gains', 'progressive', 'marginal rate',
            'tax bracket', 'deductible', 'credit', 'filing'
        ],
        TopicCategory.HISTORICAL: [
            'history', 'historical', 'past', 'previously', 'during', 'before',
            'era', 'period', 'trend', 'over time', 'compared to'
        ]
    }
    
    def __init__(self):
        self.contexts: Dict[str, ConversationContext] = {}
    
    def get_or_create_context(self, conversation_id: str) -> ConversationContext:
        """Get or create a conversation context"""
        if conversation_id not in self.contexts:
            self.contexts[conversation_id] = ConversationContext(conversation_id)
        return self.contexts[conversation_id]
    
    def detect_topic(self, text: str) -> Tuple[TopicCategory, float]:
        """
        Detect the primary topic category from text
        Returns (topic_category, confidence_score)
        """
        text_lower = text.lower()
        topic_scores = {}
        
        for topic, keywords in self.TOPIC_KEYWORDS.items():
            matching_keywords = sum(1 for kw in keywords if kw in text_lower)
            if matching_keywords > 0:
                topic_scores[topic] = matching_keywords / len(keywords)
        
        if not topic_scores:
            return TopicCategory.OTHER, 0.0
        
        best_topic = max(topic_scores.items(), key=lambda x: x[1])
        return best_topic[0], best_topic[1]
    
    def detect_region_switch(self, current_text: str, context: ConversationContext) -> bool:
        """Detect if user is asking about a different region than current context"""
        text_lower = current_text.lower()
        mentioned_region = None
        
        for state in US_STATES:
            if state in text_lower:
                mentioned_region = state
                break
        
        # Check if this is different from current context
        if mentioned_region and context.current_region:
            current_region = (
                context.current_region.lower()
                .replace(" state", "")
                .replace(" metro", "")
            )
            return mentioned_region.lower() != current_region
        
        return False
    
    def generate_context_prompt(self, context: ConversationContext) -> str:
        """Generate a system prompt that includes conversation context for the LLM"""
        recent = context.get_recent_context()
        
        prompt_parts = [
            "CONVERSATION CONTEXT:",
            f"Current Topic: {context.current_topic or 'Not established yet'}",
            f"Current Region/State: {context.current_region or 'National/General'}"
        ]
        
        if recent['recent_topics']:
            prompt_parts.append(f"\nRecent Topic Changes: {' → '.join([t[0] for t in recent['recent_topics']])}")
        
        prompt_parts.append("\nINSTRUCTIONS:")
        prompt_parts.append("1. Resolve follow-up phrases like 'there', 'that state', 'those policies', and 'what about education' from the current topic and region.")
        prompt_parts.append("2. If the user clearly switches topics or regions, answer the new question directly and briefly acknowledge the switch.")
        prompt_parts.append("3. For policy/history questions, connect claims to real jurisdictions, years, programs, outcomes, and trade-offs when evidence is available.")
        prompt_parts.append("4. For personal finance questions, provide educational context only and avoid individualized investment, tax, or legal advice.")
        prompt_parts.append("5. Maintain consistency with previously discussed facts in this conversation.")
        
        return "\n".join(prompt_parts)
    
    def buildcontext_aware_prompt(self, 
                                  user_message: str,
                                  context: ConversationContext,
                                  system_context: str = "") -> str:
        """Build a comprehensive prompt that includes conversation context"""
        
        topic, confidence = self.detect_topic(user_message)
        region_switch = self.detect_region_switch(user_message, context)
        
        prompt_parts = [system_context or self.generate_context_prompt(context)]
        
        # Add topic switch indicator
        if region_switch:
            prompt_parts.append(f"\nNOTE: User appears to be switching from {context.current_region} to a different region.")
        
        # Add recent conversation for better continuity
        recent = context.get_recent_context(last_n_turns=4)
        if recent['messages'] and len(recent['messages']) > 1:
            prompt_parts.append("\nRECENT CONTEXT:")
            for msg in recent['messages'][:-1]:  # Exclude the current message
                prompt_parts.append(f"  {msg['role'].upper()}: {msg['content'][:100]}...")
        
        prompt_parts.append(f"\nUSER MESSAGE: {user_message}")
        
        return "\n".join(prompt_parts)
    
    def clear_context(self, conversation_id: str) -> None:
        """Clear a conversation context"""
        if conversation_id in self.contexts:
            del self.contexts[conversation_id]
    
    def get_summary(self, conversation_id: str) -> Dict:
        """Get a summary of the conversation"""
        context = self.contexts.get(conversation_id)
        if not context:
            return {'status': 'conversation_not_found'}
        
        return {
            'conversation_id': conversation_id,
            'total_messages': len(context.messages),
            'current_topic': context.current_topic,
            'current_region': context.current_region,
            'topic_changes': len(context.topic_history),
            'region_changes': len(context.region_history),
            'duration': context.messages[-1]['timestamp'] if context.messages else None,
            'created_at': context.created_at
        }
