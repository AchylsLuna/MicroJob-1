import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../theme/tokens';

type ToastVariant = 'success' | 'error' | 'info';

type ToastState = {
  id: number;
  message: string;
  variant: ToastVariant;
} | null;

type ToastContextValue = {
  showToast: (message: string, variant?: ToastVariant) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);
const TOAST_DURATION_MS = 2600;

const getToastMeta = (variant: ToastVariant) => {
  switch (variant) {
    case 'success':
      return {
        icon: 'checkmark-circle' as const,
        backgroundColor: tokens.colors.successSoft,
        borderColor: '#A7F3D0',
        iconColor: '#059669',
        textColor: '#065F46',
      };
    case 'error':
      return {
        icon: 'alert-circle' as const,
        backgroundColor: tokens.colors.dangerSoft,
        borderColor: '#FECACA',
        iconColor: '#DC2626',
        textColor: '#991B1B',
      };
    default:
      return {
        icon: 'information-circle' as const,
        backgroundColor: tokens.colors.infoSoft,
        borderColor: '#BFDBFE',
        iconColor: tokens.colors.brand,
        textColor: tokens.colors.brand,
      };
  }
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearToastTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const showToast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const normalizedMessage = String(message || '').trim();
    if (!normalizedMessage) return;

    clearToastTimer();
    setToast({ id: Date.now(), message: normalizedMessage, variant });
    timerRef.current = setTimeout(() => {
      setToast(null);
      timerRef.current = null;
    }, TOAST_DURATION_MS);
  }, [clearToastTimer]);

  useEffect(() => {
    return clearToastTimer;
  }, [clearToastTimer]);

  const value = useMemo<ToastContextValue>(() => ({
    showToast,
    success: (message: string) => showToast(message, 'success'),
    error: (message: string) => showToast(message, 'error'),
    info: (message: string) => showToast(message, 'info'),
  }), [showToast]);

  const toastMeta = toast ? getToastMeta(toast.variant) : null;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && toastMeta ? (
        <View pointerEvents="none" style={styles.viewport}>
          <View
            style={[styles.toastCard, { backgroundColor: toastMeta.backgroundColor, borderColor: toastMeta.borderColor }]}
            accessible
            accessibilityRole={toast.variant === 'error' ? 'alert' : 'text'}
            accessibilityLiveRegion={toast.variant === 'error' ? 'assertive' : 'polite'}
            accessibilityLabel={toast.message}
          >
            <Ionicons name={toastMeta.icon} size={18} color={toastMeta.iconColor} />
            <Text style={[styles.toastText, { color: toastMeta.textColor }]}>{toast.message}</Text>
          </View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  viewport: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 104,
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  toastCard: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
  },
  toastText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
});
