/** Render failures must release scene services and offer a recoverable host UI. */
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  readonly children: ReactNode;
  readonly onReturnToMenu: () => void;
  readonly saveTools: ReactNode;
}

/** Remount with the authoritative session revision to clear a prior failure. */
export class GameSceneErrorBoundary extends Component<Props, { readonly error: string | null }> {
  override state = { error: null as string | null };

  static getDerivedStateFromError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: message.trim() || 'An unexpected presentation error occurred.' };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Game scene presentation failed', error, info.componentStack);
  }

  override render() {
    if (this.state.error === null) return this.props.children;
    // Replacing the entire scene subtree invokes each owner's normal cleanup.
    // Save operation state stays in App, outside this failed scene boundary.
    return <>
      <main className="startup-failure" role="alert">
        <p>The game presentation could not continue: {this.state.error}</p>
        <button type="button" onClick={this.props.onReturnToMenu}>Return to menu</button>
      </main>
      {this.props.saveTools}
    </>;
  }
}
