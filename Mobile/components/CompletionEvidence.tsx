import React, { useState } from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '../lib/storage';
import { API_URL } from '../config';
import { tokens } from '../theme/tokens';
import PrivateEvidenceImage from './PrivateEvidenceImage';
import { formatDateTime } from '../lib/formatters';

export default function CompletionEvidence({ items }: { items?: any[] }) {
  const { t } = useTranslation('common');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  if (!items?.length) return null;
  const download = async (item: any) => {
    if (busy) return;
    setBusy(true); setMessage('');
    let cached: string | undefined;
    try {
      if (!/^\/uploads\/[a-zA-Z0-9._-]+$/.test(item.fileUrl)) throw new Error(t('lifecycle.submissionFailed'));
      const token = await AsyncStorage.getItem('auth_token');
      const url = new URL(item.fileUrl, API_URL).toString();
      if (Platform.OS !== 'android') throw new Error(t('lifecycle.downloadOnAndroid'));
      const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!permission.granted) return;
      cached = `${FileSystem.cacheDirectory}${item.fileUrl.split('/').pop()}`;
      const result = await FileSystem.downloadAsync(url, cached, { headers: { Authorization: `Bearer ${token}` } });
      if (result.status !== 200) throw new Error(t('lifecycle.downloadFailed'));
      const file = await FileSystem.StorageAccessFramework.createFileAsync(permission.directoryUri, item.fileName || 'completion-evidence', result.headers['Content-Type'] || result.headers['content-type'] || 'application/octet-stream');
      const bytes = await FileSystem.readAsStringAsync(cached, { encoding: FileSystem.EncodingType.Base64 });
      await FileSystem.writeAsStringAsync(file, bytes, { encoding: FileSystem.EncodingType.Base64 });
      setMessage(t('lifecycle.evidenceSaved'));
    } catch (caught: any) { setMessage(caught.message); }
    finally { if (cached) await FileSystem.deleteAsync(cached, { idempotent: true }).catch(() => {}); setBusy(false); }
  };
  return <View><Text style={{ color: tokens.colors.text, fontWeight: '700' }}>{t('lifecycle.completionEvidence')}</Text>{items.map((item, index) => <View key={item._id || index}>
    <Text style={{ color: tokens.colors.text }}>{item.statement}</Text>
    {item.fileUrl && item.contentType?.startsWith('image/') && <PrivateEvidenceImage fileUrl={item.fileUrl} fileName={item.fileName || t('lifecycle.completionEvidence')} />}
    {item.fileUrl && <TouchableOpacity accessibilityRole="button" disabled={busy} style={{ padding: 12, minHeight: 44 }} onPress={() => void download(item)}><Text style={{ color: tokens.colors.text }}>{t('lifecycle.saveEvidence')}: {item.fileName}</Text></TouchableOpacity>}
    {(item.submittedAt || item.uploadedAt || item.at) && <Text style={{ color: tokens.colors.text }}>{formatDateTime(item.submittedAt || item.uploadedAt || item.at)}</Text>}
  </View>)}{message ? <Text accessibilityRole="alert" style={{ color: tokens.colors.text }}>{message}</Text> : null}</View>;
}
