import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '../../lib/storage';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '../../components/AppHeader';
import ScrollView from '../../components/ui/SmoothScrollView';
import ConfirmModal from '../../components/ConfirmModal';
import { API_URL } from '../../config';
import { apiRequest, asList, asObject } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { tokens } from '../../theme/tokens';
import { EmployerAccordion, EmployerModeBanner } from '../../components/employer/EmployerUI';

type PaymentMethod = {
  id: string;
  cardholderName: string;
  brand: 'Visa' | 'Mastercard' | 'Card';
  last4: string;
  expiry: string;
  status: 'default' | 'active' | 'expired';
};

const digitsOnly = (value: string) => value.replace(/\D/g, '');

const isValidCardNumber = (value: string) => {
  const digits = digitsOnly(value);
  if (digits.length < 12 || digits.length > 19) return false;
  let sum = 0;
  let doubleDigit = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
};

const parseExpiry = (value: string) => {
  const match = value.trim().match(/^(0?[1-9]|1[0-2])\s*\/\s*(\d{2}|\d{4})$/);
  if (!match) return null;
  const expiryMonth = Number(match[1]);
  const expiryYear = match[2].length === 2 ? 2000 + Number(match[2]) : Number(match[2]);
  const now = new Date();
  const expired =
    expiryYear < now.getFullYear() ||
    (expiryYear === now.getFullYear() && expiryMonth < now.getMonth() + 1);
  return expired ? null : { expiryMonth, expiryYear };
};

const getBrand = (number: string): PaymentMethod['brand'] => {
  if (number.startsWith('4')) return 'Visa';
  if (number.startsWith('5')) return 'Mastercard';
  return 'Card';
};

export default function EmployerPaymentMethods({ onBack }: { onBack?: () => void }) {
  const toast = useToast();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<PaymentMethod | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', number: '', expiry: '', cvv: '' });

  const authHeaders = async () => {
    const token = await AsyncStorage.getItem('auth_token');
    if (!token) throw new Error('Not authenticated. Please sign in again.');
    return { Authorization: `Bearer ${token}` };
  };

  const loadMethods = useCallback(async () => {
    setIsLoading(true);
    try {
      const headers = await authHeaders();
      const result = await apiRequest(
        `${API_URL}/payment/methods`,
        { headers },
        'Failed to load payment methods.'
      );
      if (!result.ok) throw new Error(result.message);
      const payload = asObject<any>(result.data) || {};
      setMethods(asList<PaymentMethod>(payload, ['paymentMethods']));
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load payment methods.');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadMethods();
  }, [loadMethods]);

  const handleAdd = async () => {
    if (!form.name || !form.number || !form.expiry || !form.cvv) {
      toast.error('Complete all card fields.');
      return;
    }
    const number = digitsOnly(form.number);
    if (!isValidCardNumber(number)) {
      toast.error('Enter a valid card number.');
      return;
    }
    const expiry = parseExpiry(form.expiry);
    if (!expiry) {
      toast.error('Enter a future expiry date in MM/YY format.');
      return;
    }
    if (!/^\d{3,4}$/.test(form.cvv)) {
      toast.error('Enter a valid CVV.');
      return;
    }

    setIsSaving(true);
    try {
      const headers = await authHeaders();
      const result = await apiRequest(
        `${API_URL}/payment/methods`,
        {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cardholderName: form.name.trim(),
            brand: getBrand(number),
            last4: number.slice(-4),
            ...expiry,
          }),
        },
        'Failed to add payment method.'
      );
      if (!result.ok) throw new Error(result.message);
      const payload = asObject<any>(result.raw) || {};
      const added = payload.paymentMethod as PaymentMethod | undefined;
      if (added) setMethods((current) => [added, ...current]);
      else await loadMethods();
      setForm({ name: '', number: '', expiry: '', cvv: '' });
      setIsFormOpen(false);
      toast.success('Payment method added.');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to add payment method.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    setActionId(id);
    try {
      const headers = await authHeaders();
      const result = await apiRequest(
        `${API_URL}/payment/methods/${id}/default`,
        { method: 'PATCH', headers },
        'Failed to update the default payment method.'
      );
      if (!result.ok) throw new Error(result.message);
      const payload = asObject<any>(result.data) || {};
      setMethods(asList<PaymentMethod>(payload, ['paymentMethods']));
      toast.success('Default payment method updated.');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update the default payment method.');
    } finally {
      setActionId(null);
    }
  };

  const removeMethod = async (id: string) => {
    setActionId(id);
    try {
      const headers = await authHeaders();
      const result = await apiRequest(
        `${API_URL}/payment/methods/${id}`,
        { method: 'DELETE', headers },
        'Failed to remove payment method.'
      );
      if (!result.ok) throw new Error(result.message);
      const payload = asObject<any>(result.data) || {};
      setMethods(asList<PaymentMethod>(payload, ['paymentMethods']));
      toast.success('Payment method removed.');
      setRemoveTarget(null);
    } catch (error: any) {
      const message = error?.message || 'Failed to remove payment method.';
      setRemoveError(message);
      toast.error(message);
    } finally {
      setActionId(null);
    }
  };

  const confirmRemove = (method: PaymentMethod) => {
    setRemoveError(null);
    setRemoveTarget(method);
  };

  return (
    <View style={styles.container}>
      <ConfirmModal
        visible={Boolean(removeTarget)}
        title="Remove payment method?"
        description={`${removeTarget?.brand || 'Card'} ending in ${removeTarget?.last4 || '••••'} will be removed from your employer account.`}
        confirmLabel="Remove"
        destructive
        pending={Boolean(removeTarget && actionId === removeTarget.id)}
        error={removeError}
        onCancel={() => { if (!actionId) { setRemoveTarget(null); setRemoveError(null); } }}
        onConfirm={() => { if (removeTarget && !actionId) void removeMethod(removeTarget.id); }}
      />
      <AppHeader title="Payment Methods" subtitle="Employer billing methods" onBack={onBack} showBrandBadge employerMode />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <EmployerModeBanner title="Employer billing" detail="Manage the payment methods used to securely fund local jobs." />
        <View style={styles.introCard}>
          <View style={styles.introIcon}>
            <Ionicons name="card-outline" size={25} color={tokens.colors.brand} />
          </View>
          <View style={styles.introCopy}>
            <Text style={styles.title}>Saved cards</Text>
            <Text style={styles.subtitle}>New accounts stay empty until you add a payment method.</Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={() => setIsFormOpen((value) => !value)} accessibilityRole="button" accessibilityLabel={isFormOpen ? "Cancel adding payment method" : "Add payment method"}>
            <Text style={styles.addButtonText}>{isFormOpen ? 'Cancel' : 'Add'}</Text>
          </TouchableOpacity>
        </View>

        <EmployerAccordion title="Add payment method" subtitle="Card details are validated before safe metadata is stored." icon="card-outline" expanded={isFormOpen} onToggle={() => setIsFormOpen((value) => !value)}>
          <View>
            <Text style={styles.cardTitle}>Add a card</Text>
            <Text style={styles.helper}>
              Only the brand, last four digits, cardholder name, and expiry are sent and saved.
            </Text>
            <Text style={styles.inputLabel}>Name on card</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(name: string) => setForm({ ...form, name })}
              placeholder="Name on card"
              autoCapitalize="words"
              accessibilityLabel="Name on card"
              autoComplete="cc-name"
            />
            <Text style={styles.inputLabel}>Card number</Text>
            <TextInput
              style={styles.input}
              value={form.number}
              onChangeText={(value: string) => {
                const digits = digitsOnly(value).slice(0, 19);
                setForm({ ...form, number: digits.match(/.{1,4}/g)?.join(' ') || '' });
              }}
              placeholder="Card number"
              keyboardType="number-pad"
              maxLength={23}
              accessibilityLabel="Card number"
              autoComplete="cc-number"
            />
            <View style={styles.inputRow}>
              <View style={styles.halfInput}><Text style={styles.inputLabel}>Expiry</Text><TextInput style={styles.input} value={form.expiry} onChangeText={(expiry: string) => setForm({ ...form, expiry })} placeholder="MM/YY" keyboardType="number-pad" maxLength={7} accessibilityLabel="Card expiry date" autoComplete="cc-exp" /></View>
              <View style={styles.halfInput}><Text style={styles.inputLabel}>Security code</Text><TextInput style={styles.input} value={form.cvv} onChangeText={(cvv: string) => setForm({ ...form, cvv: digitsOnly(cvv).slice(0, 4) })} placeholder="CVV" keyboardType="number-pad" secureTextEntry maxLength={4} accessibilityLabel="Card security code" autoComplete="cc-csc" /></View>
            </View>
            <TouchableOpacity
              style={[styles.primaryButton, isSaving && styles.disabled]}
              onPress={handleAdd}
              disabled={isSaving}
              accessibilityRole="button"
              accessibilityState={{ disabled: isSaving, busy: isSaving }}
            >
              <Text style={styles.primaryButtonText}>{isSaving ? 'Saving...' : 'Save card'}</Text>
            </TouchableOpacity>
          </View>
        </EmployerAccordion>

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={tokens.colors.brand} />
          </View>
        ) : methods.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="card-outline" size={34} color={tokens.colors.textSubtle} />
            <Text style={styles.emptyTitle}>No payment methods yet</Text>
            <Text style={styles.emptyText}>A card appears here only after you add it.</Text>
          </View>
        ) : (
          methods.map((method) => (
            <View key={method.id} style={styles.methodCard}>
              <View style={styles.brandBox}>
                <Text style={styles.brandText}>{method.brand}</Text>
              </View>
              <View style={styles.methodCopy}>
                <Text style={styles.methodTitle}>{method.brand} ending in {method.last4}</Text>
                <Text style={styles.methodMeta}>{method.cardholderName} · Expires {method.expiry}</Text>
                {method.status === 'default' ? <Text style={styles.defaultLabel}>DEFAULT</Text> : null}
                {method.status === 'expired' ? <Text style={styles.expiredLabel}>EXPIRED</Text> : null}
              </View>
              <View style={styles.methodActions}>
                {method.status === 'active' ? (
                  <TouchableOpacity
                    style={styles.methodActionButton}
                    onPress={() => void handleSetDefault(method.id)}
                    disabled={actionId === method.id}
                  >
                    <Text style={styles.actionText}>Set default</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={styles.methodActionButton} onPress={() => confirmRemove(method)} disabled={actionId === method.id} accessibilityRole="button" accessibilityLabel={`Remove ${method.brand} ending in ${method.last4}`}>
                  <Ionicons name="trash-outline" size={21} color={tokens.colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },
  scroll: { padding: 16, paddingBottom: tokens.layout.tabBarClearance, gap: 12 },
  introCard: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...tokens.shadow.card,
  },
  introIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: tokens.colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introCopy: { flex: 1, gap: 3 },
  title: { fontSize: 17, fontWeight: '800', color: tokens.colors.brandDark },
  subtitle: { fontSize: 12, lineHeight: 17, color: tokens.colors.textMuted },
  addButton: { minHeight: 44, borderRadius: 12, backgroundColor: tokens.colors.brand, paddingHorizontal: 15, paddingVertical: 10, justifyContent: 'center' },
  addButtonText: { color: tokens.colors.surface, fontSize: 13, fontWeight: '800' },
  card: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    gap: 12,
  },
  cardTitle: { fontSize: 17, fontWeight: '800', color: tokens.colors.brandDark },
  helper: { fontSize: 12, lineHeight: 18, color: tokens.colors.textMuted },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 15,
    color: tokens.colors.text,
    backgroundColor: tokens.colors.surface,
  },
  inputRow: { flexDirection: 'row', gap: 10 },
  halfInput: { flex: 1 },
  inputLabel: { marginBottom: 6, color: tokens.colors.textMuted, fontSize: 13, fontWeight: '600' },
  primaryButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: tokens.colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: tokens.colors.surface, fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.55 },
  loading: { paddingVertical: 36, alignItems: 'center' },
  emptyCard: {
    minHeight: 190,
    borderRadius: 22,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.contentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 7,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: tokens.colors.brandDark },
  emptyText: { fontSize: 13, color: tokens.colors.textMuted, textAlign: 'center' },
  methodCard: {
    borderRadius: 20,
    padding: 14,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandBox: {
    width: 54,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: { fontSize: 11, fontWeight: '800', color: tokens.colors.onCanvasMuted },
  methodCopy: { flex: 1, gap: 3 },
  methodTitle: { fontSize: 14, fontWeight: '800', color: tokens.colors.brandDark },
  methodMeta: { fontSize: 11, color: tokens.colors.textMuted },
  defaultLabel: { marginTop: 3, fontSize: 10, fontWeight: '900', color: '#166534' },
  expiredLabel: { marginTop: 3, fontSize: 10, fontWeight: '900', color: '#B91C1C' },
  methodActions: { alignItems: 'flex-end', gap: 4 },
  methodActionButton: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  actionText: { fontSize: 12, fontWeight: '800', color: tokens.colors.brand },
});
