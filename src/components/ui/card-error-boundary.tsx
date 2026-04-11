import React, { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackClassName?: string;
}

interface State {
  hasError: boolean;
}

/**
 * Lightweight error boundary for individual cards.
 * If a single card crashes (bad data, image error, etc.),
 * it shows a minimal fallback instead of taking down the whole list.
 */
export class CardErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.warn('[CardErrorBoundary] A card crashed:', error.message, info.componentStack?.slice(0, 200));
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 p-6 text-white/50 ${this.props.fallbackClassName ?? ''}`}>
          <AlertTriangle className="h-5 w-5" />
          <span className="text-xs">Kunde inte visa kortet</span>
        </div>
      );
    }
    return this.props.children;
  }
}
