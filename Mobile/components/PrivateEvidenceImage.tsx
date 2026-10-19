import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '../lib/storage';
import { API_URL } from '../config';
import { tokens } from '../theme/tokens';

/** Evidence is served by the authenticated API; never expose a public blob URL. */
export default function PrivateEvidenceImage({ fileUrl, fileName, token: suppliedToken }: { fileUrl: string; fileName: string; token?: string }) {
  const { t } = useTranslation('common');
  const [token, setToken] = useState(suppliedToken || '');
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const valid = /^\/uploads\/[a-zA-Z0-9._-]+$/.test(fileUrl);
  useEffect(() => {
    let active = true;
    setFailed(false); setLoading(true); setOpen(false); setToken(suppliedToken || '');
    if (!suppliedToken) void AsyncStorage.getItem('auth_token').then((value) => {
      if (active) { setToken(value || ''); if (!value) setFailed(true); }
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [fileUrl, suppliedToken]);
  if (!valid || failed) return <Text accessibilityRole="alert" style={styles.text}>{t('lifecycle.downloadFailed')}</Text>;
  const source = { uri: new URL(fileUrl, API_URL).toString(), headers: { Authorization: `Bearer ${token}` } };
  return <View>
    {loading && <ActivityIndicator accessibilityLabel={t('lifecycle.loadingImages')} color={tokens.colors.brand} />}
    {token && <TouchableOpacity accessibilityRole="button" accessibilityLabel={fileName} onPress={() => setOpen(true)}>
      <Image source={source} style={styles.image} resizeMode="contain" accessibilityLabel={fileName} onLoad={() => setLoading(false)} onError={() => { setFailed(true); setLoading(false); }} />
    </TouchableOpacity>}
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={styles.overlay} accessibilityViewIsModal>
        <Text style={styles.text}>{fileName}</Text>
        <Image source={source} style={styles.preview} resizeMode="contain" accessibilityLabel={fileName} />
        <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => setOpen(false)}><Text style={styles.buttonText}>{t('wallet.back')}</Text></TouchableOpacity>
      </View>
    </Modal>
  </View>;
}
const styles = StyleSheet.create({
  image: { width: '100%', height: 210, marginVertical: 8 }, preview: { width: '100%', flex: 1 },
  text: { color: tokens.colors.text, marginVertical: 8 }, overlay: { flex: 1, backgroundColor: tokens.colors.surface, padding: 24, paddingTop: 55, paddingBottom: 40 },
  button: { minHeight: 44, padding: 12, borderRadius: tokens.radius.sm, backgroundColor: tokens.colors.brand, alignItems: 'center' }, buttonText: { color: tokens.colors.white, fontWeight: '700' },
});
