import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import MessageList from '../employer/MessageList';
import ChatScreen from '../employer/ChatScreen';
import Navigation from '../../components/navigation';
import { tokens } from '../../theme/tokens';

type ChatTarget = {
  id: string;
  name?: string;
};

export default function WorkerInbox({
  activeTab = 'Messages',
  onTabPress,
  liveMessages = [],
  onOpenNotifications,
  notificationBadgeCount = 0,
  messageBadgeCount = 0,
  initialChatTarget = null,
}: {
  activeTab?: string;
  onTabPress?: (tab: string) => void;
  liveMessages?: any[];
  onOpenNotifications?: () => void;
  notificationBadgeCount?: number;
  messageBadgeCount?: number;
  initialChatTarget?: ChatTarget | null;
}) {
  const [selectedUser, setSelectedUser] = useState<ChatTarget | null>(null);

  useEffect(() => {
    if (!initialChatTarget?.id) return;
    setSelectedUser(initialChatTarget);
  }, [initialChatTarget]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {selectedUser ? (
          <ChatScreen
            userId={selectedUser.id}
            displayName={selectedUser.name}
            onBack={() => setSelectedUser(null)}
            liveMessages={liveMessages}
            onOpenNotifications={onOpenNotifications}
            notificationBadgeCount={notificationBadgeCount}
          />
        ) : (
          <MessageList
            onOpenChat={(id, name) => setSelectedUser(id ? { id, name } : null)}
            liveMessages={liveMessages}
            onOpenNotifications={onOpenNotifications}
            notificationBadgeCount={notificationBadgeCount}
          />
        )}
      </View>
      <Navigation activeTab={activeTab} onTabPress={onTabPress} messageBadgeCount={messageBadgeCount} />
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
