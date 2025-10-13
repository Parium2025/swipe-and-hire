import React from 'react';

interface State {
  hasError: boolean;
  error?: Error;
  info?: React.ErrorInfo;
  isStuck: boolean;
}

export default class GlobalErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false, isStuck: false };
  private stuckTimer?: NodeJS.Timeout;

  componentDidMount() {
    // Detect if app is stuck (e.g., redirect loop in preview)
    this.stuckTimer = setTimeout(() => {
      // If component is still mounted after 5 seconds without user interaction,
      // check if we're on a problematic URL
      const urlParams = new URLSearchParams(window.location.search);
      const hasAuthTokens = urlParams.has('access_token') || 
                           urlParams.has('token') || 
                           urlParams.has('token_hash');
      
      if (hasAuthTokens && window.location.pathname !== '/auth') {
        console.warn('[GlobalErrorBoundary] Detected potential stuck state');
        this.setState({ isStuck: true });
      }
    }, 5000);
  }

  componentWillUnmount() {
    if (this.stuckTimer) clearTimeout(this.stuckTimer);
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, isStuck: false };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log details for debugging
    console.error('[GlobalErrorBoundary] Caught error:', error);
    console.error('[GlobalErrorBoundary] Info:', info);
  }

  handleReload = () => {
    // Clear any stuck state and reload
    if (typeof window !== 'undefined') {
      // Clear URL parameters that might cause loops
      const cleanUrl = window.location.origin + window.location.pathname;
      window.location.replace(cleanUrl);
    }
  };

  render() {
    if (this.state.hasError || this.state.isStuck) {
      const message = this.state.isStuck 
        ? "Appen verkar ha fastnat. Klicka för att ladda om."
        : "Appen stötte på ett fel. Försök ladda om sidan.";
      
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background">
          <div className="max-w-md w-full rounded-lg border bg-card/80 backdrop-blur p-6 text-center">
            <h2 className="text-lg font-semibold mb-2">Något gick fel</h2>
            <p className="text-sm text-muted-foreground mb-4">
              {message}
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
