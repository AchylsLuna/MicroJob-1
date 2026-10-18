import React, { useRef, useState } from 'react';
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { API_URL } from '../../config';
import { tokens } from '../../theme/tokens';
import { walletRequest } from '../../lib/lifecycleApi';

export default function CompletionMessageCard({ message, token, currentUserId, onChanged }: { message: any; token: string; currentUserId: string | null; onChanged: () => void }) {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const attachment = message.attachment;
  const application = attachment.application;
  const applicationId = typeof application === 'string' ? application : application?._id;
  const receiver = typeof message.receiver === 'string' ? message.receiver : message.receiver?._id;
  const paid = completed || application?.paymentStatus === 'Paid';
  const canComplete = currentUserId === receiver && application?.workStatus === 'Submitted' && application.workSubmittedAt === attachment.submittedAt && !paid;
  return <View style={styles.card}>
    <Text style={styles.title}>{attachment.jobTitle}</Text><Text style={styles.text}>{message.content}</Text>
    {(attachment.images || []).filter((image: any) => /^\/uploads\/[a-zA-Z0-9._-]+$/.test(image.fileUrl)).map((image: any) => <Image key={image.fileUrl} source={{ uri: new URL(image.fileUrl, API_URL).toString(), headers: { Authorization: `Bearer ${token}` } }} style={styles.image} resizeMode="contain" accessibilityLabel={image.fileName} />)}
    {paid ? <Text style={styles.text}>{t('lifecycle.jobCompleted')}</Text> : canComplete ? <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => { setError(''); setOpen(true); }}><Text style={styles.buttonText}>{t('lifecycle.markJobDone')}</Text></TouchableOpacity> : <Text style={styles.text}>{t('lifecycle.evidenceSent')}</Text>}
    <Modal visible={open} transparent onRequestClose={() => { if (!busy) setOpen(false); }}>
      <View style={styles.overlay}><View style={styles.dialog} accessibilityViewIsModal>
        <Text style={styles.title}>{t('lifecycle.markJobDone')}</Text><Text style={styles.text}>{t('lifecycle.completeJobConfirmation')}</Text>
        {error ? <Text accessibilityRole="alert" style={styles.text}>{error}</Text> : null}
        <TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.button} onPress={async () => {
          if (lock.current || !applicationId) return;
          lock.current = true; setBusy(true); setError('');
          try { await walletRequest(`/applications/${applicationId}/payment/settle`, { confirmed: true, submittedAt: attachment.submittedAt }); setCompleted(true); setOpen(false); onChanged(); }
          catch (caught: any) { setError(caught.message); }
          finally { lock.current = false; setBusy(false); }
        }}><Text style={styles.buttonText}>{t('lifecycle.confirm')}</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.cancel} onPress={() => setOpen(false)}><Text style={styles.text}>{t('lifecycle.cancelCompletion')}</Text></TouchableOpacity>
      </View></View>
    </Modal>
  </View>;
}
const styles = StyleSheet.create({ card: { backgroundColor: tokens.colors.surface, borderColor: tokens.colors.success, borderWidth: 1, borderRadius: tokens.radius.card, padding: 14, marginVertical: 8 }, title: { color: tokens.colors.text, fontWeight: '700', marginBottom: 8 }, text: { color: tokens.colors.text, marginVertical: 6 }, image: { width: '100%', height: 210, marginVertical: 6 }, button: { backgroundColor: tokens.colors.success, padding: 12, minHeight: 44, borderRadius: tokens.radius.sm, marginTop: 10 }, buttonText: { color: tokens.colors.text, fontWeight: '700', textAlign: 'center' }, cancel: { minHeight: 44, justifyContent: 'center', alignItems: 'center' }, overlay: { flex: 1, justifyContent: 'center', backgroundColor: tokens.colors.brandDark, padding: 20 }, dialog: { backgroundColor: tokens.colors.surface, padding: 20, borderRadius: tokens.radius.card } });
