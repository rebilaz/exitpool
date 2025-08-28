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

const ChatbotWidget: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(initial);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, open]);

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
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 rounded-full bg-gray-900 px-5 py-3 text-sm font-medium text-white shadow-lg transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        Chat
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-white/30 backdrop-blur-[2px]" />
          <div className="relative flex h-full w-full max-w-sm flex-col border-l border-gray-200 bg-white shadow-xl">
            <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-800">Assistant</h3>
              <button onClick={() => setOpen(false)} className="rounded-md border border-transparent p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
                ✕
              </button>
            </header>
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
        </div>
      )}
    </>
  );
};

export default ChatbotWidget;
