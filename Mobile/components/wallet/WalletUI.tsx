import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';

export type WalletMetric = { label: string; value: string; icon: React.ComponentProps<typeof Ionicons>['name'] };

export function WalletBalanceCard({ label, value, note, refreshing, onRefresh, actionLabel, actionIcon = 'add-outline', expanded, onAction, secondary }: {
  label: string; value: string; note: string; refreshing: boolean; onRefresh: () => void;
  actionLabel: string; actionIcon?: React.ComponentProps<typeof Ionicons>['name']; expanded: boolean; onAction: () => void;
  secondary?: string;
}) {
  return <View style={styles.balanceCard}>
    <View style={styles.balanceHeader}>
      <View style={styles.balanceCopy}><Text style={styles.balanceLabel}>{label}</Text><Text style={styles.balanceValue} adjustsFontSizeToFit numberOfLines={1}>{value}</Text></View>
      <TouchableOpacity style={styles.refreshButton} onPress={onRefresh} disabled={refreshing} accessibilityRole="button" accessibilityLabel="Refresh wallet" accessibilityState={{ busy: refreshing, disabled: refreshing }}>
        {refreshing ? <ActivityIndicator color={tokens.colors.white} size="small" /> : <Ionicons name="refresh-outline" size={20} color={tokens.colors.white} />}
      </TouchableOpacity>
    </View>
    {secondary ? <Text style={styles.secondaryBalance}>{secondary}</Text> : null}
    <Text style={styles.balanceNote}>{note}</Text>
    <TouchableOpacity style={styles.primaryAction} onPress={onAction} accessibilityRole="button" accessibilityState={{ expanded }}>
      <Ionicons name={actionIcon} size={18} color={tokens.colors.brand} />
      <Text style={styles.primaryActionText}>{expanded ? `Hide ${actionLabel}` : actionLabel}</Text>
      <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={17} color={tokens.colors.brand} />
    </TouchableOpacity>
  </View>;
}

export function WalletMetrics({ items }: { items: WalletMetric[] }) {
  return <View style={styles.metrics}>{items.map((item) => <View key={item.label} style={styles.metric}>
    <View style={styles.metricIcon}><Ionicons name={item.icon} size={17} color={tokens.colors.brand} /></View>
    <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>{item.value}</Text>
    <Text style={styles.metricLabel} numberOfLines={2}>{item.label}</Text>
  </View>)}</View>;
}

export function WalletSection({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return <View style={styles.section}><View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{title}</Text>{subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}</View>{children}</View>;
}

export function WalletError({ message, onRetry }: { message: string; onRetry: () => void }) {
  if (!message) return null;
  return <View style={styles.error} accessibilityRole="alert"><Ionicons name="cloud-offline-outline" size={20} color={tokens.colors.danger} /><View style={styles.errorCopy}><Text style={styles.errorTitle}>Wallet could not refresh</Text><Text style={styles.errorText}>{message}</Text></View><TouchableOpacity style={styles.retry} onPress={onRetry}><Text style={styles.retryText}>Retry</Text></TouchableOpacity></View>;
}

export function WalletSkeleton() {
  return <View accessibilityLabel="Loading wallet" style={styles.skeleton}><View style={styles.skeletonBalance} /><View style={styles.skeletonMetrics}>{[0, 1, 2].map((item) => <View key={item} style={styles.skeletonMetric} />)}</View><View style={styles.skeletonSection} /></View>;
}

export function WalletEmpty({ icon = 'receipt-outline', title, body }: { icon?: React.ComponentProps<typeof Ionicons>['name']; title: string; body: string }) {
  return <View style={styles.empty}><View style={styles.emptyIcon}><Ionicons name={icon} size={26} color={tokens.colors.textMuted} /></View><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyBody}>{body}</Text></View>;
}

export function WalletTransactionRow({ title, subtitle, amount, date, status, direction = 'neutral' }: {
  title: string; subtitle?: string; amount: string; date: string; status: string; direction?: 'credit' | 'debit' | 'neutral';
}) {
  const icon = direction === 'credit' ? 'arrow-down-outline' : direction === 'debit' ? 'arrow-up-outline' : 'swap-horizontal-outline';
  const normalizedStatus = status.toLowerCase();
  const statusTone = normalizedStatus === 'completed' || normalizedStatus === 'paid'
    ? styles.statusSuccess
    : normalizedStatus === 'failed' || normalizedStatus === 'rejected'
      ? styles.statusDanger
      : normalizedStatus === 'pending' || normalizedStatus === 'requested' || normalizedStatus === 'approved'
        ? styles.statusPending
        : undefined;
  return <View style={styles.transaction}>
    <View style={[styles.transactionIcon, direction === 'credit' && styles.creditIcon, direction === 'debit' && styles.debitIcon]}><Ionicons name={icon} size={18} color={direction === 'credit' ? '#15803D' : direction === 'debit' ? '#B91C1C' : tokens.colors.brand} /></View>
    <View style={styles.transactionCopy}><Text style={styles.transactionTitle} numberOfLines={1}>{title}</Text>{subtitle ? <Text style={styles.transactionSubtitle} numberOfLines={1}>{subtitle}</Text> : null}<Text style={styles.transactionDate}>{date}</Text></View>
    <View style={styles.transactionAmountWrap}><Text style={[styles.transactionAmount, direction === 'credit' && styles.creditText, direction === 'debit' && styles.debitText]} numberOfLines={1}>{amount}</Text><View style={[styles.status, statusTone]}><Text style={styles.statusText}>{status}</Text></View></View>
  </View>;
}

const styles = StyleSheet.create({
  balanceCard: { backgroundColor: tokens.colors.brandDark, borderRadius: 24, padding: 18, ...tokens.shadow.card },
  balanceHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, balanceCopy: { flex: 1 },
  balanceLabel: { color: tokens.colors.onBrandMuted, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  balanceValue: { marginTop: 7, color: tokens.colors.white, fontSize: 34, fontWeight: '800', letterSpacing: -0.8 },
  refreshButton: { width: 44, height: 44, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  secondaryBalance: { marginTop: 8, color: '#D8E3F5', fontSize: 13, fontWeight: '700' }, balanceNote: { marginTop: 12, color: '#D8E3F5', fontSize: 12, lineHeight: 18 },
  primaryAction: { marginTop: 16, minHeight: 48, borderRadius: 15, backgroundColor: tokens.colors.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, primaryActionText: { color: tokens.colors.brand, fontSize: 14, fontWeight: '800' },
  metrics: { flexDirection: 'row', gap: 9 }, metric: { flex: 1, minHeight: 104, padding: 11, borderRadius: 17, borderWidth: 1, borderColor: tokens.colors.border, backgroundColor: tokens.colors.surface, ...tokens.shadow.card }, metricIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: tokens.colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, metricValue: { marginTop: 9, fontSize: 16, fontWeight: '800', color: tokens.colors.brandDark }, metricLabel: { marginTop: 3, fontSize: 10, lineHeight: 14, fontWeight: '700', color: tokens.colors.textMuted },
  section: { backgroundColor: tokens.colors.surface, borderRadius: 20, padding: 15, borderWidth: 1, borderColor: tokens.colors.border, ...tokens.shadow.card }, sectionHeading: { marginBottom: 12 }, sectionTitle: { fontSize: 18, fontWeight: '800', color: tokens.colors.brandDark }, sectionSubtitle: { marginTop: 4, fontSize: 12, lineHeight: 17, color: tokens.colors.textMuted },
  error: { padding: 12, borderRadius: 15, backgroundColor: tokens.colors.dangerSoft, borderWidth: 1, borderColor: '#FECACA', flexDirection: 'row', alignItems: 'center', gap: 9 }, errorCopy: { flex: 1 }, errorTitle: { fontSize: 12, fontWeight: '800', color: '#991B1B' }, errorText: { marginTop: 2, fontSize: 11, color: '#B91C1C' }, retry: { minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }, retryText: { color: '#991B1B', fontWeight: '800', fontSize: 12 },
  skeleton: { gap: 12 }, skeletonBalance: { height: 218, borderRadius: 24, backgroundColor: tokens.colors.contentMuted }, skeletonMetrics: { flexDirection: 'row', gap: 9 }, skeletonMetric: { flex: 1, height: 104, borderRadius: 17, backgroundColor: tokens.colors.contentMuted }, skeletonSection: { height: 180, borderRadius: 20, backgroundColor: tokens.colors.contentMuted },
  empty: { alignItems: 'center', paddingVertical: 22, paddingHorizontal: 12 }, emptyIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.contentMuted }, emptyTitle: { marginTop: 10, fontSize: 15, fontWeight: '800', color: tokens.colors.text }, emptyBody: { marginTop: 5, textAlign: 'center', fontSize: 12, lineHeight: 17, color: tokens.colors.textMuted },
  transaction: { minHeight: 76, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: tokens.colors.border, flexDirection: 'row', alignItems: 'center', gap: 10 }, transactionIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: tokens.colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, creditIcon: { backgroundColor: tokens.colors.successSoft }, debitIcon: { backgroundColor: tokens.colors.dangerSoft }, transactionCopy: { flex: 1, minWidth: 0 }, transactionTitle: { fontSize: 13, fontWeight: '800', color: tokens.colors.text }, transactionSubtitle: { marginTop: 2, fontSize: 11, color: tokens.colors.textMuted }, transactionDate: { marginTop: 3, fontSize: 10, color: tokens.colors.textSubtle }, transactionAmountWrap: { alignItems: 'flex-end', maxWidth: '36%' }, transactionAmount: { fontSize: 13, fontWeight: '800', color: tokens.colors.brandDark }, creditText: { color: '#15803D' }, debitText: { color: '#B91C1C' }, status: { marginTop: 5, paddingHorizontal: 7, paddingVertical: 3, borderRadius: tokens.radius.pill, backgroundColor: tokens.colors.contentMuted }, statusSuccess: { backgroundColor: tokens.colors.successSoft }, statusDanger: { backgroundColor: tokens.colors.dangerSoft }, statusPending: { backgroundColor: tokens.colors.warningSoft }, statusText: { fontSize: 9, fontWeight: '800', color: tokens.colors.textMuted, textTransform: 'uppercase' },
});
