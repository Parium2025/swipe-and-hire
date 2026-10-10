import { useEffect } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/useAuth', async () => {
  const { createContext } = await import('react');
  return { AuthContext: createContext<{ user: { id: string } | null } | null>(null) };
});
vi.mock('@/hooks/useConversations', () => ({ useConversations: () => ({ totalUnreadCount: 0 }) }));

import { AuthContext } from '@/hooks/useAuth';
import { ConversationsProvider } from '../ConversationsContext';

describe('authentication tree stability', () => {
  it('does not remount the application during login, account switch or logout', () => {
    const mount = vi.fn();
    const unmount = vi.fn();
    function AppChild() {
      useEffect(() => { mount(); return unmount; }, []);
      return <div>App</div>;
    }
    // Mocked auth context intentionally exposes only the fields used by this provider.
    const Provider = AuthContext.Provider as React.Provider<{ user: { id: string } | null } | null>;
    const tree = (id: string | null) => (
      <Provider value={{ user: id ? { id } : null }}>
        <ConversationsProvider><AppChild /></ConversationsProvider>
      </Provider>
    );
    const { rerender } = render(tree(null));
    rerender(tree('a'));
    rerender(tree('b'));
    rerender(tree(null));
    expect(mount).toHaveBeenCalledTimes(1);
    expect(unmount).not.toHaveBeenCalled();
  });
});