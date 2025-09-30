import React from 'react';

interface State {
  hasError: boolean;
  error?: Error;
  info?: React.ErrorInfo;
}

export default class GlobalErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log details for debugging
    console.error('[GlobalErrorBoundary] Caught error:', error);
    console.error('[GlobalErrorBoundary] Info:', info);
  }

  handleReload = () => {
    // Attempt a soft reload first
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-lg border bg-background/80 backdrop-blur p-6 text-center">
            <h2 className="text-lg font-semibold mb-2">Något gick fel</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Appen stötte på ett fel. Försök ladda om sidan.
            </p>
            <button
              onClick={this.handleReload}
              className="inline-flex items-center justify-center rounded-md px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Ladda om
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
