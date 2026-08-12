import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '../../lib/storage';
import { API_URL } from '../../config';
import { apiRequest, asList, asObject } from '../../lib/api';
import { tokens } from '../../theme/tokens';
import { php } from './walletFormat';

type Preview = {
  requestId: string; status: string; expiresAt: string;
  job: { id: string; title: string; status: string };
  requestingWorker: { id: string; name: string };
  employer: { id: string; name: string };
  workers: Array<{ applicationId: string; workerId: string; name: string; amount: number }>;
  amountPerWorker: number; totalAmount: number;
};

const authHeaders = async () => {
  const token = await AsyncStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : undefined;
};
const remainingLabel = (expiresAt?: string, now = Date.now()) => {
  const seconds = Math.max(0, Math.ceil((new Date(expiresAt || 0).getTime() - now) / 1000));
  if (seconds <= 0) return 'expired';
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} remaining`;
};

export function WorkerQrRequestModal({ visible, onClose, onSettled, initialRequestId }: { visible: boolean; onClose: () => void; onSettled: () => void; initialRequestId?: string | null }) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [request, setRequest] = useState<{ requestId: string; qrPayload?: string; imageUrl?: string; shortCode: string; expiresAt: string; preview: Preview } | null>(null);
  const [imageHeaders, setImageHeaders] = useState<Record<string, string>>({});
  const [clock, setClock] = useState(Date.now());

  const loadJobs = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await apiRequest(`${API_URL}/applications`, { headers: await authHeaders() }, 'Failed to load hired jobs.');
      if (!result.ok) throw new Error(result.message);
      const list = asList<any>(result.raw, ['applications']);
      setJobs(list.filter((item) => ['hired', 'accepted'].includes(String(item.status || '').toLowerCase()) && String(item.job?.status || '') === 'In Progress'));
    } catch (caught: any) { setError(caught?.message || 'Failed to load hired jobs.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (!visible) return; setRequest(null); if (!initialRequestId) { void loadJobs(); return; } setLoading(true); void (async () => { const result = await apiRequest(`${API_URL}/payment/qr-requests/${initialRequestId}`, { headers: await authHeaders() }, 'Failed to open invoice.'); if (!result.ok) throw new Error(result.message); setImageHeaders((await authHeaders()) || {}); setRequest((asObject<any>(result.data) || asObject<any>(result.raw)) as any); })().catch((caught) => setError(caught?.message || 'Failed to open invoice.')).finally(() => setLoading(false)); }, [initialRequestId, loadJobs, visible]);
  useEffect(() => { if (!visible || !request) return; const interval = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(interval); }, [request, visible]);

  const createRequest = async (jobId: string) => {
    setLoading(true); setError('');
    try {
      const result = await apiRequest(`${API_URL}/payment/qr-requests`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) }, body: JSON.stringify({ jobId }),
      }, 'Failed to create payment QR.');
      if (!result.ok) throw new Error(result.message);
      setImageHeaders((await authHeaders()) || {});
      setRequest((asObject<any>(result.data) || asObject<any>(result.raw)) as any);
    } catch (caught: any) { setError(caught?.message || 'Failed to create payment QR.'); }
    finally { setLoading(false); }
  };

  const cancel = async () => {
    if (request) await apiRequest(`${API_URL}/payment/qr-requests/${request.requestId}/cancel`, { method: 'POST', headers: await authHeaders() }, 'Failed to cancel request.');
    setRequest(null); onSettled(); onClose();
  };

  return <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet"><SafeAreaView style={styles.screen}>
    <Header title="Request Job Payment" onClose={onClose} />
    <ScrollView contentContainerStyle={styles.content}>
      {error ? <ErrorMessage text={error} onRetry={loadJobs} /> : null}
      {loading ? <ActivityIndicator color={tokens.colors.brand} /> : null}
      {request ? <View style={styles.qrCard}>
        <View style={styles.qrFrame}>{request.imageUrl ? <Image source={{ uri: `${API_URL.replace(/\/api$/, '')}${request.imageUrl}`, headers: imageHeaders }} style={styles.qrImage} resizeMode="contain" accessibilityLabel="Secure MicroJobs payment QR" /> : request.qrPayload ? <QRCode value={request.qrPayload} size={210} color={tokens.colors.brandDark} backgroundColor="#FFFFFF" /> : null}</View>
        <Text style={styles.title}>{request.preview.job.title}</Text>
        <Text style={styles.amount}>{php(request.preview.totalAmount)}</Text>
        <Text style={styles.muted}>{request.preview.workers.length} hired worker{request.preview.workers.length === 1 ? '' : 's'} · {remainingLabel(request.expiresAt, clock)}</Text>
        <Text style={styles.codeLabel}>MANUAL CODE</Text><Text selectable style={styles.code}>{request.shortCode}</Text>
        <Text style={styles.security}>The employer must review and confirm. This QR never contains your balance or personal account details.</Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => void cancel()} accessibilityRole="button"><Text style={styles.secondaryText}>Cancel Request</Text></TouchableOpacity>
      </View> : <>
        <Text style={styles.intro}>Choose finished work that is still marked In Progress. Payment uses the job’s secured escrow amount.</Text>
        {!loading && jobs.length === 0 ? <View style={styles.empty}><Ionicons name="briefcase-outline" size={32} color={tokens.colors.textMuted} /><Text style={styles.title}>No jobs ready for QR payment</Text><Text style={styles.muted}>A job appears here after the employer hires you and work begins.</Text></View> : jobs.map((application) => <TouchableOpacity key={String(application._id)} style={styles.jobRow} onPress={() => void createRequest(String(application.job?._id || application.job))} accessibilityRole="button">
          <View style={styles.jobIcon}><Ionicons name="briefcase-outline" size={20} color={tokens.colors.brand} /></View><View style={styles.grow}><Text style={styles.jobTitle}>{application.job?.title || 'Local job'}</Text><Text style={styles.muted}>{php(application.job?.salary)} secured pay</Text></View><Ionicons name="qr-code-outline" size={24} color={tokens.colors.brand} />
        </TouchableOpacity>)}
      </>}
    </ScrollView>
  </SafeAreaView></Modal>;
}

export function EmployerQrScannerModal({ visible, onClose, onSettled, initialRequestId }: { visible: boolean; onClose: () => void; onSettled: () => void; initialRequestId?: string | null }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [manualCode, setManualCode] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [torch, setTorch] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (visible) { setPreview(null); setScanned(false); setError(''); setManualCode(''); if (initialRequestId) { setBusy(true); void (async () => { const result = await apiRequest(`${API_URL}/payment/qr-requests/${initialRequestId}`, { headers: await authHeaders() }, 'Unable to open payment invoice.'); if (!result.ok) throw new Error(result.message); const payload = asObject<any>(result.data) || asObject<any>(result.raw) || {}; setPreview(payload.preview); })().catch((caught) => setError(caught?.message || 'Unable to open payment invoice.')).finally(() => setBusy(false)); } } }, [initialRequestId, visible]);

  const resolve = async (value: string, isCode = false) => {
    if (busy || !value.trim()) return;
    setBusy(true); setScanned(true); setError('');
    try {
      const result = await apiRequest(`${API_URL}/payment/qr-requests/resolve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) }, body: JSON.stringify(isCode ? { code: value.trim().toUpperCase() } : { token: value.trim() }),
      }, 'Unable to resolve payment QR.');
      if (!result.ok) throw new Error(result.message);
      const payload = asObject<any>(result.data) || asObject<any>(result.raw) || {};
      setPreview(payload.preview);
    } catch (caught: any) { setError(caught?.message || 'Unable to resolve payment QR.'); setScanned(false); }
    finally { setBusy(false); }
  };

  const settle = async () => {
    if (!preview || busy) return;
    setBusy(true); setError('');
    try {
      const result = await apiRequest(`${API_URL}/payment/qr-requests/${preview.requestId}/settle`, { method: 'POST', headers: await authHeaders() }, 'Settlement failed.');
      if (!result.ok) throw new Error(result.message);
      onSettled(); onClose();
    } catch (caught: any) { setError(caught?.message || 'Settlement failed.'); }
    finally { setBusy(false); }
  };

  return <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen"><SafeAreaView style={styles.screen}>
    <Header title="Scan to Pay" onClose={onClose} />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {error ? <ErrorMessage text={error} onRetry={() => { setError(''); setScanned(false); setPreview(null); }} /> : null}
      {preview ? <View style={styles.previewCard}>
        <Text style={styles.eyebrow}>REVIEW JOB SETTLEMENT</Text><Text style={styles.title}>{preview.job.title}</Text><Text style={styles.amount}>{php(preview.totalAmount)}</Text>
        <Text style={styles.muted}>Requested by {preview.requestingWorker.name} · Employer {preview.employer.name}</Text>
        <View style={styles.workerList}>{preview.workers.map((worker) => <View key={worker.applicationId} style={styles.workerRow}><Text style={styles.jobTitle}>{worker.name}</Text><Text style={styles.jobTitle}>{php(worker.amount)}</Text></View>)}</View>
        <Text style={styles.security}>Confirming completes the job and releases secured escrow to every hired worker. This cannot be paid twice.</Text>
        <TouchableOpacity style={[styles.primaryButton, busy && styles.disabled]} onPress={() => void settle()} disabled={busy} accessibilityRole="button" accessibilityState={{ busy, disabled: busy }}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Confirm and Complete Job</Text>}</TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => { setPreview(null); setScanned(false); }}><Text style={styles.secondaryText}>Scan Another</Text></TouchableOpacity>
      </View> : <>
        {!permission?.granted ? <View style={styles.permission}><Ionicons name="camera-outline" size={34} color={tokens.colors.brand} /><Text style={styles.title}>Camera permission needed</Text><Text style={styles.muted}>MicroJobs uses the camera only to scan its secure job-payment QR.</Text><TouchableOpacity style={styles.primaryButton} onPress={() => void requestPermission()}><Text style={styles.primaryText}>Allow Camera</Text></TouchableOpacity></View> : <View style={styles.cameraWrap}><CameraView style={styles.camera} active={visible && !preview} enableTorch={torch} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={scanned ? undefined : ({ data }) => void resolve(data)} /><View pointerEvents="none" style={styles.scanFrame} /><TouchableOpacity style={styles.torch} onPress={() => setTorch((value) => !value)} accessibilityLabel="Toggle camera torch"><Ionicons name={torch ? 'flash' : 'flash-outline'} size={22} color="#FFFFFF" /></TouchableOpacity></View>}
        <Text style={styles.or}>OR ENTER THE 8-CHARACTER CODE</Text><View style={styles.manualRow}><TextInput style={styles.codeInput} value={manualCode} onChangeText={(value) => setManualCode(value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase())} placeholder="ABC12345" autoCapitalize="characters" accessibilityLabel="Manual QR payment code" /><TouchableOpacity style={[styles.resolveButton, manualCode.length !== 8 && styles.disabled]} disabled={manualCode.length !== 8 || busy} onPress={() => void resolve(manualCode, true)}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Review</Text>}</TouchableOpacity></View>
      </>}
    </ScrollView>
  </SafeAreaView></Modal>;
}

function Header({ title, onClose }: { title: string; onClose: () => void }) { return <View style={styles.header}><TouchableOpacity style={styles.close} onPress={onClose} accessibilityLabel="Close"><Ionicons name="close" size={24} color={tokens.colors.brandDark} /></TouchableOpacity><Text style={styles.headerTitle}>{title}</Text><View style={styles.close} /></View>; }
function ErrorMessage({ text, onRetry }: { text: string; onRetry: () => void }) { return <TouchableOpacity style={styles.error} onPress={onRetry} accessibilityRole="button"><Ionicons name="alert-circle-outline" size={20} color={tokens.colors.danger} /><Text style={styles.errorText}>{text} Tap to retry.</Text></TouchableOpacity>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.colors.signedInCanvas }, header: { minHeight: 72, paddingTop: 16, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: tokens.colors.border }, close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, headerTitle: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '800', color: tokens.colors.brandDark }, content: { padding: 18, paddingBottom: 40, gap: 14 }, intro: { fontSize: 13, lineHeight: 19, color: tokens.colors.textMuted },
  qrCard: { alignItems: 'center', padding: 18, borderRadius: 24, backgroundColor: tokens.colors.surface, borderWidth: 1, borderColor: tokens.colors.border }, qrFrame: { width: 246, height: 246, padding: 14, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 4, borderColor: tokens.colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, qrImage: { width: 210, height: 210 }, title: { marginTop: 14, fontSize: 19, fontWeight: '800', color: tokens.colors.brandDark, textAlign: 'center' }, amount: { marginTop: 6, fontSize: 29, fontWeight: '800', color: tokens.colors.brand }, muted: { marginTop: 4, fontSize: 12, lineHeight: 17, color: tokens.colors.textMuted }, codeLabel: { marginTop: 18, fontSize: 10, fontWeight: '800', letterSpacing: 1, color: tokens.colors.textMuted }, code: { marginTop: 5, fontSize: 24, fontWeight: '800', letterSpacing: 4, color: tokens.colors.brandDark }, security: { marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: tokens.colors.brandSoft, color: tokens.colors.onCanvasMuted, fontSize: 12, lineHeight: 18 },
  jobRow: { minHeight: 76, padding: 13, borderRadius: 17, borderWidth: 1, borderColor: tokens.colors.border, backgroundColor: tokens.colors.surface, flexDirection: 'row', alignItems: 'center', gap: 12 }, jobIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: tokens.colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, grow: { flex: 1 }, jobTitle: { fontSize: 14, fontWeight: '800', color: tokens.colors.text }, empty: { minHeight: 220, alignItems: 'center', justifyContent: 'center', padding: 20 },
  cameraWrap: { height: 360, borderRadius: 24, overflow: 'hidden', backgroundColor: '#0F172A' }, camera: { flex: 1 }, scanFrame: { position: 'absolute', width: 230, height: 230, alignSelf: 'center', top: 60, borderWidth: 3, borderColor: '#FFFFFF', borderRadius: 24 }, torch: { position: 'absolute', right: 16, bottom: 16, width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,.55)', alignItems: 'center', justifyContent: 'center' }, permission: { minHeight: 300, alignItems: 'center', justifyContent: 'center', padding: 24 }, or: { textAlign: 'center', fontSize: 10, fontWeight: '800', letterSpacing: 1, color: tokens.colors.textMuted }, manualRow: { flexDirection: 'row', gap: 10 }, codeInput: { flex: 1, minHeight: 52, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 14, paddingHorizontal: 14, fontSize: 17, fontWeight: '800', letterSpacing: 2, color: tokens.colors.text }, resolveButton: { minWidth: 92, minHeight: 52, borderRadius: 14, backgroundColor: tokens.colors.brand, alignItems: 'center', justifyContent: 'center' },
  previewCard: { padding: 18, borderRadius: 24, borderWidth: 1, borderColor: tokens.colors.border, backgroundColor: tokens.colors.surface }, eyebrow: { fontSize: 10, letterSpacing: 1, fontWeight: '800', color: tokens.colors.brand }, workerList: { marginTop: 16, borderTopWidth: 1, borderTopColor: tokens.colors.border }, workerRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: tokens.colors.border }, primaryButton: { marginTop: 16, minHeight: 52, borderRadius: 15, backgroundColor: tokens.colors.brand, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }, primaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 }, secondaryButton: { marginTop: 10, minHeight: 48, borderRadius: 15, borderWidth: 1, borderColor: tokens.colors.border, alignItems: 'center', justifyContent: 'center' }, secondaryText: { color: tokens.colors.brand, fontSize: 13, fontWeight: '800' }, disabled: { opacity: .5 }, error: { minHeight: 52, padding: 12, borderRadius: 14, backgroundColor: tokens.colors.dangerSoft, flexDirection: 'row', alignItems: 'center', gap: 8 }, errorText: { flex: 1, color: '#991B1B', fontSize: 12, lineHeight: 17 },
});
