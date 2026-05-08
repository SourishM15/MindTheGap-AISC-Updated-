import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../types';
import { ChevronsDownUp, ChevronsUpDown, MessageCircle, Send } from 'lucide-react';
import { apiFetch } from '../utils/api';

interface ChatInterfaceProps {
  onChatQuery: (query: string) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ onChatQuery }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'system',
      content: 'Welcome! Ask me about U.S. wealth inequality, compare states and cities, or explore how a region’s history, culture, industries, and demographics shape its economy. I can go deep on policy when you ask, but I can also keep things conversational.',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const conversationIdRef = useRef(`chat-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

      const response = await apiFetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: inputValue,
          conversation_id: conversationIdRef.current,
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
    <div className={`surface flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
      isExpanded ? 'h-[500px]' : 'h-[300px]'
    }`}>
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-950 p-4 text-white dark:border-slate-800 dark:bg-slate-950">
        <h3 className="flex items-center text-sm font-black">
          <MessageCircle size={20} className="mr-2" />
          Economics Assistant
        </h3>
        <button
          onClick={toggleExpand}
          className="rounded-md p-1.5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          aria-label={isExpanded ? 'Collapse assistant' : 'Expand assistant'}
        >
          {isExpanded ? <ChevronsDownUp size={18} /> : <ChevronsUpDown size={18} />}
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((message) => (
          <div 
            key={message.id} 
            className={`mb-3 ${
              message.role === 'user' 
                ? 'text-right' 
                : 'text-left'
            }`}
          >
            <div className={`inline-block max-w-[86%] rounded-lg px-3 py-2 text-sm leading-6 shadow-sm ${
              message.role === 'user'
                ? 'bg-slate-950 text-white dark:bg-cyan-400 dark:text-slate-950'
                : message.role === 'system'
                  ? 'border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                  : 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100'
            }`}>
              {message.content}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      
      <form onSubmit={handleSubmit} className="border-t border-slate-200 p-4 dark:border-slate-800">
        <div className="flex">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask about states, cities, or U.S. inequality..."
            disabled={isProcessing}
            className="min-w-0 flex-1 rounded-l-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500"
          />
          <button
            type="submit"
            disabled={isProcessing}
            className={`rounded-r-md bg-slate-950 px-4 py-2 text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 dark:bg-cyan-400 dark:text-slate-950 dark:hover:bg-cyan-300 ${
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
