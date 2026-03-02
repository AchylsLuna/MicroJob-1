import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import EmployerNavigation from '../../components/employerNavigation';
import { API_URL } from '../../config';
import { apiRequest, asObject } from '../../lib/api';
import { tokens } from '../../theme/tokens';

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
  status: 'Completed' | 'Pending';
};

const fallbackTransactions: WalletTransaction[] = [
  {
    id: '1',
    title: 'Job Posted - Tech Solutions',
    date: 'Feb 10, 2026',
    amount: 25000,
    status: 'Completed',
  },
  {
    id: '2',
    title: 'Job Posted - Innovation Labs',
    date: 'Feb 06, 2026',
    amount: 18000,
    status: 'Completed',
  },
  {
    id: '3',
    title: 'Job Posted - Digital Ventures',
    date: 'Feb 02, 2026',
    amount: 32000,
    status: 'Pending',
  },
];

export default function EmployerEWallet({
  onBack,
  activeTab = 'EWallet',
  onTabPress,
}: EmployerEWalletProps) {
  const [topupAmount, setTopupAmount] = useState('');
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [isRefreshingWallet, setIsRefreshingWallet] = useState(false);
  const [liveBalance, setLiveBalance] = useState(0);
  const [employerBalance, setEmployerBalance] = useState(0);
  const [workerBalance, setWorkerBalance] = useState(0);
  const [walletTarget, setWalletTarget] = useState<'EMPLOYER' | 'WORKER' | 'BOTH'>('EMPLOYER');
  const [transactions, setTransactions] = useState<WalletTransaction[]>(fallbackTransactions);
  const appStateRef = useRef(AppState.currentState);
  const refreshAfterBrowserRef = useRef(false);
  const pendingTopupRef = useRef<{ referenceNumber?: string; checkoutId?: string; provider?: string } | null>(null);

  const parsedTopupAmount = Number(String(topupAmount || '').replace(/[^0-9.]/g, ''));
  const canCreatePayment = !isCreatingPayment && Number.isFinite(parsedTopupAmount) && parsedTopupAmount >= 100;

  const formatDate = (value?: string) => {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleDateString('en-PH', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });
  };

  const mapTxToUi = (tx: any): WalletTransaction => {
    const type = String(tx?.type || '').toUpperCase();
    const defaultTitle = type ? type.replace(/_/g, ' ') : 'Transaction';
    const isPending = type === 'ESCROW';
    return {
      id: String(tx?._id || tx?.id || `${Date.now()}-${Math.random()}`),
      title: String(tx?.label || defaultTitle),
      date: formatDate(tx?.createdAt),
      amount: Number(tx?.amount || 0),
      status: isPending ? 'Pending' : 'Completed',
    };
  };

  const refreshWalletData = useCallback(async () => {
    try {
      setIsRefreshingWallet(true);
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const [profileResult, txResult] = await Promise.all([
        apiRequest(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        }, 'Failed to load wallet profile.'),
        apiRequest(`${API_URL}/payment/transactions`, {
          headers: { Authorization: `Bearer ${token}` },
        }, 'Failed to load transactions.'),
      ]);

      if (profileResult.ok) {
        const profilePayload = asObject<any>(profileResult.data) || asObject<any>(profileResult.raw) || {};
        const nextEmployer = Number(profilePayload?.employerBalance || 0);
        const nextWorker = Number(profilePayload?.workerBalance || 0);
        const role = String(profilePayload?.role || '').toLowerCase();

        const effectiveTarget: 'EMPLOYER' | 'WORKER' | 'BOTH' =
          role === 'both' ? 'BOTH' : role === 'work' ? 'WORKER' : 'EMPLOYER';

        setEmployerBalance(Number.isFinite(nextEmployer) ? nextEmployer : 0);
        setWorkerBalance(Number.isFinite(nextWorker) ? nextWorker : 0);
        setWalletTarget(effectiveTarget);

        // For employer view, show employer balance or combined if both role
        const nextBalance = effectiveTarget === 'BOTH'
          ? (Number.isFinite(nextEmployer) ? nextEmployer : 0)
          : (Number.isFinite(nextEmployer) ? nextEmployer : 0);

        setLiveBalance(Number.isFinite(nextBalance) ? nextBalance : 0);
      }

      if (txResult.ok) {
        const txPayload = asObject<any>(txResult.data) || asObject<any>(txResult.raw) || {};
        const list = Array.isArray(txPayload?.transactions) ? txPayload.transactions : [];
        if (list.length > 0) {
          setTransactions(list.map(mapTxToUi));
        }
      }
    } catch {
      // Keep existing values when refresh fails.
    } finally {
      setIsRefreshingWallet(false);
    }
  }, []);

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

  const handleTestPayment = async () => {
    if (!canCreatePayment) {
      Alert.alert('Invalid amount', 'Enter a valid top-up amount (minimum PHP 100).');
      return;
    }

    try {
      setIsCreatingPayment(true);
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        Alert.alert('Sign in required', 'Please sign in first before topping up.');
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
          target: walletTarget,
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

      if (!result.ok || !checkoutUrl) {
        Alert.alert('Top up failed', result.message || 'No payment link was returned by the server.');
        return;
      }

      const pendingPayload = {
        referenceNumber: String(payload.referenceNumber || ''),
        checkoutId: payload.checkoutId ? String(payload.checkoutId) : undefined,
        provider: payload.provider ? String(payload.provider) : undefined,
      };
      pendingTopupRef.current = pendingPayload;
      await AsyncStorage.setItem(PENDING_TOPUP_KEY, JSON.stringify(pendingPayload));

      const supported = await Linking.canOpenURL(String(checkoutUrl));
      if (!supported) {
        Alert.alert('Open link failed', 'Unable to open payment link on this device.');
        return;
      }

      await Linking.openURL(String(checkoutUrl));
      refreshAfterBrowserRef.current = true;
      Alert.alert('Redirecting', 'Opening payment link in your browser. Complete payment to top up your wallet.');
    } catch (error: any) {
      Alert.alert('Top up failed', error?.message || 'Unable to start top up right now.');
    } finally {
      setIsCreatingPayment(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={onBack}>
          <Ionicons name="chevron-back" size={20} color={tokens.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>E-Wallet</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Employer Balance</Text>
          <Text style={styles.balanceValue}>PHP {liveBalance.toLocaleString()}</Text>
          {isRefreshingWallet ? <Text style={styles.balanceRefreshing}>Refreshing wallet…</Text> : null}
          <View style={styles.balanceActionsRow}>
            <TouchableOpacity style={styles.balanceAction} onPress={handleTestPayment} disabled={isCreatingPayment}>
              <Ionicons name="arrow-up-outline" size={14} color={tokens.colors.onBrand} />
              <Text style={styles.balanceActionText}>Top Up</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.balanceAction}>
              <Ionicons name="arrow-down-outline" size={14} color={tokens.colors.onBrand} />
              <Text style={styles.balanceActionText}>Cash Out</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.quickIconRow}>
          <TouchableOpacity style={styles.quickIconCard}>
            <Ionicons name="phone-portrait-outline" size={22} color="#2563EB" />
            <Text style={styles.quickIconLabel}>Scan</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickIconCard}>
            <Ionicons name="arrow-up-outline" size={22} color="#059669" />
            <Text style={styles.quickIconLabel}>Send</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickIconCard}>
            <Ionicons name="card-outline" size={22} color="#D97706" />
            <Text style={styles.quickIconLabel}>Bills</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickIconCard}>
            <Ionicons name="add-outline" size={22} color="#7C3AED" />
            <Text style={styles.quickIconLabel}>More</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Top Up Wallet</Text>
          <Text style={styles.cardSubtitle}>Enter amount, then continue to secure top-up page.</Text>

          <View style={styles.formField}>
            <Text style={styles.inputLabel}>Top Up Amount (PHP)</Text>
            <TextInput
              style={styles.input}
              value={topupAmount}
              onChangeText={setTopupAmount}
              placeholder="100"
              placeholderTextColor={tokens.colors.textSubtle}
              keyboardType="numeric"
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, !canCreatePayment && styles.primaryButtonDisabled]}
            onPress={handleTestPayment}
            disabled={!canCreatePayment}
          >
            {isCreatingPayment ? (
              <ActivityIndicator color={tokens.colors.onBrand} />
            ) : (
              <Text style={styles.primaryButtonText}>Create Top Up</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.transactionsHeader}>
            <Text style={styles.cardTitle}>Transactions</Text>
            <TouchableOpacity>
              <Text style={styles.fullReport}>Full Report</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.cardSubtitle}>Latest wallet activity.</Text>

          {transactions.map((txn, index) => (
            <View
              key={txn.id}
              style={[styles.transactionRow, index === transactions.length - 1 ? styles.transactionRowLast : undefined]}
            >
              <View style={styles.transactionIcon}>
                <Ionicons
                  name={txn.status === 'Completed' ? 'arrow-down-outline' : 'time-outline'}
                  size={18}
                  color={txn.status === 'Completed' ? tokens.colors.success : tokens.colors.warning}
                />
              </View>
              <View style={styles.transactionLeft}>
                <Text style={styles.transactionTitle}>{txn.title}</Text>
                <Text style={styles.transactionDate}>{txn.date}</Text>
              </View>
              <View style={styles.transactionRight}>
                <Text style={styles.transactionAmount}>±PHP {txn.amount.toLocaleString()}</Text>
                <Text style={txn.status === 'Completed' ? styles.transactionStatusComplete : styles.transactionStatusPending}>
                  {txn.status}
                </Text>
              </View>
            </View>
          ))}
        </View>
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
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: tokens.colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: tokens.colors.surface,
  },
  headerTitle: {
    fontSize: 23,
    fontWeight: '800',
    color: tokens.colors.text,
    letterSpacing: -0.3,
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
  balanceActionText: {
    color: tokens.colors.onBrand,
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
    backgroundColor: tokens.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
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
});
