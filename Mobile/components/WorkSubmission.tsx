import React, { useRef, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useTranslation } from 'react-i18next';
import { File } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';
import AsyncStorage from '../lib/storage';
import { API_URL } from '../config';
import { tokens } from '../theme/tokens';
import ScrollView from './ui/SmoothScrollView';
import { walletRequest } from '../lib/lifecycleApi';
import { getManilaDate } from '../lib/jobCompensation';

const isSupportedProofImage = (file: DocumentPicker.DocumentPickerAsset) => ['image/jpeg', 'image/png'].includes(file.mimeType || '') && /\.(jpe?g|png)$/i.test(file.name);

export default function WorkSubmission({ applicationId, onChanged, resubmission = false }: { applicationId: string; onChanged: () => void; resubmission?: boolean }) {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [statement, setStatement] = useState('');
  const [files, setFiles] = useState<DocumentPicker.DocumentPickerAsset[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [daily, setDaily] = useState(false);
  const [dates, setDates] = useState<string[]>([]);
  const [workDate, setWorkDate] = useState('');
  const lock = useRef(false);
  const submit = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const invalid = files.find((file) => !isSupportedProofImage(file));
      if (invalid) throw new Error(t('lifecycle.proofInvalidImageType', { name: invalid.name }));
      if (!files.length || files.length > 5) throw new Error(t('lifecycle.completionImagesHint'));
      if (files.length) {
        if (files.some((file) => (file.size ?? new File(file.uri).size) > 5 * 1024 * 1024)) throw new Error(t('lifecycle.evidenceTooLarge'));
        const token = await AsyncStorage.getItem('auth_token');
        if (!token) throw new Error(t('lifecycle.signInRequired'));
        const body = new FormData();
        body.append('statement', statement.trim());
        if (daily) body.append('workDate', workDate);
        for (const file of files) body.append('evidence', new File(file.uri), file.name);
        const result = await expoFetch(`${API_URL}/applications/${applicationId}/work/submit`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'x-microjobs-client': 'native' }, body, signal: AbortSignal.timeout(120000) });
        if (!result.ok) { const payload = await result.json().catch(() => ({})); throw new Error(payload.message || t('lifecycle.submissionFailed')); }
      }
      setOpen(false); setStatement(''); setFiles([]); onChanged();
    } catch (caught: any) { setError(caught.message); }
    finally { lock.current = false; setBusy(false); }
  };
  return <>
    <TouchableOpacity accessibilityRole="button" disabled={busy} style={[styles.button, styles.proofButton, styles.trigger]} onPress={async () => {
      setError(''); setBusy(true); setReady(false); setDisclaimerAccepted(false);
      try {
        const data = await walletRequest(`/applications/${applicationId}/lifecycle`);
        const available = (data.application.dailyPayments || []).filter((day: any) => !day.paidAt && day.workDate <= getManilaDate()).map((day: any) => day.workDate);
        setReady(true); setDaily(data.job.paymentMode === 'daily'); setDates(available); setWorkDate(available.includes(getManilaDate()) ? getManilaDate() : available[0] || ''); setOpen(true);
      } catch (caught: any) { setError(caught.message); setOpen(true); }
      finally { setBusy(false); }
    }}><Text style={styles.buttonText}>{t(resubmission ? 'lifecycle.resubmitWork' : 'lifecycle.submitWork')}</Text></TouchableOpacity>
    <Modal visible={open} transparent onRequestClose={() => { if (!busy) setOpen(false); }}>
      <View style={styles.overlay}><View accessibilityViewIsModal style={styles.dialog}><ScrollView>
        <Text accessibilityRole="header" style={styles.title}>{t(!disclaimerAccepted ? 'lifecycle.proofDisclaimerTitle' : resubmission ? 'lifecycle.resubmitWork' : 'lifecycle.submitWork')}</Text>
        {!disclaimerAccepted ? <>
          <View style={[styles.notice, styles.allowedNotice]}>
            <Text style={styles.noticeTitle}>{t('lifecycle.proofAllowedTypes')}</Text>
            <Text style={styles.text}>{t('lifecycle.completionImagesHint')}</Text>
          </View>
          <View style={[styles.notice, styles.blockedNotice]}>
            <Text style={styles.noticeTitle}>{t('lifecycle.proofBlockedTypes')}</Text>
            <Text style={styles.text}>{t('lifecycle.proofBlockedTypesHint')}</Text>
          </View>
          <TouchableOpacity accessibilityRole="button" style={[styles.button, styles.proofButton]} onPress={() => setDisclaimerAccepted(true)}><Text style={styles.buttonText}>{t('lifecycle.proofDisclaimerContinue')}</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" style={styles.cancelButton} onPress={() => setOpen(false)}><Text style={styles.text}>{t('lifecycle.cancelCompletion')}</Text></TouchableOpacity>
        </> : <>
        {daily && <><Text style={styles.text}>{t('lifecycle.selectWorkDate')}</Text><View style={styles.dates}>{dates.map((date) => <TouchableOpacity key={date} accessibilityRole="radio" accessibilityState={{ checked: workDate === date }} disabled={busy} style={[styles.date, workDate === date && styles.proofButton]} onPress={() => setWorkDate(date)}><Text style={workDate === date ? styles.buttonText : styles.text}>{date}</Text></TouchableOpacity>)}</View><Text style={styles.text}>{t(dates.length ? 'lifecycle.dailyProofHint' : 'lifecycle.noWorkDates')}</Text></>}
        <Text style={styles.text}>{t('lifecycle.completionStatement')}</Text>
        <TextInput accessibilityLabel={t('lifecycle.completionStatement')} style={styles.input} multiline maxLength={4000} value={statement} onChangeText={setStatement} />
        <TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.button} onPress={async () => {
          try {
            const picked = await DocumentPicker.getDocumentAsync({ type: ['image/jpeg', 'image/png'], multiple: true, copyToCacheDirectory: true });
            if (!picked.canceled) {
              const invalid = picked.assets.find((file) => !isSupportedProofImage(file));
              if (invalid) {
                setFiles([]); setError(t('lifecycle.proofInvalidImageType', { name: invalid.name }));
                return;
              }
              setFiles(picked.assets); setError('');
            }
          } catch (caught: any) { setError(caught.message); }
        }}><Text style={styles.buttonText}>{t('lifecycle.completionImages')}</Text></TouchableOpacity>
        <Text style={styles.text}>{t('lifecycle.completionImagesHint')}</Text>
        {files.map((file, index) => <Text key={`${file.uri}-${index}`} style={styles.text}>{file.name}{file.size !== undefined ? ` (${(file.size / 1024 / 1024).toFixed(2)} MB)` : ''}</Text>)}
        {files.length > 0 && <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => setFiles([])}><Text style={styles.text}>{t('lifecycle.removeFile')}</Text></TouchableOpacity>}
        {error ? <Text accessibilityRole="alert" style={[styles.text, styles.error]}>{error}</Text> : null}
        <TouchableOpacity accessibilityRole="button" disabled={busy || !ready || !files.length || (daily && !workDate)} style={[styles.button, styles.proofButton, (busy || !ready || !files.length || (daily && !workDate)) && { opacity: 0.5 }]} onPress={() => void submit()}><Text style={styles.buttonText}>{t(resubmission ? 'lifecycle.resubmitWork' : 'lifecycle.submitWork')}</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => setOpen(false)}><Text style={styles.text}>{t('wallet.back')}</Text></TouchableOpacity>
        </>}
      </ScrollView></View></View>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  notice: { padding: 12, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 10, marginVertical: 6 },
  allowedNotice: { backgroundColor: tokens.colors.successSoft },
  blockedNotice: { backgroundColor: tokens.colors.warningSoft },
  noticeTitle: { color: tokens.colors.text, fontWeight: '700' },
  error: { color: tokens.colors.profileDangerStrong, backgroundColor: tokens.colors.dangerSoft, padding: 12, borderRadius: 10 },
  cancelButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  dates: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  date: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 10 },
  button: { backgroundColor: tokens.colors.brand, padding: 12, minHeight: 44, borderRadius: 10, marginVertical: 6 },
  proofButton: { backgroundColor: tokens.colors.successStrong },
  trigger: { marginVertical: 0, flexShrink: 0 },
  buttonText: { color: tokens.colors.white, fontWeight: '700' },
  text: { color: tokens.colors.text, marginVertical: 8 },
  title: { color: tokens.colors.text, fontSize: 18, fontWeight: '700', marginVertical: 8 },
  input: { minHeight: 90, padding: 12, color: tokens.colors.text, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 10 },
  overlay: { flex: 1, justifyContent: 'center', backgroundColor: tokens.colors.brandDark, padding: 20 },
  dialog: { maxHeight: '90%', backgroundColor: tokens.colors.surface, padding: 18, borderRadius: 16 },
});
