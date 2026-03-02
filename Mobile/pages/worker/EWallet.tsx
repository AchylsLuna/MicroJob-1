import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Navigation from '../../components/navigation';
import { tokens } from '../../theme/tokens';

type EWalletProps = {
  onBack?: () => void;
  onOpenNotifications?: () => void;
  activeTab?: string;
  onTabPress?: (tab: string) => void;
  notificationBadgeCount?: number;
  messageBadgeCount?: number;
};

type PaymentMethod = 'GCash' | 'Card' | 'PayMaya' | 'Bank';

const transactions = [
  {
    id: '1',
    title: 'Job Payment - Tech Solutions',
    date: 'Feb 10, 2026',
    amount: 25000,
    status: 'Completed',
  },
  {
    id: '2',
    title: 'Job Payment - Innovation Labs',
    date: 'Feb 06, 2026',
    amount: 18000,
    status: 'Completed',
  },
  {
    id: '3',
    title: 'Job Payment - Digital Ventures',
    date: 'Feb 02, 2026',
    amount: 32000,
    status: 'Pending',
  },
];

export default function EWallet({
  onBack,
  onOpenNotifications,
  activeTab = 'EWallet',
  onTabPress,
  notificationBadgeCount = 0,
  messageBadgeCount = 0,
}: EWalletProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('GCash');

  const amountValue = useMemo(() => Number(amount || 0), [amount]);
  const canCreatePayment = name.trim().length > 0 && email.trim().length > 0 && amountValue > 0;

  const handleTestPayment = () => {
    if (!canCreatePayment) {
      Alert.alert('Missing fields', 'Please complete all fields.');
      return;
    }
    Alert.alert('Payment Created', `Top up request for ${name} via ${method} has been created.`);
    setName('');
    setEmail('');
    setAmount('');
    setMethod('GCash');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={onBack}>
          <Ionicons name="chevron-back" size={20} color={tokens.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>E-Wallet</Text>
        <TouchableOpacity style={styles.headerButton} onPress={onOpenNotifications}>
          <Ionicons name="notifications-outline" size={20} color={tokens.colors.text} />
          {notificationBadgeCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{notificationBadgeCount > 99 ? '99+' : String(notificationBadgeCount)}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Live Balance</Text>
          <Text style={styles.balanceValue}>PHP 71,201</Text>
          <View style={styles.balanceActionsRow}>
            <TouchableOpacity style={styles.balanceAction}>
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
          <Text style={styles.cardSubtitle}>Use sandbox values for QA testing.</Text>

          <View style={styles.formField}>
            <Text style={styles.inputLabel}>Customer Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Juan Dela Cruz"
              placeholderTextColor={tokens.colors.textSubtle}
            />
          </View>

          <View style={styles.formField}>
            <Text style={styles.inputLabel}>Customer Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="juan@email.com"
              placeholderTextColor={tokens.colors.textSubtle}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.formField}>
            <Text style={styles.inputLabel}>Amount</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="1000"
              placeholderTextColor={tokens.colors.textSubtle}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.methodRow}>
            {(['GCash', 'Card', 'PayMaya', 'Bank'] as PaymentMethod[]).map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.methodChip, method === option && styles.methodChipActive]}
                onPress={() => setMethod(option)}
              >
                <Text style={[styles.methodChipText, method === option && styles.methodChipTextActive]}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, !canCreatePayment && styles.primaryButtonDisabled]}
            onPress={handleTestPayment}
            disabled={!canCreatePayment}
          >
            <Text style={styles.primaryButtonText}>Create Top Up</Text>
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
                <Text style={styles.transactionAmount}>+PHP {txn.amount.toLocaleString()}</Text>
                <Text style={txn.status === 'Completed' ? styles.transactionStatusComplete : styles.transactionStatusPending}>
                  {txn.status}
                </Text>
              </View>
            </View>
          ))}
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
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
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
    fontSize: 11,
    fontWeight: '700',
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
