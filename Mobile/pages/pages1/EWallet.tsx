import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';

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

export default function EWallet({ onBack }: { onBack?: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('GCash');

  const handleTestPayment = () => {
    if (!name.trim() || !email.trim() || !amount.trim()) {
      Alert.alert('Missing fields', 'Please complete all fields.');
      return;
    }
    Alert.alert('Xendit Test Payment', `Payment created for ${name} via ${method}`);
    setName('');
    setEmail('');
    setAmount('');
    setMethod('GCash');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>E-Wallet</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <Text style={styles.balanceValue}>₱71,201</Text>
          <View style={styles.balanceRow}>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceSmallLabel}>Income</Text>
              <Text style={styles.balanceSmallValue}>₱82,000</Text>
            </View>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceSmallLabel}>Expenses</Text>
              <Text style={styles.balanceSmallValue}>₱10,799</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Xendit Test Payment</Text>
          <Text style={styles.sectionSubtitle}>Simulate a sandbox payment for QA.</Text>
          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Customer Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Juan Dela Cruz"
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Customer Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="juan@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Amount</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="1000"
              keyboardType="numeric"
            />
          </View>
          <View style={styles.methodRow}>
            {['GCash', 'Card', 'PayMaya', 'Bank'].map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.methodChip, method === option && styles.methodChipActive]}
                onPress={() => setMethod(option)}
              >
                <Text style={[styles.methodText, method === option && styles.methodTextActive]}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.primaryButton} onPress={handleTestPayment}>
            <Text style={styles.primaryButtonText}>Create Test Payment</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Job Payment History</Text>
          <Text style={styles.sectionSubtitle}>Latest payouts from completed jobs.</Text>
          {transactions.map((txn) => (
            <View key={txn.id} style={styles.transactionRow}>
              <View>
                <Text style={styles.transactionTitle}>{txn.title}</Text>
                <Text style={styles.transactionDate}>{txn.date}</Text>
              </View>
              <View style={styles.transactionRight}>
                <Text style={styles.transactionAmount}>+₱{txn.amount.toLocaleString()}</Text>
                <Text style={txn.status === 'Completed' ? styles.statusComplete : styles.statusPending}>{txn.status}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: '#1e3a5f',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 32, color: '#fff', fontWeight: '300' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff', flex: 1, textAlign: 'center' },
  placeholder: { width: 40 },
  scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 120 },
  balanceCard: {
    backgroundColor: '#0f2954',
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
  },
  balanceLabel: { color: '#cbd5e1', fontSize: 13 },
  balanceValue: { color: '#fff', fontSize: 32, fontWeight: '700', marginTop: 6 },
  balanceRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  balanceItem: { flex: 1, backgroundColor: '#1c4d8d', borderRadius: 12, padding: 12 },
  balanceSmallLabel: { color: '#dbeafe', fontSize: 12 },
  balanceSmallValue: { color: '#fff', fontSize: 16, fontWeight: '600', marginTop: 4 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
  sectionSubtitle: { fontSize: 12, color: '#6b7280', marginBottom: 12 },
  formGroup: { marginBottom: 12 },
  inputLabel: { fontSize: 12, color: '#6b7280', marginBottom: 6 },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  methodChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
  },
  methodChipActive: { backgroundColor: '#1c4d8d' },
  methodText: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  methodTextActive: { color: '#fff' },
  primaryButton: {
    backgroundColor: '#1c4d8d',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  transactionTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  transactionDate: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  transactionRight: { alignItems: 'flex-end' },
  transactionAmount: { fontSize: 14, fontWeight: '700', color: '#10b981' },
  statusComplete: { fontSize: 11, color: '#10b981', marginTop: 4 },
  statusPending: { fontSize: 11, color: '#f59e0b', marginTop: 4 },
});
