import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView, Image } from 'react-native';
import AsyncStorage from '../../lib/storage';
import { API_URL } from '../../config';
import { apiRequest, asList } from '../../lib/api';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { useToast } from '../../contexts/ToastContext';
import { EmployerQrScannerModal } from '../../components/wallet/WalletQrFlow';
import { php } from '../../components/wallet/walletFormat';
import { AnimatedMicroJobsLogoBadge } from '../../components/auth/MicroJobsLogo';

interface Message {
  _id: string;
  sender: any;
  receiver: any;
  content: string;
  createdAt: string;
  senderName?: string;
  receiverName?: string;
  attachment?: { type?: string; settlementRequest?: any; qrImageName?: string; jobTitle?: string; totalAmount?: number; expiresAt?: string; jobOffer?: any; application?: any; offerAmount?: number };
}

interface ChatScreenProps {
  userId: string;
  displayName?: string;
  onBack: () => void;
  liveMessages?: any[];
  onOpenNotifications?: () => void;
  notificationBadgeCount?: number;
  isEmployer?: boolean;
  /** Links messages sent from this thread to a specific job posting (job inquiries). */
  jobId?: string;
}

export default function ChatScreen({ userId, displayName: initialDisplayName, onBack, liveMessages = [], onOpenNotifications, notificationBadgeCount = 0, isEmployer = false, jobId }: ChatScreenProps) {
  const [displayName, setDisplayName] = useState<string | undefined>(initialDisplayName);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [authToken, setAuthToken] = useState('');
  const [invoiceRequestId, setInvoiceRequestId] = useState<string | null>(null);
  const [invoiceCodes, setInvoiceCodes] = useState<Record<string, string>>({});
  const [clock, setClock] = useState(Date.now());
  const [processingOfferId, setProcessingOfferId] = useState<string | null>(null);
  useEffect(() => { void AsyncStorage.getItem('auth_token').then((value) => setAuthToken(value || '')); }, []);
  useEffect(() => { const interval = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(interval); }, []);
  useEffect(() => {
    if (!authToken) return;
    const ids = messages.map((item) => getEntityId(item.attachment?.settlementRequest)).filter(Boolean);
    const missing = Array.from(new Set(ids)).filter((id) => !(id in invoiceCodes));
    if (!missing.length) return;
    void Promise.all(missing.map(async (id) => {
      const result = await apiRequest(`${API_URL}/payment/qr-requests/${id}`, { headers: { Authorization: `Bearer ${authToken}` } }, 'Unable to load invoice code.');
      const payload: any = result.data || result.raw || {};
      return [id, result.ok && payload.shortCode ? String(payload.shortCode) : ''] as const;
    })).then((entries) => setInvoiceCodes((current) => ({ ...current, ...Object.fromEntries(entries) })));
  }, [authToken, invoiceCodes, messages]);

  const getEntityId = (value: any) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') return String(value._id || value.id || value.userId || '');
    return String(value);
  };

  const fetchMessages = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const result = await apiRequest(`${API_URL}/messages/conversation/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }, 'Failed to load messages');
      const messageList = asList<Message>(result.raw, ['messages']);
      setMessages(messageList);
      // derive display name from messages if available
      try {
        const storedUser = await AsyncStorage.getItem('auth_user');
        const parsedUser = storedUser ? JSON.parse(storedUser) : null;
        const meId = parsedUser?._id || parsedUser?.id || parsedUser?.userId;
        setCurrentUserId(meId || null);
        const msgs = messageList || [];
        if (msgs.length > 0) {
          const first = msgs[0];
          const senderId = getEntityId(first?.sender);
          const other = String(senderId) === String(meId) ? first.receiver : first.sender;
          const otherName = other?.firstName ? `${other.firstName} ${other.lastName || ''}`.trim() : (other?.senderName || other?.receiverName || undefined);
          if (otherName) setDisplayName(otherName);
        }
      } catch {}
    } catch {}
  }, [userId]);

  useEffect(() => { fetchMessages(); }, [fetchMessages, userId]);

  // Merge incoming live messages for this conversation
  useEffect(() => {
    if (!liveMessages || liveMessages.length === 0) return;
    // liveMessages is a list of payloads; find those related to this conversation
    const relevant = liveMessages.filter((p: any) => {
      try {
        const senderId = getEntityId(p?.sender || p?.senderId);
        const receiverId = getEntityId(p?.receiver || p?.receiverId);
        return String(senderId) === String(userId) || String(receiverId) === String(userId);
      } catch { return false; }
    });
    if (relevant.length === 0) return;
    setMessages((prev) => {
      const existingIds = new Set(prev.map((m) => String(m._id)));
      const toAdd = [] as any[];
      for (const p of relevant) {
        const id = p?._id || p?.id || (p?._doc && p._doc._id) || `${Date.now()}-${Math.random()}`;
        if (existingIds.has(String(id))) continue;
        const sender = p?.sender?.firstName ? `${p.sender.firstName} ${p.sender.lastName || ''}`.trim() : (p?.senderName || 'User');
        const receiver = p?.receiver?.firstName ? `${p.receiver.firstName} ${p.receiver.lastName || ''}`.trim() : (p?.receiverName || 'User');
        toAdd.push({
          _id: id,
          sender: p?.sender || p?.senderId,
          receiver: p?.receiver || p?.receiverId,
          content: p?.content || (p?._doc && p._doc.content) || '',
          createdAt: p?.createdAt || new Date().toISOString(),
          senderName: sender,
          receiverName: receiver,
          attachment: p?.attachment || p?._doc?.attachment,
        });
      }
      if (toAdd.length === 0) return prev;
      return [...prev, ...toAdd].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    });
  }, [liveMessages, userId]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const token = await AsyncStorage.getItem('auth_token');
    try {
      const result = await apiRequest(`${API_URL}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ receiverId: userId, content: input, ...(jobId ? { jobId } : {}) }),
      }, 'Unable to send message');
      if (!result.ok) {
        console.warn('Send message failed', result.status, result.raw);
        toast.error(result.message || 'Unable to send message.');
        return;
      }
      setInput('');
      // refresh messages (server will also emit socket event)
      fetchMessages();
    } catch (err) {
      console.warn('Send message error', err);
      toast.error('Network error.');
    }
  };

  const updateOffer = async (offerId: string, action: 'accept' | 'reject' | 'cancel' | 'confirm-hire') => {
    if (processingOfferId) return;
    setProcessingOfferId(offerId);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const url = action === 'accept' || action === 'reject' ? `${API_URL}/job-offers/${offerId}/respond` : `${API_URL}/job-offers/${offerId}/${action}`;
      const result = await apiRequest(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(action === 'accept' || action === 'reject' ? { body: JSON.stringify({ action }) } : {}) }, 'Unable to update this offer.');
      if (!result.ok) throw new Error(result.message);
      toast.success(action === 'confirm-hire' ? 'Worker hired successfully.' : `Offer ${action === 'accept' ? 'accepted' : action === 'reject' ? 'rejected' : 'cancelled'}.`);
      await fetchMessages();
    } catch (error: any) { toast.error(error?.message || 'Unable to update this offer.'); }
    finally { setProcessingOfferId(null); }
  };

  useEffect(() => {
    // Optionally, poll for new messages every 10s
    const interval = setInterval(fetchMessages, 10000);
    return () => clearInterval(interval);
  }, [fetchMessages, userId]);

  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backTouch} accessibilityRole="button" accessibilityLabel="Back to conversations">
            <Ionicons name="chevron-back" size={20} color={tokens.colors.brand} />
          </TouchableOpacity>
          <AnimatedMicroJobsLogoBadge />
          <View style={styles.headerCopy}><Text style={styles.headerText} numberOfLines={1}>{displayName || 'Chat'}</Text>{isEmployer ? <Text style={styles.employerContext}>EMPLOYER CONVERSATION</Text> : null}</View>
          {onOpenNotifications ? (
            <TouchableOpacity style={styles.notificationIcon} onPress={onOpenNotifications} accessibilityRole="button" accessibilityLabel={`Open notifications${notificationBadgeCount ? `, ${notificationBadgeCount} unread` : ''}`}>
              <Ionicons name="notifications-outline" size={20} color={tokens.colors.brand} />
              {notificationBadgeCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{notificationBadgeCount > 99 ? '99+' : String(notificationBadgeCount)}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          ) : null}
        </View>
        <FlatList
          ref={flatListRef}
          style={{ flex: 1, backgroundColor: tokens.colors.background }}
          data={messages}
          keyExtractor={item => item._id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          initialNumToRender={20}
          maxToRenderPerBatch={12}
          updateCellsBatchingPeriod={40}
          windowSize={9}
          renderItem={({ item }) => {
            const isMine = String(getEntityId(item.sender)) === String(currentUserId);
            const offerValue = item.attachment?.jobOffer;
            const offerId = getEntityId(offerValue);
            if (item.attachment?.type === 'job_offer' && offerId) {
              const offerStatus = String(typeof offerValue === 'object' ? offerValue.status || 'pending' : 'pending').toLowerCase();
              const busy = processingOfferId === offerId;
              return <View style={[styles.invoiceCard, isMine ? styles.invoiceMine : styles.invoiceTheirs]} accessibilityLabel={`Formal job offer, ${php(item.attachment.offerAmount)}, ${offerStatus}`}>
                <View style={styles.invoiceHeader}><View style={styles.invoiceIcon}><Ionicons name="document-text-outline" size={21} color={tokens.colors.brand} /></View><View style={styles.invoiceCopy}><Text style={styles.invoiceEyebrow}>FORMAL JOB OFFER</Text><Text style={styles.invoiceTitle}>{item.attachment.jobTitle || 'Local job'}</Text></View><View style={[styles.invoiceStatus, offerStatus !== 'pending' && styles.invoiceStatusMuted]}><Text style={styles.invoiceStatusText}>{offerStatus}</Text></View></View>
                <View style={styles.invoiceFooter}><Text style={styles.invoiceAmount}>{php(item.attachment.offerAmount)}</Text><Text style={styles.invoiceHint}>Escrow-backed guaranteed pay</Text></View>
                {!isEmployer && !isMine && offerStatus === 'pending' ? <View style={styles.offerActions}><TouchableOpacity style={styles.offerSecondary} disabled={busy} onPress={() => void updateOffer(offerId, 'reject')}><Text style={styles.offerSecondaryText}>Decline</Text></TouchableOpacity><TouchableOpacity style={styles.offerPrimary} disabled={busy} onPress={() => void updateOffer(offerId, 'accept')}><Text style={styles.offerPrimaryText}>Accept Offer</Text></TouchableOpacity></View> : null}
                {isEmployer && isMine && ['pending', 'accepted'].includes(offerStatus) ? <View style={styles.offerActions}><TouchableOpacity style={styles.offerSecondary} disabled={busy} onPress={() => void updateOffer(offerId, 'cancel')}><Text style={styles.offerSecondaryText}>Cancel</Text></TouchableOpacity>{offerStatus === 'accepted' ? <TouchableOpacity style={styles.offerPrimary} disabled={busy} onPress={() => void updateOffer(offerId, 'confirm-hire')}><Text style={styles.offerPrimaryText}>Confirm Hire</Text></TouchableOpacity> : null}</View> : null}
              </View>;
            }
            const requestValue = item.attachment?.settlementRequest;
            const requestId = getEntityId(requestValue);
            const serverStatus = String(typeof requestValue === 'object' ? requestValue?.status || 'active' : 'active').toLowerCase();
            const requestStatus = serverStatus === 'active' && new Date(item.attachment?.expiresAt || 0).getTime() <= clock ? 'expired' : serverStatus;
            if (item.attachment?.type === 'settlement_request' && requestId) return <TouchableOpacity style={[styles.invoiceCard, isMine ? styles.invoiceMine : styles.invoiceTheirs]} disabled={!isEmployer || requestStatus !== 'active'} onPress={() => setInvoiceRequestId(requestId)} accessibilityRole={isEmployer && requestStatus === 'active' ? 'button' : undefined} accessibilityLabel={`Payment invoice for ${item.attachment?.jobTitle || 'job'}, ${php(item.attachment?.totalAmount)}, ${requestStatus}`}>
              <View style={styles.invoiceHeader}><View style={styles.invoiceIcon}><Ionicons name="qr-code-outline" size={21} color={tokens.colors.brand} /></View><View style={styles.invoiceCopy}><Text style={styles.invoiceEyebrow}>MICROJOBS PAYMENT INVOICE</Text><Text style={styles.invoiceTitle} numberOfLines={2}>{item.attachment?.jobTitle || 'Job settlement'}</Text></View><View style={[styles.invoiceStatus, requestStatus !== 'active' && styles.invoiceStatusMuted]}><Text style={styles.invoiceStatusText}>{requestStatus}</Text></View></View>
              {item.attachment.qrImageName && authToken ? <Image source={{ uri: `${API_URL}/payment/qr-requests/${requestId}/image`, headers: { Authorization: `Bearer ${authToken}` } }} style={styles.invoiceQr} resizeMode="contain" accessibilityLabel="Secure payment QR image" /> : null}
              <View style={styles.invoiceFooter}><Text style={styles.invoiceAmount}>{php(item.attachment?.totalAmount)}</Text>{invoiceCodes[requestId] ? <Text selectable style={styles.invoiceCode}>Manual code: {invoiceCodes[requestId]}</Text> : null}<Text style={styles.invoiceHint}>{isEmployer && requestStatus === 'active' ? 'Tap to review and confirm' : requestStatus === 'active' ? 'Sent to employer for review' : `Invoice ${requestStatus}`}</Text></View>
            </TouchableOpacity>;
            return (
            <View style={[styles.msgBubble, isMine ? styles.myMsg : styles.theirMsg]}>
              <Text style={[styles.msgText, isMine ? styles.myMsgText : styles.theirMsgText]}>{item.content}</Text>
              <Text style={styles.msgTime}>{new Date(item.createdAt).toLocaleTimeString()}</Text>
            </View>
            );
          }}
          contentContainerStyle={{ padding: 16, paddingBottom: 112 }}
        />
      <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
          placeholderTextColor={tokens.colors.textSubtle}
          accessibilityLabel="Message"
          returnKeyType="send"
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={sendMessage} accessibilityRole="button" accessibilityLabel="Send message" accessibilityState={{ disabled: !input.trim() }} disabled={!input.trim()}>
          <Ionicons name="send" size={15} color={tokens.colors.onBrand} />
          <Text style={styles.sendBtnText}>Send</Text>
        </TouchableOpacity>
      </View>
      </KeyboardAvoidingView>
      <EmployerQrScannerModal visible={Boolean(invoiceRequestId)} initialRequestId={invoiceRequestId} onClose={() => setInvoiceRequestId(null)} onSettled={() => { setInvoiceRequestId(null); void fetchMessages(); }} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  backTouch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  headerText: { fontSize: 18, fontWeight: '800', color: tokens.colors.brandDark },
  employerContext: { marginTop: 2, color: tokens.colors.brand, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  notificationIcon: {
    position: 'relative',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: tokens.colors.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.white,
  },
  badgeText: {
    color: tokens.colors.onBrand,
    fontSize: 12,
    fontWeight: '700',
  },
  msgBubble: {
    maxWidth: '80%',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  myMsg: {
    backgroundColor: tokens.colors.brand,
    alignSelf: 'flex-end',
  },
  theirMsg: {
    backgroundColor: tokens.colors.surface,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  msgText: { fontSize: 15 },
  myMsgText: { color: tokens.colors.onBrand },
  theirMsgText: { color: tokens.colors.text },
  msgTime: { color: tokens.colors.textSubtle, fontSize: 11, marginTop: 4, textAlign: 'right' },
  invoiceCard: { width: '88%', alignSelf: 'flex-start', marginBottom: 12, padding: 13, borderRadius: 19, borderWidth: 1, borderColor: tokens.colors.border, backgroundColor: tokens.colors.surface, ...tokens.shadow.card }, invoiceMine: { alignSelf: 'flex-end', borderColor: '#BFDBFE' }, invoiceTheirs: { alignSelf: 'flex-start' }, invoiceHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 }, invoiceIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: tokens.colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, invoiceCopy: { flex: 1 }, invoiceEyebrow: { fontSize: 8, fontWeight: '800', letterSpacing: .8, color: tokens.colors.brand }, invoiceTitle: { marginTop: 2, fontSize: 13, fontWeight: '800', color: tokens.colors.brandDark }, invoiceStatus: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 999, backgroundColor: tokens.colors.successSoft }, invoiceStatusMuted: { backgroundColor: tokens.colors.contentMuted }, invoiceStatusText: { fontSize: 8, fontWeight: '800', color: tokens.colors.textMuted, textTransform: 'uppercase' }, invoiceQr: { width: 180, height: 180, alignSelf: 'center', marginVertical: 12, backgroundColor: '#FFFFFF' }, invoiceFooter: { borderTopWidth: 1, borderTopColor: tokens.colors.border, paddingTop: 10 }, invoiceAmount: { fontSize: 19, fontWeight: '800', color: tokens.colors.brandDark }, invoiceCode: { marginTop: 5, fontSize: 11, fontWeight: '800', letterSpacing: 1, color: tokens.colors.brand }, invoiceHint: { marginTop: 3, fontSize: 10, color: tokens.colors.textMuted },
  offerActions: { marginTop: 12, flexDirection: 'row', gap: 8 }, offerPrimary: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: tokens.colors.brand, alignItems: 'center', justifyContent: 'center' }, offerPrimaryText: { color: tokens.colors.white, fontSize: 12, fontWeight: '800' }, offerSecondary: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: tokens.colors.border, alignItems: 'center', justifyContent: 'center' }, offerSecondaryText: { color: tokens.colors.onCanvasMuted, fontSize: 12, fontWeight: '800' },
  inputRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: tokens.colors.contentSurface,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 8,
    color: tokens.colors.text,
  },
  sendBtn: {
    minHeight: 44,
    minWidth: 44,
    backgroundColor: tokens.colors.brand,
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sendBtnText: { color: tokens.colors.onBrand, fontWeight: '700', fontSize: 12 },
});
