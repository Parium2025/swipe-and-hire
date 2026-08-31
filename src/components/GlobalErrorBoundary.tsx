import React from 'react';
import { getAuthRedirectTarget } from '@/lib/authLinkRouting';

interface State {
  hasError: boolean;
  error?: Error;
  info?: React.ErrorInfo;
  errorId?: string;
  isStuck: boolean;
}

export function safeErrorTelemetry(error: Error, errorId: string) {
  return {
    errorId,
    errorName: error.name || 'Error',
  };
}

export function shouldFlagPotentialAuthStall(href: string): boolean {
  let current: URL;
  try {
    current = new URL(href);
  } catch {
    return false;
  }

  const hash = new URLSearchParams(current.hash.startsWith('#') ? current.hash.slice(1) : current.hash);
  const hasAuthCredential = [
    'access_token',
    'refresh_token',
    'token_hash',
    'token',
    'provider_token',
    'provider_refresh_token',
  ].some((key) => current.searchParams.has(key) || hash.has(key));

  return hasAuthCredential && getAuthRedirectTarget(current.toString()) !== null;
}

function createErrorReference(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `error-${Date.now().toString(36)}`;
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
      'parium_is_org_admin_',
      'parium_browser_cache_reset',
      'parium_sw_force_reset',
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
      if (shouldFlagPotentialAuthStall(window.location.href)) {
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
    const errorId = createErrorReference();
    this.setState({ info, errorId });

    if (import.meta.env.DEV) {
      console.error('[GlobalErrorBoundary] Caught error:', error);
      console.error('[GlobalErrorBoundary] Info:', info);
    } else {
      // Never put messages, stacks, URLs or user data into production logs.
      console.error('[GlobalErrorBoundary] Caught error', safeErrorTelemetry(error, errorId));
    }
  }

  handleReload = () => {
    // Clear any stuck state and reload
    if (typeof window !== 'undefined') {
      this.clearCorruptLocalCaches();

      // Clear URL parameters that might cause loops and force a fresh app shell
      const cleanUrl = `${window.location.origin}${window.location.pathname}?_recover=${Date.now()}`;
      window.location.replace(cleanUrl);
    }
  };

  render() {
    if (this.state.hasError || this.state.isStuck) {
      const message = this.state.isStuck 
        ? "Appen verkar ha fastnat. Klicka för att ladda om."
        : "Appen stötte på ett fel. Försök ladda om sidan.";

      const showTechnicalDetails = import.meta.env.DEV;

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
        <div className="min-h-screen flex items-center justify-center p-6 bg-parium-gradient">
          <div className="max-w-md w-full rounded-lg border border-white/15 bg-white/[0.07] backdrop-blur-md shadow-2xl p-6 sm:p-8 text-center">
            <div className="mb-4 flex items-center justify-center gap-2">
              <span className="text-base font-semibold text-white">Parium</span>
            </div>
            <h2 className="text-lg font-semibold mb-2 text-white">Något gick fel</h2>
            <p className="text-sm text-white mb-5">
              {message}
            </p>
            {showTechnicalDetails && errorDetails && (
              <details className="text-left mb-4">
                <summary className="text-xs text-white/70 cursor-pointer mb-1">Visa teknisk info</summary>
                <pre className="text-[10px] leading-tight text-white/80 bg-white/10 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                  {errorDetails}
                  {errorStack && `\n\n${errorStack}`}
                  {componentStack && `\n\nComponent:\n${componentStack}`}
                </pre>
              </details>
            )}
            {!showTechnicalDetails && this.state.errorId && (
              <p className="mb-4 text-xs text-white/60">
                Referens: {this.state.errorId}
              </p>
            )}
            <button
              onClick={this.handleReload}
              className="inline-flex w-full items-center justify-center rounded-full px-4 py-2 bg-secondary text-white font-medium hover:bg-secondary/90 transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0"
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
