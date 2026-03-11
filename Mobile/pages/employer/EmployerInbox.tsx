import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import EmployerNavigation from '../../components/employerNavigation';
import MessageList from './MessageList';
import ChatScreen from './ChatScreen';
import { tokens } from '../../theme/tokens';

export default function EmployerInbox({
  activeTab = 'Messages',
  onTabPress,
  liveMessages = [],
}: {
  activeTab?: string;
  onTabPress?: (tab: string) => void;
  liveMessages?: any[];
}) {
  const [selectedUser, setSelectedUser] = useState<{ id: string; name?: string } | null>(null);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {selectedUser ? (
          <ChatScreen userId={selectedUser.id} displayName={selectedUser.name} onBack={() => setSelectedUser(null)} liveMessages={liveMessages} />
        ) : (
          <MessageList
            onOpenChat={(id: string | null, name?: string) => setSelectedUser(id ? { id, name } : null)}
            isEmployer
            liveMessages={liveMessages}
          />
        )}
      </View>
      <EmployerNavigation activeTab={activeTab} onTabPress={onTabPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  content: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
});
