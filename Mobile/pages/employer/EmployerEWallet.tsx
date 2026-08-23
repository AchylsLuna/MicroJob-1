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
import { useTranslation } from 'react-i18next';
import AsyncStorage from '../../lib/storage';
import EmployerNavigation from '../../components/employerNavigation';
import ScrollView from '../../components/ui/SmoothScrollView';
import AppHeader from '../../components/AppHeader';
import { API_URL } from '../../config';
import { apiRequest, asObject } from '../../lib/api';
import { safeExternalUrl } from '../../lib/safeExternalUrl';
import { tokens } from '../../theme/tokens';
import { useToast } from '../../contexts/ToastContext';
import { WalletBalanceCard, WalletEmpty, WalletError, WalletMetrics, WalletSection, WalletSkeleton, WalletTransactionRow } from '../../components/wallet/WalletUI';
import { php } from '../../components/wallet/walletFormat';
import { EmployerQrScannerModal } from '../../components/wallet/WalletQrFlow';
import { EmployerAccordion, EmployerModeBanner } from '../../components/employer/EmployerUI';

type EmployerEWalletProps = {
  onBack?: () => void;
  activeTab?: string;
  onTabPress?: (tab: string) => void;
  initialInvoiceRequestId?: string | null;
  onOpenNotifications?: () => void;
  notificationBadgeCount?: number;
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
  initialInvoiceRequestId = null,
  onOpenNotifications,
  notificationBadgeCount = 0,
}: EmployerEWalletProps) {
  const [topupAmount, setTopupAmount] = useState('');
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [isRefreshingWallet, setIsRefreshingWallet] = useState(true);
  const [hasLoadedWallet, setHasLoadedWallet] = useState(false);
  const [walletError, setWalletError] = useState('');
  const [isTopupExpanded, setIsTopupExpanded] = useState(false);
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [pendingInvoiceId, setPendingInvoiceId] = useState<string | null>(initialInvoiceRequestId);
  const [isBalanceHidden, setIsBalanceHidden] = useState(false);
  const [areTransactionsCollapsed, setAreTransactionsCollapsed] = useState(false);
  const [areInvoicesCollapsed, setAreInvoicesCollapsed] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [walletSummary, setWalletSummary] = useState({ credited: 0, spent: 0, pending: 0, transactionCount: 0 });
  const [liveBalance, setLiveBalance] = useState(0);
  const [workerBalance, setWorkerBalance] = useState(0);
  const [profileRole, setProfileRole] = useState('');
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const appStateRef = useRef(AppState.currentState);
  const refreshAfterBrowserRef = useRef(false);
  const pendingTopupRef = useRef<{ referenceNumber?: string; checkoutId?: string; provider?: string } | null>(null);
  const topupInputRef = useRef<TextInput>(null);
  const toast = useToast();
  const { t } = useTranslation('employer');

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
    const defaultTitle = type ? type.replace(/_/g, ' ') : t('employerEWallet.transactions.defaultTitle');
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
      : ['credit', 'debit', 'neutral'].includes(String(tx?.walletDirection))
      ? tx.walletDirection
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
  }, [formatDate, t]);

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

      const [profileResult, txResult, invoiceResult] = await Promise.all([
        apiRequest(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        }, t('employerEWallet.errors.profileFailed')),
        apiRequest(`${API_URL}/payment/wallet?mode=employer`, {
          headers: { Authorization: `Bearer ${token}` },
        }, t('employerEWallet.errors.transactionsFailed')),
        apiRequest(`${API_URL}/payment/qr-requests?mode=employer`, {
          headers: { Authorization: `Bearer ${token}` },
        }, t('employerEWallet.errors.requestsFailed')),
      ]);

      const failedResult = [profileResult, txResult, invoiceResult].find((result) => !result.ok);
      if (failedResult) setWalletError(failedResult.message || t('employerEWallet.errors.someUnavailable'));

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
        setLiveBalance(Number(txPayload.balance || 0));
        setWalletSummary({ credited: Number(txPayload.summary?.credited || 0), spent: Number(txPayload.summary?.spent || 0), pending: Number(txPayload.summary?.pending || 0), transactionCount: Number(txPayload.summary?.transactionCount || list.length) });
        setTransactions(list.map((transaction: any) => mapTxToUi(transaction, walletOwnerId)));
      }
      if (invoiceResult.ok) {
        const invoicePayload = asObject<any>(invoiceResult.data) || asObject<any>(invoiceResult.raw) || {};
        const requests = Array.isArray(invoicePayload.requests) ? invoicePayload.requests : [];
        setInvoices(requests.filter((item: any) => !walletOwnerId || String(item?.preview?.employer?.id || '') === walletOwnerId));
      }
    } catch (error: any) {
      setWalletError(error?.message || t('employerEWallet.errors.checkConnection'));
    } finally {
      setIsRefreshingWallet(false);
      setHasLoadedWallet(true);
    }
  }, [mapTxToUi, t]);

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
      }, t('employerEWallet.errors.confirmTopupFailed'));

      if (confirmResult.ok) {
        pendingTopupRef.current = null;
        await AsyncStorage.removeItem(PENDING_TOPUP_KEY);
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }, [t]);

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

  useEffect(() => { if (initialInvoiceRequestId) { setPendingInvoiceId(initialInvoiceRequestId); setIsScannerVisible(true); } }, [initialInvoiceRequestId]);

  const handleTestPayment = async () => {
    if (!canCreatePayment) {
      toast.error(t('employerEWallet.toast.invalidAmount'));
      return;
    }

    try {
      setIsCreatingPayment(true);
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        toast.error(t('employerEWallet.toast.signInFirst'));
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
      }, t('employerEWallet.errors.createTopupFailed'));

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
        toast.error(result.message || t('employerEWallet.toast.noPaymentLink'));
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
        toast.error(t('employerEWallet.toast.cannotOpenLink'));
        return;
      }

      await Linking.openURL(safeCheckoutUrl);
      refreshAfterBrowserRef.current = true;
      setIsTopupExpanded(false);
      toast.info(t('employerEWallet.toast.openingPaymentLink'));
    } catch (error: any) {
      toast.error(error?.message || t('employerEWallet.toast.topupStartFailed'));
    } finally {
      setIsCreatingPayment(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader
        title={t('employerEWallet.header.title')}
        subtitle={t('employerEWallet.header.subtitle')}
        onBack={onBack}
        showBrandBadge
        employerMode
        rightIconName="notifications-outline"
        onRightPress={onOpenNotifications}
        rightAccessibilityLabel={notificationBadgeCount ? t('employerEWallet.header.notificationsLabelWithCount', { count: notificationBadgeCount }) : t('employerEWallet.header.notificationsLabel')}
        rightBadgeCount={notificationBadgeCount}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: tokens.layout.tabBarClearance }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshingWallet && hasLoadedWallet} onRefresh={() => void refreshWalletData()} tintColor={tokens.colors.brand} />}
      >
        {!hasLoadedWallet && isRefreshingWallet ? <WalletSkeleton /> : <>
        <WalletError message={walletError} onRetry={() => void refreshWalletData()} />
        <EmployerModeBanner title={t('employerEWallet.banner.title')} detail={t('employerEWallet.banner.detail')} />
        <WalletBalanceCard
          label={t('employerEWallet.balanceCard.label')}
          value={php(liveBalance)}
          secondary={profileRole === 'both' ? t('employerEWallet.balanceCard.secondary', { amount: php(workerBalance) }) : undefined}
          note={t('employerEWallet.balanceCard.note')}
          refreshing={isRefreshingWallet}
          onRefresh={() => void refreshWalletData()}
          actionLabel={t('employerEWallet.balanceCard.actionLabel')}
          actionIcon="add-outline"
          expanded={isTopupExpanded}
          onAction={() => setIsTopupExpanded((expanded) => !expanded)}
          hidden={isBalanceHidden}
          onToggleHidden={() => setIsBalanceHidden((hidden) => !hidden)}
          quickActionLabel={t('employerEWallet.balanceCard.quickActionLabel')}
          quickActionIcon="scan-outline"
          onQuickAction={() => { setPendingInvoiceId(null); setIsScannerVisible(true); }}
        />
        <WalletMetrics items={[
          { label: t('employerEWallet.metrics.credited'), value: isBalanceHidden ? '•••' : php(walletSummary.credited), icon: 'arrow-down-outline' },
          { label: t('employerEWallet.metrics.spent'), value: isBalanceHidden ? '•••' : php(walletSummary.spent), icon: 'shield-checkmark-outline' },
          { label: t('employerEWallet.metrics.pending'), value: isBalanceHidden ? '•••' : php(walletSummary.pending), icon: 'time-outline' },
        ]} />

        <EmployerAccordion title={t('employerEWallet.topup.accordionTitle')} subtitle={t('employerEWallet.topup.accordionSubtitle')} icon="add-circle-outline" expanded={isTopupExpanded} onToggle={() => setIsTopupExpanded((expanded) => !expanded)}>
          <View>
          <Text style={styles.cardTitle}>{t('employerEWallet.topup.cardTitle')}</Text>
          <Text style={styles.cardSubtitle}>{t('employerEWallet.topup.cardSubtitle')}</Text>

          <View style={styles.formField}>
            <Text style={styles.inputLabel}>{t('employerEWallet.topup.inputLabel')}</Text>
            <TextInput
              ref={topupInputRef}
              style={styles.input}
              value={topupAmount}
              onChangeText={setTopupAmount}
              placeholder="100"
              placeholderTextColor={tokens.colors.textSubtle}
              keyboardType="numeric"
              accessibilityLabel={t('employerEWallet.topup.inputAccessibilityLabel')}
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
              <Text style={styles.primaryButtonText}>{t('employerEWallet.topup.submitButton')}</Text>
            )}
          </TouchableOpacity>
          </View>
        </EmployerAccordion>

        <WalletSection title={t('employerEWallet.invoices.sectionTitle')} subtitle={t('employerEWallet.invoices.sectionSubtitle')} collapsible collapsed={areInvoicesCollapsed} onToggle={() => setAreInvoicesCollapsed((collapsed) => !collapsed)}>
          {invoices.length === 0 ? <WalletEmpty icon="qr-code-outline" title={t('employerEWallet.invoices.emptyTitle')} body={t('employerEWallet.invoices.emptyBody')} /> : (
            <View style={styles.invoiceList}>{invoices.map((item) => { const preview = item?.preview || {}; const active = String(preview.status || '').toLowerCase() === 'active'; const jobTitle = preview.job?.title || t('employerEWallet.invoices.defaultJobTitle'); return (
              <View key={String(preview.requestId)} style={styles.invoiceCard}>
                <View style={styles.invoiceCopy}><Text style={styles.invoiceTitle} numberOfLines={1}>{jobTitle}</Text><Text style={styles.invoiceMeta}>{preview.requestingWorker?.name || t('employerEWallet.invoices.defaultWorkerName')} · {php(preview.totalAmount || 0)}</Text><Text style={[styles.invoiceStatus, active && styles.invoiceStatusActive]}>{String(preview.status || 'unknown').toUpperCase()}</Text></View>
                <TouchableOpacity style={[styles.reviewButton, !active && styles.reviewButtonDisabled]} disabled={!active} onPress={() => { setPendingInvoiceId(String(preview.requestId)); setIsScannerVisible(true); }} accessibilityRole="button" accessibilityLabel={t('employerEWallet.invoices.reviewAccessibilityLabel', { title: jobTitle })} accessibilityState={{ disabled: !active }}><Text style={styles.reviewButtonText}>{active ? t('employerEWallet.invoices.review') : t('employerEWallet.invoices.closed')}</Text></TouchableOpacity>
              </View>
            ); })}</View>
          )}
        </WalletSection>

        <WalletSection
          title={t('employerEWallet.transactions.sectionTitle')}
          subtitle={t('employerEWallet.transactions.subtitle', { count: walletSummary.transactionCount })}
          collapsible
          collapsed={areTransactionsCollapsed}
          onToggle={() => setAreTransactionsCollapsed((collapsed) => !collapsed)}
        >
          {transactions.length === 0 ? (
            <WalletEmpty title={t('employerEWallet.transactions.emptyTitle')} body={t('employerEWallet.transactions.emptyBody')} />
          ) : (
            transactions.map((txn) => <WalletTransactionRow key={txn.id} title={txn.title} amount={`${txn.direction === 'credit' ? '+' : txn.direction === 'debit' ? '-' : ''}${php(txn.amount)}`} date={txn.date} status={txn.status} direction={txn.direction} />)
          )}
        </WalletSection>
        </>}
      </ScrollView>

      <EmployerNavigation activeTab={activeTab} onTabPress={onTabPress} />
      <EmployerQrScannerModal visible={isScannerVisible} initialRequestId={pendingInvoiceId} onClose={() => { setIsScannerVisible(false); setPendingInvoiceId(null); }} onSettled={() => { setPendingInvoiceId(null); void refreshWalletData(); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  scroll: {
    paddingTop: tokens.spacing.md,
    paddingHorizontal: tokens.layout.gutter,
    gap: 14,
  },
  invoiceList: { gap: 9 },
  invoiceCard: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 15, padding: 12, backgroundColor: tokens.colors.surface },
  invoiceCopy: { flex: 1, minWidth: 0 }, invoiceTitle: { color: tokens.colors.brandDark, fontSize: 14, fontWeight: '900' }, invoiceMeta: { marginTop: 3, color: tokens.colors.textMuted, fontSize: 11 }, invoiceStatus: { marginTop: 5, alignSelf: 'flex-start', color: tokens.colors.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 }, invoiceStatusActive: { color: tokens.colors.success },
  reviewButton: { minHeight: 44, justifyContent: 'center', borderRadius: 12, paddingHorizontal: 14, backgroundColor: tokens.colors.brand }, reviewButtonDisabled: { backgroundColor: tokens.colors.textSubtle }, reviewButtonText: { color: tokens.colors.onBrand, fontSize: 12, fontWeight: '900' },
  cardTitle: {
    color: tokens.colors.brandDark,
    fontSize: tokens.typography.h3,
    fontWeight: '800',
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
    minHeight: 52,
    backgroundColor: tokens.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: tokens.colors.text,
    fontSize: 14,
  },
  primaryButton: {
    minHeight: 52,
    marginTop: 14,
    backgroundColor: tokens.colors.brand,
    borderRadius: tokens.radius.md,
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
});
