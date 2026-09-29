import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Briefcase } from 'lucide-react';
import { StatsGrid } from '@/components/StatsGrid';

describe('bekräftade siffror vid kallstart', () => {
  beforeEach(() => {
    localStorage.setItem('counter_emp_total_jobs', '31');
    localStorage.setItem('counter_emp_expired_jobs', '9');
  });
  afterEach(() => {
    cleanup();
    localStorage.removeItem('counter_emp_total_jobs');
    localStorage.removeItem('counter_emp_expired_jobs');
  });

  it('visar varken gammal cache eller mellanvärden före serverns svar', () => {
    const stats = [{ icon: Briefcase, title: 'Annonser', value: 0, isLoading: true, cacheKey: 'emp_total_jobs',
      subItems: [{ label: 'Utgångna', value: 0, cacheKey: 'emp_expired_jobs' }] }];
    const { container, rerender } = render(<StatsGrid stats={stats} />);
    expect(container.textContent).not.toContain('31');
    expect(container.textContent).not.toContain('9');
    rerender(<StatsGrid stats={[{ ...stats[0], value: 41, isLoading: false, subItems: [{ ...stats[0].subItems[0], value: 2 }] }]} />);
    expect(screen.getAllByText('41').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    expect(container.textContent).not.toContain('31');
  });

  it('uppdaterar laddningsläget även när siffran är oförändrad', () => {
    const stats = [{ icon: Briefcase, title: 'Annonser', value: 0, isLoading: true, cacheKey: 'emp_total_jobs' }];
    const { container, rerender } = render(<StatsGrid stats={stats} />);
    expect(container.textContent).not.toContain('0');
    rerender(<StatsGrid stats={[{ ...stats[0], isLoading: false }]} />);
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('återanvänder inte förra kontots animerade siffra vid kontobyte', () => {
    const first = [{ icon: Briefcase, title: 'Annonser', value: 31, isLoading: false, cacheKey: 'emp_total_jobs:first' }];
    const { container, rerender } = render(<StatsGrid stats={first} />);
    expect(screen.getByText('31')).toBeTruthy();
    rerender(<StatsGrid stats={[{ ...first[0], value: 0, isLoading: true, cacheKey: 'emp_total_jobs:second' }]} />);
    expect(container.textContent).not.toContain('31');
    rerender(<StatsGrid stats={[{ ...first[0], value: 2, isLoading: false, cacheKey: 'emp_total_jobs:second' }]} />);
    expect(screen.getByText('2')).toBeTruthy();
  });
});