import React from 'react';
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
  ViewStyle,
} from 'react-native';
import { tokens } from '../../theme/tokens';

export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <View style={styles.pageHeader}>
      <View style={styles.pageHeaderCopy}>
        <Text style={styles.pageTitle}>{title}</Text>
        {subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'success';

export function Button({
  children,
  variant = 'primary',
  loading = false,
  disabled,
  style,
  ...props
}: TouchableOpacityProps & {
  children: React.ReactNode;
  variant?: ButtonVariant;
  loading?: boolean;
}) {
  const inactive = disabled || loading;
  return (
    <TouchableOpacity
      {...props}
      disabled={inactive}
      activeOpacity={0.85}
      style={[styles.button, styles[`${variant}Button`], inactive && styles.disabled, style]}
    >
      {loading ? <ActivityIndicator color={variant === 'secondary' ? tokens.colors.brand : tokens.colors.onBrand} /> : children}
    </TouchableOpacity>
  );
}

export function ButtonLabel({ children, variant = 'primary', style }: { children: React.ReactNode; variant?: ButtonVariant; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.buttonLabel, variant === 'secondary' && styles.secondaryButtonLabel, style]}>{children}</Text>;
}

export function Field(props: TextInputProps) {
  return <TextInput {...props} placeholderTextColor={props.placeholderTextColor || tokens.colors.textSubtle} style={[styles.field, props.multiline && styles.multilineField, props.style]} />;
}

export function StatusPanel({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'success' | 'danger' | 'warning' | 'info' }) {
  return <View style={[styles.statusPanel, styles[`${tone}Panel`]]}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.colors.background },
  card: { borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 16, backgroundColor: tokens.colors.surface, padding: tokens.spacing.lg, ...tokens.shadow.card },
  pageHeader: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.spacing.md, borderBottomWidth: 1, borderBottomColor: tokens.colors.border, backgroundColor: tokens.colors.surface, paddingHorizontal: tokens.layout.gutter, paddingVertical: tokens.spacing.md },
  pageHeaderCopy: { flex: 1, minWidth: 0 },
  pageTitle: { color: tokens.colors.text, fontSize: tokens.typography.h2, lineHeight: 28, fontWeight: '800' },
  pageSubtitle: { marginTop: 2, color: tokens.colors.textMuted, fontSize: tokens.typography.caption, lineHeight: 18 },
  button: { minHeight: tokens.controls.buttonHeight, minWidth: tokens.controls.minimumTouch, alignItems: 'center', justifyContent: 'center', borderRadius: tokens.radius.sm, paddingHorizontal: tokens.spacing.lg },
  primaryButton: { backgroundColor: tokens.colors.brand },
  secondaryButton: { borderWidth: 1, borderColor: tokens.colors.border, backgroundColor: tokens.colors.surface },
  destructiveButton: { backgroundColor: tokens.colors.danger },
  successButton: { backgroundColor: tokens.colors.success },
  disabled: { opacity: 0.5 },
  buttonLabel: { color: tokens.colors.onBrand, fontSize: tokens.typography.control, fontWeight: '700' },
  secondaryButtonLabel: { color: tokens.colors.brand },
  field: { minHeight: tokens.controls.fieldHeight, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: tokens.radius.sm, backgroundColor: '#F9FAFB', paddingHorizontal: tokens.spacing.md, color: tokens.colors.text, fontSize: tokens.typography.control },
  multilineField: { minHeight: 100, paddingTop: tokens.spacing.md, paddingBottom: tokens.spacing.md, textAlignVertical: 'top' },
  statusPanel: { borderWidth: 1, borderRadius: tokens.radius.sm, padding: tokens.spacing.md },
  neutralPanel: { borderColor: tokens.colors.border, backgroundColor: tokens.colors.surfaceMuted },
  successPanel: { borderColor: '#A7F3D0', backgroundColor: tokens.colors.successSoft },
  dangerPanel: { borderColor: '#FECACA', backgroundColor: tokens.colors.dangerSoft },
  warningPanel: { borderColor: '#FDE68A', backgroundColor: tokens.colors.warningSoft },
  infoPanel: { borderColor: '#BAE6FD', backgroundColor: tokens.colors.infoSoft },
});
