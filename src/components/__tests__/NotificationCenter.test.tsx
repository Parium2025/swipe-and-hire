import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NotificationCenter from '../NotificationCenter';

const emptyArchive: never[] = [];

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('@/hooks/useNotifications', () => ({
  useNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    clearAll: vi.fn(),
    hasMore: false,
    isLoadingMore: false,
    loadMore: vi.fn(),
    hasError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock('@/hooks/useNotificationPreferences', () => ({
  useNotificationPreferences: () => ({ isEnabled: () => true }),
}));
vi.mock('@/lib/toastArchive', () => ({
  toastArchive: {
    subscribe: () => () => undefined,
    getSnapshot: () => emptyArchive,
    markAllAsRead: vi.fn(),
    markAsRead: vi.fn(),
    clear: vi.fn(),
  },
}));

describe('NotificationCenter', () => {
  afterEach(cleanup);

  it('öppnar panelen i document.body så arbetsgivarhuvudet inte kan klippa den', () => {
    const { container } = render(
      <div style={{ overflow: 'hidden' }}>
        <NotificationCenter />
      </div>,
    );

    fireEvent.click(screen.getByLabelText('Notifikationer'));
    const heading = screen.getByText('Notifikationer', { selector: 'h3' });
    expect(heading).toBeTruthy();
    expect(container.contains(heading)).toBe(false);
    expect(document.body.contains(heading)).toBe(true);
  });
});