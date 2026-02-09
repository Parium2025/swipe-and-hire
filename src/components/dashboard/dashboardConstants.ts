import {
  FileText,
  MessageSquare,
  Users,
  Wallet,
  Rocket,
  TrendingUp,
  Lightbulb,
  Newspaper,
} from 'lucide-react';

// Gradients for each quadrant
export const GRADIENTS = {
  tips: 'from-emerald-500/90 via-emerald-600/80 to-teal-700/90',
  stats: 'from-blue-500/90 via-blue-600/80 to-indigo-700/90',
  notes: 'from-violet-500/90 via-purple-600/80 to-purple-700/90',
  interviews: 'from-amber-500/90 via-orange-500/80 to-orange-600/90',
};

// Icon mapping for career tips categories
export const tipIconMap: Record<string, React.ElementType> = {
  FileText,
  MessageSquare,
  Users,
  Wallet,
  Rocket,
  TrendingUp,
  Lightbulb,
  Newspaper,
};

// Default gradients for tips without specific gradient
export const defaultTipGradients = [
  'from-emerald-500/90 via-emerald-600/80 to-teal-700/90',
  'from-blue-500/90 via-blue-600/80 to-indigo-700/90',
  'from-violet-500/90 via-purple-600/80 to-purple-700/90',
  'from-amber-500/90 via-orange-500/80 to-orange-600/90',
];

// Format published time as "idag HH:MM" or "igår HH:MM"
export function formatTipPublishedTime(publishedAt: string | null): string {
  if (!publishedAt) return '';
  
  try {
    const pubDate = new Date(publishedAt);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const pubDay = new Date(pubDate.getFullYear(), pubDate.getMonth(), pubDate.getDate());
    
    const timeStr = pubDate.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
    
    if (pubDay.getTime() === today.getTime()) {
      return `idag ${timeStr}`;
    } else if (pubDay.getTime() === yesterday.getTime()) {
      return `igår ${timeStr}`;
    } else {
      return pubDate.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
    }
  } catch {
    return '';
  }
}
