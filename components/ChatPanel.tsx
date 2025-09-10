"use client";
import React, { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  role: 'user' | 'bot';
  content: string;
  createdAt: number;
}

const initial: Message[] = [
  { id: 'm1', role: 'bot', content: 'Bonjour! Pose-moi une question sur ton portefeuille.', createdAt: Date.now() }
];

const ChatPanel: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>(initial);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = () => {
    if (!input.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input.trim(), createdAt: Date.now() };
    setMessages(m => [...m, userMsg]);
    setInput('');
    setTimeout(() => {
      const botMsg: Message = { id: Date.now().toString() + 'b', role: 'bot', content: 'Réponse mock: analyse indisponible (demo).', createdAt: Date.now() };
      setMessages(m => [...m, botMsg]);
    }, 700);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { e.preventDefault(); send(); } };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}> 
            <div className={`max-w-[75%] rounded-lg px-3 py-2 text-xs leading-relaxed shadow-sm border ${m.role === 'user' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-800 border-gray-200'}`}>{m.content}</div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form
        onSubmit={e => { e.preventDefault(); send(); }}
        className="border-t border-gray-200 p-3 flex items-center gap-2"
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="Pose une question..."
          className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs text-gray-800 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Envoyer
        </button>
      </form>
    </div>
  );
};

export default ChatPanel;
