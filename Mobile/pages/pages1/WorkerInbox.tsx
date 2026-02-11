import React, { useState } from 'react';
import { View } from 'react-native';
import MessageList from '../employer/MessageList';
import ChatScreen from '../employer/ChatScreen';
import Navigation from '../../components/navigation';

export default function WorkerInbox({ activeTab = 'Messages', onTabPress }: { activeTab?: string, onTabPress?: (tab: string) => void }) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {selectedUserId ? (
          <ChatScreen userId={selectedUserId} onBack={() => setSelectedUserId(null)} />
        ) : (
          <MessageList onOpenChat={setSelectedUserId} />
        )}
      </View>
      <Navigation activeTab={activeTab} onTabPress={onTabPress} />
    </View>
  );
}