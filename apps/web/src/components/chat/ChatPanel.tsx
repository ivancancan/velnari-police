'use client';
import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { reportError } from '@/lib/report-error';
import { useAuthStore } from '@/store/auth.store';
import { getSocket } from '@/lib/socket';

interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  createdAt: string;
}

const ROLE_COLORS: Record<string, string> = {
  admin: '#8B5CF6',
  operator: '#3B82F6',
  supervisor: '#F59E0B',
  field_unit: '#22C55E',
  commander: '#EC4899',
};

interface Props {
  roomId: string;
  title?: string;
}

export default function ChatPanel({ roomId, title = 'Chat operativo' }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const user = useAuthStore((s) => s.user);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<ChatMessage[]>(`/chat/${roomId}?limit=50`)
      .then((res) => setMessages(res.data.reverse()))
      .catch((err) => reportError(err, { tag: 'chat.loadMessages' }));
  }, [roomId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.emit('join:command'); // already joined but safe to call again

    const handler = (msg: ChatMessage) => {
      if (msg.roomId === roomId) {
        setMessages((prev) => [...prev, msg]);
      }
    };
    socket.on('chat:message', handler);
    return () => { socket.off('chat:message', handler); };
  }, [roomId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await api.post(`/chat/${roomId}`, { content: text.trim() });
      setText('');
    } catch { /* ignore */ }
    finally { setSending(false); }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2.5 border-b border-slate-700 shrink-0">
        <h3 className="text-xs font-semibold text-slate-gray uppercase tracking-wide">{title}</h3>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {messages.map((msg) => {
          const isMe = msg.senderId === user?.id;
          const color = ROLE_COLORS[msg.senderRole] ?? '#64748B';
          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 ${isMe ? 'bg-tactical-blue/20' : 'bg-slate-800'}`}>
                <p className="text-xs font-semibold mb-0.5" style={{ color }}>{msg.senderName}</p>
                <p className="text-sm text-signal-white">{msg.content}</p>
                <p className="text-xs text-slate-gray mt-0.5">
                  {new Date(msg.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="px-3 py-2 border-t border-slate-700 shrink-0 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Mensaje..."
          className="flex-1 bg-slate-800 border border-slate-700 text-signal-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-tactical-blue placeholder-slate-500"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="px-3 py-1.5 bg-tactical-blue hover:bg-blue-600 text-white text-xs font-medium rounded-lg disabled:opacity-40 transition-colors"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
