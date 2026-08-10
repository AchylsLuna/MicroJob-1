import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AUTH_COLORS } from '../../theme/authTheme';

type FieldProps = TextInputProps & {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  error?: string;
  secure?: boolean;
  revealed?: boolean;
  onToggleReveal?: () => void;
};

export function AuthField({ label, icon, error, secure, revealed, onToggleReveal, ...inputProps }: FieldProps) {
  return <View style={styles.fieldBlock}>
    <Text style={styles.label}>{label}</Text>
    <View style={[styles.field, error ? styles.fieldError : null]}>
      <Feather name={icon} size={19} color={error ? AUTH_COLORS.danger : AUTH_COLORS.textMuted} />
      <TextInput
        {...inputProps}
        style={styles.input}
        placeholderTextColor={AUTH_COLORS.placeholderLight}
        secureTextEntry={secure && !revealed}
        multiline={false}
      />
      {secure ? <TouchableOpacity
        style={styles.iconButton}
        onPress={onToggleReveal}
        accessibilityRole="button"
        accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
      ><Feather name={revealed ? 'eye-off' : 'eye'} size={20} color={AUTH_COLORS.textMuted} /></TouchableOpacity> : null}
    </View>
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </View>;
}

export function AuthButton({ label, onPress, loading = false, disabled = false, secondary = false }: {
  label: string; onPress?: () => void; loading?: boolean; disabled?: boolean; secondary?: boolean;
}) {
  const blocked = loading || disabled;
  return <TouchableOpacity
    style={[styles.button, secondary ? styles.secondaryButton : null, blocked ? styles.disabled : null]}
    onPress={onPress}
    disabled={blocked}
    accessibilityRole="button"
    accessibilityState={{ disabled: blocked, busy: loading }}
  >{loading ? <ActivityIndicator color={secondary ? AUTH_COLORS.primary : '#fff'} /> :
    <Text style={[styles.buttonText, secondary ? styles.secondaryButtonText : null]}>{label}</Text>}
  </TouchableOpacity>;
}

export function PasswordChecklist({ password, confirm }: { password: string; confirm?: string }) {
  const rules = [
    ['8 or more characters', password.length >= 8],
    ['Uppercase and lowercase letters', /[A-Z]/.test(password) && /[a-z]/.test(password)],
    ['At least one number', /\d/.test(password)],
    ['At least one special character', /[^A-Za-z0-9]/.test(password)],
    ...(confirm === undefined ? [] : [['Passwords match', Boolean(password && confirm && password === confirm)] as [string, boolean]]),
  ] as Array<[string, boolean]>;
  return <View style={styles.checklist}>{rules.map(([text, ok]) => <View key={text} style={styles.rule}>
    <Feather name={ok ? 'check-circle' : 'circle'} size={15} color={ok ? AUTH_COLORS.success : AUTH_COLORS.textTertiary} />
    <Text style={[styles.ruleText, ok ? styles.rulePassed : null]}>{text}</Text>
  </View>)}</View>;
}

export function AuthProgress({ step, total = 3 }: { step: number; total?: number }) {
  const width = `${Math.max(0, Math.min(100, Math.round((step / total) * 100)))}%` as `${number}%`;
  return <View style={styles.progressBlock}>
    <View style={styles.progressMeta}><Text style={styles.progressLabel}>Step {step} of {total}</Text><Text style={styles.progressValue}>{Math.round((step / total) * 100)}%</Text></View>
    <View style={styles.progressTrack}><View style={[styles.progressFill, { width }]} /></View>
  </View>;
}

const styles = StyleSheet.create({
  fieldBlock: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '700', color: AUTH_COLORS.textPrimary, marginBottom: 7 },
  field: { minHeight: 54, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: AUTH_COLORS.inputLightBorder, borderRadius: 14, backgroundColor: '#fff', paddingLeft: 15, paddingVertical: 2 },
  fieldError: { borderColor: AUTH_COLORS.danger, backgroundColor: '#FFFBFB' },
  input: { flex: 1, minHeight: 52, paddingHorizontal: 11, paddingVertical: 10, color: AUTH_COLORS.textPrimary, fontSize: 15 },
  iconButton: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  error: { marginTop: 6, color: AUTH_COLORS.danger, fontSize: 12, fontWeight: '500' },
  button: { minHeight: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: AUTH_COLORS.primary, marginTop: 6, paddingHorizontal: 16, paddingVertical: 12 },
  secondaryButton: { backgroundColor: '#fff', borderWidth: 1, borderColor: AUTH_COLORS.cardBorder },
  disabled: { opacity: 0.55 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  secondaryButtonText: { color: AUTH_COLORS.primary },
  checklist: { backgroundColor: '#F8FAFC', padding: 13, borderRadius: 12, marginBottom: 14 },
  rule: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 3 },
  ruleText: { color: AUTH_COLORS.textSecondary, fontSize: 12, marginLeft: 8, flex: 1, flexShrink: 1 },
  rulePassed: { color: '#15803D' },
  progressBlock: { marginBottom: 16 },
  progressMeta: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 7, flexWrap: 'wrap', gap: 6 },
  progressLabel: { color: AUTH_COLORS.onBlueMuted, fontSize: 12, fontWeight: '700' },
  progressValue: { color: AUTH_COLORS.onBlue, fontSize: 12, fontWeight: '800' },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: AUTH_COLORS.blueControlSurface },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: AUTH_COLORS.primary },
});
