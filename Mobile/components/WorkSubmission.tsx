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

export default function WorkSubmission({ applicationId, onChanged }: { applicationId: string; onChanged: () => void }) {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const [statement, setStatement] = useState('');
  const [files, setFiles] = useState<DocumentPicker.DocumentPickerAsset[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const submit = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      if (!files.length || files.length > 10 || files.some((file) => !['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.mimeType || ''))) throw new Error(t('lifecycle.completionImagesHint'));
      if (files.length) {
        if (files.some((file) => (file.size ?? new File(file.uri).size) > 5 * 1024 * 1024)) throw new Error(t('lifecycle.evidenceTooLarge'));
        const token = await AsyncStorage.getItem('auth_token');
        if (!token) throw new Error(t('lifecycle.signInRequired'));
        const body = new FormData();
        body.append('statement', statement.trim());
        for (const file of files) body.append('evidence', new File(file.uri), file.name);
        const result = await expoFetch(`${API_URL}/applications/${applicationId}/work/submit`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'x-microjobs-client': 'native' }, body, signal: AbortSignal.timeout(120000) });
        if (!result.ok) { const payload = await result.json().catch(() => ({})); throw new Error(payload.message || t('lifecycle.submissionFailed')); }
      }
      setOpen(false); setStatement(''); setFiles([]); onChanged();
    } catch (caught: any) { setError(caught.message); }
    finally { lock.current = false; setBusy(false); }
  };
  return <>
    <TouchableOpacity accessibilityRole="button" style={[styles.button, styles.proofButton, styles.trigger]} onPress={() => { setError(''); setOpen(true); }}><Text style={styles.buttonText}>{t('lifecycle.submitWork')}</Text></TouchableOpacity>
    <Modal visible={open} transparent onRequestClose={() => { if (!busy) setOpen(false); }}>
      <View style={styles.overlay}><View accessibilityViewIsModal style={styles.dialog}><ScrollView>
        <Text style={styles.text}>{t('lifecycle.completionStatement')}</Text>
        <TextInput accessibilityLabel={t('lifecycle.completionStatement')} style={styles.input} multiline maxLength={4000} value={statement} onChangeText={setStatement} />
        <TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.button} onPress={async () => { try { const picked = await DocumentPicker.getDocumentAsync({ type: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'], multiple: true, copyToCacheDirectory: true }); if (!picked.canceled) { setFiles(picked.assets); setError(''); } } catch (caught: any) { setError(caught.message); } }}><Text style={styles.buttonText}>{t('lifecycle.completionImages')}</Text></TouchableOpacity>
        <Text style={styles.text}>{t('lifecycle.completionImagesHint')}</Text>
        {files.map((file, index) => <Text key={`${file.uri}-${index}`} style={styles.text}>{file.name}</Text>)}
        {files.length > 0 && <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => setFiles([])}><Text style={styles.text}>{t('lifecycle.removeFile')}</Text></TouchableOpacity>}
        {error ? <Text accessibilityRole="alert" style={styles.text}>{error}</Text> : null}
        <TouchableOpacity accessibilityRole="button" disabled={busy || !files.length} style={[styles.button, styles.proofButton, (busy || !files.length) && { opacity: 0.5 }]} onPress={() => void submit()}><Text style={styles.buttonText}>{t('lifecycle.submitWork')}</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => setOpen(false)}><Text style={styles.text}>{t('wallet.back')}</Text></TouchableOpacity>
      </ScrollView></View></View>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  button: { backgroundColor: tokens.colors.brand, padding: 12, minHeight: 44, borderRadius: 10, marginVertical: 6 },
  proofButton: { backgroundColor: tokens.colors.successStrong },
  trigger: { marginVertical: 0, flexShrink: 0 },
  buttonText: { color: tokens.colors.white, fontWeight: '700' },
  text: { color: tokens.colors.text, marginVertical: 8 },
  input: { minHeight: 90, padding: 12, color: tokens.colors.text, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 10 },
  overlay: { flex: 1, justifyContent: 'center', backgroundColor: tokens.colors.brandDark, padding: 20 },
  dialog: { maxHeight: '90%', backgroundColor: tokens.colors.surface, padding: 18, borderRadius: 16 },
});
