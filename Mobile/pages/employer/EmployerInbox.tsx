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
  onOpenNotifications,
  notificationBadgeCount = 0,
  initialChatTarget = null,
  onConsumeInitialChatTarget,
}: {
  activeTab?: string;
  onTabPress?: (tab: string) => void;
  liveMessages?: any[];
  onOpenNotifications?: () => void;
  notificationBadgeCount?: number;
  initialChatTarget?: { id: string; name?: string } | null;
  onConsumeInitialChatTarget?: () => void;
}) {
  const [selectedUser, setSelectedUser] = useState<{ id: string; name?: string } | null>(null);

  React.useEffect(() => {
    if (!initialChatTarget?.id) return;
    setSelectedUser(initialChatTarget);
    onConsumeInitialChatTarget?.();
  }, [initialChatTarget, onConsumeInitialChatTarget]);

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
            onOpenChat={(id: string | null, name?: string) => setSelectedUser(id ? { id, name } : null)}
            isEmployer
            liveMessages={liveMessages}
            onOpenNotifications={onOpenNotifications}
            notificationBadgeCount={notificationBadgeCount}
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
