import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Navigation from '../../components/navigation';
import TabTopNav from '../../components/TabTopNav';
import { API_URL } from '../../config';
import { apiRequest, asList, asObject } from '../../lib/api';
import { tokens } from '../../theme/tokens';
import { useToast } from '../../contexts/ToastContext';

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

const getTransactionStatusStyle = (status?: WalletTransaction['status']) => {
  switch (status) {
    case 'COMPLETED':
      return { backgroundColor: '#DCFCE7', color: '#15803D' };
    case 'PENDING':
      return { backgroundColor: '#DBEAFE', color: '#1D4ED8' };
    case 'FAILED':
      return { backgroundColor: '#FEE2E2', color: '#B91C1C' };
    case 'CANCELLED':
      return { backgroundColor: '#F3F4F6', color: '#6B7280' };
    default:
      return { backgroundColor: '#F3F4F6', color: '#6B7280' };
  }
};

const getPayoutStatusStyle = (status: PayoutRequest['status']) => {
  switch (status) {
    case 'requested':
      return { backgroundColor: '#DBEAFE', color: '#1D4ED8' };
    case 'approved':
      return { backgroundColor: '#FEF3C7', color: '#B45309' };
    case 'paid':
      return { backgroundColor: '#DCFCE7', color: '#15803D' };
    case 'rejected':
      return { backgroundColor: '#FEE2E2', color: '#B91C1C' };
    case 'cancelled':
      return { backgroundColor: '#F3F4F6', color: '#6B7280' };
    default:
      return { backgroundColor: '#F3F4F6', color: '#6B7280' };
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
  const scrollViewRef = useRef<ScrollView>(null);
  const [isRefreshingWallet, setIsRefreshingWallet] = useState(false);
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
  const activeBalance = isBothRole ? workerBalance + employerBalance : workerBalance;

  const pendingPayoutTotal = useMemo(
    () => payoutRequests
      .filter((request) => request.status === 'requested' || request.status === 'approved')
      .reduce((sum, request) => sum + Number(request.amount || 0), 0),
    [payoutRequests],
  );

  const refreshWalletData = useCallback(async () => {
    try {
      setIsRefreshingWallet(true);
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
    } catch {
      // Preserve current wallet state on transient failures.
    } finally {
      setIsRefreshingWallet(false);
    }
  }, []);

  useEffect(() => {
    void refreshWalletData();
  }, [refreshWalletData]);

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
      const token = await AsyncStorage.getItem('auth_token');
      const result = await apiRequest(`${API_URL}/payment/payout-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          amount,
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
    scrollViewRef.current?.scrollTo({
      y: Math.max(payoutFormOffsetY - 20, 0),
      animated: true,
    });
  };

  return (
    <View style={styles.container}>
      <TabTopNav
        title="E-Wallet"
        showNotifications
        onOpenNotifications={onOpenNotifications}
        notificationBadgeCount={notificationBadgeCount}
      />

      <ScrollView ref={scrollViewRef} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <View>
              <Text style={styles.balanceLabel}>{isBothRole ? 'Combined Balance' : 'Available to withdraw'}</Text>
              <Text style={styles.balanceValue}>{formatCurrency(activeBalance)}</Text>
            </View>
            <TouchableOpacity style={styles.refreshButton} onPress={() => void refreshWalletData()} disabled={isRefreshingWallet}>
              {isRefreshingWallet ? (
                <ActivityIndicator color={tokens.colors.white} size="small" />
              ) : (
                <Ionicons name="refresh-outline" size={18} color={tokens.colors.white} />
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.balanceNote}>
            {isBothRole
              ? 'Your combined employer and worker balance. Top up from the employer wallet tab to fund jobs, and withdraw your earned worker balance here.'
              : 'Workers cannot top up here. Employers fund jobs from their employer wallet, and completed earnings land in your worker balance for withdrawal.'}
          </Text>

          <View style={styles.balanceMetricsRow}>
            {isBothRole ? (
              <>
                <View style={styles.balanceMetricCard}>
                  <Text style={styles.balanceMetricLabel}>Employer Balance</Text>
                  <Text style={styles.balanceMetricValue}>{formatCurrency(employerBalance)}</Text>
                </View>
                <View style={styles.balanceMetricCard}>
                  <Text style={styles.balanceMetricLabel}>Worker Balance</Text>
                  <Text style={styles.balanceMetricValue}>{formatCurrency(workerBalance)}</Text>
                </View>
              </>
            ) : (
              <View style={styles.balanceMetricCard}>
                <Text style={styles.balanceMetricLabel}>Worker Balance</Text>
                <Text style={styles.balanceMetricValue}>{formatCurrency(workerBalance)}</Text>
              </View>
            )}
            <View style={styles.balanceMetricCard}>
              <Text style={styles.balanceMetricLabel}>Pending Withdrawals</Text>
              <Text style={styles.balanceMetricValue}>{formatCurrency(pendingPayoutTotal)}</Text>
            </View>
            <View style={styles.balanceMetricCard}>
              <Text style={styles.balanceMetricLabel}>Transactions</Text>
              <Text style={styles.balanceMetricValue}>{transactions.length}</Text>
            </View>
          </View>

          {hasWorkerWallet ? (
            <TouchableOpacity style={styles.balanceCtaButton} onPress={handleWithdrawPress} activeOpacity={0.9}>
              <Ionicons name="arrow-down-outline" size={16} color="#1C4D8D" />
              <Text style={styles.balanceCtaButtonText}>Withdraw Funds</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {hasWorkerWallet ? (
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
            />

            <Text style={styles.inputLabel}>Account Name</Text>
            <TextInput
              style={styles.input}
              value={payoutForm.accountName}
              onChangeText={(accountName) => setPayoutForm((current) => ({ ...current, accountName }))}
              placeholder="Juan Dela Cruz"
              placeholderTextColor={tokens.colors.textSubtle}
            />

            <Text style={styles.inputLabel}>Account Number</Text>
            <TextInput
              style={styles.input}
              value={payoutForm.accountNumber}
              onChangeText={(accountNumber) => setPayoutForm((current) => ({ ...current, accountNumber }))}
              placeholder="09171234567 or bank account number"
              placeholderTextColor={tokens.colors.textSubtle}
            />

            <TouchableOpacity
              style={[styles.primaryButton, isSubmittingPayout && styles.primaryButtonDisabled]}
              onPress={handleCreatePayout}
              disabled={isSubmittingPayout}
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

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Withdrawal History</Text>
          <Text style={styles.cardSubtitle}>Track requested, approved, rejected, paid, and cancelled withdrawals.</Text>

          {payoutRequests.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="cash-outline" size={30} color={tokens.colors.textMuted} />
              <Text style={styles.emptyTitle}>No withdrawals yet</Text>
              <Text style={styles.emptyBody}>Submitted withdrawals will appear here with review status and notes.</Text>
            </View>
          ) : (
            <View style={styles.listWrap}>
              {payoutRequests.map((request) => {
                const statusStyle = getPayoutStatusStyle(request.status);
                return (
                  <View key={request._id} style={styles.listCard}>
                    <View style={styles.listHeader}>
                      <View>
                        <Text style={styles.listTitle}>{formatCurrency(request.amount)}</Text>
                        <Text style={styles.listSubtitle}>{request.destinationSnapshot.institutionName || 'Destination not set'} · {request.destinationSnapshot.accountName || 'Unknown account'}</Text>
                      </View>
                      <View style={[styles.badge, { backgroundColor: statusStyle.backgroundColor }]}>
                        <Text style={[styles.badgeText, { color: statusStyle.color }]}>{request.status}</Text>
                      </View>
                    </View>
                    <Text style={styles.metaText}>{request.destinationSnapshot.accountNumberMasked || request.destinationSnapshot.accountNumber || 'No account number'}</Text>
                    <View style={styles.timelineRow}>
                      <View style={styles.timelineItem}>
                        <Text style={styles.timelineLabel}>Requested</Text>
                        <Text style={styles.timelineValue}>{formatDate(request.createdAt)}</Text>
                      </View>
                      <View style={styles.timelineItem}>
                        <Text style={styles.timelineLabel}>Reviewed</Text>
                        <Text style={styles.timelineValue}>{formatDate(request.reviewedAt)}</Text>
                      </View>
                    </View>
                    {request.reviewNotes ? <Text style={styles.reviewNotes}>{request.reviewNotes}</Text> : null}
                    {request.status === 'requested' ? (
                      <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => void handleCancelPayout(request._id)}
                        disabled={cancellingPayoutId === request._id}
                      >
                        {cancellingPayoutId === request._id ? (
                          <ActivityIndicator color={tokens.colors.danger} size="small" />
                        ) : (
                          <Text style={styles.secondaryButtonText}>Cancel Withdrawal</Text>
                        )}
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent Transactions</Text>
          <Text style={styles.cardSubtitle}>Top-up, payout, refund, and escrow records with linked references.</Text>

          {transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={30} color={tokens.colors.textMuted} />
              <Text style={styles.emptyTitle}>No transactions yet</Text>
              <Text style={styles.emptyBody}>Your transaction ledger will appear here once your wallet is active.</Text>
            </View>
          ) : (
            <View style={styles.listWrap}>
              {transactions.slice(0, 15).map((transaction) => {
                const statusStyle = getTransactionStatusStyle(transaction.status);
                return (
                  <View key={transaction._id} style={styles.listCard}>
                    <View style={styles.listHeader}>
                      <View style={styles.transactionTypeWrap}>
                        <Text style={styles.listTitle}>{getTransactionLabel(transaction)}</Text>
                        <Text style={styles.listSubtitle}>{transaction.type} · {formatCurrency(transaction.amount)}</Text>
                      </View>
                      <View style={[styles.badge, { backgroundColor: statusStyle.backgroundColor }]}>
                        <Text style={[styles.badgeText, { color: statusStyle.color }]}>{transaction.status || 'unknown'}</Text>
                      </View>
                    </View>
                    <Text style={styles.metaText}>Reference: {transaction.reference || transaction.providerReference || 'N/A'}</Text>
                    {/* Hide sensitive linked entity details for job applications */}
                    <Text style={styles.metaText}>Linked entity: {transaction.relatedEntityType === 'job_application' ? 'Hidden' : (transaction.relatedEntityType || transaction.balanceTarget || 'N/A')}</Text>
                    <Text style={styles.metaDate}>{formatDate(transaction.createdAt)}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <Navigation activeTab={activeTab} onTabPress={onTabPress} messageBadgeCount={messageBadgeCount} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 120,
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
    color: '#1C4D8D',
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
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
    minHeight: 42,
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
    color: '#1E3A8A',
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
    backgroundColor: '#F8FAFC',
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
    backgroundColor: '#F8FAFC',
    padding: 10,
    color: '#475569',
    fontSize: 12,
    lineHeight: 18,
  },
  transactionTypeWrap: {
    flex: 1,
  },
});
