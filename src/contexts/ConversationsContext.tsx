import { createContext, useContext, useLayoutEffect, useState, memo, ReactNode } from 'react';
import { useConversations } from '@/hooks/useConversations';
import { AuthContext } from '@/hooks/useAuth';

type ConversationsContextValue = ReturnType<typeof useConversations> | null;

const ConversationsContext = createContext<ConversationsContextValue>(null);

/**
 * Provider that runs useConversations() ONCE globally.
 * Prevents duplicate realtime channel subscriptions when multiple
 * components (sidebar, topnav, messages page) need conversation data.
 *
 * Trädet under providern måste ha SAMMA struktur inloggad som utloggad.
 * Tidigare byttes elementtypen när användaren loggade in/ut, vilket
 * avmonterade och återmonterade HELA appen (router, inloggningsskärmen,
 * alla cachar) — synligt som en blinkning vid login och seg app efteråt.
 * Nu körs datakällan som ett syskon som bara skickar upp sitt värde.
 */
export function ConversationsProvider({ children }: { children: ReactNode }) {
  // Preview/HMR can briefly re-evaluate the provider module while keeping a
  // child tree from the previous module instance. Reading defensively avoids
  // turning that transient frame into a fatal boot error and reload cycle.
  const auth = useContext(AuthContext);
  const userId = auth?.user?.id ?? null;
  const [value, setValue] = useState<ConversationsContextValue>(null);

  return (
    <ConversationsContext.Provider value={userId ? value : null}>
      {userId ? <ConversationsSource key={userId} onValue={setValue} /> : null}
      {children}
    </ConversationsContext.Provider>
  );
}

const ConversationsSource = memo(function ConversationsSource({
  onValue,
}: {
  onValue: (value: ConversationsContextValue) => void;
}) {
  const value = useConversations();
  useLayoutEffect(() => {
    onValue(value);
  }, [value, onValue]);
  useLayoutEffect(() => () => onValue(null), [onValue]);
  return null;
});

/**
 * Read shared conversations state. Returns null when no user is signed in.
 * Components should fall back to preloaded values in that case.
 */
export function useConversationsContext() {
  return useContext(ConversationsContext);
}
