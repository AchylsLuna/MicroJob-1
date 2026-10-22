import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { walletRequest } from '../../lib/lifecycleApi';
import { tokens } from '../../theme/tokens';
import ScrollView from '../ui/SmoothScrollView';
import { formatCurrency } from '../../lib/formatters';
import { formatWithdrawalAmount } from '../../lib/withdrawalAmount';
import { useFocusEffect } from '@react-navigation/native';
import { asObject } from '../../lib/api';

const institutions = ['BPI Online', 'UnionBank Online', 'BDO Online (via Brankas)', 'Landbank Online (via Brankas)', 'Metrobank Online (via Brankas)', 'MariBank', 'GCash'];

export default function WithdrawalPanel({ sourceWallet, balance, onChanged }: { sourceWallet: 'EMPLOYER' | 'WORKER'; balance: number; onChanged: () => void }) {
  const { t } = useTranslation('common');
  const [form, setForm] = useState({ amount: '', institutionName: '', accountName: '', accountNumber: '', bic: '' });
  const [institutionOpen, setInstitutionOpen] = useState(false);
  const savedAccount = useRef({ accountName: '', accountNumber: '' });
  useFocusEffect(useCallback(() => {
    let active = true;
    void walletRequest('/auth/me').then((data) => {
      if (!active) return;
      const profile = asObject<any>(data, ['user', 'profile']) || {};
      const accountName = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
      const accountNumber = profile.phoneNumber || '';
      if (accountName === savedAccount.current.accountName && accountNumber === savedAccount.current.accountNumber) return;
      savedAccount.current = { accountName, accountNumber };
      setForm((current) => ({ ...current, accountName, accountNumber }));
      setPreview(null); setStep(null); setChecked(false);
    }).catch((error) => { if (active) setError(error.message); });
    return () => { active = false; };
  }, []));
  const [requests, setRequests] = useState<any[]>([]);
  const [policy, setPolicy] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [step, setStep] = useState<'sure' | 'verify' | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  const [cancel, setCancel] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const load = useCallback(async () => { const data = await walletRequest('/payment/payout-requests'); const next = (data.payoutRequests || []).filter((item: any) => (item.sourceWallet || 'WORKER') === sourceWallet); setRequests(next); setResult((current: any) => current ? next.find((item: any) => item._id === current._id) || current : null); }, [sourceWallet]);
  useEffect(() => {
    let active = true;
    setPreview(null); setStep(null); setResult(null); setError(''); setPolicy(null);
    void walletRequest(`/payment/withdrawals/policy?sourceWallet=${sourceWallet}`).then((data) => active && setPolicy(data)).catch((e) => active && setError(e.message));
    void load().catch((e) => active && setError(e.message));
    const timer = setInterval(() => void load().catch(() => {}), 15000);
    return () => { active = false; clearInterval(timer); };
  }, [sourceWallet, load]);
  const edit = (key: keyof typeof form, value: string) => {
    const next = key === 'amount' ? formatWithdrawalAmount(value) : value;
    if (next === null) return;
    setForm((old) => ({ ...old, [key]: next })); setPreview(null); setChecked(false); setStep(null);
  };
  const run = async (action: () => Promise<void>) => { if (lock.current) return; lock.current = true; setBusy(true); setError(''); try { await action(); } catch (e: any) { setError(e.message); } finally { lock.current = false; setBusy(false); } };
  const close = () => { if (!busy) { setStep(null); setPreview(null); setChecked(false); } };
  const button = (label: string, action: () => void, disabled = false) => <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} style={[styles.button, disabled && styles.disabled]} onPress={action}><Text style={styles.buttonText}>{label}</Text></TouchableOpacity>;
  return <View style={styles.panel}>
    <Text style={styles.title}>{t('wallet.withdraw')}</Text><Text style={styles.text}>{t('wallet.available', { amount: formatCurrency(balance) })} · {t(`wallet.${sourceWallet.toLowerCase()}`)}</Text>
    {sourceWallet === 'EMPLOYER' && <Text style={styles.text}>{t('wallet.unused')}</Text>}
    {policy && <Text style={styles.text}>{t('wallet.limits', { minimum: formatCurrency(policy.minimum), maximum: policy.maximum === null ? t('wallet.noMaximum') : formatCurrency(policy.maximum) })}</Text>}
    {error ? <Text accessibilityRole="alert" style={styles.text}>{error}</Text> : null}
    <Text style={styles.text}>{t('wallet.amount')}</Text><TextInput accessibilityLabel={t('wallet.amount')} style={styles.input} keyboardType="decimal-pad" value={form.amount} onChangeText={(value) => edit('amount', value)} />
    <Text style={styles.text}>{t('wallet.institution')}</Text>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('wallet.institution')} accessibilityState={{ expanded: institutionOpen, disabled: busy }} disabled={busy} style={styles.input} onPress={() => setInstitutionOpen((current) => !current)}>
      <Text style={styles.text}>{form.institutionName || t('wallet.chooseInstitution')} {institutionOpen ? '▴' : '▾'}</Text>
    </TouchableOpacity>
    {institutionOpen && <View accessibilityRole="radiogroup">{institutions.map((name) => <TouchableOpacity key={name} accessibilityRole="radio" accessibilityState={{ checked: form.institutionName === name, disabled: busy }} disabled={busy} style={styles.option} onPress={() => { edit('institutionName', name); setInstitutionOpen(false); }}><Text style={styles.text}>{name}</Text></TouchableOpacity>)}</View>}
    {(['accountName', 'accountNumber'] as const).map((key) => <View key={key}><Text style={styles.text}>{t(`wallet.${key}`)}</Text><TextInput accessibilityLabel={t(`wallet.${key}`)} style={styles.input} value={form[key]} onChangeText={(value) => edit(key, value)} /></View>)}
    {button(t('wallet.withdraw'), () => void run(async () => { const data = await walletRequest('/payment/withdrawals/preview', { sourceWallet, amount: Number(form.amount.replace(/,/g, '')), destinationSnapshot: { ...form, methodType: form.institutionName === 'GCash' ? 'gcash' : 'bank_transfer' } }); setPreview(data); setChecked(false); setStep('sure'); }), busy)}
    {result && <Text accessibilityRole="text" accessibilityLiveRegion="polite" style={styles.text}>{t(`wallet.status.${result.status}`)} · {result.providerTransferId || result._id}</Text>}
    <Text style={styles.title}>{t('wallet.history')}</Text>{requests.map((item) => <View key={item._id} style={styles.option}><Text style={styles.text}>{formatCurrency(item.amount)} · {t(`wallet.status.${item.status}`)}</Text><Text style={styles.text}>{item.destinationSnapshot?.institutionName} · {item.destinationSnapshot?.accountNumberMasked}</Text><Text selectable style={styles.text}>{item.providerTransferId || item._id}</Text>{item.reviewReason ? <Text style={styles.text}>{item.reviewReason}</Text> : null}{item.reviewNotes ? <Text style={styles.text}>{item.reviewNotes}</Text> : null}{item.failureReason ? <Text style={styles.text}>{item.failureReason}</Text> : null}{item.status === 'requested' && item.processingMode !== 'automatic' && button(t('wallet.cancelWithdrawal'), () => setCancel(item), busy)}</View>)}
    <Modal visible={step !== null || Boolean(cancel)} transparent animationType="fade" onRequestClose={() => { if (!busy) { close(); setCancel(null); } }}>
      <View style={styles.backdrop}><View accessibilityViewIsModal style={styles.dialog}><ScrollView>
        <Text accessibilityRole="header" style={styles.title}>{t(cancel ? 'wallet.cancelWithdrawal' : step === 'sure' ? 'wallet.areYouSure' : 'wallet.verify')}</Text>
        {cancel ? <><Text style={styles.text}>{t('wallet.cancelDescription', { amount: formatCurrency(cancel.amount) })}</Text>{button(t('wallet.cancelWithdrawal'), () => void run(async () => { await walletRequest(`/payment/payout-requests/${cancel._id}/cancel`, {}); setCancel(null); await load(); onChanged(); }), busy)}</> : step === 'sure' ? <><Text style={styles.text}>{t('wallet.confirmDescription', { amount: formatCurrency(preview?.amount || 0) })}</Text>{button(t('wallet.continue'), () => setStep('verify'))}</> : preview ? <>
          <Text style={styles.text}>{t(`wallet.${sourceWallet.toLowerCase()}`)} · {formatCurrency(preview.amount)}</Text><Text style={styles.text}>{preview.destination?.institutionName} · {preview.destination?.accountName} · {preview.destination?.accountNumberMasked}</Text><Text style={styles.text}>{t('wallet.fee')}: {formatCurrency(preview.fee)}</Text><Text style={styles.text}>{t('wallet.remaining')}: {formatCurrency(preview.remainingBalance)}</Text><Text style={styles.text}>{t('wallet.detailsNotice')}</Text>{preview.reviewReason ? <Text style={styles.text}>{preview.reviewReason}</Text> : null}<View style={styles.check}><Switch accessibilityLabel={t('wallet.correct')} value={checked} onValueChange={setChecked} disabled={busy} /><Text style={styles.text}>{t('wallet.correct')}</Text></View>
          {button(busy ? t('wallet.processing') : t('wallet.confirm'), () => void run(async () => { const response = await walletRequest('/payment/withdrawals/confirm', { previewToken: preview.previewToken, detailsConfirmed: true }); setResult(response.payoutRequest); setStep(null); setPreview(null); setForm({ amount: '', institutionName: '', ...savedAccount.current, bic: '' }); await load(); onChanged(); }), busy || !checked)}
        </> : null}
        {error ? <Text accessibilityRole="alert" style={styles.text}>{error}</Text> : null}{busy && <ActivityIndicator />}{button(t('wallet.back'), () => { if (step === 'verify') { setStep('sure'); setChecked(false); } else { close(); setCancel(null); } }, busy)}
      </ScrollView></View></View>
    </Modal>
  </View>;
}
const styles = StyleSheet.create({
  panel: { backgroundColor: tokens.colors.surface, padding: 18, borderRadius: 16, gap: 12 }, title: { color: tokens.colors.text, fontSize: 19, fontWeight: '700' }, text: { color: tokens.colors.text, fontSize: 14, flexShrink: 1 }, input: { color: tokens.colors.text, borderColor: tokens.colors.border, borderWidth: 1, borderRadius: 10, padding: 12, minHeight: 48 }, button: { backgroundColor: tokens.colors.brandAccent, padding: 14, minHeight: 48, borderRadius: 10, alignItems: 'center', marginVertical: 5 }, buttonText: { color: tokens.colors.white, fontWeight: '700' }, disabled: { opacity: 0.5 }, institutions: { maxHeight: 150 }, option: { padding: 12, borderBottomWidth: 1, borderColor: tokens.colors.border, gap: 5 }, backdrop: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: tokens.colors.brandDark }, dialog: { maxHeight: '90%', backgroundColor: tokens.colors.surface, borderRadius: 16, padding: 20, gap: 15 }, check: { flexDirection: 'row', gap: 10, alignItems: 'center', marginVertical: 15 },
});
