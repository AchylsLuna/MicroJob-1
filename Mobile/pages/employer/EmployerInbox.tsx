import React, { useState } from 'react';
import { View } from 'react-native';
import EmployerNavigation from '../../components/employerNavigation';
import MessageList from './MessageList';
import ChatScreen from './ChatScreen';

export default function EmployerInbox({ activeTab = 'Messages', onTabPress }: { activeTab?: string, onTabPress?: (tab: string) => void }) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {selectedUserId ? (
          <ChatScreen userId={selectedUserId} onBack={() => setSelectedUserId(null)} />
        ) : (
          <MessageList onOpenChat={setSelectedUserId} isEmployer />
        )}
      </View>
      <EmployerNavigation activeTab={activeTab} onTabPress={onTabPress} />
    </View>
  );
}
