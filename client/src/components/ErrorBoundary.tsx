import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button, StatusState } from "./ui";

type Props = {
  children: ReactNode;
  /**
   * Changing this value clears a captured error. The dashboard boundary passes
   * the current pathname so navigating away from a crashed page recovers on its
   * own instead of stranding the user on the fallback until a manual reload.
   */
  resetKey?: string;
  title?: string;
  description?: string;
};

type State = { error: Error | null };

/**
 * Catches render-time throws so one broken subtree cannot blank the app. Before
 * this existed the only protection was per-request try/catch, which does nothing
 * for an error raised during render.
 *
 * The fallback deliberately stays on plain primitives and untranslated copy: it
 * renders precisely when something in the tree is already misbehaving, so the
 * fewer moving parts it depends on (i18n, router, data contexts), the more
 * likely it is to actually paint.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error:", error, info.componentStack);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    const {
      title = "This page stopped responding",
      description = "The page hit an unexpected error and could not finish loading. Reloading usually clears it. If it keeps happening, sign out and back in.",
    } = this.props;

    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="w-full max-w-md">
          <StatusState
            tone="error"
            title={title}
            description={description}
            action={<Button onClick={() => window.location.reload()}>Reload page</Button>}
          />
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
