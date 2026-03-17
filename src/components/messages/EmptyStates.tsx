import type { Ref } from 'react';
import { MessageSquare } from 'lucide-react';

interface EmptyConversationListProps {
  hasSearch: boolean;
  iconRef?: Ref<HTMLDivElement>;
  contentRef?: Ref<HTMLDivElement>;
}

export function EmptyConversationList({
  hasSearch,
  iconRef,
  contentRef,
}: EmptyConversationListProps) {
  return (
    <div ref={contentRef} className="flex flex-col items-center px-4 text-center">
      <div
        ref={iconRef}
        className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-3"
      >
        <MessageSquare className="h-6 w-6 text-white" />
      </div>
      <h3 className="text-base font-medium text-white mb-0.5">
        {hasSearch ? 'Inga resultat' : 'Inga konversationer'}
      </h3>
      <p className="text-pure-white text-sm">
        {hasSearch
          ? 'Prova ett annat sökord'
          : 'Starta en konversation med en kandidat eller kollega'}
      </p>
    </div>
  );
}

interface EmptyChatStateProps {
  iconRef?: Ref<HTMLDivElement>;
  containerRef?: Ref<HTMLDivElement>;
  contentRef?: Ref<HTMLDivElement>;
}

export function EmptyChatState({
  iconRef,
  containerRef,
  contentRef,
}: EmptyChatStateProps) {
  return (
    <div
      ref={containerRef}
      className="relative flex-1 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm"
    >
      <div ref={contentRef} className="flex flex-col items-center px-4 text-center">
        <div
          ref={iconRef}
          className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-3"
        >
          <MessageSquare className="h-6 w-6 text-white" />
        </div>
        <h3 className="text-base font-medium text-white mb-0.5">Välj en konversation</h3>
        <p className="text-pure-white text-sm">Välj en konversation från listan</p>
      </div>
    </div>
  );
}
