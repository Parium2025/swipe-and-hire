import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NotificationCenter from '../NotificationCenter';
import { TooltipProvider } from '@/components/ui/tooltip';

const archiveState = vi.hoisted(() => ({
  items: [] as Array<{ id: string; kind: 'error'; title: string; body: string; at: number; count: number; is_read: boolean }>,
  markAsRead: vi.fn(),
}));
const notificationState = vi.hoisted(() => ({
  notifications: [] as Array<{ id: string; user_id: string; type: string; title: string; body: string | null; is_read: boolean; metadata: Record<string, unknown>; created_at: string }>,
  unreadCount: 0,
  markAsRead: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => notificationState.navigate }));
vi.mock('@/hooks/useNotifications', () => ({
  useNotifications: () => ({
    notifications: notificationState.notifications,
    unreadCount: notificationState.unreadCount,
    markAsRead: notificationState.markAsRead,
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
    getSnapshot: () => archiveState.items,
    markAllAsRead: vi.fn(),
    markAsRead: archiveState.markAsRead,
    clear: vi.fn(),
  },
}));

describe('NotificationCenter', () => {
  afterEach(() => {
    cleanup();
    notificationState.notifications = [];
    notificationState.unreadCount = 0;
    notificationState.markAsRead.mockClear();
    notificationState.navigate.mockClear();
    archiveState.items = [];
    archiveState.markAsRead.mockClear();
  });

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

  it('har ingen rund touchbakgrund runt mobilklockan', () => {
    render(<NotificationCenter />);
    const trigger = screen.getByLabelText('Notifikationer');

    expect(trigger.className).toContain('bg-transparent');
    expect(trigger.className).toContain('[@media(hover:hover)]:rounded-full');
    expect(trigger.className).not.toMatch(/(?:^|\s)rounded-full(?:\s|$)/);
    expect(trigger.className).not.toMatch(/(?:^|\s)hover:bg-white\/10(?:\s|$)/);
  });

  it('stänger panelen när rubrikraden trycks', async () => {
    render(<NotificationCenter />);
    fireEvent.click(screen.getByLabelText('Notifikationer'));

    fireEvent.click(screen.getByLabelText('Stäng notifikationer'));

    await waitFor(() => {
      expect(screen.queryByText('Notifikationer', { selector: 'h3' })).toBeNull();
    });
  });

  it('markerar en informationsnotis utan destination som läst vid tryck, utan navigering', () => {
    notificationState.notifications = [{
      id: 'notice-1', user_id: 'user-1', type: 'invite_error',
      title: 'Fel', body: 'Adressen tillhör redan ett annat företag på Parium.',
      is_read: false, metadata: {}, created_at: new Date().toISOString(),
    }];
    notificationState.unreadCount = 1;
    render(<TooltipProvider><NotificationCenter /></TooltipProvider>);
    fireEvent.click(screen.getByLabelText('Notifikationer'));
    fireEvent.click(screen.getByText('Fel'));
    expect(notificationState.markAsRead).toHaveBeenCalledTimes(1);
    expect(notificationState.markAsRead).toHaveBeenCalledWith('notice-1');
    expect(notificationState.navigate).not.toHaveBeenCalled();
  });

  it('navigerar fortfarande när en notis har destination', () => {
    notificationState.notifications = [{
      id: 'notice-2', user_id: 'user-1', type: 'saved_search_match',
      title: 'Nytt jobb', body: null, is_read: false, metadata: {}, created_at: new Date().toISOString(),
    }];
    render(<TooltipProvider><NotificationCenter /></TooltipProvider>);
    fireEvent.click(screen.getByLabelText('Notifikationer'));
    fireEvent.click(screen.getByText('Nytt jobb'));
    expect(notificationState.markAsRead).toHaveBeenCalledTimes(1);
    expect(notificationState.markAsRead).toHaveBeenCalledWith('notice-2');
    expect(notificationState.navigate).toHaveBeenCalledTimes(1);
    expect(notificationState.navigate).toHaveBeenCalledWith('/search-jobs');
  });

  it('markerar även ett lokalt fel utan destination som läst vid tryck', () => {
    archiveState.items = [{ id: 'local-1', kind: 'error', title: 'Fel', body: 'Försök igen.', at: Date.now(), count: 1, is_read: false }];
    render(<TooltipProvider><NotificationCenter /></TooltipProvider>);
    fireEvent.click(screen.getByLabelText('Notifikationer'));
    fireEvent.click(screen.getByText('Fel'));
    expect(archiveState.markAsRead).toHaveBeenCalledTimes(1);
    expect(archiveState.markAsRead).toHaveBeenCalledWith('local-1');
    expect(notificationState.navigate).not.toHaveBeenCalled();
  });

  it('visar den nya siffran med en enda animation även när 9+ redan visas', () => {
    notificationState.unreadCount = 9;
    const { rerender } = render(<TooltipProvider><NotificationCenter /></TooltipProvider>);
    const first = document.querySelector('.parium-badge-pop');
    expect(first?.textContent).toContain('9');

    notificationState.unreadCount = 10;
    rerender(<TooltipProvider><NotificationCenter variant="rect" /></TooltipProvider>);
    const next = document.querySelector('.parium-badge-pop');
    expect(next?.textContent).toContain('9+');
    expect(next).not.toBe(first);
    expect(document.querySelectorAll('.parium-badge-pop')).toHaveLength(1);

    notificationState.unreadCount = 11;
    rerender(<TooltipProvider><NotificationCenter variant="rect" /></TooltipProvider>);
    const stillCapped = document.querySelector('.parium-badge-pop');
    expect(stillCapped?.textContent).toContain('9+');
    expect(stillCapped).not.toBe(next);
  });
});