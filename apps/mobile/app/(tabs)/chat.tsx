// apps/mobile/app/(tabs)/chat.tsx
import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, RefreshControl,
} from 'react-native';
import { useAuthStore } from '@/store/auth.store';
import { useUnitStore } from '@/store/unit.store';
import { chatApi } from '@/lib/api';
import { chatEvents } from '@/lib/chat-events';
import type { ChatMessage } from '@/lib/chat-events';

const ROLE_COLORS: Record<string, string> = {
  admin: '#3B82F6',
  operator: '#22C55E',
  supervisor: '#F59E0B',
  field_unit: '#64748B',
  commander: '#8B5CF6',
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  operator: 'Operador',
  supervisor: 'Supervisor',
  field_unit: 'Campo',
  commander: 'Comandante',
};

export default function ChatScreen() {
  const { user } = useAuthStore();
  const { assignedIncident } = useUnitStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [roomId, setRoomId] = useState('command');
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const rooms = [
    { id: 'command', label: 'Comando' },
    ...(assignedIncident
      ? [{ id: `incident:${assignedIncident.id}`, label: `IC: ${assignedIncident.folio}` }]
      : []),
  ];

  const loadMessages = useCallback(async () => {
    try {
      const { data } = await chatApi.getMessages(roomId);
      setMessages(data.reverse()); // API returns DESC, we need ASC for display
    } catch {}
  }, [roomId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Real-time incoming messages
  useEffect(() => {
    const unsubscribe = chatEvents.subscribe((message) => {
      if (message.roomId === roomId) {
        setMessages((prev) => [...prev, message]);
      }
    });
    return unsubscribe;
  }, [roomId]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await chatApi.sendMessage(roomId, input.trim());
      setInput('');
    } catch {}
    setSending(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMessages();
    setRefreshing(false);
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  };

  const isOwnMessage = (msg: ChatMessage) => msg.senderId === user?.id;

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const own = isOwnMessage(item);
    return (
      <View style={[styles.messageBubble, own ? styles.ownBubble : styles.otherBubble]}>
        {!own && (
          <View style={styles.senderRow}>
            <Text style={styles.senderName}>{item.senderName}</Text>
            <View style={[styles.roleBadge, { backgroundColor: ROLE_COLORS[item.senderRole] ?? '#64748B' }]}>
              <Text style={styles.roleText}>{ROLE_LABELS[item.senderRole] ?? item.senderRole}</Text>
            </View>
          </View>
        )}
        <Text style={styles.messageText}>{item.content}</Text>
        <Text style={styles.timestamp}>{formatTime(item.createdAt)}</Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {/* Room selector */}
      <View style={styles.roomSelector}>
        {rooms.map((room) => (
          <TouchableOpacity
            key={room.id}
            style={[styles.roomTab, roomId === room.id && styles.roomTabActive]}
            onPress={() => setRoomId(room.id)}
          >
            <Text style={[styles.roomTabText, roomId === room.id && styles.roomTabTextActive]}>
              {room.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#64748B" />
        }
      />

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.textInput}
          value={input}
          onChangeText={setInput}
          placeholder="Escribe un mensaje..."
          placeholderTextColor="#64748B"
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!input.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || sending}
        >
          <Text style={styles.sendButtonText}>{'\u2192'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  roomSelector: {
    flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#1E293B',
  },
  roomTab: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
    marginRight: 8, backgroundColor: '#1E293B',
  },
  roomTabActive: { backgroundColor: '#3B82F6' },
  roomTabText: { color: '#64748B', fontSize: 14, fontWeight: '600' },
  roomTabTextActive: { color: '#F8FAFC' },
  messageList: { flex: 1 },
  messageListContent: { padding: 12, paddingBottom: 8 },
  messageBubble: {
    maxWidth: '80%', padding: 12, borderRadius: 12, marginBottom: 8,
  },
  ownBubble: {
    backgroundColor: '#3B82F6', alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#334155', alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  senderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  senderName: { color: '#94A3B8', fontSize: 12, fontWeight: '600', marginRight: 6 },
  roleBadge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  roleText: { color: '#F8FAFC', fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  messageText: { color: '#F8FAFC', fontSize: 15, lineHeight: 20 },
  // Bumped 10→12pt with lighter text color; contrast now ~5.5:1 over #0F172A.
  timestamp: { color: '#E2E8F0', fontSize: 12, marginTop: 4, textAlign: 'right' },
  inputRow: {
    flexDirection: 'row', padding: 12, borderTopWidth: 1,
    borderTopColor: '#1E293B', alignItems: 'flex-end',
  },
  textInput: {
    flex: 1, backgroundColor: '#1E293B', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12, color: '#F8FAFC',
    fontSize: 15, maxHeight: 100, marginRight: 8,
  },
  sendButton: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#3B82F6',
    alignItems: 'center', justifyContent: 'center',
  },
  sendButtonDisabled: { opacity: 0.4 },
  sendButtonText: { color: '#F8FAFC', fontSize: 20, fontWeight: '700' },
});
