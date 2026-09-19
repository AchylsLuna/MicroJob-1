import { Component, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { tokens } from '../theme/tokens';

type Props = {
  children: ReactNode;
  title?: string;
  message?: string;
  /** Label for the recovery action. */
  actionLabel?: string;
  /**
   * Invoked when the user taps the recovery action, after the captured error is
   * cleared. Native has no page reload, so the host decides what "try again"
   * means — usually remounting the navigator.
   */
  onReset?: () => void;
};

type State = { error: Error | null };

/**
 * Catches render-time throws so one broken screen cannot leave the app on a
 * blank canvas. Previously the app had no boundary at all, so any error raised
 * during render unmounted the whole tree.
 *
 * The fallback stays on plain primitives and untranslated copy on purpose: it
 * renders exactly when part of the tree is already misbehaving, so depending on
 * i18n, icon fonts or animation here would risk the fallback failing too.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('Unhandled render error:', error);
  }

  private handleReset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.error) return this.props.children;

    const {
      title = 'MicroJobs ran into a problem',
      message = 'This screen hit an unexpected error and could not finish loading. Try again, and if it keeps happening, close and reopen the app.',
      actionLabel = 'Try again',
    } = this.props;

    return (
      <View style={styles.screen}>
        <View style={styles.card} accessibilityRole="alert">
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <Pressable
            style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
            onPress={this.handleReset}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
          >
            <Text style={styles.actionText}>{actionLabel}</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

export default ErrorBoundary;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.xl,
    backgroundColor: tokens.colors.signedInCanvas,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    gap: tokens.spacing.sm,
    padding: tokens.spacing.lg,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.cardSoft,
  },
  title: { color: tokens.colors.text, fontSize: tokens.typography.h3, fontWeight: '800' },
  message: { color: tokens.colors.textMuted, fontSize: tokens.typography.body, lineHeight: 20 },
  action: {
    marginTop: tokens.spacing.xs,
    minHeight: tokens.controls.minimumTouch,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.brand,
  },
  // Brand blue has no darker step, so the pressed state reads through opacity.
  actionPressed: { opacity: 0.86 },
  actionText: {
    color: tokens.colors.onBrand,
    fontSize: tokens.typography.control,
    fontWeight: '800',
  },
});
