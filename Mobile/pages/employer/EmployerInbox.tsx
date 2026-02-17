import React, { useState } from 'react';
import { View } from 'react-native';
import EmployerNavigation from '../../components/employerNavigation';
import MessageList from './MessageList.tsx';
import ChatScreen from './ChatScreen';

export default function EmployerInbox({ activeTab = 'Messages', onTabPress, liveMessages = [] }: { activeTab?: string, onTabPress?: (tab: string) => void, liveMessages?: any[] }) {
  const [selectedUser, setSelectedUser] = useState<{ id: string; name?: string } | null>(null);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {selectedUser ? (
          <ChatScreen userId={selectedUser.id} displayName={selectedUser.name} onBack={() => setSelectedUser(null)} liveMessages={liveMessages} />
        ) : (
          <MessageList onOpenChat={(id: string | null, name?: string) => setSelectedUser(id ? { id, name } : null)} isEmployer liveMessages={liveMessages} />
        )}
      </View>
      <EmployerNavigation activeTab={activeTab} onTabPress={onTabPress} />
    </View>
  );
}
