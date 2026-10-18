import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { walletRequest } from '../lib/lifecycleApi';
import { tokens } from '../theme/tokens';

export default function RecruitmentControls({ job, onChanged }: { job: any; onChanged: () => void }) {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const reopening = Boolean(job.closedManually);
  const canToggle = job.status === 'In Progress' && !job.cancellationPending && !job.archivedAt && Number(job.availablePositions) > 0 && new Date(job.deadline).getTime() > Date.now();
  const label = t(reopening ? 'lifecycle.reopenRecruitment' : 'lifecycle.closeRecruitment');
  return <View>
    <Text style={styles.text}>{t(job.recruitmentOpen ? 'lifecycle.recruitmentOpen' : 'lifecycle.recruitmentClosed')} · {t('lifecycle.recruitmentSlots', { count: Number(job.availablePositions || 0) })}</Text>
    {canToggle && <TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.button} onPress={() => { setError(''); setOpen(true); }}><Text style={styles.buttonText}>{label}</Text></TouchableOpacity>}
    <Modal visible={open} transparent onRequestClose={() => { if (!busy) setOpen(false); }}>
      <View style={styles.overlay}><View style={styles.dialog} accessibilityViewIsModal>
        <Text style={styles.text}>{label}</Text><Text style={styles.text}>{t(reopening ? 'lifecycle.reopenRecruitmentNotice' : 'lifecycle.closeRecruitmentNotice')}</Text>
        {error ? <Text accessibilityRole="alert" style={styles.text}>{error}</Text> : null}
        <TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.button} onPress={async () => {
          if (busy) return;
          setBusy(true); setError('');
          try { await walletRequest(`/jobs/${job._id}/${reopening ? 'reopen' : 'status'}`, reopening ? {} : { status: 'Closed' }, 'PATCH'); setOpen(false); onChanged(); }
          catch (caught: any) { setError(caught.message); }
          finally { setBusy(false); }
        }}><Text style={styles.buttonText}>{t('lifecycle.confirm')}</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.button} onPress={() => setOpen(false)}><Text style={styles.buttonText}>{t('lifecycle.cancelCompletion')}</Text></TouchableOpacity>
      </View></View>
    </Modal>
  </View>;
}
const styles = StyleSheet.create({ text: { color: tokens.colors.text, marginVertical: 7 }, button: { padding: 12, minHeight: 44, borderRadius: tokens.radius.sm, backgroundColor: tokens.colors.brand, marginVertical: 5 }, buttonText: { color: tokens.colors.white, fontWeight: '700' }, overlay: { flex: 1, justifyContent: 'center', backgroundColor: tokens.colors.brandDark, padding: 20 }, dialog: { backgroundColor: tokens.colors.surface, padding: 18, borderRadius: tokens.radius.card } });
