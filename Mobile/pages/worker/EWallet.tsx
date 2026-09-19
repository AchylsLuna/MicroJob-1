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
import { WorkerQrRequestModal } from '../../components/wallet/WalletQrFlow';
import { formatCurrency, formatDateTime } from '../../lib/formatters';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

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
  walletDirection?: 'credit' | 'debit' | 'neutral';
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

const formatDate = (value: string | undefined, t: TFunction) => {
  if (!value) return t('eWallet.common.noDate');
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return t('eWallet.common.noDate');
  return formatDateTime(parsed, { month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' });
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

const getTransactionLabel = (transaction: WalletTransaction, t: TFunction) => {
  if (transaction.label) return transaction.label;
  switch (transaction.type) {
    case 'TOP_UP':
      return t('eWallet.transactions.type.topUp');
    case 'ESCROW':
      return t('eWallet.transactions.type.escrow');
    case 'PAYOUT':
      return t('eWallet.transactions.type.payout');
    case 'REFUND':
      return t('eWallet.transactions.type.refund');
    default:
      return t('eWallet.transactions.type.generic');
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
  const [isQrVisible, setIsQrVisible] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState({ transactions: false, withdrawals: false });
  const [isBalanceHidden, setIsBalanceHidden] = useState(false);
  const [walletSummary, setWalletSummary] = useState({ credited: 0, spent: 0, pending: 0, transactionCount: 0 });
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
  const { t } = useTranslation('worker');

  const hasWorkerWallet = accountOptions.includes('worker') || profileRole === 'worker' || profileRole === 'both';
  const isBothRole = profileRole === 'both' || (accountOptions.includes('worker') && accountOptions.includes('employer'));
  const pendingPayoutTotal = useMemo(
    () => payoutRequests
      .filter((request) => request.status === 'requested' || request.status === 'approved')
      .reduce((sum, request) => sum + Number(request.amount || 0), 0),
    [payoutRequests],
  );

  const MINIMUM_PAYOUT_AMOUNT = 100;

  const refreshWalletData = useCallback(async (showFeedback = false) => {
    try {
      setIsRefreshingWallet(true);
      setWalletError('');
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const [profileResult, walletResult, payoutsResult] = await Promise.all([
        apiRequest(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        }, t('eWallet.apiFallback.loadProfileFailed')),
        apiRequest(`${API_URL}/payment/wallet?mode=worker`, {
          headers: { Authorization: `Bearer ${token}` },
        }, t('eWallet.apiFallback.loadTransactionsFailed')),
        apiRequest(`${API_URL}/payment/payout-requests`, {
          headers: { Authorization: `Bearer ${token}` },
        }, t('eWallet.apiFallback.loadPayoutsFailed')),
      ]);

      const failedResult = [profileResult, walletResult, payoutsResult].find((result) => !result.ok);
      if (failedResult) setWalletError(failedResult.message || t('eWallet.apiFallback.refreshFailed'));

      let currentWorkerBalance = workerBalance;

      if (profileResult.ok) {
        const profilePayload = asObject<any>(profileResult.data) || asObject<any>(profileResult.raw) || {};
        const normalizedRole = String(profilePayload?.role || '').toLowerCase();
        const normalizedOptions = normalizeAccountOptions(profilePayload?.accountOptions || []);
        const nextWorkerBalance = Number(profilePayload?.workerBalance || 0);
        const nextEmployerBalance = Number(profilePayload?.employerBalance || 0);

        setProfileRole(normalizedRole || 'worker');
        setAccountOptions(normalizedOptions.length > 0 ? normalizedOptions : normalizedRole === 'employer' ? ['employer'] : normalizedRole === 'both' ? ['worker', 'employer'] : ['worker']);
        currentWorkerBalance = Number.isFinite(nextWorkerBalance) ? nextWorkerBalance : 0;
        setWorkerBalance(currentWorkerBalance);
        setEmployerBalance(Number.isFinite(nextEmployerBalance) ? nextEmployerBalance : 0);
      }

      if (walletResult.ok) {
        const transactionPayload = asObject<any>(walletResult.data) || asObject<any>(walletResult.raw) || {};
        const nextTransactions = asList<WalletTransaction>(transactionPayload.transactions || walletResult.raw, ['transactions']);
        setTransactions(nextTransactions);
        currentWorkerBalance = Number(transactionPayload.balance || 0);
        setWorkerBalance(currentWorkerBalance);
        setWalletSummary({ credited: Number(transactionPayload.summary?.credited || 0), spent: Number(transactionPayload.summary?.spent || 0), pending: Number(transactionPayload.summary?.pending || 0), transactionCount: Number(transactionPayload.summary?.transactionCount || nextTransactions.length) });
      }

      if (payoutsResult.ok) {
        const payoutPayload = asObject<any>(payoutsResult.data) || asObject<any>(payoutsResult.raw) || {};
        const nextPayouts = asList<PayoutRequest>(payoutPayload.payoutRequests || payoutsResult.raw, ['payoutRequests']);
        setPayoutRequests(nextPayouts);
      } else {
        setPayoutRequests([]);
      }

      if (showFeedback) {
        if (currentWorkerBalance <= 0) {
          toast.info(t('eWallet.toast.noBalance'));
        } else {
          toast.success(t('eWallet.toast.balanceVerified', { amount: formatCurrency(currentWorkerBalance) }));
        }
      }
    } catch (error: any) {
      setWalletError(error?.message || t('eWallet.apiFallback.connectionFailed'));
    } finally {
      setIsRefreshingWallet(false);
      setHasLoadedWallet(true);
    }
  }, [t, toast, workerBalance]);

  useEffect(() => {
    void refreshWalletData();
  }, [refreshWalletData]);

  useEffect(() => {
    if (!isPayoutFormExpanded || payoutFormOffsetY <= 0) return;
    scrollViewRef.current?.scrollTo({ y: Math.max(payoutFormOffsetY - 20, 0), animated: true });
  }, [isPayoutFormExpanded, payoutFormOffsetY]);

  const handleCreatePayout = async () => {
    if (!hasWorkerWallet) {
      toast.error(t('eWallet.toast.workerOnlyPayout'));
      return;
    }

    if (workerBalance <= 0) {
      toast.error(t('eWallet.toast.noBalanceWithdraw'));
      return;
    }

    const amount = Number(payoutForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error(t('eWallet.toast.invalidAmount'));
      return;
    }
    if (amount < MINIMUM_PAYOUT_AMOUNT) {
      toast.error(t('eWallet.toast.belowMinimumWithdrawal', { min: formatCurrency(MINIMUM_PAYOUT_AMOUNT) }));
      return;
    }
    if (amount > workerBalance) {
      toast.error(t('eWallet.toast.amountExceedsBalanceDetailed', { requested: formatCurrency(amount), available: formatCurrency(workerBalance) }));
      return;
    }
    if (!payoutForm.institutionName.trim() || !payoutForm.accountName.trim() || !payoutForm.accountNumber.trim()) {
      toast.error(t('eWallet.toast.incompleteDestination'));
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
      }, t('eWallet.apiFallback.createPayoutFailed'));

      if (!result.ok) {
        throw new Error(result.message || t('eWallet.apiFallback.createPayoutFailed'));
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
      toast.success(t('eWallet.toast.payoutSubmitted'));
      await refreshWalletData();
    } catch (error: any) {
      toast.error(error?.message || t('eWallet.apiFallback.submitPayoutFailed'));
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
      }, t('eWallet.apiFallback.cancelWithdrawalFailed'));

      if (!result.ok) {
        throw new Error(result.message || t('eWallet.apiFallback.cancelWithdrawalFailed'));
      }

      toast.success(t('eWallet.toast.payoutCancelled'));
      await refreshWalletData();
    } catch (error: any) {
      toast.error(error?.message || t('eWallet.apiFallback.cancelPayoutFailed'));
    } finally {
      setCancellingPayoutId(null);
    }
  };

  const handleWithdrawPress = () => {
    setIsPayoutFormExpanded((expanded) => !expanded);
  };

  const toggleSection = (section: keyof typeof collapsedSections) => setCollapsedSections((current) => ({ ...current, [section]: !current[section] }));

  return (
    <View style={styles.container}>
      <TabTopNav
        title={t('eWallet.headerTitle')}
        showNotifications
        onOpenNotifications={onOpenNotifications}
        notificationBadgeCount={notificationBadgeCount}
      />

      <ScrollView ref={scrollViewRef} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={isRefreshingWallet && hasLoadedWallet} onRefresh={() => void refreshWalletData(true)} tintColor={tokens.colors.brand} />}>
        {!hasLoadedWallet && isRefreshingWallet ? <WalletSkeleton /> : <>
        <WalletError message={walletError} onRetry={() => void refreshWalletData(true)} />
        <WalletBalanceCard
          label={t('eWallet.balanceCard.label')}
          value={formatCurrency(workerBalance)}
          secondary={isBothRole ? t('eWallet.balanceCard.employerSecondary', { amount: formatCurrency(employerBalance) }) : undefined}
          note={t('eWallet.balanceCard.note')}
          refreshing={isRefreshingWallet}
          onRefresh={() => void refreshWalletData(true)}
          actionLabel={t('eWallet.balanceCard.withdrawAction')}
          actionIcon="arrow-down-outline"
          expanded={isPayoutFormExpanded}
          onAction={handleWithdrawPress}
          hidden={isBalanceHidden}
          onToggleHidden={() => setIsBalanceHidden((hidden) => !hidden)}
          quickActionLabel={t('eWallet.balanceCard.requestInvoiceAction')}
          quickActionIcon="qr-code-outline"
          onQuickAction={() => { setSelectedInvoiceId(null); setIsQrVisible(true); }}
        />
        <WalletMetrics items={[
          { label: t('eWallet.metrics.totalCredited'), value: isBalanceHidden ? '•••' : formatCurrency(walletSummary.credited), icon: 'arrow-down-outline' },
          { label: t('eWallet.metrics.pending'), value: isBalanceHidden ? '•••' : formatCurrency(walletSummary.pending || pendingPayoutTotal), icon: 'time-outline' },
          { label: t('eWallet.metrics.transactions'), value: String(walletSummary.transactionCount), icon: 'receipt-outline' },
        ]} />

        {isPayoutFormExpanded && hasWorkerWallet ? (
          <View
            style={styles.card}
            onLayout={(event) => setPayoutFormOffsetY(event.nativeEvent.layout.y)}
            accessibilityLabel={t('eWallet.payoutForm.title')}
          >
            <Text style={styles.cardTitle}>{t('eWallet.payoutForm.title')}</Text>
            <Text style={styles.cardSubtitle}>
              {t('eWallet.payoutForm.availableSubtitle', { amount: formatCurrency(workerBalance) })}
            </Text>

            <Text style={styles.inputLabel}>{t('eWallet.payoutForm.amountLabel')}</Text>
            <TextInput
              style={styles.input}
              value={payoutForm.amount}
              onChangeText={(amount) => setPayoutForm((current) => ({ ...current, amount: amount.replace(/[^0-9.]/g, '') }))}
              placeholder="0.00"
              placeholderTextColor={tokens.colors.textSubtle}
              keyboardType="decimal-pad"
              accessibilityLabel={t('eWallet.payoutForm.amountAccessibility')}
            />

            <Text style={styles.inputLabel}>{t('eWallet.payoutForm.methodLabel')}</Text>
            <View style={styles.segmentRow}>
              {[
                { value: 'bank_transfer', label: t('eWallet.payoutForm.methodOptions.bank') },
                { value: 'gcash', label: t('eWallet.payoutForm.methodOptions.gcash') },
                { value: 'maya', label: t('eWallet.payoutForm.methodOptions.maya') },
              ].map((method) => {
                const isActive = payoutForm.methodType === method.value;
                return (
                  <TouchableOpacity
                    key={method.value}
                    style={[styles.segmentChip, isActive && styles.segmentChipActive]}
                    onPress={() => setPayoutForm((current) => ({ ...current, methodType: method.value }))}
                    accessibilityRole="radio"
                    accessibilityLabel={t('eWallet.payoutForm.methodAccessibility', { method: method.label })}
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text style={[styles.segmentChipText, isActive && styles.segmentChipTextActive]}>{method.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.inputLabel}>{t('eWallet.payoutForm.institutionLabel')}</Text>
            <TextInput
              style={styles.input}
              value={payoutForm.institutionName}
              onChangeText={(institutionName) => setPayoutForm((current) => ({ ...current, institutionName }))}
              placeholder={t('eWallet.payoutForm.institutionPlaceholder')}
              placeholderTextColor={tokens.colors.textSubtle}
              accessibilityLabel={t('eWallet.payoutForm.institutionAccessibility')}
            />

            <Text style={styles.inputLabel}>{t('eWallet.payoutForm.accountNameLabel')}</Text>
            <TextInput
              style={styles.input}
              value={payoutForm.accountName}
              onChangeText={(accountName) => setPayoutForm((current) => ({ ...current, accountName }))}
              placeholder={t('eWallet.payoutForm.accountNamePlaceholder')}
              placeholderTextColor={tokens.colors.textSubtle}
              accessibilityLabel={t('eWallet.payoutForm.accountNameAccessibility')}
            />

            <Text style={styles.inputLabel}>{t('eWallet.payoutForm.accountNumberLabel')}</Text>
            <TextInput
              style={styles.input}
              value={payoutForm.accountNumber}
              onChangeText={(accountNumber) => setPayoutForm((current) => ({ ...current, accountNumber }))}
              placeholder={t('eWallet.payoutForm.accountNumberPlaceholder')}
              placeholderTextColor={tokens.colors.textSubtle}
              accessibilityLabel={t('eWallet.payoutForm.accountNumberAccessibility')}
            />

            <TouchableOpacity
              style={[styles.primaryButton, isSubmittingPayout && styles.primaryButtonDisabled]}
              onPress={handleCreatePayout}
              disabled={isSubmittingPayout}
              accessibilityRole="button"
              accessibilityLabel={t('eWallet.payoutForm.submitAccessibility')}
              accessibilityState={{ disabled: isSubmittingPayout, busy: isSubmittingPayout }}
            >
              {isSubmittingPayout ? <ActivityIndicator color={tokens.colors.white} /> : <Text style={styles.primaryButtonText}>{t('eWallet.payoutForm.submitButton')}</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.noticeCard}>
            <Ionicons name="information-circle-outline" size={20} color={tokens.colors.brandAccent} />
            <Text style={styles.noticeText}>{t('eWallet.notice.workerOnly')}</Text>
          </View>
        )}

        <WalletSection title={t('eWallet.transactions.sectionTitle')} subtitle={t('eWallet.transactions.sectionSubtitle')} collapsible collapsed={collapsedSections.transactions} onToggle={() => toggleSection('transactions')}>
          {transactions.length === 0 ? (
            <WalletEmpty title={t('eWallet.transactions.empty.title')} body={t('eWallet.transactions.empty.body')} />
          ) : (
            transactions.slice(0, 15).map((transaction) => <WalletTransactionRow key={transaction._id} title={getTransactionLabel(transaction, t)} subtitle={transaction.reference || transaction.providerReference || transaction.type} amount={`${transaction.walletDirection === 'credit' ? '+' : transaction.walletDirection === 'debit' ? '-' : ''}${formatCurrency(transaction.amount)}`} date={formatDate(transaction.createdAt, t)} status={transaction.status || t('eWallet.common.statusUnknown')} direction={transaction.walletDirection || 'neutral'} />)
          )}
        </WalletSection>

        <WalletSection title={t('eWallet.withdrawals.sectionTitle')} subtitle={t('eWallet.withdrawals.sectionSubtitle')} collapsible collapsed={collapsedSections.withdrawals} onToggle={() => toggleSection('withdrawals')}>
          {payoutRequests.length === 0 ? <WalletEmpty icon="cash-outline" title={t('eWallet.withdrawals.empty.title')} body={t('eWallet.withdrawals.empty.body')} /> : <View style={styles.listWrap}>{payoutRequests.map((request) => {
            const statusStyle = getPayoutStatusStyle(request.status);
            return <View key={request._id} style={styles.listCard}>
              <View style={styles.listHeader}><View style={styles.transactionTypeWrap}><Text style={styles.listTitle}>{formatCurrency(request.amount)}</Text><Text style={styles.listSubtitle} numberOfLines={1}>{request.destinationSnapshot.institutionName || t('eWallet.withdrawals.destinationFallback')} · {request.destinationSnapshot.accountName || t('eWallet.withdrawals.accountNameFallback')}</Text></View><View style={[styles.badge, { backgroundColor: statusStyle.backgroundColor }]}><Text style={[styles.badgeText, { color: statusStyle.color }]}>{request.status}</Text></View></View>
              <Text style={styles.metaText}>{request.destinationSnapshot.accountNumberMasked || request.destinationSnapshot.accountNumber || t('eWallet.withdrawals.accountNumberFallback')}</Text>
              <Text style={styles.metaDate}>{t('eWallet.withdrawals.requestedLabel', { date: formatDate(request.createdAt, t) })}{request.reviewedAt ? ` · ${t('eWallet.withdrawals.reviewedLabel', { date: formatDate(request.reviewedAt, t) })}` : ''}</Text>
              {request.reviewNotes ? <Text style={styles.reviewNotes}>{request.reviewNotes}</Text> : null}
              {request.status === 'requested' ? <TouchableOpacity style={styles.secondaryButton} onPress={() => void handleCancelPayout(request._id)} disabled={cancellingPayoutId === request._id} accessibilityRole="button" accessibilityState={{ busy: cancellingPayoutId === request._id, disabled: cancellingPayoutId === request._id }}>{cancellingPayoutId === request._id ? <ActivityIndicator color={tokens.colors.danger} size="small" /> : <Text style={styles.secondaryButtonText}>{t('eWallet.withdrawals.cancelButton')}</Text>}</TouchableOpacity> : null}
            </View>;
          })}</View>}
        </WalletSection>
        </>}
      </ScrollView>

      <Navigation activeTab={activeTab} onTabPress={onTabPress} messageBadgeCount={messageBadgeCount} />
      <WorkerQrRequestModal visible={isQrVisible} initialRequestId={selectedInvoiceId} onClose={() => { setIsQrVisible(false); setSelectedInvoiceId(null); }} onSettled={() => void refreshWalletData(false)} />
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
    paddingBottom: tokens.layout.tabBarClearance,
    gap: 14,
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
  invoiceActions: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  invoiceAction: { minHeight: 44, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: tokens.colors.border, alignItems: 'center', justifyContent: 'center' },
  invoiceActionText: { color: tokens.colors.brand, fontSize: 11, fontWeight: '800' },
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
