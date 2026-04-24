import React from 'react';

interface State {
  hasError: boolean;
  error?: Error;
  info?: React.ErrorInfo;
  isStuck: boolean;
}

export default class GlobalErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false, isStuck: false };
  private stuckTimer?: ReturnType<typeof setTimeout>;

  private clearCorruptLocalCaches() {
    if (typeof window === 'undefined') return;

    const resetPrefixes = [
      'parium_saved_jobs_cache',
      'parium_saved_jobs_full_cache_v1',
      'parium_skipped_jobs_full_cache_v1',
      'job_seeker_saved_jobs_',
      'job_seeker_applications_',
      'job_seeker_messages_',
      'job_seeker_interviews_',
      'job-details-cache-',
      'applications_snapshot_',
    ];

    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (!key) continue;
        if (resetPrefixes.some((prefix) => key.startsWith(prefix))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => window.localStorage.removeItem(key));
    } catch {
      // ignore
    }
  }

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
      this.clearCorruptLocalCaches();
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

      const errorDetails = this.state.error
        ? `${this.state.error.name}: ${this.state.error.message}`
        : null;

      const errorStack = this.state.error?.stack
        ? this.state.error.stack.split('\n').slice(0, 4).join('\n')
        : null;

      const componentStack = this.state.info?.componentStack
        ? this.state.info.componentStack.split('\n').slice(0, 5).join('\n')
        : null;
      
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background">
          <div className="max-w-md w-full rounded-lg border bg-card/80 backdrop-blur p-6 text-center">
            <h2 className="text-lg font-semibold mb-2">Något gick fel</h2>
            <p className="text-sm text-muted-foreground mb-4">
              {message}
            </p>
            {errorDetails && (
              <details className="text-left mb-4">
                <summary className="text-xs text-muted-foreground cursor-pointer mb-1">Visa teknisk info</summary>
                <pre className="text-[10px] leading-tight text-muted-foreground bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                  {errorDetails}
                  {errorStack && `\n\n${errorStack}`}
                  {componentStack && `\n\nComponent:\n${componentStack}`}
                </pre>
              </details>
            )}
            <button
              onClick={this.handleReload}
              className="inline-flex items-center justify-center rounded-md px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0"
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
