import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import MessageList from '../employer/MessageList';
import ChatScreen from '../employer/ChatScreen';
import Navigation from '../../components/navigation';

type ChatTarget = {
  id: string;
  name?: string;
};

export default function WorkerInbox({
  activeTab = 'Messages',
  onTabPress,
  liveMessages = [],
  messageBadgeCount = 0,
  initialChatTarget = null,
}: {
  activeTab?: string;
  onTabPress?: (tab: string) => void;
  liveMessages?: any[];
  messageBadgeCount?: number;
  initialChatTarget?: ChatTarget | null;
}) {
  const [selectedUser, setSelectedUser] = useState<ChatTarget | null>(null);

  useEffect(() => {
    if (!initialChatTarget?.id) return;
    setSelectedUser(initialChatTarget);
  }, [initialChatTarget]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {selectedUser ? (
          <ChatScreen userId={selectedUser.id} displayName={selectedUser.name} onBack={() => setSelectedUser(null)} liveMessages={liveMessages} />
        ) : (
          <MessageList onOpenChat={(id, name) => setSelectedUser(id ? { id, name } : null)} liveMessages={liveMessages} />
        )}
      </View>
      <Navigation activeTab={activeTab} onTabPress={onTabPress} messageBadgeCount={messageBadgeCount} />
    </View>
  );
}
