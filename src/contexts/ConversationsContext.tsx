import { createContext, useContext, ReactNode } from 'react';
import { useConversations } from '@/hooks/useConversations';
import { AuthContext } from '@/hooks/useAuth';

type ConversationsContextValue = ReturnType<typeof useConversations> | null;

const ConversationsContext = createContext<ConversationsContextValue>(null);

/**
 * Provider that runs useConversations() ONCE globally.
 * Prevents duplicate realtime channel subscriptions when multiple
 * components (sidebar, topnav, messages page) need conversation data.
 *
 * Realtime updates flow through the single subscription inside
 * useConversations and propagate to all consumers via context.
 */
export function ConversationsProvider({ children }: { children: ReactNode }) {
  // Preview/HMR can briefly re-evaluate the provider module while keeping a
  // child tree from the previous module instance. Reading defensively avoids
  // turning that transient frame into a fatal boot error and reload cycle.
  const auth = useContext(AuthContext);
  const user = auth?.user ?? null;
  // Only mount the hook when authenticated to avoid wasted subscriptions
  if (!user) {
    return (
      <ConversationsContext.Provider value={null}>
        {children}
      </ConversationsContext.Provider>
    );
  }
  return <ConversationsProviderInner>{children}</ConversationsProviderInner>;
}

function ConversationsProviderInner({ children }: { children: ReactNode }) {
  const value = useConversations();
  return (
    <ConversationsContext.Provider value={value}>
      {children}
    </ConversationsContext.Provider>
  );
}

/**
 * Read shared conversations state. Returns null when no user is signed in.
 * Components should fall back to preloaded values in that case.
 */
export function useConversationsContext() {
  return useContext(ConversationsContext);
}
