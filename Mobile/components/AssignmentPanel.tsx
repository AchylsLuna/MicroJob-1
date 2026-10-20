import DailyWorkSchedule from './DailyWorkSchedule';
import * as DocumentPicker from 'expo-document-picker';
import { uploadFile } from '../lib/uploadFile';
import AsyncStorage from '../lib/storage';
import { API_URL } from '../config';
import CompletionEvidence from './CompletionEvidence';
import { ChecklistTable } from './HireChecklist';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { walletRequest } from '../lib/lifecycleApi';
import { tokens } from '../theme/tokens';
import ScrollView from './ui/SmoothScrollView';
import { formatCurrency } from '../lib/formatters';
import { useAppSession } from '../contexts/AppSessionContext';

export default function AssignmentPanel({ applicationId, employer: _employer, onChanged, defaultOpen = false, hideTrigger = false, onClose }: { applicationId: string; employer?: boolean; onChanged?: () => void; defaultOpen?: boolean; hideTrigger?: boolean; onClose?: () => void }) {
  const session = useAppSession();
  const { t } = useTranslation('common'); const [open, setOpen] = useState(defaultOpen); const [data, setData] = useState<any>(null);
  const [evidenceFile, setEvidenceFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [command, setCommand] = useState(''); const [reason, setReason] = useState(''); const [amount, setAmount] = useState('0'); const [checked, setChecked] = useState(false); const [nonpayment, setNonpayment] = useState(false);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const lock = useRef(false);
  const [paymentPreview, setPaymentPreview] = useState<any>(null);
  useEffect(() => {
    if (!defaultOpen) return;
    let active = true;
    setBusy(true);
    void walletRequest(`/applications/${applicationId}/lifecycle`).then((value) => { if (active) setData(value); }).catch((caught) => { if (active) setError(caught.message); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [applicationId, defaultOpen]);
  const close = () => { if (!busy) { setOpen(false); onClose?.(); } };
  const load = async () => setData(await walletRequest(`/applications/${applicationId}/lifecycle`));
  const run = async (fn: () => Promise<any>, changed = true) => { if (lock.current) return false; lock.current = true; setBusy(true); setError(''); try { await fn(); if (changed) { await load(); setCommand(''); setReason(''); setChecked(false); onChanged?.(); } return true; } catch (e: any) { setError(e.message); return false; } finally { setBusy(false); lock.current = false; } };
  const app = data?.application;
  const employer = Boolean(data?.job?.jobPoster && String(data.job.jobPoster) === String(session.user?.id || session.user?._id || ''));
  const pending = data?.cancellations?.find((item: any) => ['pending', 'staff_review'].includes(item.status));
  const dispute = data?.disputes?.find((item: any) => ['open', 'investigating'].includes(item.status));
  // The server enforces which participant may respond; the display uses the
  // initiator's side returned by the authenticated lifecycle API.
  const canRespond = pending?.status === 'pending' && data?.canRespondCancellation;
  const button = (label: string, action: () => void, disabled = false, tone: 'default' | 'details' | 'start' | 'cancel' = 'default') => <TouchableOpacity accessibilityRole="button" disabled={disabled || busy} accessibilityState={{ disabled: disabled || busy, busy }} onPress={action} style={[styles.button, tone === 'details' && styles.detailsButton, tone === 'start' && styles.startButton, tone === 'cancel' && styles.cancelButton, (disabled || busy) && styles.disabled]}><Text style={[styles.buttonText, tone === 'details' && styles.detailsText]}>{label}</Text></TouchableOpacity>;
  const act = async () => {
    if (command === 'start') return walletRequest(`/applications/${applicationId}/work/start`, {});
    if (command === 'pay') return walletRequest(`/applications/${applicationId}/payment/settle`, { confirmed: checked, submittedAt: paymentPreview?.submittedAt });
    if (command === 'cancel') return walletRequest(`/applications/${applicationId}/cancel`, { reason, workerPayment: Number(amount), policyAcknowledged: checked });
    if (command === 'dispute') return walletRequest(`/applications/${applicationId}/disputes`, { reason, kind: nonpayment ? 'nonpayment' : 'other' });
    if (command === 'evidence' && evidenceFile) {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) throw new Error(t('lifecycle.signInRequired'));
      if ((evidenceFile.size || 0) > 5 * 1024 * 1024) throw new Error(t('lifecycle.evidenceTooLarge'));
      const result = await uploadFile({ url: `${API_URL}/financial-disputes/${dispute._id}/evidence`, fileUri: evidenceFile.uri, fieldName: 'evidence', mimeType: evidenceFile.mimeType || 'application/octet-stream', token, parameters: { description: reason.slice(0, 1000), statement: reason, evidenceType: 'OTHER' } });
      if (!result.ok) { let message = t('lifecycle.submissionFailed'); try { message = JSON.parse(result.body).message || message; } catch { /* Keep fallback. */ } throw new Error(message); }
      setEvidenceFile(null); return;
    }
    if (command === 'evidence') return walletRequest(`/financial-disputes/${dispute._id}/evidence`, { statement: reason, noEvidence: checked });
    if (['accept', 'reject'].includes(command)) return walletRequest(`/cancellations/${pending._id}/respond`, { action: command });
  };
  return <>
    {!hideTrigger && button(t('lifecycle.details'), () => { setOpen(true); setCommand(''); void run(load, false); }, false, 'details')}
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}><View style={styles.backdrop}><View accessibilityViewIsModal style={styles.dialog}><ScrollView>
      <Text accessibilityRole="header" style={styles.title}>{data?.job?.title || t('lifecycle.details')}</Text>
      {error ? <Text accessibilityRole="alert" style={styles.text}>{error}</Text> : null}
      {app && <>
        <Text style={styles.text}>{app.status} · {t(`lifecycle.work.${app.workStatus}`, { defaultValue: app.workStatus })} · {pending || (dispute && Number(dispute.amount) > 0) ? t('lifecycle.held') : app.paymentStatus}</Text>
        <Text style={styles.text}>{t('lifecycle.agreed')}: {formatCurrency(app.agreedAmount || data.job.salary)} · {t('lifecycle.paid')}: {formatCurrency(app.paidAmount || (app.paymentStatus === 'Paid' ? app.agreedAmount : 0))}</Text><Text style={styles.text}>{(data.job.requirements || []).join(' · ')}</Text><Text style={styles.text}>{t('lifecycle.terms')}</Text>
        <View>
          <Text accessibilityRole="header" style={styles.title}>{t('lifecycle.jobDescription')}</Text>
          <Text style={styles.text}>{data.job.description || t('lifecycle.descriptionUnavailable')}</Text>
        </View>
        <View>
          <Text accessibilityRole="header" style={styles.title}>{t('hireChecklist.title')}</Text>
          <ChecklistTable items={(app.hireChecklist || []).map((item: { description: string }) => item.description)} />
        </View>
        <CompletionEvidence items={app.completionEvidence} />
        {app.dailyPayments?.length > 0 && <DailyWorkSchedule dates={app.dailyPayments.map((day: any) => day.workDate)} rate={app.agreedDailyRate} payments={app.dailyPayments} start={data.job.workStartTime} end={data.job.workEndTime} />}
        {command ? <>
          <Text style={styles.title}>{t(`lifecycle.${command}`)}</Text>
          {['cancel', 'dispute', 'evidence'].includes(command) && <TextInput style={styles.input} accessibilityLabel={t('lifecycle.reason')} placeholder={t('lifecycle.reason')} value={reason} onChangeText={setReason} multiline maxLength={command === 'evidence' ? 4000 : 2000} />}
          {command === 'evidence' && button(evidenceFile?.name || t('lifecycle.completionFile'), () => void run(async () => { const picked = await DocumentPicker.getDocumentAsync({ type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], copyToCacheDirectory: true }); if (!picked.canceled) { setEvidenceFile(picked.assets[0]); setChecked(false); } }, false))}
          {command === 'cancel' && app.workStatus !== 'Not started' && <><Text style={styles.text}>{t('lifecycle.proposed')}</Text><TextInput accessibilityLabel={t('lifecycle.proposed')} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} style={styles.input} /></>}
          {command === 'dispute' && <View style={styles.check}><Switch value={nonpayment} onValueChange={setNonpayment} disabled={!data.canFileNonpayment} accessibilityLabel={t('lifecycle.nonpayment')} /><Text style={styles.text}>{t('lifecycle.nonpayment')}</Text></View>}
          {(command === 'cancel' || command === 'pay' || (command === 'evidence' && !evidenceFile)) && <View style={styles.check}><Switch value={checked} disabled={busy} onValueChange={setChecked} accessibilityLabel={t(command === 'evidence' ? 'lifecycle.noEvidence' : command === 'pay' ? 'lifecycle.releaseNotice' : 'lifecycle.acknowledge')} /><Text style={styles.text}>{t(command === 'evidence' ? 'lifecycle.noEvidence' : command === 'pay' ? 'lifecycle.releaseNotice' : 'lifecycle.acknowledge')}</Text></View>}
          {command === 'pay' && <><Text style={styles.text}>{t('lifecycle.recipient', { name: data.recipient?.name })}</Text><Text style={styles.text}>{t('lifecycle.releaseAmount', { amount: formatCurrency(paymentPreview?.amount || 0) })}</Text></>}
          {['accept', 'reject'].includes(command) && <Text style={styles.text}>{t('lifecycle.respondNotice', { amount: formatCurrency(pending?.workerPayment || 0) })}</Text>}
          {button(t('lifecycle.confirm'), () => void run(act), ['cancel', 'pay'].includes(command) && !checked)}{button(t('wallet.back'), () => setCommand(''))}
        </> : <>
          {!employer && app.workStatus === 'Not started' && !pending && !dispute && button(t('lifecycle.start'), () => setCommand('start'), false, 'start')}
          {app.status === 'Hired' && !['Paid', 'Processing'].includes(app.paymentStatus) && !pending && !dispute && button(t('lifecycle.cancel'), () => { setChecked(false); setCommand('cancel'); }, false, 'cancel')}
          {['Hired', 'Cancelled'].includes(app.status) && app.paymentStatus !== 'Processing' && !dispute && button(t('lifecycle.dispute'), () => { setNonpayment(false); setCommand('dispute'); })}
          {canRespond && !dispute && <>{button(t('lifecycle.accept'), () => setCommand('accept'))}{button(t('lifecycle.reject'), () => setCommand('reject'))}</>}
          {dispute && button(t('lifecycle.evidence'), () => { setEvidenceFile(null); setChecked(false); setCommand('evidence'); })}
          {employer && data.job.paymentMode !== 'daily' && app.workStatus === 'Submitted' && !['Paid', 'Processing', 'Disputed'].includes(app.paymentStatus) && !pending && !dispute && button(t('lifecycle.pay'), () => {
            void run(async () => { const preview = await walletRequest(`/applications/${applicationId}/payment/preview`, {}); setPaymentPreview({ ...preview, submittedAt: app.workSubmittedAt }); }, false).then((success) => { if (success) { setChecked(false); setCommand('pay'); } });
          })}
        </>}
        {pending && <Text style={styles.text}>{t('lifecycle.cancellation')}: {pending.reason} · {pending.status} · {formatCurrency(pending.workerPayment)}</Text>}
        {dispute && <><CompletionEvidence items={(dispute.evidence || []).filter((item: any) => item.fileUrl)} /><Text style={styles.text}>{t('lifecycle.evidenceNotice')}</Text><Text style={styles.text}>{t('lifecycle.evidenceDue')}: {dispute.evidenceDueAt ? new Date(dispute.evidenceDueAt).toLocaleString() : '—'}</Text>{dispute.evidence?.map((item: any, i: number) => <Text key={i} style={styles.text}>{item.statement || item.description || item.fileName || t('lifecycle.noEvidence')}</Text>)}</>}
        <Text style={styles.title}>{t('lifecycle.history')}</Text>{data.cancellations?.map((item: any) => <Text key={item._id} style={styles.text}>{item.reason} · {item.status} · {formatCurrency(item.workerPayment)}</Text>)}
      </>}
      {button(t('wallet.back'), close)}
    </ScrollView></View></View></Modal>
  </>;
}
const styles = StyleSheet.create({
  button: { backgroundColor: tokens.colors.brand, borderRadius: 10, padding: 12, minHeight: 44, marginVertical: 5 },
  buttonText: { color: tokens.colors.white, fontWeight: '700' },
  detailsButton: { backgroundColor: tokens.colors.white, borderWidth: 1, borderColor: 'black', marginVertical: 0, flexShrink: 0 },
  detailsText: { color: 'black' },
  startButton: { backgroundColor: tokens.colors.successStrong },
  cancelButton: { backgroundColor: tokens.colors.profileDangerStrong },
  disabled: { opacity: 0.5 },
  backdrop: { flex: 1, backgroundColor: tokens.colors.brandDark, justifyContent: 'center', padding: 18 },
  dialog: { backgroundColor: tokens.colors.surface, borderRadius: 18, padding: 18, maxHeight: '90%' },
  text: { color: tokens.colors.text, marginVertical: 7, flexShrink: 1 },
  title: { color: tokens.colors.text, fontSize: 18, fontWeight: '700', marginVertical: 10 },
  input: { borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 10, padding: 12, color: tokens.colors.text, minHeight: 48 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
