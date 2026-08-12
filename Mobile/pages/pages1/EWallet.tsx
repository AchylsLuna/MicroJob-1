import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  type ScrollView as NativeScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '../../lib/storage';
import { Ionicons } from '@expo/vector-icons';
import Navigation from '../../components/navigation';
import ScrollView from '../../components/ui/SmoothScrollView';
import TabTopNav from '../../components/TabTopNav';
import { API_URL } from '../../config';
import { apiRequest, asList, asObject } from '../../lib/api';
import { tokens } from '../../theme/tokens';
import { useToast } from '../../contexts/ToastContext';
import { WalletBalanceCard, WalletEmpty, WalletError, WalletMetrics, WalletSection, WalletSkeleton, WalletTransactionRow } from '../../components/wallet/WalletUI';

type EWalletProps = {
  activeTab?: string;
  onTabPress?: (tab: string) => void;
  onOpenNotifications?: () => void;
  notificationBadgeCount?: number;
  messageBadgeCount?: number;
};

type WalletTransaction = {
  _id: string;
  amount: number;
  type: string;
  status?: 'COMPLETED' | 'PENDING' | 'FAILED' | 'CANCELLED';
  label?: string;
  reference?: string;
  providerReference?: string;
  relatedEntityType?: string;
  balanceTarget?: string;
  createdAt?: string;
};

type PayoutRequest = {
  _id: string;
  amount: number;
  status: 'requested' | 'approved' | 'rejected' | 'paid' | 'cancelled';
  reviewNotes?: string;
  createdAt?: string;
  reviewedAt?: string;
  paidAt?: string;
  destinationSnapshot: {
    methodType?: string;
    institutionName?: string;
    accountName?: string;
    accountNumber?: string;
    accountNumberMasked?: string;
  };
};

const currency = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 2,
});

const formatCurrency = (value: unknown) => currency.format(Number.isFinite(Number(value)) ? Number(value) : 0);

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

const normalizeAccountOptions = (value: unknown): Array<'worker' | 'employer'> => {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .map((item) => String(item || '').toLowerCase())
    .map((item) => (item === 'employer' || item === 'doctor' || item === 'hire' ? 'employer' : item === 'worker' || item === 'work' || item === 'user' ? 'worker' : null))
    .filter((item): item is 'worker' | 'employer' => Boolean(item));
  return Array.from(new Set(normalized));
};

const getPayoutStatusStyle = (status: PayoutRequest['status']) => {
  switch (status) {
    case 'requested':
      return { backgroundColor: '#DBEAFE', color: tokens.colors.brand };
    case 'approved':
      return { backgroundColor: '#FEF3C7', color: '#B45309' };
    case 'paid':
      return { backgroundColor: '#DCFCE7', color: '#15803D' };
    case 'rejected':
      return { backgroundColor: '#FEE2E2', color: '#B91C1C' };
    case 'cancelled':
      return { backgroundColor: '#F3F4F6', color: tokens.colors.textMuted };
    default:
      return { backgroundColor: '#F3F4F6', color: tokens.colors.textMuted };
  }
};

const getTransactionLabel = (transaction: WalletTransaction) => {
  if (transaction.label) return transaction.label;
  switch (transaction.type) {
    case 'TOP_UP':
      return 'Top-up';
    case 'ESCROW':
      return 'Escrow';
    case 'PAYOUT':
      return 'Payout';
    case 'REFUND':
      return 'Refund';
    default:
      return 'Transaction';
  }
};

export default function EWallet({
  activeTab = 'EWallet',
  onTabPress,
  onOpenNotifications,
  notificationBadgeCount = 0,
  messageBadgeCount = 0,
}: EWalletProps) {
  const scrollViewRef = useRef<NativeScrollView>(null);
  const payoutIdempotencyKeyRef = useRef<string | null>(null);
  const [isRefreshingWallet, setIsRefreshingWallet] = useState(true);
  const [hasLoadedWallet, setHasLoadedWallet] = useState(false);
  const [walletError, setWalletError] = useState('');
  const [isPayoutFormExpanded, setIsPayoutFormExpanded] = useState(false);
  const [isSubmittingPayout, setIsSubmittingPayout] = useState(false);
  const [cancellingPayoutId, setCancellingPayoutId] = useState<string | null>(null);
  const [payoutFormOffsetY, setPayoutFormOffsetY] = useState(0);
  const [workerBalance, setWorkerBalance] = useState(0);
  const [employerBalance, setEmployerBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
  const [accountOptions, setAccountOptions] = useState<Array<'worker' | 'employer'>>(['worker']);
  const [profileRole, setProfileRole] = useState('worker');
  const [payoutForm, setPayoutForm] = useState({
    amount: '',
    methodType: 'bank_transfer',
    institutionName: '',
    accountName: '',
    accountNumber: '',
  });
  const toast = useToast();

  const hasWorkerWallet = accountOptions.includes('worker') || profileRole === 'worker' || profileRole === 'both';
  const isBothRole = profileRole === 'both' || (accountOptions.includes('worker') && accountOptions.includes('employer'));
  const pendingPayoutTotal = useMemo(
    () => payoutRequests
      .filter((request) => request.status === 'requested' || request.status === 'approved')
      .reduce((sum, request) => sum + Number(request.amount || 0), 0),
    [payoutRequests],
  );

  const refreshWalletData = useCallback(async () => {
    try {
      setIsRefreshingWallet(true);
      setWalletError('');
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const [profileResult, transactionsResult, payoutsResult] = await Promise.all([
        apiRequest(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        }, 'Failed to load wallet profile.'),
        apiRequest(`${API_URL}/payment/transactions`, {
          headers: { Authorization: `Bearer ${token}` },
        }, 'Failed to load transactions.'),
        apiRequest(`${API_URL}/payment/payout-requests`, {
          headers: { Authorization: `Bearer ${token}` },
        }, 'Failed to load payout requests.'),
      ]);

      const failedResult = [profileResult, transactionsResult, payoutsResult].find((result) => !result.ok);
      if (failedResult) setWalletError(failedResult.message || 'Some wallet details could not be refreshed.');

      if (profileResult.ok) {
        const profilePayload = asObject<any>(profileResult.data) || asObject<any>(profileResult.raw) || {};
        const normalizedRole = String(profilePayload?.role || '').toLowerCase();
        const normalizedOptions = normalizeAccountOptions(profilePayload?.accountOptions || []);
        const nextWorkerBalance = Number(profilePayload?.workerBalance || 0);
        const nextEmployerBalance = Number(profilePayload?.employerBalance || 0);

        setProfileRole(normalizedRole || 'worker');
        setAccountOptions(normalizedOptions.length > 0 ? normalizedOptions : normalizedRole === 'employer' ? ['employer'] : normalizedRole === 'both' ? ['worker', 'employer'] : ['worker']);
        setWorkerBalance(Number.isFinite(nextWorkerBalance) ? nextWorkerBalance : 0);
        setEmployerBalance(Number.isFinite(nextEmployerBalance) ? nextEmployerBalance : 0);
      }

      if (transactionsResult.ok) {
        const transactionPayload = asObject<any>(transactionsResult.data) || asObject<any>(transactionsResult.raw) || {};
        const nextTransactions = asList<WalletTransaction>(transactionPayload.transactions || transactionsResult.raw, ['transactions']);
        setTransactions(nextTransactions);
      }

      if (payoutsResult.ok) {
        const payoutPayload = asObject<any>(payoutsResult.data) || asObject<any>(payoutsResult.raw) || {};
        const nextPayouts = asList<PayoutRequest>(payoutPayload.payoutRequests || payoutsResult.raw, ['payoutRequests']);
        setPayoutRequests(nextPayouts);
      } else {
        setPayoutRequests([]);
      }
    } catch (error: any) {
      setWalletError(error?.message || 'Check your connection and try again.');
    } finally {
      setIsRefreshingWallet(false);
      setHasLoadedWallet(true);
    }
  }, []);

  useEffect(() => {
    void refreshWalletData();
  }, [refreshWalletData]);

  useEffect(() => {
    if (!isPayoutFormExpanded || payoutFormOffsetY <= 0) return;
    scrollViewRef.current?.scrollTo({ y: Math.max(payoutFormOffsetY - 20, 0), animated: true });
  }, [isPayoutFormExpanded, payoutFormOffsetY]);

  const handleCreatePayout = async () => {
    if (!hasWorkerWallet) {
      toast.error('Payout requests are only available from worker balances.');
      return;
    }

    const amount = Number(payoutForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid payout amount.');
      return;
    }
    if (amount > workerBalance) {
      toast.error('Payout amount cannot exceed your worker balance.');
      return;
    }
    if (!payoutForm.institutionName.trim() || !payoutForm.accountName.trim() || !payoutForm.accountNumber.trim()) {
      toast.error('Complete the destination details before submitting your withdrawal.');
      return;
    }

    try {
      setIsSubmittingPayout(true);
      payoutIdempotencyKeyRef.current ||= `payout-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const token = await AsyncStorage.getItem('auth_token');
      const result = await apiRequest(`${API_URL}/payment/payout-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          amount,
          idempotencyKey: payoutIdempotencyKeyRef.current,
          destinationSnapshot: {
            methodType: payoutForm.methodType,
            institutionName: payoutForm.institutionName.trim(),
            accountName: payoutForm.accountName.trim(),
            accountNumber: payoutForm.accountNumber.trim(),
          },
        }),
      }, 'Failed to create withdrawal.');

      if (!result.ok) {
        throw new Error(result.message || 'Failed to create withdrawal.');
      }

      setPayoutForm({
        amount: '',
        methodType: 'bank_transfer',
        institutionName: '',
        accountName: '',
        accountNumber: '',
      });
      payoutIdempotencyKeyRef.current = null;
      setIsPayoutFormExpanded(false);
      toast.success('Your withdrawal has been submitted for admin review.');
      await refreshWalletData();
    } catch (error: any) {
      toast.error(error?.message || 'Unable to submit withdrawal.');
    } finally {
      setIsSubmittingPayout(false);
    }
  };

  const handleCancelPayout = async (payoutRequestId: string) => {
    try {
      setCancellingPayoutId(payoutRequestId);
      const token = await AsyncStorage.getItem('auth_token');
      const result = await apiRequest(`${API_URL}/payment/payout-requests/${payoutRequestId}/cancel`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }, 'Failed to cancel withdrawal.');

      if (!result.ok) {
        throw new Error(result.message || 'Failed to cancel withdrawal.');
      }

      toast.success('The amount was restored to your worker balance.');
      await refreshWalletData();
    } catch (error: any) {
      toast.error(error?.message || 'Unable to cancel withdrawal.');
    } finally {
      setCancellingPayoutId(null);
    }
  };

  const handleWithdrawPress = () => {
    setIsPayoutFormExpanded((expanded) => !expanded);
  };

  return (
    <View style={styles.container}>
      <TabTopNav
        title="E-Wallet"
        showNotifications
        onOpenNotifications={onOpenNotifications}
        notificationBadgeCount={notificationBadgeCount}
      />

      <ScrollView ref={scrollViewRef} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={isRefreshingWallet && hasLoadedWallet} onRefresh={() => void refreshWalletData()} tintColor={tokens.colors.brand} />}>
        {!hasLoadedWallet && isRefreshingWallet ? <WalletSkeleton /> : <>
        <WalletError message={walletError} onRetry={() => void refreshWalletData()} />
        <WalletBalanceCard
          label="Available to withdraw"
          value={formatCurrency(workerBalance)}
          secondary={isBothRole ? `Employer funds: ${formatCurrency(employerBalance)} (not withdrawable here)` : undefined}
          note="Completed local-job earnings arrive here. Withdraw only your worker balance through a verified Philippine bank or mobile wallet."
          refreshing={isRefreshingWallet}
          onRefresh={() => void refreshWalletData()}
          actionLabel="Withdraw Funds"
          actionIcon="arrow-down-outline"
          expanded={isPayoutFormExpanded}
          onAction={handleWithdrawPress}
        />
        <WalletMetrics items={[
          { label: 'Worker balance', value: formatCurrency(workerBalance), icon: 'wallet-outline' },
          { label: 'Pending withdrawals', value: formatCurrency(pendingPayoutTotal), icon: 'time-outline' },
          { label: 'Transactions', value: String(transactions.length), icon: 'receipt-outline' },
        ]} />

        {hasWorkerWallet && isPayoutFormExpanded ? (
          <View
            style={styles.card}
            onLayout={(event) => setPayoutFormOffsetY(event.nativeEvent.layout.y)}
          >
            <Text style={styles.cardTitle}>Withdraw Funds</Text>
            <Text style={styles.cardSubtitle}>Available to withdraw: {formatCurrency(workerBalance)}</Text>

            <Text style={styles.inputLabel}>Amount (PHP)</Text>
            <TextInput
              style={styles.input}
              value={payoutForm.amount}
              onChangeText={(amount) => setPayoutForm((current) => ({ ...current, amount }))}
              placeholder="1000"
              placeholderTextColor={tokens.colors.textSubtle}
              keyboardType="numeric"
              accessibilityLabel="Withdrawal amount in Philippine pesos"
            />

            <Text style={styles.inputLabel}>Method</Text>
            <View style={styles.segmentRow}>
              {[
                { value: 'bank_transfer', label: 'Bank' },
                { value: 'gcash', label: 'GCash' },
                { value: 'maya', label: 'Maya' },
              ].map((method) => {
                const isActive = payoutForm.methodType === method.value;
                return (
                  <TouchableOpacity
                    key={method.value}
                    style={[styles.segmentChip, isActive && styles.segmentChipActive]}
                    onPress={() => setPayoutForm((current) => ({ ...current, methodType: method.value }))}
                    accessibilityRole="radio"
                    accessibilityLabel={`${method.label} withdrawal method`}
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text style={[styles.segmentChipText, isActive && styles.segmentChipTextActive]}>{method.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.inputLabel}>Institution</Text>
            <TextInput
              style={styles.input}
              value={payoutForm.institutionName}
              onChangeText={(institutionName) => setPayoutForm((current) => ({ ...current, institutionName }))}
              placeholder="BDO, GCash, Maya"
              placeholderTextColor={tokens.colors.textSubtle}
              accessibilityLabel="Financial institution"
            />

            <Text style={styles.inputLabel}>Account Name</Text>
            <TextInput
              style={styles.input}
              value={payoutForm.accountName}
              onChangeText={(accountName) => setPayoutForm((current) => ({ ...current, accountName }))}
              placeholder="Juan Dela Cruz"
              placeholderTextColor={tokens.colors.textSubtle}
              accessibilityLabel="Account holder name"
            />

            <Text style={styles.inputLabel}>Account Number</Text>
            <TextInput
              style={styles.input}
              value={payoutForm.accountNumber}
              onChangeText={(accountNumber) => setPayoutForm((current) => ({ ...current, accountNumber }))}
              placeholder="09171234567 or bank account number"
              placeholderTextColor={tokens.colors.textSubtle}
              accessibilityLabel="Bank or mobile wallet account number"
            />

            <TouchableOpacity
              style={[styles.primaryButton, isSubmittingPayout && styles.primaryButtonDisabled]}
              onPress={handleCreatePayout}
              disabled={isSubmittingPayout}
              accessibilityRole="button"
              accessibilityLabel="Submit withdrawal request"
              accessibilityState={{ disabled: isSubmittingPayout, busy: isSubmittingPayout }}
            >
              {isSubmittingPayout ? <ActivityIndicator color={tokens.colors.white} /> : <Text style={styles.primaryButtonText}>Withdraw Funds</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.noticeCard}>
            <Ionicons name="information-circle-outline" size={20} color={tokens.colors.brandAccent} />
            <Text style={styles.noticeText}>This screen is for worker withdrawals only. Switch to employer mode to fund jobs from the employer wallet.</Text>
          </View>
        )}

        <WalletSection title="Recent Transactions" subtitle="Your latest worker-wallet activity.">
          {transactions.length === 0 ? (
            <WalletEmpty title="No transactions yet" body="Completed work, withdrawals, and refunds will appear here." />
          ) : (
            transactions.slice(0, 15).map((transaction) => <WalletTransactionRow key={transaction._id} title={getTransactionLabel(transaction)} subtitle={transaction.reference || transaction.providerReference || transaction.type} amount={formatCurrency(transaction.amount)} date={formatDate(transaction.createdAt)} status={transaction.status || 'unknown'} direction={transaction.type === 'PAYOUT' || transaction.type === 'REFUND' ? 'credit' : transaction.type === 'ESCROW' ? 'debit' : 'neutral'} />)
          )}
        </WalletSection>

        <WalletSection title="Withdrawal History" subtitle="Track review and payment status.">
          {payoutRequests.length === 0 ? <WalletEmpty icon="cash-outline" title="No withdrawals yet" body="Submitted withdrawal requests will appear here." /> : <View style={styles.listWrap}>{payoutRequests.map((request) => {
            const statusStyle = getPayoutStatusStyle(request.status);
            return <View key={request._id} style={styles.listCard}>
              <View style={styles.listHeader}><View style={styles.transactionTypeWrap}><Text style={styles.listTitle}>{formatCurrency(request.amount)}</Text><Text style={styles.listSubtitle} numberOfLines={1}>{request.destinationSnapshot.institutionName || 'Destination not set'} · {request.destinationSnapshot.accountName || 'Unknown account'}</Text></View><View style={[styles.badge, { backgroundColor: statusStyle.backgroundColor }]}><Text style={[styles.badgeText, { color: statusStyle.color }]}>{request.status}</Text></View></View>
              <Text style={styles.metaText}>{request.destinationSnapshot.accountNumberMasked || request.destinationSnapshot.accountNumber || 'No account number'}</Text>
              <Text style={styles.metaDate}>Requested {formatDate(request.createdAt)}{request.reviewedAt ? ` · Reviewed ${formatDate(request.reviewedAt)}` : ''}</Text>
              {request.reviewNotes ? <Text style={styles.reviewNotes}>{request.reviewNotes}</Text> : null}
              {request.status === 'requested' ? <TouchableOpacity style={styles.secondaryButton} onPress={() => void handleCancelPayout(request._id)} disabled={cancellingPayoutId === request._id} accessibilityRole="button" accessibilityState={{ busy: cancellingPayoutId === request._id, disabled: cancellingPayoutId === request._id }}>{cancellingPayoutId === request._id ? <ActivityIndicator color={tokens.colors.danger} size="small" /> : <Text style={styles.secondaryButtonText}>Cancel Withdrawal</Text>}</TouchableOpacity> : null}
            </View>;
          })}</View>}
        </WalletSection>
        </>}
      </ScrollView>

      <Navigation activeTab={activeTab} onTabPress={onTabPress} messageBadgeCount={messageBadgeCount} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.signedInCanvas,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 112,
    gap: 14,
  },
  balanceCard: {
    backgroundColor: tokens.colors.brandDark,
    borderRadius: 24,
    padding: 18,
    ...tokens.shadow.card,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  balanceLabel: {
    color: tokens.colors.onBrandMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  balanceValue: {
    marginTop: 8,
    color: tokens.colors.white,
    fontSize: 32,
    fontWeight: '800',
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  balanceNote: {
    marginTop: 10,
    color: '#D8E3F5',
    fontSize: 12,
    lineHeight: 17,
  },
  balanceMetricsRow: {
    marginTop: 16,
    gap: 10,
  },
  balanceCtaButton: {
    marginTop: 16,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: tokens.colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  balanceCtaButtonText: {
    color: tokens.colors.brand,
    fontSize: 14,
    fontWeight: '800',
  },
  balanceMetricCard: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  balanceMetricLabel: {
    color: '#DBE8FA',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  balanceMetricValue: {
    marginTop: 4,
    color: tokens.colors.white,
    fontSize: 18,
    fontWeight: '700',
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
    color: tokens.colors.text,
    fontSize: 19,
    fontWeight: '700',
  },
  cardSubtitle: {
    marginTop: 4,
    color: tokens.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  inputLabel: {
    marginTop: 14,
    marginBottom: 6,
    color: tokens.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    minHeight: 52,
    backgroundColor: tokens.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: tokens.colors.text,
    fontSize: 14,
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segmentChip: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: tokens.colors.contentMuted,
  },
  segmentChipActive: {
    backgroundColor: '#0F2954',
    borderColor: '#0F2954',
  },
  segmentChipText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  segmentChipTextActive: {
    color: tokens.colors.white,
  },
  primaryButton: {
    marginTop: 16,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: tokens.colors.brandAccent,
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
  secondaryButton: {
    marginTop: 14,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
  },
  secondaryButtonText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '700',
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  noticeText: {
    flex: 1,
    color: '#1C4D8D',
    fontSize: 13,
    lineHeight: 18,
  },
  emptyState: {
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
  listWrap: {
    marginTop: 14,
    gap: 12,
  },
  listCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: '#FBFDFF',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  listTitle: {
    color: tokens.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  listSubtitle: {
    marginTop: 2,
    color: tokens.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
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
  metaText: {
    marginTop: 8,
    color: tokens.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  metaDate: {
    marginTop: 8,
    color: tokens.colors.textSubtle,
    fontSize: 11,
  },
  timelineRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 10,
  },
  timelineItem: {
    flex: 1,
    backgroundColor: tokens.colors.contentSurface,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timelineLabel: {
    color: tokens.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  timelineValue: {
    marginTop: 4,
    color: tokens.colors.text,
    fontSize: 12,
    lineHeight: 17,
  },
  reviewNotes: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.contentMuted,
    padding: 10,
    color: '#475569',
    fontSize: 12,
    lineHeight: 18,
  },
  transactionTypeWrap: {
    flex: 1,
  },
});
