import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import MessageList from '../employer/MessageList';
import ChatScreen from '../employer/ChatScreen';
import Navigation from '../../components/navigation';
import { tokens } from '../../theme/tokens';

type ChatTarget = {
  id: string;
  name?: string;
  /** Set when the chat was opened as an inquiry about a specific job posting. */
  jobId?: string;
};

export default function WorkerInbox({
  activeTab = 'Messages',
  onTabPress,
  liveMessages = [],
  onOpenNotifications,
  notificationBadgeCount = 0,
  messageBadgeCount = 0,
  initialChatTarget = null,
  onConsumeInitialChatTarget,
}: {
  activeTab?: string;
  onTabPress?: (tab: string) => void;
  liveMessages?: any[];
  onOpenNotifications?: () => void;
  notificationBadgeCount?: number;
  messageBadgeCount?: number;
  initialChatTarget?: ChatTarget | null;
  onConsumeInitialChatTarget?: () => void;
}) {
  const [selectedUser, setSelectedUser] = useState<ChatTarget | null>(null);

  useEffect(() => {
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
            jobId={selectedUser.jobId}
            onBack={() => setSelectedUser(null)}
            liveMessages={liveMessages}
            onOpenNotifications={onOpenNotifications}
            notificationBadgeCount={notificationBadgeCount}
          />
        ) : (
          <MessageList
            onOpenChat={(id, name, jobId) => setSelectedUser(id ? { id, name, jobId } : null)}
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
    // The glass tab bar floats above content; keep the chat input clear of it.
    paddingBottom: tokens.layout.tabBarClearance,
    backgroundColor: tokens.colors.background,
  },
});
