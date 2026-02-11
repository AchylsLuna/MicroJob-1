import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../config';
import EmployerNavigation from '../../components/employerNavigation';

type NotificationItem = {
  id: string;
  applicantName: string;
  jobTitle: string;
  createdAt?: string;
  isRead?: boolean;
};

type EmployerNotificationsProps = {
  activeTab?: string;
  onTabPress?: (tab: string) => void;
};

export default function EmployerNotifications({
  activeTab = 'Notifications',
  onTabPress,
}: EmployerNotificationsProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchNotifications = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/applications/employer`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await response.json().catch(() => []);
      if (!response.ok) throw new Error(data?.message || 'Failed to load notifications.');
      const mapped = (Array.isArray(data) ? data : []).map((app: any) => ({
        id: app._id,
        applicantName: [app.applicant?.firstName, app.applicant?.lastName].filter(Boolean).join(' ') || 'Applicant',
        jobTitle: app.job?.title || 'Job post',
        createdAt: app.createdAt,
        isRead: Boolean(app.employerReadAt),
      }));
      setNotifications(mapped);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleRemoveNotification = (notificationId: string) => {
    setErrorMessage('');
    AsyncStorage.getItem('auth_token')
      .then((token) =>
        fetch(`${API_URL}/applications/${notificationId}/employer/remove`, {
          method: 'PATCH',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
      )
      .catch((error) => {
        setErrorMessage(error?.message || 'Failed to remove notification.');
      });
    setNotifications((prev) => prev.filter((item) => item.id !== notificationId));
  };

  const handleMarkRead = (notificationId: string) => {
    setErrorMessage('');
    AsyncStorage.getItem('auth_token')
      .then((token) =>
        fetch(`${API_URL}/applications/${notificationId}/employer/read`, {
          method: 'PATCH',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
      )
      .catch((error) => {
        setErrorMessage(error?.message || 'Failed to mark as read.');
      });
    setNotifications((prev) =>
      prev.map((item) => (item.id === notificationId ? { ...item, isRead: true } : item))
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        <Text style={styles.headerSubtitle}>New applicants for your job posts</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {errorMessage ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.card}>
            <ActivityIndicator color="#0a2847" />
            <Text style={styles.loadingText}>Loading notifications...</Text>
          </View>
        ) : null}

        {!loading && notifications.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No new applications yet.</Text>
          </View>
        ) : null}

        {notifications.map((item) => (
          <View
            key={item.id}
            style={[
              styles.notificationCard,
              item.isRead && styles.notificationCardRead,
            ]}
          >
            <View style={styles.notificationHeader}>
              <View style={styles.notificationInfo}>
                <Text
                  style={[
                    styles.notificationTitle,
                    item.isRead && styles.readText,
                  ]}
                >
                  {item.applicantName}
                </Text>
                <Text
                  style={[
                    styles.notificationSubtitle,
                    item.isRead && styles.readText,
                  ]}
                >
                  Applied for {item.jobTitle}
                </Text>
                <Text
                  style={[
                    styles.notificationTime,
                    item.isRead && styles.readText,
                  ]}
                >
                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
                </Text>
              </View>
              <View style={styles.actionColumn}>
                <TouchableOpacity
                  style={styles.markButton}
                  onPress={() => handleMarkRead(item.id)}
                >
                  <Text style={styles.markButtonText}>Mark read</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleRemoveNotification(item.id)}
                >
                  <Text style={styles.removeButtonText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      <EmployerNavigation activeTab={activeTab} onTabPress={onTabPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fb' },
  header: {
    backgroundColor: '#0a2847',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerTitle: { color: '#ffffff', fontSize: 22, fontWeight: '700' },
  headerSubtitle: { color: '#cbd5f0', fontSize: 13, marginTop: 4 },
  scroll: { padding: 20, paddingBottom: 90 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    alignItems: 'center',
  },
  loadingText: { marginTop: 10, color: '#475569', fontSize: 13 },
  errorCard: {
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: '#b91c1c', fontSize: 13 },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: { color: '#64748b', fontSize: 14 },
  notificationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  notificationCardRead: { backgroundColor: '#f8fafc' },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  notificationInfo: { flex: 1 },
  notificationTitle: { fontSize: 16, fontWeight: '700', color: '#0a2847' },
  notificationSubtitle: { fontSize: 13, color: '#475569', marginTop: 4 },
  notificationTime: { fontSize: 12, color: '#94a3b8', marginTop: 6 },
  readText: { color: '#94a3b8' },
  actionColumn: { alignItems: 'flex-end', gap: 8 },
  markButton: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#e0f2fe',
  },
  markButtonText: { color: '#0369a1', fontSize: 12, fontWeight: '700' },
  removeButton: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#fee2e2',
  },
  removeButtonText: { color: '#b91c1c', fontSize: 12, fontWeight: '700' },
});
