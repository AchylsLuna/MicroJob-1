import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '../../lib/storage';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '../../components/AppHeader';
import { API_URL } from '../../config';
import { apiRequest, asList, asObject } from '../../lib/api';
import { tokens } from '../../theme/tokens';

type SupportMessage = {
  _id?: string;
  body?: string;
  actorRole?: 'user' | 'admin';
  createdAt?: string;
  author?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: string;
  } | null;
};

type SupportTicket = {
  _id: string;
  subject: string;
  category?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed';
  createdAt?: string;
  updatedAt?: string;
  lastMessageAt?: string;
  messageCount?: number;
  messages?: SupportMessage[];
};

type ContactSupportProps = {
  onBack?: () => void;
};

const FAQS = [
  {
    icon: 'wallet-outline' as const,
    title: 'Payout reviews',
    body: 'Payout requests are reviewed manually. Track every review decision from your wallet history.',
  },
  {
    icon: 'briefcase-outline' as const,
    title: 'Application stages',
    body: 'Applications now move through Applied, Shortlisted, Interview Scheduled, Offer Sent, and Hired.',
  },
  {
    icon: 'shield-checkmark-outline' as const,
    title: 'Account safety',
    body: 'Use a strong password, keep MFA enabled, and review your sessions regularly.',
  },
];

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'payments', label: 'Payments' },
  { value: 'jobs', label: 'Jobs' },
  { value: 'account', label: 'Account' },
  { value: 'technical', label: 'Technical' },
];

const PRIORITIES: Array<{ value: NonNullable<SupportTicket['priority']>; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const getStatusColor = (status: SupportTicket['status']) => {
  switch (status) {
    case 'open':
      return { backgroundColor: '#DBEAFE', color: '#1D4ED8' };
    case 'in_progress':
      return { backgroundColor: '#FEF3C7', color: '#B45309' };
    case 'waiting_user':
      return { backgroundColor: '#E0F2FE', color: '#0369A1' };
    case 'resolved':
      return { backgroundColor: '#DCFCE7', color: '#15803D' };
    case 'closed':
      return { backgroundColor: '#F3F4F6', color: '#6B7280' };
    default:
      return { backgroundColor: '#F3F4F6', color: '#6B7280' };
  }
};

const getPriorityColor = (priority?: SupportTicket['priority']) => {
  switch (priority) {
    case 'urgent':
      return { backgroundColor: '#FEE2E2', color: '#B91C1C' };
    case 'high':
      return { backgroundColor: '#FFEDD5', color: '#C2410C' };
    case 'medium':
      return { backgroundColor: '#E0E7FF', color: '#4338CA' };
    default:
      return { backgroundColor: '#ECFDF5', color: '#047857' };
  }
};

const formatDate = (value?: string) => {
  if (!value) return 'No date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'No date';
  return parsed.toLocaleString('en-PH', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const getAuthorName = (message: SupportMessage) => {
  if (message.actorRole === 'admin') return 'Support';
  const firstName = message.author?.firstName || '';
  const lastName = message.author?.lastName || '';
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || message.author?.email || 'You';
};

export default function ContactSupport({ onBack }: ContactSupportProps) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [replyDraft, setReplyDraft] = useState('');
  const [form, setForm] = useState({
    subject: '',
    category: 'general',
    priority: 'medium' as NonNullable<SupportTicket['priority']>,
    message: '',
  });

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket._id === selectedTicketId) || null,
    [selectedTicketId, tickets],
  );

  const loadTickets = async (targetTicketId?: string | null) => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const result = await apiRequest(`${API_URL}/support/tickets`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }, 'Failed to load support tickets.');

      if (!result.ok) {
        throw new Error(result.message || 'Failed to load support tickets.');
      }

      const nextTickets = asList<SupportTicket>(result.raw, ['tickets']);
      setTickets(nextTickets);
      if (nextTickets.length > 0) {
        setSelectedTicketId(targetTicketId || nextTickets[0]._id);
      } else {
        setSelectedTicketId(null);
      }
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to load support tickets.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTicketDetails = async (ticketId: string) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const result = await apiRequest(`${API_URL}/support/tickets/${ticketId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }, 'Failed to load support ticket.');

      if (!result.ok) {
        throw new Error(result.message || 'Failed to load support ticket.');
      }

      const payload = asObject<any>(result.raw) || {};
      const ticket = (payload.ticket || payload.data || payload) as SupportTicket;
      if (!ticket?._id) return;
      setTickets((current) => {
        const others = current.filter((item) => item._id !== ticket._id);
        return [ticket, ...others];
      });
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to load support ticket.');
    }
  };

  useEffect(() => {
    void loadTickets();
  }, []);

  useEffect(() => {
    if (!selectedTicketId) return;
    void loadTicketDetails(selectedTicketId);
  }, [selectedTicketId]);

  const handleCreateTicket = async () => {
    if (!form.subject.trim() || !form.message.trim()) {
      setErrorMessage('Subject and message are required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const result = await apiRequest(`${API_URL}/support/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          subject: form.subject.trim(),
          category: form.category,
          priority: form.priority,
          message: form.message.trim(),
        }),
      }, 'Failed to submit support ticket.');

      if (!result.ok) {
        throw new Error(result.message || 'Failed to submit support ticket.');
      }

      const payload = asObject<any>(result.raw) || {};
      const ticket = (payload.ticket || payload.data || payload) as SupportTicket;
      setForm({ subject: '', category: 'general', priority: 'medium', message: '' });
      if (ticket?._id) {
        setTickets((current) => [ticket, ...current.filter((item) => item._id !== ticket._id)]);
        setSelectedTicketId(ticket._id);
      } else {
        await loadTickets();
      }
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to submit support ticket.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReply = async () => {
    if (!selectedTicketId || !replyDraft.trim()) {
      return;
    }

    setIsReplying(true);
    setErrorMessage('');
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const result = await apiRequest(`${API_URL}/support/tickets/${selectedTicketId}/replies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: replyDraft.trim() }),
      }, 'Failed to send reply.');

      if (!result.ok) {
        throw new Error(result.message || 'Failed to send reply.');
      }

      const payload = asObject<any>(result.raw) || {};
      const ticket = (payload.ticket || payload.data || payload) as SupportTicket;
      if (ticket?._id) {
        setTickets((current) => [ticket, ...current.filter((item) => item._id !== ticket._id)]);
      } else {
        await loadTicketDetails(selectedTicketId);
      }
      setReplyDraft('');
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to send reply.');
    } finally {
      setIsReplying(false);
    }
  };

  const summary = useMemo(() => {
    return {
      open: tickets.filter((ticket) => ticket.status === 'open' || ticket.status === 'in_progress').length,
      waiting: tickets.filter((ticket) => ticket.status === 'waiting_user').length,
      resolved: tickets.filter((ticket) => ticket.status === 'resolved' || ticket.status === 'closed').length,
    };
  }, [tickets]);

  return (
    <View style={styles.container}>
      <AppHeader title="Support Center" subtitle="Open tickets and track replies" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Need help with payouts, applications, or account issues?</Text>
          <Text style={styles.heroBody}>
            Submit a ticket, monitor status changes, and continue the thread without leaving the app.
          </Text>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{summary.open}</Text>
            <Text style={styles.metricLabel}>Open</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{summary.waiting}</Text>
            <Text style={styles.metricLabel}>Waiting</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{summary.resolved}</Text>
            <Text style={styles.metricLabel}>Resolved</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Create Support Ticket</Text>
          <Text style={styles.cardSubtitle}>Describe the issue clearly so support can route it correctly.</Text>

          <Text style={styles.inputLabel}>Subject</Text>
          <TextInput
            style={styles.input}
            value={form.subject}
            onChangeText={(subject) => setForm((current) => ({ ...current, subject }))}
            placeholder="Payout review delay"
            placeholderTextColor={tokens.colors.textSubtle}
          />

          <Text style={styles.inputLabel}>Category</Text>
          <View style={styles.choiceRow}>
            {CATEGORIES.map((category) => {
              const isActive = form.category === category.value;
              return (
                <TouchableOpacity
                  key={category.value}
                  style={[styles.choiceChip, isActive && styles.choiceChipActive]}
                  onPress={() => setForm((current) => ({ ...current, category: category.value }))}
                >
                  <Text style={[styles.choiceText, isActive && styles.choiceTextActive]}>{category.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.inputLabel}>Priority</Text>
          <View style={styles.choiceRow}>
            {PRIORITIES.map((priority) => {
              const isActive = form.priority === priority.value;
              return (
                <TouchableOpacity
                  key={priority.value}
                  style={[styles.choiceChip, isActive && styles.choiceChipActive]}
                  onPress={() => setForm((current) => ({ ...current, priority: priority.value }))}
                >
                  <Text style={[styles.choiceText, isActive && styles.choiceTextActive]}>{priority.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.inputLabel}>Message</Text>
          <TextInput
            style={[styles.input, styles.messageInput]}
            value={form.message}
            onChangeText={(message) => setForm((current) => ({ ...current, message }))}
            placeholder="Explain what happened, what you expected, and any relevant dates or references."
            placeholderTextColor={tokens.colors.textSubtle}
            multiline
            textAlignVertical="top"
          />

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <TouchableOpacity
            style={[styles.primaryButton, isSubmitting && styles.primaryButtonDisabled]}
            onPress={handleCreateTicket}
            disabled={isSubmitting}
          >
            {isSubmitting ? <ActivityIndicator color={tokens.colors.white} /> : <Text style={styles.primaryButtonText}>Submit Ticket</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.cardTitle}>Ticket History</Text>
            <TouchableOpacity onPress={() => void loadTickets(selectedTicketId)} disabled={isLoading}>
              <Text style={styles.linkText}>{isLoading ? 'Refreshing...' : 'Refresh'}</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={tokens.colors.brand} />
              <Text style={styles.loadingText}>Loading support tickets...</Text>
            </View>
          ) : tickets.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="chatbubble-ellipses-outline" size={30} color={tokens.colors.textMuted} />
              <Text style={styles.emptyTitle}>No support tickets yet</Text>
              <Text style={styles.emptyBody}>Your submitted tickets and support replies will appear here.</Text>
            </View>
          ) : (
            <View style={styles.ticketList}>
              {tickets.map((ticket) => {
                const statusStyle = getStatusColor(ticket.status);
                const priorityStyle = getPriorityColor(ticket.priority);
                const isSelected = ticket._id === selectedTicketId;
                return (
                  <TouchableOpacity
                    key={ticket._id}
                    style={[styles.ticketCard, isSelected && styles.ticketCardSelected]}
                    onPress={() => setSelectedTicketId(ticket._id)}
                  >
                    <View style={styles.ticketHeader}>
                      <Text style={styles.ticketSubject}>{ticket.subject}</Text>
                      <View style={[styles.badge, { backgroundColor: statusStyle.backgroundColor }]}> 
                        <Text style={[styles.badgeText, { color: statusStyle.color }]}>{ticket.status.replace(/_/g, ' ')}</Text>
                      </View>
                    </View>
                    <View style={styles.ticketMetaRow}>
                      <View style={[styles.badge, { backgroundColor: priorityStyle.backgroundColor }]}> 
                        <Text style={[styles.badgeText, { color: priorityStyle.color }]}>{ticket.priority || 'low'}</Text>
                      </View>
                      <Text style={styles.ticketMeta}>{ticket.messageCount || ticket.messages?.length || 0} messages</Text>
                    </View>
                    <Text style={styles.ticketDate}>Updated {formatDate(ticket.lastMessageAt || ticket.updatedAt || ticket.createdAt)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {selectedTicket ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{selectedTicket.subject}</Text>
            <Text style={styles.cardSubtitle}>Track the latest replies and continue the thread below.</Text>

            <View style={styles.threadList}>
              {(selectedTicket.messages || []).map((message, index) => {
                const isSupport = message.actorRole === 'admin';
                return (
                  <View
                    key={message._id || `${selectedTicket._id}-${index}`}
                    style={[styles.threadBubble, isSupport ? styles.threadBubbleSupport : styles.threadBubbleUser]}
                  >
                    <View style={styles.threadHeader}>
                      <Text style={[styles.threadAuthor, isSupport && styles.threadAuthorSupport]}>{getAuthorName(message)}</Text>
                      <Text style={[styles.threadDate, isSupport && styles.threadDateSupport]}>{formatDate(message.createdAt)}</Text>
                    </View>
                    <Text style={[styles.threadBody, isSupport && styles.threadBodySupport]}>{message.body || 'No message body.'}</Text>
                  </View>
                );
              })}
            </View>

            {selectedTicket.status !== 'closed' ? (
              <>
                <Text style={styles.inputLabel}>Reply</Text>
                <TextInput
                  style={[styles.input, styles.messageInput]}
                  value={replyDraft}
                  onChangeText={setReplyDraft}
                  placeholder="Add more details or respond to support."
                  placeholderTextColor={tokens.colors.textSubtle}
                  multiline
                  textAlignVertical="top"
                />
                <TouchableOpacity
                  style={[styles.primaryButton, isReplying && styles.primaryButtonDisabled]}
                  onPress={handleReply}
                  disabled={isReplying || !replyDraft.trim()}
                >
                  {isReplying ? <ActivityIndicator color={tokens.colors.white} /> : <Text style={styles.primaryButtonText}>Send Reply</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.closedBanner}>
                <Ionicons name="lock-closed-outline" size={16} color="#6B7280" />
                <Text style={styles.closedBannerText}>This ticket is closed and cannot receive new replies.</Text>
              </View>
            )}
          </View>
        ) : null}

        <View style={styles.faqWrap}>
          {FAQS.map((item) => (
            <View key={item.title} style={styles.faqCard}>
              <View style={styles.faqIconWrap}>
                <Ionicons name={item.icon} size={18} color={tokens.colors.brandAccent} />
              </View>
              <View style={styles.faqContent}>
                <Text style={styles.faqTitle}>{item.title}</Text>
                <Text style={styles.faqBody}>{item.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 120,
    gap: 16,
  },
  heroCard: {
    backgroundColor: tokens.colors.brandDark,
    borderRadius: 22,
    padding: 20,
    ...tokens.shadow.card,
  },
  heroTitle: {
    color: tokens.colors.white,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  heroBody: {
    marginTop: 10,
    color: '#D8E3F5',
    fontSize: 13,
    lineHeight: 19,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    ...tokens.shadow.card,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    color: tokens.colors.text,
  },
  metricLabel: {
    marginTop: 4,
    fontSize: 12,
    color: tokens.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  card: {
    backgroundColor: tokens.colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    ...tokens.shadow.card,
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  cardSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: tokens.colors.textMuted,
  },
  inputLabel: {
    marginTop: 14,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  input: {
    backgroundColor: tokens.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: tokens.colors.text,
    fontSize: 14,
  },
  messageInput: {
    minHeight: 110,
    paddingTop: 12,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choiceChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  choiceChipActive: {
    backgroundColor: '#0F2954',
    borderColor: '#0F2954',
  },
  choiceText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  choiceTextActive: {
    color: tokens.colors.white,
  },
  errorText: {
    marginTop: 10,
    fontSize: 12,
    color: '#B91C1C',
    lineHeight: 17,
  },
  primaryButton: {
    marginTop: 16,
    backgroundColor: tokens.colors.brandAccent,
    borderRadius: 14,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: tokens.colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  linkText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.brandAccent,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: 26,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: tokens.colors.textMuted,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  emptyBody: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    color: tokens.colors.textMuted,
  },
  ticketList: {
    marginTop: 14,
    gap: 10,
  },
  ticketCard: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#FBFDFF',
  },
  ticketCardSelected: {
    borderColor: '#8FB7F0',
    backgroundColor: '#F4F8FF',
  },
  ticketHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  ticketSubject: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  ticketMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tokens.radius.pill,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  ticketMeta: {
    fontSize: 12,
    color: tokens.colors.textMuted,
  },
  ticketDate: {
    marginTop: 8,
    fontSize: 12,
    color: tokens.colors.textSubtle,
  },
  threadList: {
    marginTop: 14,
    gap: 10,
  },
  threadBubble: {
    borderRadius: 16,
    padding: 14,
  },
  threadBubbleUser: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  threadBubbleSupport: {
    backgroundColor: '#0F2954',
  },
  threadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  threadAuthor: {
    fontSize: 13,
    fontWeight: '800',
    color: tokens.colors.text,
  },
  threadAuthorSupport: {
    color: tokens.colors.white,
  },
  threadDate: {
    fontSize: 11,
    color: '#94A3B8',
  },
  threadDateSupport: {
    color: '#CBD5F0',
  },
  threadBody: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: tokens.colors.text,
  },
  threadBodySupport: {
    color: tokens.colors.white,
  },
  closedBanner: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  closedBannerText: {
    flex: 1,
    fontSize: 12,
    color: tokens.colors.textMuted,
  },
  faqWrap: {
    gap: 10,
  },
  faqCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: tokens.colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  faqIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF1FB',
  },
  faqContent: {
    flex: 1,
  },
  faqTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  faqBody: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textMuted,
  },
});
