type ChatMessage = {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  createdAt: string;
};

type Listener = (message: ChatMessage) => void;
const listeners = new Set<Listener>();

export const chatEvents = {
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  emit: (message: ChatMessage) => {
    listeners.forEach((l) => l(message));
  },
};

export type { ChatMessage };
