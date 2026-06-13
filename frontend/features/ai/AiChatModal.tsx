import { useState, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X, Send, Sparkles, User, Bot, Loader2 } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useSettings } from '../../hooks/useSettings';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

interface AiChatModalProps {
  workspacePath: string | null;
}

export function AiChatModal({ workspacePath }: AiChatModalProps) {
  const { showAiChat, setShowAiChat, selectedNode } = useAppStore();
  const { apiKey, selectedModel, aiProvider, localBaseUrl, aiTemperature, aiSidebarPlacement } = useSettings();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (!showAiChat) return null;

  const handleSend = async () => {
    if (!input.trim()) return;
    if (aiProvider === 'gemini' && !apiKey) return;
    if (aiProvider === 'local' && !localBaseUrl) return;

    const userMessage: ChatMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const history = [...messages, userMessage];
      const filePath = selectedNode?.data?.path || null;

      const responseText: string = await invoke('ask_assistant', {
        history,
        workspacePath,
        filePath,
        apiKey,
        model: selectedModel || 'gemini-1.5-flash',
        aiProvider,
        localBaseUrl,
        temperature: aiTemperature,
      });

      setMessages(prev => [...prev, { role: 'assistant', text: responseText }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: `Error: ${err}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const placementClass = aiSidebarPlacement === 'left' ? 'left-4' : 'right-4';

  return (
    <div className={`absolute ${placementClass} bottom-4 w-96 h-[500px] flex flex-col bg-surface-raised border border-border rounded-xl shadow-2xl z-[100] overflow-hidden nebula-slide-up`}>
      {/* Header */}
      <div className="h-12 border-b border-border flex items-center justify-between px-4 bg-surface shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-blue-600/20 text-blue-400 flex items-center justify-center">
            <Sparkles size={14} />
          </div>
          <span className="text-sm font-bold text-text-main">AI Assistant</span>
        </div>
        <button
          onClick={() => setShowAiChat(false)}
          className="text-text-dim hover:text-text-main transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Context indicator */}
      {selectedNode?.data?.path ? (
        <div className="px-3 py-1.5 bg-blue-500/10 border-b border-blue-500/20 text-[10px] text-blue-400 font-mono truncate flex items-center gap-2">
          <span className="uppercase font-sans font-bold tracking-wider text-[9px] text-blue-400/70">Context:</span>
          {selectedNode.data.path.split(/[/\\]/).pop()}
        </div>
      ) : (
        <div className="px-3 py-1.5 bg-surface border-b border-border text-[10px] text-text-dim flex items-center gap-2">
           <span className="uppercase font-sans font-bold tracking-wider text-[9px]">Context:</span>
           Global (Select a file to narrow context)
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-text-dim space-y-2 opacity-50">
            <Bot size={32} />
            <p className="text-xs">Ask me anything about your codebase.</p>
          </div>
        )}
        
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
              msg.role === 'user' ? 'bg-surface border border-border text-text-muted' : 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
            }`}>
              {msg.role === 'user' ? <User size={12} /> : <Bot size={12} />}
            </div>
            <div className={`px-3 py-2 rounded-lg text-sm max-w-[80%] whitespace-pre-wrap ${
              msg.role === 'user' ? 'bg-surface border border-border text-text-main' : 'bg-transparent text-text-main'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3 flex-row">
            <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Loader2 size={12} className="animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border bg-surface shrink-0">
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Ask AI..."
            className="w-full bg-background border border-border rounded-lg pl-3 pr-10 py-2 text-sm text-text-main outline-none focus:border-blue-500/50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || (aiProvider === 'gemini' && !apiKey) || (aiProvider === 'local' && !localBaseUrl)}
            className="absolute right-2 text-text-dim hover:text-blue-400 disabled:opacity-30 disabled:hover:text-text-dim transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
