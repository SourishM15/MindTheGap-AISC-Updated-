import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../types';
import { Send, MessageCircle } from 'lucide-react';

interface ChatInterfaceProps {
  onChatQuery: (query: string) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ onChatQuery }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'system',
      content: 'Welcome! Ask me about U.S. wealth inequality - compare states and cities, explore income distribution, wealth gaps, historical trends, or demographic breakdowns. I have comprehensive government data on national, state, and metro area patterns.',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const processQuestion = (question: string) => {
    // Split the input into individual questions based on common separators
    const questions = question
      .split(/[?.,!]\s+/)
      .map(q => q.trim())
      .filter(q => q.length > 0)
      .map(q => q.endsWith('?') ? q : `${q}?`);

    return questions;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isProcessing) return;

    setIsProcessing(true);
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    onChatQuery(inputValue);
    setInputValue('');

    try {
      // Build conversation history for context (excluding system message)
      const conversationHistory = messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role, content: m.content }));

      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: inputValue,
          conversation_history: conversationHistory
        }),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error("Failed to fetch chat response:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Sorry, I'm having trouble connecting to the server. Please try again later.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }

    setIsProcessing(false);
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md flex flex-col transition-all duration-300 ease-in-out ${
      isExpanded ? 'h-[500px]' : 'h-[300px]'
    }`}>
      <div className="flex items-center justify-between bg-indigo-600 dark:bg-indigo-800 text-white rounded-t-lg p-4">
        <h3 className="font-semibold text-base flex items-center">
          <MessageCircle size={20} className="mr-2" />
          Wealth & Economics Assistant
        </h3>
        <button 
          onClick={toggleExpand}
          className="text-indigo-100 hover:text-white transition-colors"
        >
          {isExpanded ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          )}
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-5">
        {messages.map((message) => (
          <div 
            key={message.id} 
            className={`mb-3 ${
              message.role === 'user' 
                ? 'text-right' 
                : 'text-left'
            }`}
          >
            <div className={`inline-block max-w-[80%] px-3 py-2 rounded-lg ${
              message.role === 'user'
                ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                : message.role === 'system'
                  ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600'
                  : 'bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200'
            }`}>
              {message.content}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      
      <form onSubmit={handleSubmit} className="border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask about states, cities, or U.S. inequality..."
            disabled={isProcessing}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-l-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
          />
          <button 
            type="submit"
            disabled={isProcessing}
            className={`bg-indigo-600 dark:bg-indigo-500 text-white px-4 py-2 rounded-r-md hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
              isProcessing ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatInterface;