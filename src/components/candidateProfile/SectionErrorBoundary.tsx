import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackLabel?: string;
}

interface State {
  hasError: boolean;
}

/**
 * Lightweight error boundary for individual sections inside the candidate
 * profile dialog. If e.g. the AI summary or notes panel throws, only that
 * section shows an error — the rest of the dialog keeps working.
 */
export class SectionErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[SectionErrorBoundary] ${this.props.fallbackLabel || 'Section'} crashed:`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-white/5 border border-white/10 rounded-lg p-4 flex flex-col items-center justify-center gap-2 text-center">
          <AlertTriangle className="h-5 w-5 text-yellow-400/80" />
          <p className="text-xs text-white/60">
            {this.props.fallbackLabel || 'Sektionen'} kunde inte laddas
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="text-xs text-white/40 hover:text-white/70 underline transition-colors"
          >
            Försök igen
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
