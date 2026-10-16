import React, { useRef, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useTranslation } from 'react-i18next';
import { walletRequest } from '../lib/lifecycleApi';
import { uploadFile } from '../lib/uploadFile';
import AsyncStorage from '../lib/storage';
import { API_URL } from '../config';
import { tokens } from '../theme/tokens';
import ScrollView from './ui/SmoothScrollView';

export default function WorkSubmission({ applicationId, onChanged }: { applicationId: string; onChanged: () => void }) {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const [statement, setStatement] = useState('');
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const submit = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      if (file) {
        if ((file.size || 0) > 5 * 1024 * 1024) throw new Error(t('lifecycle.evidenceTooLarge'));
        const token = await AsyncStorage.getItem('auth_token');
        if (!token) throw new Error(t('lifecycle.signInRequired'));
        const result = await uploadFile({ url: `${API_URL}/applications/${applicationId}/work/submit`, fileUri: file.uri, fieldName: 'evidence', mimeType: file.mimeType || 'application/octet-stream', token, parameters: { statement: statement.trim() } });
        if (!result.ok) { let message = t('lifecycle.submissionFailed'); try { message = JSON.parse(result.body).message || message; } catch { /* Keep the fallback for a non-JSON response. */ } throw new Error(message); }
      } else await walletRequest(`/applications/${applicationId}/work/submit`, { statement: statement.trim() });
      setOpen(false); setStatement(''); setFile(null); onChanged();
    } catch (caught: any) { setError(caught.message); }
    finally { lock.current = false; setBusy(false); }
  };
  return <>
    <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => { setError(''); setOpen(true); }}><Text style={styles.buttonText}>{t('lifecycle.submitWork')}</Text></TouchableOpacity>
    <Modal visible={open} transparent onRequestClose={() => { if (!busy) setOpen(false); }}>
      <View style={styles.overlay}><View accessibilityViewIsModal style={styles.dialog}><ScrollView>
        <Text style={styles.text}>{t('lifecycle.completionStatement')}</Text>
        <TextInput accessibilityLabel={t('lifecycle.completionStatement')} style={styles.input} multiline maxLength={4000} value={statement} onChangeText={setStatement} />
        <TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.button} onPress={async () => { try { const picked = await DocumentPicker.getDocumentAsync({ type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], copyToCacheDirectory: true }); if (!picked.canceled) setFile(picked.assets[0]); } catch (caught: any) { setError(caught.message); } }}><Text style={styles.buttonText}>{file?.name || t('lifecycle.completionFile')}</Text></TouchableOpacity>
        {file && <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => setFile(null)}><Text style={styles.text}>{t('lifecycle.removeFile')}</Text></TouchableOpacity>}
        {error ? <Text accessibilityRole="alert" style={styles.text}>{error}</Text> : null}
        <TouchableOpacity accessibilityRole="button" disabled={busy || (!statement.trim() && !file)} style={styles.button} onPress={() => void submit()}><Text style={styles.buttonText}>{t('lifecycle.confirm')}</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => setOpen(false)}><Text style={styles.text}>{t('wallet.back')}</Text></TouchableOpacity>
      </ScrollView></View></View>
    </Modal>
  </>;
}
const styles = StyleSheet.create({ button: { backgroundColor: tokens.colors.brand, padding: 12, minHeight: 44, borderRadius: 10, marginVertical: 6 }, buttonText: { color: tokens.colors.white, fontWeight: '700' }, text: { color: tokens.colors.text, marginVertical: 8 }, input: { minHeight: 90, padding: 12, color: tokens.colors.text, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 10 }, overlay: { flex: 1, justifyContent: 'center', backgroundColor: tokens.colors.brandDark, padding: 20 }, dialog: { maxHeight: '90%', backgroundColor: tokens.colors.surface, padding: 18, borderRadius: 16 } });
