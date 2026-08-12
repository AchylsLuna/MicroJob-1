import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Linking,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '../../lib/storage';
import EmployerNavigation from '../../components/employerNavigation';
import ScrollView from '../../components/ui/SmoothScrollView';
import CanvasBackButton from '../../components/ui/CanvasBackButton';
import { API_URL } from '../../config';
import { apiRequest, asObject } from '../../lib/api';
import { safeExternalUrl } from '../../lib/safeExternalUrl';
import { tokens } from '../../theme/tokens';
import { useToast } from '../../contexts/ToastContext';
import { WalletBalanceCard, WalletEmpty, WalletError, WalletMetrics, WalletSection, WalletSkeleton, WalletTransactionRow } from '../../components/wallet/WalletUI';
import { php } from '../../components/wallet/walletFormat';

type EmployerEWalletProps = {
  onBack?: () => void;
  activeTab?: string;
  onTabPress?: (tab: string) => void;
};

const PENDING_TOPUP_KEY = 'pending_topup_checkout_employer';

type WalletTransaction = {
  id: string;
  title: string;
  date: string;
  amount: number;
  status: 'Completed' | 'Pending' | 'Cancelled' | 'Failed';
  direction: 'credit' | 'debit' | 'neutral';
};

const getPartyId = (party: any) => String(
  typeof party === 'string' ? party : party?._id || party?.id || '',
);

export default function EmployerEWallet({
  onBack,
  activeTab = 'EWallet',
  onTabPress,
}: EmployerEWalletProps) {
  const insets = useSafeAreaInsets();
  const [topupAmount, setTopupAmount] = useState('');
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [isRefreshingWallet, setIsRefreshingWallet] = useState(true);
  const [hasLoadedWallet, setHasLoadedWallet] = useState(false);
  const [walletError, setWalletError] = useState('');
  const [isTopupExpanded, setIsTopupExpanded] = useState(false);
  const [liveBalance, setLiveBalance] = useState(0);
  const [workerBalance, setWorkerBalance] = useState(0);
  const [profileRole, setProfileRole] = useState('');
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const appStateRef = useRef(AppState.currentState);
  const refreshAfterBrowserRef = useRef(false);
  const pendingTopupRef = useRef<{ referenceNumber?: string; checkoutId?: string; provider?: string } | null>(null);
  const topupInputRef = useRef<TextInput>(null);
  const toast = useToast();

  const parsedTopupAmount = Number(String(topupAmount || '').replace(/[^0-9.]/g, ''));
  const canCreatePayment = !isCreatingPayment && Number.isFinite(parsedTopupAmount) && parsedTopupAmount >= 100;

  const formatDate = useCallback((value?: string) => {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleDateString('en-PH', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });
  }, []);

  const mapTxToUi = useCallback((tx: any, userId: string): WalletTransaction => {
    const type = String(tx?.type || '').toUpperCase();
    const defaultTitle = type ? type.replace(/_/g, ' ') : 'Transaction';
    const rawStatus = String(tx?.status || 'PENDING').toUpperCase();
    const status: WalletTransaction['status'] = rawStatus === 'COMPLETED'
      ? 'Completed'
      : rawStatus === 'CANCELLED'
      ? 'Cancelled'
      : rawStatus === 'FAILED'
      ? 'Failed'
      : 'Pending';
    const direction: WalletTransaction['direction'] = status !== 'Completed'
      ? 'neutral'
      : getPartyId(tx?.receiver) === userId
      ? 'credit'
      : getPartyId(tx?.sender) === userId
      ? 'debit'
      : 'neutral';
    return {
      id: String(tx?._id || tx?.id || `${Date.now()}-${Math.random()}`),
      title: String(tx?.label || defaultTitle),
      date: formatDate(tx?.createdAt),
      amount: Number(tx?.amount || 0),
      status,
      direction,
    };
  }, [formatDate]);

  const refreshWalletData = useCallback(async () => {
    try {
      setIsRefreshingWallet(true);
      setWalletError('');
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;
      const storedUser = await AsyncStorage.getItem('auth_user');
      let walletOwnerId = '';
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          walletOwnerId = String(parsedUser?._id || parsedUser?.id || parsedUser?.userId || '');
        } catch {
          walletOwnerId = '';
        }
      }

      const [profileResult, txResult] = await Promise.all([
        apiRequest(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        }, 'Failed to load wallet profile.'),
        apiRequest(`${API_URL}/payment/transactions`, {
          headers: { Authorization: `Bearer ${token}` },
        }, 'Failed to load transactions.'),
      ]);

      const failedResult = [profileResult, txResult].find((result) => !result.ok);
      if (failedResult) setWalletError(failedResult.message || 'Some wallet details could not be refreshed.');

      if (profileResult.ok) {
        const profilePayload = asObject<any>(profileResult.data) || asObject<any>(profileResult.raw) || {};
        const nextEmployer = Number(profilePayload?.employerBalance || 0);
        const nextWorker = Number(profilePayload?.workerBalance || 0);
        const role = String(profilePayload?.role || '').toLowerCase();
        walletOwnerId = String(profilePayload?._id || profilePayload?.id || profilePayload?.userId || walletOwnerId);

        const nextBalance = Number.isFinite(nextEmployer) ? nextEmployer : 0;

        setLiveBalance(Number.isFinite(nextBalance) ? nextBalance : 0);
        setWorkerBalance(Number.isFinite(nextWorker) ? nextWorker : 0);
        setProfileRole(role);
      }

      if (txResult.ok) {
        const txPayload = asObject<any>(txResult.data) || asObject<any>(txResult.raw) || {};
        const list = Array.isArray(txPayload?.transactions) ? txPayload.transactions : [];
        setTransactions(list.map((transaction: any) => mapTxToUi(transaction, walletOwnerId)));
      }
    } catch (error: any) {
      setWalletError(error?.message || 'Check your connection and try again.');
    } finally {
      setIsRefreshingWallet(false);
      setHasLoadedWallet(true);
    }
  }, [mapTxToUi]);

  const confirmPendingTopup = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const pending = pendingTopupRef.current;
      if (!token || !pending?.referenceNumber) return false;

      const confirmResult = await apiRequest(`${API_URL}/payment/topup/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          referenceNumber: pending.referenceNumber,
          checkoutId: pending.checkoutId,
          provider: pending.provider,
        }),
      }, 'Failed to confirm top-up.');

      if (confirmResult.ok) {
        pendingTopupRef.current = null;
        await AsyncStorage.removeItem(PENDING_TOPUP_KEY);
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    (async () => {
      const storedPending = await AsyncStorage.getItem(PENDING_TOPUP_KEY);
      if (storedPending) {
        try {
          pendingTopupRef.current = JSON.parse(storedPending);
        } catch {
          pendingTopupRef.current = null;
        }
      }

      await confirmPendingTopup();
      await refreshWalletData();
    })();
  }, [confirmPendingTopup, refreshWalletData]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasBackgrounded = /inactive|background/.test(appStateRef.current);
      const isActiveNow = nextState === 'active';

      if (wasBackgrounded && isActiveNow) {
        (async () => {
          const shouldTryConfirm = refreshAfterBrowserRef.current || Boolean(pendingTopupRef.current?.referenceNumber);
          refreshAfterBrowserRef.current = false;

          if (shouldTryConfirm) {
            await confirmPendingTopup();
          }

          await refreshWalletData();
        })();
      }

      appStateRef.current = nextState;
    });

    return () => subscription.remove();
  }, [confirmPendingTopup, refreshWalletData]);

  useEffect(() => {
    if (isTopupExpanded) requestAnimationFrame(() => topupInputRef.current?.focus());
  }, [isTopupExpanded]);

  const handleTestPayment = async () => {
    if (!canCreatePayment) {
      toast.error('Enter a valid top-up amount (minimum PHP 100).');
      return;
    }

    try {
      setIsCreatingPayment(true);
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        toast.error('Please sign in first before topping up.');
        return;
      }

      const result = await apiRequest(`${API_URL}/payment/topup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: parsedTopupAmount,
          target: 'EMPLOYER',
        }),
      }, 'Failed to create top-up session.');

      const payload = asObject<any>(result.data) || asObject<any>(result.raw) || {};
      const checkoutUrl =
        payload.checkoutUrl ||
        payload.checkout_url ||
        payload.invoiceUrl ||
        payload.invoice_url ||
        payload.paymentUrl ||
        payload.url;

      const safeCheckoutUrl = safeExternalUrl(checkoutUrl, { purpose: 'payment' });
      if (!result.ok || !safeCheckoutUrl) {
        toast.error(result.message || 'No payment link was returned by the server.');
        return;
      }

      const pendingPayload = {
        referenceNumber: String(payload.referenceNumber || ''),
        checkoutId: payload.checkoutId ? String(payload.checkoutId) : undefined,
        provider: payload.provider ? String(payload.provider) : undefined,
      };
      pendingTopupRef.current = pendingPayload;
      await AsyncStorage.setItem(PENDING_TOPUP_KEY, JSON.stringify(pendingPayload));

      const supported = await Linking.canOpenURL(safeCheckoutUrl);
      if (!supported) {
        toast.error('Unable to open payment link on this device.');
        return;
      }

      await Linking.openURL(safeCheckoutUrl);
      refreshAfterBrowserRef.current = true;
      setIsTopupExpanded(false);
      toast.info('Opening payment link in your browser. Complete payment to top up your wallet.');
    } catch (error: any) {
      toast.error(error?.message || 'Unable to start top up right now.');
    } finally {
      setIsCreatingPayment(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 10) + 10 }]}>
        {onBack ? <CanvasBackButton style={styles.headerButton} onPress={onBack} /> : <View style={styles.headerButtonPlaceholder} />}
        <Text style={styles.headerTitle}>E-Wallet</Text>
        <View style={styles.headerButtonPlaceholder} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 112 + Math.max(insets.bottom, 10) }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshingWallet && hasLoadedWallet} onRefresh={() => void refreshWalletData()} tintColor={tokens.colors.brand} />}
      >
        {!hasLoadedWallet && isRefreshingWallet ? <WalletSkeleton /> : <>
        <WalletError message={walletError} onRetry={() => void refreshWalletData()} />
        <WalletBalanceCard
          label="Employer balance"
          value={php(liveBalance)}
          secondary={profileRole === 'both' ? `Worker earnings: ${php(workerBalance)} (not available for job funding)` : undefined}
          note="Use employer funds to post and fund jobs in your Philippine community."
          refreshing={isRefreshingWallet}
          onRefresh={() => void refreshWalletData()}
          actionLabel="Top Up"
          actionIcon="add-outline"
          expanded={isTopupExpanded}
          onAction={() => setIsTopupExpanded((expanded) => !expanded)}
        />
        <WalletMetrics items={[
          { label: 'Employer funds', value: php(liveBalance), icon: 'business-outline' },
          { label: 'Transactions', value: String(transactions.length), icon: 'receipt-outline' },
          { label: 'Minimum top up', value: php(100), icon: 'card-outline' },
        ]} />

        {isTopupExpanded ? <View style={styles.card}>
          <Text style={styles.cardTitle}>Top Up Wallet</Text>
          <Text style={styles.cardSubtitle}>Add employer funds through the secure payment page.</Text>

          <View style={styles.formField}>
            <Text style={styles.inputLabel}>Top Up Amount (PHP)</Text>
            <TextInput
              ref={topupInputRef}
              style={styles.input}
              value={topupAmount}
              onChangeText={setTopupAmount}
              placeholder="100"
              placeholderTextColor={tokens.colors.textSubtle}
              keyboardType="numeric"
              accessibilityLabel="Top up amount in Philippine pesos"
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, !canCreatePayment && styles.primaryButtonDisabled]}
            onPress={handleTestPayment}
            disabled={!canCreatePayment}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canCreatePayment, busy: isCreatingPayment }}
          >
            {isCreatingPayment ? (
              <ActivityIndicator color={tokens.colors.onBrand} />
            ) : (
              <Text style={styles.primaryButtonText}>Create Top Up</Text>
            )}
          </TouchableOpacity>
        </View> : null}

        <WalletSection title="Recent Transactions" subtitle="Latest employer-wallet activity.">
          {transactions.length === 0 ? (
            <WalletEmpty title="No transactions yet" body="Top-ups, job funding, and refunds will appear here." />
          ) : (
            transactions.map((txn) => <WalletTransactionRow key={txn.id} title={txn.title} amount={`${txn.direction === 'credit' ? '+' : txn.direction === 'debit' ? '-' : ''}${php(txn.amount)}`} date={txn.date} status={txn.status} direction={txn.direction} />)
          )}
        </WalletSection>
        </>}
      </ScrollView>

      <EmployerNavigation activeTab={activeTab} onTabPress={onTabPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  header: {
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: tokens.colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 0,
  },
  headerButtonPlaceholder: {
    width: 44,
    height: 44,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: tokens.colors.surface,
    letterSpacing: -0.3,
  },
  scroll: {
    paddingHorizontal: 16,
    gap: 14,
  },
  balanceCard: {
    backgroundColor: tokens.colors.brandDark,
    borderRadius: 24,
    padding: 18,
    ...tokens.shadow.card,
  },
  balanceLabel: {
    color: tokens.colors.onBrandMuted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  balanceValue: {
    marginTop: 8,
    color: tokens.colors.onBrand,
    fontSize: 34,
    fontWeight: '800',
  },
  balanceRefreshing: {
    marginTop: 6,
    color: tokens.colors.onBrandMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  balanceActionsRow: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
  },
  balanceAction: {
    minHeight: 44,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  balanceActionMuted: {
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  balanceActionText: {
    color: tokens.colors.onBrand,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  balanceActionTextMuted: {
    color: tokens.colors.onBrandMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  quickIconRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickIconCard: {
    flex: 1,
    backgroundColor: tokens.colors.contentMuted,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  quickIconLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    fontWeight: '700',
    color: tokens.colors.textMuted,
  },
  comingSoon: { fontSize: 10, color: tokens.colors.textSubtle, fontWeight: '600' },
  card: {
    backgroundColor: tokens.colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    ...tokens.shadow.card,
  },
  cardTitle: {
    color: tokens.colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  transactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fullReport: {
    color: tokens.colors.text,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  cardSubtitle: {
    marginTop: 4,
    color: tokens.colors.textMuted,
    fontSize: 12,
  },
  emptyTransactions: {
    marginTop: 18,
    marginBottom: 6,
    alignItems: 'center',
    paddingVertical: 18,
    gap: 8,
  },
  emptyTransactionsText: {
    color: tokens.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  formField: {
    marginTop: 12,
  },
  inputLabel: {
    color: tokens.colors.textMuted,
    fontSize: 12,
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    minHeight: 52,
    backgroundColor: tokens.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: tokens.colors.text,
    fontSize: 14,
  },
  methodRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  methodChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: tokens.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  methodChipActive: {
    backgroundColor: tokens.colors.brandSoft,
    borderColor: tokens.colors.brand,
  },
  methodChipText: {
    color: tokens.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  methodChipTextActive: {
    color: tokens.colors.brand,
  },
  primaryButton: {
    minHeight: 52,
    marginTop: 14,
    backgroundColor: tokens.colors.brand,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: tokens.colors.onBrand,
    fontSize: 14,
    fontWeight: '700',
  },
  transactionRow: {
    marginTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  transactionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionIconDebit: {
    backgroundColor: '#FEF2F2',
  },
  transactionIconNeutral: {
    backgroundColor: '#FFFBEB',
  },
  transactionRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  transactionLeft: {
    flex: 1,
    marginRight: 4,
  },
  transactionTitle: {
    color: tokens.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  transactionDate: {
    marginTop: 2,
    color: tokens.colors.textSubtle,
    fontSize: 12,
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    color: tokens.colors.success,
    fontSize: 14,
    fontWeight: '700',
  },
  transactionAmountDebit: {
    color: tokens.colors.danger,
  },
  transactionAmountNeutral: {
    color: tokens.colors.textMuted,
  },
  transactionStatusComplete: {
    marginTop: 2,
    color: tokens.colors.success,
    fontSize: 11,
    fontWeight: '600',
  },
  transactionStatusPending: {
    marginTop: 2,
    color: tokens.colors.warning,
    fontSize: 11,
    fontWeight: '600',
  },
  transactionStatusFailed: {
    marginTop: 2,
    color: tokens.colors.danger,
    fontSize: 11,
    fontWeight: '600',
  },
});
