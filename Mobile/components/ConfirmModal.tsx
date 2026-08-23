import React from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { tokens } from '../theme/tokens';

type ConfirmModalProps = {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({
  visible,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  pending = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { t } = useTranslation('common');
  const resolvedConfirmLabel = confirmLabel ?? t('confirmModal.confirmLabel');
  const resolvedCancelLabel = cancelLabel ?? t('confirmModal.cancelLabel');
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => !pending && onCancel()} statusBarTranslucent>
      <View style={styles.backdrop} accessibilityViewIsModal>
        <View style={styles.dialog} accessibilityRole="alert">
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
          {error ? <Text style={styles.error} accessibilityLiveRegion="assertive">{error}</Text> : null}
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" accessibilityLabel={resolvedCancelLabel} disabled={pending} onPress={onCancel} style={({ pressed }) => [styles.button, styles.cancelButton, pressed && styles.pressed, pending && styles.disabled]}>
              <Text style={styles.cancelText}>{resolvedCancelLabel}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={resolvedConfirmLabel} accessibilityState={{ disabled: pending, busy: pending }} disabled={pending} onPress={onConfirm} style={({ pressed }) => [styles.button, destructive ? styles.dangerButton : styles.confirmButton, pressed && styles.pressed, pending && styles.disabled]}>
              {pending ? <ActivityIndicator color={tokens.colors.onBrand} /> : <Text style={styles.confirmText}>{resolvedConfirmLabel}</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: tokens.spacing.xl, backgroundColor: 'rgba(15, 23, 42, 0.58)' },
  dialog: { width: '100%', maxWidth: 440, borderRadius: tokens.radius.lg, padding: tokens.spacing.xl, backgroundColor: tokens.colors.surface, ...tokens.shadow.card },
  title: { color: tokens.colors.text, fontSize: tokens.typography.h3, fontWeight: '700' },
  description: { marginTop: tokens.spacing.sm, color: tokens.colors.textMuted, fontSize: tokens.typography.body, lineHeight: 21 },
  error: { marginTop: tokens.spacing.md, borderRadius: tokens.radius.sm, padding: tokens.spacing.md, color: '#991B1B', backgroundColor: '#FEF2F2' },
  actions: { marginTop: tokens.spacing.xl, flexDirection: 'row', justifyContent: 'flex-end', gap: tokens.spacing.sm },
  button: { minWidth: 104, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: tokens.radius.sm, paddingHorizontal: tokens.spacing.lg },
  cancelButton: { borderWidth: 1, borderColor: tokens.colors.border, backgroundColor: tokens.colors.surface },
  confirmButton: { backgroundColor: tokens.colors.brandAccent },
  dangerButton: { backgroundColor: tokens.colors.danger },
  cancelText: { color: tokens.colors.text, fontWeight: '700' },
  confirmText: { color: tokens.colors.onBrand, fontWeight: '700' },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.55 },
});
