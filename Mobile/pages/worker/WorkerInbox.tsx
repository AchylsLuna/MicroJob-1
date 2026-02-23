import React, { useState } from 'react';
import { View } from 'react-native';
import MessageList from '../employer/MessageList';
import ChatScreen from '../employer/ChatScreen';
import Navigation from '../../components/navigation';

export default function WorkerInbox({ activeTab = 'Messages', onTabPress, liveMessages = [] }: { activeTab?: string, onTabPress?: (tab: string) => void, liveMessages?: any[] }) {
  const [selectedUser, setSelectedUser] = useState<{ id: string; name?: string } | null>(null);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {selectedUser ? (
          <ChatScreen userId={selectedUser.id} displayName={selectedUser.name} onBack={() => setSelectedUser(null)} liveMessages={liveMessages} />
        ) : (
          <MessageList onOpenChat={(id, name) => setSelectedUser(id ? { id, name } : null)} liveMessages={liveMessages} />
        )}
      </View>
      <Navigation activeTab={activeTab} onTabPress={onTabPress} />
    </View>
  );
}